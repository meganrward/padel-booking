#!/usr/bin/env python3
"""Padel slot availability checker for Stratford Padel Club."""

import http.cookiejar
import json
import os
import re
import subprocess
import sys
import traceback
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

# --- CONFIGURATION (edit these) ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# iMessage recipients — each entry specifies which alert types they receive.
# alert types: "lessons", "train_and_play", "courts"
#   Optional per-target instructor overrides:
#     "excluded_instructors": [...]  — skip this target for these instructors (defaults to EXCLUDED_INSTRUCTORS)
#     "included_instructors": [...]  — if set, ONLY notify this target for these instructors,
#                                       ignoring excluded_instructors entirely
# Managed via people.json (edit directly, or use the admin UI in backend/ + frontend/).
def load_targets():
    path = os.path.join(SCRIPT_DIR, "people.json")
    with open(path) as f:
        return json.load(f)

IMESSAGE_TARGETS = load_targets()

NTFY_TOPIC = ""       # e.g. "megan-padel-abc123" — leave empty to skip phone notifications

# Toggle alert types on/off independently
NOTIFY_LESSONS        = True  # private class + SPC tournaments — paused
NOTIFY_TRAIN_AND_PLAY = True
NOTIFY_COURTS         = True

WEEKS_AHEAD = 6   # check current week + this many ahead, minus 1 week to stay inside the ~41.3 day booking advance window
ACTIVITY_FILTERS = ["private class", "train and play blue"]
EXCLUDED_INSTRUCTORS = ["lucas burgess", "richard pratt", "megan  ward" ]
STATE_FILE = os.path.join(SCRIPT_DIR, "notified_slots.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "padel_checker.log")

# Court booking config
COURT_MIN_TIME          = "18:00"   # only alert for slots starting at or after this time (HH:MM)
COURT_MAX_START_TIME    = "21:30"   # do not alert for slots starting at or after this time
COURT_MIN_DURATION_MINS = 60        # only alert for gaps of at least this duration
COURT_GRID_ID           = 4         # idCuadro for the Padel court grid (discovered 2026-05-21 via ObtenerCuadros)

BASE_URL = "https://stratfordpadelclub.matchpoint.com.es"


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def post_json(path, body, opener=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "Mozilla/5.0",
    }
    if opener:
        headers["Referer"] = BASE_URL + "/Booking/Grid.aspx"
    req = urllib.request.Request(BASE_URL + path, data=data, headers=headers)
    open_fn = opener.open if opener else urllib.request.urlopen
    with open_fn(req, timeout=15) as resp:
        return json.loads(resp.read())


# ---------------------------------------------------------------------------
# Activity booking (classes / train & play)
# ---------------------------------------------------------------------------

def get_available_weeks():
    result = post_json("/ActBooking/srvc.aspx/ObtenerSemanas", {})
    weeks = result.get("d", [])
    return weeks[:WEEKS_AHEAD]  # drop the last API week — not yet within the booking advance window


def get_activities_for_week(week_num, year):
    body = {
        "idCentro": "2",
        "idGrupoActividad": "0",
        "idActividad": "0",
        "tiraSemanaAño": f"{week_num},{year}",
    }
    result = post_json("/ActBooking/srvc.aspx/ObtenerCuadroActividadesSemanal", body)
    return result.get("d", [])


def is_target_activity(name):
    n = name.strip().lower()
    return any(f in n for f in ACTIVITY_FILTERS)


def get_activity_alert_type(name):
    n = name.strip().lower()
    if "train and play blue" in n:
        return "train_and_play"
    return "lessons"


def find_available_slots(activities):
    return [
        a for a in activities
        if is_target_activity(a.get("Actividad", ""))
        and a.get("PlazasTotales", 0) - a.get("PlazasReservadas", 0) > 0
    ]


def fetch_detail_html(link_url):
    try:
        req = urllib.request.Request(link_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        log(f"  Detail page fetch failed for {link_url[:80]}: {e}")
        return ""


def instructor_matches(html, names):
    h = html.lower()
    return any(name in h for name in names)


def is_excluded_instructor(html):
    return instructor_matches(html, EXCLUDED_INSTRUCTORS)


def target_allows_instructor(html, target):
    """Per-target instructor filter: included_instructors (if set) overrides excluded_instructors."""
    included = target.get("included_instructors")
    if included:
        return instructor_matches(html, included)
    excluded = target.get("excluded_instructors", EXCLUDED_INSTRUCTORS)
    return not instructor_matches(html, excluded)


def target_level_suitable(html, target):
    """Per-target level filter for train_and_play: only applies if the target has a "level" set."""
    level = target.get("level")
    if level is None:
        return True
    return f"{float(level):.2f}".replace(".", ",") in html


def get_date_from_link(link):
    params = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
    raw = params.get("d", [""])[0]  # e.g. "14-05-2026"
    try:
        return datetime.strptime(raw, "%d-%m-%Y").strftime("%a %d %b")  # "Thu 14 May"
    except ValueError:
        return raw


def get_instructor_from_html(html):
    match = re.search(r'LabelMonitor[^>]*>([^<]+)<', html)
    return match.group(1).strip() if match else ""


def get_slot_id(activity):
    link = activity.get("Link", "")
    try:
        return link.split("bid=")[1].split("&")[0]
    except IndexError:
        return link


# ---------------------------------------------------------------------------
# Court booking (Grid.aspx)
# ---------------------------------------------------------------------------

def _mins(hhmm):
    """Convert 'HH:MM' string to minutes since midnight."""
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _fmt_mins(total_mins):
    """Convert minutes since midnight to 'HH:MM'."""
    return f"{total_mins // 60:02d}:{total_mins % 60:02d}"


def _init_court_session():
    """GET Grid.aspx to establish a session cookie and extract the page key."""
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(
        BASE_URL + "/Booking/Grid.aspx",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with opener.open(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="replace")
    m = re.search(r"hl90njda2b89k='([^']+)'", html)
    key = m.group(1) if m else ""
    return opener, key


def _free_slots_after(ocupaciones, grid_close_str):
    """
    Yield (start_mins, end_mins) tuples for free gaps that:
    - start at or after COURT_MIN_TIME
    - start before COURT_MAX_START_TIME
    - are at least COURT_MIN_DURATION_MINS long
    """
    min_start  = _mins(COURT_MIN_TIME)
    max_start  = _mins(COURT_MAX_START_TIME)
    grid_close = _mins(grid_close_str)

    booked = []
    for o in ocupaciones:
        s_raw = o.get("StrHoraInicio", "")
        e_raw = o.get("StrHoraFin", "")
        if not s_raw or not e_raw:
            continue
        try:
            s, e = _mins(s_raw), _mins(e_raw)
        except (ValueError, AttributeError):
            continue
        if e > min_start and s < grid_close:
            booked.append((s, e))

    booked.sort()

    cursor = min_start
    for bstart, bend in booked:
        if bstart > cursor:
            gap_start = cursor
            gap_end   = bstart
            if gap_start < max_start and (gap_end - gap_start) >= COURT_MIN_DURATION_MINS:
                yield (gap_start, gap_end)
        cursor = max(cursor, bend)

    if cursor < max_start and (grid_close - cursor) >= COURT_MIN_DURATION_MINS:
        yield (cursor, grid_close)


def check_court_bookings(notified):
    """Check court hire availability; return set of newly notified keys."""
    if not NOTIFY_COURTS:
        return set()

    log("  Checking court hire availability...")
    new_keys = set()

    try:
        opener, key = _init_court_session()
    except Exception as e:
        log(f"  Court session init failed: {e}")
        return new_keys

    today = datetime.now().date()
    padel_id = COURT_GRID_ID

    court_targets = [
        r["target"] for r in IMESSAGE_TARGETS if "courts" in r.get("types", [])
    ]

    for d_offset in range(1, (WEEKS_AHEAD + 1) * 7 + 1):
        dt = today + timedelta(days=d_offset)
        date_iso  = dt.strftime("%Y-%m-%d")
        date_api  = f"{dt.day}/{dt.month}/{dt.year}"  # D/M/YYYY (no zero-pad), matches JS
        date_nice = dt.strftime("%a %d %b")

        try:
            result = post_json(
                "/booking/srvc.aspx/ObtenerCuadro",
                {"idCuadro": str(padel_id), "fecha": date_api, "key": key},
                opener=opener,
            )
        except Exception as e:
            log(f"  Court grid fetch failed ({date_api}): {e}")
            continue

        d = result.get("d") or {}
        columnas = d.get("Columnas") or []
        grid_close = d.get("StrHoraFin") or "23:00"

        for col in columnas:
            court_name = col.get("TextoPrincipal") or col.get("TextoSecundario") or "Court"
            ocupaciones = col.get("Ocupaciones") or []

            for free_start, free_end in _free_slots_after(ocupaciones, grid_close):
                start_str = _fmt_mins(free_start)
                end_str   = _fmt_mins(free_end)
                duration  = free_end - free_start
                slot_key  = f"court_{padel_id}_{date_iso}_{court_name}_{start_str.replace(':', '')}"

                if slot_key in notified:
                    continue

                subtitle = f"{court_name} — {date_nice}, {start_str}–{end_str} ({duration} min)"
                log(f"  NOTIFY (court): {subtitle}")
                send_mac_notification("Court Available!", subtitle, "Free court slot")
                send_imessage(f"Court free: {subtitle}", court_targets)
                send_ntfy_notification("Court Available!", subtitle, "")
                new_keys.add(slot_key)

    return new_keys


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

NOTIFIED_EXPIRY_DAYS = 28  # re-notify about a slot after this many days


def load_notified():
    """Return (active_ids, full_dict). Entries older than NOTIFIED_EXPIRY_DAYS are dropped."""
    if not os.path.exists(STATE_FILE):
        return set(), {}
    with open(STATE_FILE) as f:
        data = json.load(f)
    # Migrate old list format — stamp everything as notified now so nothing re-fires immediately
    if isinstance(data, list):
        data = {bid: datetime.now().isoformat() for bid in data}
    cutoff = datetime.now() - timedelta(days=NOTIFIED_EXPIRY_DAYS)
    fresh = {bid: ts for bid, ts in data.items()
             if datetime.fromisoformat(ts) > cutoff}
    return set(fresh), fresh


def save_notified(existing_dict, new_bids):
    now = datetime.now().isoformat()
    merged = {**existing_dict, **{bid: now for bid in new_bids}}
    with open(STATE_FILE, "w") as f:
        json.dump(merged, f, indent=2, sort_keys=True)


def send_mac_notification(title, subtitle, message, url=""):
    cmd = [
        "/opt/homebrew/bin/terminal-notifier",
        "-title", title,
        "-subtitle", subtitle,
        "-message", message,
        "-sound", "default",
    ]
    if url:
        cmd += ["-open", url]
    subprocess.run(cmd, capture_output=True)


def send_imessage(text, targets):
    """Send iMessage to the given list of recipient identifiers."""
    for target in targets:
        try:
            escaped = text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
            script = f"""
tell application "Messages"
    try
        set s to 1st service whose service type = iMessage
        set b to buddy "{target}" of s
    on error
        set s to 1st service whose service type = SMS
        set b to buddy "{target}" of s
    end try
    send "{escaped}" to b
end tell
"""
            result = subprocess.run(["osascript", "-e", script], capture_output=True, timeout=15)
            if result.returncode != 0:
                log(f"  iMessage failed ({target}): {result.stderr.decode().strip()}")
        except Exception as e:
            log(f"  iMessage error ({target}): {e}")


def send_ntfy_notification(title, message, url):
    if not NTFY_TOPIC:
        return
    try:
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=message.encode("utf-8"),
            headers={"Title": title, "Click": url, "Content-Type": "text/plain"},
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        log(f"  ntfy notification failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log("Checking availability...")
    weeks = get_available_weeks()
    log("  Weeks: " + ", ".join(w["StrFechaInicioSemana"] for w in weeks))

    all_available = []
    for week in weeks:
        activities = get_activities_for_week(week["NumeroSemana"], week["Anyo"])
        all_available.extend(find_available_slots(activities))

    log(f"  {len(all_available)} available target slot(s) (before detail checks)")

    notified, notified_dict = load_notified()
    new_bids = set()
    notify_count = 0

    for slot in all_available:
        alert_type = get_activity_alert_type(slot.get("Actividad", ""))

        if alert_type == "lessons" and not NOTIFY_LESSONS:
            continue
        if alert_type == "train_and_play" and not NOTIFY_TRAIN_AND_PLAY:
            continue

        bid = get_slot_id(slot)
        if bid in notified:
            continue

        name = slot.get("Actividad", "").strip()
        link = slot.get("Link", "")
        html = fetch_detail_html(link)

        eligible_targets = [
            r["target"] for r in IMESSAGE_TARGETS
            if alert_type in r.get("types", [])
            and target_allows_instructor(html, r)
            and (alert_type != "train_and_play" or target_level_suitable(html, r))
        ]

        if not eligible_targets:
            log(f"  Skip (no eligible recipients — instructor/level filters): {name} — {slot.get('DiaDeLaSemana')} {slot.get('StrHoraInicio')}")
            continue

        globally_excluded = is_excluded_instructor(html)

        t_start = slot.get("StrHoraInicio", "")
        t_end = slot.get("StrHoraFin", "")
        vacancies = slot.get("PlazasTotales", 0) - slot.get("PlazasReservadas", 0)
        date = get_date_from_link(link)
        instructor = get_instructor_from_html(html)

        subtitle = f"{name} — {date}, {t_start}–{t_end}"
        message = f"Coach: {instructor} · {vacancies} spot(s) free" if instructor else f"{vacancies} spot(s) free"

        imsg = f"{subtitle}"
        if instructor:
            imsg += f" · Coach: {instructor}"
        imsg += f" · Book: {link}"

        log(f"  NOTIFY: {subtitle} ({vacancies} free)")
        if not globally_excluded:
            send_mac_notification("Padel Slot Available!", subtitle, message, url=link)
            send_ntfy_notification(
                "Padel Slot Available!",
                f"{subtitle}. {vacancies} spot(s) free.",
                link,
            )
        send_imessage(imsg, eligible_targets)

        new_bids.add(bid)
        notify_count += 1

    # Court hire check
    new_court_keys = check_court_bookings(notified)

    save_notified(notified_dict, new_bids | new_court_keys)
    log(f"  Done — notified for {notify_count} new activity slot(s), "
        f"{len(new_court_keys)} new court slot(s).")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log(f"ERROR:\n{traceback.format_exc()}")
        sys.exit(1)
