#!/usr/bin/env python3
"""One-off backfill: copy people.json settings into Supabase preferences rows.

Run this AFTER creating each friend's account in the Supabase Auth dashboard
(which auto-creates an empty preferences row via the on_auth_user_created
trigger). Matches by `target` and updates the corresponding row.

Usage: python scripts/migrate_people_to_supabase.py [--dry-run]
"""

import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PEOPLE_FILE = os.path.join(REPO_ROOT, "people.json")

PREFERENCE_FIELDS = [
    "name",
    "target",
    "types",
    "level",
    "excluded_instructors",
    "included_instructors",
    "apply_instructor_filter_to_train_and_play",
    "matches_start_time",
    "matches_end_time",
    "notification_method",
    "ntfy_topic",
]


def load_people() -> list[dict]:
    with open(PEOPLE_FILE) as f:
        return json.load(f)


def main() -> None:
    dry_run = "--dry-run" in sys.argv

    load_dotenv(os.path.join(REPO_ROOT, ".env"))
    url = os.environ["SUPABASE_URL"]
    secret_key = os.environ["SUPABASE_SECRET_KEY"]
    client = create_client(url, secret_key)

    people = load_people()
    existing_rows = client.table("preferences").select("id, target").execute().data
    row_by_target = {row["target"]: row["id"] for row in existing_rows}

    for person in people:
        target = person["target"]
        row_id = row_by_target.get(target)
        if row_id is None:
            print(f"SKIP {person['name']!r} ({target}): no preferences row yet — "
                  "create their account in the Supabase dashboard first")
            continue

        patch = {field: person[field] for field in PREFERENCE_FIELDS if field in person}
        if dry_run:
            print(f"WOULD UPDATE {person['name']!r} ({target}): {patch}")
            continue

        client.table("preferences").update(patch).eq("id", row_id).execute()
        print(f"UPDATED {person['name']!r} ({target})")


if __name__ == "__main__":
    main()
