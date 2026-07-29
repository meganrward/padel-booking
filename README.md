# Padel Booking Checker

Checks [Stratford Padel Club](https://stratfordpadelclub.matchpoint.com.es) every 10 minutes for available slots and sends iMessage/Mac notifications.

## New machine setup

### 1. Clone the repo

```bash
git clone https://github.com/meganrward/padel-booking.git ~/personal/padel-booking
```

### 2. Install terminal-notifier

```bash
brew install terminal-notifier
```

### 3. Load the LaunchAgent

This runs the script every 10 minutes in the background, even when the terminal is closed.

```bash
cp ~/personal/padel-booking/com.meganward.padel-checker.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.meganward.padel-checker.plist
```

### 4. Grant permissions

macOS will prompt for permissions the first time — approve:
- **Automation** — the script uses AppleScript to send iMessages via the Messages app
- **Notifications** — for Mac banner notifications via terminal-notifier

If the prompts don't appear automatically, trigger them by running the script once manually:

```bash
python3 ~/personal/padel-booking/check_padel.py
```

### Useful commands

```bash
# Check logs
tail -f ~/personal/padel-booking/padel_checker.log

# Stop the checker
launchctl unload ~/Library/LaunchAgents/com.meganward.padel-checker.plist

# Start it again
launchctl load ~/Library/LaunchAgents/com.meganward.padel-checker.plist

# Run manually (one-off check)
python3 ~/personal/padel-booking/check_padel.py
```

### Notes

- `notified_slots.json` tracks which slots you've already been alerted about so you don't get duplicate notifications. Keep this file — if it's missing the script will re-notify for all currently open slots.
- The script uses the system `python3` (no virtualenv needed, stdlib only).
- Alert recipients and types are configured in `people.json`, loaded by `check_padel.py` at startup. Edit the file directly, or use the admin UI below.

## Admin UI (manage recipients)

A local React + FastAPI admin app for adding people and toggling their alert types (Courts / Lessons / Train & Play) and instructor filters, without hand-editing `people.json`. It only needs to be running while you're actively editing — `check_padel.py`'s scheduled runs read `people.json` directly and don't need the UI or backend running.

```bash
# Backend (http://localhost:8000)
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload

# Frontend (http://localhost:5173), in another terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in a browser. Changes save immediately to `people.json`.

The instructor dropdown is seeded from `instructors.json`, generated once via `python3 scripts/fetch_instructors.py` by crawling the current schedule (there's no bulk "list instructors" API — names only appear on individual booking detail pages). Rerun that script manually if the coaching roster changes.
