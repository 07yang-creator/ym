# ym.connect.tokyo — Build Plan

Organizer-facing platform for group dating event organizers.
First tenant: 缘满沙龙. Target: test stage in days.

---

## 0. Pass condition

Not "it deploys." The bar is:

> **The organizer runs one Saturday event end to end without opening Excel.**

Everything below either serves that sentence or is deferred. If a feature doesn't
get touched on a Saturday, it isn't in the test build.

---

## 1. Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Host | `ym.connect.tokyo` | Subdomain of existing platform |
| Auth | Shared (connect.tokyo SSO) | Already built |
| Channels | Shared (existing email infra) | Already built |
| Python / libs | Shared codebase | Already built |
| **Database** | **New: `ym`, own role, same instance** | Exit = `pg_dump` + connstring ≈ 1hr |
| Cross-DB FK | **None.** `user_id` is an opaque UUID | This is what keeps the exit cheap |
| Web framework | Django + admin as v1 UI | ~80% of this app is CRUD + permissions |
| Custom UI | Django templates + HTMX + Tailwind | Two screens only. No SPA, no DRF yet |
| Encryption tier | Commercial / server-visible (cashflow tier) | AI extraction + stats need plaintext |
| First module | Event organizing | The only thing Excel can't already do |

**On the encryption tier:** rakusalab's zero-access code may travel; its *claim*
must not. Promise strength never exceeds deployed verification.

---

## 2. Data model

Every table carries `org_id`. Enforce with a base manager, not discipline.

### Identity — the important split

`person` ≠ `user`. Most people in this system never log in. Participants are
records. Only leaders, employees, and (later) volunteers get accounts.

```
org
  id, name, slug, timezone, created_at

person                          # org-scoped PII. NEVER deduped across orgs.
  id, org_id
  display_name, kana, gender, birth_year
  phone, email
  occupation, income_band, marital_status, residence_area
  intro, hobbies, personality, talents
  photo_key
  created_at, updated_at

person_role                     # a person is often participant AND volunteer AND patron
  id, org_id, person_id
  role  ∈ {host_leader, employee, volunteer, participant, patron}
  active, created_at

account_link                    # only for people who actually log in
  id, org_id, person_id
  user_id  UUID                 # opaque ref to connect.tokyo auth. NO FK.
  created_at
```

This split does two jobs at once: it stops `person` depending on `user`, and it
stops a foreign key crossing the database boundary.

### Domain — vertical, opinionated

```
match_pref                      # 择偶需求 — core schema, not custom fields
  id, org_id, person_id (1:1 with participant)
  age_min, age_max, education_req, occupation_req
  income_req, area_req, personality_req, other_req
  updated_at

event
  id, org_id
  name, theme, starts_at, ends_at, venue, capacity, intro
  status ∈ {draft, open, running, closed}
  created_at

attendance                      # the roster inversion lives here
  id, org_id, event_id, person_id
  status ∈ {invited, confirmed, checked_in, no_show, cancelled}
  checked_in_at, seat_no
  created_at
```

**The roster inverts.** There is no roster module. People enter *through* an
event via Excel import; the roster is a view over `attendance`. Django admin
gives you the CRUD for free. Resist rebuilding it as a module later — the
inversion is what deletes your largest block of screens.

### Jobs — the status-flipping schema

```
job
  id, org_id, event_id
  title           # 签到 / 接待 / 摄影 / 后勤 / 主持 / 配对协助 / other
  description
  assignee_person_id  (nullable)
  status ∈ {open, assigned, accepted, in_progress, done, verified}
  planned_minutes, actual_minutes
  created_at
```

Transitions, declared explicitly — not a status string you `.save()` over:

```
open ──assign──▶ assigned ──accept──▶ accepted ──start──▶ in_progress
                     │                    │                    │
                  unassign             decline               finish
                     ▼                    ▼                    ▼
                   open                 open                  done ──verify──▶ verified
```

Guards:
- assign / verify → `host_leader` or `employee` only
- accept / start / finish → assignee only
- every transition writes a `timeline` row. No exceptions.

### Evaluations — where the AI lands

```
evaluation
  id, org_id, event_id, person_id
  author_user_id
  strengths, improvements, follow_up
  source ∈ {manual, voice, photo}
  raw_media_key                 # the original audio/photo, retained
  transcript
  extraction_json               # explicit nulls, per-field confidence, grounding
  confirmed_by_user_id, confirmed_at
  created_at
```

Enforce the red line in the schema, not in application code:

```sql
CHECK (source = 'manual' OR confirmed_by_user_id IS NOT NULL)
```

AI cannot write to a person's record. It can only propose one.

### Timeline — one table, four features

```
timeline                        # append-only. never UPDATE, never DELETE.
  id, org_id
  actor_user_id
  subject_type, subject_id
  verb, payload jsonb
  at

  index (org_id, at DESC)
  index (org_id, subject_type, subject_id, at)
```

This single model gives you:
- **Diary** → filter by org + date range
- **Plan panel** → upcoming events + open jobs, no new storage
- **Audit log** → free
- **Statistics** → aggregate over verbs; new stat = new query, not new code

Build it on day one. Retrofitting history you never recorded is impossible.

### Deferred but schema-ready

```
resource                        # 捐赠物
  id, org_id, code, name, category, quantity, unit
  status ∈ {pending, in_stock, in_use, distributed, scrapped}
  patron_person_id (nullable)
  market_value, actual_value, is_cash
  donated_on, stocked_on, notes

event_resource
  id, org_id, event_id, resource_id, quantity, purpose
```

Write the migration, skip the screens. Costs an hour now, saves a refactor later.

---

## 3. The build

### Day 1 — spine

- `CREATE DATABASE ym;` + own role. Django `DATABASES` + router.
- Models above. `org_id` everywhere. Org-scoped base manager.
- Register **everything** in Django admin → back office done, zero screens written.
- Deploy to `ym.connect.tokyo`. Reuse CI, monitoring, backups.
- SSO wired. Role resolution via `person_role`, not a column on user.

### Day 2 — the event loop

- Event create/edit (admin suffices).
- **Excel import at event level** — `django-import-export`. One pass creates
  `person` + `attendance`. This is the migration path *and* the trust-builder.
- **Check-in screen** (HTMX, phone-sized): search box, one tap per person.
- **Job board**: seed from the standard post list, assign, flip with guards.
- Every flip → `timeline`.

### Day 3 — the AI chain (the only real product work)

Record → upload → STT → extract → **confirm** → `evaluation`.

- Reuse your IDP contract wholesale: structured JSON, explicit nulls, per-field
  confidence scores, transcript-span grounding.
- Confirm UI highlights low-confidence fields. Nothing saves unconfirmed.
- Photo path is the same chain with a vision model and the same contract.

### Day 4 — survivable

- Email channel: invite, job assignment, day-before reminder.
- Seed a full fake event: ~20 participants, 5 volunteers, 8 jobs.
- Walk the pass condition yourself. Twice.
- **Restore a backup.** Actually restore it. Don't assume.

### Day 5 — organizer in the room

- Run the fake Saturday with the organizer watching.
- Fix only what blocks the loop. Nothing else.

---

## 4. Reuse ledger

**Copy:** deploy/CI · monitoring · backups · email channel · auth · Python libs ·
Excel handling · IDP extraction pattern · Tailwind config

**Do not copy:** the database · the identity store (code yes, user table no) ·
rakusalab's encryption promise

---

## 5. Cut from the test build

News · budget & revenue · donated goods screens · patron roster · statistics ·
participant self-service · i18n · UI beautification

All of it is Excel today, and Excel is adequate at it. None of it is why they'd switch.

---

## 6. Costs minutes now, weeks later

1. `org_id` on every table
2. The `timeline` table
3. Opaque `user_id`, no cross-DB FK
4. The `confirmed_by` CHECK constraint
5. `resource` migration written, screens skipped

Skip any of these and the price is a refactor, paid at the worst moment.

---

## 7. Open decisions — yours

1. **STT engine.** Events will be mixed Chinese/Japanese. Which engine handles
   code-switching acceptably? This gates Day 3.
2. **Photo storage.** New bucket, or existing bucket with new prefix + separate
   credentials? A shared bucket has the same problem as a shared database.
3. **Event-day hardware.** Staff on phones or a laptop? Drives the check-in screen.
4. **Test data: real roster or seeded?** Still open. If the salon uploads 200 real
   profiles — income, photos, marital status — the test stage is production, and
   you owe backups, access control, and a 委託契約 before the first upload.
   Seeded is faster feedback anyway: organizers react to flow, not to real names.
5. **Who confirms an evaluation?** Any employee, or `host_leader` only? Affects
   the CHECK constraint's practical meaning.

---

## 8. After the test passes

In order of what each unlocks, not the PDF's order:

1. Volunteer self-service (they see their jobs) — removes the coordinator bottleneck
2. QR check-in — the Saturday gets faster
3. Budget vs actual per event + donation register — **not a general ledger**
4. Statistics — queries over `timeline`, mostly free by then
5. Participant online signup
6. AI matching over `match_pref` — pgvector, and now genuinely differentiated
7. Receipts / 寄付金受領証明書 — regulated, keep parked

---

*One note on the legal edge: storing another org's participant PII makes you a
委託先 under APPI, which means each salon needs a 委託契約 with you before their
first upload. Worth a lawyer's 30 minutes before schema freeze — I'm not one.*