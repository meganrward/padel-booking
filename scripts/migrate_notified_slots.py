#!/usr/bin/env python3
"""One-off: copy the local notified_slots.json into the Supabase notified_slots table so
nothing re-fires after the switch. Each old slot key is recorded against the owner and every
current preferences row, keeping its original timestamp so the 28-day expiry still applies.

    python3 scripts/migrate_notified_slots.py [path/to/notified_slots.json]
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from check_padel import OWNER_ID, SCRIPT_DIR, get_client, load_targets

BATCH_SIZE = 500


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SCRIPT_DIR, "notified_slots.json")
    with open(path) as f:
        old = json.load(f)

    recipient_ids = [OWNER_ID] + [r["id"] for r in load_targets()]
    rows = [
        {"slot_key": slot_key, "recipient_id": rid, "notified_at": notified_at}
        for slot_key, notified_at in old.items()
        for rid in recipient_ids
    ]

    table = get_client().table("notified_slots")
    for i in range(0, len(rows), BATCH_SIZE):
        table.upsert(
            rows[i:i + BATCH_SIZE], on_conflict="slot_key,recipient_id", ignore_duplicates=True
        ).execute()

    print(f"Migrated {len(old)} slot key(s) for {len(recipient_ids)} recipient(s) ({len(rows)} rows)")


if __name__ == "__main__":
    main()
