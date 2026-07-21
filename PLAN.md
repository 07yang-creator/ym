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

## E. Execution revision (owner, 2026-07-21) — **PRIORITY #1**

> The plan stage works. The revision makes **execution** the point: after planning, the app
> helps the organizer track each task's status. A **tree** view, not Gantt. Design-reviewed by
> 5 agents + a critic against the live code; the load-bearing decisions and gaps are below.

### E.0 The one idea that makes it cheap
**Tasks are a *projection* of chips, never a new stored thing.** `followUps()` already computes
the raw task list (every 资源 chip with status < 到位, every 收支 chip with `actual==null`). So:
- **A task = a chip.** The chip's existing 4-state status IS the task state, mapped 4→3 for
  display: **未联系 = 待办 · 已联系/已确认 = 进行中 · 到位 = 完成**. Flipping a chip (the existing
  `cycleRes`/`execFlip`) moves the task on the tree. One source of truth.
- **No task table, no `holder.tasks[]`.** Adding one would break `applySaveBack`/`cycleRes`/
  `execFlip`/`remindAll` and the whole "aggregations over the sheet, no modules" thesis.
- **Ad-hoc chores** (打电话确认场地、印名牌、续保险) — the chores a newbie actually lives in, which
  are NOT resource requests — are handled by letting the organizer drop a **bare chip
  `{type:'任务'}`** on the event-header (全场). `allResChips`/`followUps` already start from the
  header, so these appear on the tree for free; just exclude `type==='任务'` from the 资源 strip.

### E.1 The 执行 tree (per-event, reached by opening a 当前 event — not a new nav tab)
- **The tree IS the core management UI — not a label.** All planned data (each rundown step's
  人 / 物 / 钱 → 任务) feeds this ONE view; it is where the organizer *manages* the whole event.
- **Trunk = a VERTICAL time axis (owner spec, 2026-07-21).** Its **length = the execution runway**.
  **Top = 计划完成日** (`e.runAt`, stamped when 进入执行 is pressed) · **Root/bottom = 活动日**
  (`e.date`). A **「今天」marker descends** one notch per day from top toward the root — above-today =
  elapsed, below = time left. 还有 N 天 anchors the root. ⚠ A circular countdown ring is the trunk's
  **cross-section** — it throws away the length=time dimension; the trunk must be vertical. Fallback
  **日期未定** when `e.date==''`; past events route to 复盘, never a negative countdown.
- **Sides = status, positioned by DAY.** **完成 = LEFT · 进行中 = RIGHT.** Each task sits at its
  day-height on the trunk: **has 截止 → its deadline day; else 进行中 → the 今天 line; else 完成 →
  its completion day** (`chip.doneAt`, stamped the first time a chip reaches 到位). So the left side
  becomes a "what got done, and when" record, and a completing task **slides right→left at its day**
  — the host *watches it cross over on the day it happened*.
- **待办 = the canopy, on TOP** (spanning): unstarted / unassigned requests + undated to-dos wait
  here until started (they don't yet occupy a day). **搁置 = the roots** under the trunk (§E.2,
  non-dismissible).
- **Deadlines MARK + CHASE (owner).** A dated task gets a **● marker pinned to its day on the
  trunk** AND is actively chased: as the day nears it escalates (amber → red), overdue floats to the
  top of 待办 and reddens, and the host is **pushed** to act (surfacing + one-tap 📤催 via
  `exRemind`/`share`). Advisory only — it *reminds/chases*, never auto-schedules or touches `e.date`
  (§E.7).
- **Desktop = the full tree** (canopy / vertical-trunk-timeline with day-positioned sides +
  right→left crossover + ● deadline markers / roots). **Phone linearises** (compact countdown →
  待办 → 进行中 → 完成 → 搁置 — the mobile stack already tested). The desktop tree is the design.
- **Detail in a floating layer** (centered dialog, already built): tap a task → status seg/翻转,
  截止, 📤催, 搁置/删除. **Two verbs only: 状态翻转 + 📤催** (+ **↩ 退回**). No assignment grid, no scheduling.
- **New fields, additive (jsonb, no migration):** `e.runAt` (计划完成日), `chip.doneAt` (完成日).
  Both degrade gracefully when absent — top defaults to today; a done chip with no `doneAt` sits on
  the 今天 line.

### E.2 The end-of-planning gate + ignore
- A **「进入执行」** button flips the (currently dead) `event.status` `plan→run`, walks
  `followUps(e)`, and doubles as the desk's phase signal — one button, zero new fields.
- For each unfilled request: **待处理** (stays a 待办 task) or **搁置/ignore** → one bool
  `chip.ignored`. Ignored items render as a **muted note strip beneath the tree** with 恢复为待办
  only (no ✕) — so "never dismissible" falls out for free. **Ignored is excluded from every count
  and from 催** (else the host is nagged forever about what they set aside).

### E.3 The 工作台 desk (folds in today's 今日)
Top row = 4 phases: **当前 · 筹备中 · 已结束但仍热 · 已归档**. Derive from date + one new bool
`e.archived`: 当前 = within the event window; 筹备中 = future & not archived; 仍热 = 0 < today−date
≤ **14d** *(OPEN DECISION #B)*; 已归档 = archived or older. Reuse the dormant `event.status`.
- **Phone-first peek/open** (hover & long-press don't work on phones): **one tap = a floating
  peek card** with an **「打开」** button → 当前 opens the 执行 tree, 筹备中 opens the planning
  sheet, 已归档 opens a **read-only** sheet (a read-only render mode is new — small).

### E.4 Donation-material inventory (easy)
One enum on the **existing goods record** — `INV_ST = [待入库 · 已入库 · 已发放 · 已用完]`
*(labels = OPEN DECISION #C)*, tap-to-cycle like `cycleRes`, linked to a 捐赠人. **One field, not
a CRM** — hold that line literally.

### E.5 Participant-absorb by screenshot — **SEPARATE TRACK, gated, maybe cut from v1**
New `/api/parse` mode `roster_shot` → `[{platform, handle, display_name, conf}]` from a chat
screenshot (mirror `payslip`: **process in memory, never store the image**). A `guest.aliases[]`
holds the cross-platform username↔person map. A floating confirm-first match modal (with a per-row
男/女 toggle — **the screenshot has no gender; that's an unsolved source**). **Blocked on the APPI
委託契約** (a screenshot is third-party PII, same gate as a real roster). Do **not** block the tree
on this; sequence independently or cut for v1.

### E.6 Build order (each step additive to the live app; ljzhujudy is mid-test — never rewrite `chip.status`)
1. **Read-only 执行 tree** — project `followUps()`+chips into 待办/进行中/完成 + countdown hero +
   日期未定 fallback. Zero new fields, zero writes, zero migration. Delivers the core ask alone.
2. **Interactive** — tap-to-advance (`cycleRes`/`execFlip`), per-node 📤催, ↩ 退回.
3. **Ad-hoc 待办 chips** (`type:'任务'` on the header) + exclude from 资源 strip.
4. **Gate + ignore** — `chip.ignored`, 「进入执行」 button; **same commit: whitelist-copy in
   `cpR`/`cpM` so new fields don't leak into templates** (see gap #1) + exclude ignored from
   counts/催. Ships with a template-leak regression test.
5. **Optional 截止 `chip.due`** — red overdue pill, floats to top; advisory only, never schedules.
6. **The 工作台 desk** — 4 phases + `e.archived` + floating peek + read-only sheet route; fold 今日 in.
7. **Donation-material inventory enum** — trivial, anytime.
8. **Optional pre/post links** *last* — inline tap-to-scroll notes (接续自…/接续到…), **no lines,
   no ordering, no date math**. Lowest value, highest Gantt risk; only if 1–7 land clean.

### E.7 Cut / hold the line (Gantt & CRM bait the review flagged)
- A real **task entity/table** — never; tasks stay a projection.
- **Pre/post links** that impose ordering, block a dependent, or move dates — that IS a
  dependency graph. Keep advisory-only.
- **Deadlines** that auto-schedule or touch `e.date` — keep advisory-only.
- The gate becoming a **who-does-what assignment grid** — two verbs only (待处理/搁置).
- Donation inventory growing **per-unit/batch/movement history** — one field.
- The alias registry becoming a **cross-platform identity/contact graph** — flat `aliases[]`, host-only.
- **Money forced onto the three flanks** — it's binary; show as a small secondary 待记账 group.

### E.8 Status vs the full spec (re-check 2026-07-21) — built / partial / missing
Re-read of the owner's complete execution spec against the code. ✅ built · 🟡 partial · ❌ missing.
- ✅ **3 statuses** (待办/进行中/完成), tasks = projection of chips (spec 1).
- ✅ **Optional timeline** — trunk time-axis + 截止 day-positioning (spec 1).
- ❌ **Pre/post-step LINKS** (spec 1, "even better") — advisory jump-notes 接续自…/接续到…, NO
  ordering/blocking/date-math (§E.7). Not built; lowest priority, highest Gantt risk → LAST.
- ✅ **Tree shape** — vertical trunk (计划开始→活动日, 今天 descends), 完成 left / 进行中 right /
  待办 canopy / 搁置 roots (spec 2).
- ✅ **Tasks from planning; unfilled → 待办; ignore → non-dismissible 搁置 note** (spec 3).
- ❌ **Participant screenshot-absorb** + manual username→person match kept in memory
  (`roster_shot` OCR + `guest.aliases[]`) (spec 4). APPI-委託契約-gated → SEPARATE TRACK / maybe v2.
- 🟡 **Folding "major items only" + 「全部展开 / show me all at once」** (spec 5) — only 完成 folds
  today; desktop shows all. Need a fold-to-major-item default + a show-all toggle.
- 🟡 **Floating windows for detail (hover desktop / tap mobile), stay-oriented** (spec 5, 5.2) —
  today it's a CENTERED modal for tasks + a bottom-sheet peek for desk events. Replace with an
  **anchored floating peek**: desktop = mouse-hover; phone = **tap-once = peek, tap-again = open**.
  Applies to BOTH task nodes (tree) and event cards (desk).
- ✅ **Desk = 4 phases** current/筹备/仍热/归档, routing current→tree · 归档→read-only plan ·
  筹备→plan · 仍热→复盘 (spec 5.1, 5.2 routing correct — only the hover/two-tap trigger is missing).
- 🟡 **End-of-planning GATE per-item triage** (spec 5.3) — today `enterExec` just confirms and dumps
  all unfilled into 待办; the spec wants a per-item **待处理(→task) / 搁置(→note)** choice AT the gate.
  Build a light triage list (default 全部待处理, then 搁置 individually) — NOT an assignment grid.
- ✅ **Donation-material inventory** = one enum field `inv` (spec 6).

**Remaining build order (push):** ✅ ① anchored floating peek — DONE (cards show name+status only;
hover(desktop)/tap-once(mobile) shows a 环节·负责 brief; click/tap-again opens an anchored,
undimmed floating detail; desk cards open in ONE click, routed by phase; overlap killed by compact
cards + a center gutter + height that grows with count) · ② gate per-item 待处理/搁置 triage +
**JOBS per rundown item** (owner refinement 2026-07-21: each 环节 has people+resources+jobs; jobs
absorbed into templates so they auto-reappear; a 环节 with 0 jobs = no task; the gate warns about
0-job 环节, host can 忽略→a note beneath the tree) · ③ fold-to-major + 全部展开 · ④ pre/post
advisory links (last, Gantt-guarded) · ⑤ participant screenshot-absorb (separate, APPI-gated).
Owner also confirmed: leave the 活动 tab as-is for now (demo-stage, unsure of use).

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

**Decision (owner, 2026-07-19): ym SHARES the JJcashflow Supabase project + auth** — traffic
is small, speed wins. Guardrails that keep a later split cheap: every ym table prefixed
`ym_` with RLS from day one (exit = one `pg_dump` of `ym_*`); **no FKs from `ym_` tables
into cashflow tables** (`c_record`, `link`, …) — only into `auth.users`/`profiles`; organizers
are a new 区分 主办方 in the existing profile/approve flow.

**Media (owner, 2026-07-19): photos/videos live in the salon's own Google Drive folder**
(缘满沙龙, owned by the salon) — NOT in Supabase storage, and never the receipts bucket.
Upload via the repo's Apps-Script-proxy convention (CLAUDE.md #2 — script runs as the Drive
owner; on redeploy edit the existing deployment to keep the `/exec` URL). Supabase keeps only
metadata + Drive file IDs. Why: the salon keeps custody of participant photos (APPI-friendly),
videos are too heavy for Supabase, storage costs land on the data's owner. Revisit-point is NOT traffic: it's the
first REAL participant roster (income/婚姻/photos) — before that upload, APPI 委託契約 signed
and re-confirm shared vs own project.

**People & accounts (owner, 2026-07-20) — person ≠ account, hub-and-spoke:**
- **人 is its own category**, separate from 物资/场地: 嘉宾 · 志愿者/工作人员 · (later) 捐赠人.
  A person is a **host-created record**; an account is an **optional grant** the host makes so
  that person can be involved. Linked by an opaque `user_id` — a record never depends on a
  login existing.
- **Everyone interacts only with the host.** No member ever reads another member's data. The
  mechanism IS the boundary: the host *publishes* to each member exactly what they may see
  (their own jobs / own record) into a per-member share row; the member's RLS reaches only
  that row. Sketch for `0009_ym_people.sql`: `ym_share (host uuid, member uuid, payload
  jsonb, updated_at)` — host full CRUD on own rows, member SELECT where `member = auth.uid()`.
  Least privilege by construction, mirroring the client↔accountant link pattern.
- **嘉宾 data is created by the initiator** — no guest self-service (在线报名 stays V2.0, and
  even then it lands as a *proposal* the host accepts into a host-owned record). Privacy
  responsibility therefore sits with the host: the salon is the APPI controller of guest PII,
  we remain the 委託先.
- **嘉宾 data is host-eyes-only (owner, 2026-07-20).** The host fills it in and the host is the
  only reader — **not the guest themselves**, not volunteers, not other members. So a 嘉宾 is
  never granted an account: `grantAccount()` refuses any non-volunteer and `pushShares()`
  publishes volunteer duties only, so no guest field can reach `ym_share` at all. Guest records
  live solely in the host's own `ym_doc` (owner-only RLS). This supersedes the earlier note that
  guests might one day read their own record — they may not.

### Auth & registration (owner, 2026-07-20)
- **Every registration needs an INVITE CODE (instant) or waits PENDING for an admin.** No third
  path: an unapproved account keeps working locally but never syncs, publishes, or shares.
- **Seats:** `ljzhujudy@gmail.com` = 主办方 host (whitelisted → approved on first login);
  `07.yang@gmail.com` = admin (already whitelisted by 0002).
- **管理 tab** (admin only): approve / re-role / disable accounts, and mint or revoke invite
  codes. Codes are `YM-XXXX-XXXX-XXXX` from a CSPRNG over an unambiguous alphabet, admin-readable
  only, with a use counter.
- **The invariant from 0002 is preserved:** a user can never self-approve. Redemption is a
  narrow, audited exception — `ym_redeem_invite()` validates the code *first*, then sets a
  transaction-local flag that `profile_before_upd()` honours. **`is_admin` is never grantable by
  an invite**; only an existing admin, in the database, can create another admin.
- Members (志愿者 with accounts) are unaffected: they need no profile and no approval — the
  host's published share row is still the whole grant.

### Y5 — people & member accounts · shipped 2026-07-20
- [x] `0009_ym_people.sql`: `ym_share` (host CRUD · member SELECT own claimed rows ·
      claim-by-verified-email RPC, no enumeration). **Refinement: members need NO profile
      and NO admin approval — the host's published row IS the grant** (host is the gate).
- [x] Registry: 人员/物资 tabs; 人员 shows 志愿者(库) + derived read-only 嘉宾 roster
- [x] Host grants/revokes per person: 授权账号 by email; shares republish on every save
- [x] Member page `ym/member/`: login/register → claim → my info + my duties/hours/review
      only; 志愿者入口 linked from the landing footer
- [x] Volunteer 服务时长/工作评价 per event in 复盘 (feeds the member share)
- [ ] OWNER: apply `supabase/migrations/0009_ym_people.sql` (needs 0008)

Salon requirements source: 缘满沙龙系统需求 (owner-shared Google Doc, Drive folder 缘满沙龙) —
our evaluation fields (优点/建议改进/后续跟进), the job list, and the V2.0 deferrals
(matching / QR / online signup / AI) align with it.

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
- [x] Run mode on the same page: now/next highlight, tap = actual time logged
- [x] Check-in board per design spec: badge grid + ratio alarm; check-in drafts a ticket
      revenue row into 收支 (confirm, not auto-post)
- [x] 📷 cost receipt → `/api/parse` (existing receipt prompt) → confirmed 收支 record
- [x] 📷 participant paper form → `/api/parse` (new form prompt: 姓名/年龄/职业/择偶需求;
      low-confidence → dotted blanks) → confirmed profile
- [x] 🎤 `/api/voice` ym roster + intents `check_in / flip_status / eval_note / add_cost`;
      **gate: one mixed zh/ja sample tested before building UI on it**
- [x] Evaluations: voice/manual note per participant, confirm-first

### Y3 — the round trip + rehearsal
- [x] After-event view: planned vs actual times; 预算 vs 实际; attendance summary
- [x] 保存回资产库: sheet→template · new segments→ideas · helpers/suppliers→resources ·
      actual prices→收支项 (one confirmation screen, tap what to keep)
- [x] Exports: 台本 print/share view · 收支 CSV · attendance/evaluation CSV
- [x] Rehearsal (alone): full loop walked twice in preview 2026-07-19; next event built
      from the saved template with states reset (② verified)
- [ ] Rehearsal (with the organizer watching) — this is the owner's tasting run
- [x] Fix only what blocks ① or ②

### Y4 — alive (production) · shipped 2026-07-20
Requirements source re-read in full: 缘满沙龙管理系统需求文档 V1.0.
- [x] `0008_ym.sql`: 区分 主办方 (profile role check widened) + `ym_doc` jsonb store —
      owner-only RLS gated on an APPROVED profile, server-forced `updated_at`, no FKs
      into cashflow tables (§4 guardrail). jsonb now; normalized `ym_` tables when
      统计/matching need them.
- [x] Organizer auth: avatar → sheet with 登录 / 注册（主办方）/ 退出; approved → ☁ cloud
      mirror (debounced push on save, delete propagation, cloud-wins on login), pending →
      ⏳ local-only note; logged-out = demo mode unchanged (no hard redirect, convention #1).
- [x] First-login bootstrap: profile row `role='organizer'`, status decided server-side.
- [x] 嘉宾名册 V1.0 detail: full parsed field set retained (收入/婚姻/特长 + all 择偶);
      ⬆ 名单CSV import (Excel 另存为 CSV; quoted fields OK) — pairs with the CSV exports.
- [ ] OWNER: apply `supabase/migrations/0008_ym.sql` (after 0002–0007; then redeploy nothing —
      the app detects it live).
- [ ] OWNER: approve the salon's 主办方 registration in 管理 (or pre-whitelist the email).
- [ ] OWNER + salon: deploy the Drive upload Apps Script from the folder-owner account
      (media path, §4) — gates photo/video archiving, nothing else.

**V1.0 coverage:** 活动管理+嘉宾评价+志愿者岗位 = live (Y1–Y3); 嘉宾名册 fields+导入导出 = live
(Y4); 权限 basis (管理员/主办方) = live, 工作人员/志愿者 accounts later; 捐赠人/捐赠物 + 统计 +
V2.0 items (matching/QR/在线报名/AI 总结) = post-test per §6/§7.

## 6. Cut

Anything planner-grade (Gantt/dependencies/WBS) · CMS for the news page (hand-edited
static for now) · donated-goods screens · patron roster · statistics dashboards ·
participant self-service / online signup · i18n · AI matching · general ledger.

## 7. Open decisions

1. **zh/ja code-switching voice** — Gemini de facto; the Y2 sample test is the gate.
2. **Event-day hardware** — staff phones or one laptop (day-screen sizing).
3. **`0008_ym.sql` timing** — post-test by default; earlier only if multi-device is day-one.
4. **Rundown share format** — print view vs image card for LINE (decide in Y3).
5. **News-page content workflow — SHIPPED 2026-07-20 (Y6).** In-house, no external CMS,
   exactly as decided: `ym_post` (author CRUD gated on approved organizer; anon SELECT of
   `published=true` only) + a 发布 tab with a **rich-paste editor** (paste from Notion / Word /
   公众号 keeps formatting, everything dangerous is dropped) + the landing rendering live posts
   with a static fallback + 「公开到官网」 on an event publishing a derived 活动 card.
   **Security posture:** `ym/sanitize.js` is allowlist-CONSTRUCT and runs on BOTH sides —
   the database is *not* a trust boundary, so the public page re-sanitizes at render and
   degrades to plain text if the sanitizer fails to load. Notion remains usable purely as a
   drafting tool (paste), never as infrastructure. Article images ride the Drive media path.

*(Apply gesture is tap, not drag — phone-first; drag can be a desktop nicety later.)*
