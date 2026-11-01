# Backend changes — leave & substitution, school timings, class homework, notifications

This is the work list for the FastAPI backend (`shelfwatch_sfa_ir_backend`) so that the
new features in the **web app** (`shelfwatch-plus`) and the **mobile app** (`ShelfwatchPlus`)
work end to end. Both apps are already built against the contract below.

Both apps degrade gracefully until each endpoint ships: a `404/405` from a new endpoint
shows a "needs the latest server update" note (substitute finder, school timings) or
falls back to the old behaviour (`/timetable/week` → `/timetable/mine`, the bell just
shows no count). So the endpoints can be released one section at a time.

| # | Feature | Section |
|---|---------|---------|
| 1 | Push + in-app notifications (attendance, fees, notices, …) | [§1](#1-notifications-in-app--push) |
| 2 | Substitute teacher on leave (find / request / accept / deny / undo) | [§2](#2-substitute-teachers) |
| 3 | Leave request CRUD (edit, delete/cancel) | [§3](#3-leave-requests--edit-and-delete) |
| 4 | School timings (start time, prayer, period length, breaks) | [§4](#4-school-timings) |
| 5 | Dated week timetable (template + substitutions) | [§5](#5-week-timetable) |
| 6 | Homework for a whole class | [§6](#6-class-homework) |
| 7 | Check-in / check-out time format | [§7](#7-staff-attendance-times) |
| 8 | Date inputs | [§8](#8-dates) |
| — | Migrations, permissions summary, test checklist | [§9](#9-migrations), [§10](#10-permissions-summary), [§11](#11-test-checklist) |

Conventions used throughout (same as the existing API):

* Dates are `"YYYY-MM-DD"`; clock times are 24h `"HH:MM"` (school's local time); timestamps are ISO-8601 with offset.
* Weekday numbers match the existing timetable: **Monday = 0 … Saturday = 5** (Sunday = 6 is never a school day).
* Lists are paginated with `?limit=&offset=` and return the total in `X-Total-Count` (also expose it via CORS `expose_headers`).
* Errors use `{"detail": "…"}` with the usual codes: `400` bad input, `403` not allowed, `404` not found, `409` conflict, `422` validation.
* "Managers" = `admin`, `principal`, `sub_admin`, `coordinator` (as in `app/core/roles.py`). "Staff" = managers + `teacher`.

---

## 1. Notifications (in-app + push)

### 1.1 Tables

```sql
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- recipient (parent = the student account)
  type        VARCHAR(40) NOT NULL,      -- attendance | fee | notice | homework | leave | substitution_request | substitution_update
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  data        JSONB,                     -- {"route": "...", "params": {...}, "web_path": "/..."}  (see 1.4)
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user_unread ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE device_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(512) NOT NULL UNIQUE,   -- FCM registration token
  platform    VARCHAR(10) NOT NULL,           -- android | ios | web
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 Endpoints (any signed-in user, incl. students)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/notifications` | `limit`, `offset` | `[Notification]` newest first, `X-Total-Count` |
| GET | `/notifications/unread-count` | — | `{"count": 3}` |
| PUT | `/notifications/{id}/read` | — | `204` (only the owner; others → 404) |
| PUT | `/notifications/read-all` | — | `204` |
| POST | `/devices` | `{"token": "...", "platform": "android"}` | `204` — upsert by token, re-assign to the current user if it existed |
| DELETE | `/devices/{token}` | — | `204` — **no auth required** (the app calls it right after sign-out; knowing the token is enough) |

`Notification` = `{id, type, title, body, data, read_at, created_at}`.

Also: on `POST /auth/logout` and `/auth/logout-all`, delete that user's device tokens
(all of them for logout-all).

### 1.3 Sending (one helper used everywhere)

```python
# app/services/notify.py
def notify(db, user_ids: list[int], type: str, title: str, body: str | None = None,
           data: dict | None = None, push: bool = True) -> None:
    """Insert one notifications row per user, then (after commit) send FCM to their devices."""
```

* Write the rows inside the request's transaction; send pushes in a `BackgroundTasks`
  task **after commit** so a failed push never rolls back the action.
* FCM HTTP v1 (`firebase-admin` package, `messaging.send_each_for_multicast`). Service-account JSON
  via env `FIREBASE_CREDENTIALS` (path or JSON string). If unset, skip push silently (inbox still works).
* Message shape — the mobile app reads exactly these keys:

  ```json
  {
    "notification": {"title": "Anita Verma asks you to take Period 3", "body": "Tue 12 May · Class 5-B · 10:20–11:05"},
    "data": {"type": "substitution_request", "route": "Substitutions", "params": "{\"tab\":\"incoming\",\"id\":42}"}
  }
  ```

  FCM `data` values must be strings → `params` is JSON-encoded.
* Remove tokens FCM reports as `UNREGISTERED` / `INVALID_ARGUMENT`.
* Android channel: send `android.notification.channel_id = "default"`, `priority = high`.

### 1.4 `data` — where tapping goes

`route` is a mobile screen name (`src/routes.ts`), `web_path` is optional for the web app
(the web app maps `route` itself when it's missing).

| type | route (staff / student) | params | web_path |
|---|---|---|---|
| `attendance` | `Attendance` (student) | — | — |
| `fee` | `Fees` (student) · `FeesAdmin` (staff) | — | `/fees` |
| `notice` | `Notices` (student) · `StaffNotices` (staff) | — | `/notices` |
| `homework` | `Homework` (student) | — | — |
| `leave` | `Leaves` | — | `/leaves` |
| `substitution_request` | `Substitutions` | `{"tab":"incoming","id":<request id>}` | `/substitutions?id=<id>` |
| `substitution_update` | `Substitutions` | `{"tab":"outgoing","id":<id>}` (or `incoming` for the substitute) | `/substitutions?tab=outgoing&id=<id>` |

### 1.5 Triggers

| Event | Recipients | Title / body (example) |
|---|---|---|
| Attendance saved for a section (`PUT /attendance…`) | each student whose status is **present** (requested); also send for **absent** / **leave** with a different title (recommended — parents care most about absences) | "✅ Aarav is present today" / "⚠️ Aarav was marked absent today (12 May)" |
| Re-marking the same day | only students whose status **changed** | "Attendance updated: Aarav is now present" |
| Fee record created (single or generate-for-class) | the student | "New fee: Term 2 — ₹12,500 due 30 Jun" |
| Fee marked paid / claim approved / claim rejected | the student | "Payment received: Term 2 ₹12,500" / "Payment proof rejected: <note>" |
| Fee overdue (daily job, see below) | the student | "Fee overdue: Term 2 — ₹12,500 was due 30 Jun" |
| Notice posted | all students + all staff (or the notice's audience if you have one) | "📢 <notice title>" / first 120 chars |
| Class homework created / due date changed | students of the section | "📚 New homework: Maths — Ex 4.2 (due 14 May)" |
| Leave approved / rejected | the applicant | "Your leave (12–14 May) was approved" |
| New leave submitted | managers (optional, recommended) | "Nitesh Poonia applied for leave 12–14 May" |
| All substitution events | see §2.6 | |

Overdue / due-soon reminders: a daily job (APScheduler, cron calling an internal
`POST /internal/jobs/fee-reminders` with a secret header, or Render cron) at ~08:00 school time:
fees due in 3 days → "due soon", fees that became overdue yesterday → "overdue". Keep a
`fee_reminders_sent (fee_id, kind)` table so nothing is sent twice.

Use a `notification_batch` approach for attendance and notices (one `INSERT … SELECT`
for many users, one multicast per 500 tokens) — a class of 40 must not be 40 round trips.

---

## 2. Substitute teachers

A teacher applying for leave sees, per date and per period they teach, which colleagues
are free, and requests one or more of them. The request is accepted or declined by the
colleague; an accepted one can be undone ("withdrawn") until the period starts; the
requester can cancel. An accepted request puts that period in the substitute's timetable
for that date and marks it covered in the requester's.

### 2.1 Table

```sql
CREATE TABLE substitution_requests (
  id             SERIAL PRIMARY KEY,
  leave_id       INT REFERENCES leave_requests(id) ON DELETE SET NULL,  -- nullable: a request can be sent before the leave is saved
  requester_id   INT NOT NULL REFERENCES users(id),     -- teacher going on leave
  substitute_id  INT NOT NULL REFERENCES users(id),     -- teacher asked to cover
  date           DATE NOT NULL,
  period         SMALLINT NOT NULL,
  timetable_slot_id INT REFERENCES timetable_slots(id) ON DELETE SET NULL,  -- requester's weekly slot that day/period
  class_id       INT NOT NULL REFERENCES classes(id),   -- copied from the slot (slot may change later)
  section_id     INT NOT NULL REFERENCES sections(id),
  subject        VARCHAR(100),
  status         VARCHAR(12) NOT NULL DEFAULT 'pending',
                 -- pending | accepted | declined | cancelled | withdrawn | filled
  note           TEXT,                -- from the requester
  response_note  TEXT,                -- from the substitute (decline / withdraw reason)
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_sub_req_substitute ON substitution_requests (substitute_id, status, date);
CREATE INDEX ix_sub_req_requester  ON substitution_requests (requester_id, status, date);
-- at most one ACCEPTED cover per requester period, and a substitute can't take two periods at once:
CREATE UNIQUE INDEX ux_sub_req_one_cover  ON substitution_requests (requester_id, date, period) WHERE status = 'accepted';
CREATE UNIQUE INDEX ux_sub_req_sub_busy   ON substitution_requests (substitute_id, date, period) WHERE status = 'accepted';
-- no duplicate open request to the same person for the same period:
CREATE UNIQUE INDEX ux_sub_req_no_dup     ON substitution_requests (requester_id, substitute_id, date, period) WHERE status IN ('pending','accepted');
```

Statuses:

| status | meaning | set by |
|---|---|---|
| `pending` | waiting for the substitute | create |
| `accepted` | substitute takes the period | substitute (`/accept`) |
| `declined` | substitute said no | substitute (`/decline`) |
| `cancelled` | requester withdrew it, or the leave was deleted / rejected / shortened | requester or system |
| `withdrawn` | substitute accepted, then undid it ("accepted by mistake") | substitute (`/withdraw`) |
| `filled` | another teacher accepted the same period first | system |

### 2.2 Availability — who is free

`GET /substitutions/availability?from=2026-05-12&to=2026-05-14[&leave_id=5][&teacher_id=10]`

* Caller = the teacher going on leave. Managers may pass `teacher_id` to plan for someone else.
* Max range 31 days → `400`.
* For each date in range (skip Sundays; include holidays with `holiday` set and `periods: []`):
  * `periods` = the requester's weekly `timetable_slots` for that weekday, ordered by period.
  * `requests` = all `substitution_requests` of the requester for that date+period (any status, newest first), in the `SubstitutionRequest` shape (§2.4).
  * `available` = teachers (`user_type = 'teacher'`, active; optionally also coordinators who teach) where **all** hold:
    1. not the requester;
    2. no weekly `timetable_slots` row at that weekday + period;
    3. no **accepted** substitution at that date + period (they're already covering something);
    4. not on leave that date (`leave_requests` with status `pending` or `approved` covering the date);
    5. not checked as unavailable by any other rule you add later (e.g. max 2 substitutions/day — make it a setting).
  * Order `available` by: same subject as the slot first, then fewest substitutions that week, then name. (The app shows them in the order sent.)
* `start_time` / `end_time` from the school timings (§4) — `null` if timings aren't set.

```json
{
  "days": [
    {
      "date": "2026-05-12", "day": 1, "holiday": null,
      "periods": [
        {
          "period": 3, "start_time": "10:20", "end_time": "11:05",
          "slot": {"id": 31, "class_id": 5, "section_id": 12, "class_name": "Class 5", "section_name": "B", "subject": "Mathematics"},
          "requests": [],
          "available": [
            {"teacher_id": 11, "full_name": "Anita Verma", "photo_path": "uploads/…", "subject": "Mathematics"},
            {"teacher_id": 12, "full_name": "Rohit Kumar", "photo_path": null, "subject": "Science"}
          ]
        }
      ]
    }
  ]
}
```

Performance: load the requester's slots once, all teachers' slots for the weekdays in range
once, accepted substitutions + leaves for the date range once, then compute in Python.

### 2.3 Endpoints

| Method | Path | Who | Body | Notes |
|---|---|---|---|---|
| GET | `/substitutions/availability` | requester (teacher) / manager | query above | §2.2 |
| POST | `/substitutions` | requester | `{date, period, substitute_id, leave_id?, note?}` | Create one request → `201 SubstitutionRequest` |
| GET | `/substitutions/incoming` | any staff | `?status=&from=&to=&limit&offset` | Requests **to** me |
| GET | `/substitutions/outgoing` | any staff | same | Requests **I** sent |
| GET | `/substitutions` | managers | same + `&date=&teacher_id=` | Everything (cover planning) |
| GET | `/substitutions/{id}` | requester, substitute, managers | — | |
| PUT | `/substitutions/{id}/accept` | substitute | `{note?}` | §2.5 |
| PUT | `/substitutions/{id}/decline` | substitute | `{note?}` | pending → declined |
| PUT | `/substitutions/{id}/withdraw` | substitute | `{note?}` | accepted → withdrawn (undo) |
| PUT | `/substitutions/{id}/cancel` | requester or manager | `{note?}` | pending/accepted → cancelled |

`status` filter accepts one status; omit for all. Default order: `date ASC, period ASC` for
pending, `updated_at DESC` otherwise — or simply `date DESC, period ASC`.

### 2.4 `SubstitutionRequest` response shape

```json
{
  "id": 42, "leave_id": 5,
  "date": "2026-05-12", "day": 1, "period": 3,
  "start_time": "10:20", "end_time": "11:05",
  "class_id": 5, "section_id": 12, "class_name": "Class 5", "section_name": "B", "subject": "Mathematics",
  "requester_id": 10, "requester_name": "Nitesh Poonia", "requester_photo": "uploads/…",
  "substitute_id": 11, "substitute_name": "Anita Verma", "substitute_photo": null,
  "status": "pending", "note": "Family function", "response_note": null,
  "responded_at": null, "created_at": "2026-05-10T09:12:00+05:30",
  "can_withdraw": false
}
```

`can_withdraw` = `status == 'accepted'` and the period hasn't started yet
(`now < date + start_time`, or `date >= today` when timings aren't set).

### 2.5 Rules

**Create (`POST /substitutions`, also used by `POST/PUT /leaves` for each `substitutions[]` item)**
1. `date` not in the past; not Sunday; not a holiday → `400`.
2. The requester has a weekly slot at `weekday(date)` + `period` → else `400 "You have no class in period 3 on Tue 12 May"`. Copy class/section/subject/slot id from it.
3. Substitute is an active teacher ≠ requester and is **free** by the §2.2 rules → else `409 "Anita Verma is not free in period 3 that day"`.
4. No accepted request already covers that requester period → `409 "Period 3 is already covered by …"`.
5. No open (pending/accepted) request to the same substitute for the same period → `409` (unique index).
6. If `leave_id` given: it must be the requester's, not rejected/cancelled, and `date` inside it.
7. Several **pending** requests for the same period to different teachers are allowed ("broadcast").
8. Notify the substitute (§2.6).

**Accept** (`pending → accepted`), in one transaction with `SELECT … FOR UPDATE` on the row:
1. Re-check the substitute is still free (their weekly slot / another accepted cover / their own leave) → `409`.
2. Re-check nobody accepted this requester period meanwhile → `409 "Rohit Kumar already took this period"` and set this one to `filled`.
3. Set `accepted`, `responded_at`. Mark every other **pending** request for the same requester+date+period as `filled` and notify those teachers ("No longer needed — Rohit Kumar is covering").
4. Notify the requester.
5. The partial unique indexes are the final guard against races — catch `IntegrityError` → `409`.

**Withdraw** (substitute undoes an accept): only while `can_withdraw`; `accepted → withdrawn`; the period is uncovered again
(it disappears from the substitute's week and the requester's period shows uncovered).
Notify the requester ("Anita Verma can no longer take period 3 on Tue 12 May — please find someone else")
and managers if the date is today/tomorrow.

**Cancel** (requester): `pending|accepted → cancelled`; notify the substitute.

**Leave side effects** (see §3): deleting, rejecting or shortening a leave cancels its
pending/accepted requests that are no longer inside it, and notifies those substitutes.

**Standalone requests**: requests created before the leave exists (web "Request" button)
have `leave_id = NULL`. On `POST /leaves`, attach every one of the requester's
`leave_id IS NULL` pending/accepted requests whose date is inside the new leave.

### 2.6 Substitution notifications

| Event | To | type | Example |
|---|---|---|---|
| request created | substitute | `substitution_request` | "Nitesh Poonia asks you to take Period 3" · "Tue 12 May · 10:20–11:05 · Class 5-B Maths" |
| accepted | requester | `substitution_update` | "Anita Verma will take Period 3 on Tue 12 May" |
| declined | requester | `substitution_update` | "Anita Verma can't take Period 3 on Tue 12 May" + note |
| withdrawn | requester (+ managers if ≤ 1 day away) | `substitution_update` | "Anita Verma can no longer take Period 3 on Tue 12 May" |
| cancelled | substitute | `substitution_update` | "Request withdrawn: Period 3 on Tue 12 May" |
| filled | other pending substitutes | `substitution_update` | "No longer needed: Period 3 on Tue 12 May" |
| reminder (job, 07:00 on the day) | substitute | `substitution_update` | "Today: you cover Period 3 · Class 5-B" (optional) |

---

## 3. Leave requests — edit and delete

Existing: `GET /leaves` (managers), `GET /leaves/mine`, `POST /leaves`, `PUT /leaves/{id}/approve|reject`.

### 3.1 Changes to existing endpoints

* **List rows** (`/leaves`, `/leaves/mine`) add:
  * `user_id`, `created_at`
  * `coverage`: `{"periods": 6, "covered": 4, "pending": 1}` — periods the applicant teaches inside the leave
    (school days, not holidays), how many have an accepted substitute, how many have only pending
    requests. `null` for non-teaching staff. Compute in one query per page.
* **`POST /leaves`** body gains optional `substitutions: [{date, period, substitute_id}]`.
  Create the leave, then each request with the §2.5 rules **in the same transaction**. If one fails,
  return `409` with the reason and create nothing (the app shows the message and the user retries).
  Also link standalone requests (§2.5).
* **Reject** → cancel the leave's pending/accepted substitution requests and notify (§2.6).
* **Approve** → no change to requests (they stand); notify the applicant.

### 3.2 New endpoints

| Method | Path | Who | Rules |
|---|---|---|---|
| GET | `/leaves/{id}` | owner or managers | leave + `substitutions: [SubstitutionRequest]` |
| PUT | `/leaves/{id}` | owner, status `pending` only (else `409 "Only pending requests can be edited"`) | body `{from_date, to_date, reason, substitutions?: [...]}`. Validate `from ≤ to`. Requests whose date falls outside the new range → `cancelled` + notify. New `substitutions` are created as in POST. |
| DELETE | `/leaves/{id}` | owner: `pending`, or `approved` with `from_date > today` (cancelling a future approved leave). Managers: any not-yet-started leave. | Hard-delete pending ones; for approved ones set `status = 'cancelled'` (keep history). Cancel all its pending/accepted requests + notify substitutes. If it was approved, notify managers. `204`. |

Add `'cancelled'` to the leave status enum.

---

## 4. School timings

Coordinators (and admin/principal/sub-admin) set when the day starts, prayer length,
period length, number of periods and breaks. Every timetable shows clock times from it.
Example from the brief: start **06:30**, prayer **30 min** → period 1 starts **07:00**;
"break after 3" for 20 min shifts period 4 onwards by 20 minutes.

### 4.1 Table (single row per school)

```sql
CREATE TABLE school_timings (
  id               SERIAL PRIMARY KEY,
  start_time       TIME NOT NULL,                -- 06:30
  prayer_minutes   SMALLINT NOT NULL DEFAULT 0,  -- 0–120, happens before period 1
  period_minutes   SMALLINT NOT NULL,            -- 10–180
  periods_per_day  SMALLINT NOT NULL DEFAULT 8,  -- 1–12
  breaks           JSONB NOT NULL DEFAULT '[]',  -- [{"after_period":3,"minutes":20,"label":"Lunch break"}]
  updated_by       INT REFERENCES users(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

(Optional later: `effective_from DATE` + several rows to schedule "summer timings from 1 April" in advance —
GET would return the row effective today. The apps don't need changes for that.)

### 4.2 Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/settings/school-timings` | **any signed-in user incl. students** (student timetable shows times). Return `{}` (200) or `404` if never set — the apps treat both as "not set". |
| PUT | `/settings/school-timings` | managers |

Response / PUT body:

```jsonc
{
  "start_time": "06:30",
  "prayer_minutes": 30,
  "period_minutes": 45,
  "periods_per_day": 8,
  "breaks": [{"after_period": 3, "minutes": 20, "label": "Lunch break"}],
  "periods": [                                   // computed, read-only (ignored on PUT)
    {"period": 1, "start": "07:00", "end": "07:45"},
    {"period": 2, "start": "07:45", "end": "08:30"},
    {"period": 3, "start": "08:30", "end": "09:15"},
    {"period": 4, "start": "09:35", "end": "10:20"}
  ],
  "updated_at": "2026-10-19T10:00:00+05:30",
  "updated_by_name": "Coordinator Name"
}
```

Validation (same as the apps' `timingsError`): `start_time` valid `HH:MM`; `prayer_minutes` 0–120;
`period_minutes` 10–180; `periods_per_day` 1–12; each break `after_period` 1…`periods_per_day-1`,
`minutes` 1–180, at most one break per `after_period`; the whole day must end before midnight → `422`.

Computation (reference, matches `src/lib/schedule.js` / `src/schedule.ts`):

```python
def compute_periods(t):
    at = t.start_time.hour * 60 + t.start_time.minute + t.prayer_minutes
    breaks = {b["after_period"]: b["minutes"] for b in t.breaks}
    out = []
    for p in range(1, t.periods_per_day + 1):
        out.append({"period": p, "start": hm(at), "end": hm(at + t.period_minutes)})
        at += t.period_minutes + (breaks.get(p, 0) if p < t.periods_per_day else 0)
    return out
```

Also:
* `PUT /timetable` must reject `period > periods_per_day` (`422`) once timings exist.
* Reducing `periods_per_day` below an existing slot's period → `409` listing the affected teachers
  (or delete those slots only with `?force=true`).
* Use `periods` for `start_time`/`end_time` in substitution payloads (§2) and in pushes.
* Optionally `GET /timetable*` rows can include `start_time`/`end_time` too (the apps compute them anyway).

---

## 5. Week timetable

`GET /timetable/week?start=2026-05-11[&teacher_id=]` — teacher's own week (managers may pass `teacher_id`).
`start` is snapped to that week's Monday. Used by "My timetable" on web and mobile.

```jsonc
{
  "start": "2026-05-11",
  "end": "2026-05-16",
  "days": [
    {"date": "2026-05-11", "day": 0, "holiday": null, "on_leave": false},
    {"date": "2026-05-12", "day": 1, "holiday": null, "on_leave": true}
  ],
  "slots": [ /* the weekly template, same rows as /timetable/mine */ ],
  "substitutions": [
    {
      "id": 42, "date": "2026-05-12", "day": 1, "period": 3,
      "class_name": "Class 5", "section_name": "B", "subject": "Mathematics",
      "kind": "covering",                 // I teach someone else's class
      "other_teacher_name": "Nitesh Poonia",
      "status": "accepted"
    },
    {
      "id": 43, "date": "2026-05-12", "day": 1, "period": 1,
      "class_name": "Class 5", "section_name": "A", "subject": "Physics",
      "kind": "covered",                  // someone teaches mine
      "other_teacher_name": "Rohit Kumar",
      "status": "pending"
    }
  ]
}
```

* `substitutions`: requests in the week where the teacher is substitute (`covering`) or requester (`covered`),
  status `pending` or `accepted` only (one per day+period: prefer accepted). The apps draw accepted
  `covering` periods into the substitute's grid and mark `covered` periods in the requester's.
* `on_leave`: the teacher has a pending/approved leave covering the date.
* `holiday`: holiday name from the holidays table.
* Students: `/student/timetable` can optionally gain the same `substitutions` list for their section
  (kind `covered`, `other_teacher_name` = substitute) so parents see "Maths — Anita Verma (substitute)". Not required by the apps yet.

---

## 6. Class homework

Today homework is created per student (`POST /students/{id}/homework`). It must be assigned to a
whole class-section once, with a per-student submission status.

### 6.1 Tables

```sql
CREATE TABLE class_homework (
  id          SERIAL PRIMARY KEY,
  class_id    INT NOT NULL REFERENCES classes(id),
  section_id  INT NOT NULL REFERENCES sections(id),
  subject     VARCHAR(100),
  title       VARCHAR(200) NOT NULL,
  note        TEXT,
  due_date    DATE,
  created_by  INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_class_homework_section ON class_homework (class_id, section_id, created_at DESC);

CREATE TABLE homework_submissions (
  homework_id INT NOT NULL REFERENCES class_homework(id) ON DELETE CASCADE,
  student_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending',   -- pending | submitted | late
  updated_by  INT REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (homework_id, student_id)
);
```

A missing `homework_submissions` row means `pending` — so students who join the section later
automatically see the homework without back-filling (create rows lazily on first status change).

### 6.2 Endpoints

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/homework?class_id=&section_id=` | managers; teachers assigned to that section (class or subject teacher) | paginated; each row `{id, class_id, section_id, class_name, section_name, subject, title, note, due_date, assigned_by, created_at, counts: {total, submitted, pending, late}}` |
| POST | `/homework` | same | body `{class_id, section_id, title, subject?, note?, due_date?}`; `due_date` not in the past. Notify the section's students (`type: homework`). `201` |
| PUT | `/homework/{id}` | creator or managers | same body (class/section can't change). Notify if `due_date` changed. |
| DELETE | `/homework/{id}` | creator or managers | cascades submissions. `204` |
| GET | `/homework/{id}/submissions` | same as GET list | every current student of the section, ordered by roll no: `[{student_id, full_name, roll_no, photo_path, status}]` (not paginated — a section is small) |
| PUT | `/homework/{id}/submissions` | same | body `{"items": [{"student_id": 1, "status": "submitted"}]}` — bulk upsert; students must belong to the section; `204` |

### 6.3 Keep the old endpoints working (both apps still call them)

* `GET /students/{id}/homework` (staff) and `GET /student/homework` (parent app) return the student's
  **class homework merged with legacy per-student rows**, newest first, same item shape as today plus:
  `subject`, `scope: "class" | "student"`, `homework_id` (for class rows), and `status` from
  `homework_submissions` (default `pending`).
  For class items `id` = the `class_homework.id` (ids of the two kinds may overlap — the client keys
  rows by `scope` + `id`).
* `PUT /students/{sid}/homework/{id}?scope=class` with `{status}`: upsert that student's
  `homework_submissions` row (the web sends `?scope=class` for class items; without it, `id` is a legacy per-student row).
* `DELETE /students/{sid}/homework/{id}`: only for `scope = "student"` (the web hides Delete for class items); class items → `409`.
* `POST /students/{id}/homework` can stay for compatibility but neither app uses it any more.
* Optional data migration: legacy rows with the same `(class, section, title, due_date, created_by)` for
  every student of a section can be folded into one `class_homework` + submissions.

---

## 7. Staff attendance times

The apps now format whatever they get as **"9:30 AM"** (they drop seconds and accept
`"09:30:12"`, `"09:30:12.123456"`, `"09:30"` or ISO date-times). To make it unambiguous:

* `in_time` / `out_time` in `/staff-attendance/today`, `/mine` and `/staff-attendance` should be
  `"HH:MM:SS"` **in the school's time zone** (not UTC). If the DB stores UTC timestamps, convert with
  `ZoneInfo(settings.SCHOOL_TZ)` (add `SCHOOL_TZ=Asia/Kolkata` to the env) before formatting.
* Optional: also send `in_at` / `out_at` as full ISO timestamps with offset.
* `/staff-attendance` (managers, "Staff today"): please return a paginated list (`limit/offset`) for big schools.

---

## 8. Dates

All date fields in both apps are now calendar pickers that send `"YYYY-MM-DD"` (no more typed dates).
No backend change, but keep validating server-side (`422` for bad dates, `from ≤ to` for ranges).

---

## 9. Migrations

One Alembic revision per section is easiest to ship and roll back:

1. `notifications`, `device_tokens` (+ `fee_reminders_sent`)
2. `school_timings`
3. `substitution_requests` (+ partial unique indexes) and `leave_requests.status` += `cancelled`
4. `class_homework`, `homework_submissions`

New dependencies: `firebase-admin` (push), `apscheduler` (or an external cron) for reminders.
New env vars: `FIREBASE_CREDENTIALS`, `SCHOOL_TZ`, `JOBS_SECRET` (if jobs are triggered over HTTP).

---

## 10. Permissions summary

| Endpoint group | student | teacher | coordinator / sub_admin / principal / admin | driver |
|---|---|---|---|---|
| `/notifications*`, `/devices*` | own | own | own | own |
| `GET /settings/school-timings` | ✔ | ✔ | ✔ | ✔ |
| `PUT /settings/school-timings` | — | — | ✔ | — |
| `/substitutions/availability` | — | own | ✔ (any teacher) | — |
| `POST /substitutions`, `/cancel` | — | own requests | ✔ | — |
| `/accept`, `/decline`, `/withdraw` | — | requests to them | requests to them | — |
| `GET /substitutions` (all) | — | — | ✔ | — |
| `PUT/DELETE /leaves/{id}` | — | own (rules §3) | own + any not-started | own |
| `/homework*` | — | assigned sections | ✔ | — |
| `/timetable/week` | — | own | ✔ (`teacher_id`) | — |

---

## 11. Test checklist

**Substitution**
- [ ] Availability excludes: teachers with a slot that period, teachers already covering that date+period, teachers on leave that date, the requester.
- [ ] Holiday dates come back with `holiday` and no periods; Sundays are skipped; range > 31 days → 400.
- [ ] Two teachers accept the same period at the same moment → one `accepted`, the other gets `409` and becomes `filled`.
- [ ] Accept marks the other pending requests for that period `filled` and notifies them.
- [ ] Withdraw after accept frees the period: availability shows it uncovered again, `/timetable/week` of the substitute no longer has it.
- [ ] `can_withdraw` becomes false once the period has started.
- [ ] Deleting / rejecting / shortening a leave cancels its requests and notifies substitutes.
- [ ] Standalone requests are linked to the leave created afterwards.

**Leave CRUD**
- [ ] Edit only while pending; delete pending; cancel approved future leave → `cancelled`; started leave → 409.
- [ ] `coverage` counts are right for a 3-day leave with a holiday in the middle.

**School timings**
- [ ] 06:30 + 30 min prayer + 45 min periods + 20 min break after 3 → P1 07:00–07:45, P4 09:35–10:20.
- [ ] Students can GET; teachers can't PUT; invalid input → 422.

**Homework**
- [ ] One POST creates homework visible to every student of the section (`/student/homework`) and notifies parents.
- [ ] Bulk submissions update; a student added to the section later sees it as pending.
- [ ] Teacher not assigned to the section → 403.

**Notifications**
- [ ] Attendance save notifies only students whose status changed; one multicast per ≤ 500 tokens.
- [ ] Unread count, mark read, mark all read; another user's notification id → 404.
- [ ] Invalid FCM tokens are deleted; no FCM credentials → actions still succeed.

**Staff attendance**
- [ ] `in_time` is local school time, e.g. `"09:30:12"` → apps show `9:30 AM`.

---

## Where the client code lives (for reference)

| Feature | Web (`shelfwatch-plus/src`) | Mobile (`ShelfwatchPlus/src`) |
|---|---|---|
| Leave + substitute finder | `pages/Leaves.jsx`, `components/SubstituteFinder.jsx` | `screens/staff/Leaves.tsx`, `components/SubstituteFinder.tsx` |
| Substitute requests | `pages/Substitutions.jsx` | `screens/staff/Substitutions.tsx` |
| Week timetable / times | `pages/TeacherTimetable.jsx`, `lib/schedule.js` | `components/Timetable.tsx`, `schedule.ts` |
| School timings | `pages/SchoolTimings.jsx` | `screens/staff/SchoolTimings.tsx` |
| Class homework | `components/ClassHomework.jsx` (Section page → Homework tab) | `screens/staff/ClassHomework.tsx`, `HomeworkSubmissions.tsx` |
| Notifications | `components/NotificationBell.jsx`, `pages/Notifications.jsx`, `services/notifications.js` | `notifications.ts`, `push.ts`, `screens/Notifications.tsx` |
| Staff attendance (9:30 AM) | `pages/StaffAttendance.jsx`, `components/CheckInCard.jsx` | `screens/staff/StaffAttendance.tsx`, `HomeStaff.tsx`, `format.ts → fmtTime` |
| Calendar inputs | `components/ui.jsx → DateInput / TimeInput` | `components/pickers.tsx → DateField / TimeField` |
| New web pages for mobile-only features | `pages/Salary.jsx`, `pages/FeeClaims.jsx`, `pages/StaffAttendance.jsx` | — |

### Mobile push: turning it on

The server side is §1. On the app, push needs the school's Firebase project, so it is
prepared but switched off; the steps are at the top of `ShelfwatchPlus/src/push.ts`
(install `@react-native-firebase/app` + `messaging`, add `google-services.json`, two Gradle
lines, `POST_NOTIFICATIONS` permission, one line in `loadMessaging()`, rebuild). Until then the
bell polls `/notifications/unread-count` every minute and on app resume.
