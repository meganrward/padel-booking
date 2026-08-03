#!/usr/bin/env python3
"""Local admin API for managing padel notification recipients (people.json)."""

import json
import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PEOPLE_FILE = os.path.join(REPO_ROOT, "people.json")
INSTRUCTORS_FILE = os.path.join(REPO_ROOT, "instructors.json")

AlertType = Literal["lessons", "train_and_play", "courts", "last_minute_courts"]

app = FastAPI(title="Padel Booking Admin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Person(BaseModel):
    name: str
    target: str
    types: list[AlertType]
    level: float | None = None
    excluded_instructors: list[str] | None = None
    included_instructors: list[str] | None = None
    apply_instructor_filter_to_train_and_play: bool = False

    @field_validator("name", "target")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class PersonUpdate(BaseModel):
    name: str
    types: list[AlertType]
    level: float | None = None
    excluded_instructors: list[str] | None = None
    included_instructors: list[str] | None = None
    apply_instructor_filter_to_train_and_play: bool = False


def load_people() -> list[dict]:
    with open(PEOPLE_FILE) as f:
        return json.load(f)


def save_people(people: list[dict]) -> None:
    with open(PEOPLE_FILE, "w") as f:
        json.dump(people, f, indent=2)
        f.write("\n")


@app.get("/api/people", response_model=list[Person])
def list_people():
    return load_people()


@app.post("/api/people", response_model=Person, status_code=201)
def create_person(person: Person):
    people = load_people()
    if any(p["target"] == person.target for p in people):
        raise HTTPException(status_code=409, detail="A person with this target already exists")
    people.append(person.model_dump(exclude_none=True))
    save_people(people)
    return person


@app.put("/api/people/{target}", response_model=Person)
def update_person(target: str, update: PersonUpdate):
    people = load_people()
    for i, p in enumerate(people):
        if p["target"] == target:
            updated = {"target": target, **update.model_dump(exclude_none=True)}
            people[i] = updated
            save_people(people)
            return updated
    raise HTTPException(status_code=404, detail="Person not found")


@app.delete("/api/people/{target}", status_code=204)
def delete_person(target: str):
    people = load_people()
    remaining = [p for p in people if p["target"] != target]
    if len(remaining) == len(people):
        raise HTTPException(status_code=404, detail="Person not found")
    save_people(remaining)


@app.get("/api/instructors", response_model=list[str])
def list_instructors():
    if not os.path.exists(INSTRUCTORS_FILE):
        return []
    with open(INSTRUCTORS_FILE) as f:
        return json.load(f)
