#!/usr/bin/env python3
"""Padel slot availability checker for Stratford Padel Club."""

import http.cookiejar
import json
import os
import re
import subprocess
import sys
import time
import traceback
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

# --- CONFIGURATION (edit these) ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# iMessage recipients — each entry specifies which alert types they receive.
# alert types: "lessons", "train_and_play", "courts" (evening courts), "last_minute_courts",
#              "matches" (open matches on Matchpoint's public match browser)
#   "matches" also honors:
#     "matches_start_time" / "matches_end_time" — "HH:MM" window to only notify within (both
#                                       required together; unset means no time filter)
#   Optional per-target instructor overrides:
#     "excluded_instructors": [...]  — skip this target for these instructors (defaults to EXCLUDED_INSTRUCTORS)
#     "included_instructors": [...]  — if set, ONLY notify this target for these instructors,
#                                       ignoring excluded_instructors entirely
#     "apply_instructor_filter_to_train_and_play": true  — by default, instructor filters only
#                                       apply to lessons (private classes); set this to also
#                                       apply them to train_and_play
# Managed via people.json (edit directly, or use the admin UI in backend/ + frontend/).
def load_targets():
    path = os.path.join(SCRIPT_DIR, "people.json")
    with open(path) as f:
        return json.load(f)

IMESSAGE_TARGETS = load_targets()

NTFY_TOPIC = ""       # e.g. "megan-padel-abc123" — leave empty to skip phone notifications

# Toggle alert types on/off independently
NOTIFY_LESSONS            = True  # private class + SPC tournaments — paused
NOTIFY_TRAIN_AND_PLAY     = True
NOTIFY_COURTS             = True
NOTIFY_LAST_MINUTE_COURTS = True
NOTIFY_MATCHES            = True

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

# "Last minute courts" alert config — off-peak weekday gaps starting soon
LAST_MINUTE_OFFPEAK_START   = "08:00"  # off-peak window start (HH:MM)
LAST_MINUTE_OFFPEAK_END     = "16:00"  # off-peak window end (HH:MM)
LAST_MINUTE_MIN_DURATION_MINS = 60     # only alert for gaps of at least this duration
LAST_MINUTE_HOURS_AHEAD     = 24       # only alert for slots starting within this many hours from now

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
    req = urllib.request.Request(link_url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
            else:
                log(f"  Detail page fetch failed for {link_url[:80]}: {e}")
    return ""


def instructor_matches(html, names):
    h = html.lower()
    return any(name in h for name in names)


def is_excluded_instructor(html):
    return instructor_matches(html, EXCLUDED_INSTRUCTORS)


def target_allows_instructor(html, target, alert_type):
    """Per-target instructor filter: included_instructors (if set) overrides excluded_instructors.

    Only applies to train_and_play if the target has opted in via
    apply_instructor_filter_to_train_and_play — otherwise train_and_play is unfiltered.
    """
    if alert_type == "train_and_play" and not target.get("apply_instructor_filter_to_train_and_play"):
        return True
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


def _free_slots_after(ocupaciones, grid_close_str, min_start_str=None, max_start_str=None, min_duration=None):
    """
    Yield (start_mins, end_mins) tuples for free gaps that:
    - start at or after min_start_str (default COURT_MIN_TIME)
    - start before max_start_str (default COURT_MAX_START_TIME)
    - are at least min_duration long (default COURT_MIN_DURATION_MINS)
    """
    min_start  = _mins(min_start_str or COURT_MIN_TIME)
    max_start  = _mins(max_start_str or COURT_MAX_START_TIME)
    min_duration = COURT_MIN_DURATION_MINS if min_duration is None else min_duration
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
            if gap_start < max_start and (gap_end - gap_start) >= min_duration:
                yield (gap_start, gap_end)
        cursor = max(cursor, bend)

    if cursor < max_start and (grid_close - cursor) >= min_duration:
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

    court_recipients = [r for r in IMESSAGE_TARGETS if "courts" in r.get("types", [])]

    for d_offset in range(1, (WEEKS_AHEAD + 1) * 7 + 1):
        if d_offset > 1:
            time.sleep(0.3)

        dt = today + timedelta(days=d_offset)
        date_iso  = dt.strftime("%Y-%m-%d")
        date_api  = f"{dt.day}/{dt.month}/{dt.year}"  # D/M/YYYY (no zero-pad), matches JS
        date_nice = dt.strftime("%a %d %b")

        result = None
        for attempt in range(3):
            try:
                result = post_json(
                    "/booking/srvc.aspx/ObtenerCuadro",
                    {"idCuadro": str(padel_id), "fecha": date_api, "key": key},
                    opener=opener,
                )
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2 * (attempt + 1))
                else:
                    log(f"  Court grid fetch failed ({date_api}): {e}")
        if result is None:
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
                notify_recipients(court_recipients, f"Evening court free: {subtitle}", "Court Available!", subtitle)
                send_ntfy_notification(NTFY_TOPIC, "Court Available!", subtitle, "")
                new_keys.add(slot_key)

    return new_keys


MAX_COURT_SEARCH_DAYS = 45  # stay inside the site's ~41.3 day booking advance window


def find_free_courts_in_range(start_date, end_date, min_start_str, max_start_str, min_duration):
    """One-time, on-demand scrape for free court slots over an arbitrary date range.

    Unlike check_court_bookings(), this has no notification/logging/state side effects —
    it just returns the free slots found. start_date/end_date are date objects (inclusive).
    """
    num_days = (end_date - start_date).days + 1
    if num_days <= 0:
        raise ValueError("end_date must be on or after start_date")
    if num_days > MAX_COURT_SEARCH_DAYS:
        raise ValueError(f"date range too large (max {MAX_COURT_SEARCH_DAYS} days)")

    opener, key = _init_court_session()
    padel_id = COURT_GRID_ID

    results = []

    for d_offset in range(num_days):
        if d_offset > 0:
            time.sleep(0.3)

        dt = start_date + timedelta(days=d_offset)
        date_iso  = dt.strftime("%Y-%m-%d")
        date_api  = f"{dt.day}/{dt.month}/{dt.year}"  # D/M/YYYY (no zero-pad), matches JS
        date_label = dt.strftime("%a %d %b")

        result = None
        for attempt in range(3):
            try:
                result = post_json(
                    "/booking/srvc.aspx/ObtenerCuadro",
                    {"idCuadro": str(padel_id), "fecha": date_api, "key": key},
                    opener=opener,
                )
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2 * (attempt + 1))
                else:
                    log(f"  Court grid fetch failed ({date_api}): {e}")
        if result is None:
            continue

        d = result.get("d") or {}
        columnas = d.get("Columnas") or []
        grid_close = d.get("StrHoraFin") or "23:00"

        for col in columnas:
            court_name = col.get("TextoPrincipal") or col.get("TextoSecundario") or "Court"
            ocupaciones = col.get("Ocupaciones") or []

            for free_start, free_end in _free_slots_after(
                ocupaciones, grid_close, min_start_str, max_start_str, min_duration
            ):
                results.append({
                    "date": date_iso,
                    "date_label": date_label,
                    "court": court_name,
                    "start": _fmt_mins(free_start),
                    "end": _fmt_mins(free_end),
                    "duration_mins": free_end - free_start,
                })

    return results


def check_last_minute_courts(notified):
    """
    Same/next-day off-peak weekday court gaps (LAST_MINUTE_OFFPEAK_START-END) of at
    least LAST_MINUTE_MIN_DURATION_MINS, starting within LAST_MINUTE_HOURS_AHEAD hours.
    """
    if not NOTIFY_LAST_MINUTE_COURTS:
        return set()

    last_minute_recipients = [r for r in IMESSAGE_TARGETS if "last_minute_courts" in r.get("types", [])]
    if not last_minute_recipients:
        return set()

    log("  Checking last-minute court availability...")
    new_keys = set()

    try:
        opener, key = _init_court_session()
    except Exception as e:
        log(f"  Last-minute court session init failed: {e}")
        return new_keys

    now = datetime.now()
    cutoff = now + timedelta(hours=LAST_MINUTE_HOURS_AHEAD)
    padel_id = COURT_GRID_ID

    # Only today + tomorrow can fall within a 24h lookahead window.
    for d_offset in range(0, 2):
        dt = now.date() + timedelta(days=d_offset)
        if dt.weekday() >= 5:  # weekends excluded (off-peak weekday only)
            continue

        date_api  = f"{dt.day}/{dt.month}/{dt.year}"  # D/M/YYYY (no zero-pad), matches JS
        date_nice = dt.strftime("%a %d %b")

        try:
            result = post_json(
                "/booking/srvc.aspx/ObtenerCuadro",
                {"idCuadro": str(padel_id), "fecha": date_api, "key": key},
                opener=opener,
            )
        except Exception as e:
            log(f"  Last-minute court grid fetch failed ({date_api}): {e}")
            continue

        d = result.get("d") or {}
        columnas = d.get("Columnas") or []
        grid_close = d.get("StrHoraFin") or LAST_MINUTE_OFFPEAK_END

        for col in columnas:
            court_name = col.get("TextoPrincipal") or col.get("TextoSecundario") or "Court"
            ocupaciones = col.get("Ocupaciones") or []

            for free_start, free_end in _free_slots_after(
                ocupaciones, grid_close,
                min_start_str=LAST_MINUTE_OFFPEAK_START,
                max_start_str=LAST_MINUTE_OFFPEAK_END,
                min_duration=LAST_MINUTE_MIN_DURATION_MINS,
            ):
                start_dt = datetime.combine(dt, datetime.min.time()) + timedelta(minutes=free_start)
                if start_dt <= now or start_dt > cutoff:
                    continue

                start_str = _fmt_mins(free_start)
                end_str   = _fmt_mins(free_end)
                duration  = free_end - free_start
                slot_key  = f"lastmin_{padel_id}_{dt.isoformat()}_{court_name}_{start_str.replace(':', '')}"

                if slot_key in notified:
                    continue

                subtitle = f"{court_name} — {date_nice}, {start_str}–{end_str} ({duration} min)"
                log(f"  NOTIFY (last-minute court): {subtitle}")
                send_mac_notification("Last-Minute Court!", subtitle, "Off-peak court free <24h away")
                notify_recipients(last_minute_recipients, f"Buddy court free: {subtitle}", "Last-Minute Court!", subtitle)
                send_ntfy_notification(NTFY_TOPIC, "Last-Minute Court!", subtitle, "")
                new_keys.add(slot_key)

    return new_keys


# ---------------------------------------------------------------------------
# Open matches (Matches/Search.aspx — player-organized games short a partner)
# ---------------------------------------------------------------------------

def _time_in_window(time_str, start_str, end_str):
    """True if time_str falls within [start_str, end_str]; unset bounds mean no filter.

    end_str <= start_str (e.g. "00:00") is treated as wrapping past midnight.
    """
    if not start_str or not end_str:
        return True
    start, end, t = _mins(start_str), _mins(end_str), _mins(time_str)
    if end <= start:
        return t >= start or t <= end
    return start <= t <= end


def parse_matches(html):
    """Parse the public 'Browser of Open Matches' page into a list of match dicts."""
    date_positions = [
        (m.start(), m.group(1).strip())
        for m in re.finditer(r'LabelFechaSeparador_\d+"[^>]*>([^<]*)<', html)
    ]
    match_positions = [
        (m.start(), m.group(1))
        for m in re.finditer(r"window\.location='/Matches/Match\.aspx\?id=([a-f0-9]+)'", html)
    ]

    def date_for(pos):
        result = ""
        for p, d in date_positions:
            if p <= pos:
                result = d
            else:
                break
        return result

    matches = []
    for i, (pos, match_id) in enumerate(match_positions):
        end = match_positions[i + 1][0] if i + 1 < len(match_positions) else len(html)
        block = html[pos:end]
        preceding = html[max(0, pos - 1500):pos]

        level_from_m = re.search(r'HiddenFieldNivelDesde"[^>]*value="([\d.]+)"', preceding)
        level_to_m = re.search(r'HiddenFieldNivelHasta"[^>]*value="([\d.]+)"', preceding)
        time_m = re.search(r'LabelHoraInicio_\d+"[^>]*>([\d:]+)<', block)
        if not (level_from_m and level_to_m and time_m):
            continue

        sex_m = re.search(r'LabelSexoValor_\d+"[^>]*>\s*-?\s*([^<]+?)\s*<', block)
        court_m = re.search(r'LabelRecurso_\d+"[^>]*>([^<]+)<', block)

        matches.append({
            "id": match_id,
            "date": date_for(pos),
            "time": time_m.group(1),
            "level_from": float(level_from_m.group(1)),
            "level_to": float(level_to_m.group(1)),
            "sex": sex_m.group(1).strip() if sex_m else "",
            "court": court_m.group(1).strip() if court_m else "",
            "free_spots": block.count("icono-partida-libre"),
        })

    return matches


def _matches_search_url(match_recipients):
    """Build the Search.aspx URL, narrowing by date and time to fit under the
    site's ~200-result cap so it reaches WEEKS_AHEAD out instead of stopping
    after only a week or two of near-term matches.

    The hora window is widened to cover every recipient's matches_start_time /
    matches_end_time (any recipient missing a bound means no narrowing, since
    the actual per-recipient filtering happens client-side in check_matches).
    """
    today = datetime.now().date()
    params = {
        "sexo": "todos",
        "amigos": "false",
        "jugado": "false",
        "idDeporte": "undefined",
        "nivel": "false",
        "fechaDesde": today.strftime("%d/%m/%Y"),
        "fechaHasta": (today + timedelta(weeks=WEEKS_AHEAD)).strftime("%d/%m/%Y"),
        "idcentro": "undefined",
    }

    starts = [r.get("matches_start_time") for r in match_recipients]
    ends   = [r.get("matches_end_time") for r in match_recipients]
    if all(starts) and all(ends):
        widest_start = min(_mins(s) for s in starts)
        widest_end   = max(23 * 60 + 59 if _mins(e) <= widest_start else _mins(e) for e in ends)
        params["horaDesde"] = _fmt_mins(widest_start)
        params["horaHasta"] = _fmt_mins(widest_end)

    return BASE_URL + "/Matches/Search.aspx?" + urllib.parse.urlencode(params)


def check_matches(notified):
    """Check Matchpoint's public open-match browser for matches with free slots."""
    if not NOTIFY_MATCHES:
        return set()

    match_recipients = [r for r in IMESSAGE_TARGETS if "matches" in r.get("types", [])]
    if not match_recipients:
        return set()

    log("  Checking open matches...")
    new_keys = set()

    html = fetch_detail_html(_matches_search_url(match_recipients))
    if not html:
        return new_keys

    for match in parse_matches(html):
        if match["free_spots"] <= 0:
            continue

        slot_key = f"match_{match['id']}"
        if slot_key in notified:
            continue

        eligible = [
            r for r in match_recipients
            if (r.get("level") is None or match["level_from"] <= r["level"] <= match["level_to"])
            and _time_in_window(match["time"], r.get("matches_start_time"), r.get("matches_end_time"))
        ]
        if not eligible:
            continue

        link = f"{BASE_URL}/Matches/Match.aspx?id={match['id']}"
        subtitle = (
            f"{match['court']} — {match['date']}, {match['time']} "
            f"({match['sex']}, {match['level_from']:.2f}-{match['level_to']:.2f})"
        )
        message = f"{match['free_spots']} spot(s) free"

        log(f"  NOTIFY (match): {subtitle} ({match['free_spots']} free)")
        send_mac_notification("Open Match Available!", subtitle, message, url=link)
        notify_recipients(
            eligible,
            f"Open match free: {subtitle} · Book: {link}",
            "Open Match Available!",
            f"{subtitle}. {message}",
            link,
        )
        send_ntfy_notification(NTFY_TOPIC, "Open Match Available!", f"{subtitle}. {message}", link)

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


def send_ntfy_notification(topic, title, message, url=""):
    if not topic:
        return
    try:
        req = urllib.request.Request(
            f"https://ntfy.sh/{topic}",
            data=message.encode("utf-8"),
            headers={"Title": title, "Click": url, "Content-Type": "text/plain"},
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        log(f"  ntfy notification failed ({topic}): {e}")


def notify_recipients(recipients, imessage_text, ntfy_title, ntfy_message, ntfy_url=""):
    """Dispatch to each recipient via their chosen notification_method (each friend
    picks this themselves in the preferences UI)."""
    imessage_targets = []
    for r in recipients:
        if r.get("notification_method") == "ntfy":
            send_ntfy_notification(r.get("ntfy_topic"), ntfy_title, ntfy_message, ntfy_url)
        else:
            imessage_targets.append(r["target"])
    if imessage_targets:
        send_imessage(imessage_text, imessage_targets)


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

        eligible_recipients = [
            r for r in IMESSAGE_TARGETS
            if alert_type in r.get("types", [])
            and target_allows_instructor(html, r, alert_type)
            and (alert_type != "train_and_play" or target_level_suitable(html, r))
        ]

        if not eligible_recipients:
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
                NTFY_TOPIC,
                "Padel Slot Available!",
                f"{subtitle}. {vacancies} spot(s) free.",
                link,
            )
        notify_recipients(eligible_recipients, imsg, "Padel Slot Available!", f"{subtitle}. {vacancies} spot(s) free.", link)

        new_bids.add(bid)
        notify_count += 1

    # Court hire check
    new_court_keys = check_court_bookings(notified)
    new_last_minute_keys = check_last_minute_courts(notified)
    new_match_keys = check_matches(notified)

    save_notified(notified_dict, new_bids | new_court_keys | new_last_minute_keys | new_match_keys)
    log(f"  Done — notified for {notify_count} new activity slot(s), "
        f"{len(new_court_keys)} new court slot(s), "
        f"{len(new_last_minute_keys)} new last-minute court slot(s), "
        f"{len(new_match_keys)} new open match(es).")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log(f"ERROR:\n{traceback.format_exc()}")
        sys.exit(1)
