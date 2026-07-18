# ym — 活动日记 (Event Organizer Diary) · Build Plan

> **v5 · 2026-07-18 (Sat).** v4's one-page-plus-library shape survives; this revision adds
> the **site structure** (public news landing + organizer app) and the **Monday 2026-07-20
> target** for the organizer's rundown page. v1 (Django, 2026-07-17 mobile chat) archived
> at `ym/archive/ym-build-plan-v1.md`.

First tenant: 缘满沙龙 (group dating events). Host: **jjconnect.tokyo**, path `/ym/`.
Stack: identical to this repo — static vanilla HTML/JS/CSS, `/api/parse` + `/api/voice`,
localStorage first, Supabase later.

## 0. Pass conditions

> **① The organizer runs one Saturday event end to end without opening Excel.**
> **② The next event is created from this one's assets in minutes, not from scratch.**

## 1. Site structure

Two front doors, mirroring this repo's splash → role-app pattern:

- **`ym/index.html` — public landing = a news page.** The salon's public face:
  组织介绍 (organization intro) · 活动 events · 文章 articles · 新闻 news, with a navbar
  and 登录 login. Static, hand-edited seeded content for now (no CMS); the events block
  is read-only marketing — participant online signup stays cut. Login routes to the
  organizer app (demo mode until real auth lands with `0008_ym.sql`).
- **`ym/organizer/index.html` — the organizer's app.** Logging in lands **directly on the
  three-assets rundown page** (the sheet + library panel below). No dashboard in between.

## 2. The product — one page, two panels

**Anti-goal:** project planning is a developed area and nobody wants to learn it unless
they have to. No Gantt, no dependencies, no WBS. One sheet the organizer already
understands, and a panel of things to drop onto it.

### The sheet (main) — a one-page rundown that IS the three assets

One event = one page of rundown rows: **时间 · 环节 · 负责人**, and each row can carry
**资源 chips** (岗位/人/物资) and **收支 chips** (费用/收入项). One event-header row
holds whole-event items (场地, 门票价, 保险…). The three assets are this page and two
aggregations over it — no separate modules:

| Asset | Where it lives on the page |
|---|---|
| **① 台本 Rundown** | the rows themselves; in run mode, now/next + tap = actual time |
| **② 资源计划** | every 资源 chip, aggregated in a summary strip: status counts (未联系/已联系/已确认/到位), tap a chip to flip status or 📤 send a reminder (合规一览 engine) |
| **③ 收支** | every 收支 chip: 计划 amounts from applied items, 实际 from confirmed records (receipt 📷, check-in ticket rows); strip shows 收入/支出 合计 + 差额. Per-event — NOT a general ledger |

Same page, two modes: **计划 mode** (edit rows, apply from library) and **当天 run mode**
(now/next highlight, actual times, quick capture). The badge-grid **check-in board** stays
its own operating screen per the design spec (`ym/design/ym-event-day.jsx` — a design
document; implement in vanilla HTML/JS; keep felt/card-stock/brass, tap-to-toggle without
confirm dialogs, ratio alarm red at gap ≥ 3, brass recording line, dotted low-confidence
blanks = 未确认不入档 made visible).

### The library (left panel) — pick and apply

Four tabs, one gesture: tap an item → it lands on the sheet (insert row / attach chip).
Desktop: persistent left panel. Phone: slide-in drawer, same content. This is the repo's
常用建议-chips pattern grown into a panel:

- **模板 Templates** — whole events (十对十, 八对八…): applying one fills the entire sheet
- **灵感 Ideas** — single 环节 segments (自我介绍轮, 快问快答, 交换联系…) with typical
  duration and needed resources pre-attached
- **资源 Resources** — accumulated people (volunteers, MC, 摄影) and 物资/suppliers
- **收支项 Cost/revenue items** — recurring items with typical prices (场地费, 饮料, 门票)

**The round trip is the asset engine:** everything applied comes *from* the library, and
after the event one tap saves *back* — the sheet becomes a template, new segments become
ideas, new helpers/suppliers join resources, actual prices update the cost items. The
library is the organizer's compounding 资产库; pass ② is structural, not a feature.

## 3. Reuse map

| Built in this repo | ym use | Delta |
|---|---|---|
| 常用建议 chips (Diary Tree) | the library panel: pick-and-apply | grow pattern |
| 合规一览 status flip + 📤提醒 share | resource chips follow-up | as-is |
| 今日 / 日历 | upcoming events + open follow-ups (未确认资源, 未收款项) | as-is |
| `/api/parse` (Gemini OCR, per-field confidence) | cost receipts → 收支 records; participant paper forms → profiles | new prompt each |
| `/api/voice` (zh voice → 1 roster-constrained intent, confirm-first) | `check_in` / `flip_status` / `eval_note` / `add_cost` | new roster + intents |
| QR phone capture (`cap_*`) | venue phone capture | as-is (later) |
| CSV export (UTF-8 BOM, RFC-4180) | 收支表 · attendance · evaluations | new columns |
| Share (`navigator.share` LINE/微信) | reminders · job assignments · rundown to staff | as-is |
| Supabase auth/RLS/admin | organizer accounts (new 区分: 主办方) | `0008_ym.sql`, post-test |

## 4. Data

Test stage: **per-user localStorage** (`jjym_*_v1:<uid>`). Two stores:
- `event`: header + `rows[] {time, segment, owner, resources[], money[]}` + attendance + evals
- `library`: `templates[] · ideas[] · resources[] · money_items[]`

`0008_ym.sql` after the Saturday passes, on `0003`–`0007` RLS conventions. AI proposes,
human confirms (convention #4). Real rosters = APPI 委託先 → 委託契約 signed before any
real upload; all testing on seeded data.

## 5. Build stages (checklist before code · log in PHASE_PROGRESS.md · regression checks per stage)

### Y1 — the sheet + the library · **target: Monday 2026-07-20**
- [x] `ym/index.html` public news landing: navbar (组织介绍/活动/文章/新闻/登录), seeded
      content blocks; 登录 routes to the organizer app (demo mode)
- [x] `ym/organizer/index.html` from accountant shell; lands on the rundown page;
      nav = 今日 · 活动 · 资产库
- [x] Rundown sheet: add/edit/reorder/delete rows (时间/环节/负责人); event-header row
- [x] Attach/detach 资源 chips and 收支 chips on any row
- [x] Library panel (desktop persistent / phone drawer): 模板 · 灵感 · 资源 · 收支项;
      tap-to-apply (template → whole sheet; idea → row; resource/money → chip)
- [x] Summary strips: 资源 status counts + tap-to-flip + 📤 reminder; 收支 合计/差额
- [x] 今日/日历 lists events and open follow-ups
- [x] Seeded library (十对十 template, ~10 ideas, sample resources/prices) + demo event
- [x] `scripts/check-ym.mjs` regression checks (sheet ops, apply ops, strip math)

### Y2 — event day
- [ ] Run mode on the same page: now/next highlight, tap = actual time logged
- [ ] Check-in board per design spec: badge grid + ratio alarm; check-in drafts a ticket
      revenue row into 收支 (confirm, not auto-post)
- [ ] 📷 cost receipt → `/api/parse` (existing receipt prompt) → confirmed 收支 record
- [ ] 📷 participant paper form → `/api/parse` (new form prompt: 姓名/年龄/职业/择偶需求;
      low-confidence → dotted blanks) → confirmed profile
- [ ] 🎤 `/api/voice` ym roster + intents `check_in / flip_status / eval_note / add_cost`;
      **gate: one mixed zh/ja sample tested before building UI on it**
- [ ] Evaluations: voice/manual note per participant, confirm-first

### Y3 — the round trip + rehearsal
- [ ] After-event view: planned vs actual times; 预算 vs 实际; attendance summary
- [ ] 保存回资产库: sheet→template · new segments→ideas · helpers/suppliers→resources ·
      actual prices→收支项 (one confirmation screen, tap what to keep)
- [ ] Exports: 台本 print/share view · 收支 CSV · attendance/evaluation CSV
- [ ] Rehearsal: seed ~20 participants / 5 volunteers / 8 jobs; walk ① twice alone, then
      with the organizer; build the next event from the library (② timed)
- [ ] Fix only what blocks ① or ②

## 6. Cut

Anything planner-grade (Gantt/dependencies/WBS) · CMS for the news page (hand-edited
static for now) · donated-goods screens · patron roster · statistics dashboards ·
participant self-service / online signup · i18n · AI matching · general ledger.

## 7. Open decisions

1. **zh/ja code-switching voice** — Gemini de facto; the Y2 sample test is the gate.
2. **Event-day hardware** — staff phones or one laptop (day-screen sizing).
3. **`0008_ym.sql` timing** — post-test by default; earlier only if multi-device is day-one.
4. **Rundown share format** — print view vs image card for LINE (decide in Y3).
5. **News-page content workflow** — hand-edited static now; whether the salon gets a
   small edit screen later (post-test, with `0008_ym.sql`).

*(Apply gesture is tap, not drag — phone-first; drag can be a desktop nicety later.)*
