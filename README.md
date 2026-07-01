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
- Alert recipients and types are configured at the top of `check_padel.py` in `IMESSAGE_TARGETS`.
