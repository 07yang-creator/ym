# ym 交接 — 2026-08-07 晚 II（緣滿印章 logo）

owner 提供朱印图（Gemini 生成，**假透明** —— 棋盘格是画进像素里的）。按红度键控成真透明
（非红→alpha 0，色取 solid 像素中位数 #D04825），出三份：`img/logo.png` 512 透明 /
`favicon.png` 64 / `touch.png` 180（衬官网纸色 #F4EFE2，iOS 图标要不透明）。
四页（官网/主办台/成员/手册）nav+head 全换；**主办台/成员页的 logo 锚点没动**
（`<a href="../">` 回官网那三颗，套件旧 pin 原样绿），只换了锚点里的内容。套件 +7 pin。
拍照页（?cap=）的页头字标也换了 —— 一个牌子挂到底，别留一处旧字标。

---

# ym 交接 — 2026-08-07 晚（发布通道 v2：积木三段 + 官网图床 + 轮播/播放器）

第一篇真文章暴露三件事（owner 报）：①主办不知道怎么排版 ②传的照片不显示 ③视频只是一条链接。
owner 定案走「积木三段」（方案 B 收窄版）：**正文 textarea（空行=分段）· 照片集（两张起自动轮播）·
视频框（可加多条 YouTube 链接）**。主办不做任何排版决定 —— 排版从此是官网渲染侧的事。

## 各层（三层一起看，别只看一层）

- **图床 `/api/ym_post_img`（住 JJcashflow 仓，同 ym_file 一批 env，owner 零配置）**：
  已批准主办/管理员 → Supabase Storage **公共桶 `ym-public`**（首传自动建桶；mime 白名单无 svg
  + 魔数嗅探两道都过才收；对象键 post/<uid>/<随机>，零调用方输入）。
  ⚠ 它和 Drive 网盘是**方向相反的两条路**：网盘有意不公开（真人来宾正脸，owner 08-05 裁决），
  文章配图的用途就是公开 —— **永远别合流**。`list_media` 只列自己的 post/<uid>/（图库用）。
- **`enhance.js`（新文件，读渲染侧，官网 + 编辑器预览共用）**：在**净化之后**的树上做三件事
  ① YouTube 链接 → youtube-nocookie 播放器（11 位 id 白名单，iframe 由本文件 createElement —
  净化器照旧杀存储里的一切 iframe）② 连片空段收拢（治第一篇文章那个整屏空洞，老贴渲染时自愈）
  ③ **figure≥2 img → 自动轮播**。轮播的存储形态就是素 `<figure><img>*</figure>` ——
  sanitize 剥 class 留结构，**结构是唯一活得过净化的标记**；没有 enhance 的读者看到的是
  诚实的一列图。计时器在节点离开文档后 isConnected 自杀（阅读器关 overlay 不会来通知）。
- **composer（organizer 发布 tab，cz* 函数族）**：新贴一律积木（postNew 播 cz 种子）；
  打开老贴先 `czParse(body_html)`，认不出 composer 形状（富标记/图文混排/乱序）就落回**旧富文本
  编辑器** —— 老贴不许被静默降级成纯文本。序列化 `czHtml` 全程 DOM 构建不拼字符串，
  存库前 `ymSanitize.html` 再过一遍（两侧规矩没变）。摘要留空自动取正文开头 60 字。
  上传中（`_up`）挡保存；输入即回写状态（整页重画不吃字）；打字中不重画（光标 + 中文输入法组字）。
  图库 = `czLib*`（列表来自 list_media，点选出 ✓，去重后加进照片集）。
- **预览 = 官网同一条渲染路**（净化 → enhance），浅色纸面色值写死成官网的（改官网 .rd 样式要跟着对）。

## 验证（真跑，不是读代码）

套件 +26 pin 全绿（两个既有计数 pin 跟着新形状走：dc-go ← 6→7、upMark 对 4→5…最终 5 对）。
jsdom harness（session scratchpad，未入仓）22 条打**真文件**：轮播结构/点点/单张不穿衣、
播放器/空段收拢、双重 apply 不翻倍。浏览器在 fetch 边界下桩真跑：czHtml↔czParse 无损往返、
富文本判旧、czImgFiles 真传两张、图库点选去重、标题/上传中两道保存闸。
**踩过一个真雷留档**：collapseEmpties 内层 drop() 借用外层循环变量 i → 连片空段**同步死循环**
（把浏览器标签页整个卡死，症状像「面板挂了」）—— jsdom 复验当场抓到，修法 var j，套件有 pin。

## 没做（下一班按需，都不挡今天的路）

- 图库里**删除**图（孤儿图公开但无害，Supabase dashboard 可手删）；照片集内**排序**（现=加入顺序）
- 非 YouTube 平台的播放器（B 站等）：存的是链接，官网显示为普通链接，存草稿时 toast 有提醒
- 回顾模板 / ✨AI 起稿（/api/phrase 现成，接上是小半天）；member 页不渲染 post，没动

---

# ym 交接 — 2026-08-03（co-admin + 活动负责人/协办 第一阶段）

owner 两条：**① ljzhujudy@gmail.com 升 co-admin；② 每场活动要有 owner** —— admin 建活动、
指定 owner（从现有用户里选），owner 可以再加 co-owner。

## ① co-admin：`0026_ym_coadmin.sql` ✅ **owner 已应用（2026-08-03 当天确认）**

- `profile.is_admin = true`（by email）+ `whitelist('ljzhujudy@gmail.com','admin')`（重注册也保住）。
- ⚠ 迁移里**必须停一下 `trg_profile_upd`**：SQL editor 里 `auth.uid()` 是 null → `is_admin()`
  恒假 → 那个触发器把 is_admin **静默改回去**（UPDATE 报成功、值没变，0020 记过的坑）。
  整段一个事务，末尾 do $$ 自检：查出来不是 true 就整体回滚 raise。
- 作用面是**整个平台**（profile 是 jjcashflow 共用的）：管理 tab、发主办码、批主办申请、
  ym_entry/ym_invite/ym_join_request 的 admin 策略、caller_ok（Drive）。owner 点名要的。
- ⚠ **0025_ym_join_cap_window.sql 仍然没跑**（上一班的待办，别丢）。

## ② 活动负责人/协办 —— 第一阶段（主办台侧）已上线

- 活动卡（计划页）新增一行：负责人 `[Tiffany · V0001 ✕]` 协办 `[王芳 ✕][＋]` ——
  **从用户一览选人**（`ownPickCard`，goods/已归档/已在卡上的不出现，有账号的排前面），
  不是自由文本；环节行上的 `r.owner` 是另一层，没动。
- 数据：`e.ownerRef={id,name}` + `e.coOwners[{id,name}]`（id 指名册，name 是显示备份 ——
  人删了老卡仍读得出）。只进 ym_doc：**buildSaveBack / syncEventPost 两个白名单没扩** ——
  模板和官网带不走 staff 名字（套件钉死）。
- 选负责人时协办**仍在列表里** = 点了就升为负责人（ownAssign 自动从协办摘掉）；
  再办一场把负责人/协办带过去（和人力牌同口径）。工作台卡片 brief 显示「负责人 ×××」。
- 老活动（云上的 payload 没这两个字段）照常渲染成「＋ 指定负责人」，不炸（都 `||[]` 访问）。

## 同日追加（owner 看了真机后的两条）

- **页头导航**：owner 把执行看板的「← 计划」当成回列表，迷路了。三个阶段页
  （执行看板 / 当天 / 复盘）统一成：`← 列表`（回工作台）＋右侧 `计划` 药丸（dc-go，
  和工作台卡片同款 —— 为此把 `.dc-go` 从 `.deskcard` 作用域里解出来了）。
  「到处一个样式，用户才记得住哪些是导航」是 owner 的原话（意译）。
  ⚠ owner 同日**二次点名**：`←` 做成文字链不算「同一款按钮」—— 左右两个导航
  **都**是 dc-go 药丸，并把 报名情况 / 总账 / 发布编辑 的页头 `←` 一并换成药丸
  （`.bk` 文字链只留给 回登录 / 婉拒 那类行内小动作）。套件按数量钉死：6 个 ← + 3 颗计划。
- **管理页备忘**：邀请码对新管理员（ljzhujudy 刚上）是陌生概念 —— 生成表单下面
  写了整条注册流程（生成→发人→主办登录页粘码注册→即时开通；无码=待批准；
  成员码不走这里）。措辞对过 authWall 真实的门（先填后按）。

## 同日第八条：口述**直接写进那一格**（不再先弹卡片）

owner：「write directly into blanket is better」（同日早些时候那句「if heard, why not write
into blanket first?」的下一步）。以前听清了但判不出意图 → 弹一张卡 → 还要点一下
「写进刚才那一格」。现在直接写进去，卡片不出现。

- `applyVoiceDraft(d)` 是两条录音路（浏览器转写 `recSendText` + 老 MediaRecorder `recSend`）
  的**共同出口** —— 只修一条等于没修，这条规矩这个月第 N 次。
- **会改数据的四支照旧要人确认**（`DRAFT_ACTIONS`：eval_note / check_in / flip_status /
  add_cost，约定 #4「AI 只提议，人确认」）。直写只发生在「没有可执行意图」那一支 ——
  往格子里写字本来就是可编辑、可撤的。
- ⚠ **顺序：先 `render()` 收掉录音条，再写字。** 反过来的话，那次 render 会拿模型里的旧值
  把刚写进去的字重画掉。写完**不再 render**，光标就留在那一格末尾，可以接着改。
- 🔴 **定位不能只认 id** —— 这是这次真正的坑：台本行上的 环节 / 负责人 / 说明
  （`.segi/.owni/.descsi`）**都没有 id**，而主办在计划页对着话筒说话时要写的正是它们。
  旧的 `_lastField` 只记 `t.id`，所以在最常用的场景里根本定位不到。
  现在记两样：元素本身（没重绘就是它）+ `(data-rid, 首个 class)` 兜底（重绘后还找得回来）。
- 找不到那一格（没点过输入框 / 那一格已经不在页面上）→ **还是弹卡片**，
  「听到的话不能扔」那条没变；写入仍是**追加不覆盖**。

⚠ 验证环境的一条坑，留给下一班：**浏览器面板里 `el.focus()` 不会触发 `focusin`**
（窗口没有系统焦点时浏览器会抑制焦点事件），所以用 `.focus()` 测这类「记住上一个格子」
的逻辑会假阴性。要 `el.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))`
—— 真人点一下是会发的。

## 同日第七条：名册第四类「主办」+ 资料卡能改类别

owner：「tiffany and judy are hosts, not volunteer, they should have their own category.」

- `PEO_CATS` 加 `['host','主办']`（资产库分页、用户页分组、＋主办、`LIB_FIELDS.host`
  五个字段：姓名/职务/联系方式/**主办账号邮箱**/备注 —— 邮箱是为了和 0027 共编那段的
  「主办账号」对得上人）。用户页分组顺序把 主办 放在最前。
- **主办这一类不发成员邀请码**：行上显示「主办账号」而不是按钮，`grantOpen` 也直接拒绝
  并指路「找管理员发 YM- 主办邀请码」。两条路都堵 —— 资料卡里的「账号」按钮是同一道门的
  第二条路，只藏按钮等于没修（成员码本来也铸不出 H：0015 的 RPC + 触发器双重拒绝）。
- **资料卡新增「类别」下拉 `personSetCat`** —— 这条是关键：Tiffany/Judy 已经存在，
  没有它就只能删了重建，**编号和服务记录会一起没**。改类别只动 `rec.cat`，
  **记录还是同一条**（`refId` 不变），所以台本上挂着的牌、服务记录全都跟着走 ——
  真跑验过：改完 `chip.refId` 仍然解析得到那条记录。
  换类别前先 `libReadInto` 把正在编辑的字段存回去（换完卡片会重画成另一组字段）。
  已有编号的人改类别**只提醒不阻止**（owner 的规矩）：编号的身份是铸码那一刻定死的
  （0015：code 是 ym_share/ym_submit 的 FK 目标），类别只是名册这边的分组。

## 同日第六条：移除成员 = 可恢复的软删除（`0029` **owner 待跑**）

owner：「host may remove his users. can be restored by admin in 30 days.」
分工照原话：**主办移除、管理员恢复**，主办这边**故意没有「撤销」**（否则就只是个回收站，
没有那道复核）。

- **结构性的一手**：移除 = 把整条记录从 `library.resources` **挪进** `library.trash`。
  记录离开了那个数组，于是 名册 / 指派器 / 资产库 / 重名检测 / 台本挂牌 **每一个读者
  自动看不见它** —— 不用去审计「还有哪里忘了加过滤」。真跑逐个验过（peoList / nameIndex /
  ownPickCard / libPanel 都只剩另一个人）。这是对「一个功能两道门」的结构性规避。
- **两道门合一**：资产库的 ✕ 删人也转交 `personRemove` —— 否则从 ✕ 删掉的人管理员恢复不了。
- **服务端 `ym_trash` 不存名册记录本身**，只有 名字/编号/时间。记录始终在主办自己的
  `ym_doc` 里；管理员恢复只是盖一个 `restored_at`，**真正把记录挪回去的是主办自己的客户端**
  （`trashPull`，挂在 cloudRefresh 的节拍上），顺带 `ym_revoke_code(p_off:false)` 恢复访问。
  这样管理员不需要、也没有写别人 `ym_doc` 的权限。
- **30 天**：客户端超过 30 天把本机那条真正丢掉（那一刻才不可恢复）；RPC 也拒绝过期恢复。
- 迁移里没有 update 策略（恢复只走 definer RPC，避开 0027 H1 那类 permissive 互凑面）；
  插入触发器强制 `restored_at=null` + 服务端 `deleted_at`（否则主办能自带时间戳绕过 30 天）。
- ⚠ **一处 owner 可以否决的取舍**：`ym_trash` 存了 `label`（名字），因为管理员要能分辨
  「恢复哪一条」。这和 0014 §7「平台不做身份汇总」擦边 —— 不要的话就只留 code，
  代价是没有编号的记录管理员无法分辨。

✅ **`0029` 已应用并实测复验（2026-08-03）**：`ym_trash` 表 200、`ym_trash_restore` 对 anon
**401 42501**（这次一开始就按 0028 的教训点名 `from public, anon`，没有再漏）。
自检没 raise ⇒ 插入守卫触发器在、且 `ym_trash` 上没有任何 update 策略。

## 同日第五条：活同步（拉）—— owner 要「负责人和协办 see the same thing and edit at the same time」

第一步先补上**任何**架构都缺的那半边：cloudLoad 只在登录那一刻拉一次，之后别的设备
（或同一账号的另一个人）写的东西要重新登录才看得见。`cloudRefresh()`：回前台 / 聚焦 /
前台每 25s 重读 ym_doc 的活动行，**逐场合并**。规矩：
- mtime 闸同一把尺 —— 本机动过还没推的活动不被覆盖（本机未推的编辑赢；推完后写的赢，口径没变）；
- **接受云端版本时 mtime 归零**（payload 里的 mtime 是写它那台设备的本机戳，带着落地
  会让自己的推送闸把这场当「本机动过」，从此每 800ms 往回推）；
- **比内容时剥掉 mtime**（不然「归零」vs「云上带戳」永远不相等，每 25s render 空转）；
- 焦点在输入框时整个跳过（重画吃字）；换人 (_loadSeq 之外这里比 uid) 作废整批；
- 只合并 events，不碰 library（mergeLibrary 的种子陷阱不该高频跑）。
桩在网络边界验过五条：新活动出现 / 脏活动不覆盖 / 干净活动更新+归零 / 二次拉零渲染 /
打字挡住、失焦后落地。

### 跨账号共编已上线（owner 三选一裁定：**主办账号共编**）—— `0027` 待 SQL editor 跑

owner 选了「指到主办账号 → TA 在自己的主办台共同编辑」。已实现：
- **`0027_ym_event_share.sql`（owner 待跑）**：`ym_event_share(host,doc_id,member)` +
  `ym_doc` 的 `select/update` 共享策略（**不开 insert/delete**，全部盖 `ym_ok()`）。
  写名单只经 `ym_event_share_sync()`（security definer，门=归属/已在名单/admin，host 永不入表）；
  `ym_host_accounts()` 只给 admin 返回「可选主办账号」名单。末尾 do $$ 自检。
- **两种引用并存**：`ownerRef/coOwners` 里 `{id,name}`=名册（仅标注）、`{uid,email}`=主办账号（真共编）。
  `refKey()` 是统一钥匙（去重/升位对两者一视同仁）。指派器多一段「主办账号」（admin 才拿得到）。
- **`_host` 是本机路标**：cloudLoad + cloudRefresh 两条拉取路，别人的行盖 `_host=owner`、
  自己的行剥掉；`save`/`cloudPushAll` 把共编活动按归属**分批** upsert（`owner=_host`，payload 剥 `_host`），
  一批被拒（权限收回）不拖垮自己那批，并摘掉重试资格 → 下次 cloudRefresh 扫走无家副本。
- **归属专属动作**（四处，共编者一律挡）：删除、公开到官网、票据入账（`rcShoot` 总闸 + 两个显眼按钮各自藏）。
  理由：账本/官网卡片跟作者走，从共编端做会把一场活动的账拆两本、官网出两张。
- 指派即授权：`ownPut/ownDel` 都跟 `shareSync`；`0027` 没跑时 toast 明说「先跑迁移」。

桩在网络边界验过：拉取标记归一（别人的盖、自己的剥）、推送分批且 payload 无 `_host`、
删除/公开/票据三闸、指派 account→`ym_event_share_sync(p_host,p_doc,[uid])`、picker 两段、
共编 chip 带钥匙图标、desk「共办 ·」角标、清场回登录墙。套件 +7 条（迁移 2 + 客户端 5），
两条既有 pin（delEvent 云删、cloudPushAll 可等）跟着新形状更新，全绿。

### 🔴 上线前对抗式复查抓到 1 个 HIGH（夺行）+ 5 条已一并修进 0027 —— 判据留档

上线后立刻跑了一轮 RLS 越权复查（房规：每次实质改动前后都要）。**抓到一条 HIGH，
0027 已按它重写**（文件原地改，因为还没 apply —— 不留一个可单独 apply 的漏洞版本）：

- 🔴 **H1 夺行**：RLS 多条 permissive 策略，**USING 和 WITH CHECK 各自 OR**，不要求同一条
  两半都过。ym_doc 上除本文件两条，还有 0008 的 `ym_doc_all`（FOR ALL，with check=owner=auth.uid()）。
  于是共编者能 `update ym_doc set owner=自己 where owner=原主办…` —— USING 过 shared_upd、
  WITH CHECK 过 ym_doc_all —— **把整行夺走，原主办永久被踢、无 UI 可恢复**。
  修：`ym_doc_keys_immutable` BEFORE UPDATE 触发器钉死 owner/kind/doc_id（WITH CHECK 看不到
  OLD，只有触发器能比）。**没重写 0008 的 ym_doc_touch**（那个 updated_at 触发器另有用途）。
  正常 upsert 一列都不改这三个，不受影响。**判据：RLS 里 `for all` 的 with check 会漏进
  别的策略的 update —— 加共享 update 策略时，先数一遍这张表还有哪些 permissive with check。**
- M2 只有归属/admin 能**移除**共编（sharee 只能加，防踢人换锁）；客户端对应把账号牌的 ✕ 藏掉
- M1 只加 **approved** 的 ym_member（挡潜伏授权：志愿者账号今天无害，被批成主办就凭空得权）
- M3 两个 definer 函数 + 触发器函数都带 `pg_temp`；L4 分享表 DML 对 authenticated 收回（唯一入口=RPC）
- L2 `array_remove(...,null)` 防收回权限静默 no-op；L1 member_sel 也盖 ym_ok()（让「全部盖」成真话）
- H2（**owner 知情即可，有意保留**）：admin 插一行 share 就能读/改任意主办的活动 payload。
  admin=平台运营（07.yang+ljzhujudy），坏授权/夺行善后要靠它；0027 之前 ym_doc 是 owner-only。

⚠ 环境里没有 postgres server（只有 libpq 客户端 + initdb，无 Docker），**这轮 RLS 没能在真库
empirical 验**（复查 agent 同样卡在这），是静态分析 + 对着真文件核对 + 标准触发器模式。
owner 跑 0027 时末尾 do $$ 自检会验触发器建上没有。客户端 M2 门在浏览器验过（归属见 ✕、
非 admin 共编者账号牌无 ✕、admin 有）。PoC 在 scratchpad/poc.sql。

### 迁移落地状态（2026-08-03 用 PostgREST 探针**实测**，不是听报告）

**最终：0024–0028 全部落地并实测复验。共编这条链服务端＋客户端都齐了，没有待跑迁移。**

0028 跑完复验（2026-08-03）：`ym_host_accounts()` 和 `ym_event_share_sync()` 对 anon
**从 200/P0001 变成 401 42501**，与对照 `ym_code_list()` 一致；
`ym_event_share` 表的 **SELECT 仍是 200**（**故意保留** —— ym_doc 共享策略里那个
`exists` 子查询是以调用者身份读这张表的，收了 select 共编当场就废）。
0028 的自检没有 raise ⇒ **0027 的 H1 夺行触发器 `ym_doc_keys_immutable` 与
`ym_doc_shared_upd` 策略确认在库里** —— 这是探针够不着 pg_trigger、只能靠库内自检回答的一条。

第一次报「applied」时实测**没进去**（下表是当时的证据，留档 —— 说明「跑过了」不等于
「进去了」）；owner 重跑后再测，三个对象都在：
`ym_event_share` 表 **200**、`ym_host_accounts()` **200**、
`ym_event_share_sync(具名参数)` **400 P0001 'not an organizer'**（= 函数存在、且它自己
第一道门对匿名调用者生效）。

🔴 **但这一轮探针又抓到一条**：上面两个函数**匿名就能执行到函数体**（一个回 200、
一个回自己的 P0001），而对照 `ym_code_list()` 回 **401 42501**。根因 ——
**Supabase 对 public schema 配了 default privileges，新建函数自动 grant execute 给 anon**；
`revoke all ... from public` 收的是 PUBLIC 伪角色那份，**收不掉显式授给 anon 的那份**。
0015 的写法（`from public, anon`）是对的，0027 只写了 public。
**没有真泄漏**（host_accounts 的 admin 判定对 null uid 回 0 行；share_sync 第一句就 raise），
但「只授权给 authenticated」这层本该在而不在 —— 两层里少一层。
→ **`0028_ym_share_grants.sql`**：对 anon 收回两个函数的 EXECUTE，自检用
`has_function_privilege` 双向验（anon 不能、authenticated 能），**并顺带确认 0027 的
H1 夺行触发器 `ym_doc_keys_immutable` 真在库里**（探针够不着 pg_trigger，只能在库里问）。
0027 已 apply，**不回头改它**。

<details><summary>第一次报 applied 时的实测证据（留档）</summary>

| | 实测 | 判读 |
|---|---|---|
| `ym_doc`（对照，早就有） | `GET /rest/v1/ym_doc` → **200 []** | 探针本身通，schema cache 正常 |
| `ym_code_list()`（对照，0 参数、对 anon revoke） | **401 / 42501 permission denied** | **存在**的函数长这样 |
| `ym_join_cap_ok(p_host)`（0024） | **401 / 42501** | 0024 在 |
| `ym_host_accounts()`（0027，0 参数、签名正确） | **404 / PGRST202** | **不存在** |
| `ym_event_share_sync(p_host,p_doc,p_members)`（0027，具名参数正确） | **404 / PGRST202** | **不存在** |
| `ym_event_share`（0027 建的表） | **404 / PGRST205**，hint「Perhaps you meant 'public.ym_share'」 | **表没建** |

⚠ **探针的坑，先记下来**：不带参数或参数名写错时，**存在的函数也回 404 PGRST202**
（第一轮我就是这么误判的：拿 `{}` 打 `ym_join_apply` 也 404）。**只有拿对签名、并且和
一个「存在但对 anon 无权」的函数对照，404 才说明「真的没有」** —— `ym_code_list()`
就是那个对照（同样 0 参数、同样 revoke from anon，回 401 而不是 404）。
判据同「gas.ok:true 只说明部署活着」「环境变量有值 ≠ 钥匙有权限」：**探针要能区分
「没有」和「没权限」，否则它只会让你安心。**

当时的处置：`select to_regclass('public.ym_event_share');` 回 null 即没建 → 重跑并盯末尾
`notice: 0027 生效…`（编辑器不一定把整个脚本包成事务，中途报错后面整段就不执行）。
owner 重跑后已解决。

</details>

**复验用的探针**（留着，下次改这块 RPC 之后照打一遍；期望 **401**）：

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  'https://ugkopxmeqsbtjeimultz.supabase.co/rest/v1/rpc/ym_host_accounts' \
  -H 'apikey: <publishable key>' -H 'content-type: application/json' -d '{}'
```

- `0025_ym_join_cap_window.sql`：**远端验不了**（它只是重写 `ym_join_apply` 的函数体，
  外面看不出差别）。owner 报已跑，且它末尾自带 do $$ 自检（0024 不在就会 raise）—— 采信。
- `0026_ym_coadmin.sql`：✅ 已生效（owner 截图里 ljzhujudy 已批准、「管理」tab 已出现）。
⚠ 下一班若继续：**台账/总账仍是 per-account**（共编活动的钱只在归属工作台记）——
owner 要「跨工作台一本账」的话是另一件事（`ym_entry` 的 host 边界要重画），先问。

## 同日第四条：左上角 ym = 回官网首页

owner 点名。主办台 topbar、登录墙、成员页三颗 `ym` logo 都从死 span 换成
`<a href="../" title="回官网首页">`（相对路径，file:// 本地验证和线上都对）。
墙上那颗顺带成了点错门的人「不输密码的退路」。CSS 压掉链接默认样式（brass 不变、无下划线）。
官网首页和手册页的 logo 本来就在家/有自己的返回，没动。

## 同日第三条：成员邀请终于有门了（owner：「主办没有一条像样的路能请人进来」）

发码窗口（grantOpen）一直都在，但三个门全是暗门：登记新人只能去资产库、行上的
「未发码」是死文字、窗口本身藏在资料卡的「账号」按钮后面。现在 用户 页：
- hintbar 写清整条流程（登记 → 发码 → TA 在成员页注册 → 自动绑定）；
- ＋志愿者 / ＋嘉宾 / ＋捐赠人 直接登记（libAddSave 存完自动开发码窗口，07-28 就有的裁决）；
- 行上「未发码」换成「🔑发邀请码」按钮，一按直达发码窗口（stopPropagation，不开资料卡）。
有码的行照旧显示编号；重发/收回仍走资料卡「账号」。

## ② 的第二阶段 —— **owner 已裁（2026-08-03）：暂时只在主办台维护，成员侧不做**

问过 owner「负责人在自己账号里应该能做什么」，三个选项（成员页看到自己的活动+加协办 /
完整跟场 / 暂只主办台），owner 选了**暂时只在主办台维护**。所以第一阶段就是当前的
完整范围 —— 指定/换人/加协办都由 admin（07.yang + ljzhujudy）在主办台操作。
将来若重开成员侧：走 交付/抢单 那套（投影 + definer RPC，别碰 ym_doc 的
「志愿者读写都进不去」），且照例先对抗式复查再上。

---

# ym 交接 — 2026-08-03 深夜（口述改走浏览器；429 的真相是「按模型」不是「没钱」）

## 一、429 的诊断，我错了一轮，记下判据

owner 按话筒 → `HTTP 429 @gemini-2.5-flash-lite {"error":{"code":429,"message":
"Your prepayment credits are depleted."}}`。我按字面读成「账号没钱」，让 owner 去换密钥、
查余额、看账单页 —— **全是白折腾**。真相是 owner 自己发现的：

> **同一个项目、同一把密钥，Rakusalab 的 `gemini-2.5-flash` 一直正常，
> 而 ym 的 `gemini-2.5-flash-lite` 回 429。**

⇒ 这类拒绝是**按模型**算的，不是整个账号。判据留给下一班：**报错信息里的名词
（"credits"、"quota"）不等于故障层级**。同一把钥匙换个模型能过，就说明它不是账号级的。
先穷举同层的候选，再往上归因。

修法（三个端点一致）：`SOFT_FAIL = (404, 429, 402, 403)` 一律**接着试下一个候选模型**；
候选表去掉已下架的 `gemini-2.0-*`（Rakusalab 实测 404），`2.5-flash` 排在 lite 之后第一顺位；
**只有每一个候选都被拒**，才说得出「这是账单问题」那句话。parse 的 Claude 退路挪到最后一环
（先穷举 Gemini 模型，再换厂商）。

## 二、口述改走浏览器的 Web Speech（owner 从 Rakusalab 带回来的做法）

> owner：「in Rakusalab we find a more efficient strategy, we use webvoice for inputing
> and gemini flash for beautification. it is faster.」

老路：`MediaRecorder → base64 → /api/voice → Gemini → 回文字`。慢（录完才上传、上传完才等模型）、
吃额度、而且 Gemini 一被拒口述就整个用不了 —— 08-03 当天就是这样。
新路：**浏览器自己转写**（`SpeechRecognition`），边说边出字，一次 API 都不打。
润色仍然走 `/api/phrase`（✨AI 补写）—— 转写不是模型该干的活，润色才是。

- `SR` 为空（主要是 Firefox）**原样退回老路**，`dicSend` 整段没动 —— 别把人锁死。
- **追加不覆盖**：`base` 是开录那一刻已有的内容，每次 `onresult` 用 `base+定稿+临时段`
  重写，所以说到一半改口屏幕跟着改，而主办打好的字永远不会被冲掉。
- `input` 和 `change` **两个事件都发**：这个 app 里有的格子绑 `onchange`、有的绑 `oninput`，
  少发一个就存不上。
- 失败要说人话：`not-allowed` → 「浏览器没给麦克风权限」；`no-speech` → 「没听到声音」。
- 验证用桩按真实顺序发 `interim → final → end`：中途读到「已经打好的字 王芳到」，
  结束读到「已经打好的字 王芳到位了」，两个事件都到，`/api/voice` **0 次调用**。

✅ **浮动话筒也做完了（同日晚些时候）**：owner 问「is this really done?」—— 当时只做了
「每个文本框旁边那个话筒」，浮动话筒还在走音频，所以他看到的仍然是 429。现在两边都是浏览器转写：
`recStart` → `recStartSR`（边说边把字显示在录音条上）→ 松手把**文字**发给 `/api/voice`
判意图，`audio_b64` 一个字节都不发。服务端 `call_gemini(..., said="")`：给文字就只发文字。
不支持 Web Speech 的浏览器退回 `recStartMR`（老的录音路，整段没动）。
实测：浏览器转出「王芳到了」→ `POST /api/voice {"text":"王芳到了","roster":{...}}`，没有 audio_b64。

⚠ 判据（这条值得记）：**「做完了」要按 owner 会点的那个按钮算，不是按我改过的那个函数算。**
同一个功能有两个入口（文本框旁的话筒 / 浮动话筒），我改了一个就说「done」，
owner 点的恰好是另一个 —— 和「一个功能有两道门，只修一道等于没修」是同一条。

---

# ym 交接 — 2026-08-03 晚（一本欠费的账，差点把三个 AI 功能一起拖死）

owner 在复盘页按话筒，弹出：`HTTP 429 @gemini-2.5-flash-lite { "error": { "code": 429,
"message": "Your prepayment credits are depleted..." } }`，**先换了一把新的 API key，还是同样报错**。

**诊断：这不是密钥问题，是账单问题。** 429 + "prepayment credits are depleted" =
Google AI Studio 那个**项目**的预付额度用光了。同一个项目再签一把新密钥，额度还是 0 ——
所以「换了 key 仍然报错」完全符合预期，不是配错了。（另一半可能性同样要排除：
**Vercel 改了环境变量不 Redeploy，跑着的函数还拿着旧钥匙** —— 这个仓库为
`SUPABASE_SERVICE_KEY` 踩过一模一样的坑。）

**真正吓人的是波及面**：`provider()` 的写法是「只要 `GEMINI_API_KEY` 存在就走 Gemini」，
`ANTHROPIC_API_KEY` 只在 Gemini 密钥**不存在**时才轮得到。于是一本欠费的账同时打死：
票据 OCR · 名单截图 · 报名表识别 · ✨AI 补写 · 语音 —— **而同一个 Vercel 上 Claude 的密钥
好好地放着，一次都没被用过**。

| 改动 | |
|---|---|
| `api/parse.py` · `api/phrase.py` | Gemini 回**硬错**（非 404：429 额度 / 402 欠费 / 403 停用）时，**有 Claude 密钥就改走 Claude**。内部标记 `_retry` 不会漏进回给前端的 payload |
| `api/voice.py` | **没有**这条退路 —— Claude 不收音频。所以只能把话说到位：明说是账单、明说「换同一个项目的新密钥不会有用」、明说去哪儿充值、并告诉主办 OCR 和补写已经自动改用 Claude |
| 三个端点的 GET | 加 `gemini_key_fp` / `claude_key_fp` = **sha256 前 8 位**。改完密钥 Redeploy 之后再打一次，**指纹变了才算真上线**。不用前缀/后四位那种做法 —— 那会泄露真材料 |

验证方式是**真跑**，不是读代码：把 `urllib.request.urlopen` 换成会回 owner 那条 429 的桩，
`call_ai` 实际走完 → 收到 `source: ai-claude` 和解析出来的商店名；把 Claude 密钥拿掉再跑一次 →
诚实退回 mock 且 note 里带着 429。套件 **610 全绿**（新增 4 条钉着退路、单一 `call_ai` 定义、
语音那句话、以及三个端点都报指纹）。

**owner 这边要做的**：给那个 Google 项目充值，或者换一个有额度的项目的密钥 → 更新 Vercel 的
`GEMINI_API_KEY` → **Redeploy** → `curl -s https://www.jjconnect.tokyo/api/voice` 看
`gemini_key_fp` 变了没有。⚠ 只要 `ANTHROPIC_API_KEY` 是好的，**票据 OCR 和 AI 补写现在已经
不受影响了**；只有语音必须等 Gemini 恢复。

---

# ym 交接 — 2026-08-03 下午（复盘相册改成「滚着看」· 删除真的删）

owner 两条：**①「要的是能滚着看的相册，不是缩略图列表」**（08-02 那句「滚着看」我做成了
九宫格 + 点开灯箱，还是列表）；**② 不要指向网盘的链接**；**③「deletion may delete the photo
from drive too」** —— 删除要连云端那份一起删。

- **相册**：整屏一栏、按原比例铺满宽度、直接往下滚（`.mfull/.mroll/.mshot`）。
  灯箱、九宫格、`S.mediaN` 整套状态**都撤了** —— 滚动本身就是浏览方式，少一层状态。
  取图 `sz=w1200`（手机 2~3 倍像素密度下比原来的 400 清楚得多）。电脑上 `max-width:640px`
  居中，不然一张照片能铺满整屏。「在网盘打开」「下载」两个出口撤掉，`driveThumb` 是仅剩的
  取图出口。⚠ **总账里票据那条「在网盘打开」没动** —— 那是另一个功能，owner 没让动。
- **删除**：`mediaDel` 现在**先删云端字节、成功了才摘条目**。反过来的话，删失败就在网盘里
  留下一张谁也够不着的孤儿照片；删不掉时**留着条目并说清楚**（403 / 503 / HTTP 码分开说），
  绝不让屏幕显示「已经没了」而云端还在。

## 🔴 删除能力是 owner 亲自改的口 —— 三道限制缺一不可，别合并、别扩大

2026-07-27 owner 定的是「代理只能上传、不能删除 —— **我不能接受账户风险**」：脚本以网盘
主人的身份跑，`/exec` 对公网开放，一旦有删除能力，拿到 URL 的人就能清空整个网盘。
**那个理由到今天一个字都没过时**，所以今天加回来的不是「删除」，是三道限制同时成立的
**「丢进回收站」**（owner 在两个方案里选了这个）：

| | |
|---|---|
| ① 范围 | `insideRoot()` 顺**父目录链**往上找 `ROOT_FOLDER_ID`，找不到就拒 —— 主办网盘里别的文件夹（合同、家人照片…）一个字节都碰不到。多父目录是广度优先走，深度上限 12 防环 |
| ② 力度 | 只 `setTrashed(true)`。**没有永久删除这条路**，Drive 回收站 30 天可还原 |
| ③ 凭据 | 要密钥：脚本侧 Script Property `SHARED_SECRET`，服务端 `YM_DRIVE_SECRET`。**没配 = 这条路整个不存在**（两侧都 fail closed），上传不受影响 |

外加服务端只放行 **host / admin**：持码成员能上传（他们要交票据），但**不能删主办的照片**。
上传当初不设密钥，是因为「最坏结果只是垃圾文件，可见且可逆」；删除不是那种性质，所以它
单独要密钥。套件里钉着这三道 + 「密钥只从 Script Properties 读、不写死在源码里」。

**⚠ 别把它扩成 `delete_media` / 永久删除 / 删文件夹** —— 那三样都会让上面的取舍重新失效。

## owner 待办（两步，缺一样删除就是 503「还没接线」，上传照旧能用）

1. **Apps Script**：贴入 `docs/apps-script-upload.js` 现在的源码 → Manage deployments →
   铅笔 → **New version** → Deploy；再到 **项目设置 → 脚本属性** 加一条
   `SHARED_SECRET` = 一串够长的随机字符串（自己生成，别用生日）。
2. **Vercel**：`YM_DRIVE_SECRET` = **同一串** → Production + Preview → Redeploy。
3. 验：`curl -s 'https://www.jjconnect.tokyo/api/ym_file?probe=1'` →
   `"trash_key":true`（服务端这半）且 `gas.trash:true` + `gas.rev:"2026-08-03-trash"`（脚本那半）。
   两个都为 true，「删除」才会真的丢进回收站。

---

# ym 交接 — 2026-08-03（登录墙 · 换人闸 · 示例退役 · 上传排队）

owner 手机上撞到的：**点「主办登录」直接进了工作台，邮箱密码都没输**；开一个新标签页
也一样，桌面「看起来正常」只是因为那台机器登着真会话。这不是回归 —— 是测试期一直留着的
「本地优先 + 匿名演示模式」：`render()` 无条件画工作台，登录只管云同步（老注释自己写着
"Test stage"）。成员页从第一天就有登录墙（`!SESSION → loginHtml`），主办台一直没有。
owner 同日两条追加裁决：**示例数据整体退役**（「不再需要，也不要一键清理」）、
**一个活动一个 Drive 目录**（传 2 张照片建出 2 个同名目录）。

## 一、登录墙 + 换人闸（本周要上真人志愿者，这块是重点）

1. `render()` 第一行 `if(!SESSION){$('app').innerHTML=authWall();return;}` —— 无会话时
   工作台/台本/名单/账目**一个字不渲染**。登录/忘记密码从 authSheet 抽屉搬进全页
   `authWall()`（同一道门只剩一份定义）。头像只剩 已开通/等待批准 两态。
   `?cap=` 拍照页在 boot 就分流，照旧免登录（token 即凭据）。
2. `_authReady`：先画「正在打开主办台…」，getSession 回来才决定墙/工作台（已登录的主办
   不该看到登录框闪一下），4 秒看门狗兜底。两处 `render()` 都带 `!$('au_email')` 条件 ——
   看门狗已经画出表单时不重画，否则会**清掉正在输入的密码**（密码框故意不绑 S）。
   ⚠ 代价：**离线且令牌已过期**的主办进不了本机台本；令牌还活着的正常离线不受影响。
3. **`ownerGate()`** —— 退出登录会清本机，但**会话过期不走退出**，旧主办的数据还在
   localStorage。三个入口都过闸：`cloudLoad` + 重设密码那两个分支（它们 return 得比
   cloudLoad 早，`_authKey` 又吞掉随后的 SIGNED_IN，不加就是**一次闸都不过**）。
   - 比的是**开机 latch 的 `_storeOwner`**，不是此刻的 localStorage：两个标签页都停在墙上时，
     B 在 tab2 登录会先把 key 改成 B，tab1 再读就「相同」→ 不重置 → 把 A 的整份 STORE
     合并上传进 B 的云。
   - **没有 key 的旧设备**（线上每一台都还没有）：本机非空就当外人的 —— 否则这道闸对
     现存设备**全员失效**，而墙上就摆着「注册主办方账号」，三下就能拿到会话。
     不直接删：整份挪进 `jjym_orphan`（不渲染、不上传、不合并）并当面说一句。
   - 重置时连**内存缓存**一起清（PROFILE/PENDING/CODES/JOINREQ/ACCEPTED/LEDGER/POSTS/
     ADMIN/capStop/S.rc…）+ `clearTimeout(_pushT)`。`S.rc` 最扎眼：那张票据卡每次 render
     都画，一按保存就把 A 的票据传进 B 的网盘、记进 B 的账。

> 这四条里有三条是**对抗式复查抓出来的**（三视角并行，我自己写的第一版全中）。
> 判据照旧：**同一道门只要有第二条路，就等于没修**。

## 二、示例数据整体退役（owner 2026-08-03）

- `seed()` 返回**空 store**，迁移旗预置。新设备/退出登录/换人闸落地都是空白工作台。
- 拆掉：dtag 徽章（17 处）· 【教学】前缀 · 日历 ◇ · 转为正式活动 · 合并重复的示例 ·
  一键清除 · 媒体库的「示例活动拒收」。**不留任何清理按钮**（owner 原话）。
- **留着** `!e.demo` 那几道**上传/发布**闸当皮带：另一台还开着的老页面仍可能造出 demo 行。

### 🔴 `purgeDemo()` 绝不按 `demo` 标记删资产库 —— 这条差点毁数据，读完再动它

我的第一版是「删掉带 demo 标记的库条目（被台本引用的除外）」。**复查在上线前拦下来了**：
被删掉的那个 y8 迁移是**按名字**盖章的 ——

```js
if(r.demo===undefined && NAMES.res.includes(r.name)) r.demo=true;   // 已删除的 y8
```

而 `NAMES` 里是 **小林 / 王芳 / 张姐 / 场地费 / 饮料点心 / 开场介绍 / 茶歇 / 十对十 标准流程**
这种**沙龙真的会用的名字**。主办自己建的「场地费」、真名就叫王芳的志愿者，全被盖了章；
`libEditSave` 也从不清这个标记，所以**主办改过的种子**同样带章。而且这些章早就随
`cloudPushAll` 存进了**云端的 library**。拿它当删除依据 = 删主办的真数据，还会顺着
`ensureY2()` 末尾的 `save()` 推上云把删除固化。跑真函数验过：一个带手机号的「王芳」、
一条 55,000 円 的「场地费」、整套灵感和模板，全部会消失。

所以现在：**资产库一条都不删，只把这个不可信的标记摘掉**；活动只删「名字就是种子名
（`SEED_EV_NAMES`）且带标记」的那两场 —— 主办改过名的、转过正的都留下。
剩下「资产库里还留着老种子」由主办自己按 ✕ 删（owner 不要一键清理，那就不替他猜）。
**判据**：一个只用于显示的标记，一旦被拿来当删除依据，先去查它当初是**怎么盖上去的**。

- ⚠ 我在删示例块时**顺手切掉了 y7 迁移**（人员→三类登记 + `cat` 回填），套件当场红了两条，
  已还原。教训：按「注释起点 → 下一个函数名」切范围，中间夹着的东西要先数一遍。

## 三、上传排队：一个活动一个目录

✅ **两侧都修好了，并在真域名上验过（2026-08-03 当天）。**

owner 传 2 张照片 → Drive 上两个同名活动目录，各带一个 `照片/`。根子在服务端：
Apps Script 的 `findOrCreate` 是「找不到就建」，并发就各建一个（Drive 允许同名并存）。

- **客户端**（管住「一台设备」）：`upSerial()` 把**所有**上传路径串成一条队（附件多选 ·
  媒体库 · 票据 · 从任务拍），每个请求带 90 秒 `AbortController` 上限。
  ⚠ 附件那条以前是 `forEach` **并行**的 —— 这就是这次的直接原因（媒体库 08-02 已改顺序）。
- **服务端**（管住「多台设备同时传」）：`findOrCreate` 的 `LockService` 锁，
  owner 当天重新部署上线，探针实锤：`"rev":"2026-08-03-lock","lock":true`。

⚠ **探针骗过了我们一次，这条留给下一班**：`?probe=1` 的 `gas.ok:true` 只说明「那条部署活着」，
**不说明是哪一版** —— 全绿的同时线上那份根本没有锁。而且 Apps Script 里**「保存代码」不等于
「换掉 /exec 服务的东西」**：`/exec` 发的是一个冻结的 version，必须
Manage deployments → 铅笔 → **New version** → Deploy（「New deployment」会换 URL，
正是 CLAUDE.md §2 记着的老坑）。所以 `doGet` 现在报 `rev` + `lock` + `kinds`
（同 `/api/ym_file` 的 `"gate":"ym_ok"` 套路）—— **看到 `rev` 才算真的换上了**；改脚本记得抬 `REV`。
分辨「版本没切」还是「Vercel 指着旧 URL」：直接在浏览器打开 `/exec` —— 它报 rev 而探针不报，
就是 `YM_DRIVE_EXEC` 指错了。

已经建出来的那些重复目录**代理删不掉**（无删除能力是 owner 的裁决），要去 Drive 手动合并。

## 四、上真人志愿者之前的一轮专项复查（成员侧 + 服务端边界）

owner：「这周要在线邀请志愿者，最重要的是 auth，不想留任何漏洞。」三个 agent 分头查了
成员注册/自助申请/重设密码、RLS 与 `security definer` 全表、以及「一个持码志愿者能碰到什么」。
**能确认安全的那一大片记在下面「已验证安全」**；修掉的是这几条：

| | 问题 | 修法 |
|---|---|---|
| 🔴 | `/api/ym_file` 的目录名**完全听调用方的**（注释原文：「哪个主办由记录决定，不在这里」）—— 任何持码志愿者都能往**别的主办**的 `<活动·日期>/票据/` 里塞文件，而代理没有删除能力，只能手删；也没有任何配额 | 新增 `member_groups(uid)`：成员只能写进**自己 `ym_share` 里被派到的那几场**，对不上一律落 `未归活动/`。主办/管理员不受限（那本来就是他们自己的树） |
| ⚠ | `GET ?probe=write` **零鉴权**就往主办网盘真写文件 —— 谁都能循环调用堆文件、烧 GAS 配额 | 删掉。08-02 留它是诊断期的明确取舍（「稳定后可以拿掉」），链路当天就绿了，窗口关了 |
| ⚠ | 两个匿名写入口的限流**实际上是关着的**：`x-forwarded-for` 第一段是调用方自己写的，取不到时回空串，而 `ym_auth_gate` 里每条 per-IP 分支都包在 `if coalesce(p_ip,'')<>''` 里 —— 空串把限流整个关掉；per-acct 那几条在这两条路上结构性数不到东西（注册按**码**hash、申请一成功就清零） | `client_ip()` 优先用平台盖的 `x-vercel-forwarded-for`，都读不到时回常量哨兵 `unknown`（宁可把匿名流量算作同一来源，也不要一道都不设） |
| ⚠ | 成员页会话**过期**（不是主动退出）时不清 `MYCODES`，而顶栏那句「我的成员页 · V0014」画在 `!SESSION` 分支**外面** —— 共用手机上，下一个志愿者看得到上一个人的编号 | `MYCODES=null` 补进那条分支 |

**迁移 0024 + 0025**（`0024` owner 已应用 2026-08-03；**`0025` 还要跑一次**）：
① `public_name` 在 **INSERT** 时也钉成空 —— 0020 只钉了 UPDATE，而 `ym_member` 的插入策略是
`user_id = auth.uid()`，任何登录用户都能自带 `public_name:'缘满沙龙'` 插一行；pending 期间不路由，
**一旦被误批准就会静默掐断真沙龙的整条自助申请入口**（0019 §5「两行就都不路由」）。
② 待批上限 50 改成「30 天内」—— 现在的写法是**永久**黑洞：50 个一次性邮箱堵死一个主办的
申请入口后，每个真志愿者都看到「已收到」而主办永远收不到（婉拒不回复，两边都发现不了）。
⚠ **0024 §2 只建了 `ym_join_cap_ok()`，没有接线** —— `ym_join_apply` 里还是老的 `count(*)`。
接线在 **`0025_ym_join_cap_window.sql`**：整段重放 `ym_join_apply`，除上限那两句外与 0019 §5
**逐字一致**（套件里有一条会真去逐行比对两个文件，抄漏一行就红）。0024 原本写的是
「owner 手改 0019 三行」—— 那是个坑：迁移是应用过就不再回头看的东西，手改的那份和仓库里的
从此对不上。0025 末尾带 `do $$` 自检，跑完会 `notice: 0024 + 0025 都已生效`。

**已验证安全（复查的覆盖面，留档）**：邀请码 2^80 熵、`gen_random_uuid()` 取满随机位、
`ym_check_code` 先于建号（错码不会留下 auth.users 行）、`ym_redeem_core` 的 `for update` +
删明文（并发只有一个 'ok'）、码绑定到打字的那个地址、`role='H'` 三层拒绝（RPC + **触发器**，
service_role 绕得过 RLS 但绕不过触发器）、`ym_doc` 志愿者**读写都进不去**、`ym_entry` 没有任何
成员策略、`ym_code_secret` 零策略、抢单的 rank 判定 fail-closed、`member_code` 由触发器覆写
（伪造不了）、自助申请在**所有**分支回同一个 `{ok:true}`（含队列满/重名/无匹配）、
同名一律不路由（`array_agg` + 长度判定，没有「取第一行」）。

## 验过

桩在网络边界（按 Accept 分单行/数组，PostgREST 形状）：匿名（桌面 + 375px）只有登录页，
`#app` 里 0 个工作台元素；忘记密码/回登录；`?cap=` 免登录；`#type=recovery` 带会话 →
设新密码；「已批准 U2 + 本机躺着 U1 数据」→ U1 的标记活动从视图和 localStorage 一起消失、
**零上传**、owner 翻成 U2；**没有 owner key 的旧设备** → 收进 `jjym_orphan`、零上传；
pending → 工作台 + 等待批准照旧。空 store 下 11 个视图逐个渲染（无白屏、无异常）+
新建活动 → 加环节 → 复盘 全通。`purgeDemo` 拿**被污染的标记**跑过真函数：带手机号的王芳、
55,000 円 的场地费、灵感、模板全部留下，只有名字就是种子名的那一场被删。套件 **599 全绿**。

### 复查还修掉的三条（都在「异步」和「排队」上，不是登录逻辑本身）

1. **`cloudLoad` 的挂起续跑会绕过换人闸**：闸只在**进门那一刻**成立，而后面有十来个 await。
   tab1 停在「读 ym_doc」时 B 在 tab2 登录 —— tab1 的闸照常清空本机，可挂起的那一次回来
   仍旧拿 A 的行覆盖 STORE、`save()`、`render()`。现在每次 cloudLoad 领一个号（`_loadSeq`），
   四个 await 之后各问一句「我还是当前那一次吗」，其中最要命的是覆盖 STORE 前那一句。
2. **`ownerGate` 的另一条分支不留底**：收进 `jjym_orphan` 和那句提示原来只写在「没有 key 的
   旧设备」那条路上 —— 而注释里给的理由（「那可能是一份只存在本机的主办草稿」）**恰恰总是**
   发生在另一条：一个还没批准的主办第一次登录就把 key 盖成自己了，他之后所有本地草稿
   （云端一份都没有）会被下一个人一登录无声清光。两条分支现在都先收后清；
   **收不下（配额满）也照样清，但当面说** —— 安全不能取决于「存得下」，静默毁掉才是最坏的。
3. **`upSerial` 没有超时 = 一次卡住锁死全部上传**：半开连接（登录门户/代理握手不回话，
   owner 手机上撞过两次）会让后面所有上传永远排队 —— 附件的 `pending` 减不到 0（不提示），
   `rcConfirm` 的 `_rcBusy` 永久 true，之后每次「确认入账」只回「正在入账，别重复点」，
   只有刷新能解。现在每个上传请求带 90 秒 `AbortController` 上限。顺带：`rcUploadDo` 也
   改成 `await liveToken()`（`ef48749` 给附件修过的那条陈旧令牌 403，排队让窗口更长）。

---

# ym 交接 — 2026-08-02（复盘媒体库）

owner 要的：附件传照片有 400KB 墙、传上了也看不成 —— 复盘要一个能**滚着看**的照片库。
已上线：复盘小结头部「媒体库」按钮 → 浮窗（网格缩略图 · 点开灯箱 · ←→ 翻页 · 下载 ·
在网盘打开 · 上传多选先压 1600px）。**只读回看也能浏览**，上传/移除在只读时隐藏。

边界和 attachTo 同一条底线，但更严：字节走 `/api/ym_file` 进 Drive 的
`<活动 · 日期>/照片/`（`attachUpload` 加了第 4 参 `kind`，服务端本来就放行任意 kind，
**API 零改动**）；payload 只留 `{id,name,driveId,url,ts}`；**Drive 没接线（503）当面拒收**，
不给 data: 退路 —— 新面不背老包袱。「移除」只摘条目，Drive 那份手删（代理没有删除能力）。

⚠ **缩略图有一个 owner 侧的开关**：根目录 `18L2vEdBUukj0qTY4qkNLrYz5Ty7sww3m`
**目前没开链接共享**（匿名 curl 跳登录页，2026-08-02 验的）。所以
`drive.google.com/thumbnail?id=…` 只在浏览器登着有权限的 Google 账号时显示得出来；
显示不出来时格子降级成文件名、露一行提示（登录一次，**或把根目录设为「知道链接的人
可查看」** —— 照片都已打码，owner 拍板即可），「在网盘打开/下载」不受影响。
`driveThumb()/driveDown()` 是仅有的两个取图出口，id 先洗 `[^\w-]`；套件 +6 条钉着这些
（585 全绿）。验证走的「桩在网络边界」：拦 `/api/ym_file` 回真形状的 200/503，
真 File 过 shrink → 上传 → 引用 → localStorage → 重载再渲染，两条路都点过。

**上线当天 owner 连撞两下，都修了（各 +1 条套件，587 全绿）：**
1. 没登录（演示模式）传照片 = 403，而 toast 只说「3 张失败」——owner 第一反应是去查
   网盘授权。401/403 现在单独说「请用主办账号登录后再传」（附件那条也说）。
   「失败全被吞掉」= 忘记密码那次的门 5，又一例。
2. **07.yang（平台管理员）登录后照样 403** —— `caller_ok()` 只抄了 `ym_ok()` 的一半：
   查 approved ym_member 和 ym_code，漏了 `profile.is_admin`（管理员可以**没有**
   ym_member 行，前端 `{status:'none',is_admin:true}` 照样进工作台）。已对齐 0012 §2
   的定义，GET 健康检查加 `"gate":"ym_ok"` 当部署标记。**同一道门两份定义**（canCloud
   / ym_ok / caller_ok）—— 这个月第五次；改任何一份都要去数另外几份。
3. **过了权限还是 0/3，「照片打不开或网络不好」** —— `mediaAdd` 曾「先清 `input.value`、
   后读字节」：iOS WebKit 清空后会作废 File 底层的临时文件，iPhone 上张张解码失败。
   清空已挪到所有 shrink() 启动之后（attachTo 一直是这个顺序）。同一批还把剩余失败
   分层：服务端/网络错带 **HTTP 码进 toast**（「把括号里的码发给管理员」），读不出来
   单独一句 —— owner 只能把 toast 原话发回来，那句话必须自己携带诊断。
4. **一个少写的 ASCII 右括号让整个 app 脚本编译失败**（字符串里的全角「）」骗过眼睛），
   而 589 条正则断言照常全绿 —— 它们只看文本在不在。套件新增：把两个 app 的整段
   `<script>` 用 `new Function` **真编译一遍**（不执行）。修浏览器验证 vs 套件的这个盲区。

✅ **已修复（2026-08-02 当天收尾）：owner 重新部署了 Apps Script（源码含「照片」）并更新
`YM_DRIVE_EXEC` → 探针全绿：`gas.ok:true` + `gas_write.ok:true`（真写入了
`连通性测试/附件/probe.txt`，顺带证明「限制」共享不影响上传，那个测试文件可删）。
新部署头几分钟冷启动会超时，`?probe=1` 的 GET 15 秒预算可能报 timed out —— 多试一次或
直接看 `?probe=write`（25 秒）。下面是当时的诊断，留档。**

🔴 **真正的根子（2026-08-02 探针实锤）：`YM_DRIVE_EXEC` 指着的 Apps Script 部署 404 了。**
`curl 'https://www.jjconnect.tokyo/api/ym_file?probe=1'` →
`{"q_member":200,"q_admin":200,"q_code":200,"gas":{"http":404}}` ——
三条鉴权查询语法全通；GAS 死了。**每一次上传（票据/附件/媒体库）都在 502**，
和这两天改的前端无关。07-27「端到端传过真文件」之后某个时点部署没了
（New deployment 换 URL / 项目被删都会这样）。

**owner 修复步骤（只有你有 script.google.com 权限）：**
1. script.google.com → 找到上传项目（没了就新建），整个贴入 `docs/apps-script-upload.js`
   现在的源码（已含「照片」目录）；
2. Deploy → **Manage deployments** 里若还有活的部署：Edit(铅笔) → New version → Deploy
   （保 URL）；**若列表是空的 → New deployment** → Web app · Execute as **Me** ·
   Who has access **Anyone** → 复制新的 `/exec` URL；
3. 用哪个 Google 账号部署有讲究：**脚本以部署者身份写文件夹** —— 用文件夹
   `18L2vEdBUukj0qTY4qkNLrYz5Ty7sww3m` 的所有者账号最省事（「限制」共享就不碍事）；
   若用别的账号，得把文件夹按**指定账号**共享（编辑权）给它；
4. URL 变了的话：Vercel → jjcashflowdiary → Settings → Environment Variables →
   `YM_DRIVE_EXEC` 换成新 URL（Production+Preview）→ Redeploy；
5. 验收：`?probe=1` 的 `gas` 变成 `{"ok":true,"service":"jjcashflow-upload",…}`；
   `?probe=write` 的 `gas_write` 回 `{"ok":true,…}`（会在 连通性测试/附件/ 留一个
   1 字节 probe.txt，可删）—— 这一步同时就是「脚本账号写得动文件夹」的最终答案。

⚠ 顺带：写探针 `?probe=write` 的暴露面 = 任何人可往 连通性测试/ 塞 1 字节可见小文件，
与 /exec 本身同级；诊断期留着，稳定后可以拿掉。

**链路通了之后 owner 首日实用又撞出三条（全修，598 全绿）：**
1. **「手机传的照片，再次打开就没有了」** —— 同步是整份活动文档后写的赢：手机推完带照片的
   版本，桌面还开着的旧页面任何一次保存（800ms 防抖）就拿没照片的旧文档盖掉云端。
   修法 = **mtime 闸**：save() 给当前活动盖戳，`cloudPushAll` 只推「本机 `_cloudBase`
   （cloudLoad 时刻）之后动过的活动」—— 闲置旧页面从此没资格覆盖。两台设备**同时改
   同一场**仍是后写的赢（真冲突，不裁）。⚠ 被盖掉的那批引用**回不来**，Drive 上文件还在。
2. **3 张并行上传 → Drive 同名目录建出两份**（GAS 各请求同时「找不到就建」，Drive 允许
   同名并存）。媒体库改**逐张顺序传**；`docs/apps-script-upload.js` 的 findOrCreate 加了
   `LockService` 锁 —— **owner 下次更新部署后**多设备并发也不会再建重。重复目录手动合并。
3. **示例活动当面拒收照片**（demo 不入云，传了必丢）+ 顺带修真雷：`instantiate()` 不建
   `participants`，**新活动一进复盘就白屏**（viewReview 不设防 `.filter/.reduce`）。
   目录命名口径没变：四个入口（票据/附件/媒体库/成员票据）统一 `<活动名 · 日期>`，
   日期后缀是「再办一场」同名活动的隔离，别拿掉。

---

# ym 交接 — 2026-07-29（主办方使用手册 + 调顺序不再串位）

三件都已上线并在 **ym.jjconnect.tokyo 真实域名上验过**（不是只验本地）。

| | |
|---|---|
| **使用手册** | `ym/guide/` → `ym.jjconnect.tokyo/guide/`。十节按 owner 给的结构（思路 / 核心界面 / 四阶段流程 / 资产库+人员注册 / 志愿者 / 捐助 / 收支 / 嘉宾 / 公共网页 / 扩展功能），另加 §0 开始之前 + §11 常见问题。30 张截图全部是跑起来的真实界面 + 自带示例数据，手机为主，执行树和总账另出电脑版。**只做主办一册**（owner 定）。第 10 节标「规划中 · 暂未开放」，顺序未定 |
| **入口** | 官网页脚 · 主办台工作台底部 · 主办台头像面板（头像在每一页右上角＝唯一哪儿都点得到的位置）。重设密码那一屏**故意不放** |
| **调顺序不再串位** | 见下 |

## 🔴 调顺序会让台本时间串位（owner 在手机上撞到的）

手填的时刻是**锚点**（`evSchedule` 里 `t!=null` 就重设 `cur`），而 `moveRow` / `rowDragEnd`
搬的是**整行** —— 锚点跟着环节一起走，台本当场读成 …14:10 → **15:10 → 14:40**…。
⚠ 示例台本、以及「再办一场 / 从模板铺」出来的台本**每一行都手填了时刻**（`cpR` 照抄 `time`），
所以一拖必中，而最需要拖的恰恰是**活动当天**。

修法两步，`reorderRows()` 是唯一入口（▲▼ 和拖动共用，套件钉死没有第三条路）：

1. **`rowsAnchorToDur()`** —— 调顺序**前**把多余的锚点换算成时长。换算是**视觉空操作**：
   每行的时长取它到下一行开始的间隔，所以换算完屏幕上一个时刻都没变。
   只在「时刻都读得到、且不倒退」时换算，否则原样不动。
2. **换完位把唯一的锚点交给新的第一行。** 台本从几点开始是「第一格」的属性，不是某个环节的属性。

⚠ **第 2 步是第一版漏掉的** —— 中间行挪对了就以为修完了，真机上把**第一行**往下挪才发现整段
时刻倒退成 14:00 → 13:00 → 13:30。**「一个功能可以有两道门，只修一道等于没修」这条这个月第四次
出现**（忘记密码四道门 · 两个门汇进一个队列 · 成员码新人那一半 · 这次）。判据没变：
修完一层先问「还有没有另一条路走到同一个症状」。

回归：套件新增 5 条 runtime（换算是空操作 / 挪中间行 / 挪第一行不倒退 / 连挪两次不漂 /
倒退台本不碰）+ 1 条静态。**原有那条钉着 `e.rows=next` 的断言把这次改动拦下来过** —— 它是对的，
跟着改成了新写法。

## owner 裁决（2026-07-29）

- **「硬锁某个时段」不做。** 现在的「在某行填时刻」＝当下有效的锚点，**下次调顺序会被换算成时长**
  （时刻不变）。owner 明确说不需要「场地 15:30 才能进，这一段死也不许动」那种永久锁定。
  手册 §3 已经照这个口径写清楚，**别再往回加**。

## 待办

- **「用编号登录」是一句假承诺**：`ym/member/index.html` L237 和 `organizer` 的发码窗口
  （`grantPaint` 的 `a.bound` 分支）都写着「用编号或邮箱登录都行」，但登录框是 `type="email"`，
  输 `V0014` 会被浏览器直接拦下。而 `PLAN-Y7.md` §A3 是 owner 拍板**不做用编码登录**。
  → **owner 已在另一个会话里处理**（2026-07-29）。

---

# ✅ 忘记密码：五道门全开，端到端验过（2026-07-28 收盘）

> **owner 当天逐条确认：收到重设邮件 → 点链接 → 落回 `/organizer/` → 设新密码。整条通了。**
>
> 这个功能从 07-27 起反复回来三次，每次都「修好了」又不работает —— 因为它有**五道**互相
> 独立的门，每一道都能单独让它整条失效，而且**四道的症状一模一样：什么也没发生**。
>
> | 门 | 症状 | 何时修的 |
> |---|---|---|
> | 1. Resend 拒收（发件域没验证） | 信**根本没寄出**，日志里是 403 | 07-28 改 Sender email |
> | 2. Redirect URLs 不在白名单 | GoTrue **静默**换成 Site URL，链接去了别的页 | 07-28 owner 加白名单 |
> | 3. `PASSWORD_RECOVERY` 在 subscribe 之前就发完了 | 点进来直接落进工作台 | 07-28 改成先读 URL |
> | 4. `authSheet` 分支顺序 | `canCloud()`/`SESSION` 排在前面，永远轮不到那一屏 | 07-27 |
> | 5. 失败全被吞掉 | 看不出坏在哪一层 | 07-27 |
>
> **判据留给下一班**：一个功能可以有五层（外部服务 / 配置 / 事件时序 / 渲染分支 / 错误可见性），
> **修完一层就宣布修好，是它反复回来的唯一原因。** 下面是第 1 道门当时的完整诊断，留档。

**2026-07-28，owner 从 resend.com/logs 看到 `POST /emails` 三条 403（11–12 小时前）。**
403 = Resend **拒收**，信压根没寄出。这和刚加好的 Redirect URLs 是**两回事**：
白名单管的是「信里的链接去哪」，403 是「信有没有寄出去」。

**原因（DNS 查出来的，不是猜的）：发件人用了一个没被验证的域。**
已发布的三条记录是 Resend 给**根域 `jjconnect.tokyo`** 的标准套装：

| 记录 | 值 | 是什么 |
|---|---|---|
| `send.jjconnect.tokyo` MX | `feedback-smtp.ap-northeast-1.amazonses.com` | Resend 的**回执路径**子域 |
| `send.jjconnect.tokyo` TXT | `v=spf1 include:amazonses.com ~all` | 同上的 SPF |
| `resend._domainkey.`**`jjconnect.tokyo`** TXT | `p=MIGf…` | **根域**的 DKIM |

而如果被验证的是 `send.jjconnect.tokyo`，该有的 `send.send.jjconnect.tokyo` MX 和
`resend._domainkey.send.jjconnect.tokyo` —— **两条都不存在**（dig 过）。
⇒ 验证的是**根域**；`send.` 只是回执子域，**它本身不是一个能发信的域**。
而 Supabase 的发件人一直写着 `no-reply@send.jjconnect.tokyo` → Resend 403。

**修法（owner，一个字段）：** Supabase → Project Settings → Authentication →
**SMTP Settings** → Sender email → `no-reply@jjconnect.tokyo`（去掉 `send.`）→ Save。
然后走一次忘记密码，Resend 的 log 应当变成 200。

⚠ **顺带纠正本文件下面记着的一条**：「一个域只能有一条 SPF，所以验证根域会顶掉沙龙现有
邮箱」—— 在 Resend 的设计里不成立。根域的 SPF 现在仍然是 onamae 的
（`v=spf1 include:_spf.onamae.ne.jp ~all`，一个字没动），因为 Resend 把自己的 SPF 放在
`send.` 子域上；DKIM 用根域的 `resend._domainkey` 签名，与 From 域对齐，DMARC 走 DKIM 通过。
**从根域发信对现有邮箱没有影响。**

影响面：**只有忘记密码**（两个 app）。注册不受影响 —— `/api/ym_reg` 是用 admin API
`email_confirm:true` 建号的，本来就不发信（这正是它存在的理由），确认邮件 07-22 也已关。

---

# ✅ 已解决（2026-07-28 当天）：Vercel 的 `SUPABASE_SERVICE_KEY` 曾经不是服务密钥

**owner 已经换成 secret key 并 Redeploy，四条链路当场活过来了。** 验收留档：

```
curl -s https://www.jjconnect.tokyo/api/ym_join            → {"ok":true,"auth":true,"svc_role":true}
POST /api/ym_join  {host:"__probe_no_such_host__", …}      → 200 {"ok":true}      （一行都不写）
POST /api/ym_reg   {code:"23456789ABCDEFGH", …}            → 400 {"error":"bad"}  （换钥匙前是 429）
```

`ym_reg` 从 429 变成 400 是关键的那一格：说明限流那道闸过了、`ym_check_code` 真的跑了 ——
**成员用邀请码注册这条路活了**。Drive 上传和用量计量走同一把钥匙，一并恢复。

下面是当时的诊断，留着，因为这一类错还会再来（判据在最后一段）。

---

**2026-07-28 推完当场验线上发现的，比今天所有代码问题都严重，而且不是今天引入的。**

```
POST https://www.jjconnect.tokyo/api/ym_join → 503 {"at":"gate","st":401,"code":"42501"}
POST https://www.jjconnect.tokyo/api/ym_reg  → 同样（这条是**早就在线上**的成员注册入口）
```

`42501 = permission denied for function`。对照实验说明了它是什么：

| 用什么键打 `ym_auth_gate` | 回什么 |
|---|---|
| 公开的 anon 键 | `401 / code 42501 / permission denied for function ym_auth_gate` |
| 一个乱写的键 | `401 / "Invalid API key"`（**没有** code 字段） |
| Vercel 上那个 `SUPABASE_SERVICE_KEY` | **和 anon 键逐字相同** |

⇒ 那个环境变量里放的是一个**有效但不是 service_role** 的键（多半是 `sb_publishable_…`
那个公开键，或者一个已经被停用的旧 anon JWT）。0015 §9 把这些函数**只**授给 service_role，
所以每一次服务密钥 RPC 都是 permission denied。

**这一个变量坏掉，下面四条一起是死的：**

| 面 | 现在的表现 | 用户看到什么 |
|---|---|---|
| `/api/ym_reg` 成员用邀请码注册 | 卡在 `ym_auth_gate` | 「试得太频繁了，请过一会儿再来」—— **等多久都不会好** |
| `/api/ym_join` 自助申请 | 同上 | （已修成诚实的 503） |
| `/api/ym_file` Drive 上传 | `caller_ok()` 用服务键查 `ym_member`/`ym_code`，anon 角色下 RLS 返回 0 行 | 一律 403 —— 票据 / 名单 / 附件**谁都传不上去** |
| `/api/parse` · `/api/voice` · `/api/phrase` 的用量计量 | `usage_event` 只 grant 了 select，插入被吞 | 功能照用，**一条计量都没记到**（「上线后看一周 usage_event」那一周会是 0） |

⚠ `GET /api/ym_file` 回 `{"ok":true,"drive":true,"auth":true}` —— 它只检查**变量存不存在**，
不检查这把钥匙开不开门。这就是为什么没人发现。

**怎么修（当时的步骤，已完成）：**
1. Supabase → Project Settings → **API Keys** → 复制 **secret** 那把（`sb_secret_…`）。
2. Vercel → 项目 → Settings → Environment Variables → `SUPABASE_SERVICE_KEY` → 换成它 → **Redeploy**。
3. 验（一条 GET，什么都不写）：

```bash
curl -s https://www.jjconnect.tokyo/api/ym_join
```

   → **期望 `{"ok":true,"auth":true,"svc_role":true}`**。
   `svc_role:false` 就是还没换对；后面跟的 `st`/`code` 是数据库给的原因。
   然后拿一个真的邀请码在 `/member/` 走一遍注册，再传一张票据试 Drive。

⚠ 顺带一条给下一班的判据：**「环境变量有值」不等于「这把钥匙有权限」。**
`GET /api/ym_file` 一直老老实实回 `{"auth":true}` —— 它只看变量存不存在，
于是三条链路死了没人发现。新的 `GET /api/ym_join` 改成真的去打一次
**只有 service_role 跑得动**的函数（三道闸全空、一行不写），问的是「这把钥匙开不开门」。
今天这条能被找出来，只是因为端点终于肯说「我连不上」而不是「你手太快」。

---

# ym 交接 — 2026-07-28（注册归属到主办）

> owner 报了五条，前四条是**同一条链**的不同症状。`node scripts/check-ym.mjs` → **488 项全绿**，
> 五个屏都在浏览器里点过（375px）。**一件事等 owner：在 Supabase SQL editor 里跑
> `supabase/migrations/0019_ym_join.sql`** —— 没跑之前自助申请进不来，主办的「用户」页会明说。

| owner 的话 | 根因 | 修法 |
|---|---|---|
| ① 登录按钮总是显示为主办 | `ym/index.html` 只有一个 CTA 指向 `/organizer/` | 换成「登录 / 加入」四选一：成员登录 · 我有邀请码 · 想加入 · 主办登录 |
| ② 邀请码指定了志愿者，注册后却成了主办 | 因为 ①，成员落在主办台 → `cloudLoad()` 给任何没有 `ym_member` 行的 session 插一行 pending **主办方** → `redeemInvite()` 打的又是管理员那张 `ym_invite` 表，16 位成员码在那里**永远** invalid | 前端按**形状**分流（成员码 16 位 / 主办码 14 位）：像成员码就只走 `ym_bind_code`，**绑不上也不改道**去申请当主办 |
| ③ 申请要推给对应主办，不是管理员界面 | 全站只有一个审批队列，喂给它的 `ym_member` 只装主办账号 | 0019 的 `ym_join_request`：申请按**主办的公开名称**在服务端路由，落到那个主办的「用户」页 |
| ④ 新注册要回到主办的用户界面 | 主办只看得到一个 `bound` 布尔值 | `ym_code_list()` 加 `bound_at` → 「刚刚注册 · N」+ 行上「新注册」+ 导航角标 |
| ⑤ 用户信息要有与主办的对应关系 | `ym_code.host` 一直都在，但三个显示面都不说 | 资料卡写「归属主办 · 来源（邀请码/自助申请）· 已注册时间」；管理员那屏加「成员账号 — 谁在谁名下」 |

⚠ **07-27 那一班修的正是 ② 的另一半**：当时只认「**已经绑过码**」的人，漏掉的是「**刚拿到码
的新人**」—— 而那恰恰是 owner 实际撞上的那一半。**一个功能可以有两道门，只修一道等于没修**，
这条规矩这个月已经出现三次（忘记密码四道门 · 两个门汇进一个队列 · 这次）。

**已经被错登记的人怎么自救**：`redeemInvite()` 现在也接成员码 —— 在「等待批准」那一屏把
16 位码粘进去，就会绑到发码的主办名下，并**自动撤掉**那行假的 pending 主办申请
（0019 给了「撤回自己还没被批准的申请」这一条 delete policy）。管理员那一屏同时会把这类行
标成「⚠ 这是成员账号 · V0014 · 主办：…」，「批准为主办方」要打「确认」两个字才过。

裁决与出入见 `docs/STAGE_SELF_REG.md` §7（**不提供主办发现渠道**、**婉拒不回复** 两条
合起来是一个无泄露设计，拆开任何一条都会把申请表单变成主办名单枚举器 —— 别"优化"它）。

## 上线当天的对抗式复查（六视角 · 30 个 agent · 每条独立反驳一轮）

15 条确认，去重后 10 条，**全部已修**（其中一条是这一轮自己引进来的真回归）。
留在这里是因为它们是**同一类**错 —— 都在「两个调用点共用一段代码」和「失败路径」上：

| | 问题 | 修法 |
|---|---|---|
| 1 | 🔴 **共用设备上把 A 的码烧到 B 头上**：新的成员码分支漏了「码绑定到打字的那个地址」那道门（同一函数下面 20 行就有一份）。A 粘了码但登录失败（`doSignIn` 在 `signInWithPassword` **之前**就写了 INV_KEY，失败也不清），B 登进来就用 **B 的 session** 兑掉了 A 的码 —— `ym_redeem_core` 只认 `auth.uid()`，凭证上根本没有地址列 | 新分支复用同一个 email 判断；`doSignIn` 补 `else clearPendingCode()` |
| 2 | 🔴 **`public_name` 是路由键，却谁都能占**：任何已批准主办改自己那一行就能把别人对外报的名字占过来 → 对方的申请连邮箱带留言整份落进占名者的待批列表（跨租户误投），或者「同名都不路由」让两边一起静默归零 | `0020`：钉进触发器 + 唯一入口 `ym_set_public_name()`，撞名拒绝**这次写**。**不加唯一索引**（那才是目录查询），也**不改** owner 裁过的「同名都不路由」 |
| 3 | 成员码**打错一位**（O/0、I/1 恰好不在字母表里）就重新掉回「申请当主办」那条队列，而管理员那道 ⚠ 按「名下已有 ym_code」筛，新人 0 行，正好盖不住这一半 | 像一串邀请码就停下，让人自己确认「我其实是主办方」才允许排队 |
| 4 | `memberOnly('bound')` **无条件**删掉自己的 pending 行 —— 正经排队的主办申请人在等待屏粘一次成员码，那份真申请就没了，而且再也建不回来 | `memberOnly(why, withdraw)`，只有 `cloudLoad` 那个自动入口传 true |
| 5 | `joinApprove` 把「服务端拒绝」和「服务端做了但我没收到」当成一件事，无条件撤回名册记录 —— 而 CODES 按 ref_id 索引，记录一没，「重发邀请码」这个唯一入口就进不去：一串只显示一次的明文码从此没有任何界面到得了 | 只在服务端**明确答复**时回滚；传输失败保留记录，重读后按 `codeOf(rec)` 判断码到底铸出来没有 |
| 6 | `await cloudPushAll()` 是**假 await**（既不是 async 也不 return），而且 `pushShares()` 跑在 `loadCodes()` 之前 → 新人整个被跳过，`ym_share` 一行不写 → 对方注册成功后看到「或者已经收回了这个页面的权限」 | `cloudPushAll` 返回 Promise；次序改成 `loadCodes → cloudPushAll`（和 `codeIssue` 一致） |
| 7 | `ym_bind_code` 的 error 被丢掉 → 网络抖一下就告诉人「你的码已经用过或过期」，而那句话会让人去找主办**重发**，一重发 `ym_reissue_code` 覆盖 `ym_code_secret`，手上那串本来好好的码当场作废 | 传输失败单独一屏「先别去找主办重发」+ 再试一次 |
| 8 | `doApply` 一失败就清空四个输入框 —— 包括**必须一字不差手打、全站又不给任何提示**的主办名字 | 四个值存进 `APPLY` 并回写 value |
| 9 | 「打开 TA 的资料」顺手把**整批**新注册标成已读，第二个人从三个提示面同时消失且永远回不来 | 已读改成「时间戳 + 逐个编号」，整批已读留给「知道了」 |
| 10 | 婉拒写的备注落库了但全站没有任何界面读它；已处理的申请一条都不显示（`ym_join_one_pending` 是部分唯一索引，被拒的人第二天能再投一条干净的） | 「已处理 · N」可折叠区 + 待批行上标「⚠ 你以前婉拒过这个邮箱」 |

⚠ 第 2 条有一个**要 owner 拍板的取舍**：撞名时拒绝这次写，对一个**已批准的主办**来说仍然是
一比特（「这个名字有人用了」）。这是内部信道（要先当上主办，而主办由管理员发码），
它换掉的是「谁都能零痕迹占谁的名字」。owner 的裁决（STAGE_SELF_REG §6）说的是
**不给公众发现渠道**，没覆盖主办之间撞名 —— 在你改口之前，宁可少一个跨租户误投。

## 记一张票据：电脑上现在可以「手机拍」了（2026-07-28）

owner：「电脑上那个按钮只是选一张照片，很难用。」——票在手里，相机在手机上。
**复用 `0005_capture.sql` 已经建好的那条通道**（jjcashflow 客户端在用的同一条），
ym 这边**一行 SQL 都没加**，因为它跟 cashflow 没有耦合：`capture_session.owner = auth.uid()`，
`p_draft` 是**不透明 jsonb**，所以 ym 直接把 `/api/parse` 的原始结果塞进去，电脑那边
再喂给已有的 `rcSeed`/`rcCard` —— 那张逐格确认卡一个字没改。

工作台 →「手机拍」→ 二维码 → 手机扫（**不用登录**，token 就是凭据）→ 拍 → 解析 →
自动传回电脑，弹出确认卡。一次只允许一张未认领的（服务端 `cap_submit` 就拒，客户端再挡一道），
10 分钟过期，OCR 用量由 `cap_claim` 在**服务端**记一次 —— 手机侧匿名、伪造不了。

⚠ 因此套件那条「每个 `/api/parse` 调用点都带 `user_token`」改成了
**「带 token，或者走 `cap_submit` 那条会被服务端计量的路」**。

## 🔴 套件自己坏了很久：`stripComments` 一直在吃真代码

同一天发现的，比上面任何一条都值得记：`scripts/check-ym.mjs` 的 `stripComments`
以前是两行正则，而它在 `ym/organizer/index.html` 上**删掉了 79,882 个字符**，真注释只有一小半。

两个洞：
1. `accept="image(斜杠)(星)…"` 这种属性里的「斜杠+星」会开启一段**假块注释**，一路吃到
   下一个结束标记 —— 五处这样的洞吞掉 53KB，其中包含**两个** `/api/parse` 调用点；
2. 用「双斜杠到行尾」剥行注释，会把任何含 `https:(双斜杠)` 的行从那里截断。

**后果不是断言挂掉，恰恰相反**：所有**负向**断言（「这东西不许存在」）都会**假通过** ——
文本根本不在了，不是因为代码对了。规矩 9 说「关于顺序/缺席/旧表达式的断言一律先剥注释」，
但从来没人问过**那个剥注释的函数本身对不对**。

已改成按引号状态扫描（只认代码位置上的注释），并加了一节**自检**：
剥前剥后 `api/parse'`、`accept="image/*"`、`rpc('ym_` 的出现次数必须**相等**。
改完全套 523 项仍然全绿 —— 也就是说被吃掉的那 53KB 里没有藏着违规，但那是运气，不是保证。

## 收尾复查（八视角）：9 条，最重的一条让整套防重复计账在客户端全线失效

⚠ **这一条戳穿的是「我怎么验证」，值得单独记：**

> `loadLedger()` 是**显式列清单**，我加了 `payer_ref` 却没加进那份清单 ——
> 于是 `feeOf()/feePaidIds()` 读到的永远是 `undefined`，0022 那套「逐笔记过的人不进门票
> 汇总」**一个人都认不出来**，报名费和门票汇总会同时入账。
> 而我当天的浏览器验证**是过的** —— 因为我手工塞了带 `payer_ref` 的假行，**没走真正的
> `loadLedger`**。规矩 2 说「浏览器里点一下」，但这次证明还不够：
> **拿假数据喂进管道中段，验的是你以为的管道，不是真的那一条。**
> 现在的做法：桩掉网络层，**按 app 真的 `select` 的列裁剪返回行**（PostgREST 就是这么行为的）。
> 列清单是一道**会静默失效**的门，套件里补了断言。

其余八条（都已修，细节看 `git show`）：
| | |
|---|---|
| 0023 | `ym_entry_one_fee` 没排除 `status='void'` —— 而 app 自己教主办「去总账取消那条重记」。取消后「收款」回来了，一点却撞 23505 说「已经记过了」，屏幕上一条都没有；0017 没有 delete policy，这一格**永久占住** |
| 删人 | 删掉一个交过钱的人 → fee 行留在账上，再加回来是**新 id** → 第二笔干净插入，或者他重新落进 `arrUnpaid` 被门票按人头算一遍。同一笔钱两次。现在先问 |
| 孤儿行 | `payer_ref` 已不在名单里的行**扣不掉任何人**，却被默默计进「已收 N 人」—— 那三处「已扣掉 N 人」的文案在说谎 |
| 税 | `feeAdd`/`confirmTickets` 用 `amt/1.1` 反推 10% 内訳。内部証憑没有票面，那是**捏造**，而且进的是税理士当事实读的列。改成 `tax:[]`、`tax_total:0` |
| 三态 | 「总账没读到」被画成「一个人都没交」，照着假象再记一笔就撞唯一索引 |
| 连着拍 | 认领一张就 `capClose()` 把会话删了 —— 两边文案承诺的「可以连着拍」是条死路，手机第二张只看到一句日文报错 |
| 关窗 | ✕ 关二维码 = 无条件删会话，连手机刚传回、轮询正因 `S.rc` 暂停而没认领的那一张一起没了 |
| PDF | 手机侧**明确支持 PDF**，电脑侧白名单只认 `data:image` → 静默丢掉，账记下了**証憑一个字节没留**，屏幕还说「原图已存进网盘」 |
| 退出 | `doSignOut` 不清 `S.memberOnly` —— 而那个分支排在登录表单**前面**：成员在共用设备上退出后，下一个人**再也点不到登录表单**，只能刷新 |

⚠ 复查跑到一半撞上会话额度（25/47），**反驳阶段还有约 20 条没验完**。没验的一律没动 ——
下一班可以从 `subagents/workflows/wf_be0522f3-5ea/journal.jsonl` 捡起来接着验。

两条给下一班的小东西：
- **规矩 9 现在也适用于 SQL**：套件里新增 `stripSql()` —— `stripComments()` 只认 JS 的 `//`，
  SQL 的 `--` 一个字都没剥。这一轮第一次踩到（注释里写着它承诺不调用的 `min(m.user_id)`）。
- **`min(uuid)` 在 PG 18 之前不存在**。写了不会在应用迁移时报错，会在**第一次真调用**时炸 ——
  而调用方是那个无鉴权端点，炸在那里没人看得见。0019 §5 改用 `array_agg`，
  文件末尾那段 `do $$ … $$` 会在应用时把它真跑一遍。

---

# ym 交接 — 2026-07-27 收盘（第二班）

Y8 总账拼完并**已上线**；**0018 owner 已应用**。之后按 owner 当天的一连串要求改了资产库、
报名/邀请、台本时刻表、语音输入、税务口径，最后跑了两轮复查（六视角对抗式 + 逐功能可达性），
一共修掉 12 个真问题 —— 其中 8 个会进到税理士文件里，4 个是「上线了但看不见」。
`node scripts/check-ym.mjs` → **438 项全绿**。工作区干净，两个仓库都已推送，线上已验。

## 这一班后半程做了什么（都已上线）
| | |
|---|---|
| 资产库 | 物资分 消耗品/可存续品（消耗品才有 类别·保存期限·价值·已使用）· 灵感分四类 · 新建改成完整录入（类别全下拉）· 左侧面板每条可删且能直接新建 · 模板删除要照抄名字 |
| 示例翻倍 | **每个浏览器各自 seed()，id 不同** → mergeLibrary 只按 id 合并 → 每多一台设备多一整套（owner 库里 181 项）。已双向修：合并时跳过同名示例 + 「合并重复的示例」按钮（会把台本牌子的 refId 改指到留下的那条） |
| 票据 | 主办台拍的票据当面问「这笔算在哪」；「共通」全部改叫「一般费用」 |
| 账号 | 主办终于有 忘记密码 / 修改密码（PASSWORD_RECOVERY 必须挡在 cloudLoad 前面） |
| 工作台 | 当天/复盘 移到活动卡上；卡右上角显示 报名 15/30（活动新增「名额」字段） |
| 报名 | 参加者从计划页拿掉 → **`viewSignup` 独立一页**（工作台活动卡上的「报名」胶囊 / 右上角 N/名额 徽章都能进），分「已报名 / 拟邀请」；执行看板里也有一份 |
| 邀请 | 拟邀请**不算报名**。有账号的嘉宾在自己页面看到「主办方邀请你参加」，**TA 按了「我想参加」才算**；主办确认后自动从拟邀请挪进已报名。没账号的人口头答应了用「代为确认」 |
| 台本 | 每个环节有**时长**，时刻从活动开始时间级联下来，可**拖动排序**（pointer 事件，不是 draggable），顶部显示预计结束；当天同样可改时长 |
| 语音 | 每个窗口的文本框旁边一个话筒（/api/voice 新增 `mode:'dictate'`，只转写不判断意图） |
| 税务 | 见下面「税务：已经定了」—— 整套消費税判定删除，按含税记 |

⚠ **owner 截图里的「第 1 条」**：是关于重新发放注册码的，owner 说有了忘记密码就不需要了 —— **已关闭**。

---

## 环境（都已配好，不用再动）

| | 状态 |
|---|---|
| 迁移 | **0017–0021 全部已应用**（0019/0020/0021 是 owner 2026-07-28 当天应用的）。0019 = 自助申请 + `public_name` + `bound_at`，0020 = public_name 归属仲裁，0021 = 撞名改成「提醒不拦」+ `ym_name_shared()` |
| SMTP | Resend，验证域 `send.jjconnect.tokyo`，发件人 `no-reply@send.jjconnect.tokyo` |
| **Redirect URLs** | ⚠ **owner 待办**：Supabase → Authentication → URL Configuration → Redirect URLs 里必须**逐字**有 `https://ym.jjconnect.tokyo/organizer/` 和 `https://ym.jjconnect.tokyo/member/`。不在白名单里，GoTrue 会**静默**换成 Site URL —— 重设密码的信点开去了别的页面，表现就是「忘记密码没用」。成员页那条 07-14 加过；**主办页是 07-27 新加的功能，很可能从没进过白名单** |
| Drive | `YM_DRIVE_EXEC` 已配，`/api/ym_file` 回 `{"drive":true}`，端到端传过真文件 |
| Drive 目录 | `18L2vEdBUukj0qTY4qkNLrYz5Ty7sww3m/<活动 · 日期>/<票据｜报名表｜名单｜附件>/` |

Apps Script：**只能上传**，没有密钥、没有删除（owner：「我不能接受账户风险」）。错拍的票据手动去 Drive 删。

---

## 迁移（已完成，留档）

### ~~1. 先在 Supabase SQL editor 跑 `supabase/migrations/0018_ym_entry_cap_fix.sql`~~ ✅ owner 已应用
0017 §5 的 `ym_entry_cap()` 里写着 `sum(length(coalesce(image,'')))`，而 `image` 这一列在改成
存 Drive 之后**根本不存在**。plpgsql 是执行时才解析列名的，所以 0017 应用得干干净净，
**但第一次「确认入账」会 42703 回滚** —— 功能在第一张票据上就死了，而且手机上只看得到一句
PostgREST 的乱码。0018 就是修这个（日流量上限改成只数行数：图片已经不在这张表里了）。

跑完顺手验三件（0017 的 buildOrder 也这么要求）：
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'ym_submit'::regclass and conname like '%kind%';   -- 'give' 在不在
select grantee, privilege_type from information_schema.role_table_grants
 where table_name = 'ym_entry';                                       -- 授权在不在
insert into ym_entry(host,entry_date,direction,amount) values (auth.uid(),'2026-07-27','out',1)
  returning voucher_no;    -- 期望 R-2026-0001；删不掉（没有 delete policy），改成 void 才是正路
```

### 2. push = 自动部署 —— ⚠ **家搬了（2026-08-07，owner 裁定）**
**ym 的源码之家现在就是本仓库（`07yang-creator/ym`，本地 `~/Documents/GitHub/ym`）。**
owner 裁定「ym 和 JJcashflow 记账日记是两个产品，不许混」—— 8-06 的白屏事故正是混居的代价：
一个「JJcashflow 清演示数据」的提交删掉了 ym 的 style 闭合标签，还搭别人的 subtree push 上了线。
- **改这里 → `git push origin main` → Vercel 自动部署 ym.jjconnect.tokyo。就这一步，没有 subtree 了。**
- 旧 monorepo（JJcashflow）里的 `ym/` 已删除；**别再往那边写 ym 代码**，也永远不要再跑
  subtree split —— 它现在推上去的会是「整棵树被删掉」。
- **还留在 JJcashflow 仓库的两样（分离 S3/S4 未做）**：`api/*.py`（parse 的 ym_form/roster_shot
  模式、ym_reg/ym_join/ym_file/phrase —— 前端照旧打 `www.jjconnect.tokyo/api/*`）和
  `supabase/migrations/*_ym*.sql`（数据库还和记账共用一个 Supabase 项目）。改它们要去那个仓库，
  **单独成 commit、别和记账侧同车**。
- `node scripts/check-ym.mjs` 在**本仓库根**跑；它的三层检查（页面＋api＋迁移）会自动去**并排的**
  `~/Documents/GitHub/JJcashflow` 读 api 和 migrations —— 两个仓库必须并排放着，找不到会大声报错
  而不是静默跳过。

### 2.5 照片的下一件事（RULING 2026-08-07 · owner 原话记录）
owner：「a volunteer or host are supposed to see photos because it is who uploaded photos」；
「Guest would not have access to working desk and plan」（嘉宾不做）。
**API 侧已经改完**（JJcashflow 仓 api/ym_file.py，套件四条锁已随之重钉）：
- `read_media` / `list_media` 从 host/admin 放宽到 **host/admin/member**；member 的范围在
  `_group_gate` 的 member 分支里用 **ym_share（member_groups）** 收窄 =「被派到的那几场」，
  名单读不到 fail closed。403 的 reason 对 member 是 `no_assignments` / `not_assigned`。
- `trash_media` **没有**放宽（志愿者不能删主办的照片）。upload 一切照旧。
**这边（ym 仓）剩的活：成员端相册**。member/index.html 目前没有任何照片界面 —— 用和主办台
mediaReadDo 同款的「POST /api/ym_file(list_media→read_media) → blob: → <img>」，按成员自己的
ym_share 任务列他被派到的活动。另外顺手验一件事：ljzhujudy 在**共编**活动上能不能看到照片
（host_groups 的 0027 那半 —— 如果不能，是数据里没 share 行，不是闸的错）。
**没有任何一步需要 owner 动 GAS 或 Drive** —— read/list 早已部署，这次只动了鉴权层。

**追記（同日 10:5x · RULING「use subfolder ID to prevent future confusing」已实施）：**
目录口径升到 v2 = `<名字 · 日期 · #id6>`（evGroup 一处生成；票据那条内联拼法已并进 evGroup）。
服务端（JJcashflow 仓 api/ym_file.py）新旧两种口径**都收**：旧页面不断，新页面新目录，
同名同日从此各住各的目录，撞名 409 对 v2 目录构造上不可能。read_media 带旧目录回落
（剥 #id 再过同一把闸 —— 改口径**之前**已附在活动上的老照片继续显示；admin 永远可见，
host 只在旧目录不跨账号共享时可见）。**这边剩下的活**：
① list_media（找回面板）还没有旧目录回落 —— 老目录里的散照片暂时只有 admin 找得回；
② ym_share 的 jobs 还是旧口径（成员上传范围/未来成员相册要跟 v2，得在派任务时把 event id
   写进 job，member_groups 再学 grp2）；
③ ~~跨账号的老副本行清理~~ **撤回（同日晚 · owner 的 SQL 实测推翻了前提）**：
   那些「副本」是**同一 doc_id 每账号一行** —— 这就是同看同编的实现本身，不是垃圾，
   **一行都不要删**（删 = 拆掉那个账号的共享）。撞名闸已按此改口径（group_owners 数
   **distinct doc_id**，不再数账号）：共编的同一场放行，同名底下藏着**另一场**才 409。
   老目录因此对 host 直接解锁，无需任何数据清理。
④ 照片读取偏慢（owner 实测「能看了，就是有点慢」）：一张图 = 浏览器→Vercel→GAS→Drive
   两层代理串行 + base64 膨胀；**老照片**再乘 2（v2 目录先问一次 → 'not in group' → 剥 #id
   再问旧目录）。客户端只有会话内 driveId→blob 的 Map，刷新就全部重取。
   下一步（这边的活）：IndexedDB 按 file_id 存 blob 的持久缓存（字节永不变，缓存永不失效
   —— 换图就换 id），首屏只取视口内的图。新照片天生单跳，不吃回落的那一倍。
### 3. owner 还没走过的真机验收（375px，按这个顺序）
- **主办台（不挂活动）** → 「记一张票据」→ **卡上当面问「这笔算在哪」** → 选一般费用 → 入账 → 去总账。
  *这一个入口在三份设计里有两份是静默失效的*，所以先走它。
- **计划 → 收支条「票据」** → 选一条预算 → 确认入账 → 牌子上出现 `📎1`，实际额＝票面。
- **复盘 → 补一张票据** → 下面「对账」应显示 ✓ 一致。
- **执行 → 点任务 → 票据**（凭证行会挂在这件事下面）。
- **志愿者交的票据** → 待确认里点「入账」；**再找一个在「交任务」里填了自费的人重走一遍**，
  确认卡片自动选中「志愿者自付」，按「只确认，不入账」写 **0** 行台账。
- **门票** → 日看板「确认入账」→ 总账里出现一条 `売上高(参加費)`；**再签到一个人、再确认一次，
  那一条应该是被 UPDATE 掉，而不是多出一条**。
- **捐赠者**（`D` 账号）→ 公开活动页上传票据 → 主办在计划页的「捐赠票据待入账」里入账 →
  捐赠者自己那行变成「✓ 主办方已收讫入账」。

---

## 税务：已经定了 —— 不做判断

**owner 2026-07-27：「按含税来记，税务问题交给税理士思考。」** 这条已经落地，别再往回加。

`amount` 永远是**税込**，那一列是权威。整套消費税判定（課税/免税开关 · 非適格 · 経過措置 ·
少額特例 · 税区分）**全部删除**，`taxMode`/`needsReg`/`keigen` 已经不存在。

⚠ 最关键的一点，别退回去：**不做判断就不能编数据**。`rcTax` 以前在读不到明细时按「内税 10%」
组装一份 —— 8% 軽減税率和 非課税 都会被塞成 10%，那是捏造，而且进的是税理士当事实读的列。
现在只留票面上真读到、且与合计相符的明细，**读不到就空着**；改过金额的那张也直接丢掉旧明细。
CSV 的税区分列留空，页脚写明「金额全部税込 · 课否判定未记载 · 税率栏空的行没有推计」。

---

## 待观察 / 未做

- ~~**主办注册的输入框被刷新冲掉**~~ ✅ 已修（2026-07-27）。留档，因为它是「定时器重绘冲掉
  正在输入的东西」这一类的样板 —— 同一类后来又出现过两次（loadPending 的 60 秒轮询、
  doApply 失败后 render 清空表单）。原文：
  owner 报「注册码没输完就被刷新掉了」。
  不是码过期。`startPoll` 在「等待批准」那一屏**每 15 秒跑一次完整 cloudLoad + render()**，
  而那一屏恰恰就是要粘邀请码的那一屏，两个输入框当时**一个 value 绑定都没有** ——
  连值带光标一起没了。已修：轮询改成只查状态、变了才重绘；码和邮箱存进 `S`（`oninput`，
  不是 `onchange` —— 后者要失焦才触发）。之前把有效期从 30 分钟改成 7 天是**修错了地方**，
  不过那个改动本身无害，留着。
- ~~**自助注册**~~ ✅ **2026-07-28 已上线**（0019–0021 + `api/ym_join.py` + 成员页申请屏 +
  主办「用户」页的待批列表）。裁决里那两条最容易被后人"优化"掉的仍然生效，别碰：
  **不提供主办发现渠道**（neither）、**婉拒不回复**（No response is perfect Japanese style）——
  合起来是一个无泄露设计，拆开任何一条都会把注册表单变成主办名单枚举器。见
  `docs/STAGE_SELF_REG.md` §6 拍板表 + §7 落地记录。
- ~~**`attachTo()` 是硬约束 1 的活违规**~~ ✅ **2026-07-29 已修**（和 0025 同一次）。字节一律经
  `/api/ym_file` 进主办自己的 Drive，`payload` 里只留引用 —— **不再往那个面里加新字节**。
  顺带填掉一个更难看的洞：以前 >400KB 的附件**只存文件名**，主办永远点不开（那两句
  「待接入云盘后可打开」就是它）；现在上限 4MB，且真能打开。Drive 没接线（503）时原样退回
  老行为，那是老路唯一还需要存在的理由。套件里三条钉着它。
  ⚠ **仍然没有给 `ym_doc.payload` 加体积 CHECK，那条还欠着**：加之前必须先做数据审计 ——
  现有 payload 可能已经超过任何将要设的上限，那时 CHECK 会让 owner 下一次保存直接 500。
  这次只做了「不再变大」，**没有**让存量变小。存量收缩要另做一次（把老 data URL 迁进 Drive）。
- **OCR 计量已经补齐**：`rcParse`（票据）· `rosterShot`（名单截图，之前就带着）· `formPhoto`
  （报名表，这次补的）三处都带 `user_token` 了 —— 在这之前 ym 的 OCR **一次都没被计量过**。
  上线后看一周 `usage_event`，这周的数才是全的。套件里有一条会数「每一个 /api/parse 调用点
  都带 user_token」，再加新的调用点会被挡下来。
- **PDF 走 Gemini 那条路没有 schema**（`api/parse.py` 一个字没改，这是有意的）。PDF 请求书会诚实地
  退化成 mock → 空白卡 → 手填。真要修是两行：`media_type=='application/pdf'` 一律走 `call_claude`。
- **赤伝没有做**：取消是 `status='void'` + 必填理由，行留着。等这个沙龙真的用这套账报过一次税，
  再换成「反向分录」（0017 NOT-5 写了怎么换）。
- **`fy` 用的是日历年**（個人事業主 12/31 结算）。将来法人化、3 月决算的话，改一行，但已有的行
  留着旧 `fy`，証憑番号会断号 —— 要在法人化之前决定。

---

## 对抗式复查修掉的 8 条（2026-07-27，留给下一班当模式看）

六个视角（钱的正确性 / DB·RLS / 注入 / 静默死路 / 组合 bug / 失败路径）复查了刚上线的 Y8。
每一条都是**已经上线**的代码，都能对着源码验出来 —— 记在这里是因为它们是**同一类**错：

1. **`(l.b||0)+(l.t||0)||r.amount`** —— 一个 0 円 的税率桶掉进 `||`，仕訳 CSV 里出现两条全额。
   *兜底值放在会被 0 触发的位置上，就是一颗定时炸弹。*
2. **导出用的是屏幕上的筛选结果** —— 点了「要核对」再导出，帳簿静默少行。
   *「范围」和「放大镜」是两回事，导出只该跟前者走。*
3. **改了金额，税额内訳还是旧的** —— 税抜+税額 和 税込 对不上，那一行不能报税。
4. **捐赠被立了 10% 消費税** —— 寄付は不課税。
5. **双击「确认入账」= 两笔真账**（主办自己的账没有唯一索引兜底）。
6. **从任务拍的票据丢掉它挂的那件事** —— 任务 chip 不在收支牌 select 里，值变成空。
7. **`LEDGER=LEDGER||[]`** —— `[]` 是真值，一次网络抖动就让总账整场 ¥0、CSV 导出空表，
   而屏幕上写的是「还没有记录」。*区分「没有」和「没读到」，永远值得多一个变量。*
8. **先点「确认完成」，那张票据就再也入不了账** —— file 行被一起标 accepted，
   离开 PENDING 之后「入账」按钮就没了。*两个动词两个按钮，别让一个动作顺手关掉另一个的门。*

## 可达性复查（2026-07-27，19 个 agent 逐个功能追点击路径）

owner 说「有些界面没有更新」。**代码全在线上，问题是入口。** 这一轮的四条，都是
「上线了但看不见 = 等于没上线」这一类：

1. **忘记密码那封信点进来是死路。** `authSheet` 的分支顺序是
   `canCloud()` → `SESSION` → … → `S.authRecovery`，而重设链接回来时**一定**已经有 session
   （supabase-js 先建 recovery 会话再发事件），已批准的账号还让 `canCloud()` 为真 ——
   于是永远轮不到那一屏。⚠ **我在 onAuthStateChange 里挡住了 cloudLoad，以为修完了；
   渲染分支的顺序是另一道门。** 一个功能可以有两道门，只修一道等于没修。
2. **嘉宾能给上周的活动报名**（可报名只看 `publicOn`，不看阶段）。
3. **「待确认的报名」空着时 `return ''`** —— 而它空着的时候，恰恰是主办在找
   「为什么没反应」的时候。空白 = 没做。现在空着也露一行，并且**说清楚差哪一步**。
4. **「捐赠票据」同上**（只在名册里真有捐赠人时才提）。

**留给下一班的判据：写完一个功能，问的不是「代码在不在」，而是
「在 owner **现在这个数据状态**下，从打开 app 开始，几下能点到它？」** ——
没有路径、或者没数据时整块不画，都算没做完。特别注意 `if(!rows.length)return ''`
这种写法：数据为空正是最需要解释的时刻。

## 忘记密码：一条链路上四道门（2026-07-28）

owner 报「忘记密码好像不работает」。这条值得单独记，因为它是**同一个功能连续三次只修一道门**：

| 门 | 症状 | 状态 |
|---|---|---|
| 1. `redirectTo` 不在 Supabase 的 Redirect URLs 白名单 | GoTrue **静默**换成 Site URL，信里的链接去了别的页面 | ⚠ **只有 owner 能开**，见上面「环境」表 |
| 2. `PASSWORD_RECOVERY` 事件在 subscribe 之前就发完了 | supabase-js 一 createClient 就异步吃掉 `#token` 并清空地址栏；`authInit()` 在脚本末尾才订阅 | ✅ 改成在 createClient **之前**读 URL，不依赖事件 |
| 3. `authSheet` 分支顺序 | `canCloud()`/`SESSION` 排在 `S.authRecovery` 前面，而重设链接回来时**一定**有 session | ✅ 07-27 修 |
| 4. 失败全被吞掉 | `resetPasswordForEmail` 的返回值看都不看；过期链接的 `error_description` 也不读 | ✅ 都说出来了 |

⚠ **教训**：`onAuthStateChange` 里挡住 `cloudLoad` 只是**其中一道**。一个功能可以有
「配置 / 事件时序 / 渲染分支 / 错误可见性」四层，每一层都能单独让它整条失效。
修完一层就宣布修好，是这个功能反复回来的原因。
另外：**一封永远收不到的信和一个不存在的账号，从外面看一模一样** —— 所以传输层错误
必须说出来（GoTrue 对未知邮箱本来就回 200，说了不泄露），否则永远查不出是哪一层坏了。

## 手机传照片进媒体库「失败」：同一个症状的第二道门（2026-08-05）

owner 报「user report failure on photo uploading to 媒体库 on mobile」。

**真相不是传不上去，是传上去了又被自己吃掉。** 字节好好地进了网盘，toast 说「传好 3 张」，
相册却是空的 —— 从用户那一侧看，这就叫「上传失败」。

链条：手机上点「传照片」会把整个页面切去系统相册；回来的一瞬 `visibilitychange` 和
`focus` **一起**打 `cloudRefresh()`（`docPullStart` 里那两行），正好落在 `mediaAdd` 的
上传循环中间。`cloudRefresh` 一句 `STORE.events[i]=inc` 把活动对象整个换掉，循环里
`const e=ev()` 攥着的那个引用从此是孤儿；剩下的照片全 `push` 进没人要的对象，最后
`save()` 存的是新对象。桌面上文件框是模态的、循环又短，所以**只在手机上出得来**。

⚠ **这和 2026-08-02 那条「手机传的照片，再次打开就没有了」是同一个症状的两道门。**
那次修的是「**别的设备**上的旧页面把云端盖掉」（`cloudPushAll` 的 mtime 闸，注释还在）——
修得对，但门只关了一扇：**同一台手机自己盖自己**这条一直开着。又一次印证了忘记密码那条
教训：一个功能可以有好几道门，只修一道等于没修。

三道门一起关（缺一不可）：

| 门 | 做法 |
|---|---|
| ① 传文件期间不许拉云 | `_upBusy` 计数器 + `busyNow()`，和 `typingNow()` 并列进 `cloudRefresh` 的两处闸。`upSerial` 是所有上传路径（票据/附件/媒体库/删云端）的咽喉，在那里标；但**两张照片之间的压缩间隙不在 upSerial 里**，所以 `mediaAdd`/`attachTo` 自己也把整批标上 |
| ② 跨 `await` 只留 id，不留对象 | 每传完一张就 `STORE.events.find(x=>x.id===evId)` 重新找回活动再 push |
| ③ 传一张存一次盘 | 不再是整批传完才 `save()`。中途被切走/被系统杀掉，已经进网盘的那几张不会变成孤儿字节；顺带立刻盖上 `mtime`，「本机未推的编辑在先」那道旧闸随即接手 |

`attachTo`（附件）是**同一个病**：它跨 `await` 攥着 `holder`（header / 某一行 / 活动本身），
活动对象一换同样成孤儿 —— owner 07-29 和 08-04 报过两次「附件上传失败」。按 id 找不回
`holder`（它可能是任意一层），所以走 ①③ 两条。

**套件里加了会跑的那一条**：把真的 `mediaAdd` 切出来 `new Function` 起来，在上传中途照着
`cloudRefresh` 那一句换掉活动对象，然后数照片。修之前是 `media=1`（三张只剩一张，而 toast
说传好 3 张）—— 正是 owner 收到的报告。**静态断言看不出这个，只有跑才看得出。**

## 从网盘找回照片（2026-08-05）：字节在、够不着

上一节那个竞态让照片**进了网盘、app 里却没记录**。那些字节今天还躺在 Drive 里，而在此之前
**没有任何入口能把它们找回来**。这一节补的就是那个入口：`list_media` 三层（客户端 →
`api/ym_file.py` → Apps Script），列出 `<活动 · 日期>/照片/` 里不在相册中的文件，逐张或成批挂回。

### 顺手体检出来的：「移除照片」在线上从来没工作过

为了摸清网盘那条链路，探了一下 `GET /api/ym_file?probe`，三条独立原因叠在一起：

1. **代码 bug** —— `do_POST` 里的正文体积闸在 action 分发**之前**无条件跑，而 `trash_media`
   不带 `content_base64` → 每一次「移除」都在那里 400，永远走不到自己的分支。
   实测（无 token 探顺序）：不带正文 → **400**；带上 `"content_base64":"eA=="` → **403**（走到了鉴权）。
2. `YM_DRIVE_SECRET` 从来没配过（探针 `trash_key:false`）。
3. 线上 Apps Script 落后一版：线上 `rev` 是 `2026-08-03-lock`，仓库里是 `2026-08-03-trash`。

✅ **三条当天全部解决（owner 2026-08-05 亲手做完 ②③，① 随 `fc891ff` 上线）。** 探针现在是：
`trash_key:true` · `gas.rev:"2026-08-05-trash-group"` · `gas.list:true` · `gas.trash_scope:"group"` ·
`gas.actions:["upload_media","trash_media","list_media"]`。三个动作无 token 时一律 403（路由通、闸在）。
⚠ **所以「✕ 移除」是从 2026-08-05 起才第一次真的会删东西**（丢进 Drive 回收站，30 天可还原）。
在这之前它一张都没删掉过 —— 老活动里那些「删了又还在」的照片，是那个时候留下的，不是新 bug。

⚠ 过程中踩到的：owner 先配好了 Vercel 那把密钥、脚本却还没发出去，探针立刻显示
`trash_key:true` 而 `gas.rev` 纹丝不动。**`gas.rev` 是唯一诚实的那个信号** ——
Apps Script 编辑器里保存 ≠ 发布，网页应用永远跑「已部署的那个版本」，
必须 Manage deployments → 铅笔 ✏️ → Version 选 **New version** → Deploy。
留在原版本号上点 Deploy 不会有任何变化，而屏幕上一样写着成功。

⭐ **教训：一个功能可以「代码写完了、注释很讲究、套件全绿」，而线上三层里没有一层是通的。**
`?probe` 这种「让部署自己报出它是谁」的只读体检，是唯一能一眼看穿的东西 —— 新加动作时
一定要让它进探针，否则下一次又只能靠猜。

### owner 2026-08-05 的两条裁定

| | 裁定 | 含义 |
|---|---|---|
| 1 | **就用现在的名字闸，所有主办都能用** | 不做按主办分层，接受下面那条残留风险 |
| 2 | **共编者可以删云端字节，和归属主办一样** | ⚠ **推翻 0027 的原注释**（「只有归属工作台能删」）。`host_groups` 因此不分「能读的/能删的」两档 |

### ⚠ 已知残留：名字闸挡不住「建一场同名活动」

**归属校验是 `host_groups(uid)`：group ∈「你自己的活动 ∪ 0027 共编给你的活动」。**
但网盘目录名的唯一键是 `(活动名, 日期)`，而 `uploadMedia` 建的是
`<ROOT>/<活动名 · 日期>/<类型>/` —— **单个 `ROOT_FOLDER_ID`，路径里没有任何 owner 维度**。
于是这把尺子证明的是「你有一场叫这个名字的活动」，不是「这个目录是你的」：

> 主办 B 从官网读到 A 已公开活动的 title/post_date（`0011` 的 `ym_post_public` 对 anon 放行，
> 而 `evGroup` 和 `ym_post` 的两个字段同源、同 fallback、同 `YYYY-MM-DD`）→ 在自己台上
> 建一场同名同日的活动 → `host_groups(B)` 立刻含有那一串 → 过闸 → 列到（并可删）A 的照片。

**非恶意也会撞上**：两个主办办了同名同日的活动，字节本来就落在同一个目录里 ——
这是**先于本功能存在**的数据混装，`list_media` 只是让它第一次变得可见。

**真正的解法是把树按主办分层**（`ROOT/<uid>/<活动 · 日期>/`）+ 迁移存量字节，
届时找回要同时扫新旧两条路径。owner 2026-08-05 明确选择**先不做**。
⚠ 下一个人看到套件里那五条归属闸全绿，**不要**据此以为洞已经堵上 —— 它们钉的是
「判据没被人改坏」，不是「判据够用」。

### 这一轮真正花掉时间的地方：**锁不锁得住**

三轮对抗式复查（26 + 22 + 3 个 agent）。第三轮抓到的最要命的一条不是功能 bug，是**假锁**：

> 归属闸那条 ⭐ 断言只钉住了 `_group_gate` 的**形状**（四个 return 的顺序），
> 从来没有断言那唯一一行真正做授权判断的代码。亲手验过：把判据整条反过来
> （`not in` → `in`，别人的全放行）、甚至换成 `if False:`，**套件 100% 全绿**。

⭐ **`node scripts/check-ym.mjs` 全绿只说明「没人改动过被断言的那几个字符串」。**
一条锁只有做过**变红验证**才算数：把它保护的东西改坏，看它是不是真的红。
这一轮为此把 18 种改坏方式逐条验了一遍（授权判据 5 种、共编配对/uuid 2 种、
三层的 group 传递 4 种、GAS 的 clean() 3 种、客户端分岔 4 种），每一种都必须红。

### 还有一条是**眼睛**看出来的

面板底部那句「找回需要管理员配好一把密钥并更新 Apps Script 部署」原本是常驻的。
在浏览器里真的画出来才看见：主办刚看见 3 张待挂回的照片和一颗按得动的按钮，
底下却写着这功能还没配好 —— **自己打自己的脸**。全套断言都是绿的。
（规矩 2 又赢了一次：套件全绿 ≠ 能用，也 ≠ 看着不别扭。）

## 照片显示：不再靠看图人的 Google 登录（2026-08-05）

owner 原话：「this is not acceptable. other user can not login with my google account.
we need add an photo read to authorized in google drive folder, **I ask for it multiple times**.」

**病根**：`driveThumb()` 拼的是 `https://drive.google.com/thumbnail?id=…` —— 把取图这件事
**外包给看图的人那台浏览器**。于是「看不看得见」取决于那台浏览器登没登一个对这个网盘有权限的
Google 账号：owner 自己的机器看得见，志愿者 / 嘉宾 / 别的主办全是一排文件名。
而屏幕上那句「这台浏览器没登录存照片的那个 Google 账号，登录一次就能看」是**一条错的指令** ——
它在教主办的员工去要 owner 的 Google 账号。

**做法**：字节改走我们自己那道门 —— 浏览器带着 app 的登录态 POST `/api/ym_file`(`read_media`)
→ 代理过**同一把** `_group_gate` → GAS 校验 `insideRoot` + `insideGroup` → Drive → 原路回来 →
`blob:` URL 塞进 `<img>`。**「谁能看照片」= 「app 授权了谁」，和 Google 账号彻底脱钩。**
副作用正合 owner 08-03 那条：**客户端现在一个 `drive.google.com` 都不剩**。

选它而不是「签发短时签名 URL」：后者要新增一个**不带登录态的公开端点**和一把新密钥，
而这个仓库当天刚在授权上栽过（越权 + 假锁）—— 少一道新门就少一处能写错的地方。

### ⭐⭐ 差点又白干：套件全绿，而一张照片都取不回来

第一版实现里，懒加载的 `IntersectionObserver` 观察的是 `<img data-mid>` 本身。
而占位期间卡片是 `.mshot.load`，CSS 里 `.mshot.load img{display:none}` 把它整个隐掉 ——
**`display:none` 的元素没有布局盒，观察器对它永远只报 `isIntersecting:false`**。
于是 `mediaImgLoad` 一次都不会被调用，每张卡永久停在「读取中…」——
**屏幕上的样子和 owner 卡了好几天的那一张几乎一模一样**（一排文件名、图出不来），
只是那句错的提示换成了「读取中…」。**而当时全套断言是绿的**：那一段一条都没钉 observe 的目标。

修法是观察 `.mshot` 盒子，回调里再取出里面的 `<img>`。顺带给 `.mshot.load` 一个
`min-height` —— 那不是审美：懒加载按「离视野 400px」触发，占位塌成一条细线的话，
一屏里塞进来几十张卡，等于一进相册全部排队，**懒加载名存实亡**。

⭐ **教训（规矩 12 的第二次学费）：断言证明不了「观察器会不会触发」。**
这一条只有**在真浏览器里把图调出来**才验得到。验收标准要写成 owner 那句话
——「一个从来没有 Google 账号的人，登录 app 之后能看见照片」—— 而不是「代码看起来对」。

### 另外两条也是复查抓的

· **取图不能用 `upFetch`**：它的超时定时器挂在 `.finally` 上，而 `fetch` 的 promise 在
  **响应头**到达就 resolve —— 真正下载几百 KB~几 MB 的 `await r.blob()` 完全没有保护。
  别的调用方读的都是几百字节 JSON，只有取图绝大部分时间花在那一段。半开连接下它永远不
  settle → `_mediaRun` 永久少一个并发位子 → 攒够 3 次（不必同时，一天里陆续攒也算），
  **全 app 的取图静默死掉**，没有任何错误码，只有刷新页面能解。现在它自己拿一个
  `AbortController`，覆盖到 `blob()` 之后，`mediaForget` 会把在飞的一并掐掉。
· **退出登录不 revoke**：`render()` 在登录墙那句 `return` 排在 `mediaLazyWire()` **前面**，
  而「离开相册就把 blob 还回去」那道网正挂在 `mediaLazyWire` 开头。于是退出登录后，
  上一个主办那一批来宾照片的字节还留在页面里（单页 app，一天都不刷新一次）。
  现在那句 `return` 自己先 `mediaForget()`。

### ⚠ 残留（stakes 变了，owner 该重新看一眼）

08-05 owner 裁定「就用现在的名字闸，所有主办都能用」时，那把尺子挡不住的是
**「照着官网抄一个活动名、在自己台上建一场同名活动」**（见上一节）。当时的代价是
「泄一串 file_id / 能删别人的照片」——**图本身看不见**，因为那还需要 owner 的 Google 账号。
**这一版把字节接到了同一把尺子后面，代价升级成「来宾的正脸」。**
复查提的最小改法：放行前再问一句「这个 group 字符串在 `ym_doc(kind=event)` 里是不是只对应
一个 owner」，出现第二个就 fail closed 并说人话（「有另一场活动同名同日，网盘目录会撞在
一起，请改名字或日期」），三条路一起过。**没做** —— owner 当天明确说「不考虑顺带，
这个问题卡住好几天了，先解决吧」。**要做的时候连非恶意撞名也一起解决了。**

### ✅ 部署状态（2026-08-05 当天走完）

owner 亲手发完 `2026-08-05-read-media`，探针六个信号第一次全通：
`trash_key:true` · `gas.rev:"2026-08-05-read-media"` · `gas.read:true` · `gas.list:true` ·
`gas.trash_scope:"group"` · `gas.actions` 四个动作齐（`upload/trash/list/read_media`）。
**照片能不能显示出来本身就是这条链的验收信号** —— 它同时证明部署、两侧密钥、归属闸、
GAS 作用域、客户端懒加载五处都通。

**撞名闸也在同一天上线**（`group_owners`，见上一段的「残留」—— 已不再是残留）：
owner 原话「可以，请立即解决，立即部署，如果有什么遗留漏洞可以再改善，但不能卡在这里
迟迟不解决问题」。所以这一条是**先上线、后复查**（它是 fail-closed 的：撞名拒、读不到也拒，
最坏是过严不是过松，所以这个顺序安全）。

## 这个 repo 的规矩（血泪版）

1. **只在本仓库写**。兄弟仓库（monospages/rakusat 等）只读参考 —— 需要那边改动就告诉 owner 切过去。
2. **浏览器里点一下**。套件全绿 + 解析通过**不等于**能用：`jeStatus` 读错了分段控件，289 项检查全过。
3. **动过就跑对抗式复查**。每一次都找出真 bug，包括两个账号接管级的。
4. **危险的 bug 在「组合」里**：0009 让 `ym_share.member` 可被主办写，无害了很久，直到 0015 让它
   变成承重件。新代码开始信任旧列时，去读那列真正被什么守着。
5. **迁移里的列名是执行时才解析的**（0017 §5 的教训）：SQL 应用成功 ≠ 触发器跑得起来。凡是
   `create or replace function` 碰到列名的，改完 schema 一定要回头看每一个函数体。
6. `esc()` 在 `on*="f('…')"` 里**不安全** —— 解析器先解实体再编译 JS。用 `escJs()`/`escq()`。
7. **两个 app 是独立单文件**，CSS 类和函数都不共享（`.said`/`.acts` 在成员页是 `.duty` 作用域的，
   捐赠块只好自己带一份）。改一个记得看另一个。
8. 永远不要重写 `chip.status` 语义或 `RES_ST`。
9. **静态检查会被自己的注释绊倒。** 一天之内 4 条：注释里合法地写着它承诺不做的那件事
   （「不区分邮箱存不存在」里就有"不存在"），或引用了被替换掉的旧代码（`LEDGER=LEDGER||[]`），
   或在被守护的那行**上面**先提到了 `canCloud()/SESSION`（顺序判断直接读到注释）。
   套件里有 `stripComments()` —— 凡是关于**顺序 / 缺席 / 旧表达式**的断言，一律先剥注释。
10. **`scripts/check-ym.mjs` 的 Y8 那一段是会「跑」的**：它把票据模块从 HTML 里切出来 `new Function`
   起来，拿假数据算真答案（税率拆分、CSV 合计、取消后的重结）。加新的纯函数就往那个 return 里加，
   别退回去写正则。
11. **跨 `await` 不许攥着 `STORE` 里的对象引用。** `cloudRefresh` 会 `STORE.events[i]=inc`
   把整个活动换掉 —— 一个 await 之后，你手里那个 `e`／`holder`／`r` 可能已经没人要了，
   写进去不报错、不丢 toast，只是**默默不存在**。要么每次按 id 重新找回，要么在这段期间
   挡住拉取（`busyNow()`）。**「手机上失败、桌面上正常」几乎都是这一类**：手机切去系统
   相册/相机再回来，`visibilitychange`+`focus` 必然打一次同步，而桌面的模态文件框不会。
12. **一条锁只有做过变红验证才算锁。** 套件全绿只说明「被断言的那几个字符串还在」。
   2026-08-05 实测：归属闸那条 ⭐ 断言把授权判据整条反过来、换成 `if False:`，**套件依然全绿** ——
   它钉的是四个 `return` 的**顺序**，不是那一行**判据**。写完一条锁，把它保护的东西改坏跑一次；
   不红就重写。**断言要钉语义，别钉计数**：计数锁会被下一个合法新增撞红，然后被人顺手放宽掉。
13. **新加的动作要进 `?probe`。** 2026-08-05 发现「移除照片」在线上从来没通过 ——
   代码 bug + 密钥没配 + 部署落后一版，三层叠着，而三层里没有一层会自己喊。
   `?probe` 这种「让部署自己报出它是谁」的只读体检是唯一能一眼看穿的东西。
