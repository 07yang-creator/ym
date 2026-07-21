# ym — 连接想法清单 (entity-connection backlog)

> **What this is.** A ranked, filtered idea list for *connecting* the records ym already stores
> — people (志愿者/嘉宾/捐赠人), 物资, 活动, 任务, 收支, 评价, 模板, 成员分享 — so the organizer
> feels the tool "认得住" her people and assets. Generated 2026-07-21 (6 ideation lenses → 3 critics
> → synthesis; 51 raw ideas → 27 keepers + 7 parked).
>
> **Every keeper is a READ-TIME PROJECTION** over data already captured — no new task/relationship
> store — and was checked against the hold-the-line rules in `PLAN.md §E.7` (no CRM, no Gantt, no
> dependency graph, no identity graph, deadlines advisory-only, donation-inventory = one enum,
> 嘉宾 host-eyes-only, APPI gate). Ideas that failed those checks are in **Parked** at the bottom,
> with the reason — so we don't re-propose them.
>
> Effort: **S** = a projection + a line of UI · **M** = a small new panel/aggregation · **L** = larger.
> Pass conditions this serves: ① run a Saturday event without Excel · ② build the next event from the
> last one's assets in minutes.

## ★ Ship-first (best delight-per-effort)

1. **一键复办（克隆这场→下一场）** — the flagship for pass-condition ②
2. **今日总览 · 跨活动待办墙** — the daily core for a multi-event organizer
3. **人均一眼 (本场 ¥X/人)** — the first real cost-sense, one division
4. **在库物料复用提示（别再买一遍）** — owner-named "省钱又省一趟采购"
5. **签到台「老朋友」提示** — the most emotionally-landing moment (被记住)
6. **待记账金额小计** — tells apart a ¥200 chore from a ¥50,000 bill

---

## 1. 人员为中心（认得住每个人）
打开或迎接一个人，工具就替她记起对方是谁、来过几次、擅长什么——熟人协作的愉悦，全是 `guestHistory` / `shareDataFor` 的读时投影。

- **[S] 签到台「老朋友」提示：熟客上次评价 whisper** — 签到 `participant.arrived` ↔ 嘉宾注册 `libId` ↔ 过往 `evals`
  - *看到*：签到时若来者是熟客，名字行内浮只给 host 看的小字「女7 · 第3次 · 上次：健谈，想认识建筑业」。
  - *为什么*：迎接回头嘉宾像有记忆的迎宾，上一场写的评价此刻兑现价值。
  - *复用*：`guestHistory(libId)` + `participant.arrived` + `evals` 按 `at` 取最近。
  - ⚠ 嘉宾 host-eyes-only：只在签到台给 host 看，绝不进 `member`/`ym_share`。

- **[M] 性别缺口补邀：从熟客池按缺的一方推荐** — 活动到场性别缺口 ↔ 嘉宾库(按 `gender`) ↔ `guestHistory`
  - *看到*：男女差≥3（已有红色报警）时弹「补邀建议」：筛短缺一方性别、不在本场的熟客，按到场次数排序，一键 `addFromLib` 再邀。
  - *为什么*：把只报警的红字变成可执行动作——「缺3位男士→这几位老朋友可再邀」。
  - *复用*：`ratioHtml`/`arrCount` + `pickGuest` 的 `here` 去重 + `peoList('guest')` + `guestHistory` + `addFromLib`。
  - ⚠ host-eyes-only、只读、不排期不改 `e.date`、不落地邀约记录。

- **[S] 排班助手：可服务时间 + 上次服务日（advisory）** — 志愿者 `vol.avail` ↔ 该 `refId` 出现过的最近 `e.date`
  - *看到*：往台本拖志愿者时，条目显示「王芳 · 周末可 · 上次 5/12」。仅提示。
  - *复用*：`peoList('volunteer')` + `vol.avail` + `refId` chip-scan 取 `max(e.date)`。
  - ⚠ advisory-only：绝不写 `e.date`、不自动指派。

- **[S] 志愿者履历卡（组织者视角）** — 志愿者 ↔ 多场活动 ↔ resource `chip.role` ↔ `volLog`
  - *看到*：资产库打开一位志愿者，聚合常任岗位频次（主持×5·后勤×3）、累计工时、每场一句口碑。
  - *复用*：`shareDataFor` 的 `refId` chip-scan + `e.volLog` + `chip.role`（组织者侧镜像）。
  - ⚠ CRM 线：保持读时投影，绝不落存累计计数器；仅志愿者非嘉宾。

- **[S] 捐赠人致谢卡：累计捐赠一览 + 一键致谢** — 捐赠人累计字段 ↔（可选）经手物资 ↔ 库存态 `inv`
  - *看到*：打开一位捐赠人先展示累计金额/次数/物资/最近捐赠，一键 `share()` 致谢；列表顶给只读总额汇总供官网致谢。
  - *复用*：`peoList('donor')` 的 `totalAmount`/`totalCount`/`goodsCount` reduce + `share()`。
  - ⚠ NO CRM：只读求和，不新增 per-捐赠明细/`donorId` FK。

- **[M] 「谁能做这个岗」按擅长补人（轻版）** — 未落实人岗 `chip.role` ↔ 志愿者库 `role`
  - *看到*：点一个未落实的「人」chip → 按 `chip.role` 匹配志愿者，带可服务时间/上次服务日，一键 `applyRes` 落位。
  - ⚠ 一次一枚 chip，不做 who-does-what 派工网格。

## 2. 资产复用（越办越省力）
场地、物资、报价一点点攒成资产库，下一场从库里挑、别再买一遍——pass 条件② 的资产引擎读侧。

- **[S] 在库物料复用提示（别再买一遍）** — 本场要加的物 chip ↔ 资产库 `goods` 的 `inv` 状态
  - *看到*：物资拖放面板里把「已入库/尚有剩余」的 goods 顶前并标注「库里已有 桌花×20（已入库）」，用完的灰掉。
  - *复用*：现有 `applyRes` 面板按 `peoList('goods')` 的 `inv` 排序+标注。
  - ⚠ `inv` 保持单一 enum 只读，不引入逐件/批次/出入库流水。

- **[S] 场地履历（venue 复用回顾）** — 活动 ↔ 活动（共享 `e.venue` 字符串）↔ 那几场的物/收支 chips
  - *看到*：场地输入框旁浮「这个场地办过3场」，点开列往期日期 + 每场物 chips 与门票/场租。
  - *复用*：`STORE.events` 按 `e.venue` 分组 + `allResChips`/`allMoneyChips` 聚合。
  - ⚠ 字符串分组只读投影，绝不追加评分/字段长成 venue 实体。

- **[S] 物资使用足迹（goodsHistory）** — 物资 `cat='goods'` ↔ 多场活动（`refId`→`goods.id`）
  - *看到*：物资资料卡加「用过 N 场」清单 + 列表 meta「用过5场·当前:已入库」。
  - *复用*：照抄 `guestHistory` 改扫 `chip.refId===goodsId` + `inv`。

- **[M] 报价随系列滚动：下单时看历史实际价** — 当前 money chip ↔ 过往同 `refId` 的 `actual`
  - *看到*：放置/复盘收支 chip 时下方小字「近3场场地都¥28,000，本场计划写¥25,000」，一键把 `plan` 对齐现实。
  - *复用*：`moneyTotals` 已扫的 money `actual` 按 `refId` 跨事件取最近 N 条。
  - ⚠ display-only：改 `plan` 须 host 点一下确认，绝不自动写。

## 3. 金钱与报告（不用 Excel 也算得清）
总额和人头本来并排放着要她心算——工具替她做那一次除法、给一个跟自己比的判语；pass 条件① 的成本感。

- **[S] 人均一眼 (本场 ¥X/人)** — `moneyTotals` ↔ `arrCount`
  - *看到*：复盘收支块底加一行 `人均支出 = outActual ÷ 到场人数`「支出¥48,000 · 到场12 · 人均¥4,000」。
  - *复用*：`viewReview` 已把 `moneyTotals(e)` 与 `arrCount(e)` 算在相邻两行，只差一次除法。

- **[S] 复盘人均对标 (比你平常 省/多 ¥Y)** — 本场人均 ↔ 跨场惯常人均基准
  - *看到*：复盘一句判语「本场人均支出¥4,300，比你平常多¥300/人」，超出红、结余绿。
  - *复用*：循环 `moneyTotals÷arrCount` over `evPhase` 过滤事件作幕后基准；基准不单独露出。

- **[S] 待记账金额小计** — `moneyTodo` chips ↔ 它们的 `plan` 金额
  - *看到*：「待记账」标题从「3项」升级为「3项 · 约¥12,000未落账」。
  - *复用*：`moneyTodo(e)` 已返回 `actual==null` 的 chip，对 `c.plan` 求和。

- **[M] 按报名人数实时预估收支** — money chip `unit` 单价 ↔ `participant` 名册人数
  - *看到*：活动前随名册滚动的预估条「当前12人报名→预估门票¥54,000·预估支出¥40,000·净+¥14,000」。
  - ⚠ AI/派生 confirm-first：只读预估，绝不自动写 `chip.actual`。

- **[M] 盈亏平衡到场数提示** — `outPlan` ↔ 门票 `unit` ↔ `arrCount`
  - *看到*：一句「门票要盖住¥40,000支出，需约8位到场」，签到台随 `arrCount` 达标变绿。
  - ⚠ advisory-only：不排期、不写回金额。

## 4. 事件复用与滚动（这场变下一场的起点）
办完一场好活动，下一场几分钟从上一场原样长出来；系列自我校准——pass 条件② 的旗舰闭环。

- **[S] 一键复办（克隆这场→下一场）** — event(done/hot) ↔ new event(plan)
  - *看到*：仍热/已归档卡片「再办一场」：整张台本(header+rows 的资源/收支 chip、环节、owner)搬进新 plan 事件，执行状态归零、`date` 留空、participants 不带；可选勾「拉上次班底」「把上场 follow_up 变待办」。
  - *复用*：`buildSaveBack` 的 `cpR`/`cpM` 白名单拷贝 + `noTask` + instantiate 空壳 + `uid()`。
  - ⚠ clone=复制资产不复制排期：`e.date` 留空、`cpR`/`cpM` 重置 `status:0`/`actual:null`，丢弃 任务 chip，不做日期推算。

- **[S] 按「主题/人群」把活动串成系列** — event ↔ event（同 `theme` 分组）
  - *看到*：新建时若填相同 `theme`，浮该主题最近一场 done 当克隆来源「上次同类是6/12茶会，照这套办？」。
  - ⚠ advisory-only：只分组建议，绝不自动推算/写下一场 `e.date`。

- **[S] 系列复盘对比：这场 vs 上一场同主题** — 当前 event ↔ 上一场同 `theme` 的 done event
  - *看到*：复盘顶一行同类对比「本场女生+4·净+¥30k·更平衡」。
  - *复用*：`moneyTotals(e).actualNet` + `arrCount` 男/女，按 `e.theme` 找上一场 done。

- **[M] 资产成熟度：常用资源/环节的「用过 N 场」** — library 项 ↔ 所有用到它的 events
  - *看到*：资产库每项旁一枚场次计数「陽光カフェ·用过6场」「快问快答·8场」，点开看哪几场。
  - *复用*：按 `refId` 扫 `allResChips`/`allMoneyChips`、`ideas` 按 `seg` 命中 rows。

## 5. 执行与今天（一屏看清今天欠什么）
散在多场的欠办第一次汇成一面墙、一行体温计——多活动组织者的每日核心痛点。

- **[M] 今日总览 · 跨活动待办墙** — 所有 current/plan/hot event ↔ 各自 `followUps()`
  - *看到*：工作台顶一张聚合清单「【春季场】主持·王芳（未联系）」按紧迫度排序，款项作独立『待记账』小组，点一条直跳该场看板/台本。
  - *复用*：`STORE.events` 过 `evPhase` 选相，对每场调 `followUps(e)`/`moneyTodo(e)` 拍平排序 + `go()` 跳转。
  - ⚠ 读时投影，款项保持独立待记账组不进三翼。

- **[S] 今日一行 · 跨活动执行数字条** — 所有当前相 event ↔ `followUps`/`chip.due`/`moneyTodo` 计数
  - *看到*：工作台最顶「今天2场在跑·待办12·逾期2·待记账4」，每个数字点开展对应跨场清单。

- **[S] 截止日看板 · 跨活动截止漂浮** — 所有带 `chip.due` 的 chip ↔ 工作台『截止』小条
  - *看到*：按截止日排序的窄条，逾期红标顶上「距截止N天·哪场·哪个环节」，点跳到那条任务。
  - ⚠ 截止只提醒不排期：只展示/排序，绝不排程或写回 `e.date`。

- **[M] 一人一催 · 跨活动催办摘要** — 某志愿者 `refId` ↔ TA 在多场里所有未确认 resource chip
  - *看到*：点一个人→『催 TA』：按 `refId` 扫遍所有活动，把跨场未落实岗位收成一条消息一次 `share()`。
  - ⚠ NO CRM：发送时实时投影，绝不落地 per-person 催办历史表。

- **[M] 每场都做的杂事 · 常用待办一键补** — 历史各场 header 的 `type:'任务'` chip ↔ 新场 header
  - *看到*：新建活动时按名称计频出高频杂事（印名牌/确认场地/买水）排成一键 chip，点一下加为待办。
  - *复用*：扫 header `type==='任务'` chip 频次 + `exAddTodo` push 路径。

- **[S] 任务回台本 · 点任务跳到它的环节** — 执行树 task chip ↔ 它所属的 rundown row
  - *看到*：执行看板里「来自 13:00 签到入场」可点，一点跳回台本高亮那条环节行。
  - ⚠ 仅任务↔来源行导航，不排序/不阻塞/不日期传播（与"接续软链接"严格区分）。

- **[M] 今天谁在忙 · 按负责人看今日环节** — 在跑 event 的 `row.owner` ↔ 这些 row
  - *看到*：执行/今日切『按人看』：今天环节按 `row.owner` 归组「王芳：签到13:00、配对16:30（2环节）」。
  - ⚠ 只读呈现已填 owner，不在此指派/改人。

## 6. 连接与惊喜（整个应用像互相认识）
点一个名字、搜一个人、扫一场活动，四散的记录一跳就到。

- **[M] 点名即卡片（tap-a-name → peek）** — 任意名字/徽章/chip ↔ 该人的跨场聚合卡
  - *看到*：点任意名字浮小 peek：嘉宾→参加N次+上次评价；志愿者→累计场次/时长/口碑；捐赠人→累计金额。
  - *复用*：`guestHistory`/`shareDataFor`/donor 累计 + 现成 `peekCard()`。
  - ⚠ 嘉宾 host-eyes-only：peek 仅 organizer 视图可达，member 触不到。

- **[M] 一处搜名 → 跳到任何关联记录（全局搜）** — 名字/关键词 ↔ 嘉宾·志愿者·捐赠人·物资·活动
  - *看到*：顶部搜索框，结果按类型分组带一行 meta，点任一条跳到那张卡。
  - ⚠ NO CRM：只读搜索不累积互动；嘉宾结果绝不进 member/ym_share。

- **[S] 一场活动关系速览卡（人+资产+钱一屏，非图）** — 活动 ↔ 参加者·资源·收支
  - *看到*：每场一张摘要卡：男女比、资源四态分布、收支计划vs实际+差额、待跟进条数，四块点各块跳区。
  - *复用*：`arrCount`/`ratioHtml` + `resCounts` + `moneyTotals` + `followUps`。
  - ⚠ 必须是统计卡，绝不画节点连线/people↔people 关系图。

- **[M] 待回访清单（把「后续跟进」串起来）** — 嘉宾评价 `follow_up` ↔ 尚未再邀的人
  - *看到*：仍热区只读清单，聚合最近 `follow_up` 非空、且不在任何筹备中名册里的嘉宾，点一条跳资料卡或 `addFromLib` 再邀。
  - ⚠ NO CRM：读时浮现，绝不建跟进任务表/已处理勾选；嘉宾 host-eyes-only。

- **[S] 成员页「我的累计」roll-up** — 志愿者 ↔ 本人跨场累计（时长/场次/评价）
  - *看到*：`member/` 页岗位列表上方「累计服务N场·总时长X小时·收到评价N条」，由本人 payload 现算。
  - *复用*：member 端对 `d.jobs[]` reduce；最省，无新字段/表。

---

## Parked — 考虑过，但越线了（不建，理由在此）

| 想法 | 为什么 cut |
|---|---|
| 「常搭档」志愿者↔志愿者共现计数 | §E.7 点名的 people 关系图/CRM bait——边就是全部意义，无法改写救回；且 host 很少会开。 |
| 前后接续升级成排序/阻塞/日期传播的依赖图 / Gantt | 接续只能是 advisory 内联跳转；一旦排序/卡依赖/改 `e.date` 就成依赖引擎（§E.6 步骤8：最后做、只做软链接）。 |
| 跨平台别名身份/联系人图（handle↔人 长成 identity graph） | `guest.aliases` 必须扁平 host-only 截图匹配助手；且受 APPI 委託契約 门槛，v1 可整条 cut。 |
| 捐赠物资逐件/批次/出入库流水台账 | `inv` 是 goods 上单一 enum tap-to-cycle；per-unit/batch/movement 历史即库存管理 CRM。 |
| 逐人跟进/催办历史表、回访 done 勾选、供应商评分卡 | 任何 per-person 交互历史/勾选存储/供应商记录都越 §E.7 no-CRM 红线；须停在读时投影。 |
| 「搬运上一场」独立的 event→event 复制路径 | 重复了模板 save-back / 一键复办引擎——不另起并行拷贝路径，折进克隆。 |
| 单价×人数与计划不符自检 pill | 门票男女分价(6000/3000)，乘法自检会误报、对新手是唠叨——delight 判 cut。 |
