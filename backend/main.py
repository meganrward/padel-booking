#!/usr/bin/env python3
"""Search-service backend: on-demand free court search + instructor list.

Preference CRUD now lives in Supabase (see frontend/src/lib/preferences.ts) —
this service only wraps the parts of check_padel.py that need a live scrape.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INSTRUCTORS_FILE = os.path.join(REPO_ROOT, "instructors.json")

sys.path.insert(0, REPO_ROOT)
from check_padel import find_free_courts_in_range  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("padel_search")

CourtSearchDuration = Literal[60, 90, 120, 150, 180]

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://meganrward.github.io",
]

app = FastAPI(title="Padel Court Search Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/instructors", response_model=list[str])
def list_instructors():
    if not os.path.exists(INSTRUCTORS_FILE):
        return []
    with open(INSTRUCTORS_FILE) as f:
        return json.load(f)


class CourtSearchRequest(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    duration_mins: CourtSearchDuration = 90


class CourtSlot(BaseModel):
    date: str
    date_label: str
    court: str
    start: str
    end: str
    duration_mins: int


@app.post("/api/courts/search", response_model=list[CourtSlot])
def search_courts(req: CourtSearchRequest):
    try:
        start_date = datetime.strptime(req.start_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(req.end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be in YYYY-MM-DD format")

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    started = time.monotonic()
    logger.info(
        "Court search started: %s to %s, %s-%s, min %smin",
        req.start_date, req.end_date, req.start_time, req.end_time, req.duration_mins,
    )

    try:
        results = find_free_courts_in_range(
            start_date, end_date, req.start_time, req.end_time, req.duration_mins
        )
    except ValueError as e:
        logger.warning("Court search rejected: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        elapsed = time.monotonic() - started
        logger.exception("Court search failed after %.2fs", elapsed)
        raise HTTPException(status_code=502, detail=f"Court search failed: {e}")

    elapsed = time.monotonic() - started
    logger.info("Court search finished in %.2fs: %d slot(s) found", elapsed, len(results))
    return results
