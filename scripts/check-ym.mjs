#!/usr/bin/env node
// Regression checks for ym (活动日记) — Y1: the one-page rundown + library panel.
// Static invariants over the no-build HTML apps — run: node scripts/check-ym.mjs
// Guards: sheet ops, pick-and-apply, strip math, XSS escaping, seeded assets,
// landing navbar/login, and the design-identity tokens (ym/PLAN.md §2).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* 2026-08-07 リポジトリ分離（owner 裁定「ym と記帳日記は別プロダクト、混ぜない」）以降、
   このスイートは ym リポジトリ（旧 jjcashflow の ym/ が独立したもの）に住む。
   ただし検査対象は昔から**3層またぎ**（ページ + api/*.py + supabase/migrations/*_ym*.sql — 例：
   归属闸・照片显示の「三層一起验」）で、api と migrations は当面 JJcashflow リポに残る（S3/S4 未実施）。
   だからパスは書き換えず、resolver が両方の家を探す：
     · 'ym/…'   → このリポのルート（prefix を剥がす）
     · その他    → 隣の JJcashflow チェックアウト（~/Documents/GitHub/ 併置が前提）
   見つからなければ**大声で止まる** —— 静かにスキップすると「全緑＝全部見た」が嘘になる。 */
const YM_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIBLINGS = [YM_ROOT, join(YM_ROOT, '..'), join(YM_ROOT, '..', 'JJcashflow'), join(YM_ROOT, '..', 'jjcashflow')];
const resolve = p => {
  const names = p.startsWith('ym/') ? [p.replace(/^ym\//, ''), p] : [p];
  for (const base of SIBLINGS) for (const n of names) { const f = join(base, n); if (existsSync(f)) return f; }
  return null;
};
const read = p => {
  const f = resolve(p);
  if (f == null) {
    console.error(`\n✗ 找不到 ${p} —— 这套检查横跨 ym 仓库和 JJcashflow 仓库（api/migrations 还住在那边）。`);
    console.error(`  需要把两个仓库并排放（~/Documents/GitHub/ym + ~/Documents/GitHub/JJcashflow）再跑。`);
    process.exit(2);
  }
  return readFileSync(f, 'utf8');
};
let failures = 0;
function check(file, label, ok) {
  if (ok) { console.log(`  ✓ ${label}`); }
  else { failures++; console.error(`  ✗ ${label}`); }
}
const count = (s, re) => (s.match(re) || []).length;
/* Comments legitimately NAME the thing they promise not to do, or quote the buggy line they
   replaced. Four checks in one day tripped on their own explanation. Any assertion about ORDER,
   ABSENCE, or a quoted old expression must run on this, not on the raw source. */
/* ⚠ 2026-07-28：这个函数以前是两行正则，而它**一直在吃真代码**：
     · `accept="image(斜杠)(星)…"` 这种属性里的「斜杠+星」会开启一段**假块注释**，
       一路吃到下一个结束标记 —— 实测五处这样的洞吞掉 53KB，含**两个** `/api/parse` 调用点；
     · 用「双斜杠到行尾」的正则剥行注释，会把任何含 `https:(双斜杠)` 的行从那里截断。
   （⚠ 这段说明里**不能**出现真的块注释结束标记，否则它会把自己关掉 —— 刚踩过。）
   两者合计删掉 79,882 字符，而真注释只有一小半。后果不是「断言挂掉」——恰恰相反：
   所有**负向**断言（「这东西不许存在」）都会**假通过**，因为文本根本不在了。
   所以改成按引号状态扫一遍，只认**代码位置**上的注释。文件末尾有一条自检钉住这件事。

   ⚠ **已知剩余缺口（2026-07-29 实测，别再重复踩）：不认正则字面量。**
   `const isImg=/^image\//.test(…)` 里的那对斜杠会被当成行注释，整行从
   `const isImg=/^image\` 之后被截断。所以：**凡是断言的目标行上带正则的，
   一律拿原始 `s` 去 includes/test，不要走 stripComments。**
   试过补一段「按前一个非空白字符判断是不是正则开头」的扫描 —— 结果误判把注释开头
   `/*` 和 `//` 吞进「正则」里，反而让 9 条负向断言从假绿变成真红（emoji / 成员端
   不打 /api/parse / 台账读失败 … ）。要真修得写 tokenizer，那是另一件事；
   在那之前，上面这条使用约束就是防线。 */
const stripComments = t => {
  let out = '', q = null, i = 0;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (q) {
      if (c === '\\') { out += c + (n || ''); i += 2; continue; }
      if (c === q) q = null;
      else if (c === '\n' && q !== '`') q = null;   // ' 和 " 不跨行；跨了就是我们读错了，及时收口
      out += c; i++; continue;
    }
    if (c === '/' && n === '*') { const e = t.indexOf('*/', i + 2); i = e < 0 ? t.length : e + 2; continue; }
    if (c === '/' && n === '/') { const e = t.indexOf('\n', i); i = e < 0 ? t.length : e; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
};
/* 同一条规矩对 SQL —— 这里的注释记号是 `--`，stripComments 只认 JS 的 `//` 和 block。
   0019 的一条自查断言第一次踩到：注释里合法地写着它承诺**不**调用的 min(m.user_id)，
   于是负向断言永远为假。（字符串字面量里的 `--` 也会被切掉，对这些断言无害。） */
const stripSql = t => t.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
/* 同一条规矩对 Python：注释记号是 `#`，stripComments 只认 JS 的 `//` 和块注释，stripSql 只认 `--`。
   2026-08-03 第三次踩到 —— 三个端点的注释里合法地写着「gemini-1.5-flash 已经下架所以去掉」，
   于是「候选表里不许有 1.5」这条负向断言永远为假。凡是对 .py 判**缺席**的，先过这个。
   （行首粗暴地按 # 切：字符串里的 # 也会被切掉，对这些断言无害。） */
const stripPy = t => t.split('\n').map(l => l.replace(/#.*$/, '')).join('\n');
/* 规矩 9 的第五种记号：**Python 的 docstring**。stripPy 只切 `#`，而 docstring 是一段三引号
   字符串，原样留在函数体里 —— 于是「这个函数里只有这三个 if」这类**清单/顺序**断言会把说明
   文字当代码读：有人在 docstring 里写一句以 `if` 开头的话，锁就因为**一句说明**而变红，
   而代码一个字没动。这正是这个文件反复踩过的那类坑（注释里合法地写着它承诺不做的事）。
   只摘掉签名后面**第一段**三引号，函数体里真正的字符串一个字都不动。 */
const pyNoDoc = b => {
  const a = b.indexOf('"""');
  if (a < 0) return b;
  const z = b.indexOf('"""', a + 3);
  return z < 0 ? b : b.slice(0, a) + b.slice(z + 3);
};
/* 规矩 9 的第四种记号：**模板字面量里的注释**。这个仓库到处用 `${/* … *(斜杠)''}` 往
   HTML 模板中间写说明，而 stripComments 一碰到反引号就进「字符串模式」原样抄到结束 ——
   于是那些说明**留在了代码里**。2026-08-05 实测：媒体库那段模板里的一句
   「以前这句只在**空相册**时画」让「渲染文案里不许有 markdown 星号」那条直接变红，
   而屏幕上一个星号都没有。所以凡是判**用户读得到什么**、或判缺席/顺序的，先过这一层。
   只认「整个插值就是一段注释、后面跟一个空串」这一种形状，不动任何真表达式。
   （⚠ 这段说明里不能出现真的块注释结束记号，否则它会把自己关掉 —— 文件开头那条同样的警告
     就在上面，它是同一个坑。） */
const stripTplNotes = t => t.replace(/\$\{\s*\/\*[\s\S]*?\*\/\s*''\s*\}/g, '');
/* 取一个函数的**函数体**：从它的定义处，到下一个顶格 `function` / `async function` 为止。
   ⚠ 绝不要再用「定长切片」（`s.slice(at, at+1600)`）—— 往函数里加一段注释就能把被断言的
   那一行推出窗口，于是断言因为**一段注释**而变红：mediaDel 那条 2026-08-05 就是这么炸的，
   而它守的是「先删云端字节、成功了才摘条目」这种真要紧的顺序。边界跟着代码走，不跟着字数走。 */
const fnBody = (code, sig) => {
  const a = code.indexOf(sig);
  if (a < 0) return '';
  const re = /\n(?:async )?function [A-Za-z_$]/g;
  re.lastIndex = a + sig.length;
  const hit = re.exec(code);
  return code.slice(a, hit ? hit.index : code.length);
};
/* 同一件事对 Python：从 `def x(` 到**同一缩进层级**的下一个 def/class/装饰器。
   缩进从签名所在行自己读出来，所以顶层函数和类里的方法用同一个调用形状；
   而嵌套的 `def rd(path):`（缩进更深）不会把函数体从中间切断。 */
const pyBody = (code, sig) => {
  const a = code.indexOf(sig);
  if (a < 0) return '';
  const pad = code.slice(code.lastIndexOf('\n', a) + 1, a);
  if (/\S/.test(pad)) return '';                  // 签名前面有非空白 = 没匹配到行首，别猜
  const re = new RegExp('\\n' + pad + '(?:def |class |@)', 'g');
  re.lastIndex = a + sig.length;
  const hit = re.exec(code);
  return code.slice(a, hit ? hit.index : code.length);
};

// ---------- ym/organizer/index.html ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html');
  // identity
  check(s, 'ym design tokens present (felt / stock / brass — reception-table identity)',
    s.includes('--felt:#16241E') && s.includes('--stock:#E8E0CD') && s.includes('--brass:#C9A356'));
  check(s, 'Oswald for numbers, Noto Sans JP for text', s.includes('family=Oswald') && s.includes('Noto+Sans+JP'));
  // storage
  check(s, "local-first storage under the jjym key (plan §4)", s.includes("const LS_KEY='jjym_v1'"));
  // 2026-08-02 起 save() 开头多了一行 mtime 戳（cloudPushAll 的闸），setItem 不再紧贴函数头
  check(s, 'save() guards quota overflow with a toast', /function save\(\)\{[\s\S]{0,220}try\{localStorage\.setItem[\s\S]{0,120}本机存储已满/.test(s));
  // sheet ops
  check(s, 'sheet ops present: add / delete / reorder rows',
    ['function addRow', 'function delRow', 'function moveRow'].every(f => s.includes(f)));
  check(s, 'row delete asks confirm only when the row has content',
    /r&&\(r\.seg\|\|r\.resources\.length\|\|r\.money\.length\)&&!confirm/.test(s));
  check(s, 'event-header row exists and is selectable (活动全场 target)',
    s.includes("selRow('header'") && s.includes('活动全场'));
  // pick & apply
  check(s, 'library has 5 tabs — 人员 is its own category, separate from 物资 (owner 2026-07-20)',
    s.includes("['tpl','模板']") && s.includes("['idea','灵感']") && s.includes("['people','人员']")
    && s.includes("['goods','物资']") && s.includes("['money','收支']") && !s.includes("['res','资源']"));
  // the stub add-forms are gone (owner 2026-07-27: 「现在提供的是演示功能，无法对应」) — 联系方式 is
  // now carried by LIB_FIELDS, which feeds BOTH the 资料卡 and the 新建 form
  check(s, '人员 records can carry 联系方式',
    ['volunteer', 'guest', 'donor'].every(k => new RegExp(`${k}:\\[[\\s\\S]{0,600}?\\['contact','联系`).test(s)));
  // 相机圆钮去掉了 (owner 2026-07-27): 票据 and 报名表 each already had an in-page button, so the
  // fab was duplicate chrome for something 「并不常用」. The mic stays — hold-to-talk during an
  // event is exactly what a floating button is for.
  check(s, 'only the mic fab remains; 票据/报名表 are in-page buttons',
    s.includes('function fabsHtml') && s.includes('id="micfab"') && s.includes('rfabpulse')
    && !s.includes('fabMenu') && !/\.fabmenu\{/.test(s)
    && /票据\s*\n?\s*<input[^>]*\n?\s*[^>]*onchange="rcShoot/.test(s)
    && /报名表\s*\n?\s*<input[^>]*onchange="formPhoto/.test(s));
  // the member portal has had 忘记密码 since 2026-07-14; the HOST had no way to reset at all —
  // and PASSWORD_RECOVERY must be caught BEFORE cloudLoad or the emailed link lands them on the
  // desk with the reset silently skipped (the exact bug the member page already avoids)
  // owner 2026-07-27: 「输入注册码…没能输入完就被刷新掉了」— the 等待批准 screen IS the screen you
  // paste the code into, and it was running a full cloudLoad()+render() at it every 15 seconds
  check(s, 'the pending poll only repaints when the status actually changed',
    /if\(st&&\(!PROFILE\|\|st!==PROFILE\.status\)\)cloudLoad\(\)/.test(s)
    && !/setInterval\(\(\)=>\{\s*\n?\s*if\(!SESSION\|\|canCloud\(\)\)\{stopPoll\(\);return;\}\s*\n?\s*cloudLoad\(\);/.test(s));
  // …and belt-and-braces: the code lives in S, so ANY render restores it
  check(s, 'a half-typed 邀请码 survives a repaint from anywhere',
    (s.match(/value="\$\{esc\(S\.authCode\|\|''\)\}" oninput="S\.authCode=this\.value"/g) || []).length === 2
    && /value="\$\{esc\(S\.authEmail\|\|''\)\}" oninput="S\.authEmail=this\.value"/.test(s));
  check(s, 'the host can reset a forgotten password, and change it while signed in',
    /S\.authTab==='forgot'/.test(s) && /忘记密码了/.test(s)
    && /function doForgot[\s\S]{0,600}resetPasswordForEmail/.test(s)
    && /function doNewPw[\s\S]{0,500}updateUser\(\{password:a\}\)/.test(s)
    && /S\.authTab==='pw'\?authNewPw\(false\)/.test(s));
  // ⚠ 复查 2026-07-27 发现：catching it before cloudLoad was only HALF the fix. A recovery link
  // always arrives WITH a session, so authSheet's branch order decides what actually paints —
  // and S.authRecovery sat BELOW canCloud()/SESSION, so the 设新密码 form could never render.
  check(s, "the 设新密码 form outranks the signed-in panels (a recovery link always has a session)",
    (() => {
      // strip comments FIRST — the comment explaining this ordering names canCloud()/SESSION above
      // the line it guards, and a positional check would read the prose instead of the code
      const b = stripComments(s.slice(s.indexOf('function authSheet'), s.indexOf('let _authBusy')));
      const rec = b.indexOf('S.authRecovery'), cc = b.indexOf('canCloud()'), ses = b.indexOf('else if(SESSION)');
      return rec > 0 && cc > 0 && ses > 0 && rec < cc && rec < ses
        && (b.match(/S\.authRecovery\)inner=authNewPw\(true\)/g) || []).length === 1;
    })());
  /* The event alone is not enough. supabase-js consumes the #token and fires PASSWORD_RECOVERY
     from an async _initialize() started at createClient — authInit() subscribes at the very bottom
     of the script, so the event can be gone before anyone is listening, and the host just lands on
     the desk. Read the URL BEFORE createClient and treat that as evidence too. */
  check(s, 'a recovery link works even if the PASSWORD_RECOVERY event is missed',
    (() => {
      const code = stripComments(s);
      return /const RECOVERY_URL=\/type=recovery\/\.test\(_hash\)/.test(code)
        && code.indexOf('RECOVERY_URL') < code.indexOf('createClient')      // captured first
        && /if\(RECOVERY_URL&&SESSION\)\{ownerGate\(\);S\.authRecovery=true;S\.auth=true;render\(\);return;\}/.test(code);
    })());
  // an expired / already-used link arrives as error_description in the hash and otherwise looks
  // like an ordinary visit — say so instead of showing a plain login page
  check(s, 'an expired reset link explains itself',
    /const RECOVERY_ERR=\(\/error_description=\(\[\^&\]\+\)\//.test(s)
    && /这个重设链接不能用了/.test(s));
  // redirectTo must be allow-listed in Supabase or GoTrue silently swaps in the Site URL
  check(s, 'redirectTo is derived from the page, matching the member app',
    /const RESET_REDIRECT=location\.origin\+location\.pathname/.test(s)
    && /resetPasswordForEmail\(em,\{redirectTo:RESET_REDIRECT\}\)/.test(s)
    && !/redirectTo:'https:\/\/ym\.jjconnect\.tokyo/.test(s));
  check(s, 'PASSWORD_RECOVERY is caught before cloudLoad and opens the drawer',
    /if\(ev2==='PASSWORD_RECOVERY'\)\{[\s\S]{0,120}S\.authRecovery=true;S\.auth=true;render\(\);return;\}/.test(s)
    && s.indexOf("ev2==='PASSWORD_RECOVERY'") < s.indexOf('_authKey=key;cloudLoad();'));
  // the reset form must not become an account-existence probe
  /* The property is "the SUCCESS path cannot distinguish an existing address from an unknown one",
     not "never mention an error". GoTrue's /recover answers 200 for an unknown address, so a
     transport failure (rate limit, SMTP down, redirect_to not allow-listed) says nothing about the
     account — and swallowing it is how a reset that never arrives becomes undebuggable. So: the
     success wording must be unconditional, we must never branch on user-existence vocabulary, and
     any error toast must carry the disclaimer. */
  check(s, 'the reset form never reveals whether an address has an account',
    (() => {
      const code = stripComments(s.slice(s.indexOf('async function doForgot'),
                                         s.indexOf('async function doNewPw')));
      return !!code && code.includes('如果这个邮箱有账号')
        && !/不存在|没有这个|not found|user_not_found/i.test(code)
        && /跟邮箱有没有账号无关/.test(code);          // the error branch must say so
    })());
  // owner 2026-07-27: 当天/复盘 are two of an event's three phases — they belong on the event card,
  // not buried in the page where you edit the 台本. ⚠ the card had to stop being a <button>.
  /* ⚠ 2026-08-05：这四颗按钮的 id 从 `${e.id}` 换成了 `${escJs(e.id)}`（规矩 6：on* 属性里
     esc 不够），「复盘」那颗也换成了 openReview —— 断言跟着改，但守的还是同一件事：
     三个阶段的入口长在卡上。id 那一处**顺带钉住 escJs**，别让它悄悄退回去。 */
  check(s, '计划 / 报名 / 当天 / 复盘 live on the 工作台 event card（id 走 escJs）',
    /class="dc-acts"/.test(s)
    && ['go(\'sheet\')`,\'计划\'', 'go(\'signup\')`,\'报名\'', 'goDay()`,\'当天\'']
         .every(tail => s.includes("go2(`S.evId='${escJs(e.id)}';" + tail))
    && s.includes("go2(`openReview('${escJs(e.id)}')`,'复盘')")
    && !/go2\(`S\.evId='\$\{e\.id\}'/.test(s)          // 退回裸 id = 规矩 6 又破了
    && !/onclick="goDay\(\)">当天/.test(s) && !/onclick="goReview\(\)">复盘/.test(s));
  check(s, 'the desk card is no longer a <button> (a button cannot contain buttons)',
    /<div class="deskcard\$\{ph==='current'\?' cur':''\}[\s\S]{0,60}?" role="button"/.test(s)
    && !/<button class="deskcard/.test(s));
  // owner 2026-07-27: 「在计划台面，参加者实际上是不存在的，因为还没有报名」— what exists while
  // planning is who you INTEND to invite; 已报名 only exists once the event is published.
  check(s, '报名情况 moved off 计划 and onto the 执行看板, split 已报名 / 拟邀请',
    s.includes('function signupBlock') && /\$\{execFooter\(e,mt,ign\)\}\s*\n?\s*\$\{signupBlock\(e\)\}/.test(s)
    && !/participantsStrip/.test(s)
    && /已报名 · \$\{e\.participants\.length\}/.test(s) && /拟邀请 · \$\{inv\.length\}/.test(s));
  check(s, '拟邀请 never count as signups on their own',
    /function invToSignup[\s\S]{0,600}participants\.push/.test(s)
    && /function signupText[\s\S]{0,160}e\.participants\.length/.test(s)
    && !/signupText[\s\S]{0,160}invitees/.test(s));
  // the guest's own 我想参加 is what converts an invitation; accepting it clears 拟邀请 so the
  // same person is never in both columns
  check(s, "a guest's acceptance moves them out of 拟邀请 and into 已报名",
    /invited:\(\(e\.invitees\|\|\[\]\)\.some\(x=>x\.libId===p\.id\)\)\|\|undefined/.test(s)
    && /function joinAccept[\s\S]{0,900}e\.invitees=e\.invitees\.filter\(x=>x\.libId!==p\.id\)/.test(s)
    // the host's manual path survives for people with no account, but no longer claims consent
    && /代为确认/.test(s) && !/转为已报名/.test(s));
  // 2026-07-27 复查: signupBlock lived ONLY inside viewExec, which bails to 复盘 for hot/archived
  // and is not reached at all by a 筹备中 event — so 报名情况 was unreachable exactly during the
  // phase when signups actually arrive.
  // a guest tapping 我想参加 on last week's event files a signup the host can only be confused by
  check(s, '可报名 offers only events that have not happened yet',
    /const ph=evPhase\(e\);\s*\n?\s*if\(e\.publicOn&&\(ph==='plan'\|\|ph==='current'\)\)open\.push/.test(s));
  // 复查 2026-07-27: a box that returns '' when empty reads as "never shipped" — and these two are
  // empty precisely while the owner is trying to work out why nothing arrives
  check(s, 'the 报名/捐赠 boxes explain themselves when empty instead of vanishing',
    /function joinStrip[\s\S]{0,900}还没有人按「我想参加」/.test(s)
    && /function joinStrip[\s\S]{0,900}公开到官网/.test(s)
    && /function giveStrip[\s\S]{0,900}还没有捐赠票据/.test(s)
    // …but the 捐赠 hint stays hidden for a salon with no 捐赠人 at all
    && /if\(!STORE\.library\.resources\.some\(r=>catOf\(r\)==='donor'\)\)return ''/.test(s));
  check(s, '报名情况 is reachable in every phase, not just from the 执行看板',
    /function viewSignup/.test(s) && /S\.view==='signup'\)body=viewSignup\(\)/.test(s)
    && s.includes("go2(`S.evId='${escJs(e.id)}';go('signup')`,'报名')")   // 2026-08-05: id 走 escJs
    && /class="dc-cap[\s\S]{0,220}go\('signup'\)/.test(s)
    && /if\(v==='signup'\)loadPending\(\)/.test(s));
  check(s, '报名 15/30 is on the event card itself, and needs a 名额 to show a denominator',
    /class="dc-cap/.test(s) && /function capOf/.test(s)
    && /placeholder="名额（如30）"/.test(s)
    && /function signupText\(e\)\{const c=capOf\(e\);return e\.participants\.length\+\(c\?'\/'\+c:''\)/.test(s));
  check(s, 'voice draft card surfaces globally (overlay) outside the 记录 tab',
    s.includes('modal-g') && /S\.draft&&!recTab/.test(s));
  check(s, 'apply ops present: template / idea / resource / money',
    ['function applyTpl', 'function applyIdea', 'function applyRes', 'function applyMoney'].every(f => s.includes(f)));
  check(s, 'template apply over a non-empty sheet asks before overwriting',
    /e\.rows\.length&&!confirm\('当前台本已有/.test(s));
  check(s, 'resource/money apply targets the selected row or header',
    count(s, /S\.sel==='header'\?e\.header:e\.rows\.find\(x=>x\.id===S\.sel\)/g) >= 2);
  check(s, 'phone gets the library as a drawer (fab + drawer)', s.includes('class="fab"') && s.includes('class="drawer"'));
  // status flipping + follow-up
  check(s, 'resource status cycles through 4 states (未联系→已联系→已确认→到位)',
    s.includes("['未联系','已联系','已确认','到位']") && s.includes('(c.status||0)+1)%4'));
  check(s, 'reminder share for unconfirmed resources (催未确认)',
    s.includes('function remindAll') && s.includes('(x.c.status||0)<2'));
  check(s, 'share() falls back to clipboard then prompt (no SNS API)',
    s.includes('navigator.share') && s.includes('navigator.clipboard') && s.includes('prompt('));
  // Owner's creed: natural in-app windows, never an alien native dialog. The money / participant /
  // link / image entries all route through ask(); prompt() survives only as a clipboard fallback.
  check(s, 'data entry uses ask(), not a native prompt()',
    s.includes('function ask(') && s.includes('function askOk') &&
    s.includes("ask({title:'＋ 加一位参加者'") && /ask\(\{title:ico\('link'\)\+'加链接'/.test(s) &&
    !/const v=prompt\(/.test(s) && !/const g=prompt\(/.test(s) && !/const u=prompt\(/.test(s));
  // ask() must NOT go through render(): the 发布 body is a contenteditable holding unsaved typing,
  // and a re-render mid-edit would throw it away.
  check(s, 'ask() mounts as a detached overlay, never via render()',
    s.includes('document.body.appendChild(w)') && s.includes('function askClose') &&
    /function askOk\(\)\{[\s\S]{0,320}askClose\(\);o\.fn\(vals\)/.test(s) &&
    !/function ask\(o\)\{[\s\S]*?document\.body\.appendChild\(w\)[\s\S]{0,80}render\(\)/.test(s));
  // fixed fabs must never sit on top of the last row of content (no overlapping, ever)
  check(s, 'fabs reserve their own space so content never ends underneath',
    s.includes('fabspace') && /height:\$\{base\+56\}px/.test(s));   // one fab now, not two
  // strips math
  check(s, 'resource strip counts all chips (header + rows)',
    s.includes('function resCounts') && s.includes('function allResChips'));
  check(s, 'money strip totals split in/out × plan/actual and compute net',
    /t\.inPlan\+=c\.plan/.test(s) && /t\.outActual\+=c\.actual/.test(s) && s.includes('t.planNet=t.inPlan-t.outPlan'));
  check(s, 'money actual is entered per chip; empty means not-yet (null, not 0)',
    /const num=v=>v===''\?null:/.test(s) && /c\.actual=num\(/.test(s));
  // 门票单价 had no editor anywhere — the host could not set a price from 计划 (owner asked)
  check(s, '计划 sets 金额 AND 单价 on the money chip, not just the actual',
    /function editMoney[\s\S]{0,900}每人单价/.test(s) &&
    /function editMoney[\s\S]{0,900}label:'计划金额'/.test(s) &&
    /c\.unit\?yen\(c\.unit\)\+'\/人 · ':''/.test(s));
  // ---- review regressions (2026-07-22) ----
  // a chip named just 「门票」 billed the FEMALE arrivals only — half the take, silently
  // 2026-07-28：头数改成 arrUnpaid（到场**且没有单独记过款**的人）——性别拆分的规则一个字没变
  check(s, '门票 splits by gender only when the NAME says so; otherwise it bills every arrival',
    s.includes('function ticketHeads') &&
    /if\(m&&!w\)return arrUnpaid\(e,'男'\)/.test(s) &&
    /return arrUnpaid\(e,'男'\)\+arrUnpaid\(e,'女'\)/.test(s) &&
    !/arrUnpaid\(e,c\.name\.indexOf\('男'\)>=0\?'男':'女'\)/.test(s));
  // unit:0 is "no per-head price", not "free per head"
  check(s, 'a blank 单价 is deleted, never stored as 0',
    /if\(k==='unit'\)\{const n=parseInt[\s\S]{0,80}else delete rec\.unit/.test(s) &&
    /c\.kind==='in'&&c\.unit>0&&c\.name\.indexOf\('门票'\)>=0/.test(s));
  // two records on one address must publish NOTHING — the payload SHAPE follows the record, so
  // guessing could hand a 嘉宾 a volunteer payload (duties + chipId => a write surface)
  check(s, 'publishing skips any roster record without a live server-minted code',
    /const a=CODES\[p\.id\];/.test(s) && /!CODE_RE\.test\(a\.code\)\)return;/.test(s)
    && s.includes("onConflict:'host,member_code'"));
  // a merged 重名 嘉宾 record holding an account would show one guest another's events and 号牌
  check(s, 'fileGuest never auto-merges into a 嘉宾 record that holds an account',
    /peoList\('guest'\)\.find\(r=>!r\.code&&/.test(s) && s.includes('名册里已有同名嘉宾（已发账号）'));
  check(s, 'the homonym warning is category-aware (it never fired for 嘉宾 before)',
    /function nameIndex\(cat\)/.test(s) && /nameIndex\(cat\)\[String\(p\.name/.test(s));
  check(s, 'the invite tells them to register and names their 编号',
    /function grantSend[\s\S]{0,800}邀请码：/.test(s) && /function grantSend[\s\S]{0,800}你的编号/.test(s));
  // .dfld/.l were only styled inside a dialog; 计划 uses them too
  check(s, '.dfld label styling is not dialog-scoped',
    /\n  \.dfld\{display:block/.test(s) && /\n  \.dfld \.l\{font-size:10px/.test(s));
  check(s, 'follow-ups = unconfirmed resources + money without actuals',
    s.includes('function followUps') && s.includes('x.c.actual==null'));
  // today / calendar
  check(s, 'today view lists upcoming events with countdown + follow-up summary',
    s.includes('还有 ') && s.includes('待跟进'));
  check(s, 'month calendar renders event dots', s.includes('function calHtml') && s.includes('class="cal"'));
  // library manage + seeds
  // three hand-written add functions became ONE that reads LIB_FIELDS — the reason the old ones
  // drifted is that each new field had to be added in two places and only ever was in one
  check(s, 'library manage view can add ideas/resources/money items',
    s.includes('function libAddSave') && s.includes('function libAddCard')
    && /function libAddSave[\s\S]{0,700}library\.ideas\.push/.test(s)
    && /function libAddSave[\s\S]{0,700}library\.money\.push/.test(s)
    && /function libAddSave[\s\S]{0,700}library\.resources\.push/.test(s)
    && !s.includes('function libAddIdea') && !s.includes('function libAddRes'));
  /* 示例数据 2026-08-03 整体退役（owner：「不再需要示例，也不要一键清理」）。登录墙之后
     主办台没有匿名试用者，示例唯一的读者不存在了；而每个浏览器各自 seed() 一套 id 不同的
     种子，一直是「资产库里三套场地费」的来源。seed() 现在必须是**空的**。 */
  check(s, 'seed() is empty — no tutorial event, no seeded library (示例 retired)',
    /function seed\(\)\{\s*return \{events:\[\],library:\{resources:\[\],money:\[\],ideas:\[\],templates:\[\]\}/.test(stripComments(s))
    // 剥注释再判缺席（规矩 9）：purgeDemo 的说明里必须能引用那份旧名单，才讲得清为什么不能按它删
    && !stripComments(s).includes('十对十 标准流程') && !s.includes('function seedParticipants')
    && !s.includes('(6-d.getDay()+7)%7||7')
    // 「春日联谊」只剩一处：SEED_EV_NAMES —— 认出老设备上那两场种子活动用的，不是在造种子
    && count(s, /春日联谊/g) === 1 && s.includes("SEED_EV_NAMES=['夏日茶会','春日联谊']"));
  // safety
  check(s, 'esc() exists and is used on every user-text interpolation in rows/chips',
    s.includes('function esc(') && count(s, /esc\(/g) >= 25);
  /* 2026-08-03 之前这里钉的是「演示头像自称 演示模式」—— 那个匿名演示态整个没有了
     （owner：手机上任何人点「主办登录」都直接看到了工作台）。现在钉相反的事：
     头像只剩 已开通/等待批准 两态，「演示模式 — 点击登录」这个 title 不许回来。 */
  check(s, 'no anonymous demo state: the avatar has exactly two states (cloud on / pending)',
    stripComments(s).includes("title=\"${canCloud()?'云同步已开启':'等待管理员批准'}\"")
    && !stripComments(s).includes('演示模式 — 点击登录'));
}

// ---------- Y2: event day (当天) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — Y2 event day');
  check(s, 'day mode entry + 3 tabs 看板/台本/记录',
    s.includes('function goDay') && s.includes("['board','看板']") && s.includes("['run','台本']") && s.includes("['rec','记录']"));
  check(s, 'badge grid: tap toggles check-in, NO confirm dialog',
    /function toggleArr[\s\S]{0,160}render\(\);\}/.test(s) && !/function toggleArr[\s\S]{0,160}confirm\(/.test(s));
  check(s, 'ratio alarm turns red at gap ≥ 3', s.includes('gap>=3') || s.includes('gap >= 3'));
  check(s, 'check-in drafts ticket revenue; posting requires 确认入账 button',
    s.includes('function confirmTickets') && s.includes('确认入账'));
  check(s, 'run tab: tap logs actual time, tap again undoes',
    s.includes('function tapRun') && s.includes("r.actual=r.actual?null:nowHM()"));
  check(s, 'voice: MediaRecorder hold-to-talk, no red dot (brass line)',
    s.includes('MediaRecorder') && s.includes('recline') && s.includes('屏幕不会亮红点'));
  check(s, 'voice roster is ym mode with participants/resources/money',
    s.includes("mode:'ym'") && s.includes('function ymRoster'));
  check(s, 'voice + photo call the CORS-allowed main-domain API',
    count(s, /API\+'\/api\/(voice|parse)'/g) >= 3 && s.includes("const API='https://www.jjconnect.tokyo'"));
  check(s, 'all 4 voice intents have confirm-first draft cards',
    ['execCheckin', 'execFlip', 'execCost', 'confirmEval'].every(f => s.includes(f)) && s.includes('function draftCard'));
  check(s, 'eval: low-confidence fields render as dotted blanks (未确认不入档)',
    s.includes('conf<0.6') && s.includes('没听清—请补') && s.includes('未确认不入档'));
  check(s, 'eval confirm refuses an empty card', s.includes('至少填一项再存档'));
  check(s, 'eval stores source + transcript (原始转写保留)',
    s.includes("source:d.manual?'manual':'voice'") && s.includes('transcript:d.transcript'));
  // Y8: the same promise, one capture and one writer now. costPhoto/confirmCost were DELETED, and
  // with them the channel that pushed vendor-named plan:0 chips into 收支 (「ファミリーマート 渋谷店」).
  check(s, 'receipt photo → parse → confirm before posting (确认入账)',
    s.includes('function rcShoot') && s.includes('function rcConfirm') && s.includes('金额不能为空')
    && !s.includes('function costPhoto') && !s.includes('function confirmCost'));
  check(s, 'participant form photo → ym_form mode → confirm before roster add',
    s.includes("mode:'ym_form'") && s.includes('function confirmForm') && s.includes('确认加入名册'));
  check(s, 'photos are shrunk client-side before upload', s.includes('function shrink') && s.includes('1600'));
  check(s, 'Y1→Y2 localStorage migration exists', s.includes('function ensureY2') && s.includes('STORE.y2'));
  check(s, 'manual eval path exists (voice is optional)', s.includes('function manualEval'));
}

// ---------- Y3: 复盘 + 保存回资产库 + exports ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — Y3 round trip');
  check(s, '复盘 view: planned→actual times with gap (晚/早/准点/未记)',
    s.includes('function viewReview') && s.includes('function fmtGap') && s.includes('准点'));
  check(s, '复盘 shows 预算→实际 and attendance summary (未到 list)',
    s.includes('预算 → 实际') && s.includes('未到：'));
  check(s, 'save-back builds template + new ideas + new resources + price updates',
    s.includes('function buildSaveBack') && s.includes('function applySaveBack'));
  check(s, 'save-back is one confirmation screen with per-item toggles',
    s.includes('function sbToggle') && s.includes('function saveBackCard') && s.includes('确认保存'));
  check(s, 'template save resets chip states (status 0, actual null) — pass ② hygiene',
    s.includes('role:c.role,status:0}') && s.includes('plan:c.plan,unit:c.unit,actual:null}'));
  check(s, 'save-back dedupes against the library (no duplicate ideas/resources)',
    s.includes('L.ideas.some(x=>x.seg===r.seg)') && s.includes('L.resources.some(y=>y.name===c.name)'));
  check(s, 'CSV export: UTF-8 BOM + RFC-4180 escaping',
    s.includes('function csvEsc') && s.includes("'﻿'") && s.includes('replace(/"/g'));
  check(s, '收支 CSV includes totals and 差额 rows', s.includes('function exportMoney') && s.includes("['差额'"));
  check(s, '名单·评价 CSV joins all eval fields per participant',
    s.includes('function exportPeople') && s.includes('后续跟进'));
  check(s, '台本 share text + printable view exist',
    s.includes('function shareRundown') && s.includes('function printRundown') && s.includes('print()'));
  check(s, 'print view escapes user text', /function printRundown[\s\S]{0,1600}esc\(r\.seg/.test(s));
}

// ---------- api: ym modes + CORS ----------
{
  const v = read('api/voice.py');
  console.log('api/voice.py');
  check(v, 'ym mode: prompt + shape + sanitize + mock',
    ['def ym_prompt', 'YM_SHAPE', 'def ym_sanitize', 'def ym_mock'].every(x => v.includes(x)));
  check(v, 'ym intents constrained to roster ids (never free-text)',
    v.includes('pids') && v.includes('rids') && v.includes('mids'));
  check(v, 'mixed zh/ja speech noted in prompt (gate-tested)', v.includes('日本語の固有名詞'));
  check(v, 'eval confidence clamped to 0..1', v.includes('min(1.0, float(v))'));
  check(v, 'add_cost without amount is rejected to unknown', v.includes('没听清金额'));
  check(v, 'CORS: allowlist + OPTIONS preflight + headers on _send',
    v.includes('CORS_ORIGINS') && v.includes('def do_OPTIONS') && v.includes('ym.jjconnect.tokyo'));
  const p = read('api/parse.py');
  console.log('api/parse.py');
  check(p, 'ym_form mode: prompt + shape + tool',
    ['YMFORM_PROMPT', 'YMFORM_SHAPE', 'YMFORM_TOOL'].every(x => p.includes(x)));
  /* 読めなかったときに作り話の伝票を返さない（2026-08-06）。以前は MOCK が返り、
     確認画面を素通りすれば架空の金額がそのまま帳簿に残った。 */
  check(p, 'a failed parse returns an error, never fabricated data',
    p.includes('def fail(note, mode="receipt")') && p.includes('"source": "error"')
    && !/\bMOCK\b/.test(p) && !/def mock\(/.test(p)
    && !/return mock\(/.test(p) && p.includes('if result.get("source") != "error"'));
  check(p, 'ym_form returns per-field confidence', p.includes('"conf"') && p.includes('確信度(0〜1)'));
  check(p, 'mode router is an allowlist (payslip / ym_form / roster_shot), never arbitrary',
    p.includes('in ("payslip", "ym_form", "roster_shot")'));
  check(p, 'roster_shot returns names only — no message bodies, and gender is never guessed',
    p.includes('ROSTER_TOOL') && /推測しない|推測で補完/.test(p));
  check(p, 'every ym /api/parse caller handles the error payload (no error object rendered as a draft)',
    (() => { const o = read('ym/organizer/index.html');
             return (o.match(/res&&res\.error/g) || []).length === 4; })());
  check(p, 'CORS: allowlist + OPTIONS preflight', p.includes('CORS_ORIGINS') && p.includes('def do_OPTIONS'));
}

// ---------- Y4: alive (0008 + auth + cloud mirror) ----------
{
  const m = read('supabase/migrations/0008_ym.sql');
  console.log('supabase/migrations/0008_ym.sql');
  check(m, 'profile role widened to include organizer (主办方)',
    m.includes("check (role in ('client','accountant','organizer'))"));
  check(m, 'ym_doc: owner-scoped jsonb store with RLS enabled',
    m.includes('create table if not exists ym_doc') && m.includes('alter table ym_doc enable row level security'));
  check(m, 'policy requires owner AND an approved profile (server-side boundary)',
    m.includes('owner = auth.uid() and ym_ok()') && m.includes("p.status = 'approved'"));
  check(m, 'updated_at is server-forced by trigger', m.includes('ym_doc_touch'));
  check(m, 'no FKs into cashflow tables (only auth.users) — plan §4 guardrail',
    m.includes('references auth.users(id)') && !/references (client|firm|event|c_record|link)\b/.test(m));

  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — Y4 auth + sync');
  check(s, 'supabase client wired (CDN + publishable key, same project as JJcashflow)',
    s.includes('@supabase/supabase-js') && s.includes('ugkopxmeqsbtjeimultz.supabase.co'));
  check(s, 'cloud writes gated on approved profile (canCloud)',
    s.includes('function canCloud') && s.includes("PROFILE.status==='approved'"));
  check(s, 'auth-change guard: same-user events never re-render over input (accountant lesson)',
    s.includes('if(key===_authKey)return'));
  check(s, 'save() debounces a cloud push when signed in + approved',
    s.includes('setTimeout(cloudPushAll,800)'));
  check(s, 'event delete propagates to the cloud store', /delEvent[\s\S]{0,900}ym_doc'\)\.delete\(\)/.test(s));
  check(s, 'first visit registers a ym_member row; the server decides status',
    s.includes("from('ym_member').insert({user_id:SESSION.user.id})"));
  check(s, 'auth sheet: sign-in / sign-up(主办方) / sign-out, double-submit guarded',
    ['doSignIn', 'doSignUp', 'doSignOut'].every(f => s.includes('function ' + f)) && s.includes('_authBusy'));
  check(s, 'logged-out demo mode intact — no hard redirect (convention #1)',
    !s.includes('location.href') || !/if\(!SESSION\)[^\n]*location/.test(s));
  check(s, '嘉宾名册 CSV import (Excel另存为CSV), quoted fields handled',
    s.includes('function importRoster') && s.includes('function csvParseLine') && s.includes('没找到「姓名」列'));
  check(s, 'form confirm keeps the full V1.0 field set (收入/婚姻/特长/择偶)',
    s.includes('income:d2.income') && s.includes('marital:d2.marital') && s.includes('pref_income:d2.pref_income'));
}

// ---------- Y5: people & member accounts (hub-and-spoke) ----------
{
  const m = read('supabase/migrations/0009_ym_people.sql');
  console.log('supabase/migrations/0009_ym_people.sql');
  check(m, 'ym_share: host CRUD needs approved organizer; member SELECT own rows only',
    m.includes('host = auth.uid() and ym_ok()') && m.includes('for select using (member = auth.uid())'));
  check(m, 'members claim invites via security-definer RPC matching their verified email (no enumeration)',
    m.includes('ym_claim_shares') && m.includes('security definer') && m.includes('lower(s.member_email)'));
  check(m, 'no FKs into cashflow tables; updated_at server-forced',
    m.includes('references auth.users(id)') && !/references (client|firm|c_record|link)\b/.test(m) && m.includes('ym_share_touch'));

  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — Y5 host side');
  check(s, 'host grants/revokes a member account per person (授权码, email-keyed)',
    s.includes('function grantOpen') && s.includes('function grantRevoke') && s.includes('已取消授权'));
  // ownership is a HARD LINK first and a name only as a fallback: volId (抢单 winner, Y7 step 7)
  // then refId (资源 chip). Name matching alone reaches NOBODY when two 名册 records share a name
  // or one is blank, which would put a task in neither the pool nor anyone's duties[].
  check(s, 'share payload = ONLY that member\'s own view (their duties + hours/review)',
    s.includes('function shareDataFor') && s.includes('chipOwnedBy(c,p,idx)') &&
    /function chipOwnedBy[\s\S]{0,900}c\.volId===p\.id[\s\S]{0,90}c\.refId===p\.id/.test(s));
  check(s, 'shares republish on every save, keyed by the 用户编码',
    /cloudPushAll[\s\S]{0,600}pushShares\(\)/.test(s) && s.includes("onConflict:'host,member_code'"));
  check(s, 'client 编码 validation matches the server CHECK (no server-side 500s)',
    s.includes('const CODE_RE=') && /H\\d\{3\}/.test(s) && /P\\d\{6\}/.test(s));
  // 0029 起「删人」改叫「移除」并走 personRemove（软删除，30 天可恢复）——
  // 但「停用账号必须走那条原子 RPC」这条意图没变，只是搬了家：libDel 转交 personRemove。
  check(s, 'revoking or removing a member goes through the atomic revoke RPC',
    /function grantRevoke[\s\S]{0,900}rpc\('ym_revoke_code'/.test(s) &&
    /function personRemove[\s\S]{0,900}rpc\('ym_revoke_code',\{p_code:a\.code,p_off:true\}/.test(s) &&
    /function libDel[\s\S]{0,1400}personRemove\(id\);return;/.test(s) && s.includes('function dropShare'));
  check(s, '复盘 records volunteer 服务时长/工作评价 per event (V1.0)',
    s.includes('function volSection') && s.includes('volLog') && s.includes('服务时长'));
  // superseded 2026-07-20: 嘉宾 are now first-class registry records, not a derived read-only view
  check(s, '嘉宾 are first-class registry records with their own editable 名册',
    s.includes("['guest','嘉宾']") && s.includes('function fileGuest') && !s.includes('嘉宾（来自各活动名册'));

  const p = read('ym/member/index.html');
  console.log('ym/member/index.html');
  // PLAN-Y7 §A3: login is EMAIL + password only. Nothing may resolve a 用户编码 to an address —
  // 顺位 编号 are enumerable, so a resolver would turn the roster into a mailing list.
  check(p, 'login is email-only; no 编码 resolver anywhere',
    p.includes("sb.auth.signInWithPassword({email:id,password:pw})") &&
    !p.includes('/api/ym_login') && !p.includes('ym_login_target'));
  /* §A3 是**代码和文案两条**约束，而只有代码那条有人守。上面这条断言一直是绿的，与此同时
     有 FOUR 处文案在教成员「用编号登录」—— 其中一处是 grantSend **真的发到 TA 手机上**的
     那封邀请。登录框是 `<input type="email">`：照着做的人会被浏览器自己的「请输入电子邮件
     地址」挡在登录页上，没有任何出路，而套件全绿。
     规则：一句话里 编号 / 编码 / `.code` 能挨着「登录」出现，只能是为了**否定**它。
     跑在 stripComments 上 —— 这些文件的注释本来就要指名它禁止的东西。 */
  /* 「用它登录」里的「它」照样得先由**同一句**指名一个码 —— 否则「已经有 jjconnect 账号？
     直接用它登录」这种正当文案会被判成违规（第一版就是这么误报的）。 */
  const codeLoginCopy = src => stripComments(src)
    .split(/[。\n；;]/)
    .filter(t => /编[号码]|\.code/.test(t)
              && /用[^。\n]{0,30}(编[号码]|\.code|它)[^。\n]{0,30}登录/.test(t)
              && !/不用来登录|不参与|不能登录|不是登录/.test(t));
  // 手册也在内：它是第四处会写「成员怎么登录」的地方，而且是主办照着念给成员听的那一份。
  for (const f of ['ym/index.html', 'ym/member/index.html', 'ym/organizer/index.html',
                   'ym/guide/index.html']) {
    const bad = codeLoginCopy(read(f));
    bad.forEach(t => console.error(`      ↳ ${t.trim().replace(/\s+/g, ' ').slice(0, 96)}`));
    check(f, `${f}: 没有一句文案叫人「用编号登录」(登录框只收邮箱)`, bad.length === 0);
  }

  /* ---------- 上传体积：三条，钉的是同一类错 ----------
     主办端四路 OCR 的字节一个都不进数据库行（rcParse→Drive · capShoot→10 分钟中转行 ·
     rosterShot/formPhoto 根本不留），却卡在 60 万 b64 字符，**比它要打的服务端还严 5 倍** ——
     0005_capture.sql 自己 3,000,000 才拒。结果是主办拍一张正常票据被自己的前端挡下来，
     提示还写「请重拍」，而重拍出来一模一样大。客户端可以比服务端更早拦，但绝不能严到把
     服务端愿意收的正常输入挡掉。把两个数钉在一起：改任何一边都得从这里过。 */
  const cap5 = read('supabase/migrations/0005_capture.sql');
  const srvMax = Number((cap5.match(/length\(p_image\)\s*>\s*(\d+)/) || [])[1] || 0);
  const cliMax = Number((s.match(/OCR_B64_MAX\s*=\s*(\d+)/) || [])[1] || 0);
  check(s, `客户端 OCR 上限不比服务端严 (client ${cliMax} vs server ${srvMax})`,
    srvMax === 3000000 && cliMax > 0 && cliMax <= srvMax && cliMax >= srvMax * 0.9);
  check(s, 'OCR 四路都走常量，没有残留的 60 万硬编码',
    !/>\s*600000/.test(stripComments(s)) && count(s, /OCR_(B64|FILE)_MAX/g) >= 5);
  // 反过来的那一半：OCR 这一档**不许**跟着成员端往下压。インボイス 登録番号是 T+13 位小字，
  // per-line 消費税 率也是小字 —— 降分辨率/画质 = /api/parse 读不出来，且是静默读错，不是报错。
  check(s, 'OCR 档仍是 1600px / q0.85',
    /function shrink\(file,cb\)[\s\S]{0,320}1600\/Math\.max[\s\S]{0,240}toDataURL\('image\/jpeg',\.85\)/.test(s));
  /* 成员端反过来：ym_submit.file_data 就是一列 base64，400KB 是真上限，所以压缩档必须配得上
     它。1600/.85 的照片落 400–800KB，天天撞墙且「请重拍」没有可执行的下一步；1200/.72 落
     150–250KB，上限还在但撞不到。这条盯的是「谁都别再把它调回 1600」。 */
  check(p, '成员端进 DB 行的票据压到 1200px / q0.72，配得上那道 400KB 行上限',
    /function shrinkStore\(file,cb\)[\s\S]{0,320}1200\/Math\.max[\s\S]{0,240}toDataURL\('image\/jpeg',\.72\)/.test(p)
    && !/\bshrink\(f,/.test(p) && count(p, /shrinkStore\(f,/g) === 2);
  // Drive 上传代理 — same shape as the proxy already deployed for Rakusalab / monospages.
  // UPLOAD ONLY, no secret, no delete: the script runs as the Drive owner, so a delete action
  // would trash the owner's files on a caller-supplied id behind nothing but an unguessable URL
  // (owner 2026-07-27: 「我不能接受账户风险」). Upload alone is bounded and reversible.
  const drv = read('api/ym_file.py');
  check(drv, 'the Drive endpoint verifies the caller before forwarding a byte',
    drv.includes('def caller_ok') && drv.includes('status=eq.approved') &&
    drv.includes('revoked=is.false'));
  // 2026-08-02：admin 登录后「整个 app 都能用，唯独上传 403」—— caller_ok 只抄了 ym_ok()
  // 的一半。同一道门两份定义，必须一起改；这里钉住「另一半」在场且在 host 检查之后。
  check(drv, "caller_ok 覆盖 ym_ok() 的两半：approved 主办 + profile.is_admin (0012 §2)",
    /status=eq\.approved[\s\S]{0,400}profile\?select=user_id&is_admin=is\.true/.test(drv)
    && drv.includes('"gate": "ym_ok"'));
  // 一条鉴权查询坏了（语法/表名）只能关自己那道门 —— 以前 caller_ok 一个 except 包全部，
  // 任何一条 400 会让所有非主办统统 403（症状恰好是「不是主办」，2026-08-02 差点误诊）
  check(drv, 'caller_ok 每条查询自己兜异常，探针 ?probe 能分层体检（q_* / gas / trash_key）',
    /def q\(path\):[\s\S]{0,600}except Exception:\s*\n\s*return \[\]/.test(drv)
    && /out\["q_member"\]/.test(drv) && /out\["gas"\]/.test(drv)
    && /"trash_key": bool\(drive_secret\(\)\)/.test(drv)
    // 无鉴权的写探针已经删掉（谁都能往主办网盘塞文件、烧 GAS 配额）。
    // 钉的是**那段代码**不在了 —— 注释里必须讲得清为什么拿掉，所以不能判「这三个字没出现」。
    && !/if "probe=write" in p:/.test(drv) && !/gas_write/.test(drv));
  check(drv, 'it forwards upload_media ONLY — no delete path exists',
    drv.includes("'upload_media'") && !drv.includes('delete_media') &&
    drv.includes('content_base64'));
  check(drv, 'it degrades to 503 when Drive is not wired, so the inline path still works',
    /if not \(ex and url and svc\)[\s\S]{0,200}503/.test(drv));
  // 2026-08-02：GAS 部署 404 了（New deployment 换 URL / 被删都会这样）。对 app 这就是
  // 「没接线」—— 全体用户走既有降级，而不是人人「服务端出错」。
  check(drv, 'GAS /exec 404/410 同样映射成 503「没接线」，不是 502',
    /if e\.code in \(404, 410\):\s*\n\s*return self\._send\(503/.test(drv));
  const gs = read('docs/apps-script-upload.js');
  check(gs, 'the Apps Script files per event and per type',
    gs.includes('const KINDS') && gs.includes('function findOrCreate') &&
    gs.includes('18L2vEdBUukj0qTY4qkNLrYz5Ty7sww3m'));
  /* owner 2026-08-03 把 07-27 的「一个字节都不能删」改成了「受限的丢回收站」。
     改口的是**范围**，不是理由 —— 脚本仍以网盘主人身份跑，/exec 仍对公网开放。
     所以三道限制**缺一不可**，这条断言就是钉着这三道：
       ① 只碰 ROOT_FOLDER_ID 底下（顺父目录链验证）；② 只 setTrashed，永远没有永久删除；
       ③ 要密钥，且没配密钥时功能**整个不存在**（fail closed）。 */
  check(gs, 'trash is scoped: inside-root only, trash-not-purge, and secret-gated (fail closed)',
    /function trashMedia\(body\)/.test(gs)
    && /if \(!want\) return jsonOut\(\{ ok: false, error: 'trash not configured' \}\);/.test(gs)
    && /if \(!insideRoot\(file\)\) return jsonOut/.test(gs)
    && /function insideRoot\(file\)/.test(gs)
    && /fid === ROOT_FOLDER_ID/.test(gs)
    && /file\.setTrashed\(true\)/.test(gs)
    // 永久删除的三种写法一个都不许出现
    && !/setTrashed\(false\)|removeFile|Drive\.Files\.remove|\.deleteFile/.test(stripComments(gs))
    // ⚠ 剥注释再判缺席（规矩 9）：trashMedia 的说明里合法地写着「别把它扩成 delete_media」
    && !/delete_media/.test(stripComments(gs)));
  // 密钥只从 Script Properties 读，不写死在源码里（源码会被贴来贴去）
  check(gs, 'the shared secret is read from Script Properties, never hardcoded',
    /getScriptProperties\(\)\.getProperty\('SHARED_SECRET'\)/.test(gs)
    && !/SHARED_SECRET\s*=\s*['"][^'"]+['"]/.test(gs));
  check(gs, 'names from the caller cannot escape the folder they were given',
    /replace\(\/\[\\\/\\\\\\r\\n\\t\]\+\/g/.test(gs));
  // 并发的 findOrCreate 各自「找不到就建」→ Drive 允许同名目录并存（2026-08-02 实测两份）
  check(gs, 'findOrCreate 有脚本锁 —— 多设备同时上传不再建出重复目录',
    gs.includes('LockService.getScriptLock()') && gs.includes('releaseLock'));
  // 0017 总账: images live in the owner's Drive, this table holds only a reference
  const m17 = read('supabase/migrations/0017_ym_ledger.sql');
  check(m17, '0017: the ledger stores a Drive reference, never image bytes',
    m17.includes('image_id') && m17.includes('image_url') &&
    !/image\s+text,\s*\n\s*--\s*base64/.test(m17) &&
    !/image ~ '\^\[A-Za-z0-9/.test(m17));
  check(m17, '0017: only a google.com link can be stored, so nothing arbitrary is opened',
    /image_url ~ '\^https:\/\/\[a-z\]\+\[\.\]google\[\.\]com\//.test(m17));
  check(m17, '0017: a member-sourced entry must carry its evidence',
    /src not in \('vol','donor'\) or image_id <> ''/.test(m17));
  check(m17, '0017: never reads or writes ym_doc',
    !m17.split('\n').filter(l => !l.trim().startsWith('--') && !/comment on/.test(l))
       .join('\n').includes('ym_doc.payload'));
  const mig15 = read('supabase/migrations/0015_ym_code.sql');
  check(mig15, '0015 deliberately does NOT create a 编码→email resolver',
    mig15.includes('ym_login_target() intentionally NOT created') &&
    !/create or replace function ym_login_target/.test(mig15));
  check(p, 'member page: 邀请码 register + email login, own shares only',
    p.includes('function doRegister') && p.includes('/api/ym_reg') &&
    p.includes('signInWithPassword') && p.includes("from('ym_share')") &&
    !p.includes('verifyOtp') && !p.includes('ym_claim_shares') && !p.includes('must_set_password'));
  // The volunteer's 完成 is an ADDITIVE signal. chip.status lives in ym_doc and is host-only;
  // the member page must not be able to name either.
  // judge the CODE, not the prose: comments legitimately NAME the things they promise not to touch
  // ⚠ 用 stripComments，别手搓：`//.*$` 会把任何含 https:(双斜杠) 的行截断，
  //    朴素的块注释正则又会把 accept="image(斜杠)(星)" 当成注释开头 —— 两者都让
  //    下面这些**负向**断言变瞎（2026-07-28 在 organizer 上实测吃掉 79,882 字符）。
  const pCode = stripComments(p);
  check(pCode, 'member page never touches ym_doc or chip.status — it only files ym_submit rows',
    !pCode.includes('ym_doc') && !pCode.includes('BUCKET_STATUS') && !pCode.includes('chip.status')
    && pCode.includes("from('ym_submit')"));
  // hub-and-spoke: the portal can only render what the payload holds, and it holds no other person
  check(pCode, 'member page shows rundown + own duties, never another member',
    pCode.includes('rundown') && pCode.includes('r.mine') && !pCode.includes('participants'));
  // 0017 §8 opened ONE money surface: a donor declaring THEIR OWN donation. Nothing else — no
  // yen() helper, no 収支 strip, and every `amount` here is either the column list or a row of
  // MINE (the member's own ym_submit rows). If a new line trips this, it is reading someone
  // else's money on a page that has never shown any.
  {
    const money = pCode.split('\n').filter(l => /yen\(|收支|金额|amount/.test(l));
    const allowed = /kind:\s*'give'|r\.amount|amount:isNaN|金额（円|金额为准|select\('id,host/;
    check(pCode, "the only money on the member page is the donor's own declared donation",
      !/yen\(|收支/.test(pCode) && money.length > 0 && money.every(l => allowed.test(l)));
  }
  // a double tap must not 409 — ON CONFLICT DO NOTHING, and there is no member UPDATE policy
  check(p, 're-submitting 交任务 is safe (delete-then-insert + ignoreDuplicates)',
    /sendSubmit[\s\S]{0,900}ignoreDuplicates:true/.test(p));
  check(p, 'member page escapes all published content', count(p, /esc\(/g) >= 10);
  check(p, 'no organizer-profile bootstrap on the member page (host is the gate, not admin)',
    !p.includes("role:'organizer'") && !p.includes("from('profile')"));

  const l = read('ym/index.html');
  check(l, 'landing links the 志愿者入口', l.includes('href="member/"'));
}

// ---------- 资产库 item detail cards (V1.0 information fields) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 资料卡');
  check(s, 'every bank category has a field schema (LIB_FIELDS)',
    ['volunteer:', 'guest:', 'donor:', 'goods:', 'money:', 'ideas:', 'templates:'].every(k => s.includes(k))
    && s.includes('const LIB_FIELDS'));
  check(s, '人员 fields follow V1.0 志愿者名册 (简介/特长/工作经历/志愿服务经历/可服务时间)',
    ['个人简介', '特长', '工作经历', '志愿服务经历', '可服务时间'].every(f => s.includes(f)));
  check(s, '物资 fields follow V1.0 (类别/数量/单位/说明/保存条件/来源)',
    ['类别', '保存条件', '来源 / 供应商'].every(f => s.includes(f)));
  check(s, 'tap any item → 资料卡 editor; action buttons stop propagation',
    s.includes('function libEditOpen') && s.includes('function libEditSave')
    && count(s, /event\.stopPropagation\(\);libDel/g) >= 4);
  check(s, 'editor validates the name field and parses numeric fields',
    s.includes('名称不能为空') && s.includes("k==='dur'||k==='amount'")
    && /if\(k==='unit'\)\{const n=parseInt/.test(s));   // unit is parsed separately: blank ≠ 0
  check(s, 'photo field deferred to the Drive media path (honest note)',
    s.includes('照片随 Drive 媒体通道上线'));
}

// ---------- Y6: publishing (in-house, sanitized) ----------
{
  const m = read('supabase/migrations/0010_ym_post.sql');
  console.log('supabase/migrations/0010_ym_post.sql');
  check(m, 'author CRUD gated on approved organizer; public SELECT only when published',
    m.includes('author = auth.uid() and ym_ok()') && m.includes('for select using (published = true)'));
  check(m, 'published_at stamped server-side on the flip, cleared on unpublish',
    m.includes('new.published_at := now()') && m.includes('new.published_at := null'));
  check(m, 'one derived post per source event (unique index), no FK into ym data',
    m.includes('ym_post_source on ym_post(author, source_id)') && !/references ym_/.test(m));
  check(m, 'migration states that the landing must re-sanitize (DB is not a trust boundary)',
    m.includes('re-sanitize on render'));

  const z = read('ym/sanitize.js');
  console.log('ym/sanitize.js');
  check(z, 'allowlist-construct (KEEP/RENAME/KILL), not denylist-strip',
    z.includes('var KEEP') && z.includes('var RENAME') && z.includes('var KILL') && z.includes('allowlist-CONSTRUCT'));
  check(z, 'kills script/style/svg/math/iframe/object/form subtrees',
    ['SCRIPT:1', 'STYLE:1', 'SVG:1', 'MATH:1', 'IFRAME:1', 'OBJECT:1', 'FORM:1'].every(t => z.includes(t)));
  check(z, 'no style/class/id/name attribute is ever copied (kills CSS tricks + DOM clobbering)',
    !/setAttribute\((['"])(style|class|id|name)\1/.test(z));
  check(z, 'URL scheme allowlist after control-char strip (https/http/mailto only)',
    z.includes('^https?:\\/\\/') && z.includes('\\u0000-\\u0020') && z.includes('mailto:'));
  check(z, 'external links get rel=noopener noreferrer (no reverse tabnabbing)',
    z.includes('noopener noreferrer'));
  check(z, 'depth / node / length / image caps against paste bombs',
    ['MAX_DEPTH', 'MAX_NODES', 'MAX_LEN', 'MAX_IMGS'].every(k => z.includes(k)));
  check(z, 'parses into an INERT document (DOMParser), renders NODES via into()',
    z.includes('new DOMParser()') && z.includes('function into'));

  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 发布');
  check(s, '发布 tab in nav; posts are cloud-only and gated on an approved host',
    s.includes("['post','发布']") && s.includes('发布功能需要登录'));
  check(s, 'paste handler sanitizes clipboard HTML before insertion',
    s.includes('function pePaste') && s.includes('ymSanitize.frag(html)'));
  check(s, 'save sanitizes the body before it reaches the database',
    s.includes('ymSanitize.html($(\'po_body\').innerHTML)'));
  check(s, 'editor body is restored as NODES via into(), never innerHTML assignment',
    s.includes("ymSanitize.into($('po_body')") && !/po_body'\)\.innerHTML\s*=/.test(s));
  check(s, 'link/image insertion runs through the same URL allowlist',
    /ymSanitize\.safeUrl\([^,)]+,false\)/.test(s) && /ymSanitize\.safeUrl\([^,)]+,true\)/.test(s));
  // the link/image dialog steals the caret; execCommand must act on the host's original selection
  check(s, 'link/image dialog restores the caret before execCommand',
    s.includes('function peRestore') && /peRestore\(saved\)[\s\S]{0,90}createLink/.test(s)
      && /peRestore\(saved\)[\s\S]{0,90}insertImage/.test(s));
  check(s, '活动 → 官网 toggle publishes a derived post and unpublish deletes it',
    s.includes('function pubEvent') && s.includes('function syncEventPost') && s.includes('已从官网下架'));
  check(s, 'published events re-sync when the event is edited',
    /function e_upd[\s\S]{0,120}syncEventPost/.test(s));
  check(s, 'no tutorial-event special cases left in the publish path (示例 retired)',
    !s.includes('教学示例不能公开') && !s.includes('教学示例不会发布给志愿者')
    && !s.includes('e.demo=true') && !s.includes('STORE.y6'));

  const l = read('ym/index.html');
  console.log('ym/index.html — live content');
  check(l, 'landing loads the sanitizer and re-sanitizes bodies at render',
    l.includes('src="sanitize.js"') && l.includes('window.ymSanitize.into(body'));
  check(l, 'degrades to TEXT if the sanitizer failed to load (never raw HTML)',
    l.includes('body.textContent=String(p.body_html'));
  check(l, 'titles/summaries/meta are escaped, not interpolated raw',
    l.includes('function esc(') && l.includes('esc(p.title)') && l.includes('esc(m.venue)'));
  check(l, 'anon read is limited to published rows; static fallback survives an empty/failed fetch',
    l.includes('published=eq.true') && l.includes('if(!rows||!rows.length)return;') && l.includes('.catch('));
  check(l, 'deep-linkable posts via #p-<id>', l.includes("'#p-'+p.id") && l.includes("location.hash.indexOf('#p-')"));
}

// ---------- registration control: invite code OR pending approval (0012) ----------
{
  const m = read('supabase/migrations/0012_ym_invite.sql');
  console.log('supabase/migrations/0012_ym_invite.sql');
  check(m, 'ym membership is ORTHOGONAL to the cashflow 区分 (one account can hold both)',
    m.includes('create table if not exists ym_member') && m.includes('orthogonal to profile.role')
    && !m.includes("update profile set status = 'approved', role = 'organizer'"));
  check(m, 'no seat is auto-assigned — a live 会計士 account is never silently converted',
    m.includes('Nothing is auto-granted') && !/insert into whitelist/.test(m));
  check(m, 'ym does NOT redefine the shared profile triggers (no compose-vs-re-derive risk)',
    !/create or replace function profile_before_(ins|upd)/.test(m));
  check(m, 'invite codes readable by admins ONLY (never by the redeemer)',
    m.includes('create policy ym_invite_admin') && m.includes('using (is_admin()) with check (is_admin())'));
  check(m, 'self-approval impossible: ym_member status moves only for admin or a validated redemption',
    m.includes("is_admin() or coalesce(current_setting('ym.grant', true), '') = '1'")
    && m.includes("new.status := 'pending';"));
  check(m, 'ym_ok/ym_author_ok read ym_member (+ admin), not profile.role',
    m.includes('from ym_member m') && m.includes('m.status = \'approved\'') && m.includes('p.is_admin'));
  check(m, 'redeem validates the code BEFORE setting the grant flag, and flag is txn-local',
    m.indexOf('if not found then return \'invalid\'') < m.indexOf("set_config('ym.grant', '1', true)"));
  check(m, 'redeem is not callable by anon; generic failure text leaks nothing',
    m.includes('revoke execute on function ym_redeem_invite(text) from public, anon')
    && m.includes("return 'invalid'") && !m.includes("return 'expired'"));
  check(m, 'definer functions pin search_path', count(m, /set search_path = public, pg_temp/g) >= 4);

  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — register + admin');
  check(s, 'the sheet steers an existing account to 登录, and a code works on login too',
    s.includes('已经有 jjconnect / 记账账号？直接用它登录') && /doSignIn[\s\S]{0,500}localStorage\.setItem\(INV_KEY/.test(s));
  check(s, 'signing up an existing address is detected instead of faking a confirmation mail',
    s.includes('identities.length===0') && s.includes('这个邮箱已经注册过了'));
  check(s, 'an approved-while-open session is picked up (poll + manual 刷新)',
    s.includes('function startPoll') && s.includes('function recheck') && s.includes('管理员已批准？点这里刷新'));
  check(s, 'cloud sync MERGES instead of replacing (no cross-device data loss)',
    s.includes('function mergeLibrary') && s.includes('MERGE, never replace'));
  check(s, 'typing does not steal focus: e_upd/r_upd save WITHOUT a full render',
    /function e_upd\(f,v\)\{const e=ev\(\);e\[f\]=v;save\(\);if\(e\.publicOn\)syncEventPost\(e\);\}/.test(s)
    && /function r_upd\(id,f,v\)\{const r=ev\(\)[\s\S]{0,60}save\(\);\}\}/.test(s));
  check(s, 'selRow moves the .sel highlight in place (no rebuild that would drop the cursor)',
    s.includes('function selRow') && s.includes("classList.remove('sel')") && s.includes('[data-rid="')
    && !/function selRow\(id,evt\)\{S\.sel=id;render\(\);\}/.test(s));
  check(s, 'cards carry data-rid so selRow can target them without a re-render',
    s.includes('data-rid="header"') && s.includes('data-rid="${r.id}"'));
  check(s, 'merge keeps EVERY local-only event incl. the 教学示例 (no empty-app wipe)',
    s.includes('const localKept=(STORE.events||[]).filter(e=>e&&e.id&&!have[e.id])')
    && !s.includes('!have[e.id]&&!e.demo') && s.includes("never leave the host with an empty app"));
  /* demo 行不再产生，但 `!e.demo` 这几道**上传/发布**闸留着当皮带：另一台还开着的老页面
     仍可能把 demo 行推上云，purgeDemo 在加载时兜底，这几处保证它不会再被推出去。 */
  check(s, 'upload/publish belts against demo rows from an older cached page survive',
    s.includes('STORE.events.filter(e=>!e.demo)') && !s.includes('function promoteDemo'));
  check(s, 'an admin does not auto-register into their own 待批准 list',
    s.includes('if(!mem&&!admin)'));
  // ⚠ 距离型断言必须剥注释再跑（规矩 9）：0019 那一轮在 cloudLoad 里加了一整段说明，
  //   源码上的字符距离一下就超了，而代码本身一个字没动。
  // 2026-08-03 换人闸（jjym_owner）加在 cloudLoad 开头，剥完注释的距离 2698 —— 预算跟着放到 3400
  check(s, 'code is redeemed server-side on the first session (survives e-mail confirmation)',
    s.includes("const INV_KEY='jjym_invite'") && s.includes('localStorage.setItem(INV_KEY,JSON.stringify({code,email,exp')
    && /async function cloudLoad[\s\S]{0,3400}redeemInvite\(pend\.code,true\)/.test(stripComments(s)));
  /* 复查 2026-07-28: cloudLoad auto-INSERTed a pending 主办 row for ANY signed-in non-admin with
     no ym_member row — and ym's only login button points at /organizer/. A 志愿者 who tapped it
     landed in the owner's 待批准 list looking identical to a real host application; one careless
     approval and they could mint codes, write ym_doc and publish to the public homepage.
     Two doors must never merge into one indistinguishable queue. */
  check(s, 'a member who opens the 主办台 does not become a pending 主办 application',
    /from\('ym_code'\)\.select\('role,revoked'\)\.eq\('member',SESSION\.user\.id\)/.test(s)
    && /if\(live\.length&&!live\.some\(c=>c\.role==='H'\)\)\{/.test(s)
    && /function memberOnly\(why,withdraw\)\{/.test(s) && /memberOnly\('bound'\);return;/.test(s)
    && /S\.memberOnly=1;S\.memberWhy=why\|\|'bound';S\.auth=true;stopPoll\(\)/.test(s)
    // …and they are told where to go instead of being left on a demo desk
    && /else if\(S\.memberOnly\)/.test(s) && /href="\.\.\/member\/"/.test(s));
  // both GoTrue duplicate shapes, on all three signUp surfaces (confirm-email is currently OFF,
  // so the 422 shape is the live one — but the setting can flip back at any time)
  check(s, 'a duplicate address is told to log in, on every signUp surface',
    (() => {
      const acc = read('accountant/index.html'), cli = read('client/index.html');
      return [s, acc, cli].every(f =>
        /already registered\|already been registered/.test(f)
        && /identities\)&&\s*\n?\s*[a-z]*\.?\s*data?\.?u?s?e?r?\.?identities\.length===0|identities\.length===0/.test(f))
        && /既に登録されています。新規登録ではなく/.test(acc)
        && /既に登録されています。新規登録ではなく/.test(cli)
        && /这个邮箱已经注册过了 —— 请直接用它「登录」/.test(s);
    })());
  check(s, 'pending users can redeem a code without re-registering',
    s.includes('au_code2') && s.includes('function useCode'));
  check(s, '管理 tab renders only for is_admin', s.includes('if(PROFILE&&PROFILE.is_admin)navItems.push')
    && s.includes('仅管理员可见'));
  check(s, 'admin approves / disables ym members, asserting on the returned row',
    s.includes('function adminSet') && s.includes("from('ym_member').update({status}).eq('user_id',uid).select('user_id,status')"));
  check(s, 'admin cannot disable their own ym membership from the UI',
    s.includes("p.user_id!==SESSION.user.id"));
  check(s, 'invite codes generated with CSPRNG and unambiguous alphabet',
    s.includes('crypto.getRandomValues') && s.includes('ABCDEFGHJKMNPQRSTUVWXYZ23456789'));
  check(s, 'admin surface states that is_admin is DB-only', s.includes('is_admin 只能在数据库里改'));

  // --- fixes from the 0012 adversarial review ---
  check(m, 'REGRESSION GUARD: 0012 leaves the shared profile triggers completely alone',
    !m.includes('create or replace function profile_before'));
  check(m, 'the compose-vs-re-derive trap is written down for the next maintainer',
    m.includes('swaps the WHOLE body') && m.includes("dropped 0007's premium locks"));
  check(m, 'a ym registrant can never self-approve at INSERT (server forces pending)',
    m.includes('function ym_member_before_ins') && /new\.status := 'pending';/.test(m));
  check(m, 'ym_invite is admin-only readable', m.includes('create policy ym_invite_admin'));
  check(m, 'rejected is terminal — a disabled account cannot redeem its way back',
    m.includes("if cur = 'rejected' then return 'invalid'"));
  check(m, 'redemption is idempotent per user and only charges a seat once (ym_invite_use)',
    m.includes('create table if not exists ym_invite_use') && m.includes('on conflict (code, user_id) do nothing')
    && m.includes('if n > 0 then'));
  check(m, 'redeem approves ym_member (not profile) behind the txn-local flag',
    /set_config\('ym.grant', '1', true\)[\s\S]{0,120}update ym_member set status = 'approved'/.test(m));
  check(m, 'admin sees ym registrations separately from cashflow ones (origin = which table)',
    m.includes('WHICH TABLE the row is in'));

  const f = read('supabase/migrations/0013_ym_review_fixes.sql');
  console.log('supabase/migrations/0013_ym_review_fixes.sql');
  check(f, 'ym_share gains the same takedown re-check ym_post got in 0011',
    f.includes('member = auth.uid() and ym_author_ok(host)'));
  check(f, 'the link_* rewrite is WITHDRAWN — no live cashflow function is touched',
    f.includes('WITHDRAWN') && f.includes('/*') && f.includes('*/'));
  check(f, 'definer functions missing a pinned search_path are swept',
    f.includes('alter function is_premium()') && f.includes('alter function my_firm_ids()'));
  check(f, 'published content and share fan-out are bounded server-side',
    f.includes('ym_post_size') && f.includes('ym_share_email_shape') && f.includes('ym_share_cap'));
  check(f, 'the cashflow status-gate change is documented, NOT silently applied',
    f.includes('NOT changed here, on purpose') && f.includes('left for an explicit decision'));

  check(s, 'canCloud() mirrors ym_ok() — approved ym_member row (or admin), not a cashflow role',
    s.includes("PROFILE.status==='approved'||PROFILE.is_admin") && s.includes("from('ym_member')"));
  check(s, 'the ym app never writes profile.role (cashflow 区分 stays intact)',
    !s.includes("insert({user_id:SESSION.user.id,role:'organizer'})") && s.includes("from('ym_member').insert({user_id:SESSION.user.id})"));
  check(s, 'pending invite code is bound to the address that typed it, expires, and clears on sign-out',
    s.includes('function readPendingCode') && s.includes('exp:Date.now()+7*86400000')
    && /doSignOut\(\)\{clearPendingCode\(\)/.test(s));
  check(s, 'a disabled (停用) account is told so and gets no redeem box',
    s.includes('此账号已被管理员停用') && s.includes("PROFILE.status==='rejected'"));
  check(s, 'admin writes assert on the returned row, not just on absence of an error',
    s.includes("select('user_id,status')") && s.includes('服务器未接受该修改'));
}

// ---------- Execution revision (执行 tree + desk + lifecycle, owner 2026-07-21) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 执行 revision');
  check(s, 'tasks are a PROJECTION of chips (no task store): 4-state → 3 buckets',
    s.includes("const TASK_ST=['待办','进行中','完成']") && s.includes('function taskBucket')
    && s.includes('const BUCKET_STATUS=[0,1,3]') && !s.includes('holder.tasks'));
  check(s, '执行 tree view + interactions (advance/detail/ignore/restore/add ad-hoc)',
    ['function viewExec', 'function exAdvance', 'function exOpen', 'function exIgnore',
     'function exRestore', 'function exAddTodo'].every(f => s.includes(f)));
  check(s, 'ad-hoc chores = type:\'任务\' chips on the header, excluded from the 资源 strip',
    s.includes("type:'任务'") && /resCounts[\s\S]{0,90}x\.c\.type!=='任务'/.test(s));
  check(s, 'ignored + past events excluded from tasks/followUps/counts (no nag)',
    s.includes('function ignoredTasks') && /followUps[\s\S]{0,120}!x\.c\.ignored/.test(s));
  check(s, 'countdown has undated + past fallbacks (no NaN on the demo)',
    s.includes('日期未定') && /d<0\)return/.test(s) && s.includes('function daysTo'));
  check(s, 'two lifecycle buttons: 进入执行 (plan→run) + 完成/取消 (run→done/cancelled + endedAt)',
    s.includes('function enterExec') && s.includes('function endExec') && s.includes('e.endedAt=new Date()'));
  check(s, 'phase derived: plan/current/hot(14d)/archived from status+endedAt',
    s.includes('function evPhase') && s.includes('const HOT_DAYS=14') && s.includes("e.archived"));
  check(s, '工作台 desk is home (folds in 今日) with 4 phase groups + peek/open',
    s.includes('function viewDesk') && s.includes("['desk','工作台']") && s.includes('function peek') && s.includes('function peekCard'));
  check(s, 'archived route opens a READ-ONLY sheet',
    s.includes('function openArchived') && s.includes('S.readonly=true') && s.includes('.main.ro'));
  // 手册只在工作台露脸的话，主办在计划页卡住时就找不到它。两个入口：工作台 + 头像面板
  // （头像在每一页右上角）。相对路径 —— 写死域名会让本地预览点进线上。
  check(s, '使用手册 is reachable from the desk AND from the avatar sheet (relative, new tab)',
    (() => { const c = stripComments(s);
      return /function guideLink/.test(c) && /href="\.\.\/guide\/" target="_blank" rel="noopener"/.test(c)
        && !/ym\.jjconnect\.tokyo\/guide/.test(c)
        && (c.match(/guideLink\(/g) || []).length === 4   // 1 个定义 + 工作台 + 头像面板 + 登录墙(2026-08-03)
        && /const help=S\.authRecovery\?'':/.test(c);     // 重设密码那一屏不给第二个出口
    })());
  check(s, 'template save-back whitelist-copies (no due/ignored/任务 leak) — the review catch',
    s.includes('refId:c.refId,name:c.name,type:c.type,role:c.role,status:0') && s.includes('const noTask'));
  check(s, 'member page uses the ONE task vocabulary (待办/进行中/完成), not RES_ST',
    s.includes('status:taskLabel(c)'));
  check(s, 'donation-material inventory = one enum on the goods record',
    s.includes("const INV_ST=['待入库','已入库','已发放','已用完']") && s.includes('function cycleInv'));
  check(s, 'read-only is enforced in the mutating fns, not just CSS (apply/cycle/money/pub guarded)',
    count(s, /if\(S\.readonly\)return;/g) >= 6 && s.includes('function pubEvent(on){if(S.readonly)'));
  check(s, 'exSet is a no-op when re-selecting the current bucket (preserves 已确认)',
    s.includes('if(!c||taskBucket(c)===bucket)return'));
  check(s, 'remindAll excludes ignored + ad-hoc 任务 chips (matches followUps)',
    /remindAll[\s\S]{0,140}!x\.c\.ignored&&x\.c\.type!=='任务'/.test(s));
  check(s, 'save-back does not file ad-hoc 任务 chips as library resources',
    s.includes("='任务')return; rseen[c.name]"));
  /* 「进复盘之前先把 S.evId 设对」以前是**每个调用点各写一遍**的一行（`S.evId=…;S.view='review'`）。
     2026-08-05 收成了一个 openReview(id)：一条路好过三份抄写，而且它还多做一件事 ——
     把 S.readonly 关掉，否则归档活动进了复盘也够不着媒体库那颗「从网盘找回」。
     所以这条现在钉三样：函数里 evId 在 goReview 之前、两个入口都走它、且它们**自己**
     不再直接写 S.view（写了就等于绕过 evId 那一步，也绕过了 readonly 那一步）。 */
  check(s, 'desk/peek 进复盘只有 openReview 一条路（先设 evId，再关只读）',
    (() => {
      const c = stripTplNotes(stripComments(s));
      const or = fnBody(c, 'function openReview(id)');
      const dk = fnBody(c, 'function deskOpen(id)'), pk = fnBody(c, 'function peekCard()');
      return /function openReview\(id\)\{S\.evId=id;S\.readonly=false;goReview\(\);\}/.test(or)
        && or.indexOf('S.evId=id') < or.indexOf('goReview()')
        && /else if\(ph==='hot'\)\{openReview\(id\);\}/.test(dk) && !dk.includes("S.view='review'")
        && pk.includes("ph==='hot'?`openReview('${escJs(e.id)}')`") && !pk.includes("S.view='review'");
    })());
  check(s, 'newEvent clears read-only (no stuck-locked new event)',
    s.includes("function newEvent(){S.readonly=false"));
}

// ---------- 示例 retired (2026-08-03) — nothing may reintroduce it ----------
{
  const s = read('ym/organizer/index.html');
  const c = stripComments(s);
  console.log('ym/organizer/index.html — 示例 retired');
  /* 清除是**每次加载都跑的滤网**，不是一次性迁移：老设备、还开着的老缓存页、云端 ym_doc
     里都可能留着 demo 行，一次性迁移挡不住「另一台又推一份上来」。 */
  check(s, 'purgeDemo runs on every load (a filter, not a one-shot migration)',
    c.includes('function purgeDemo()') && /function ensureY2\(\)\{[\s\S]{0,900}purgeDemo\(\);/.test(c)
    && !c.includes('if(!STORE.y8)') && !c.includes('if(!STORE.y6)'));
  /* 库条目只在**没有真实台本引用**时才删：牌子的显示数据是自带的，删条目只会让资产库
     那一栏的档案消失，而「被引用」说明主办已经把它当自己的东西在用了。 */
  /* 🔴 **资产库一条都不许按 demo 标记删** —— 复查在上线前抓到的、差点造成数据毁灭的那条。
     被删掉的 y8 迁移是**按名字**盖章的（`NAMES.res.includes(r.name)` …），而名单里是
     小林/王芳/张姐/场地费/开场介绍/十对十 标准流程 这种沙龙真的会用的名字：主办自己建的
     「场地费」、真名叫王芳的志愿者都被盖了章，章还随 cloudPushAll 进了云端的 library。
     拿它当删除依据 = 删主办的真数据 + 顺着 save() 推上云覆盖。所以只摘标记。
     活动只删「名字就是种子名、且带标记」的那两场。 */
  check(s, 'purge NEVER deletes library items (the demo flag was name-matched onto real data)',
    /function purgeDemo\(\)\{[\s\S]{0,900}\(STORE\.library\[k\]\|\|\[\]\)\.forEach\(x=>\{if\(x\)delete x\.demo;\}\)/.test(c)
    && !/purgeDemo\(\)\{[\s\S]{0,900}STORE\.library\[k\]=\(STORE\.library\[k\]\|\|\[\]\)\.filter/.test(c)
    && /const SEED_EV_NAMES=\['夏日茶会','春日联谊'\]/.test(c)
    && /purgeDemo\(\)\{[\s\S]{0,400}SEED_EV_NAMES\.some\(n=>String\(e\.name\|\|''\)\.indexOf\(n\)>=0\)/.test(c));
  // 界面上的示例机器全部拆掉：徽章 / 【教学】 / 转正 / 合并重复 / 一键清理（owner 明确不要）
  check(s, 'no 示例 UI left: badge, 【教学】, promote, merge-dups, clear-all',
    !s.includes('function dtag(') && !s.includes('${dtag(') && !s.includes('【教学】')
    && !s.includes('function promoteDemo') && !s.includes('function clearDemo')
    && !s.includes('function demoCount') && !s.includes('function dupDemo')
    && !s.includes('function mergeDupDemo') && !s.includes('教学示例')
    && !s.includes('清除所有示例数据') && !s.includes('转为正式活动'));
}

// ---------- 人员 = three registries per V1.0 (志愿者 / 嘉宾 / 捐赠人) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 三类人员名册');
  check(s, 'three people categories declared (志愿者 / 嘉宾 / 捐赠人)',
    s.includes("['volunteer','志愿者']") && s.includes("['guest','嘉宾']") && s.includes("['donor','捐赠人']"));
  check(s, '嘉宾名册 carries the full V1.0 field set incl. all seven 择偶需求',
    ['pref_age', 'pref_edu', 'pref_occupation', 'pref_income', 'pref_area', 'pref_personality', 'pref_other']
      .every(k => new RegExp(`guest:[\\s\\S]{0,1400}\\['${k}'`).test(s)));
  check(s, '捐赠人名册 follows V1.0 (类型/企业名称/联系人/累计金额/次数/物资数量/最近捐赠)',
    ['dtype', 'company', 'contactPerson', 'totalAmount', 'totalCount', 'goodsCount', 'lastDonation']
      .every(k => new RegExp(`donor:[\\s\\S]{0,900}\\['${k}'`).test(s)));
  check(s, 'one store + cat field — existing chips keep resolving by refId',
    s.includes('function catOf') && s.includes('function peoList') && s.includes("r.cat=(r.type==='物')?'goods':'volunteer'"));
  check(s, 'guests are filed into the registry from EVERY intake path (manual/CSV/photo/board)',
    count(s, /fileGuest\(/g) >= 5);
  check(s, 'a repeat guest reuses ONE record (V1.0: 一个嘉宾参加多个活动)',
    s.includes('function fileGuest') && s.includes("peoList('guest').find"));
  check(s, 'guest 资料卡 shows participation history + per-event evaluations',
    s.includes('function guestHistory') && s.includes('function guestHistoryHtml') && s.includes('参加记录'));
  check(s, 'board can invite an existing guest from the registry (repeat-guest path)',
    s.includes('function pickGuestHtml') && s.includes('function addFromLib') && s.includes('从嘉宾名册添加'));
  check(s, 'y7 migration links existing event participants to registry records',
    s.includes('STORE.y7') && /y7[\s\S]{0,260}fileGuest\(p\)/.test(s));
  check(s, 'library PANEL still offers only what can drop on a rundown row (志愿者/物资)',
    s.includes('嘉宾从活动看板加入，不挂在台本行上'));
  check(s, 'only roster records with a minted code are published at all',
    /STORE\.library\.resources\.forEach\(p=>\{/.test(s) && /const a=CODES\[p\.id\];/.test(s));
  // 2026-08-03：加了第四类「主办」，所以标签表不再以 volunteer 开头 —— 断言按内容不按次序
  check(s, 'add-new form exists for EACH kind (主办/志愿者/嘉宾/捐赠人/物资)',
    ['新主办 / 管理人员', '新志愿者 / 工作人员', '新嘉宾', '新捐赠人', '新物资 / 场地'].every(t => s.includes(t))
    && /const LIB_ADD_LBL=\{[\s\S]{0,340}ideas:/.test(s)
    && s.includes('function libAddBtn') && /libAddOpen\('\$\{kind\}'\)/.test(s));
  // 嘉宾 privacy (owner rule 2026-07-20): host fills it in, host alone reads it — not even the guest
  // Owner changed this rule on 2026-07-22: a 嘉宾 MAY hold an account. What must still hold is that
  // the account is PUBLIC-ONLY — it is not a window onto their own record.
  // the 发码 window must describe the role BEING ISSUED: a 捐赠者 has no duties, so the volunteer
  // wording ("自己负责的事") is simply false for them
  check(s, 'the 发码 window explains the actual role, not just guest-vs-other',
    /g\.role==='P'\?'嘉宾只看到/.test(s) && /\(g\.role==='D'\|\|g\.role==='O'\)\?'TA 只看到/.test(s));
  // owner asked for code-issuing AT ADD TIME, not "add, then hunt for the person, then tap 🔑"
  check(s, 'adding a person opens the 发码 window straight away',
    // 剥注释再判顺序（规矩 9）：2026-07-28 在 canCloud() 和 grantOpen() 之间插了一句重名提醒
    /function libAddSave[\s\S]{0,1400}canCloud\(\)\)\{[\s\S]{0,120}grantOpen\(rec\.id\)/.test(stripComments(s))
    // …and 物资/灵感/收支项 have no account, so they must NOT trigger it
    && /kind!=='goods'&&kind!=='ideas'&&kind!=='money'&&canCloud\(\)/.test(s));
  // 报名 must reach the host: a join row the host cannot see or approve is a dead end
  check(s, '嘉宾报名 surfaces on 计划 and the host can approve or decline it',
    s.includes('function joinStrip') && /function joinAccept[\s\S]{0,700}nextBadge\(e,g\)/.test(s) &&
    /function joinReject[\s\S]{0,500}说明（必填）/.test(s) &&
    s.indexOf('${joinStrip(e)}') > s.indexOf('function participantsStrip'));
  // join rows carry no chip — they must never reach the inbox whose 确认完成 calls exSet()
  check(s, "join and claim rows are both excluded from the task inbox",
    /function pendFor[\s\S]{0,220}r\.kind!=='claim'&&r\.kind!=='join'/.test(s));
  // 用户一览: by PERSON, not by asset category — the host should not have to remember whether
  // somebody is filed as a 志愿者 or a 嘉宾 to find them
  check(s, '用户一览 is its own tab and lists people across categories',
    s.includes("['people','用户']") && s.includes('function viewPeople') &&
    /S\.view==='people'\)body=viewPeople\(\)/.test(s) &&
    /function peopleDetail[\s\S]{0,2500}volLogFor\(/.test(s));
  // 复盘 must cover EVERY way a volunteer got attached, or the whole task system is invisible there
  check(s, '复盘 covers refId, volId AND name-assigned volunteers',
    /function volSection[\s\S]{0,900}c\.refId\)return add\(c\.refId\)/.test(s) &&
    /function volSection[\s\S]{0,900}if\(c\.volId\)return add\(c\.volId\)/.test(s) &&
    /function volSection[\s\S]{0,900}idx\[who\]&&idx\[who\]!=='DUP'/.test(s));
  // the volunteer's own figures and the host's are stored apart and NEVER summed
  check(s, '本人申报 is read-only and separate from 主办登记',
    /function selfTally/.test(s) && /class="selfrep"/.test(s) &&
    /placeholder="主办记时长h"/.test(s) && s.includes('两者分开存、不相加'));
  // accepted rows are NOT in the 60s poll — they only grow, so they load on demand
  check(s, 'accepted submissions load on demand, not in the poll',
    /function loadAccepted[\s\S]{0,400}\.eq\('status','accepted'\)/.test(s) &&
    !/function loadPending[\s\S]{0,400}accepted/.test(s));
  // OWNER UNIVERSAL RULE (2026-07-27): always simple line icons, never colour emoji.
  // Apple renders pictographs as full-colour cartoons, which fights this app's hairline look.
  // Typographic line glyphs (→ ← ✕ ✓ ● ♂ ♀ ⊕ ⊖) STAY — they already are lines.
  // ask()'s title now carries markup (an ico() SVG), so it is NOT esc()'d by the dialog.
  // Every call site that puts user data in a title must therefore escape it itself.
  check(s, 'ask() titles holding user data are escaped at the call site',
    !/ask\(\{title:[^\n]*\+(p|c|rec)\.name/.test(s.replace(/esc\((p|c|rec)\.name\)/g,'ESCAPED')));
  check(s, 'there is ONE icon source: inline SVG, currentColor, no emoji',
    s.includes('function ico(n,cls)') && /stroke:currentColor/.test(s) &&
    /\.ico\{width:1\.05em/.test(s));
  check(s, 'no colour emoji survives in rendered markup',
    // comments never render — use the shared stripper rather than a hand-rolled line filter that
    // misses continuation lines inside a /* */ block
    !/[\u{1F300}-\u{1FAFF}]/u.test(stripComments(s)));
  const memIco = read('ym/member/index.html');
  // 自助改密码: the member does it, the host is not involved (owner 2026-07-27). Deliberately NOT
  // a host-reissue path — that would have had to mint a new 用户编码, and ym_code.code is
  // ym_share's FK target and ym_submit's join key, so it would detach a person from their history.
  check(memIco, 'password reset is self-service, with a recovery-session gate',
    memIco.includes('resetPasswordForEmail') && memIco.includes('function doNewPw') &&
    /ev2==='PASSWORD_RECOVERY'\)\{RECOVERY=true;render\(\);return;\}/.test(memIco) &&
    memIco.includes("TAB='pw'"));
  // the forgot form must not answer "does this address have an account"
  // the member page has the identical race — it has had this flow since 2026-07-14
  check(memIco, 'the member reset also survives a missed PASSWORD_RECOVERY event',
    (() => { const code = stripComments(memIco);
      return /const RECOVERY_URL=\/type=recovery\/\.test\(_mhash\)/.test(code)
        && code.indexOf('RECOVERY_URL') < code.indexOf('createClient')
        && /if\(RECOVERY_URL&&SESSION\)\{RECOVERY=true;render\(\);return;\}/.test(code); })());
  check(memIco, 'the forgot form is not an account-existence oracle',
    (() => {
      const code = stripComments(memIco.slice(memIco.indexOf('async function doForgot'),
                                              memIco.indexOf('async function doNewPw')));
      return !!code && code.includes('如果这个邮箱有账号')
        && !/不存在|没有这个|not found|user_not_found/i.test(code)
        && /跟邮箱有没有账号无关/.test(code);
    })());
  check(memIco, 'the member page follows the same icon rule',
    memIco.includes('function ico(n,cls)') &&
    !/[\u{1F300}-\u{1FAFF}]/u.test(
      stripComments(memIco).split('\n').filter(l => {
        const t = l.trim();
        return !(t.startsWith('/*') || t.startsWith('*') || l.includes('*/'));
      }).join('\n')));
  check(s, '物资 can never be given an account, and H is not host-issuable',
    /function grantOpen[\s\S]{0,300}catOf\(p\)==='goods'/.test(s) &&
    /function issuableRoles[\s\S]{0,300}'志愿者'/.test(s) &&
    !/function issuableRoles[\s\S]{0,300}\['H'/.test(s));
  // The published payload is CODE, not comments — strip the comments before judging it.
  // brace-match to the function's own closing brace: slicing to the next `function ` swept in the
  // doc-comment of shareDataFor, whose text names duties/desc and produced a false leak report
  const guestBody = (() => {
    const i = s.indexOf('function guestDataFor');
    if (i < 0) return '';
    let d = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '{') d++;
      else if (s[j] === '}') { d--; if (!d) { j++; break; } }
    }
    return stripComments(s.slice(i, j));
  })();
  check(s, "a 嘉宾 account publishes the PUBLIC view only — never their own 资料卡",
    ['badge','notice','rundown','theme'].every(k => guestBody.includes(k))
    && !['occupation','age','evals','contact','intro','duties','desc','money','volLog','hours','review']
        .some(k => guestBody.includes(k))
    && /if\(r==='P'\)return guestDataFor\(p\)/.test(s));
  // no chipId in the payload => 0014's ym_share_has_chip() can never match => the DATABASE, not the
  // UI, is what stops a guest filing a submission
  check(s, 'a 嘉宾 has no write surface: their payload carries no chipId at all',
    !!guestBody && !guestBody.includes('chipId'));
  check(s, 'the 发布池 is a separate pool[], never merged into duties[]',
    /const duties=\[\],pool=\[\]/.test(s) && /duties,pool,/.test(s));
  const mem = read('ym/member/index.html');
  // 我想参加 must actually be REACHABLE: joinBtn existed but nothing called it, so the whole
  // 报名 feature was dead on arrival
  // 难度 is a picker in BOTH editors, and jobEditSave must not read the status off it
  check(s, '难度 C/B/A/S/SS is picked in 计划 and 执行, default C',
    s.includes("const DIFF_ST=['C','B','A','S','SS']") &&
    /diffPick\(d\.diff,'jeDiff\(\$D\)'\)/.test(s) && /diffPick\(c\.diff,/.test(s) &&
    /c\.diff=diff/.test(s));
  // the 难度 row is also an .exseg and sits ABOVE the status row — a bare querySelector reads
  // the status off the wrong control
  // BOTH the reader (jobEditSave) and the writer (jeStatus) must exclude the 难度 row: it is also
  // an .exseg and sits FIRST, so a bare selector numbers the two rows as one control
  check(s, 'every status selector excludes the 难度 row',
    s.includes(".jobdlg .exseg:not(.diffseg)") &&
    /function jeStatus[\s\S]{0,200}\.exseg:not\(\.diffseg\) \.sb/.test(s) &&
    !/querySelectorAll\('\.jobdlg \.exseg \.sb'\)/.test(s));
  // 星级 lives on ym_code (server-side), is host-awarded, and only workers have one
  check(s, '星级 is awarded through ym_set_rank and only for V roles',
    /function rankRow[\s\S]{0,300}a\.role!=='V'\)\)return ''/.test(s) &&
    /rpc\('ym_set_rank',\{p_code:code,p_rank:r\}\)/.test(s));
  // hours must not be double-counted: the volunteer's own accepted rows vs the host's 复盘 figure
  check(mem, 'contribution sums the volunteer\'s ACCEPTED rows; 复盘 hours are shown separately',
    /function contribHtml[\s\S]{0,400}r\.status==='accepted'/.test(mem) &&
    /主办另有登记/.test(mem) && !/hrs\+=.*logged|logged\+hrs/.test(mem));
  check(mem, 'the 可报名 list renders and is the only thing that calls joinBtn',
    mem.includes('function joinList') && /\$\{joinList\(row\)\}/.test(mem) &&
    /joinList[\s\S]{0,1100}joinBtn\(row\.host,evId\)/.test(mem));
  // owner 2026-07-27:「从名册选择的也应计入报名侧，在被邀请用户同意以后」— an invitation is
  // shown to the guest, but ONLY their own 我想参加 turns it into a signup. Invite ≠ signup.
  check(mem, 'an invited guest is told so, and still has to accept for it to count',
    /o\.invited\?`<div class="invtag">/.test(mem)
    && /sort\(\(a,b\)=>\(b\.invited\?1:0\)-\(a\.invited\?1:0\)\)/.test(mem)
    // the invite flag must not short-circuit the join button
    && !/o\.invited\?[\s\S]{0,120}已报名/.test(mem));
  check(mem, 'the member page renders 嘉宾 with no upload and no 完成 button',
    mem.includes('function guestShareHtml') &&
    (() => {
      const i = mem.indexOf('function guestShareHtml');
      const body = mem.slice(i, mem.indexOf('\nfunction ', i + 10));
      return !body.includes('claimDone') && !body.includes('upFile') && !body.includes('fileup');
    })());
  check(s, 'guest privacy stated where the host works (registry form + 资料卡)',
    s.includes('嘉宾本人、志愿者、其他任何人都看不到') && s.includes('只有主办方看得到'));
  check(s, 'nothing guest-shaped can reach ym_share (shares are built from volunteer chips only)',
    /function shareDataFor[\s\S]{0,900}chipOwnedBy/.test(s) && !/shareDataFor[\s\S]{0,900}participants/.test(s));
  // hub-and-spoke: publishing a row's owner or its resource chips would show one volunteer another
  check(s, 'the published rundown carries time/环节/说明 only — no other volunteer',
    /rundown:e\.rows[\s\S]{0,200}time:r\.time[\s\S]{0,120}desc:r\.desc/.test(s) &&
    !/rundown:e\.rows[\s\S]{0,240}(r\.owner|r\.resources)/.test(s));
  // an ambiguous 负责人 name must reach NOBODY rather than the wrong person
  check(s, 'a duplicate volunteer name fails closed',
    /m\[n\]=m\[n\]\?'DUP':r\.id/.test(s) && /idx\[who\]===p\.id/.test(s));
  // the ONE conversion point: a volunteer signal becomes state only through the host's own setter
  check(s, "a volunteer's 完成 only flips the chip via the host's exSet, never directly",
    /function pendAccept[\s\S]{0,700}exSet\(cid,2\)/.test(s) &&
    !/function pendAccept[\s\S]{0,700}(c\.status=|BUCKET_STATUS\[)/.test(s) &&
    /function pendAccept[\s\S]{0,400}await cloudLoad\(\)/.test(s));
  // the 60s inbox poll must never drag base64 receipts across the wire
  check(s, 'the pending poll never selects file_data',
    (() => { const m = /function loadPending[\s\S]{0,400}?\.select\('([^']*)'\)/.exec(s);
      return !!m && m[1].includes('member_code') && !m[1].includes('file_data'); })());
  // 取消授权 / 名册删除 / 换邮箱 must ALL take the uploads away, not just the read access
  check(s, 'losing access goes through ym_revoke_code (share + submissions, atomically)',
    /p_code:a\.code,p_off:off/.test(s) && /p_code:a\.code,p_off:true/.test(s));

  // ---- regressions from the adversarial review (2026-07-22) ----
  // CRITICAL: member-controlled file_data was interpolated raw into src="…" on the host's origin
  check(s, 'a receipt is rendered as a NODE with the base64 charset stripped, never attribute HTML',
    (() => {
      const i = s.indexOf('function pendOpenFile');
      if (i < 0) return false;
      const body = s.slice(i, s.indexOf('\nfunction ', i + 10));   // this function only
      return /replace\(\/\[\^A-Za-z0-9\+\/=\]\/g,''\)/.test(body)
        && body.includes("createElement('img')") && body.includes("createElement('a')")
        && !body.includes('innerHTML');
    })());
  // esc() entity-decodes back to a live quote inside an on*= handler — a separate escaper is needed
  check(s, 'text interpolated into handler JS goes through escJs, not esc',
    /function escJs[\s\S]{0,160}replace\(\/'\/g,"\\\\'"\)/.test(s) &&
    !/aiPhrase\([^)]*\$\{esc\(/.test(s));
  // HIGH: the 60s poll rebuilt the DOM, discarding whatever the host was typing
  check(s, 'the pending poll repaints only on real change and never over an open editor',
    /function loadPending[\s\S]{0,900}JSON\.stringify\(next\)===JSON\.stringify\(PENDING\)/.test(s) &&
    // every surface that holds unsaved typing must be on this list — the 票据确认卡 (S.rc) and the
    // 资料卡/新建 (S.libEdit/S.libAdd) were added after the poll was written and were being wiped
    ['S.postEdit', 'S.jobEdit', 'S.rc', 'S.libEdit', 'S.libAdd'].every(k =>
      new RegExp('!' + k.replace('.', '\\.') + '&&').test(s.slice(s.indexOf('function loadPending'),
        s.indexOf('function loadPending') + 1400)))
    && /!\$\('askwrap'\)&&!\$\('grantwrap'\)/.test(s));
  // HIGH: 确认完成 inside the job editor re-rendered the dialog from saved state
  check(s, 'the job editor keeps in-flight typing across a render',
    s.includes('function jeKeep') && /const d=je\.draft\|\|c\|\|/.test(s) &&
    (s.match(/oninput="jeKeep\(\)"/g) || []).length >= 4);
  // HIGH: 退回 also rejected the receipts, which the member can never resend (no UPDATE policy)
  check(s, '退回 rejects the 完成 claim only — 票据 stay in the host\'s inbox',
    /function pendReject[\s\S]{0,900}done\.length\?done:rows/.test(s));
  // MEDIUM: two volunteers on one chip were shown as one, and decided with one tap
  // 0017 §8 added a third argument (the 捐赠 row id) — the per-submitter grouping is unchanged,
  // and the donor arm names ONE row so a second receipt from the same donor is not swept along.
  check(s, 'pending is grouped per submitter, and accept/reject act on that person only',
    /function pendFor\(cid,mc\)/.test(s) &&
    /function pendAccept\(cid,mc\)[\s\S]{0,700}pendFor\(cid,mc\)/.test(s) &&
    /function pendReject\(cid,mc,sid\)[\s\S]{0,900}pendFor\(cid,mc\)/.test(s) &&
    /kind==='give'&&r\.id===sid&&String\(r\.member_code\|\|''\)===mc/.test(s));
  check(s, '退回 requires an explanation',
    /function pendReject[\s\S]{0,900}退回说明（必填）/.test(s) && /host_note:why/.test(s));
  // MEDIUM: PENDING/SHARE_ST outlived the session, exposing the previous host's volunteers
  check(s, 'sign-out clears the cloud caches and kills the poll timer',
    // 距离放宽：2026-07-28 这个函数里又加了 capStop() 和几个界面状态的清理
    /function doSignOut[\s\S]{0,400}PENDING=\[\];CODES=\{\};/.test(s) &&
    /function doSignOut[\s\S]{0,900}clearInterval\(_pendT\)/.test(s) &&
    /function pendAccept[\s\S]{0,80}!canCloud\(\)/.test(s));
  // a submission on a non-current event was invisible (pendFor scopes to ev())
  check(s, 'the desk card surfaces 待确认 so other events are not silently ignored',
    /dc-m[\s\S]{0,300}pendCount\(e\)/.test(s));
}

// ---------- 注册端点: it holds the service key, so it must gate on what it is handed ----------
{
  const a = read('api/ym_reg.py');
  // The 邀请码 is the whole gate: 16 symbols from a 32-glyph alphabet, single-use, host-minted,
  // one week. It is checked BEFORE anything is created, so a wrong code costs no orphan user.
  check(a, 'the code is validated before any account is created',
    a.includes('ym_check_code') && a.indexOf('ym_check_code') < a.indexOf('admin/users'));
  check(a, 'the role is never taken from the request body',
    !/body\.get\(["']role["']\)/.test(a) && a.includes('ym_redeem_code'));
  // Supabase's built-in mailer cannot reach outside the org team, so a confirmation email would
  // never arrive; we create the user already-confirmed instead of stranding them.
  check(a, 'the account is created already-confirmed (no undeliverable confirmation mail)',
    a.includes('email_confirm'));
  // one error body for every failure: a distinct "this email is taken" would be an account oracle
  check(a, 'every failure returns ONE generic body (no account-existence oracle)',
    a.includes('BAD = {"error": "bad"}') && (a.match(/self\._send\(4\d\d, BAD\)/g) || []).length >= 4);
  check(a, 'registration attempts are rate-limited',
    a.includes('ym_auth_gate'));

  const m = read('supabase/migrations/0014_ym_volunteer.sql');
  check(m, '0014: a member may only file against a chip the host already published to them',
    m.includes('ym_share_has_chip') && /with check \(member = auth\.uid\(\)[\s\S]{0,400}ym_share_has_chip/.test(m));
  check(m, '0014: members read their OWN rows only, and lose them on 取消授权',
    /for select to authenticated\s*\n\s*using \(member = auth\.uid\(\) and ym_linked\(host\)\)/.test(m));
  check(m, '0014: there is NO member UPDATE policy (edit = delete + re-insert)',
    !/create policy ym_submit_member_upd/.test(m) && m.includes('status <> \'accepted\''));
  check(m, '0014: identity and verdict are forced server-side',
    /new\.member\s*:=\s*auth\.uid\(\)/.test(m) && /new\.status\s*:=\s*'pending'/.test(m));
  check(m, '0014: ym_grant_target is service_role only (it is an email-existence oracle)',
    /revoke execute on function ym_grant_target\(uuid, text\) from public, anon, authenticated/.test(m) &&
    /grant\s+execute on function ym_grant_target\(uuid, text\) to service_role/.test(m));
  check(m, '0014: bounded on both axes — per row and per fan-out',
    m.includes('ym_submit_size') && m.includes('ym_submit_cap') && m.includes('600000'));
  // ---- regressions from the adversarial review (2026-07-22) ----
  // CRITICAL: ym_share.member was host-writable, so a host could assert a victim's uid, satisfy
  // ym_grant_target's 'linked' branch and be handed a magiclink for that person's account.
  check(m, '0014: ym_share.member is claimed-only (host writes to it are inert)',
    m.includes('ym_share_member_guard') && /u\.id = auth\.uid\(\)/.test(m) &&
    /lower\(u\.email\) = lower\(new\.member_email\)/.test(m) &&
    /new\.member := prev/.test(m));
  check(m, "0014: 'linked' is re-derived from auth.users, not read off the stored column",
    /select exists\(select 1 from auth\.users a[\s\S]{0,220}email_confirmed_at is not null/.test(m));
  // HIGH: re-issuing a code before the volunteer opened the first one used to answer 'taken'
  check(m, '0014: an unopened invite shell can be re-issued, not declared somebody else\'s account',
    /invited_at is not null[\s\S]{0,120}last_sign_in_at is null/.test(m));
  // CRITICAL: file_data is member-controlled and lands in a data: URL on the host's origin
  check(m, '0014: file_data is constrained to the base64 charset, not just length',
    /file_data ~ '\^\[A-Za-z0-9\+\/\]\*=\{0,2\}\$'/.test(m));
  check(m, '0014: does not touch ym_share, ym_member or ym_claim_shares',
    !/alter table ym_share add column|drop trigger ym_share_touch/.test(m) &&
    !/create or replace function ym_claim_shares/.test(m) &&
    !/update ym_member/.test(m));
}

// ---------- hardening from the adversarial review (0011) ----------
{
  const h = read('supabase/migrations/0011_ym_hardening.sql');
  console.log('supabase/migrations/0011_ym_hardening.sql');
  check(h, 'ym_ok() gates on ROLE too — an approved cashflow client can no longer write ym data',
    h.includes("p.role = 'organizer'") && h.includes('coalesce(p.is_admin, false)'));
  check(h, 'takedown path: public reads re-check the author is still an approved organizer',
    h.includes('function ym_author_ok') && h.includes('ym_author_ok(author)'));
  check(h, 'public post policy scoped TO ANON (no cross-organizer leak into authenticated reads)',
    h.includes('for select to anon'));
  check(h, 'unique index made non-partial so upsert on_conflict can infer it (公开到官网 works)',
    h.includes('drop index if exists ym_post_source') && !/ym_post_source on ym_post\(author, source_id\)\s*\n?\s*where/.test(h));
  check(h, 'share claims require a CONFIRMED e-mail address',
    h.includes('email_confirmed_at is not null'));
  check(h, 'definer functions pin search_path including pg_temp',
    count(h, /set search_path = public, pg_temp/g) >= 3);

  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — review fixes');
  check(s, 'post list is author-scoped in the query, not only by RLS',
    s.includes(".eq('author',SESSION.user.id)"));
  check(s, 'save refuses when the sanitizer is missing (never blanks a published article)',
    s.includes('净化组件未加载'));
  check(s, 'delete/unpublish verify affected rows instead of reporting false success',
    s.includes("delete().eq('id',p.id).select('id')") && s.includes('没有删除任何内容'));
  check(s, 'a failed event publish also removes any stale card from the public site',
    /syncEventPost[\s\S]{0,600}e\.publicOn=false[\s\S]{0,300}from\('ym_post'\)\.delete\(\)/.test(s)
    && s.includes('公开失败，已从官网撤下'));

  const z = read('ym/sanitize.js');
  console.log('ym/sanitize.js — review fixes');
  check(z, 'depth cap flattens to text and stops recursing (bounds stack depth)',
    /depth >= MAX_DEPTH[\s\S]{0,220}createTextNode\(txt\)/.test(z) && !z.includes('build(node, out, state, depth); continue;'));
  check(z, 'length truncation never leaves a lone surrogate', z.includes('\\uD800-\\uDBFF'));

  const l = read('ym/index.html');
  console.log('ym/index.html — honesty fix');
  /* 免責文ではなく**作り話そのもの**を消した（2026-08-06）。ページは空の状態で出荷し、
     実データが来たところだけ差し替わる。だから「示例」と断る対象がもう無い。 */
  check(l, 'landing ships with NO fabricated content — nothing left to disclaim',
    !l.includes('demo-note') && !l.includes('部分内容为示例占位')
    && !/420\+|对成功牵手|夏日茶会 · 十对十|促成3对牵手/.test(l)
    && l.includes('近日中に公開します'));
}

// ---------- ym/index.html (public news landing) ----------
{
  const s = read('ym/index.html');
  console.log('ym/index.html');
  check(s, 'navbar has 组织介绍 / 活动 / 文章 / 新闻 anchors + 主办登录',
    ['#about', '#events', '#articles', '#news'].every(a => s.includes(`href="${a}"`)) && s.includes('主办登录'));
  check(s, 'login routes to the organizer app (relative, cleanUrls-safe)',
    count(s, /href="organizer\/"/g) >= 1);
  check(s, 'all four content sections exist with ids',
    ['id="about"', 'id="events"', 'id="articles"', 'id="news"'].every(a => s.includes(a)));
  check(s, 'no fabricated activity/stats on the public page', !/420\+|对成功牵手|促成3对牵手/.test(s));
  check(s, 'front-of-house is light (stock bg) with felt navbar — inverse of the app',
    s.includes('--stock:#F4EFE2') && /header\{[^}]*background:var\(--felt\)/.test(s));
  // Y6: the landing now reads published posts. It must stay READ-ONLY and key-safe:
  // publishable key only, no writes, no auth, no AI endpoints, no service key.
  check(s, 'landing is read-only: anon GET of ym_post only — no writes/auth/AI/service key',
    s.includes('sb_publishable_') && !s.includes('service_role') && !s.includes('SUPABASE_SERVICE')
    && !s.includes('/api/') && !/method:\s*['"](POST|PUT|PATCH|DELETE)/i.test(s)
    && !s.includes('auth.signIn') && !s.includes('supabase-js'));
  check(s, 'fonts URL is well-formed', s.includes('family=Oswald:wght@400;600') && !s.includes('wghtght'));
}

// ---------- Y7 step 7: 一键发布 + 抢单 (0016_ym_claim.sql) ----------
// ym_claim_task() is SECURITY DEFINER and therefore bypasses RLS: it is not a helper next to a
// policy, it IS the policy. These guard the four things that makes true.
{
  const m = read('supabase/migrations/0016_ym_claim.sql');
  const s = read('ym/organizer/index.html');
  const p = read('ym/member/index.html');
  // `--` line comments are stripped before the "does it touch X" assertions, because a prose
  // mention of a table must not read as a statement against it — and a SQL string literal must
  // not either, which is why the function's COMMENT deliberately says "host document".
  const bare = m.replace(/--[^\n]*/g, '');
  console.log('supabase/migrations/0016_ym_claim.sql');
  check(m, 'the winner is a partial UNIQUE index over PENDING claims, with a BARE do-nothing',
    /on ym_submit\(host, event_id, chip_id\) where kind = 'claim' and status = 'pending'/.test(m)
    && /on conflict do nothing/.test(m) && !/on conflict \(/.test(m));
  check(m, 'both terminal states free the arbiter (退回 keeps its 说明; 指派 frees re-publishing)',
    /status = 'pending'/.test(m) && /function claimReject[\s\S]{0,900}status:'rejected'/.test(s)
    && /function claimAccept[\s\S]{0,1600}claimDrop\(r\.id\)/.test(s));
  check(m, 'linkage + role + 星级 come from ONE ym_code row, never from the payload',
    /select c\.code, c\.rank, c\.role into/.test(m)
    && m.includes('ym_rank_n(v_rank) < ym_rank_n(v_diff)'));
  check(m, 'pool membership is the caller\'s OWN ym_share row (host-written, unforgeable)',
    /s\.member_code = v_code/.test(m) && m.includes("payload->>'kind' = 'vol'")
    && /j->>'eventId' = p_event/.test(m) && /p->>'chipId'  = p_chip/.test(m));
  check(m, 'an unreadable 难度 fails CLOSED to SS (ym_rank_n maps unknown to C, i.e. OPEN)',
    /not in \('C','B','A','S','SS'\) then\s*\n\s*v_diff := 'SS'/.test(m));
  check(m, 'only role V may claim, refused BEFORE any payload is read (hard constraint 4)',
    m.indexOf("if v_role <> 'V'") < m.indexOf('from ym_share s'));
  check(m, 'no existence oracle: pool membership < 星级 < 已被领取',
    m.indexOf("p->>'chipId'") < m.indexOf("return 'rank'")
    && m.indexOf("return 'rank'") < m.indexOf("return 'taken'"));
  check(m, 'every ceiling ym_submit_cap RAISEs on is pre-checked, so a volunteer never meets a 500',
    (m.match(/return 'slow'/g) || []).length >= 3 && /ym_submit_member_at/.test(m));
  check(m, 'the gate touches no ym_doc and no ym_member, and restates no policy',
    !/ym_doc|ym_member/.test(bare) && !/create policy|drop policy/.test(m));
  check(m, 'definer + pinned search_path + explicit revoke/grant pair (house style 0008–0015)',
    /security definer set search_path = public, pg_temp/.test(m)
    && /revoke execute on function ym_claim_task\(uuid, text, text\) from public, anon/.test(m)
    && /grant  execute on function ym_claim_task\(uuid, text, text\) to authenticated/.test(m));

  console.log('ym/organizer/index.html — 一键发布 / 抢单');
  check(s, 'ONE predicate feeds both the 发布 sweep and the published pool[] (0016 reads it as truth)',
    /function unclaimed\(c\)\{/.test(s) && s.includes('if(c.open&&unclaimed(c))')
    && /function exOpenable[\s\S]{0,140}unclaimed\(x\.c\)&&!x\.c\.open/.test(s));
  check(s, 'unclaimed() excludes 已指派 / 已搁置 / 非待办 / 非任务',
    /function unclaimed[\s\S]{0,300}!c\.refId&&!c\.volId&&!c\.ignored&&taskBucket\(c\)===0/.test(s));
  check(s, '抢单 and 交任务 are disjoint at the data layer — 确认完成 can never fire on a claim',
    /function pendFor[\s\S]{0,320}r\.kind!=='claim'/.test(s) && s.includes('function claimFor'));
  check(s, 'a won task is hard-linked by volId, so a duplicated or blank 名册 name reaches TA anyway',
    /function chipOwnedBy[\s\S]{0,900}if\(c\.volId\)return c\.volId===p\.id;[\s\S]{0,90}if\(c\.refId\)/.test(s));
  check(s, 'the conversion is a HOST write, and the pool is pushed BEFORE the arbiter slot frees',
    /function claimAccept[\s\S]{0,1600}c\.volId=p\.id;c\.role=p\.name;c\.open=undefined;[\s\S]{0,200}save\(\);[\s\S]{0,220}await pushShares\(\);[\s\S]{0,140}claimDrop\(r\.id\)/.test(s));
  check(s, 'claimAccept re-checks the live 台本 — the host session is the only reader of ym_doc',
    /function claimAccept[\s\S]{0,1400}if\(!unclaimed\(c\)&&c\.volId!==p\.id\)/.test(s));
  check(s, 'retyping 负责人 drops a stale volId (else the card shows a new name and mails the old one)',
    /function jobEditSave[\s\S]{0,1600}if\(c\.volId\)\{const vp=/.test(s));
  check(s, 'the 认领池 toggle is NOT a third .exseg (jobEditSave would read the status off it)',
    s.includes('class="pubseg"') && !/exseg pubseg|pubseg exseg/.test(s));
  check(s, '一键发布 refuses when there is no cloud to publish to',
    /function exPublishAll[\s\S]{0,420}canCloud\(\)/.test(s));
  check(s, 'the 发布池 payload still carries no person, and no "somebody took this" flag',
    /pool\.push\(\{chipId:c\.id,where,time,name:c\.name/.test(s)
    && !/pool\.push\([\s\S]{0,200}(member_code|volId|role:)/.test(s) && !/taken:/.test(s));

  console.log('ym/member/index.html — 抢单');
  check(p, '抢单 goes through the atomic RPC only — never a direct insert',
    p.includes("sb.rpc('ym_claim_task'") && !/kind:\s*'claim'/.test(p));
  check(p, 'a loser is told 该任务已经被领取 and nothing else — no name, no 编码, no count',
    /r==='taken'[\s\S]{0,140}该任务已经被领取/.test(p));
  check(p, '星级 is read from the member\'s own ym_code row, not from the published payload',
    /function rankFor[\s\S]{0,180}codeFor\(h\)/.test(p) && !/\bd\.rank\b/.test(p));
  check(p, 'a rank-locked task is SHOWN and greyed, never hidden (§B5)',
    /function poolHtml[\s\S]{0,1800}ico\('lock'\)\}需/.test(p)
    && /duty\$\{\(\(locked&&!mine\)\|\|TAKEN\[k\]\)\?' lk'/.test(p));
  check(p, 'the pool card reads no identity field belonging to anyone else',
    (() => { const b = p.slice(p.indexOf('function poolHtml'), p.indexOf('function claimNotes'));
             return !!b && !/member_code|\bowner\b|\.who\b|volId/.test(b); })());
  check(p, '§B3\'s mandatory 退回说明 survives even after the pool entry disappears',
    p.includes('function claimNotes') && /function claimNotes[\s\S]{0,800}status==='rejected'/.test(p));
}

// ---------- Y8: 票据 → 収入及开支総勘定元帳 ----------
// Half of this section RUNS the code. The Y8 module's arithmetic half is pure — dates, per-rate
// tax, 借方/貸方, the accumulators, both CSVs — so it is sliced out of the HTML and evaluated
// against fixtures instead of being pattern-matched. A regex cannot tell you that 8% + 10% on one
// receipt reaches the CSV as two rows that foot back to the total; only running it can.
{
  const s = read('ym/organizer/index.html');
  const p = read('ym/member/index.html');
  const m17 = read('supabase/migrations/0017_ym_ledger.sql');
  const m18 = read('supabase/migrations/0018_ym_entry_cap_fix.sql');
  console.log('ym — Y8 票据 → 台账 (static)');

  // all four entry points reach the ONE card — design 2 shipped two of them as silent no-ops
  check(s, 'the confirm card is GLOBAL (render tail), not rendered from one view',
    /\$\{S\.rc\?rcCard\(\):''\}/.test(s) && !/S\.rc\?rcCard\(\)[^\n]*viewSheet/.test(s));
  check(s, 'four entry points call rcShoot: 主办台(event-less) · 收支 strip · 任务 · 复盘 · 总账',
    (s.match(/rcShoot\(this,\{src:'host'/g) || []).length >= 5
    && /onchange="rcShoot\(this,\{src:'host',evId:''\}\)/.test(s));       // the event-less one
  check(s, '总账 is reachable but is NOT a 6th nav tab (375px)',
    /go\('ledger'\)/.test(s) && /S\.view==='ledger'/.test(s)
    && !/\['ledger','?总账'?\]/.test(s) && !/navItems\.push\(\['ledger'/.test(s));
  // owner 2026-07-27: a desk receipt has no event context, so 归到哪 is asked UP FRONT — buried
  // under 更多 it silently defaulted every desk receipt to 一般费用, which is what finance sorts by
  check(s, 'a 主办台 receipt asks which event (or 一般费用) on the card, not under 更多',
    /const deskEntry=!c\.evId/.test(s)
    && /const evSel=[\s\S]{0,200}这笔算在哪/.test(s)
    && /\$\{deskEntry\?evSel:''\}/.test(s) && /\$\{deskEntry\?'':evSel\}/.test(s)
    // exactly one #rc_ev in the DOM, whichever branch runs
    && (s.match(/id="rc_ev"/g) || []).length === 2      // the select (in evSel) + the hidden fallback
    && /\$\{deskEntry\?'':`<input type="hidden" id="rc_ev"/.test(s));
  check(s, '「共通」 is called 一般费用 everywhere finance reads it',
    !/'共通'|共通（不挂活动）/.test(s) && /evName\(r\.event_id\)\|\|'一般费用'/.test(s)
    && /evName\(r\.event_id\)\|\|'一般費用'/.test(s));
  check(s, 'the ledger loads at cloudLoad, so 任务/复盘 have it too (not only the 总账 view)',
    /loadCodes\(\)\.then\(pushShares\);loadPending\(\);loadLedger\(1\)/.test(s));
  // the whole reason the member's bytes are copied: ym_revoke_code() deletes the ym_submit row
  check(s, 'a member-sourced posting refuses to file without its own copy of the evidence',
    /if\(!img\.id&&\(c\.src==='vol'\|\|c\.src==='donor'\)\)/.test(s));
  // the frontend can ship before 0018 is applied; 42703 then names a column the host never saw
  check(s, 'an un-migrated database says so, instead of quoting a trigger\'s column name',
    /function ledgerNotReady/.test(s) && /42703/.test(s)
    && (s.match(/ledgerNotReady\(/g) || []).length >= 3);   // definition + both writers
  // judge the ROW LITERALS, not the file: `image:` is also /api/parse's own request field, which is
  // legitimate. Every ym_entry row must carry a Drive reference and no bytes.
  check(s, 'no receipt byte goes near the ledger: rows name image_id/image_url, never image:',
    (() => { const rows = s.match(/const row=\{host:SESSION\.user\.id[\s\S]*?\};/g) || [];
      return rows.length === 2 && rows.every(r => /image_id:/.test(r) && /image_url:/.test(r)
        && !/\bimage:/.test(r) && !/\bparse:[^\n]*b64/.test(r)); })());
  check(s, "self-paid (志愿者自付) writes ZERO ledger rows — only the submission is accepted",
    /function rcSelfOnly[\s\S]{0,400}ym_submit'\)\.update/.test(s)
    && !/function rcSelfOnly[\s\S]{0,400}ym_entry/.test(s));
  check(s, 'chip.actual is re-summed from scratch (Σ), never adjusted by a delta',
    /function rcSettle[\s\S]{0,1100}rows\.forEach\(r=>\{s\+=\(r\.direction===c\.kind\)\?r\.amount:-r\.amount;\}\)/.test(s)
    && !/function rcSettle[\s\S]{0,1100}c\.actual\s*\+=/.test(s));
  // voiding the LAST posting on a chip left the money sitting on it — and 复盘's 对账 line then
  // read ✓一致 against a number nothing supports. c.rc is the only marker that says "the ledger
  // owns this figure", so a hand-typed actual (execCost / editMoney) is still never touched.
  check(s, 'voiding the last posting empties the chip it settled — but never a hand-typed actual',
    /if\(!rows\.length\)\{[\s\S]{0,400}if\(c\.rc!=null\)\{c\.actual=null;delete c\.rc;save\(\);\}/.test(s));
  check(s, '门票 posts one idempotent internal 証憑 (UPDATE when it already exists)',
    /function confirmTickets[\s\S]{0,1400}src:'ticket'/.test(s)
    && /function confirmTickets[\s\S]{0,1600}old\s*\n?\s*\?\s*sb\.from\('ym_entry'\)\.update/.test(s)
    && /function confirmTickets[\s\S]{0,1400}image_id:'',image_url:''/.test(s));
  check(s, 'a budget chip cannot take its postings with it (delChip / delEvent guards)',
    /function delChip[\s\S]{0,400}chip_id===cid&&x\.status==='posted'/.test(s)
    && /function delEvent[\s\S]{0,500}event_id===e\.id&&r\.status==='posted'/.test(s));
  // 0017 §4 keeps the 証憑 immutable; cpM is a whitelist, so `rc` must not be on it
  check(s, "cloneEvent's money whitelist carries no actuals and no receipt count",
    /const cpM=c=>\(\{id:uid\(\),refId:c\.refId,name:c\.name,kind:c\.kind,plan:c\.plan,unit:c\.unit,actual:null\}\)/.test(s)
    && !/cpM=c=>[^\n]*\brc\b/.test(s));
  check(s, 'the 登録番号 shape is enforced client-side AND at the CHECK',
    /\/\^T\\d\{13\}\$\/\.test\(reg\)/.test(s) && /reg_no ~ '\^T\[0-9\]\{13\}\$'/.test(m17));
  // 票据 + 报名表 + 名单截图 — all three, or the week of usage_event the owner is about to watch
  // is half-blind and reads as "OCR is cheap"
  /* 手机拍那一侧是**匿名**的（token 就是凭据），拿不到 user_token —— 它的用量由
     cap_claim 在电脑认领时在**服务端**记一次（0005_capture.sql），客户端伪造不了，
     而且只有真的传回一张才会记。所以规则不是「都带 token」，是
     **「带 token，或者走 cap_submit 那条会被服务端计量的路」** —— 两者必居其一。 */
  check(s, 'every ym OCR call is metered — user_token, or the handoff that meters server-side',
    /api\/parse[\s\S]{0,400}user_token:\(SESSION&&SESSION\.access_token\)/.test(s)
    && (() => {
      const src = stripComments(s);
      const sites = [...src.matchAll(/api\/parse'/g)].map(mm => src.slice(mm.index, mm.index + 800));
      return sites.length >= 4 && sites.every(t =>
        /user_token/.test(t.slice(0, 400)) || /cap_submit/.test(t));
    })());
  /* 2026-08-06：原图**不再**是一个指向 Drive 的链接 —— 点它就是把人送去 Google 登录页，
     而税理士 / 志愿者 / 别的主办都没有、也不该有 owner 的 Google 账号。改走 driveView
     （字节从我们自己那道鉴权门过）。0014 那条 XSS 教训照旧：BUILD THE NODE，永远不拼属性 HTML。 */
  check(s, '原图走 driveView（不再是 Drive 链接），且仍然 BUILD THE NODE 不拼 innerHTML',
    /function rcImage[\s\S]{0,900}driveView\(data\.image_id,/.test(s)
    && !/function rcImage[\s\S]{0,900}innerHTML/.test(s)
    && !/function rcImage[\s\S]{0,900}a\.href=data\.image_url/.test(s)
    && /select\('image_id,image_name,image_mime,event_id'\)/.test(s));
  // 0018: plpgsql resolves columns at execution, so this only ever showed up on the first insert
  // the SQL only — the file's header quotes the broken line on purpose, and prose is not code
  check(m18, '0018 fixes ym_entry_cap, which counted length(image) — a column 0017 never created',
    (() => { const sql = m18.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
      return /create or replace function ym_entry_cap/.test(sql)
        && !/\bcoalesce\(image\b/.test(sql) && /count\(\*\)/.test(sql); })());
  check(m17, 'ym_entry has no `image` column (the bytes live in Drive) — 0018 is required',
    !/^\s*image\s+(text|bytea)/m.test(m17) && /image_id\s+text/.test(m17));
  // 0017 §8: the donor's door, and only that door
  check(m17, "kind='give' is its own `case` arm gated on role='D' — never an `or`",
    /when 'give'\s+then ym_share_can_give\(host, event_id\) and chip_id = ''/.test(m17)
    && /and c\.role = 'D'/.test(m17));
  check(m17, 'the 証憑 is restored on every UPDATE (image + voucher_no + parse + src)',
    /new\.voucher_no := old\.voucher_no/.test(m17) && /new\.image_id := old\.image_id/.test(m17)
    && /new\.parse := old\.parse/.test(m17) && /new\.src := old\.src/.test(m17));
  /* ⚠ 这条的 ABSENCE 那半原本跑在**原始文本**上，于是成员端只要在注释里提一句「主办拿字节喂
     /api/parse」就会把它判红 —— 正是本文件开头那条规矩说的情形（注释理应指名它禁止的东西）。
     不变式是「成员端的**代码**永远不打 OCR 端点」，所以只该看代码位置。0025 踩到了。
     前半（upGive 直接 insert 进 ym_submit）留在原始文本上没问题：它断言的是存在，不是缺席。 */
  check(p, 'the donor uploads BYTES ONLY — all OCR stays host-side',
    /function upGive[\s\S]{0,900}from\('ym_submit'\)\.insert/.test(p)
    && !/api\/parse/.test(stripComments(p)));
  check(p, "a donation names an event and NEVER a chip", /kind:'give',slot:uid\(\)/.test(p)
    && /chip_id:'',\s*\n?\s*kind:'give'/.test(p));

  /* ---------- 対抗式復査 2026-07-27: six lenses over the shipped ledger ---------- */
  // the split belongs to the amount the AI read: correct the amount and it is simply dropped
  // (recomputing it would be inventing one — see 「按含税来记」)
  check(s, 'correcting the amount drops the tax split rather than shipping a stale or invented one',
    /R\.seedAmt=total/.test(s)
    && /const tax=\(donation\|\|amount!==num0\(R\.seedAmt\)\)\?\[\]:R\.tax\.map/.test(s));
  // 寄付金 is 不課税 — never carry a 消費税 figure on a donation
  check(s, 'a donation carries no 消費税 at all',
    /const donation=\(c\.src==='donor'\)\|\|f\.acct==='受取寄付金'/.test(s));
  // Drive upload + insert take seconds and src='host' has no unique index
  check(s, 'a second tap on 确认入账 cannot post the same receipt twice',
    /let _rcBusy=false/.test(s) && /if\(_rcBusy\)\{toast\('正在入账，别重复点'\)/.test(s)
    && /try\{await rcConfirmDo\(R\);\}finally\{_rcBusy=false;\}/.test(s));
  // a receipt shot from a 任务 carries a TASK chip id, which is not in the money-chip select
  check(s, 'a 任务 chip id survives the confirm card instead of being blanked by the select',
    /chips\.length&&\(!f\.chip\|\|chips\.some\(x=>x\.c\.id===f\.chip\)\)/.test(s));
  // [] is truthy, so one failed read used to pin the ledger empty for the whole session
  check(s, 'a failed ledger read retries and says so, instead of reporting ¥0',
    /let LEDGER_ERR=''/.test(s) && /LEDGER_ERR=error\.message/.test(s)
    // the comment above the fix legitimately quotes the line it replaced — judge the CODE.
    // ⚠ 用 stripComments，别再手搓一个只认 `//` 的：2026-07-28 又一条注释（块注释里）
    //    照抄了这行旧代码，把这条断言绊倒了。
    && !/LEDGER=LEDGER\|\|\[\]/.test(stripComments(s))
    && /台账没读到/.test(s) && /先别导出 CSV/.test(s));
  // 任务完成 ≠ 钱记完: accepting the file rows removed the only 入账 button
  check(s, '确认完成 leaves the 票据 pending so it can still be posted',
    /pendFor\(cid,mc\)\.filter\(r=>r\.kind!=='file'\)\.map\(r=>r\.id\)/.test(s));
  // chip.actual is written before ym_entry — a failed write must not show ✓已入账
  check(s, '门票 ✓已入账 is proven by the ledger, not by the local chip',
    /const posted=c2=>\(LEDGER\|\|\[\]\)\.some\(r=>r\.src==='ticket'/.test(s)
    && /&&\(!canCloud\(\)\|\|tickets\.every\(posted\)\)/.test(s));
  check(s, 'a readonly (archived) event cannot post a donation',
    /function rcFromSubmit[\s\S]{0,300}if\(S\.readonly\)\{toast\('只读回看/.test(s));

  // ---------- runtime ----------
  console.log('ym — Y8 台账 (runtime: the module is evaluated, not pattern-matched)');
  const slice = s.slice(s.indexOf('const RC_PAY='), s.indexOf('function formPhoto'));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const STORE = { library: {}, events: [{ id: 'E1', name: '夏日茶会', date: '2026-06-09' }] };
  const S = {}, ACCEPTED = [];
  let CSV = null;
  const Y8 = new Function('STORE', 'S', 'ACCEPTED', 'esc', 'escJs', 'ico', 'yen', 'todayStr',
    'fmtDate', 'dlCSV', 'toast', 'save', 'render', 'allMoneyChips', 'moneyTotals', 'canCloud',
    slice + `
    return {setLedger:v=>{LEDGER=v},dateOf,num0,rcTax,rcJournal,rcCheck,
            rcSeed,rcSettle,ledRows,ledTotals,ledByAccount,taxKubun,
            exportLedger,exportJournal,ledSelfNote};`
  )(STORE, S, ACCEPTED, x => String(x == null ? '' : x), x => String(x == null ? '' : x),
    () => '', n => '¥' + Number(n || 0).toLocaleString('ja-JP'), () => '2026-07-27',
    d => String(d), (name, rows) => { CSV = { name, rows }; }, () => {}, () => {}, () => {},
    () => [], () => ({ inActual: 0, outActual: 0 }), () => true);

  // 発生主義 starts at a date, and parse.py validates none of what it promises
  check(s, "dateOf parses 2026/6/9 and 2026年6月9日, and refuses '' and garbage",
    Y8.dateOf('2026/6/9') === '2026-06-09' && Y8.dateOf('2026年6月9日') === '2026-06-09'
    && Y8.dateOf('2026-06-09') === '2026-06-09' && Y8.dateOf('') === '' && Y8.dateOf('garbage') === '');
  // 立替 = a volunteer fronted the money → we OWE them → 未払金 (a liability), not 立替金 (an asset)
  check(s, '借方/貸方 is total over the CHECK-enumerated payments, and 立替 lands on 未払金',
    eq(Y8.rcJournal({ direction: 'out', payment: '立替', account: '会場費' }), { dr: '会場費', cr: '未払金' })
    && eq(Y8.rcJournal({ direction: 'out', payment: '現金', account: '' }), { dr: '雑費', cr: '現金' })
    && eq(Y8.rcJournal({ direction: 'in', payment: '現金', account: '' }), { dr: '現金', cr: '売上高(参加費)' })
    && eq(Y8.rcJournal({ direction: 'in', payment: 'クレジット', account: '受取寄付金' }), { dr: '未収入金', cr: '受取寄付金' }));
  // the app's own MOCK is a convenience-store run: 8% おにぎり beside 10% コピー代
  // owner 2026-07-27「按含税来记，税务问题交给税理士思考」— read the split off the receipt, or
  // record none. Rebuilding it as 内税10% turned 8% and 非課税 into a fabricated 10% for a column
  // the 税理士 reads as fact.
  check(s, 'a 10%/8% receipt keeps BOTH lines; an unreadable split is DROPPED, never invented',
    eq(Y8.rcTax([{ rate: '10', base: 1000, tax: 100 }, { rate: '8', base: 500, tax: 40 }], 1640),
       [{ r: '10', b: 1000, t: 100 }, { r: '8', b: 500, t: 40 }])
    && eq(Y8.rcTax([{ rate: '10', base: 9999, tax: 1 }], 1100), [])   // doesn't foot → discard
    && eq(Y8.rcTax([], 1100), []) && eq(Y8.rcTax([], 0), [])
    && !/auto:1/.test(s));
  // the app makes NO tax judgment anywhere — no 課税/免税 switch, no 非適格, no 経過措置,
  // no 少額特例. Those are the 税理士's call, and a field we fill reads as a verified fact.
  check(s, 'the app asserts nothing about tax — 要核对 is about evidence, not 税区分',
    Y8.rcCheck({ confidence: 'mock', account: '会場費' }) === true
    && Y8.rcCheck({ confidence: 'high', account: '' }) === true
    && Y8.rcCheck({ confidence: 'high', account: '会場費', direction: 'out', reg_no: '', amount: 999999 }) === false
    && Y8.taxKubun({ direction: 'out' }, '10') === ''
    && !/function needsReg|function keigen|function taxMode|setTaxMode/.test(s)
    // strip BOTH comment forms — the block comment above rcTax legitimately names what it removed
    && !/非適格|経過措置|少額特例|課税事業者/.test(stripComments(s)));
  // EVERY failure path in parse.py returns HTTP 200 with a fabricated ¥1,382 receipt at
  // confidence 'high'. This is the branch that keeps a false インボイス record out of the book.
  check(s, 'a MOCK parse reaches the card with every field BLANK and confidence=mock',
    (() => {
      S.rc = { d: { source: 'mock', confidence: 'high', vendor: 'ファミリーマート 渋谷店',
        total_incl_tax: 1382, invoice_reg_no: 'T1234567890123', issue_date: '2026-06-09',
        suggested_account: '消耗品費', tax_lines: [{ rate: '10', base: 1256, tax: 126 }] },
        ctx: { src: 'host', evId: 'E1' }, img: 'x', mime: 'image/jpeg', name: 'a.jpg' };
      Y8.rcSeed();
      const R = S.rc, f = R.f;
      return R.conf === 'mock' && f.vendor === '' && f.amt === '' && f.reg === ''
        && f.acct === '' && eq(R.tax, []) && f.date === '2026-06-09'   // the EVENT's date, not the mock's
        && Y8.rcCheck({ confidence: 'mock', account: '会場費', direction: 'out' }) === true;
    })());
  // fixture: one posted expense, one posted income, one VOID — design 2's totals honoured neither
  const FIX = [
    { id: 'a', voucher_no: 'R-2026-0001', entry_date: '2026-06-09', paid_date: '2026-06-09',
      direction: 'out', amount: 1640, tax_total: 140, tax: [{ r: '10', b: 1000, t: 100 }, { r: '8', b: 500, t: 40 }],
      account: '会議費', payment: '現金', vendor: 'ファミマ', reg_no: '', memo: '', event_id: 'E1',
      chip_id: 'c1', src: 'host', status: 'posted', confidence: 'high', image_url: 'https://drive.google.com/x' },
    { id: 'b', voucher_no: 'R-2026-0002', entry_date: '2026-06-09', paid_date: '2026-06-09',
      direction: 'in', amount: 120000, tax_total: 10909, tax: [{ r: '10', b: 109091, t: 10909 }],
      account: '売上高(参加費)', payment: '現金', vendor: '当日参加者', reg_no: '', memo: '', event_id: 'E1',
      chip_id: 'c2', src: 'ticket', status: 'posted', confidence: 'hand', image_url: '' },
    { id: 'c', voucher_no: 'R-2026-0003', entry_date: '2026-06-10', paid_date: null,
      direction: 'out', amount: 50000, tax_total: 4545, tax: [{ r: '10', b: 45455, t: 4545 }],
      account: '会場費', payment: '振込', vendor: '陽光カフェ', reg_no: '', memo: '', event_id: 'E1',
      chip_id: 'c3', src: 'host', status: 'void', void_reason: '拍错了', image_url: 'https://drive.google.com/y' },
  ];
  Y8.setLedger(FIX); S.ledFy = 2026; S.ledF = 'all'; S.ledEv = '';
  check(s, 'a 取消 row stays visible but leaves 収入/支出/差引 AND the 科目別 rollup',
    (() => { const t = Y8.ledTotals(Y8.ledRows());
      return Y8.ledRows().length === 3 && t.out === 1640 && t.in === 120000 && t.net === 118360
        && !Y8.ledByAccount(Y8.ledRows()).some(x => x.k.indexOf('会場費') >= 0); })());
  check(s, '未決済 counts only unpaid non-cash rows, and 無原图 exempts the 门票 internal 証憑',
    (() => { const t = Y8.ledTotals(Y8.ledRows()); return t.open === 0 && t.nodoc === 0; })());
  check(s, "the 要核对 filter finds a missing 勘定科目 and a mock, and nothing else",
    (() => { Y8.setLedger(FIX.concat([{ ...FIX[0], id: 'd', voucher_no: 'R-2026-0004', account: '' }]));
      const t = Y8.ledTotals(Y8.ledRows()); Y8.setLedger(FIX); return t.check === 1; })());
  // a 税込 single line cannot support a 消費税申告 — one CSV row per rate, footing back to the total
  check(s, '総勘定元帳 CSV: one row per 税率, and 税抜+税額 sums back to the 税込 amount',
    (() => { CSV = null; Y8.exportLedger();
      const body = CSV.rows.filter(r => r[0] === 'R-2026-0001' || (r[1] === '' && r[11] === '8'));
      const a = CSV.rows.find(r => r[0] === 'R-2026-0001');
      const b = CSV.rows[CSV.rows.indexOf(a) + 1];
      return a && b && a[11] === '10' && b[11] === '8' && b[0] === ''   // continuation row
        && (a[12] + a[13] + b[12] + b[13]) === a[10]                    // 税抜+税 = 税込
        && a[17] === 'あり' && CSV.rows.some(r => r[0] === '合計'); })());
  check(s, '仕訳 CSV drops 取消 rows and carries a 税区分 on the right side only',
    (() => { CSV = null; Y8.exportJournal();
      const rows = CSV.rows.slice(1);
      return !rows.some(r => r[1] === 'R-2026-0003')
        && rows.filter(r => r[1] === 'R-2026-0001').length === 2      // two 税率 lines
        && rows.find(r => r[1] === 'R-2026-0002')[4] === '対象外';     // 収入: kubun sits on 貸方
    })());
  check(s, 'the CSV leaves 税区分 blank and says the judgment is the accountant\'s',
    (() => { CSV = null; Y8.exportLedger();
      const head = CSV.rows[0], zi = head.indexOf('税区分');
      const body = CSV.rows.filter(r => /^R-2026-\d{4}$/.test(String(r[0])));
      return zi > 0 && body.every(r => r[zi] === '')
        && CSV.rows.some(r => String(r[0]).indexOf('税理士にお任せ') >= 0)
        && CSV.rows.some(r => String(r[0]).indexOf('推計はしていません') >= 0); })());
  // the display cache, both directions: two receipts settle a chip, and voiding both empties it
  check(s, 'rcSettle re-sums a chip from the ledger, and empties it when the last row is voided',
    (() => {
      const chip = { id: 'c1', kind: 'out', plan: 40000, actual: null };
      const hand = { id: 'c9', kind: 'out', plan: 5000, actual: 4200 };   // typed by the host
      STORE.events[0].header = { money: [chip, hand] }; STORE.events[0].rows = [];
      const two = [{ chip_id: 'c1', direction: 'out', amount: 1000, status: 'posted' },
                   { chip_id: 'c1', direction: 'out', amount: 640, status: 'posted' }];
      Y8.setLedger(two); Y8.rcSettle('E1', 'c1');
      const summed = chip.actual === 1640 && chip.rc === 2;
      // a 返金 on the same chip subtracts rather than piling on
      Y8.setLedger(two.concat([{ chip_id: 'c1', direction: 'in', amount: 640, status: 'posted' }]));
      Y8.rcSettle('E1', 'c1');
      const netted = chip.actual === 1000 && chip.rc === 3;
      Y8.setLedger([{ chip_id: 'c1', direction: 'out', amount: 1000, status: 'void' }]);
      Y8.rcSettle('E1', 'c1');
      const emptied = chip.actual === null && chip.rc === undefined;
      Y8.rcSettle('E1', 'c9');                    // never had a posting — leave the host's number
      const untouched = hand.actual === 4200;
      Y8.setLedger(FIX);
      return summed && netted && emptied && untouched;
    })());
  /* ---------- 対抗式復査 2026-07-27 — every one of these reached the 税理士's file ---------- */
  // a 0-yen rate bucket fell through `||r.amount` and emitted a SECOND full-amount 仕訳 line
  check(s, 'a ¥0 tax bucket no longer double-books the whole receipt in 仕訳',
    (() => {
      Y8.setLedger([{ ...FIX[0], tax: [{ r: '10', b: 1000, t: 100 }, { r: '0', b: 0, t: 0 }] }]);
      CSV = null; Y8.exportJournal();
      const lines = CSV.rows.slice(1).filter(r => r[1] === 'R-2026-0001');
      Y8.setLedger(FIX);
      return lines.length === 1 && lines[0][3] === 1100;
    })());
  // the on-screen 放大镜 (支出/収入/未決済/要核对) must not silently shorten the accountant's file
  check(s, 'a screen filter never shortens either CSV — 年度/活动 still scope them',
    (() => {
      S.ledF = 'check';                                   // only the 要核对 row is on screen
      const onScreen = Y8.ledRows().length;
      CSV = null; Y8.exportLedger();
      const voucherRows = CSV.rows.filter(r => /^R-2026-\d{4}$/.test(String(r[0]))).length;
      S.ledF = 'all';
      return onScreen < 3 && voucherRows === 3;           // all three rows, void included
    })());
  // OCR-derived 取引先名 lands in a file the 税理士 opens in Excel. Escaping happens in csvEsc,
  // which every CSV in the app goes through — so test THAT, not one exporter.
  check(s, 'a formula-looking value is neutralised in csvEsc (all CSVs share it)',
    (() => {
      const csvEsc = new Function(s.slice(s.indexOf('function csvEsc'), s.indexOf('function dlCSV'))
        + '\nreturn csvEsc;')();
      return csvEsc('=SUM(A1:A9)').startsWith("'=") && csvEsc('@foo') === "'@foo"
        && csvEsc('+1').startsWith("'+") && csvEsc('-1').startsWith("'-")
        && csvEsc('陽光カフェ 2F') === '陽光カフェ 2F'            // ordinary text untouched
        && csvEsc(1640) === '1640' && csvEsc('2026-06-09') === '2026-06-09'
        && csvEsc('a,b') === '"a,b"';                            // quoting still works
    })());
  check(s, '自费 is reported OUTSIDE every total and never reaches a CSV',
    (() => { ACCEPTED.push({ kind: 'submit', cost: '3000' });
      const note = Y8.ledSelfNote(); CSV = null; Y8.exportLedger();
      const inCsv = CSV.rows.some(r => r.some(v => String(v) === '3000'));
      ACCEPTED.length = 0;
      return note.indexOf('¥3,000') >= 0 && note.indexOf('不计入以上任何合计') >= 0 && !inCsv; })());
}

// ---------- 资产库: 物资大类 · 灵感四类 · 完整录入 · 面板删除 (owner 2026-07-27) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 资产库 (物资/灵感/录入/删除)');

  // 物资: two big classes, and the consumable-only fields
  check(s, '物资 splits 消耗品 / 可存续品, and only 消耗品 carries 类别·保存期限·已使用',
    /const GOODS_CLASS=\[\['consume','消耗品'\],\['durable','可存续品'\]\]/.test(s)
    && /goods:\[[\s\S]{0,900}?\['gclass','大类','sel'/.test(s)
    && /goods:\[[\s\S]{0,900}?\['expiry','保存期限（消耗品）','date'\]/.test(s)
    && /goods:\[[\s\S]{0,900}?\['used','是否已使用/.test(s)
    && /if\(kind==='goods'&&rec\.gclass!=='consume'\)\{delete rec\.used;delete rec\.expiry;delete rec\.category/.test(s));
  // owner: 「部分使用不表示为已使用」— so it is a switch the host throws, never derived from anything
  check(s, '已使用 is set by hand (partial use is NOT 已使用), and 已归档 requires it',
    /function toggleUsed/.test(s) && !/used\s*=\s*[^;]*qty/.test(s)
    && /gclassOf\(r\)==='consume'&&!r\.used\)\{toast\('消耗品要先标「已使用」才能归档'\)/.test(s));
  check(s, 'the 物资 tab groups by 大类 and parks 已归档 at the end',
    /grp\('消耗品'[\s\S]{0,400}grp\('可存续品'[\s\S]{0,400}grp\('未分类'[\s\S]{0,400}grp\('已归档'/.test(s));
  check(s, '归档 means it stops being offered on a rundown — the panel hides it',
    /peoList\('goods'\)\.filter\(x=>!x\.archived\)/.test(s));
  // old data is NOT guessed into a class: mislabelling 场地 as 消耗品 is worse than 未分类
  check(s, 'existing 物资 are left 未分类 rather than guessed',
    /STORE\.y10[\s\S]{0,400}物资大类\*\*不猜\*\*/.test(s)
    && !/gclass\s*=\s*['"](consume|durable)['"]\s*;?\s*\/\/\s*(guess|infer)/i.test(s));

  // 灵感: four kinds, 互动游戏 belongs to no phase
  check(s, '灵感 has the four kinds and 互动游戏 is not tied to a phase',
    /const IDEA_KIND=\[\['before','事前准备'\],\['day','当天活动'\],\['after','事后复盘'\],\['game','互动游戏'\]\]/.test(s)
    && /ideas:\[[\s\S]{0,300}?\['kind','分类','sel',IDEA_KIND/.test(s)
    && /三段都能用|事前 \/ 当天 \/ 事后 都能用/.test(s));
  check(s, 'existing 灵感 land in 当天活动 (they were all day-of segments)',
    /STORE\.y10[\s\S]{0,300}ideas\|\|\[\]\)\.forEach\(i=>\{if\(!i\.kind\)i\.kind='day'/.test(s));
  check(s, 'both the 资产库 tab and the left panel group 灵感 by kind',
    (s.match(/IDEA_KIND\.map\(\(\[k,l\]\)=>/g) || []).length >= 2);

  // 完整录入 — one renderer, one writer, dropdowns for every category field
  check(s, 'add and edit share ONE field renderer and ONE writer (the reason they drifted)',
    s.includes('function libFieldsHtml') && s.includes('function libReadInto')
    && /function libEditCard[\s\S]{0,400}libFieldsHtml\(kind,rec,'le_'\)/.test(s)
    && /function libAddCard[\s\S]{0,700}libFieldsHtml\(kind,seed,'la_'\)/.test(s)
    && /function libEditSave[\s\S]{0,300}libReadInto\(kind,'le_',rec\)/.test(s)
    && /function libAddSave[\s\S]{0,300}libReadInto\(kind,'la_',rec\)/.test(s));
  check(s, 'every 类别 field is a dropdown, never free text',
    /\['gclass','大类','sel'/.test(s) && /\['category','物品类别（消耗品）','sel'/.test(s)
    && /\['kind','分类','sel'/.test(s) && /\['dtype','类型','sel'/.test(s));
  check(s, 'a date field renders as a real date picker',
    /if\(type==='date'\)return[\s\S]{0,200}type="date"/.test(s));

  // 面板删除 + 模板二次确认
  check(s, 'every left-panel row can be deleted, 示例 included, on all five tabs',
    /const del=\(coll,id\)=>[\s\S]{0,300}libDel\('\$\{coll\}'/.test(s)
    && ["del('templates'", "del('ideas'", "del('resources'", "del('money'"].every(t => s.includes(t)));
  check(s, 'deleting a 模板 takes a second confirmation — the name typed back',
    /if\(k==='templates'\)\{[\s\S]{0,700}fields:\[\{label:'再打一遍模板名'[\s\S]{0,300}!==nm\.trim\(\)\)\{toast\('名字不一致/.test(s));

  // ---------- runtime: the duplication fix ----------
  // 181 示例 items on the owner's account when the seed is ~50: every browser seeds with fresh uid()s,
  // so an id-only merge uploaded a whole extra set per device — permanently, because it pushes back.
  const mergeSrc = s.slice(s.indexOf('function mergeLibrary'), s.indexOf('/* An admin'));
  const mergeLibrary = new Function(mergeSrc + '\nreturn mergeLibrary;')();
  check(s, 'a second device does NOT duplicate the seeded library (the 181-项 bug)',
    (() => {
      const mk = (id, name, demo, kind) => ({ id, name, demo, kind });
      const cloud = { money: [mk('a1', '场地费', true, 'out'), mk('a2', '男士门票 ×10', true, 'in')],
                      resources: [mk('a3', '小林', true)], ideas: [], templates: [] };
      const local = { money: [mk('b1', '场地费', true, 'out'), mk('b2', '男士门票 ×10', true, 'in'),
                              mk('b3', '我自己加的', undefined, 'out')],
                      resources: [mk('b4', '小林', true), mk('b5', '真人志愿者', undefined)],
                      ideas: [], templates: [] };
      const out = mergeLibrary(cloud, local);
      return out.money.length === 3 && out.money.some(x => x.name === '我自己加的')
        && out.money.filter(x => x.name === '场地费').length === 1
        && out.resources.length === 2 && out.resources.some(x => x.name === '真人志愿者');
    })());
  /* 「把已经堆进来的重复示例合并掉」那一组 runtime 断言随 dupDemo/mergeDupDemo 一起去掉了
     （示例 2026-08-03 退役）。mergeLibrary 的「以后不再多」仍然钉在上面那一条里 —— 它现在
     防的是「还开着老页面的第二台设备又推一套种子上来」。 */
  // a HOST's own two items may legitimately share a name — only 示例 are collapsed
  check(s, "the host's own same-named items are never collapsed",
    (() => {
      const cloud = { money: [{ id: 'a1', name: '场地费', kind: 'out' }], resources: [], ideas: [], templates: [] };
      const local = { money: [{ id: 'b1', name: '场地费', kind: 'out' }], resources: [], ideas: [], templates: [] };
      return mergeLibrary(cloud, local).money.length === 2;
    })());
  // 収入 and 支出 can share a name and must stay two rows
  check(s, 'same name on both sides of the ledger stays two entries',
    (() => {
      const cloud = { money: [{ id: 'a1', name: '茶歇', kind: 'out', demo: true }], resources: [], ideas: [], templates: [] };
      const local = { money: [{ id: 'b1', name: '茶歇', kind: 'in', demo: true }], resources: [], ideas: [], templates: [] };
      return mergeLibrary(cloud, local).money.length === 2;
    })());
}

// ---------- 台本时刻表: 时长 · 拖动排序 · 预计结束 (owner 2026-07-27) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 台本时刻表');

  check(s, 'each 环节 carries a 时长, and 计划 + 当天 both show the schedule',
    /function evSchedule/.test(s) && /function evEndMin/.test(s) && /function rowDur/.test(s)
    && /class="durin"/.test(s)
    && (s.match(/class="schedbar"/g) || []).length >= 2      // 计划 and 当天
    && /预计结束/.test(s));
  // r.time already existed and hosts have typed into it — it must not be redefined out from under them
  check(s, 'a typed 时刻 still wins: it re-anchors the cascade instead of being overwritten',
    /if\(t!=null\)cur=t;/.test(s) && /anchored:t!=null/.test(s)
    && /placeholder="\$\{esc\(hm\(SCH\[i\]\.start\)\|\|'--:--'\)\}"/.test(s));
  check(s, 'drag-to-reorder uses pointer events (HTML5 draggable never fires on a phone)',
    /onpointerdown="rowDragStart/.test(s) && /touch-action:none/.test(s)
    && !/draggable="true"/.test(s)
    && /addEventListener\('pointermove',rowDragMove\)/.test(s));
  // the DOM is the source of truth at drop time; a partial read would silently drop 环节
  check(s, 'a drop only commits when every row is accounted for',
    /if\(next\.length===e\.rows\.length\)conv=reorderRows\(e,\(\)=>\{e\.rows=next;\}\);/.test(s));
  // BOTH reorder paths must go through reorderRows — a bare swap re-introduces the anchor drift
  // (owner hit it on a phone: …14:10 → 15:10 → 14:40). There is no third path.
  // 规矩 9：这是关于「缺席」的断言，先剥注释 —— 否则上面那段解释自己就能把它喂饱。
  check(s, '▲▼ and drag share one reorder entry point (a bare swap drifts the 时刻)',
    (() => { const c = stripComments(s);
      return /const conv=reorderRows\(e,\(\)=>\{const t=e\.rows\[i\];e\.rows\[i\]=e\.rows\[j\];e\.rows\[j\]=t;\}\);/.test(c)
        // `conv=` 只匹配调用点，不匹配 `function reorderRows(e,swap)` 那个声明
        && (c.match(/conv=reorderRows\(e,/g) || []).length === 2  // moveRow + rowDragEnd，没有第三条路
        && (c.match(/e\.rows\[i\]=e\.rows\[j\]/g) || []).length === 1;  // 没有别处还在裸换位
    })());
  check(s, '▲▼ survive alongside the drag handle (a handle is hard to hit on a phone)',
    /moveRow\('\$\{r\.id\}',-1\)/.test(s) && /moveRow\('\$\{r\.id\}',1\)/.test(s));
  // the same whitelist trap that dropped `rc` from money chips
  check(s, '时长 survives 再办一场 and 保存回资产库 (row copiers are whitelists)',
    (s.match(/id:uid\(\),time:r\.time,seg:r\.seg,dur:r\.dur/g) || []).length === 2);
  check(s, '灵感 carry their 约N分 into the 台本 (it used to be dropped on the floor)',
    /function applyIdea[\s\S]{0,700}dur:parseInt\(i\.dur,10\)\|\|undefined/.test(s));

  // ---------- runtime: the cascade ----------
  const src = s.slice(s.indexOf('function evSchedule'), s.indexOf('function moneyTotals'));
  const helpers = s.slice(s.indexOf('function parseHM'), s.indexOf('function fmtGap'));
  const S2 = new Function(helpers + src
    + '\nreturn {evSchedule,evEndMin,evTotalMin,hm,rowsAnchorToDur,reorderRows};')();
  check(s, 'times cascade from 活动开始时间 and a re-order changes every later 时刻',
    (() => {
      const e = { start: '14:00', rows: [{ id: 'a', dur: 30 }, { id: 'b', dur: 20 }, { id: 'c', dur: 10 }] };
      const a = S2.evSchedule(e).map(x => S2.hm(x.start)).join(',');
      e.rows = [e.rows[2], e.rows[0], e.rows[1]];                     // drag c to the top
      const b = S2.evSchedule(e).map(x => S2.hm(x.start)).join(',');
      return a === '14:00,14:30,14:50' && b === '14:00,14:10,14:40'
        && S2.hm(S2.evEndMin(e)) === '15:00' && S2.evTotalMin(e) === 60;
    })());
  check(s, 'a typed 时刻 mid-list re-anchors everything after it',
    (() => {
      const e = { start: '14:00', rows: [{ dur: 30 }, { time: '15:00', dur: 20 }, { dur: 10 }] };
      return S2.evSchedule(e).map(x => S2.hm(x.start)).join(',') === '14:00,15:00,15:20';
    })());
  check(s, 'no 活动开始时间 means no invented clock — durations still total',
    (() => {
      const e = { start: '', rows: [{ dur: 30 }, { dur: 20 }] };
      const sc = S2.evSchedule(e);
      return sc[0].start === null && S2.evEndMin(e) === null && S2.evTotalMin(e) === 50;
    })());
  check(s, 'a rundown past midnight wraps the clock rather than printing 25:10',
    S2.hm(25 * 60 + 10) === '01:10' && S2.hm(-50) === '23:10');

  // ---------- runtime: 调顺序不许让时刻串位 (owner 2026-07-29, 真机上撞到的) ----------
  // 示例台本、以及「再办一场 / 从模板铺」出来的台本 = **每一行都手填了时刻**。这是最常见的形状，
  // 也正是会串位的那一种：锚点跟着环节一起被搬走，台本读出来变成 …14:10 → 15:10 → 14:40…
  const anchored = () => ({
    start: '14:00', rows: [
      { id: 'a', time: '13:00', seg: '布置' }, { id: 'b', time: '13:30', seg: '签到' },
      { id: 'c', time: '14:40', seg: '快问' }, { id: 'd', time: '15:10', seg: '茶歇' },
      { id: 'e', time: '15:30', seg: '轮转' }]
  });
  const clock = e => S2.evSchedule(e).map(x => S2.hm(x.start)).join(',');
  const ascending = e => S2.evSchedule(e).map(x => x.start).every((v, i, a) => i === 0 || v >= a[i - 1]);
  const swap = (e, i, j) => () => { const t = e.rows[i]; e.rows[i] = e.rows[j]; e.rows[j] = t; };

  check(s, '换算锚点→时长时，屏幕上一个时刻都不许变（换算必须是视觉空操作）',
    (() => {
      const e = anchored(), before = clock(e);
      return S2.rowsAnchorToDur(e) === true && clock(e) === before
        && e.rows[0].time === '13:00' && !e.rows[1].time && !e.rows[4].time;
    })());
  check(s, '挪中间一行：时刻仍然升序，两个环节各自带走自己的时长，后面一分不动',
    (() => {
      const e = anchored();
      S2.reorderRows(e, swap(e, 2, 3));            // 快问(30分) ↔ 茶歇(20分)
      return clock(e) === '13:00,13:30,14:40,15:00,15:30' && ascending(e);
    })());
  check(s, '挪第一行：锚点交给新的第一行，时刻不倒退（14:00 → 13:00 → 13:30 那个 bug）',
    (() => {
      const e = anchored();
      S2.reorderRows(e, swap(e, 0, 1));
      return e.rows[0].id === 'b' && e.rows[0].time === '13:00' && !e.rows[1].time
        && ascending(e) && clock(e).indexOf('13:00,') === 0;
    })());
  check(s, '连挪两次也不漂：第二次已经没有多余锚点，不再换算',
    (() => {
      const e = anchored();
      S2.reorderRows(e, swap(e, 2, 3));
      const again = S2.reorderRows(e, swap(e, 0, 1));
      return again === false && ascending(e) && e.rows.filter(r => r.time).length === 1;
    })());
  check(s, '时刻倒退 / 读不到的台本原样不动 —— 不静默改屏幕上的数字',
    (() => {
      const bad = { start: '14:00', rows: [{ time: '15:00' }, { time: '14:00' }, { time: '16:00' }] };
      const blank = { start: '', rows: [{ seg: 'x' }, { time: '14:00' }] };
      return S2.rowsAnchorToDur(bad) === false && bad.rows[1].time === '14:00'
        && S2.rowsAnchorToDur(blank) === false && blank.rows[1].time === '14:00';
    })());
}

// ---------- kickoff 收尾在页尾 + 已结束→复盘 (owner 2026-08-03) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — kickoff 按钮');

  // 这颗按钮只在「开跟踪」那一刻起作用 —— 排完台本才轮到它，所以放 ＋添加环节 之后收尾。
  // 规矩 9：ORDER / ABSENCE 断言跑在剥完注释的文本上。
  check(s, 'kickoff 收尾在计划页尾 —— 在台本行和 ＋添加环节 之后，不再横在活动卡和台本中间',
    (() => { const c = stripComments(s);
      return /\$\{strips\}\$\{giveStrip\(e\)\}\$\{hd\}\$\{schedBar\}\$\{rows\}/.test(c)
        && /＋ 添加环节<\/button>\s*\$\{kickoff\}/.test(c)
        && !/\$\{hd\}\$\{kickoff\}/.test(c);
    })());
  // done/cancelled 的活动没有「开始执行」可言 —— 旧样子对它照样亮「开始跟踪执行」，
  // 一按 enterExec 就把办完的活动拉回 run。同一个位置必须变成去「复盘」的门。
  check(s, '已结束（hot/archived）的活动：按钮是 复盘 → goReview，永远不是 开始跟踪执行',
    /const ph=evPhase\(e\);/.test(s)
    && /e\.status==='run'[\s\S]{0,220}goExec[\s\S]{0,160}\(ph==='hot'\|\|ph==='archived'\)[\s\S]{0,200}goReview\(\)[\s\S]{0,60}复盘[\s\S]{0,400}enterExec\(\)/.test(s));
}

// ---------- 活动负责人 / 协办 + co-admin 迁移 (owner 2026-08-03) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 活动负责人 / 协办');

  check(s, '活动卡上有 负责人/协办 行，从用户一览选人（不是自由文本）',
    /\$\{ownerRowHtml\(e\)\}/.test(s) && /function ownPickCard/.test(s)
    && /catOf\(r\)!=='goods'&&!r\.archived&&!takenK\.has\(r\.id\)/.test(s)
    && /ownAssign\('\$\{escJs\(p\.id\)\}'\)/.test(s));   // on* 里的 id 必须走 escJs（esc 不够）
  check(s, '指定/移除有只读闸，选人去重（refKey 对 名册/账号 两种引用一视同仁）',
    /function ownPickOpen\(kind\)\{if\(S\.readonly\)return;/.test(s)
    && /e\.coOwners=\(e\.coOwners\|\|\[\]\)\.filter\(c=>refKey\(c\)!==k\);e\.ownerRef=ref;/.test(s)
    && /!e\.coOwners\.some\(c=>refKey\(c\)===k\)&&refKey\(e\.ownerRef\)!==k/.test(s));
  check(s, '再办一场带走 负责人/协办（和人力牌同一口径）',
    /ownerRef:src\.ownerRef\?Object\.assign\(\{\},src\.ownerRef\):undefined/.test(s)
    && /coOwners:\(src\.coOwners\|\|\[\]\)\.map\(c=>Object\.assign\(\{\},c\)\)/.test(s));
  // staff 名字不上公开面：官网 payload 和 保存回资产库 都是白名单，这里钉死它们没被扩
  check(s, 'ownerRef/coOwners 不进官网 payload、不进模板（两个白名单没被扩开）',
    (() => { const c = stripComments(s);
      const cut=(name)=>{const a=c.indexOf('function '+name);return c.slice(a,c.indexOf('function ',a+10));};
      return !/ownerRef|coOwners/.test(cut('syncEventPost'))
          && !/ownerRef|coOwners/.test(cut('buildSaveBack'));
    })());

  const m = read('supabase/migrations/0026_ym_coadmin.sql');
  console.log('supabase/migrations/0026_ym_coadmin.sql — co-admin');
  // SQL editor 里 auth.uid() 是 null → is_admin() 恒假 → trg_profile_upd 会把 is_admin
  // 静默改回去（0020 记过的坑）。迁移必须 停触发器→改→恢复，且整段在一个事务里。
  check(m, '0026：停 trg_profile_upd 再改 is_admin，事务包住，末尾自检会 raise',
    (() => { const c = stripSql(m);
      const dis=c.indexOf('disable trigger trg_profile_upd'), ena=c.indexOf('enable trigger trg_profile_upd');
      return /^\s*begin;/m.test(c) && c.trim().endsWith('commit;')
        && dis>=0 && ena>dis
        && c.indexOf('is_admin = true')>dis && c.indexOf('is_admin = true')<ena
        && /lower\(u\.email\) = 'ljzhujudy@gmail\.com'/.test(c)
        && /insert into whitelist\(email, role\) values \('ljzhujudy@gmail\.com', 'admin'\)/.test(c)
        && /raise exception '0026: is_admin 没写进去/.test(m);
    })());
}

// ---------- 页头导航 + 管理页注册备忘 (owner 2026-08-03 真机反馈) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 页头导航 / 注册备忘');

  // owner 把「回计划」的箭头当成回列表迷了路：← 一律回列表（工作台），跳计划 = 右侧药丸。
  // owner 同日二次点名：左右两个导航要**同一款按钮**（dc-go），文字链不算 —— 所以 ← 也是
  // 药丸，且覆盖全部页头（3 个阶段页 + 报名/总账/发布编辑）。.bk 文字链只留给行内小动作
  // （回登录/婉拒那类）。规矩 9：数量/缺席断言跑在剥完注释的文本上。
  check(s, '页头导航全是 dc-go 药丸：6 个 ←（阶段页×3 + 报名/总账/发布）+ 3 颗「计划」，无文字链残留',
    (() => { const c = stripComments(s);
      const backs=(c.match(/class="dc-go" onclick="(?:go\('desk'\)|postClose\(\))">← /g)||[]).length;
      const pills=(c.match(/class="dc-go"[^>]*onclick="go\('sheet'\)">计划</g)||[]).length;
      return backs===6 && pills===3
        && !/class="bk"[^>]*>← (?:列表|工作台|发布列表)/.test(c)
        && !/← 计划/.test(c);
    })());
  check(s, 'dc-go 是全局样式（不再锁在 .deskcard 里）—— 页头和工作台卡片同一款导航',
    /\n\s*\.dc-go\{/.test(s) && !/\.deskcard \.dc-go\{/.test(s));
  check(s, '管理页写着整条主办注册流程（生成→发人→登录页粘码→即时开通；无码=待批准）',
    /新主办怎么进来/.test(s)
    && /我是新用户，注册主办方账号/.test(s.slice(s.indexOf('新主办怎么进来')))
    && /没有码也能注册，但会停在「等待批准」/.test(s)
    && /16 位成员码由各主办自己在「用户」页发/.test(s));
}

// ---------- 成员邀请入口 (owner 2026-08-03：「主办没有一条像样的路能请人进来」) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 成员邀请入口');

  // 以前：登记新人只能去资产库；行上「未发码」是死文字；发码窗口藏在资料卡的「账号」里。
  check(s, '行上的「未发码」就是发码的门（stopPropagation + escJs，不再是死文字）',
    /onclick="event\.stopPropagation\(\);grantOpen\('\$\{escJs\(p\.id\)\}'\)">\$\{ico\('key'\)\}发邀请码</.test(s)
    && (() => { const c = stripComments(s);
      return !/<span class="muted" style="font-size:10px">未发码<\/span>/.test(c); })());
  check(s, '用户页能直接登记 志愿者/嘉宾/捐赠人，并写着成员注册流程一句话',
    /libAddOpen\('volunteer'\)">＋ 志愿者</.test(s)
    && /libAddOpen\('guest'\)">＋ 嘉宾</.test(s)
    && /libAddOpen\('donor'\)">＋ 捐赠人</.test(s)
    && /成员怎么进来：/.test(s));
}

// ---------- 左上角 ym = 回官网首页 (owner 2026-08-03) ----------
{
  console.log('ym — 左上角 logo 通官网');
  const o = read('ym/organizer/index.html'), m = read('ym/member/index.html');
  // 主办台 topbar + 登录墙、成员页 top —— 三颗 logo 都是 <a href="../">，不是死 span。
  // 墙上那颗尤其要在：点错门的人需要一条不输密码的退路。
  check(o, '主办台：topbar 和登录墙的 ym 都是 <a href="../">，无死 logo span',
    (o.match(/<a class="logo" href="\.\.\/"/g) || []).length === 2
    && !/<span class="logo"/.test(stripComments(o)));
  check(m, '成员页：ym logo 是 <a href="../">，无死 logo span',
    (m.match(/<a class="logo" href="\.\.\/"/g) || []).length === 1
    && !/<span class="logo"/.test(stripComments(m))
    // <a> 要压掉链接默认样式，别渲染成蓝色下划线
    && /\.top \.logo\{[^}]*text-decoration:none/.test(m)
    && /\.topbar \.logo\{[^}]*text-decoration:none/.test(o));
}

// ---------- 活同步：拉的那一半 (owner 2026-08-03「同看同编」) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym/organizer/index.html — 活同步（拉）');

  check(s, 'cloudRefresh 接在 回前台/聚焦/前台定时 上，并随 cloudLoad 成功启动',
    /async function cloudRefresh/.test(s) && /function docPullStart/.test(s)
    && /visibilitychange/.test(s) && /addEventListener\('focus',cloudRefresh\)/.test(s)
    && /setInterval\([\s\S]{0,120}cloudRefresh\(\);\},25000\)/.test(s)
    && /docPullStart\(\);/.test(s));
  // 三道闸 + 两个 mtime 规矩：接受时归零（不然本机推送闸会把它当「本机动过」往回推）、
  // 比内容时剥掉（不然归零 vs 云上带戳永远不相等，每 25 秒 render 空转）
  check(s, '合并守闸：打字跳过、传文件跳过、换人作废、本机未推的编辑不被覆盖；mtime 接受归零、比较剥除',
    /if\(_docPulling\|\|!canCloud\(\)\|\|typingNow\(\)\|\|busyNow\(\)\)return;/.test(s)
    && /!SESSION\|\|SESSION\.user\.id!==uid\|\|typingNow\(\)\|\|busyNow\(\)\)return;/.test(s)
    && /\(STORE\.events\[i\]\.mtime\|\|0\)>=_cloudBase\)return;/.test(s)
    && /delete c\.mtime;/.test(s) && /inc\.mtime=0;/.test(s));
  /* owner 2026-08-05「手机传照片到媒体库失败」。手机点「传照片」会切去系统相册，回来的
     一瞬 visibilitychange + focus 一起打 cloudRefresh，正好落在上传循环中间 ——
     `STORE.events[i]=inc` 把活动对象整个换掉，循环里握着的 e 成了孤儿：toast 说「传好 N 张」，
     相册却是空的，字节还留在网盘里没人认领。桌面上文件框是模态的、循环又短，所以只在手机出。
     ⚠ 这和 2026-08-02 那条「手机传的照片再次打开就没有了」是**同一症状的两道门**：那次修的是
     别的设备上的旧页面来覆盖（mtime 闸），这次是同一台手机自己盖自己。三道门缺一不可。 */
  check(s, '上传期间不拉云：upSerial 和整批（媒体库/附件）都标忙，计数器不下溢',
    /function busyNow\(\)\{return _upBusy>0;\}/.test(s)
    && /_upBusy=Math\.max\(0,_upBusy\+d\)/.test(s)
    && /upMark\(1\);return Promise\.resolve\(\)\.then\(fn\)\.finally\(\(\)=>upMark\(-1\)\)/.test(s)
    && count(stripComments(s), /upMark\(1\)/g) === 3        // upSerial + mediaAdd + attachTo
    && count(stripComments(s), /upMark\(-1\)/g) === 3);     // 每一处都有配对的解除
  check(s, '活同步只合并 events，不碰 library（mergeLibrary 的种子陷阱不高频跑）',
    (() => { const c = stripComments(s); const a = c.indexOf('async function cloudRefresh');
      const seg = c.slice(a, c.indexOf('function docPullStart'));
      return a >= 0 && !/mergeLibrary|STORE\.library/.test(seg) && /eq\('kind','event'\)/.test(seg);
    })());
}

// ---------- 主办账号共编 (owner 2026-08-03 三选一裁定 · 0027) ----------
{
  const s = read('ym/organizer/index.html');
  const m = read('supabase/migrations/0027_ym_event_share.sql');
  console.log('ym — 主办账号共编 (0027)');

  const mc = stripSql(m);
  check(m, '0027：分享表 + ym_doc 只开 select/update（不开 insert/delete），全部盖 ym_ok()',
    /create table if not exists ym_event_share/.test(mc)
    && /check \(member <> host\)/.test(mc)
    && /create policy ym_doc_shared_sel on ym_doc\s*\n?\s*for select using \(kind = 'event' and ym_ok\(\)/.test(mc)
    && /create policy ym_doc_shared_upd on ym_doc\s*\n?\s*for update using \(kind = 'event' and ym_ok\(\)/.test(mc)
    && !/create policy ym_doc_shared\w* on ym_doc\s*\n?\s*for (insert|delete|all)/.test(mc)
    && /共享策略不该覆盖 INSERT/.test(m)
    // L1：member_sel 也盖 ym_ok() —— 「全部盖 ym_ok()」不再是空话
    && /ym_evshare_member_sel on ym_event_share\s*\n?\s*for select using \(member = auth\.uid\(\) and ym_ok\(\)\)/.test(mc));
  // 🔴 H1（复查 HIGH，上线前修）：permissive 策略 USING/WITH CHECK 各自 OR —— 共编者能
  //   update owner=自己 借 0008 的 ym_doc_all 过 WITH CHECK 夺行。触发器钉死三列。
  check(m, '0027：H1 夺行防护 —— BEFORE UPDATE 触发器钉死 owner/kind/doc_id，不是重写 ym_doc_touch',
    /create trigger ym_doc_keys_immutable before update on ym_doc/.test(mc)
    && /new\.owner <> old\.owner or new\.kind <> old\.kind or new\.doc_id <> old\.doc_id/.test(mc)
    && !/or replace function ym_doc_touch/.test(mc)                 // 不碰共用的那个
    && /pg_trigger where tgname = 'ym_doc_keys_immutable'/.test(mc)); // 自检也钉
  check(m, '0027：share_sync 把门 + M2 只有归属/admin 能移除 + M1 只加 approved 账号 + L2 去 NULL',
    /v_can_remove := \(auth\.uid\(\) = p_host or is_admin\(\)\)/.test(mc)
    && /if v_can_remove then\s*\n\s*delete from ym_event_share/.test(mc)   // 移除包在归属闸里
    && /exists \(select 1 from ym_member x where x\.user_id = m and x\.status = 'approved'\)/.test(mc)
    && (mc.match(/array_remove\(coalesce\(p_members, '\{\}'\), null\)/g) || []).length === 2
    && /where m <> p_host/.test(mc)
    && /revoke all on function ym_event_share_sync/.test(mc)
    && /ym_host_accounts/.test(mc) && /is_admin from profile where user_id = auth\.uid\(\)/.test(mc));
  check(m, '0027：M3 两个 definer 函数 + 触发器函数都带 pg_temp；L4 分享表 DML 对 authenticated 收回',
    (mc.match(/set search_path = public, pg_temp/g) || []).length === 3
    && /revoke insert, update, delete on ym_event_share from anon, authenticated/.test(mc)
    && !/set search_path = public as \$\$/.test(mc));   // 没有漏网的「只有 public」
  // 0028：Supabase 对 public schema 有 default privileges，新函数自动 grant 给 anon ——
  // `revoke ... from public` 收不掉那一份。房规（0015）是 `from public, anon`。
  // 0027 漏了 anon（实测 anon 真的执行到了函数体），0028 补上；0027 已 apply，不回头改它。
  {
    const g = read('supabase/migrations/0028_ym_share_grants.sql');
    const gc = stripSql(g);
    check(g, '0028：两个 definer 函数对 anon 收回 EXECUTE（房规 from public, anon）+ 自检',
      (gc.match(/revoke execute on function [\s\S]*?from public, anon;/g) || []).length === 2
      && /ym_event_share_sync\(uuid, text, uuid\[\]\) +from public, anon;/.test(gc)
      && /ym_host_accounts\(\) +from public, anon;/.test(gc)
      && /has_function_privilege\('anon'[\s\S]{0,80}then\s*\n\s*raise exception/.test(gc)
      // authenticated 不能被误伤
      && /if not has_function_privilege\('authenticated'/.test(gc)
      // 顺带确认 0027 的 H1 触发器真在库里（探针够不着 pg_trigger）
      && /pg_trigger where tgname = 'ym_doc_keys_immutable'/.test(gc));
    check(g, '0028 不改已应用的 0027（应用过的迁移不回头改）',
      /不改 0027/.test(g) && !/create or replace function ym_host_accounts/.test(gc)
      && !/create policy/.test(gc));
  }
  // M2 客户端配套：非归属的共编者看不到账号牌上的移除 ✕（服务端会拒，别显示无效按钮）
  check(s, 'M2 客户端：共编副本上账号牌的移除 ✕ 藏掉（canRevoke = 我是归属 或 admin）',
    /const canRevoke=!e\._host\|\|!!\(PROFILE&&PROFILE\.is_admin\);/.test(s)
    && /const delOk=!S\.readonly&&\(!ref\.uid\|\|canRevoke\);/.test(s));

  // 客户端：_host 是本机路标 —— 拉的时候盖/剥，推的时候按它分组且从 payload 剥掉
  check(s, '两条拉取路都做 _host 标记归一（别人的行盖上、自己的行剥掉）',
    (s.match(/if\(r\.owner&&r\.owner!==uid\)/g) || []).length === 2
    && /select\('kind,doc_id,payload,owner'\)/.test(s)
    && /select\('doc_id,payload,owner'\)\.eq\('kind','event'\)/.test(s));
  check(s, '推送：共编活动按归属分组、payload 剥 _host、与自己的批次分开（一行被拒不拖垮全批）',
    /const strip=e=>\{const pl=Object\.assign\(\{\},e\);delete pl\._host;return pl;\}/.test(s)
    && /foreign\[e\._host\]=foreign\[e\._host\]\|\|\[\]/.test(s)
    && /owner:e\._host,kind:'event'/.test(s)
    && /if\(e\)e\.mtime=0;/.test(s));   // 权限被收回 → 摘掉重试资格
  check(s, '收回权限后共编副本被清扫（自己的活动不扫 —— localKept 同一条规矩）',
    /STORE\.events=STORE\.events\.filter\(e=>!\(e&&e\._host&&!seen\[e\.id\]\)\);/.test(s));
  check(s, '共编活动：删除挡住、公开到官网挡住、票据在 rcShoot 总闸挡住（四个入口一道门）',
    /if\(e\._host\)\{toast\('共编活动 — 只有创建它的工作台能删除'\);return;\}/.test(s)
    && /共编活动 — 公开到官网由创建它的工作台操作/.test(s)
    && /if\(e2&&e2\._host\)\{toast\('共编活动的票据请由创建它的工作台入账/.test(s));
  check(s, '指派即授权：ownPut/ownDel 都跟 shareSync；换人闸和退出登录都清 HOSTACCTS',
    /save\(\);shareSync\(e\);render\(\);/.test(s)
    && /function shareSync\(e\)\{/.test(s)
    && /ym_event_share_sync/.test(s) && /先在 SQL editor 跑 0027 迁移/.test(s)
    && (s.match(/HOSTACCTS=null/g) || []).length >= 2);
}

// ---------- 移除成员 = 可恢复的软删除 (owner 2026-08-03 · 0029) ----------
{
  const s = read('ym/organizer/index.html');
  const m = read('supabase/migrations/0029_ym_trash.sql');
  const mc = stripSql(m);
  console.log('ym — 移除成员 / 30 天恢复 (0029)');

  // 结构性的那一手：记录**离开** resources 数组 —— 所以每个读者自动看不见它，
  // 不需要去审计「还有哪里忘了加过滤」。这条塌了，被移除的人会在某个面重新冒出来。
  check(s, '移除 = 把记录挪出 resources、进 library.trash（不是加一个显示用的标记）',
    /STORE\.library\.resources=STORE\.library\.resources\.filter\(x=>x\.id!==pid\);/.test(s)
    && /trashList\(\)\.push\(Object\.assign\(\{\},p,\{_del:\{at:new Date\(\)\.toISOString\(\),code:a\?a\.code:''\}\}\)\)/.test(s)
    && /function trashList\(\)\{const L=STORE\.library;if\(!L\.trash\)L\.trash=\[\];/.test(s));
  check(s, '两道门合一：资产库的 ✕ 删人也走 personRemove（否则那条路删掉的人恢复不了）',
    /if\(k==='resources'&&catOf\(rec\)!=='goods'\)\{personRemove\(id\);return;\}/.test(s));
  check(s, 'mergeLibrary 合并 trash（漏了它，换设备一同步待恢复记录就被冲掉）',
    /\['templates','ideas','resources','money','trash'\]\.forEach/.test(s));
  check(s, '主办侧只有「移除」没有「撤销」；恢复入口只在管理页，且带 30 天倒数',
    /function adminTrashRestore/.test(s) && /ym_trash_restore/.test(s)
    && /要恢复请找管理员（移除后 30 天内）/.test(s)
    && !/function personRestore/.test(stripComments(s)));
  check(s, '恢复靠主办自己的客户端落地（管理员写不了别人的 ym_doc）+ 30 天本机清除',
    /async function trashPull/.test(s)
    && /if\(!row\.restored_at\)return;/.test(s)
    && /STORE\.library\.resources\.push\(rec\);trashList\(\)\.splice\(i,1\)/.test(s)
    && /filter\(t=>trashAge\(t\)<=TRASH_DAYS\)/.test(s)
    && /trashPull\(\);/.test(s));   // 挂在 cloudRefresh 的节拍上
  check(s, '管理页读 ym_trash 容错（0029 没跑不能让整屏变空）',
    /trash:t&&!t\.error\?\(t\.data\|\|\[\]\):\[\],trashOff:!!\(t&&t\.error\)/.test(s)
    && /要先在 Supabase 里应用 0029_ym_trash\.sql/.test(s));

  check(m, '0029：ym_trash 无 update 策略（恢复只走 definer RPC）+ 插入守卫钉 restored_at',
    /create policy ym_trash_admin_sel on ym_trash\s*\n?\s*for select using \(is_admin\(\)\)/.test(mc)
    && !/create policy [\w_]+ on ym_trash\s*\n?\s*for (update|all)/.test(mc)
    && /new\.restored_at := null;/.test(mc) && /new\.deleted_at\s+:= now\(\);/.test(mc)
    && /不该有任何 update 策略/.test(m));
  check(m, '0029：restore 仅 admin + 30 天上限；anon 点名收回 EXECUTE（0028 的教训）',
    /if not is_admin\(\) then raise exception 'admin only'; end if;/.test(mc)
    && /deleted_at < now\(\) - interval '30 days'/.test(mc)
    && /revoke execute on function ym_trash_restore\(uuid, text\) from public, anon;/.test(mc)
    && /set search_path = public, pg_temp/.test(mc));
  check(m, '0029：不上传名册记录本身（表里只有 名字/编号/时间）',
    !/payload/.test(mc) && /label\s+text/.test(mc) && /code\s+text/.test(mc));
}

// ---------- 口述直接写进那一格 (owner 2026-08-03「write directly into blanket is better」) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym — 口述直写那一格');

  check(s, '没有可执行意图时直接写进那一格；会改数据的四支照旧要人确认（约定 #4）',
    /const DRAFT_ACTIONS=\['eval_note','check_in','flip_status','add_cost'\];/.test(s)
    && /function applyVoiceDraft\(d\)\{/.test(s)
    && /DRAFT_ACTIONS\.indexOf\(d\.action\)<0&&said&&lastFieldEl\(\)/.test(s));
  // 顺序反了就白写：那次 render 会拿模型里的旧值把刚写进去的字重画掉
  check(s, '先 render 收掉录音条、再写字；写完不再 render（光标留在那一格）',
    /S\.draft=null;render\(\);\s*\n\s*if\(draftWrite\(said\)\)\{toast\('已写进刚才那一格/.test(s));
  // 台本行上的 环节/负责人/说明 都没有 id —— 只认 id 的话，最常用的那些格永远定位不到
  check(s, '定位不只靠 id：记元素本身 + (data-rid, class) 兜底，重绘后还找得回来',
    /let _lastFieldRef=null,_lastFieldLoc=null;/.test(s)
    && /_lastFieldLoc=t\.id\?\{id:t\.id\}:\(card&&cls\?\{rid:card\.getAttribute\('data-rid'\),cls\}:null\)/.test(s)
    && /function lastFieldEl\(\)\{/.test(s)
    && /card\.querySelector\('\.'\+q\(L\.cls\)\)/.test(s)
    && (() => { const c = stripComments(s); return !/document\.getElementById\(_lastField\)/.test(c); })());
  check(s, '两条录音路都走直写（浏览器转写 + 老的 MediaRecorder 退路）',
    (s.match(/applyVoiceDraft\(/g) || []).length >= 3
    && /\.then\(res=>\{applyVoiceDraft\(res\);\}\)/.test(s));
  check(s, '写入仍是追加不覆盖，且找不到那一格时退回卡片（听到的话不能扔）',
    /el\.value=el\.value&&el\.value\.trim\(\)\?el\.value\.replace\(\/\\s\+\$\/,''\)\+' '\+said:said;/.test(s)
    && /function draftWrite\(said\)\{\s*\n\s*const el=lastFieldEl\(\);if\(!el\|\|!said\)return false;/.test(s));
}

// ---------- 第四类：主办 (owner 2026-08-03「tiffany and judy are hosts, not volunteer」) ----------
{
  const s = read('ym/organizer/index.html');
  console.log('ym — 名册第四类 主办');

  check(s, '主办是名册的第四类：资产库分页 + 用户页分组 + ＋主办 + 自己的字段组',
    /const PEO_CATS=\[\['host','主办'\],\['volunteer'/.test(s)
    && /const GRP=\[\['host','主办 \/ 管理人员'\]/.test(s)
    && /libAddOpen\('host'\)">＋ 主办</.test(s)
    && /host:\[\['name','姓名'\],\['role','职务 \/ 分工'\]/.test(s)
    && /host:'新主办 \/ 管理人员'/.test(s));
  // 主办用管理员发的 YM- 码注册主办账号，不领成员邀请码（成员码铸不出 H：0015 RPC + 触发器）
  check(s, '主办这一类不发成员邀请码：行上不出现按钮，grantOpen 也把门（两条路都堵）',
    /cat==='host'\?'<span class="lbl" style="font-size:10px">主办账号<\/span>'/.test(s)
    && /if\(catOf\(p\)==='host'\)\{toast\('主办账号不用成员邀请码/.test(s));
  // 关键：已经存在的人要能改类别，否则 Tiffany/Judy 只能删了重建（会丢编号和服务记录）
  check(s, '资料卡能改类别：同一条记录改 cat（refId 不变），先存字段再换、有编号只提醒不阻止',
    /function personSetCat\(id,cat\)\{/.test(s)
    && /if\(S\.libEdit&&S\.libEdit\.id===id\)libReadInto\(from,'le_',rec\);/.test(s)
    && /rec\.cat=cat;rec\.type='人';/.test(s)
    && /编号不会跟着改/.test(s)
    && /personSetCat\('\$\{escJs\(id\)\}',this\.value\)/.test(s));
}

// ---------- 口述 + 面板直接新建 (owner 2026-07-27) ----------
{
  const s = read('ym/organizer/index.html');
  const v = read('api/voice.py');
  console.log('ym — 语音输入 / 面板新建');

  check(s, 'every text field in a dialog has a mic; numeric ones deliberately do not',
    s.includes('function micBtn') && s.includes('function dicToggle') && s.includes('function dicSend')
    && /roster:\{mode:'dictate'\}/.test(s)
    && /const numeric=\/\^\(qty\|value\|amount\|unit\|unit2\|dur\|age/.test(s)
    // the three dialogs the owner pointed at: 加一件要做的事 · ask() · 资料卡/新建
    && /micBtn\('je_name'/.test(s) && /micBtn\('ask_'\+i/.test(s) && /micBtn\(pfx\+k,label\)/.test(s));
  // dictation must ADD to what is already typed — overwriting is how you lose a half-written line
  check(s, 'a transcript appends to the field instead of replacing it',
    /el\.value=el\.value&&el\.value\.trim\(\)\?el\.value\.replace\(\/\\s\+\$\/,''\)\+' '\+t:t;/.test(s));
  // the floating mic is a DIFFERENT thing (say a sentence → AI guesses an action); sharing one
  // recorder would have the two interrupt each other
  check(s, 'dictation keeps its own recorder, separate from the intent mic',
    /let DIC=\{mr:null/.test(s) && /function recStart[\s\S]{0,900}REC\.mr=new MediaRecorder/.test(s)
    && !/function dicToggle[\s\S]{0,700}REC\./.test(s));
  check(s, 'recording does not re-render (it would wipe what is half-typed in the dialog)',
    /function dicToggle[\s\S]{0,900}不 render\(\)/.test(s)
    && !/function dicToggle[\s\S]{0,900}[^.]\brender\(\);/.test(s));
  check(v, 'the server has a transcribe-only mode that never runs what it hears',
    /DICTATE_PROMPT/.test(v) && /mode == "dictate"/.test(v)
    && /実行や返答をせず/.test(v) && /def dictate_sanitize/.test(v)
    // and the no-API-key path must answer in the same shape, not with an intent mock
    && /_m == "dictate" else \(ym_mock if _m == "ym" else mock\)/.test(v));
  check(s, 'the left panel can add a resource without leaving the page',
    /const addKind=S\.libTab==='idea'\?'ideas'/.test(s)
    && /libAddOpen\('\$\{addKind\}'\)/.test(s)
    // …which only works because the modals render globally, not inside viewLib
    && /\$\{S\.libAdd\?libAddCard\(\):''\}\s*\n\s*\$\{S\.showImport/.test(s)
    && !/viewLib[\s\S]{0,4000}\$\{S\.libAdd\?libAddCard\(\):''\}`;/.test(s));
}

/* ---------- 注册归属到主办 (owner 2026-07-28 的五条 · 0019_ym_join.sql) ----------
   owner 报的：「邀请码指定了志愿者，注册以后却成了主办」「注册申请应该推给对应主办，
   而不是管理员界面」。根因是一条链：首页只有一个「主办登录」按钮 → 成员落在 /organizer/
   → cloudLoad 给任何没有 ym_member 行的 session 插一行 pending 主办方 → redeemInvite 打的
   又是管理员那张 ym_invite 表，16 位成员码在那里永远 invalid。
   这一节守的就是这条链上的每一环，外加自助注册那扇门的**无泄露**性质。 */
{
  const s = read('ym/organizer/index.html'), m = read('ym/member/index.html');
  const idx = read('ym/index.html'), sql = read('supabase/migrations/0019_ym_join.sql');
  const api = read('api/ym_join.py');
  const S = stripComments(s), M = stripComments(m), SQL = stripSql(sql), API = stripComments(api);

  console.log('ym/index.html — 登录入口按角色分开 (①)');
  check(idx, 'the landing page no longer has ONE login button that means 主办',
    !/class="login" href="organizer\/"/.test(idx) && /<details class="who">/.test(idx));
  check(idx, 'both doors are offered, and the member door names all four member roles',
    /href="member\/"[\s\S]{0,80}成员登录/.test(idx) && /志愿者 · 嘉宾 · 捐赠者/.test(idx)
    && /href="organizer\/"[\s\S]{0,60}主办登录/.test(idx));
  check(idx, 'the two things a code-holder / an applicant need are reachable from the front page',
    idx.includes('href="member/#reg"') && idx.includes('href="member/#apply"'));

  console.log('ym/organizer/index.html — 成员邀请码永远不会变成主办申请 (②)');
  check(s, 'the two code shapes are told apart by 0015\'s own alphabet, in a named constant',
    /const MEMBER_INV_RE=\/\^\[23456789ABCDEFGHJKLMNPQRSTUVWXYZ\]\{16\}\$\//.test(s)
    && /function memberInvite\(s\)/.test(s));
  check(S, 'a member-shaped 邀请码 short-circuits BEFORE the ym_member insert (order, not intent)',
    /const minv=mine\?memberInvite\(pend\.code\):'';[\s\S]{0,900}insert\(\{user_id:SESSION\.user\.id\}\)/.test(S)
    && /if\(minv\)\{[\s\S]{0,420}ym_bind_code[\s\S]{0,420}memberOnly\(be\|\|r==='slow'\?'down':'badcode'\);return;\s*\}/.test(S));
  /* 复查 2026-07-28 的三条，都在同一段里，一起钉住：
     ① 码是绑在**打字的那个地址**上的 —— 共用设备上 A 的码会被烧到 B 头上；
     ② 形状差一位（O/0、I/1 恰好不在字母表里）就掉回「申请当主办」那条队列；
     ③ 传输失败被说成「你的码已经用过或过期」，而那句话会让人去找主办重发 —— 一重发，
        ym_reissue_code 覆盖 ym_code_secret，手上那串本来好好的码当场作废。 */
  check(S, 'the pending code is only spent on the address that typed it',
    /const mine=pend&&\(pend\.email\|\|''\)\.toLowerCase\(\)===String\(SESSION\.user\.email\|\|''\)\.toLowerCase\(\)/.test(S)
    && /if\(pend&&!mine\)clearPendingCode\(\)/.test(S)
    // …and the login form stops leaving a code behind for the next person on the device
    && /if\(code\)localStorage\.setItem\(INV_KEY[\s\S]{0,120}else clearPendingCode\(\)/.test(S.split('function doSignIn')[1] || ''));
  check(S, 'a MIS-typed member code does not fall back into the 主办 queue either',
    /rawPend\.length>=12&&rawPend\.length<=20&&rawPend\.slice\(0,2\)!=='YM'/.test(S)
    && /memberOnly\('badcode'\);return;/.test(S));
  check(s, 'a transport failure never tells a member their good code is dead',
    /memberOnly\(be\|\|r==='slow'\?'down':'badcode'\)/.test(s)
    && /S\.memberWhy==='down'/.test(s) && /先别<\/b>去找主办方重发/.test(s)
    && /return 'member-down'/.test(s));
  check(s, 'a member code that FAILS to bind still never queues as a 主办 application',
    /memberOnly\('badcode'\)/.test(s) && /S\.memberWhy==='badcode'/.test(s)
    && /成员邀请码/.test(s));
  check(s, 'redeemInvite routes a 16-char code to ym_bind_code — the stuck accounts\' only way out',
    /async function redeemInvite[\s\S]{0,700}const minv=memberInvite\(code\);/.test(S)
    && /rpc\('ym_bind_code',\{p_invite:minv\}\)/.test(s));
  /* 退出登录 = 把上一个人留下的**一切**清掉，不只是数据。authSheet 里 S.memberOnly 那几个
     分支排在登录表单前面 —— 不清的话，成员退出后下一个人打开抽屉看到的还是
     「这是一个成员账号」，登录表单再也点不到，只能刷新页面。 */
  check(s, 'signing out clears the member-only screen, not just the data',
    /function doSignOut\(\)\{[\s\S]{0,700}S\.memberOnly=0;S\.memberWhy='';/.test(s)
    && /function doSignOut\(\)\{[\s\S]{0,700}capStop\(\);/.test(s));
  /* 这条以前断言的是「绑定成功就自动撤回那行假申请」—— 而那句 delete 在结构上**永远删不到
     东西**（它唯一的调用点在 cloudLoad 的 mem===null 分支里，那里根本没有 ym_member 行）。
     真正留着那一行的人走的是 redeemInvite，那条路不能替他删（可能是一份真申请）。
     所以现在断言的是**能撤回**：本人看得到、按钮点得到，policy 也允许。 */
  check(s, 'the bogus pending 主办 row can be withdrawn by the person who left it',
    /from\('ym_member'\)\.delete\(\)\s*\n?\s*\.eq\('user_id',SESSION\.user\.id\)\.eq\('status','pending'\)/.test(s)
    && /function memberWithdraw\(\)/.test(s)
    && /create policy ym_member_del_pending[\s\S]{0,120}status = 'pending'/.test(SQL));
  check(s, 'signUp with a member code no longer says 等待管理员批准',
    /const asMember=!!memberInvite\(code\);/.test(s)
    && /asMember\?'账号已建好，正在按邀请码把你绑到主办方名下'/.test(s));

  console.log('ym/organizer/index.html — 申请落到主办的「用户」页 (③④⑤)');
  check(s, 'the host has an inbox of their OWN pending applications (not the admin screen)',
    /function loadJoin\(\)/.test(s) && /rpc\('ym_join_list'\)/.test(s)
    && /\$\{joinBlock\(\)\}\$\{freshBlock\(\)\}/.test(s));
  check(s, 'approving mints the code SERVER-side from the request row and files the person',
    /rpc\('ym_join_approve',\{p_id:id,p_ref:rec\.id\}\)/.test(s)
    && !/ym_join_approve[^)]*p_role/.test(s)          // role never travels from the client
    && /STORE\.library\.resources\.push\(rec\)/.test(s) && /origin:'join'/.test(s));
  check(s, 'a failed mint takes the half-created roster record back out',
    /STORE\.library\.resources=STORE\.library\.resources\.filter\(x=>x\.id!==rec\.id\);save\(\)/.test(s));
  /* …but ONLY when the server actually answered. supabase-js returns {data:null,error} on a
     dropped connection while the transaction may well have COMMITTED — and CODES is keyed by
     ref_id, so deleting the roster record makes codeOf() blind and 重发邀请码 (the only way back
     to a credential that is shown exactly once) unreachable. */
  check(S, 'a TRANSPORT failure does not throw away a code the server may have minted',
    /const said=data&&data\.r;/.test(S) && /if\(said&&said!=='ok'\)\{/.test(S)
    && /if\(!said\)\{[\s\S]{0,420}if\(codeOf\(rec\)\)\{/.test(S));
  /* 次序：先 loadCodes() 再推。pushShares() 按 CODES[p.id] 组装，反过来新人整个被跳过，
     ym_share 一行都不写 → 对方注册成功后看到的是「或者已经收回了这个页面的权限」。
     而且 cloudPushAll 以前既不是 async 也不 return —— `await` 只等了一个 microtask。 */
  check(S, 'approve mints → loadCodes → push (and cloudPushAll is genuinely awaitable)',
    /await loadCodes\(\);\s*\n?\s*await cloudPushAll\(\);/.test(S)
    && /return Promise\.all\(jobs\)\.then\(\(\)=>pushShares\(\)\)/.test(S)
    && /function cloudPushAll\(\)\{\s*\n\s*if\(!canCloud\(\)\)return Promise\.resolve\(\);/.test(S));
  check(s, '婉拒 writes status only — no notice, no reason, nothing the applicant can observe',
    /rpc\('ym_join_reject'/.test(s) && /对方那一侧不会有任何变化/.test(s)
    && /对方不会收到通知/.test(s));
  check(s, 'new registrations are visible as NEW (bound_at), not just as 使用中',
    /function freshRegs\(\)/.test(s) && /Date\.parse\(a\.bound_at\)>m\.at/.test(s)
    && /class="pnew">新注册/.test(s) && /function peopleInbox\(\)/.test(s));
  // 「打开 TA 的资料」以前顺手把**整批**标成已读：同一天注册的第二个人从三个提示面同时消失，
  // 基线单调递增、没有撤销入口 —— 那个信号永远回不来（而它就是需求④ 的全部）。
  check(s, 'opening ONE new registration does not mark the whole batch as read',
    /function markSeenOne\(code\)/.test(s) && /!m\.codes\[a\.code\]/.test(s)
    && /onclick="markSeenOne\('\$\{escJs\(a\.code\)\}'\)/.test(s));
  // 婉拒写进库的备注必须有人读得到，否则写入面做完 ≠ 功能做完（规矩 8）
  check(s, 'decided applications and the host\'s own 婉拒 note are readable somewhere',
    /const done=\(JOINREQ\|\|\[\]\)\.filter\(r=>r\.status!=='pending'\)/.test(s)
    && /已处理 · \$\{done\.length\}/.test(s)
    && /你以前婉拒过这个邮箱，当时写的是/.test(s));
  check(s, 'the inbox count is on the nav, so it is reachable from every screen',
    /const inbox=peopleInbox\(\);/.test(s) && /k==='people'&&inbox\?`<span class="navdot">/.test(s));
  check(s, 'the person card states WHOSE member this is, how they arrived and when they registered',
    /归属主办：/.test(s) && /来源：\$\{[\s\S]{0,120}自助申请/.test(s) && /✓ 已注册/.test(s));
  // 空的时候要**说清楚差哪一步**（2026-07-27 可达性复查）：没设公开名称就没人申请得到你，
  // 而那件事在这一屏之外，猜不到。整块不画 = 主办以为这功能没做。
  check(s, 'an empty 待批申请 explains the missing step instead of rendering nothing',
    /function joinBlock\(\)/.test(s) && /现在没有人在等你批/.test(s)
    && /你还没设公开名称，所以没有人申请得到你名下/.test(s));
  check(s, 'a missing 0019 says so rather than showing an empty (= "nobody applied") box',
    /S\.noJoin=1/.test(s) && /0019_ym_join\.sql<\/b> 才会工作/.test(s));
  check(s, 'reading public_name degrades instead of turning an approved host into a pending one',
    /select\(cols\+',public_name'\)/.test(s) && /if\(memErr\)\{const re=await sb\.from\('ym_member'\)\.select\(cols\)/.test(s));
  check(s, 'the admin screen flags a member account and gates the 批准为主办方 button',
    /function adminCodesOf\(uid\)/.test(s) && /这是<b>成员<\/b>账号/.test(s)
    && /function adminSetMember\(uid\)/.test(s) && /\(v\[0\]\|\|''\)\.trim\(\)!=='确认'/.test(s));
  // 0014 §7：平台不做成员身份汇总。这一屏只回答归属（编号 · 身份 · 注册与否），
  // 成员的邮箱一个都不显示 —— ym_code 的 select 里本来就没有它。
  check(s, 'the admin screen answers "whose member is this" without listing member addresses',
    /function adminMembersBlock\(\)/.test(s) && /成员账号 — 谁在谁名下/.test(s)
    && /from\('ym_code'\)\.select\('code,role,paid,host,member,revoked,bound_at'\)/.test(s));

  console.log('ym/member/index.html — 自助申请这扇门 (③)');
  check(m, 'the apply form exists and is reachable from the login screen and from a #hash',
    /function applyHtml\(\)/.test(m) && /TAB==='apply'\?applyHtml\(\)/.test(m)
    && /没有邀请码，想加入/.test(m)
    && /test\(location\.hash\)\)TAB='apply'/.test(m)      // 首页的「想加入沙龙」直达这一屏
    && /test\(location\.hash\)\)TAB='reg'/.test(m));      // 「我有邀请码」同理
  // ⚠ 负向断言跑在 M（剥了注释）上：applyHtml 的注释里合法地写着它承诺不做的那件事
  //   （「也没有『找不到该主办』」）—— 规矩 9，一天之内被绊过四次。
  check(m, 'the host name is TYPED — no directory, no dropdown, no autocomplete, no suggestions',
    /id="ah" placeholder="主办方的名字" autocomplete="off"/.test(m)
    && !/<datalist/.test(M) && !/<select/.test(M)
    && !/找不到该主办|该主办不存在|主办列表/.test(M));
  check(m, 'ONE response for every outcome, and it is not a status page',
    /APPLY\.sent=true;/.test(m) && /这里不会显示申请进度/.test(m)
    && !/审核中|等待批准|申请状态/.test(M));
  // 主办方的名字必须一字不差手打，而全站不给任何提示 —— 一次失败就清空 = 让人从头猜一遍
  check(m, 'a failed submit keeps what was typed (the host name above all)',
    /value="\$\{esc\(APPLY\.host\|\|''\)\}" oninput="APPLY\.host=this\.value"/.test(m)
    && /APPLY\.host=host;APPLY\.name=name;APPLY\.email=email;APPLY\.note=note;/.test(m));
  check(m, 'applying creates NO account here: no password field, no signUp on this path',
    !/function applyHtml[\s\S]{0,1400}type="password"/.test(m)
    && /不需要<\/b>设密码/.test(m) && /post\('\/api\/ym_join'/.test(m));
  check(m, 'the invite-code screen says the role and the host both come from the code (②)',
    /都由这串邀请码决定/.test(m));

  console.log('api/ym_join.py — 无鉴权写入面');
  // 只数 do_POST 里的 200（do_GET 是健康检查，和申请的结果无关）
  const POST_BODY = API.split('def do_POST')[1] || '';
  check(api, 'the success body is a single constant — no branch on what the match found',
    /^DONE = \{"ok": True\}$/m.test(api) && count(POST_BODY, /self\._send\(200/g) === 1
    && /return self\._send\(200, DONE\)/.test(POST_BODY));
  check(api, 'it never creates an account (that is /api/ym_reg\'s job, after approval)',
    !/admin\/users/.test(api) && !/password/.test(API));
  check(api, 'rate-limited on the APPLICANT, never bucketed by host name',
    /"p_scope": "join"/.test(api) && /sha\("E:" \+ email\)/.test(api)
    && !/sha\([^)]*host/.test(api));
  check(api, 'transport failure IS reported (503) — only the MATCH is unsayable',
    /if out != "ok":\s*\n\s*return self\._send\(503/.test(api));
  /* 2026-07-28 线上实测：/api/ym_reg 和 /api/ym_join 都对**第一次**调用回 429「试得太频繁了」。
     rpc() 以前把「调用失败」和「数据库回了个值」都变成 None，于是一次 401（密钥换了 / 授权掉了）
     被读成「限流说不行」—— 一个根本连不上数据库的注册端点，从外面看和一个正常限流的端点
     一模一样，而且怎么等都不会好。这跟 忘记密码 是同一种病。 */
  /* 有副作用的那一步（烧码绑定）不知道结果就**不能回滚**：redeem 可能已经提交，
     admin_delete 会把刚绑好的账号删掉，而码已经用掉、明文也没了 —— 这个人再也注册不进来。 */
  check(read('api/ym_reg.py'), 'an UNKNOWN outcome at the redeem step never rolls the account back',
    /if out is RPC_FAIL:\s*\n\s*return self\._send\(503[\s\S]{0,200}"at": "redeem"/.test(read('api/ym_reg.py'))
    && /if out is RPC_FAIL:[\s\S]{0,300}\n\s*if not isinstance\(out, dict\)/.test(read('api/ym_reg.py')));
  check(api, 'a failed RPC is NOT reported as "you are going too fast" (both ym endpoints)',
    [api, read('api/ym_reg.py')].every(f =>
      /RPC_FAIL = object\(\)/.test(f)
      && /except urllib\.error\.HTTPError as e:/.test(f)
      && /if gate is RPC_FAIL:\s*\n\s*return self\._send\(503/.test(f)
      && /rpc\.last/.test(f)));
  check(api, 'the 503 carries a status + PG error code, never the free-text message',
    [api, read('api/ym_reg.py')].every(f =>
      /def _pg_code\(body\)/.test(f) && /\.get\("code"\)/.test(f)
      && !/\.get\("message"\)/.test(f)));
  // 「变量有值」≠「这把钥匙有权限」：ym_file 的健康检查只报前者，三条链路死了没人发现
  check(api, 'the health check PROVES the service key opens the door (not just that it exists)',
    /def do_GET\(self\)/.test(api) && /"svc_role"\] = probe == "ok"/.test(api)
    && /rpc\("ym_auth_gate", \{"p_scope": "join", "p_acct": "", "p_ip": ""\}\)/.test(api));
  check(api, 'the host name is not shape-checked beyond "not empty" (every rejection is a hint)',
    !/MAX_HOST[^\n]*re\.|host_re|HOST_RE/.test(api) && /not host or not EMAIL_RE\.match/.test(api));

  console.log('supabase/migrations/0019_ym_join.sql');
  check(sql, 'self-service can only ask for 志愿者 / 嘉宾 — H and D are not on this path',
    /want_role  text not null check \(want_role in \('V','P'\)\)/.test(sql)
    && /if v_r\.want_role not in \('V','P'\)      then return jsonb_build_object\('r', 'invalid'\)/.test(sql));
  check(sql, 'the applicant has NO read surface at all (that policy would BE the oracle)',
    !/ym_join_request\s+for select using \(email/.test(sql)
    && /revoke all on ym_join_request from anon, authenticated/.test(sql)
    && /create policy ym_join_host_read\s+on ym_join_request\s+for select using \(host = auth\.uid\(\)/.test(sql));
  // 两个坑：`select … into` 遇多行静默取第一行；uuid 在 PG 18 之前没有 min/max 聚合
  // （写了会在第一次真调用时炸，而调用方是那个无鉴权端点 —— 炸在那里没人看得见）。
  check(sql, 'apply() collects matches then counts, and never calls min(uuid)',
    /select array_agg\(m\.user_id\) into v_hosts/.test(sql)
    && /if v_hosts is null or array_length\(v_hosts, 1\) <> 1 then return 'ok'; end if;/.test(sql)
    && !/min\(m\.user_id\)|max\(m\.user_id\)/.test(SQL));   // ⚠ 剥注释：上面那段注释里就写着 min(m.user_id)
  check(sql, 'every outcome — unmatched, ambiguous, host queue full — returns the SAME string',
    count(SQL, /return 'ok';/g) >= 4 && !/return 'no-such-host'|return 'full'.*join/.test(SQL));
  check(sql, 'the per-host cap writes nothing rather than answering "this host is full"',
    /if v_n >= 50 then return 'ok'; end if;/.test(sql));
  check(sql, 'the role is read off the REQUEST ROW at approval — there is no p_role anywhere',
    /ym_mint_code\(v_r\.want_role, false, coalesce\(p_ref, ''\)\)/.test(sql)
    && !/ym_join_approve\(p_id uuid, p_ref text, p_role/.test(sql));
  check(sql, 'the rate-limit scope is REGISTERED, and proven by a real INSERT (0015 S1b)',
    /scope in \('login','reg','bind','join'\)/.test(sql)
    && /insert into ym_auth_try\(scope, acct, ip, ok\) values \('join'/.test(sql));
  check(sql, 'ym_auth_gate is restated whole (its body was last defined in 0015, unchanged since)',
    /create or replace function ym_auth_gate\(p_scope text, p_acct text, p_ip text\)/.test(sql)
    && /if p_scope in \('reg','join'\) then/.test(sql) && /v_c >= 12 then return 'slow'/.test(sql));
  check(sql, 'ym_code_list gains bound_at via DROP first (a replace cannot change the return type)',
    /drop function if exists ym_code_list\(\);/.test(sql)
    && /bound_at timestamptz\s*\)\s*\nlanguage sql stable/.test(sql)
    && /grant  execute on function ym_code_list\(\) to authenticated/.test(sql));
  check(sql, 'no host-name uniqueness (a "name taken" error would itself be a directory lookup)',
    !/unique index[\s\S]{0,60}public_name/.test(sql) && /都不路由/.test(sql));
  check(sql, 'the migration proves itself at apply time — column names resolve at RUN time (0018)',
    /^do \$\$/m.test(sql) && /ym_join_apply\('__probe_no_such_host__'/.test(sql)
    && /raise exception 'ym_join_apply wrote a row for an unmatched host name'/.test(sql));
  check(sql, '0012 / 0015 triggers and functions are left alone except where restated on purpose',
    !/create or replace function ym_member_before_(ins|upd)/.test(sql)
    && !/create or replace function ym_redeem_core/.test(sql)
    && !/create or replace function ym_mint_code/.test(sql));
  check(sql, 'definer functions pin search_path', count(sql, /set search_path = public, pg_temp/g) >= 7);

  /* ---- 0020: public_name 是路由键，不能是主办自己想写什么就写什么 ---- */
  const sql20 = read('supabase/migrations/0020_ym_pubname.sql');
  const SQL20 = stripSql(sql20);
  console.log('supabase/migrations/0020_ym_pubname.sql');
  check(sql20, '0019 已应用 → 修正走新文件，不是改 0019 原文',
    !/alter table ym_join_request add column/.test(sql20) && /Apply after 0019/.test(sql20));
  check(sql20, 'public_name is pinned by the trigger and reachable only through the setter',
    /new\.public_name := old\.public_name;/.test(sql20)
    && /coalesce\(current_setting\('ym\.name', true\), ''\) = '1'/.test(sql20)
    && /create or replace function ym_set_public_name\(p_name text\)/.test(sql20));
  // 0012 的那三行必须**逐字**还在（规矩 5：create or replace 换掉的是整个函数体）
  check(sql20, 'restating ym_member_before_upd() keeps 0012\'s status/role/email pins verbatim',
    /new\.status := old\.status;\s*\n\s*new\.role   := old\.role;\s*\n\s*new\.email  := old\.email;/.test(sql20)
    && /coalesce\(current_setting\('ym\.grant', true\), ''\) = '1'/.test(sql20));
  check(sql20, 'the setter detects a name another approved host already holds — and says no more',
    /m\.user_id <> v_u and m\.status = 'approved'/.test(sql20)
    && !/占用者|held by|conflicts with/.test(SQL20));

  /* ---- 口述改走浏览器的 Web Speech (owner 2026-08-03，从 Rakusalab 带回来的做法) ---- */
  {
    const s = read('ym/organizer/index.html');
    const c = stripComments(s);
    console.log('ym/organizer/index.html — Web Speech 口述');
    /* 老路是 MediaRecorder → base64 → /api/voice → Gemini → 回文字：慢、吃额度，
       而且 Gemini 一被拒（08-03 当天）口述就整个用不了。浏览器自己转写：边说边出字、
       一次 API 都不打。⚠ 不支持的浏览器（Firefox）必须**原样退回老路**，别把人锁死。 */
    /* 浮动话筒（说一句话 → 猜意图）也改走浏览器转写：只把**文字**发去判意图，
       一个字节音频都不上传。08-03 那次三个候选模型全被拒，卡的正是「收音频的模型」那一层。 */
    check(s, 'the hold-to-talk fab transcribes in the browser and posts TEXT, not audio',
      /function recStart\(\)\{[\s\S]{0,200}if\(SR\)\{recStartSR\(\);return;\}/.test(c)
      && /function recStartSR\(\)/.test(c)
      && /function recSendText\(said\)\{[\s\S]{0,320}body:JSON\.stringify\(\{text:said,roster:ymRoster\(\)/.test(c)
      && !/recSendText[\s\S]{0,320}audio_b64/.test(c)
      && /function recStartMR\(\)/.test(c)          // 老的录音路整段还在（Firefox）
      && /function recStop\(\)\{[\s\S]{0,160}if\(REC\.sr\)/.test(c));
    /* 转写在本机做，所以「听到了」是确定的；模型只负责「这句话要做什么」。
       两件事必须分开说 —— owner 2026-08-03 就是被「语音识别用不了」这句话带偏的，
       去查了麦克风和密钥，而真正不可用的是意图判断那一步。而且**原话不能丢**：
       模型不可用时把听到的摆在卡片上，主办照着自己点一下。 */
    // 2026-08-03：改成「直写那一格」之后，这句话的去向从 S.draft 换成了 applyVoiceDraft
    // （写得进就进格子、写不进才上卡片）—— 意图没变：**听到的话一个字都不能丢**。
    check(s, 'when the model is unavailable, the transcript survives and the message says so',
      /applyVoiceDraft\(Object\.assign\(\{\},res,\{transcript:res\.transcript\|\|said/.test(c)
      && /res\.unavailable\?\('听清了/.test(c)
      && /听到的是「'\+said\+'」/.test(c)
      // applyVoiceDraft 的两条出路都保住原话：写进格子，或者退回卡片
      && /if\(draftWrite\(said\)\)\{toast/.test(c) && /S\.draft=d;render\(\);/.test(c));
    check(read('api/voice.py'), 'the API flags model-unavailable separately from a real STT failure',
      /"unavailable": True/.test(read('api/voice.py'))
      && /这句话没能交给模型判断/.test(read('api/voice.py')));
    /* 🔴 **永远不要断言一个查得到、而查出来是假的退路。** 这条是 2026-08-03 复查抓到的最重的一条：
       那句「票据 OCR 和 AI 补写有 Claude 退路」是**无条件**写死的，而线上根本没有
       ANTHROPIC_API_KEY —— 于是 app 拿自己的系统状态骗主办（五个 AI 功能其实一起躺着）。
       退路存不存在，一行 os.environ 就能查。 */
    check(read('api/voice.py'), 'the Claude-fallback claim is conditional on the key actually existing',
      /has_claude = bool\(os\.environ\.get\("ANTHROPIC_API_KEY"\)\)/.test(read('api/voice.py'))
      && /没有\*\*配 Claude 备用密钥/.test(read('api/voice.py'))
      && !/（票据 OCR 和 AI 补写有 Claude 退路；语音没有，Claude 不收音频。）/.test(read('api/voice.py')));
    // 没见过 429 的那条分支不许继承「去充值」的话术；两条各带自己的 reason
    check(read('api/voice.py'), 'a no-model failure is not dressed up as a billing problem',
      /"reason": "billing"/.test(read('api/voice.py'))
      && /"reason": "no_model"/.test(read('api/voice.py')));
    // 客户端要**追加**服务端那句（唯一说得出怎么恢复的话），不是替换掉；也不许再指向不存在的界面
    check(s, 'the client appends the server explanation instead of discarding it',
      /\+String\(res\.say\|\|''\)\)/.test(stripComments(s))
      && !/设置里的额度/.test(stripComments(s)));
    // 服务端：给文字就只发文字；给音频才发音频（两条路都留着）
    check(read('api/voice.py'), 'voice API accepts a browser transcript instead of audio',
      /def call_gemini\(audio_b64, media_type, roster, said=""\)/.test(read('api/voice.py'))
      && /if said:[\s\S]{0,260}parts = \[\{"text": instr/.test(read('api/voice.py'))
      && /if not audio and not said:/.test(read('api/voice.py')));
    check(s, 'dictation prefers Web Speech, and still falls back to the recorder path',
      /const SR=window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/.test(c)
      && /function dicToggle\(id\)\{[\s\S]{0,260}if\(SR\)\{dicSR\(id\);return;\}/.test(c)
      && /function dicToggle\(id\)\{[\s\S]{0,400}MediaRecorder/.test(c)
      && /function dicSend\(/.test(c));          // 老路整段还在
    /* 追加而不是覆盖：base 是开录那一刻已有的内容，每次 onresult 都用 base+定稿+临时段
       重写 —— 主办已经打好的字永远不会被冲掉（老路那条也是这个约定）。 */
    check(s, 'Web Speech appends to what is already typed, never clobbers it',
      /const base=String\(el\.value\|\|''\)\.replace\(\/\\s\+\$\/,''\)/.test(c)
      && /el\.value=\(base\?base\+' ':''\)\+fin\+inter/.test(c));
    // 这个 app 里有的格子绑 onchange、有的绑 oninput —— 少发一个就存不上
    check(s, 'both input and change fire when dictation ends',
      /new Event\('input',\{bubbles:true\}\)[\s\S]{0,120}new Event\('change',\{bubbles:true\}\)/.test(c));
    // 麦克风被拒 / 没听到声音 都要说人话，别静默（失败全被吞掉是这个仓库的老病）
    check(s, 'dictation failures speak plainly (permission denied / nothing heard)',
      /not-allowed[\s\S]{0,160}浏览器没给麦克风权限/.test(c)
      && /no-speech[\s\S]{0,80}没听到声音/.test(c));
  }

  /* ---- AI 端点：一本欠费的账不该拖死所有功能 (2026-08-03) ---- */
  {
    const pa = read('api/parse.py'), vo = read('api/voice.py'), ph = read('api/phrase.py');
    console.log('api/parse.py + voice.py + phrase.py');
    /* owner 撞到的：Google AI Studio 那个项目预付额度用完（429 prepayment credits depleted），
       而 provider() 只要 GEMINI_API_KEY 存在就**只**走 Gemini —— 票据 OCR / 名单截图 /
       报名表 / AI 补写 全死，同一个 Vercel 上 ANTHROPIC_API_KEY 好好放着没人用。
       换同项目的新密钥也救不了：那是账单不是密钥。所以硬错要能改走 Claude。 */
    /* ⚠ 顺序**先模型、后厂商**（2026-08-03 傍晚更正）：那天下午我写的是「换别的 Gemini
       模型没有意义，同一个项目同一本账」—— 当晚 owner 实测推翻了它：同一把密钥，
       Rakusalab 的 gemini-2.5-flash 正常，ym 的 flash-lite 回 429 prepayment credits
       depleted。所以 429/402/403 也要接着试下一个模型，全军覆没了才轮到 Claude。 */
    check(pa, 'parse: 429/402/403 tries the NEXT MODEL first, Claude only after all of them fail',
      /SOFT_FAIL = \(404, 429, 402, 403\)/.test(pa)
      && /if e\.code in SOFT_FAIL:[\s\S]{0,140}continue/.test(pa)
      && /所有候选模型都被拒了[\s\S]{0,120}"_retry": True/.test(pa)
      && /if out\.get\("_retry"\):[\s\S]{0,200}ANTHROPIC_API_KEY[\s\S]{0,120}return call_claude/.test(pa)
      // 内部标记不能漏进回给前端的 payload
      && /out\.pop\("_retry", None\)/.test(pa));
    // 下架的 2.0-* 去掉（Rakusalab 实测 404），能用的 2.5-flash 排在 lite 后面第一顺位
    check(pa, 'the model list drops the retired 2.0-* and keeps a working fallback next in line',
      [pa, vo, ph].every(f => /FALLBACK_MODELS = \["gemini-2\.5-flash-lite", "gemini-2\.5-flash", "gemini-flash-latest"\]/.test(f)
        // 剥注释：说明里要讲清「哪些被下架了、所以去掉」，那是注释不是候选表。
        // 下架的模型留在表里不只是白跑一趟 —— 它会把最后一条错误变成 404，盖掉真正的 429。
        && !/gemini-2\.0-flash/.test(stripPy(f))
        && !/gemini-1\.5-flash/.test(stripPy(f))));
    /* 🔬 2026-08-03 的对照实验（owner 发现的）：同一把密钥、同一个模型 gemini-2.5-flash、
       同一个项目 —— Rakusalab 的 extract（**不带** thinkingConfig）一直好好的，而
       Rakusalab 的 refine 和 ym 的全部调用（**都带** thinkingConfig）在同一时间一起被 429 拒。
       所以被拒很可能是冲着这个字段来的，不是冲着账号余额。带着它失败 ≠ 不带也失败：
       同一个模型先脱掉 thinkingConfig 再试一次，然后才换下一个模型。
       ⚠ 顺序不能反 —— 它是备胎：2.5 去掉思考预算后可能更慢、甚至把输出预算花在内部推理上回空，
       那正是当初加 thinkingBudget=0 的原因。 */
    check(pa, 'a refused call retries the SAME model without thinkingConfig before moving on',
      [pa, vo, ph].every(f => /def gen_variants\(cfg\)/.test(f)
        && /if isinstance\(cfg, dict\) and "thinkingConfig" in cfg:/.test(f)
        && /out\.append\(\{k: v for k, v in cfg\.items\(\) if k != "thinkingConfig"\}\)/.test(f))
      && /for cfg in gen_variants\(gen_config\(model\)\):/.test(pa)
      && /for cfg in gen_variants\(gen_config\(model\)\):/.test(vo)
      && /for cfg0 in gen_variants\(cfg\):/.test(ph)
      // 备胎必须排在原配置**后面**（out = [cfg] 先）
      && [pa, vo, ph].every(f => /out = \[cfg\]/.test(f)));
    // 三个端点都要**优先报账单类的错**，否则末尾的 404 会盖掉真正的原因（08-03 实测过）
    check(ph, 'all three endpoints surface the BILLING error, not whatever failed last',
      [pa, vo, ph].every(f => /billing/.test(f))
      && /note": \(billing or last\)|note: \(billing or last\)/.test(ph.replace(/"/g,'"')));
    check(ph, 'phrase: same fall-over, and only ONE call_ai definition (the later one wins)',
      /"_retry": True/.test(ph)
      && /if out\.get\("_retry"\):[\s\S]{0,200}ANTHROPIC_API_KEY[\s\S]{0,120}return call_claude/.test(ph)
      && (ph.match(/^def call_ai\(/gm) || []).length === 1);
    /* 语音**没有**这条退路（Claude 不收音频）—— 所以唯一能做的是把话说到位：
       说清是账单、说清换同项目的密钥没用、说清去哪儿充。这是 08-03 owner 的真实弯路。 */
    /* 语音没有 Claude 退路（Claude 不收音频），但**有模型退路** —— 所以「这是账单问题」
       这句话只有在**每一个候选模型都被拒**之后才说得出口。说早了就是 08-03 那次误诊：
       owner 照着我的话去换密钥、查余额，而真相是换个模型就能用。 */
    check(vo, 'voice only blames billing AFTER every candidate model was refused',
      /if e\.code in SOFT_FAIL:[\s\S]{0,140}continue/.test(vo)
      && /if billing:[\s\S]{0,900}每一个\*\*候选模型都被拒了/.test(vo)
      /* ⚠ 这条只管**音频**那条路：Claude 不收音频。而浮动话筒现在发的是**文字**
         （Web Speech 转写），判意图是纯文本任务，Claude 做得了 —— 哪天要给文字分支
         加 Claude 退路，是允许的，改这条断言时把上面这句一起读了再动。 */
      && !/call_claude/.test(stripComments(vo)));
    // 「环境变量改了」≠「跑着的函数换了钥匙」：指纹让 Redeploy 有没有生效一眼看得出来
    check(vo, 'every AI endpoint reports a key fingerprint (never the key itself)',
      [pa, vo, ph].every(f => /def key_fp\(name\)/.test(f)
        && /hashlib\.sha256\(v\.encode\("utf-8"\)\)\.hexdigest\(\)\[:8\]/.test(f)
        && /"gemini_key_fp": key_fp\("GEMINI_API_KEY"\)/.test(f)));
  }

  /* ---- Apps Script 上传代理：锁 + 版本号 (2026-08-03) ---- */
  {
    const gas = read('docs/apps-script-upload.js');
    console.log('docs/apps-script-upload.js');
    /* 并发的 findOrCreate 各自「找不到就建」→ Drive 允许同名目录并存 → 一个活动两个目录
       （owner 传 2 张照片实测）。客户端 upSerial 只能管住一台设备，跨设备只有这把锁。 */
    check(gas, 'findOrCreate takes a script lock (concurrent uploads must not each create it)',
      /function findOrCreate\(parent, name\) \{\s*var lock = LockService\.getScriptLock\(\);/.test(gas)
      && /lock\.waitLock\(/.test(gas) && /finally \{[\s\S]{0,80}releaseLock/.test(gas));
    /* 探针的 gas.ok 只说明「部署活着」，不说明**是哪一版**：08-03 就是这样被骗过去的 ——
       所有信号全绿，而线上那份根本没有上面那把锁。让部署自己报版本。 */
    check(gas, 'doGet reports its own revision, so a stale deployment is visible from outside',
      /const REV = '/.test(gas)
      && /rev: REV, lock: true/.test(gas)
      && /kinds: KINDS/.test(gas));
  }

  /* ---- 0024 + 0025: 上真人志愿者之前的两条收口 (2026-08-03) ---- */
  {
    const sql24 = read('supabase/migrations/0024_ym_join_hardening.sql');
    const sql25 = read('supabase/migrations/0025_ym_join_cap_window.sql');
    console.log('supabase/migrations/0024 + 0025');
    /* 0020 只在 BEFORE **UPDATE** 里钉住路由键，而 ym_member 的插入策略是 user_id=auth.uid()：
       任何登录用户都能自带 public_name 插一行。pending 期间不路由，可一旦被误批准，
       0019 §5 的「两行就都不路由」会**静默**掐断真沙龙的整条自助申请入口。 */
    check(sql24, '0024 §1: public_name is pinned empty at INSERT too, not just UPDATE',
      /create or replace function public\.ym_member_before_ins\(\)/.test(sql24)
      && /new\.public_name := '';/.test(sql24));
    /* 0019 的待批上限是**永久**黑洞：50 个一次性邮箱堵死一个主办的入口后，每个真志愿者都
       看到「已收到」而主办永远收不到（婉拒不回复，两边都发现不了）。只给上限加时间窗。 */
    check(sql25, '0025: the pending cap is time-windowed and actually wired into ym_join_apply',
      /interval '30 days'/.test(sql24)
      && /if not ym_join_cap_ok\(v_host\) then return 'ok'; end if;/.test(sql25)
      && !/if v_n >= 50 then/.test(stripSql(sql25)));
    /* ⚠ 0025 整段重放了 ym_join_apply。除了上限那两句，其余必须与 0019 §5 **逐字**一致 ——
       重放一个长函数体最容易在别处抄漏一行，而这个函数的每一行都是无泄露设计的一部分
       （array_agg 不用 min(uuid)、同名两行都不路由、裸 on conflict）。 */
    check(sql25, '0025 replays 0019 §5 verbatim apart from the cap (no silently dropped line)',
      (() => {
        const body = t => {
          const a = t.indexOf('create or replace function ym_join_apply');
          const b = t.indexOf('end $$;', a);
          return stripSql(t.slice(a, b)).split('\n').map(l => l.trim()).filter(Boolean);
        };
        const o = body(read('supabase/migrations/0019_ym_join.sql')), n = body(sql25);
        const onlyOld = o.filter(l => !n.includes(l)), onlyNew = n.filter(l => !o.includes(l));
        // 允许且仅允许：上限那三句 + declare 少一个 v_n；新增只有 cap_ok 那一句
        return onlyOld.length === 4 && onlyOld.every(l => /v_n|count\(\*\)|r\.status = 'pending'/.test(l))
          && onlyNew.length === 2 && onlyNew.some(l => l.includes('ym_join_cap_ok(v_host)'))
          && onlyNew.every(l => /ym_join_cap_ok|declare/.test(l));
      })());
    /* 申请人看到的回答一个字都不能变 —— 满了仍然是「什么都不写 + ok」(S1c)。
       ⚠ 只看**函数体**：文件末尾那段 do $$ 自检里有 raise exception（说给 owner 听的
       「0024 还没应用」），它不在申请人这条路上。第一版断言扫全文，被自己的自检绊倒。 */
    check(sql25, "0025 keeps the applicant-facing answer identical (still a silent 'ok')",
      (() => {
        const a = sql25.indexOf('create or replace function ym_join_apply');
        const fn = sql25.slice(a, sql25.indexOf('end $$;', a));
        return /then return 'ok'; end if;/.test(fn) && !/raise /.test(stripSql(fn));
      })());
  }

  /* ---- 0021: 撞名「告知，不拦」(owner 2026-07-28) ---- */
  const sql21 = read('supabase/migrations/0021_ym_pubname_warn.sql');
  const SQL21 = stripSql(sql21);
  console.log('supabase/migrations/0021_ym_pubname_warn.sql');
  // owner: 「we just inform them … If they choose to ignore it, that's their choices.」
  check(sql21, 'a duplicate name INFORMS instead of blocking, and the host can insist',
    /if v_n > 0 and not coalesce\(p_force, false\) then return 'dup'; end if;/.test(sql21)
    && /return case when v_n > 0 then 'ok-dup' else 'ok' end;/.test(sql21)
    && !/return 'taken'/.test(SQL21));
  // 双参重载必须**替换**单参版本，否则单参调用 42725 ambiguous —— 迁移干净、保存时才炸
  check(sql21, 'the 1-arg setter is dropped, so a 1-arg call cannot go ambiguous',
    /drop function if exists ym_set_public_name\(text\);/.test(sql21)
    && /p\.proname = 'ym_set_public_name'/.test(sql21) && /ambiguous/.test(sql21));
  /* 编号救不了这一半：申请人手打的是**名字**，他手上没有编号。两个主办同名时 0019 §5 是
     两边都不路由 —— 先来的那个什么都没选却会失去入口，所以双方都必须看得见。 */
  check(sql21, 'BOTH hosts can see that their name is shared (one bit, about themselves only)',
    /create or replace function ym_name_shared\(\) returns boolean/.test(sql21)
    && /me\.user_id = auth\.uid\(\)/.test(sql21)
    && !/returns table|other\.user_id[^<]*select/.test(SQL21));   // 不返回是谁 = 不是目录
  check(sql21, 'the routing rule itself is untouched — that one is owner-adjudicated',
    !/create or replace function ym_join_apply/.test(sql21));
  check(s, 'the client warns once, then obeys the host; and shows the collision to the other side',
    /rpc\('ym_set_public_name',\{p_name:n,p_force:!!force\}\)/.test(s)
    && /data==='dup'/.test(s) && /我知道，仍然用这个名字/.test(s)
    && /sb\.rpc\('ym_name_shared'\)/.test(s) && /S\.nameDup=/.test(s)
    && /还有另一个主办也在用/.test(s));
  // owner 裁过「同名都不路由」(STAGE_SELF_REG §6)，0020 不许把它偷偷改成「最早的赢」
  // 「同名冲突时都不路由」是 owner 逐字裁的（宁可没有下文，也不能把申请送错人）。
  // 复查报告建议改成「最早的赢」—— 那是改裁决，不是修 bug，所以路由那一段一个字都不动：
  // 有了 setter，新的撞名根本建不起来；历史遗留的由管理员人工处理。
  check(sql20, 'owner\'s 同名都不路由 ruling in 0019 §5 is NOT quietly rewritten',
    !/create or replace function ym_join_apply/.test(sql20)
    && /if v_hosts is null or array_length\(v_hosts, 1\) <> 1 then return 'ok'; end if;/.test(sql));
  check(sql20, 'the missing ON UPDATE CASCADE is added (ym_set_paid renames a code in place)',
    /foreign key \(code\) references ym_code\(code\) on update cascade on delete set null/.test(sql20));
  check(sql20, 'the migration proves the pin, the setter and the FK at apply time',
    /^do \$\$/m.test(sql20) && /没有钉住 public_name/.test(sql20)
    && /confupdtype = 'c'/.test(sql20)
    && /在没有 session 时应当拒绝/.test(sql20));
  check(s, 'the client writes public_name through the RPC, never a bare table update',
    /rpc\('ym_set_public_name',\{p_name:n,p_force:!!force\}\)/.test(s)
    && !/from\('ym_member'\)\.update\(\{public_name/.test(S));
}

/* ---------- 这两个 app 里没有 markdown 渲染器 ----------
   `**这样**` 在 HTML 里原样显示星号，在 ask() 的 note / toast() 里更是纯文本 esc() 出去的。
   2026-07-28 在浏览器里一眼看见两处（报名情况那句、公开名称对话框那句）—— 套件全绿，
   因为没有任何断言看得见排版。加一条，别再靠肉眼。 */
{
  console.log('ym — 渲染文案里不许有 markdown 星号');
  for (const f of ['ym/organizer/index.html', 'ym/member/index.html']) {
    /* ⚠ 必须再过一道 stripTplNotes：模板中间那些 `${…注释…''}` 是**代码里的说明**，
       屏幕上一个字都不会出现，而 stripComments 一进反引号就原样抄下来。2026-08-05
       媒体库那段的一句「以前这句只在**空相册**时画」就让这条变红了 —— 报的是注释，
       不是文案。留着这个假阳性的代价不是「烦」：下一个人会把它当成噪音，然后真有
       一句带星号的文案上线时，这条已经没人信了。 */
    const src = stripTplNotes(stripComments(read(f)));
    const bad = [];
    // ask() 的 title/note、toast()、以及模板里直接写进 HTML 的中文段落
    for (const re of [/(?:note|title|ok)\s*:\s*'[^']*\*\*[^']*'/g, /toast\(\s*'[^']*\*\*[^']*'/g,
                      /<(?:p|div|span)[^>]*>[^<]*\*\*[^<]*\*\*/g]) {
      (src.match(re) || []).forEach(h => bad.push(h.slice(0, 60)));
    }
    check(src, `${f} — no literal ** in anything the user reads`, bad.length === 0);
    if (bad.length) bad.forEach(b => console.error(`      ${b}`));
  }
}

/* ---------- 重名：提醒，不阻止 (owner 2026-07-28) ----------
   「志愿者和嘉宾会想用自己的真名，让他们选，我们只提醒。主办反正会介入。别搞复杂。
     只有同名的两个人出现在**同一场活动**里时才真的会出问题。」 */
{
  const s = read('ym/organizer/index.html'), S = stripComments(s);
  console.log('ym/organizer/index.html — 重名');
  check(s, 'adding or renaming a person REMINDS about a duplicate — and never blocks it',
    /function dupNote\(rec,cat\)/.test(s)
    && /const dn=\(kind==='volunteer'\|\|kind==='guest'\|\|kind==='donor'\)\?dupNote\(rec,kind\):''/.test(s)
    && /toast\(dn\|\|'资料卡已保存'\)/.test(s) && /toast\(dn\|\|\(rec\.name\+' 已加入/.test(s)
    // 没有任何一条路会因为重名而 return 掉保存
    && !/dupNote\([^)]*\)\)\{[\s\S]{0,60}return;/.test(S));
  check(s, 'same-name people in ONE event are told apart (号牌 for 已报名, 编号 for 拟邀请)',
    /function dupNamesInEvent\(e\)/.test(s)
    && /这一场里有同名的人/.test(s)
    && /dup\[String\(p\.name\|\|''\)\.trim\(\)\]\?` <span class="lbl"[^`]*\$\{esc\(p\.gender\+p\.n\)\}/.test(s)
    && /const a=x\.libId&&CODES\[x\.libId\]/.test(s));
}

/* ---------- 手机拍：桌面 ↔ 手机的扫码通道 (owner 2026-07-28) ----------
   「电脑上那个按钮只是选一张照片，很难用。」→ 复用 0005_capture.sql 已经建好的那条通道，
   不新建任何 schema。手机侧免登录、对表零权限，只能通过 cap_submit 把结果塞回自己那个 token。 */
{
  const s = read('ym/organizer/index.html'), S = stripComments(s);
  const cap = read('supabase/migrations/0005_capture.sql');
  console.log('ym/organizer/index.html — 手机拍');
  check(s, 'the channel is REUSED, not rebuilt (no new table, no new RPC)',
    /rpc\('cap_claim',\{p_token:CAP\.token\}\)/.test(s) && /rpc\('cap_submit',\{p_token:token/.test(s)
    && /from\('capture_session'\)\.insert\(\{owner:SESSION\.user\.id\}\)/.test(s)
    && /grant execute on function cap_submit\(uuid, jsonb, text\) to anon, authenticated/.test(cap));
  // 手机那一页不该有登录、不该有主办台内容，也不该在别人的手机上写下这台设备的 STORE
  /* 分流只看**有没有 token**：以前是 `CAP_TOKEN&&sb`，于是 supabase-js 的 CDN 被挡时，
     一个拿着拍照链接的外人会掉进主办台的完整 boot（seed 示例、写这台设备的 localStorage、
     看到工作台）—— 正是这段代码自己的注释禁止的事。 */
  check(S, 'the phone page branches on the TOKEN alone, before seed / render / authInit',
    /const CAP_TOKEN=new URLSearchParams\(location\.search\)\.get\('cap'\);[\s\S]{0,120}if\(CAP_TOKEN\)\{/.test(S)
    && /if\(sb\)capPhone\(CAP_TOKEN\);\s*\n?\s*else /.test(S)
    && /\}else\{[\s\S]{0,220}authInit\(\);/.test(S));
  // 被取消授权的成员也不是「来申请当主办的人」
  check(s, 'a REVOKED member does not become a pending 主办 application either',
    /if\(\(myCodes\|\|\[\]\)\.length&&!\(myCodes\|\|\[\]\)\.some\(c=>c\.role==='H'\)\)\{[\s\S]{0,60}memberOnly\('revoked'\)/.test(S)
    && /S\.memberWhy==='revoked'/.test(s) && /主办方已经取消了它的授权/.test(s));
  // 待批满 50 之后新申请被静默丢弃 —— 申请人看不出区别（有意的），但主办必须知道
  check(s, 'the host is warned when their pending queue is full (applicants never are)',
    /pend\.length>=50\?/.test(s) && /待批已经满 50 条/.test(s));
  check(s, 'the phone page writes into #app, never over document.body',
    /function capPhone\(token\)\{[\s\S]{0,400}\$\('app'\)\.innerHTML=/.test(s)
    && !/function capPhone\(token\)\{[\s\S]{0,400}document\.body\.innerHTML=/.test(s));
  /* 草稿来自一台**匿名手机** —— 每一格都要夹住形状，图片只认真正的 data:image
     （它会进 rcUpload 和 <img src>）。 */
  /* 白名单必须**认 PDF**：手机那一侧明确支持它（請求書多半是 PDF），而以前只认 data:image，
     PDF 会静默变成 img:''，账记下了却一个字节的証憑都没留（2026-07-28 复查）。
     带不回来的时候必须说出来，不能默默入账。 */
  check(s, 'the incoming draft is clamped, and the evidence whitelist covers PDF too',
    /function capClean\(raw\)/.test(s)
    && /tax_lines:tax/.test(s) && /Math\.max\(0,Math\.min\(100000000,\+raw\.total_incl_tax\|\|0\)\)/.test(s)
    && /const CAP_IMG_RE=\/\^data:\(image\\\/\(\?:png\|jpe\?g\|webp\)\|application\\\/pdf\);base64,/.test(s)
    && /if\(raw&&!m\)toast\('⚠ 手机传回来了，但原件没能带过来/.test(s));
  // 轮询不能盖掉主办正在确认的那一张（0005 服务端也拒收，这里是第二道）
  check(s, 'polling never clobbers a receipt already being confirmed',
    /if\(CAP\.busy\|\|S\.rc\)return;/.test(s)
    && /if s\.status = 'ready' then raise exception/.test(cap));
  /* 「可以连着拍」是两边文案都写了的承诺 —— 以前认领完就 capClose() 把会话删了，
     手机上第二张按下去只会看到一句日文的「セッションが見つかりません」。 */
  check(s, 'claiming one shot does NOT destroy the channel (连着拍 must actually work)',
    /function capHide\(\)/.test(s) && /rcSeed\(''\);capHide\(\);render\(\);/.test(s)
    && !/rcSeed\(''\);capClose\(\)/.test(S));
  // ✕ 关窗前先认领一次：手机可能刚传回、而轮询正因为 S.rc 暂停着
  check(s, 'closing the QR never throws away a shot the phone already sent',
    /async function capClose\(\)/.test(s)
    && /rpc\('cap_claim',\{p_token:tok\}\)[\s\S]{0,200}pending=data/.test(s)
    && /delete\(\)\.eq\('id',tok\)\.eq\('status','open'\)/.test(s));
  // 0005 的 cap_claim 不看 expires_at，过期只能客户端自己认
  check(s, 'an expired QR says so instead of spinning forever',
    /const CAP_TTL=10\*60\*1000/.test(s) && /Date\.now\(\)>=CAP\.exp/.test(s)
    && /这张二维码已经过期了/.test(s)
    && /二维码过期了 —— 请让电脑那边重新点一次/.test(s));   // 手机侧的日文原文也翻了
  check(s, 'the phone result lands in ym\'s OWN confirm card (rcSeed), not a second one',
    /S\.rc=\{d:capClean\(data\.draft\)[\s\S]{0,200}rcSeed\(''\);/.test(s)
    && !/function rcCard2|function capCard/.test(s));
}

/* ---------- 套件自检：剥注释不许吃真代码 ----------
   这一节守的是**检查工具本身**。stripComments 一旦多删，负向断言就会**假通过** ——
   套件全绿而守卫其实已经不在了。2026-07-28 发现旧实现吞掉 79,882 字符（含两个
   /api/parse 调用点），起因是 `accept="image/*"` 里的 `/*`。 */
{
  console.log('scripts/check-ym.mjs — 自检');
  const probes = [
    ['ym/organizer/index.html', /api\/parse'/g],
    ['ym/organizer/index.html', /accept="image\/\*/g],
    ['ym/member/index.html', /rpc\('ym_/g],
  ];
  let ok = true, detail = [];
  for (const [f, re] of probes) {
    const raw = read(f), cut = stripComments(raw);
    const a = (raw.match(re) || []).length, b = (cut.match(re) || []).length;
    if (a !== b) { ok = false; detail.push(`${f} ${re} raw=${a} stripped=${b}`); }
  }
  /* 真正的守卫是上面那几条探针（剥前剥后计数必须**相等**）。
     下面这个只用来证明「剥」这件事确实发生了 —— 不设上限：这个仓库的注释本来就写得多，
     organizer 一个文件就有 5 万多字符的注释，那是它的风格，不是异常。 */
  const org = read('ym/organizer/index.html');
  const removed = org.length - stripComments(org).length;
  check(org, 'stripComments removes comments WITHOUT eating code',
    ok && removed > 5000);
  if (!ok) detail.forEach(d => console.error(`      ${d}`));
  /* pyNoDoc 是 2026-08-05 新加的第五种剥法（Python 的 docstring），它同样能**吃掉真代码**：
     一旦把函数体里某个三引号字符串当成 docstring 摘掉，判缺席/清单的断言就会假通过 ——
     和 07-28 那次 stripComments 吞掉 79,882 字符是同一种事故。所以钉两头：
     docstring 确实剥掉了（剥了），而 return / if / 调用点一个都没少（没多剥）。 */
  {
    const g = pyBody(stripPy(read('api/ym_file.py')), 'def _group_gate(self, role, uid, group):');
    const cut = pyNoDoc(g);
    const eq = re => (g.match(re) || []).length === (cut.match(re) || []).length;
    check(g, 'pyNoDoc 摘掉 docstring 而不吃真代码（return / if / 调用点计数不变）',
      !!g && g.includes('"""') && !cut.includes('"""')
      && cut.startsWith('def _group_gate(self, role, uid, group):')
      && eq(/\n\s*return /g) && eq(/\n\s*if /g) && eq(/host_groups\(/g));
  }
}

/* ---------- 逐笔收款：收到一笔报名费就记一笔 (owner 2026-07-28) ----------
   「现在登记收入要先建一个收支项；主办更想要收到一笔就记一条。只有主办能建收入。」
   权限那半**本来就成立**（0017 §7 只有 host policy，注释写着 NO member policy of any kind），
   所以这一节守的是另一半：**别把同一笔钱记两遍**。 */
{
  const s = read('ym/organizer/index.html'), S = stripComments(s);
  const m17 = read('supabase/migrations/0017_ym_ledger.sql');
  const m22 = read('supabase/migrations/0022_ym_fee.sql'), M22 = stripSql(m22);
  console.log('ym — 逐笔收款');
  check(m17, 'only the HOST can ever write revenue — still no member policy on ym_entry',
    /create policy ym_entry_host_ins on ym_entry\s*\n\s*for insert to authenticated with check \(host = auth\.uid\(\) and ym_ok\(\)\)/.test(m17)
    && /NO member policy of any kind/.test(m17)
    && !/ym_entry[\s\S]{0,200}for insert[\s\S]{0,120}member = auth\.uid\(\)/.test(m17));
  // 0017 §2 的规矩：约束只整条重述。漏掉一句是看不见的
  check(m22, 'the bounds constraint is restated IN FULL, with fee added, nothing dropped',
    /src        in \('host','vol','donor','ticket','fee'\)/.test(m22)
    && /and \(src <> 'ticket' or \(direction = 'in' and image_id = '' and chip_id <> ''\)\)/.test(m22)
    && /and \(src not in \('vol','donor'\) or image_id <> ''\)/.test(m22)
    && /and \(reg_no = '' or reg_no ~ '\^T\[0-9\]\{13\}\$'\)/.test(m22)
    && /and \(status <> 'void'   or void_reason <> ''\)/.test(m22));
  check(m22, 'a fee row is income, hangs on an event, and carries no external 証憑',
    /and \(src <> 'fee' or \(direction = 'in' and image_id = '' and event_id <> ''\)\)/.test(m22));
  /* 双击 / 两台设备 / 网络重试 —— 只有唯一索引拦得住（0016 §1「双击 = 两笔真账」）。
     PARTIAL，所以 0011 §3 适用：客户端做裸 insert 读 23505，不许 on conflict 点名它。 */
  check(m22, 'one fee per person per event, enforced by a PARTIAL unique index',
    /create unique index if not exists ym_entry_one_fee\s*\n\s*on ym_entry\(host, event_id, payer_ref\) where src = 'fee' and payer_ref <> ''/.test(m22)
    && /error\.code==='23505'/.test(s) && !/on_?[Cc]onflict[^)]*ym_entry_one_fee/.test(S));
  // payer_ref 是新列，不是让 chip_id 兼职 —— 旧列开始兼职就是这个仓库最贵的那类 bug
  check(m22, 'the payer is a NEW column, not chip_id doing a second job',
    /alter table ym_entry add column if not exists payer_ref text not null default ''/.test(m22)
    && /and length\(payer_ref\)  <= 64/.test(m22)
    && /payer_ref:p\.id/.test(s) && !/chip_id:p\.id/.test(S));
  /* 🔴 这一条是整件事的重点：门票汇总算的是 単価 × **到场人数**，它不知道谁已经单独交过。
     不扣掉就是同一笔钱进两次账。 */
  check(s, 'the ticket total EXCLUDES anyone already logged individually',
    /function arrUnpaid\(e,g\)/.test(s)
    && /p\.gender===g&&p\.arrived&&!paid\[p\.id\]/.test(s)
    && /function ticketHeads[\s\S]{0,300}arrUnpaid\(e,'男'\)/.test(S)
    && !/function ticketHeads[\s\S]{0,300}arrCount\(e,'男'\)/.test(S));
  // 「没有单独记账的人」≠「总账还没读到」—— 后者 feeRows() 也返回空，扣不掉就重复入账
  check(S, 'confirming tickets REFUSES while the ledger has not loaded',
    /function confirmTickets[\s\S]{0,600}if\(canCloud\(\)&&LEDGER===null\)\{[\s\S]{0,200}return;\}/.test(S));
  check(s, 'the host is told the aggregate skipped them (a 証憑 must be reproducible)',
    /已扣掉单独记账的/.test(s) && /另有 '\+feeRows\(e\)\.length\+' 人已单独记账，未计入/.test(s));
  /* 🔴 2026-07-28 收尾复查抓到的 critical：loadLedger 的**列清单**里没有 payer_ref，
     于是 feeOf()/feePaidIds() 读到的永远是 undefined —— 整套防重复计账在客户端全线失效。
     列清单是一道会**静默失效**的门；我自己的浏览器验证之所以过了，是因为手工塞了假行。 */
  check(S, 'loadLedger actually SELECTS payer_ref (or the whole guard is dead client-side)',
    /function loadLedger[\s\S]{0,900}chip_id,payer_ref,src/.test(S));
  // 不做判断就不能编数据：内部証憑没有票面内訳，amt/1.1 反推出来的 10% 是捏造
  check(S, 'internal 証憑 (fee / 门票) never fabricate a tax split',
    !/Math\.floor\(amt\/1\.1\)/.test(S)
    && !/tax:\[\{r:'10',b,t:amt-b\}\]/.test(S)
    && (S.match(/tax:\[\],tax_total:0/g) || []).length >= 2);
  // 删掉一个已经交过钱的人 = 台账上留下一条永远对不上人的行，再加回来就是新 id → 记两遍
  check(s, 'deleting a participant who already paid asks first, and says what stays on the books',
    /function delParticipant\(pid\)\{[\s\S]{0,200}feeOf\(e,p\)/.test(s)
    && /仍然从名单里删掉/.test(s) && /台账里那条/.test(s));
  // 「没读到」不能画成「一个人都没交」——照着假象再记一笔就会撞唯一索引
  check(s, 'an unread ledger is never drawn as "nobody has paid"',
    /function feeReady\(\)/.test(s) && /总账还没读到 —— <b>先别按「确认入账」<\/b>/.test(s)
    && /if\(!feeReady\(\)\)\{toast\('总账还没读到/.test(s));
  // payer_ref 已经不在名单里的行：它扣不掉任何人，默默计进「已收 N 人」就是在说谎
  check(s, 'orphaned fee rows are surfaced, not silently counted as "collected"',
    /function feeOrphans\(e\)/.test(s) && /扣不掉任何人/.test(s));
  /* 「以后不会重复算」≠「已经重复算了」：门票汇总**已经入账**时，它是按当时的到场人数
     算的，不会自己变小 —— 这一笔就实实在在进了第二次。confirmTickets 对同一条 ticket 行
     本来就是 UPDATE（迟到的人来了要重算），所以记完一笔就让它按新头数重算。 */
  check(s, 'a fee logged AFTER the ticket total was posted shrinks that total instead of doubling it',
    /function ticketPosted\(e\)/.test(s)
    && /if\(ticketPosted\(ev\(\)\)&&ev\(\)&&ev\(\)\.id===e\.id\)\{[\s\S]{0,120}confirmTickets\(true\)/.test(s)
    && /function confirmTickets\(quiet\)/.test(s) && /if\(!quiet\)toast\('门票已入账/.test(s));
  // withdraw 那个参数结构上永远删不到东西（调用点在 mem===null 的分支里）—— 改成问一句
  check(s, 'the stale pending 主办 row is surfaced to its owner, not silently "withdrawn" by dead code',
    /function memberWithdraw\(\)/.test(s) && /S\.memberPend/.test(s)
    && /你名下还有一份「申请成为主办方」在等管理员审批/.test(s));
  // 0023：取消之后必须能重记 —— 而 app 自己的提示就是这么教主办的
  {
    const m23 = read('supabase/migrations/0023_ym_fee_void.sql');
    check(m23, 'a VOIDED fee no longer blocks re-logging (the flow the UI itself prescribes)',
      /where src = 'fee' and payer_ref <> '' and status = 'posted'/.test(m23)
      && /indexdef like '%status = ''posted''%'/.test(m23)
      && /update ym_entry set status = 'void'[\s\S]{0,400}insert into ym_entry/.test(m23));
  }
}

/* ---------- 0025：成员票据的 PDF 走 Drive（owner 2026-07-29）----------
   PDF 压不了，而 ym_submit.file_data 的服务端上限就是 600000 —— 扫描版发票必然卡死。
   0014 §4 早就写好了下一步（file_url + 代理），这一节守它落地时最容易被做塌的四件事。
   **只搬 PDF**：图片留在 file_data 里，因为主办 rcFromSubmit 要拿字节喂 /api/parse，而代理
   是故意只上传不下载的。 */
{
  const m25 = read('supabase/migrations/0025_ym_submit_drive.sql'), M25 = stripSql(m25);
  const p = read('ym/member/index.html'), P = stripComments(p);
  const s = read('ym/organizer/index.html'), S = stripComments(s);
  console.log('ym — 0025 成员票据 → Drive');

  // 1. 这是一条具名约束：少抄一条子句是**静默**失效。0017 的二十四条必须全在。
  const cl = (M25.match(/\band\s/g) || []).length;
  check(m25, '约束逐条重述，0017 的子句一条没少 (clauses >= 24)',
    /alter table ym_submit drop constraint if exists ym_submit_size/.test(M25) && cl >= 24
    && /length\(coalesce\(file_data,''\)\)\s*<= 600000/.test(M25)
    && /kind <> 'done' or slot = ''/.test(M25)
    && /amount is null or kind = 'give'/.test(M25)
    && /kind not in \('claim','join'\) or \(hours is null and cost is null\)/.test(M25));

  // 2. 两条改动过的子句必须是**放宽**（字节 or 引用）。写成 and 就会把所有现有行判死 ——
  //    存量行全都只有字节，一次迁移就能让整张表的既有票据违反约束。
  check(m25, "'file' / 'give' 是放宽成「字节**或**引用」，不是加严",
    /kind <> 'file' or \(file_name is not null\s*\n?\s*and \(file_data is not null or file_url is not null\)\)/.test(M25)
    && /kind <> 'give' or \(chip_id = ''[\s\S]{0,120}file_data is not null or file_url is not null/.test(M25));

  // 3. file_url 会变成主办点开的 href。没有这条锚，成员就能让主办的浏览器去任意站点。
  //    和 0017 §2 给 ym_entry.image_url 用的是同一条正则。
  check(m25, 'file_url 钉死在 google.com（和 0017 §2 同一条锚）',
    /file_url is null or file_url ~ '\^https:\/\/\[a-z\]\+\[\.\]google\[\.\]com\//.test(M25));
  // 只有 url 没有 id 会在下游炸：0017 §2 要求成员来源的帳簿行 image_id <> ''
  check(m25, 'file_id / file_url 同生同死',
    /\(\(file_id is null\) = \(file_url is null\)\)/.test(M25));

  // 4. before_upd 是**逐列还原**的白名单，没点名的列主办就能改。file_url 是「原件在哪」——
  //    能改它就能在 status 已经 accepted 之后把証憑换成别的文件。这是 0017 给 amount 的同一条理由。
  check(m25, '主办不能改写成员的 Drive 引用（before_upd 还原 file_id/file_url）',
    /new\.file_id := old\.file_id;\s*new\.file_url := old\.file_url/.test(M25)
    && /new\.file_data := old\.file_data/.test(M25)     // 原有那行没被顺手删掉
    && /new\.amount := old\.amount/.test(M25));

  // 5. 客户端：PDF 走代理，图片**不走** —— 图片一旦进 Drive，主办那边 OCR 就没字节可读了。
  check(p, '成员端 PDF 走 /api/ym_file，图片仍走 file_data',
    /function upPdf[\s\S]{0,700}'\/api\/ym_file'/.test(P)
    // 只数**调用点**：`upPdf(f,host,evId,` 也会撞上 function 那一行的定义（第一版就多数了一个）
    && count(P, /upPdf\(f,host,evId,fields=>/g) === 2
    && /shrinkStore\(f,b64=>send\(\{file_data:b64\}/.test(P)
    && !/shrinkStore[\s\S]{0,200}ym_file/.test(P));
  // 代理没接线时回 503，那时必须退回内联老路 —— 否则「还没配 Drive」= 成员一个字节都传不上
  check(p, 'Drive 没接线(503) 时退回内联那条老路',
    /status===503/.test(P) && /if\(b64\.length<=600000\)\{cb\(\{file_data:b64\}\)/.test(P));
  // 成员端**代码**永远不打 OCR 端点（注释里提它是允许的 —— 见上面那条的教训）
  check(p, '成员端代码不打 /api/parse', !/api\/parse/.test(P));

  // 6. 主办端：成员的 PDF 已经在 Drive 上了，入账时必须**沿用同一份**，不能再传一次 ——
  //    重传会在 Drive 里留下同一张票据的两份原件，而帳簿只指向新的那份。
  check(s, '入账沿用成员已有的 Drive 引用，不重新上传',
    /if\(R\.drive&&R\.drive\.url\)\{\s*\n?\s*img=\{id:R\.drive\.id\|\|'',url:R\.drive\.url\}/.test(S)
    && /\}else if\(R\.img\)\{/.test(S) && /rcUpload\(R\.img/.test(S));
  /* 两个查看器都要在本地再验一次 google.com —— 和 CODE_RE 那条同一个道理。
     ⚠ 这条**必须跑在原始文本**上：stripComments 不认正则字面量，`\/\/` 里那个 `//` 会被当成
     行注释，从那里一路吃到行尾 —— 实测这两行的锚在 strip 之后是 0 次。文件开头的规矩只要求
     ABSENCE / ORDER 类断言跑 stripComments；这是一条**存在性**断言，用原文才是对的。 */
  /* ⭐⭐ 2026-08-06 owner：「even they tap on photo try to download, they should not be asked
     for google login because we have verify his authority in this app, nothing related to
     google drive.」—— 所以这条从「链接要复核」升级成「**一个都不许有**」。
     四处曾经把人送去 Google：相册(driveThumb) · 附件(openAtt) · 票据原图(rcImage) ·
     待确认的看原件(pendView)。四处现在都走 driveView。
     fonts.googleapis.com 是字体表（无鉴权、不是取件），单独放行。 */
  check(s, '⭐⭐ 客户端一个指向 Google 网盘的出口都不剩（四处都走 driveView）',
    (() => {
      const c = S;   // 这个块里 S 就是剥过注释的 organizer
      const hits = (c.match(/google\.com[^\s"')]*/g) || []).filter(h => !/^google\.com\/css/.test(h)
        && !/fonts\.googleapis/.test(h));
      return hits.length === 0
        && !/a\.href=url;a\.target='_blank';a\.rel='noopener'/.test(c)
        && count(c, /driveView\(/g) >= 4;      // 定义 + 附件 + 票据原图 + 看原件
    })());
  // Drive 那一路没有字节可 OCR —— 不许假装识别，要开手工卡
  check(s, 'Drive 上的 PDF 开手工卡，不假装 OCR',
    /if\(data\.file_url\)\{[\s\S]{0,700}rcSeed\('hand'\)/.test(S)
    && /file_name,file_mime,file_data,file_id,file_url/.test(S));

  /* 7. 部署顺序：迁移和前端是两次独立的动作。前端**先**上线时，PostgREST 对不存在的列是
     整条 select 报错 —— 主办会连老的内联票据都打不开，一个还没启用的新功能把已经在用的
     功能拖下水。两个查看器必须走同一个带退化的取数口，而不是各自写死列名。 */
  check(s, '0025 两列还没迁移时，主办仍看得到老票据（select 会退回老列表）',
    /async function submitFile\(sid\)[\s\S]{0,600}colMissing\(r\.error\)[\s\S]{0,300}file_name,file_mime,file_data'\+TAIL/.test(S)
    && count(S, /submitFile\(sid\)\s*\n?\s*\.then/g) === 2
    && !/from\('ym_submit'\)\.select\('file_name,file_mime,file_data,file_id,file_url/.test(S));
  // 成员那边同理：列不存在时给一句人话，而不是甩 PostgREST 原文让人反复重传
  check(p, '成员端把「列不存在」翻译成人话',
    /function upErr\(error,fallback\)[\s\S]{0,400}does not exist/.test(P)
    && count(P, /toast\(upErr\(error,/g) === 2);

  /* 8. attachTo() —— HANDOFF 记了很久的「硬约束 1 的活违规」。ym_doc.payload 是全系统唯一
     没有体积上限的面，而这里往里塞 data URL，还每 800ms 保存整个重传；>400KB 的更糟：
     只留一个文件名，主办永远点不开。现在字节一律进 Drive，payload 里只留引用。
     ⚠ 这条守的是「不再往 payload 里加新字节」，**不是**给 payload 加了 CHECK ——
     那个仍然需要先做数据审计（存量可能已超任何上限，加了会让 owner 下一次保存 500）。 */
  check(s, 'attachTo 的字节进 Drive，不再进 ym_doc.payload',
    /async function attachUpload[\s\S]{0,500}'\/api\/ym_file'/.test(S)
    && /holder\.files\.push\(\{id:fid,name:f\.name,url:up\.url,driveId:up\.id/.test(S)
    // 老的「>400KB 只留文件名」不再是正常路径，只能出现在 503 退化分支里
    && !/if\(f\.size>400000\)\{holder\.files\.push\(\{id:fid,name:f\.name\}\);finish\(\)/.test(S));
  /* 性质不变：Drive 没接线时，小的内联、大的只留名字。
     ⚠ 量的**不再是 f.size，而是真正要内联的那串字节** —— 图片现在先 shrink，f.size 是原图
     （手机照片 5MB），而我们手上其实只有压完的 ~200KB。按 f.size 判会把一张明明存得下的
     照片降级成「只有名字」。550000 ≈ 400KB 二进制的 base64 长度，和原来的门槛等价。 */
  check(s, 'Drive 没接线(503) 时 attachTo 原样退回老行为',
    /if\(up==='unwired'\)\{[\s\S]{0,300}dataUrl&&dataUrl\.length<=550000[\s\S]{0,200}else holder\.files\.push\(\{id:fid,name:f\.name\}\)/.test(S));
  /* 照片和票据走同一条压缩规矩。不压的话同一张手机照片「当票据」传得上去、「当附件」被拒 ——
     owner 2026-07-29 报的「附件上传失败」就是这个。 */
  /* ⚠ 用原始 `s`，不用 `S` —— 这一行带正则字面量（`/^image\//`），stripComments 会从
     那对斜杠处把它截断（见文件顶部的「已知剩余缺口」）。正向断言拿原文匹配是安全的。
     字面代码用 includes 也比正则可靠：这几行里 / 和 \ 太多，转义写错就是假绿。 */
  check(s, '附件里的照片先压到 1600px，不受 4MB 上限约束',
    s.includes("const isImg=/^image\\//.test(f.type||'')")
    && s.includes('if(!isImg&&f.size>ATTACH_MAX)')
    && s.includes("if(isImg){shrink(f,b64=>go(b64,'image/jpeg'"));
  // shrink() 以前没有 onerror：坏图/HEIC 会让回调永远不来，pending 减不到 0，提示永不出现
  check(s, 'shrink 解不开图片时也一定回调（否则上传静静挂住）',
    s.includes('img.onerror=') && s.includes("cb('');}")
    && s.includes('if(!b64){bad++;finish();return;}'));
  // 附件链接会进 window.open —— payload 会被发布/共享，不该成为塞 javascript: 的通道
  /* 有 driveId 的附件走 driveView；只有老 payload 里的 data:（云盘没接线时的内联退路）
     才 window.open —— 那一份字节本来就在本机，和 Google 无关。 */
  check(s, '附件走 driveView；只有本机 data: 还开新标签，Drive 链接一律不开',
    /function openAtt\(f\)/.test(s)
    && /if\(f&&f\.driveId\)\{driveView\(f\.driveId,mediaGroupNow\(\),f\.name,f\.mime\);return;\}/.test(s)
    && /if\(\/\^data:\/\.test\(u\)\)\{window\.open\(u,'_blank','noopener'\);return;\}/.test(s)
    && count(S, /openAtt\(f\);\}/g) === 2
    && !/window\.open\(f\.url/.test(S));

  /* 9. 复盘媒体库 (2026-08-02) —— 打码后的活动照片。和 attachTo 同一条底线：字节只进
     Drive（<活动·日期>/照片/），payload 只留引用 —— 但这里没有 data: 退路，Drive 没接线
     就当面拒收（新面不背老包袱）。缩略图/下载是仅有的两个取图出口，文件 id 先洗掉
     [^A-Za-z0-9_-] 再拼 URL。⚠ 这些断言的目标行带正则字面量，一律拿原始 s 用 includes。 */
  check(s, '媒体库上传复用 attachUpload，进 Drive 的「照片」目录',
    s.includes("attachUpload(b64,'image/jpeg',f.name,'照片')")
    && s.includes("kind:kind||'附件'"));
  check(s, '媒体库条目只装 Drive 引用；unwired 当面拒收（两个写入口都在）',
    s.includes("cur.media.push({id:uid(),name:f.name,driveId:up.id,url:up.url,ts:")
    && s.includes("if(up==='unwired'){unwired++;continue;}")
    && s.includes("const cur=STORE.events.find(x=>x&&x.id===evId)||e;")
    // 「从网盘找回」挂回的那一条也只装引用（rescued:1 只是来路标记，不是字节）
    && s.includes("cur.media.push({id:uid(),name:f.name,driveId:f.driveId,"));
  /* 🔒 2026-08-05 手机竞态那把锁。**原来是数出来的**：`count(.media.push) === 1`。
     那个数字守的从来不是「只能有一处」，而是「每一处都不许攥着循环开头那个活动对象」——
     cloudRefresh 一句 `STORE.events[i]=inc` 就能把它换掉，后面 push 进去的照片就成了
     谁也看不见的孤儿字节（owner 收到的报告是「toast 说传好 3 张，相册是空的」）。
     「找回」上线后合法的 push 变成两处，数字锁只能靠**放宽数字**过关 —— 那等于把锁拆了。
     所以换成语义锁：把每一处 push 都找出来，逐个问同样三句话
       ① 写的对象叫不叫 cur（裸的 `e.media.push(` 一律不算）；
       ② 在它前面、同一个函数里，有没有「按 id 重新找回活动」那一句；
       ③ 那一句和 push 之间**有没有 await**（有 = 找回的对象又可能被换掉了，白找）。
     加一处新的 push 而忘了重新找回 → 这条自己就会红，不用再回来改数字。 */
  check(s, '规矩 11：每一处 media.push 都写进「按 id 重新找回」的活动，中间没有 await',
    (() => {
      const c = stripTplNotes(stripComments(s));
      const sites = [...c.matchAll(/([A-Za-z_$][\w$]*)\.media\.push\(/g)];
      // 上传（mediaAdd）和挂回（mediaKeepIds）两处都得在：少一处不是「更安全」，是功能没了
      if (sites.length < 2) return false;
      if (/[^\w$.]e\.media\.push\(/.test(c)) return false;   // 退回攥着循环开头那个 e = 复发
      return sites.every(m => {
        if (m[1] !== 'cur') return false;
        const head = c.slice(0, m.index);
        // 函数边界跟着代码走（不是定长切片）：往函数里加注释不该让这条变红
        const at = Math.max(head.lastIndexOf('\nfunction '), head.lastIndexOf('\nasync function '));
        if (at < 0) return false;
        const seg = c.slice(at, m.index);
        const found = seg.lastIndexOf('const cur=STORE.events.find(x=>x&&x.id===');
        return found >= 0 && !/\bawait\b/.test(seg.slice(found));
      });
    })());
  /* 传一张落一次盘，而不是整批传完才存（owner 2026-08-05）：手机传到一半被切走或被系统
     杀掉，已经进了网盘的那几张不会变成谁也够不着的孤儿字节；这一存顺带盖上 mtime，
     从这一刻起「本机未推的编辑在先」那道闸也开始护着这场活动。附件同理。 */
  check(s, '传一张存一次盘（媒体库逐张 · 附件逐个），不是整批完才存',
    s.includes('cur.mtime=Date.now();save();render();')
    && /const finish=\(\)=>\{save\(\);/.test(s));
  // 删除走的是同一条：await（trash_media）之后也要按 id 找回，否则删掉的那张会原地复活
  check(s, '删照片也在 await 之后重新找回活动，不写进可能已被换掉的对象',
    s.includes("const cur=STORE.events.find(x=>x&&x.id===e.id)||e;")
    && s.includes("cur.media=(cur.media||[]).filter(x=>x.id!==id);")
    && !/\be\.media=e\.media\.filter\(/.test(s));

  /* ---------- runtime: 手机上那个竞态本身 (owner 2026-08-05) ----------
     上面几条是「代码长这样」，这一条是**真的把 mediaAdd 跑起来**，在上传中途照着
     cloudRefresh 的那一句把活动对象换掉，然后数照片。修之前这里是 media=1（三张只剩一张，
     而 toast 说「传好 3 张」）—— 那正是 owner 收到的报告。静态断言看不出这个，只有跑才看得出。 */
  const mSrc = s.slice(s.indexOf('let _upBusy=0;'), s.indexOf('async function cloudRefresh('))
             + s.slice(s.indexOf('function mediaAdd(input)'), s.indexOf('function mediaThumbFail'));
  const race = async (swapMidFlight) => {
    const live = { id: 'ev1', name: '八月茶会', date: '2026-08-10', media: [] };
    const STORE = { events: [live] };
    let n = 0; const seenBusy = [];
    const env = {
      S: {}, SESSION: { user: { id: 'u1', email: 'a@b.c' } }, STORE,
      toast: () => {}, uid: () => 'id' + (++n), save: () => {}, render: () => {},
      ev: () => STORE.events.find(e => e.id === 'ev1') || STORE.events[0],
      shrink: (f, cb) => setTimeout(() => cb('BASE64'), 0),
      attachUpload: async () => {
        await new Promise(r => setTimeout(r, 1));
        seenBusy.push(busyNow());
        // cloudRefresh 的那一句：STORE.events[i]=inc —— 活动对象被整个换掉
        if (swapMidFlight && n === 1) STORE.events[0] = { ...live, media: [...live.media] };
        return { id: 'drive' + n, url: 'https://drive.google.com/x' + n };
      },
    };
    const keys = Object.keys(env);
    const { mediaAdd, busyNow } = new Function(...keys, mSrc + '\n;return {mediaAdd,busyNow};')(
      ...keys.map(k => env[k]));
    mediaAdd({ files: [{ name: 'a.jpg', type: 'image/jpeg', lastModified: 1 },
                       { name: 'b.jpg', type: 'image/jpeg', lastModified: 1 },
                       { name: 'c.jpg', type: 'image/jpeg', lastModified: 1 }], value: 'x' });
    await new Promise(r => setTimeout(r, 150));
    return { landed: STORE.events[0].media.length, seenBusy, after: busyNow() };
  };
  const calm = await race(false), hit = await race(true);
  check(s, '跑起来：无干扰时三张全部落账', calm.landed === 3);
  check(s, '跑起来：上传中途活动对象被换掉，三张仍全部落在当前活动上（不是孤儿）', hit.landed === 3);
  check(s, '跑起来：整批期间 busyNow() 为真（挡住 cloudRefresh），批次结束后归零',
    hit.seenBusy.length === 3 && hit.seenBusy.every(Boolean) && hit.after === false);
  /* ⭐ 2026-08-05 这一条整个翻了面：从「取图出口只剩 driveThumb 一个」变成「一个都不许剩」。
     driveThumb 是 `<img src="(网盘缩略图服务)?id=…">` —— 它把取图这件事**外包给看的人那台
     浏览器**，于是「看不看得见」取决于那台浏览器登没登一个对这个 Drive 有权限的 Google
     账号。owner 2026-08-05 原话：「other user can not login with my google account」——
     沙龙的志愿者、嘉宾、别的主办没有、也**不该有** owner 的 Google 账号。
     现在字节走代理（read_media → blob:），页面上一个网盘地址都不需要了。
     ⚠ 断言拿**原始 s**（不是 S）：连注释里写死的那种 URL 也不留。URL 只要还在文件里，
     明天就有人把它复制回代码，而这条毛病的复发形态恰恰是「随手加一个缩略图 src」。
     同时守住 owner 2026-08-03 那句「不要指向网盘的链接」：下载 / 在网盘打开都不许回来。 */
  check(s, '⭐ 全文件一个 drive.google.com 都不许剩（driveThumb 已删；下载/在网盘打开也不许回来）',
    !s.includes('drive.google.com')
    && !S.includes('driveThumb')
    && !s.includes("uc?export=download")
    // 只看媒体库那一段：总账里的票据仍然可以点开原件，那是另一个功能，owner 没让动
    && !stripComments(s.slice(s.indexOf('function mediaList'), s.indexOf('function addRow'))).includes('在网盘打开')
    && !/function driveDown|function mediaOpenDrive|function mediaDownload/.test(s));
  /* ⭐ 同一件事的另一半：屏幕上那句**错的指令**。以前相册底下常驻一句「照片显示不出来 ——
     这台浏览器没登录存照片的那个 Google 账号。登录一次就能看；不影响上传」。它在教主办的
     志愿者/嘉宾去要 owner 的 Google 账号 —— owner 2026-08-05 发火发的就是这句话。
     删函数容易，删**那句话**才是这一轮真正交付的东西，所以它单独一条锁，钉的是「屏幕上
     读得到的字」，不是某个函数在不在。
     ⚠ 判缺席必须先 stripComments + stripTplNotes（规矩 9）：新注释里合法地引用了这句旧
     文案（「它是错的指令，所以整句删了」），拿原文判会永远假红。 */
  check(s, '⭐ 屏幕上不许再出现「没登录存照片的那个 Google 账号」这条错的指令（#mthint 整句删掉）',
    (() => {
      const T = stripTplNotes(stripComments(s));
      return !T.includes('没登录存照片的那个 Google 账号')
        && !T.includes('登录一次就能看')
        && !T.includes('Google 账号')      // 任何叫用户去登 Google 的话，一句都不许有
        && !T.includes('mthint');          // 承载那句话的那个节点本身
    })());
  {
    /* ⚠ 这里以前是 `s.slice(at, at+1600)` —— 定长切片就是个定时炸弹：2026-08-05 往
       mediaDel 里补了两段注释（403 的两种来路、group 为什么先取成字符串），被断言的
       那几行当场被推出窗口，一条守着**删除顺序**的锁因为注释而变红。边界改成跟着代码走。 */
    const mb = fnBody(stripTplNotes(stripComments(s)), 'async function mediaDel(');
    /* owner 2026-08-03 改口：「移除」要连云端那份一起删。所以顺序是**先删字节、成功了才摘条目** ——
       反过来的话，删失败就在网盘里留下一张谁也够不着的孤儿照片；而删不掉时要留着条目并说清楚，
       不能让屏幕显示「已经没了」而云端还在。三道限制在服务端和 Apps Script 那侧。
       2026-08-05 多一件事：group 跟着一起送（作用域收窄到这一场活动），而且它必须在
       **await 之前**就取成字符串 —— 规矩 11 禁的是跨 await 攥着活动对象，字符串是快照。 */
    check(s, '媒体库「删除」先删云端字节、成功了才摘条目；失败留着条目并说清',
      mb.includes('const group=evGroup(e);')
      && mb.indexOf('const group=evGroup(e);') < mb.indexOf('await')
      && mb.includes('await upSerial(()=>mediaTrash(m.driveId,group))')
      && mb.indexOf('mediaTrash(m.driveId,group)') < mb.indexOf('cur.media=(cur.media||[]).filter')
      && mb.indexOf('cur.media=(cur.media||[]).filter') > 0
      && mb.includes("if(r==='unwired')") && mb.includes("if(r==='denied')")
      && mb.includes("if(r==='mismatch')") && mb.includes("if(r!==true)")
      && /action:'trash_media'/.test(s));
  }
  /* 相册 = 整屏一栏、按原比例、直接滚。没有九宫格、没有「点开再看一层」的灯箱 ——
     滚动本身就是浏览方式（owner 2026-08-03）。只读也能看，上传按钮只在可编辑时出现。
     ⚠ 2026-08-05：这条以前还顺手钉着 `id="mthint"`（那句「去登 Google 账号」的常驻提示）。
     那句话被整句删掉了，而它本来就不属于「相册长什么样」这件事 —— 换成真正决定观感的那行
     CSS（宽度撑满 + 高度自适应 = 一栏、原比例），锁住的东西比原来更贴题。 */
  check(s, '媒体库是整屏滚动相册：一栏、原比例、无灯箱、无九宫格',
    s.includes("${S.mediaOpen?mediaSheet(e):''}")
    && s.includes('onclick="mediaOpen()"')
    && s.includes('class="mfull"') && s.includes('class="mroll"')
    && s.includes('onerror="mediaThumbFail(this)"')
    && s.includes('.mshot img{width:100%;height:auto;display:block}')
    && s.includes('onchange="mediaAdd(this)"')
    && !/function mediaShow|function mediaStep|class="mlight"|\.mgrid\{|\.mtile\{/.test(s)
    && !/S\.mediaN/.test(s));
  check(s, '媒体库网格 onclick 里的 id 走 escJs（on* 属性里 esc 不够）',
    s.includes("mediaDel('${escJs(m.id)}')"));
  /* owner 的 iPhone 连续两轮 0/3「照片打不开」：mediaAdd 曾「先清 input.value、后读字节」，
     iOS WebKit 清空后会作废 File 底层的临时文件。清空必须在所有 shrink() 启动之后 ——
     attachTo 一直是这个顺序。⚠ mediaAdd 体内有正则字面量，一律拿原始 s 切片判断。 */
  {
    const a = s.indexOf('function mediaAdd'), b = s.indexOf('function mediaThumbFail');
    const body = (a >= 0 && b > a) ? s.slice(a, b) : '';
    check(s, '媒体库上传先启动读取、后清 input（iOS：先清后读=张张打不开）',
      body.includes('for(const f of fs)')
      && body.indexOf('for(const f of fs)') < body.lastIndexOf("input.value='';")
      && !body.includes("const all=[...(input.files||[])];input.value=''"));
    /* 3 张并行上传 → GAS 各自执行 findOrCreate「找不到就建」→ Drive 上同名目录两份
       （2026-08-02 实测）。客户端逐张顺序传；服务端锁在 docs 源码里等下次部署。 */
    // 示例退役后没有「示例活动拒收」这一条了；顺序上传仍然要钉住（并发＝Drive 上两个同名目录），
    // 而真正的总闸是 upSerial —— 附件那条多选路径以前是并行的，owner 传 2 张就撞出两个目录。
    check(s, '媒体库逐张顺序上传（并发会在 Drive 建出重复目录）',
      !body.includes('fs.forEach'));
  }
  // 新建活动必须自带 participants:[] —— viewReview 不设防地 .filter/.reduce 它，
  // 缺省就是「新活动一进复盘白屏」（2026-08-02 验证时替用户踩到）
  check(s, 'instantiate 的活动自带 participants:[]（复盘页不设防）',
    /return \{id:uid\(\),name:tpl\?tpl\.name:'新活动'[\s\S]{0,120}participants:\[\]/.test(s));
  /* 「手机传的照片，再次打开就没有了」：同步是整份文档后写的赢，桌面开着的旧页面存一次盘
     就拿旧活动把云端盖掉。mtime 闸：每台设备只推本机 cloudLoad 之后动过的活动。 */
  check(s, 'mtime 闸：闲置旧页面不再有资格覆盖别的设备刚推上云的活动',
    s.includes('(!_cloudBase||(e.mtime||0)>=_cloudBase)')
    && s.includes('_cloudBase=Date.now()')
    && s.includes('e0.mtime=Date.now()')
    && s.includes('localReal.forEach(e=>{e.mtime=Date.now();})'));
  // 剩下的失败也要分层说：服务端/网络给 HTTP 码，读不出来单独说 —— 否则 owner 只能报「失败」
  check(s, '上传失败分层：HTTP 码进 toast，decode 失败单独一句',
    s.includes("return {fail:'HTTP '+r.status}")
    && s.includes('把括号里的码发给管理员')
    && s.includes('张照片读不出来'));
  /* 2026-08-02：一个少写的 ASCII 右括号（字符串里的全角「）」骗过了眼睛）让整个 app 脚本
     编译失败 —— 而全套正则断言照常全绿，因为它们只看文本在不在。整段脚本必须真的能编译。
     new Function 只编译不执行；两个 app 都是单 <script> 的 vanilla JS，没有 import。 */
  {
    let parseErr = '';
    for (const [f, src] of [['organizer', s], ['member', read('ym/member/index.html')]]) {
      const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
      for (const b of blocks) {
        try { new Function(b[1]); } catch (err) { parseErr = f + ': ' + err.message; }
      }
      if (!blocks.length) parseErr = f + ': no <script> block found';
    }
    check(s, '两个 app 的整段脚本都能编译（正则断言抓不住语法错误）', !parseErr);
    if (parseErr) console.error('    ↳ ' + parseErr);
  }
  /* owner 2026-08-02：三张全失败，第一反应是「网盘没授权」—— 其实是 403（没登录）。
     「失败全被吞掉」是忘记密码那次记过的门 5：401/403 要说「先登录」，别混进笼统的失败。 */
  check(s, '上传被拒(401/403)时说人话 —— 媒体库和附件都提示「先登录」',
    s.includes("if(r.status===401||r.status===403)return 'denied'")
    && s.includes('请用主办账号登录后再传')
    && s.includes('请先登录主办账号'));
  /* 手机页面在后台放久，内存里的 access_token 过期 → 403，症状和「不是主办」一模一样。
     上传令牌必须取实时的（getSession 自动续期）；被拒时报出当前邮箱，没登录当面说。 */
  check(s, '上传令牌取实时（liveToken）；被拒报邮箱；没登录先说没登录',
    s.includes('async function liveToken')
    && s.includes('user_token:(await liveToken())||undefined')
    && s.includes('SESSION.user.email')
    && s.includes('这台设备还没登录'));
  /* owner 2026-08-02：「退出了仍然可以看到主办工作台」。云端同步的真实数据全在
     localStorage，退出不清 = 共用设备上下一个人看得到还能改（改动会在真主办下次
     登录后被 800ms 自动推送写回云端）。顺序：先冲悬着的推送 → 重置成示例 →
     直接 setItem，绝不能走 save()（退账完成前它会拿示例库覆盖云端真库）。 */
  {
    const a = s.indexOf('function doSignOut'), b = s.indexOf('/* ---------- reuse prompts');
    const body = (a >= 0 && b > a) ? s.slice(a, b) : '';
    check(s, '退出登录清掉本地真实数据：先冲推送 → 重置示例 → 直接 setItem（不走 save）',
      body.includes('await cloudPushAll()')
      && body.indexOf('await cloudPushAll()') < body.indexOf('STORE=seed()')
      && body.includes('localStorage.setItem(LS_KEY,JSON.stringify(STORE))')
      && !body.includes('save();')
      && body.indexOf('STORE=seed()') < body.indexOf('sb.auth.signOut'));
  }
  /* 10. 登录墙 (2026-08-03) —— owner：手机上任何人点「主办登录」都直接看到了工作台。
     主办台不再有匿名「演示模式」：render() 第一行分流，无会话只画 authWall()，
     工作台/台本/名单在会话之前一个字不渲染（成员页从第一天就是这个结构：!SESSION →
     loginHtml）。?cap= 拍照页在 boot 分流、不经过 render()，上面第 5 节已经钉着。 */
  {
    const c = stripComments(s);
    const r = c.slice(c.indexOf('function render()'), c.indexOf('function go('));
    check(s, '登录墙：render() 开头就把无会话分流到 authWall，工作台一个字不渲染',
      /* mediaForget() 必须在这一句里：这个 return 排在 mediaLazyWire() 前面，而「离开相册
         就把 blob 还回去」那道网正挂在 mediaLazyWire 开头。退出登录 / 会话过期走的就是
         这条路 —— 少了它，屏幕已经是登录墙，上一个主办那一批来宾照片的字节还留在页面里
         （单页 app，一天都不刷新一次）。「退出 = 回到出厂演示态」在照片这一项上不能破口。 */
      r.includes("if(!SESSION){mediaForget();$('app').innerHTML=authWall();return;}")
      && r.indexOf('if(!SESSION)') < r.indexOf('navItems'));
    const w = c.slice(c.indexOf('function authWall'), c.indexOf('function authNewPw'));
    check(s, '登录表单只有一份、长在墙上；authSheet 里不再有匿名分支（同一道门不许两份定义）',
      count(s, /id="au_email"/g) === 1 && count(s, /id="au_pw"/g) === 1
      && w.includes('id="au_email"') && w.includes("S.authTab==='forgot'")
      && w.includes('doSignUp()') && w.includes('../member/')
      && !c.slice(c.indexOf('function authSheet'), c.indexOf('function authWall')).includes('id="au_email"'));
    /* ⚠ 这条断言第一版是 `c.includes('else render();')` —— 而全文件有两处，doNewPw 里那句
       也匹配，删掉真正那一行照样绿（复查用变异测试实锤）。锚在它前面那句上。
       它为什么要紧：没有它，登出状态的访客永远停在「正在打开主办台…」。
       `!$('au_email')` 是第二条命：看门狗已经画出表单时不重画，否则清掉正在输入的密码。 */
    check(s, '墙上的「正在打开…」有出路：getSession 回来 else render()，外加 4 秒看门狗',
      c.includes('_authReady=false') && w.includes('_authReady')
      && /getSession\(\)\.then\(\(\{data\}\)=>\{\s*_authReady=true;/.test(c)
      && /if\(SESSION\)cloudLoad\(\);\s*else if\(!\$\('au_email'\)\)render\(\);/.test(c)
      && /\.catch\(\(\)=>\{_authReady=true;if\(!\$\('au_email'\)\)render\(\);\}\)/.test(c)
      && /setTimeout\(\(\)=>\{if\(!_authReady\)\{_authReady=true;if\(!SESSION\)render\(\);\}\},4000\)/.test(c));
    /* 换人闸：会话过期不走退出登录 —— 旧主办的名单/台本还在 localStorage，另一个账号
       登进来不拦的话，工作台直接画给他看（pending/成员点错门两条路提前 return，画的
       正是本机 STORE），已批准的还会把这批活动合并**推上自己的云**。处理同 doSignOut：
       重置成示例、直接 setItem（绝不走 save —— 它会调度云推送）。 */
    /* 换人闸 —— 复查（三视角）把第一版打回来过四条，每一条都单独钉住：
       ① 三个入口都要过闸（cloudLoad + 重设密码那两个 return 得更早的分支）；
       ② 比的是**开机 latch 的** _storeOwner，不是此刻的 localStorage（两个标签页停在墙上，
          B 在 tab2 登录会先把 key 改成 B，tab1 再读就「相同」→ 不重置 → 把 A 的整份 STORE
          合并上传进 B 的云）；
       ③ 没有 key 的旧设备（线上每一台）非空就当外人的 —— 否则闸对现存设备**全员失效**；
       ④ 内存缓存和防抖里的那一推也要清（S.rc 那张卡每次 render 都画，一按保存就把 A 的
          票据传进 B 的网盘、记进 B 的账）。 */
    {
      const a = c.indexOf('function ownerGate()');
      const g = a < 0 ? '' : c.slice(a, c.indexOf('function memberOnly'));
      check(s, '换人闸①：三个入口都过闸（cloudLoad + 重设密码两个分支）',
        a > 0 && /async function cloudLoad\(\)\{[\s\S]{0,160}ownerGate\(\);/.test(c)
        && /if\(RECOVERY_URL&&SESSION\)\{ownerGate\(\)/.test(c)
        && /ev2==='PASSWORD_RECOVERY'\)\{_authKey=key;ownerGate\(\)/.test(c)
        && count(c, /ownerGate\(\)/g) === 4);          // 1 定义 + 3 调用
      check(s, '换人闸②：比开机 latch 的 _storeOwner，不是此刻的 key（多标签页竞争）',
        g.includes('const prev=_storeOwner')
        && g.includes('_storeOwner=SESSION.user.id')
        && c.includes("_storeOwner=localStorage.getItem('jjym_owner')")
        && !g.includes("const prev=localStorage.getItem('jjym_owner')"));
      check(s, '换人闸③：没有 key 的旧设备，本机非空就当外人的（收进 jjym_orphan，不删）',
        g.includes("foreign=prev?prev!==SESSION.user.id:!!(STORE&&(STORE.events||[]).length)")
        && g.includes("localStorage.setItem('jjym_orphan',raw)"));
      check(s, '换人闸④：重置本机 + 清内存缓存 + 掐掉防抖里那一推；直接 setItem 不走 save',
        g.includes('clearTimeout(_pushT)')
        && g.includes('STORE=seed()')
        && g.includes('localStorage.setItem(LS_KEY,JSON.stringify(STORE))')
        && !g.includes('save();')
        && ['PROFILE=null', 'PENDING=[]', 'CODES={}', 'JOINREQ=null', 'ACCEPTED=[]',
            'LEDGER=null', 'POSTS=null', 'ADMIN=null', 'capStop()', 'S.rc=null']
             .every(t => g.includes(t)));
    }
    /* 上传排队 —— owner 2026-08-03：传 2 张照片，Drive 上建出 2 个同名活动目录。
       GAS 的 findOrCreate 不是原子的（仓库里加了 LockService，部署上去的还是旧的），
       所以客户端把**所有**上传路径串成一条队：附件多选 / 媒体库 / 票据 互不重叠。 */
    /* 2026-08-05：队伍里多了第五个人 —— 「从网盘找回」（列目录）。它**必须**排进同一条队，
       理由和上传不同但一样硬：边传边扫会把「字节已到、下一行才写记录」的那张列成孤儿，
       主办一挂回就是一条我们自己造出来的重复条目。
       ⚠ 原来的收口是 `count(upSerial() === 4`。数字锁的毛病在这次暴露得很清楚：加一条
       新路径时，让它变绿最省事的办法就是把 4 改成 5 —— 改完了，「新路径到底排没排队」
       一个字都没有被验证过。所以改成从**事实**倒推：谁在打 /api/ym_file，谁就必须
       被 `upSerial(()=>它(` 包着。将来第六条路照样自己撞上这条。 */
    /* ⚠ 2026-08-05 第二次改：队伍里出现了第一个**必须不排队**的人 —— mediaReadDo（取一张
       照片的字节）。理由是 upSerial 是**上传**队列：一边传照片一边滚相册的话，取图会被
       排在上传后面（传一张要好几秒，滚一屏要取十几张），而 mediaAdd 又在等自己那一批 ——
       两边互相饿死，症状是「照片一直转、上传也一直转」。取图有自己的小队列（MEDIA_PAR）。
       所以这条锁改成「白名单 + 一条明写的例外」：例外只有一个名字，而且例外**本身**也被
       钉住（不许 upSerial、不许 upMark）—— 否则将来第七条路只要把自己加进例外名单，
       这条锁就变成了一张空头支票，而那正是它被写出来要防的东西。 */
    check(s, '上传串行：打 /api/ym_file 的都在同一条队里；只有取图是明写的例外（不排队、不标忙）',
      (() => {
        const q = stripTplNotes(c);
        if (!q.includes('let _upChain=Promise.resolve()')) return false;
        if (!/function upSerial\(fn\)\{[\s\S]{0,220}_upChain=p\.then/.test(q)) return false;
        // 谁真的在打这个端点 —— 按函数体找，不是按名字猜
        const fns = [...q.matchAll(/\n(?:async )?function ([A-Za-z0-9_$]+)\(/g)];
        const callers = fns.filter((m, i) =>
          q.slice(m.index, i + 1 < fns.length ? fns[i + 1].index : q.length)
           .includes("upFetch(API+'/api/ym_file'")).map(m => m[1]);
        // 排队那四条一条都不能少（少了 = 某条路被拆掉或改了名，都该当面看见）
        if (['attachUploadDo', 'rcUploadDo', 'mediaTrash', 'mediaScanDo']
              .some(n => !callers.includes(n))) return false;
        if (!callers.every(n => new RegExp('upSerial\\(\\(\\)=>' + n + '\\(').test(q))) return false;
        /* 取图是**明写的例外**，而且例外本身也被钉住。它连 upFetch 都不用 —— 2026-08-05
           查出来的：upFetch 的超时定时器挂在 .finally 上，而 fetch 的 promise 在**响应头**
           到达就 resolve，真正下载几百 KB~几 MB 的 `await r.blob()` 完全没有保护。
           别的调用方读的都是几百字节 JSON，只有取图绝大部分时间花在那一段。半开连接下
           它永远不 settle → _mediaRun 永久少一个位子 → 攒够 MEDIA_PAR 次，全 app 的取图
           静默死掉。所以它自己拿一个 AbortController，覆盖到 blob() 之后。
           三件事一起钉：① 它确实在打这个端点且带 signal；② 它不排队也不标忙；
           ③ mediaForget 会把在飞的掐掉（否则退出登录后上一个人的照片还在往下载）。 */
        const rb = fnBody(q, 'async function mediaReadDo(');
        if (!rb || !rb.includes("fetch(API+'/api/ym_file'") || !rb.includes('signal:ac?ac.signal:undefined')) return false;
        if (rb.includes("upFetch(API+'/api/ym_file'")) return false;
        if (/upSerial\(\(\)=>mediaReadDo\(/.test(q)) return false;
        if (!/_mediaAC\.forEach\(a=>\{try\{a\.abort\(\);\}catch\(e\)\{\}\}\);_mediaAC\.clear\(\);/.test(q)) return false;
        return ['function mediaPump(', 'function mediaQueue(', 'async function mediaReadDo(']
          .every(f => { const b = fnBody(q, f); return !!b && !b.includes('upSerial(') && !b.includes('upMark('); });
      })());
    // 找回那一路还多一条：它排队之后**不许再自己 upMark** —— upSerial 的 run 里已经标了忙，
    // 标两次会让 busyNow() 永远归不了零，cloudRefresh 从此再也拉不下来（比不标更糟）。
    check(s, '从网盘找回排进上传队尾，且不重复 upMark',
      /const r=await upSerial\(\(\)=>mediaScanDo\(group,skip\|0\)\)/.test(c)
      && !fnBody(stripTplNotes(c), 'async function mediaScan(').includes('upMark('));
  }
}

/* ============ 从网盘找回 / 归属闸 (2026-08-05) —— 三层一起验 ============
   功能本身：那个手机竞态（cloudRefresh 中途换掉活动对象）让一批照片**字节进了网盘、
   app 里却没有记录**，这条路是够得着它们的唯一入口。
   26 个 agent 的对抗式复查报了 15 条、坐实 13 条，下面每一条锁对着其中一条修复。
   为什么三层写在一个块里：这三个文件是**一件事**（客户端送 group → 代理按 host_groups
   验 group → 脚本把作用域收窄到 ROOT/<group>/）。拆开放的话，哪天有人只改一层，
   另外两层的断言全绿，而那正是这一轮最贵的那个缺陷的形状。 */
{
  const s = read('ym/organizer/index.html');
  const C = stripTplNotes(stripComments(s));       // 判缺席/顺序用它（规矩 9 + 模板内注释）
  const py = read('api/ym_file.py'), PY = stripPy(py);
  const gas = read('docs/apps-script-upload.js'), GAS = stripComments(gas);
  const hg = pyBody(PY, 'def host_groups(uid):');
  const mg = pyBody(PY, 'def member_groups(uid):');
  const gate = pyBody(PY, 'def _group_gate(self, role, uid, group):');
  /* ⚠ 2026-08-05：read_media 插在 list_media 和那句 fallback `group = …[:120]` **中间**，
     所以 listBlk 的下界必须跟着挪到 read_media 那一行 —— 不挪的话，listBlk 会把整段
     read_media 一起吃进来，list 的负向断言（「这一段里不许有 X」）就会因为**别人的**代码
     变红/变绿，而两边的作者谁都看不出来。切片边界跟着代码走，不跟着「上次那句话」走。 */
  const trashBlk = PY.slice(PY.indexOf('if action == "trash_media":'), PY.indexOf('if action == "list_media":'));
  const listBlk = PY.slice(PY.indexOf('if action == "list_media":'), PY.indexOf('if action == "read_media":'));
  const readBlk = PY.slice(PY.indexOf('if action == "read_media":'), PY.indexOf('group = (body.get("group") or "")[:120]'));
  /* 客户端这几段提到最上面来：403 的 reason 是**跨层合同**（代理写、客户端读），两边的断言
     必须写在一起才看得出它是一件事 —— 分开放，哪天有人只改一层，另一层照样全绿。 */
  const tr = fnBody(C, 'async function mediaTrash(');
  const mb = fnBody(C, 'async function mediaDel(');
  const sd = fnBody(C, 'async function mediaScanDo(');
  const sc = fnBody(C, 'async function mediaScan(');
  const pn = fnBody(C, 'function mediaScanPanel(');
  const ka = fnBody(C, 'function mediaKeepAll(');
  const ki = fnBody(C, 'function mediaKeepIds(');
  const ms = fnBody(C, 'function mediaSheet(');
  /* 把 `if(r==='码')` 到**下一个** `if(r…)` 之间切出来当这一支的正文。边界跟着代码走 ——
     定长切片是定时炸弹：mediaDel 那条守着删除顺序的锁 2026-08-05 就是被它炸红的
     （往函数里补两段注释，被断言的行当场被推出窗口）。 */
  const branch = (body, code) => {
    const a = body.indexOf("if(r==='" + code + "')");
    if (a < 0) return '';
    const re = /if\((?:r[=.!]|typeof r)/g; re.lastIndex = a + 1;
    const hit = re.exec(body);
    return body.slice(a, hit ? hit.index : body.length);
  };
  console.log('ym — 从网盘找回 / 归属闸 (2026-08-05)');

  /* ---- 归属闸：这一轮最要紧的一条 ----
     在它之前，list_media 从头到尾没有用过 uid 一次：目录名 = 活动名 + ' · ' + 日期，
     而 0011 让任何人都能从官网读到别家已公开活动的 title/post_date —— 同源、同 fallback、
     同 YYYY-MM-DD。于是任何一个 approved 主办都能列出别人一整场活动的照片，
     拿到全部 file_id 之后再照着逐个 trash。 */
  check(py, '归属闸①：host_groups(uid) 在，名单 = 自己的活动 + 0027 共编的活动',
    !!hg
    && /ym_doc\?select=payload&kind=eq\.event&owner=eq\." \+ uid/.test(hg)
    && /ym_event_share\?select=host,doc_id&member=eq\." \+ uid/.test(hg)
    // 共编那半在**这一侧**按 (host, doc_id) 配对：doc_id 是客户端生成的自由文本，
    // 拼进 PostgREST 的过滤器就是一条注入面
    && /ym_doc\?select=owner,doc_id,payload&kind=eq\.event&owner=in\.\(/.test(hg)
    && !/doc_id=eq\.|or=\(and\(/.test(hg));
  /* ⭐ 上面那条只验了**查询串的形状**。共编这半真正的判据是另外两行，而它们一条都没被断言过 ——
     2026-08-05 实测两种改法，套件全绿：
       ① 删掉 `if (owner, doc_id) in pairs:` 这一层 → `owner=in.(他)` 把那个主办**全部**活动的
          payload 都取回来了，于是只要有人把**一场**活动共编给你，你就拿到他每一场的照片目录；
       ② 把 uuid 形状校验放宽成 `if d and h:` → ym_event_share.host 的值直接拼进 `owner=in.(…)`，
          而那是这个函数**唯一**从表里取出来又拼回 URL 的地方（注释自己写着这句话）。
     所以两行都逐字钉，并且钉住「共编那半只有这一个落点」：pairs 判定之外不许再有 out.add，
     validated 之外不许再有 hosts.add —— 少这两条，上面那两种改法就是在断言的眼皮底下发生。 */
  check(py, '归属闸①b ⭐ 共编那半按 (host, doc_id) 精确配对；host 先验 uuid 形状再拼进 URL',
    (() => {
      // uuid 形状校验，且两个集合都只在它**里面**长
      const guard = /if d and len\(h\) == 36 and all\(c in "0123456789abcdefABCDEF-" for c in h\):\s*\n\s*pairs\.add\(\(h, d\)\); hosts\.add\(h\)/;
      if (!guard.test(hg)) return false;
      if (hg.replace(guard, '').includes('hosts.add(')) return false;   // 别处再塞 host = 校验白做
      const share = hg.slice(hg.indexOf('if pairs:'));                  // 共编那半（边界跟着代码走）
      const pair = /if \(str\(row\.get\("owner"\) or ""\), str\(row\.get\("doc_id"\) or ""\)\) in pairs:\s*\n\s*out\.add\(grp\(row\.get\("payload"\)\)\)/;
      if (!pair.test(share)) return false;                              // 精确配对，命中才收
      return !share.replace(pair, '').includes('out.add(');             // 配对之外没有第二个落点
    })());
  /* 口径差一个空格 = 主办被告知「这不是你的活动」，而他正看着自己的活动，手上没有任何
     线索能看出差的是一个空格。所以三处（客户端 evGroup / member_groups / host_groups）
     必须是同一句话，而且客户端每一个拼目录名的地方都得长一模一样。 */
  check(py, '归属闸②：目录名口径三处逐字一致（差一个空格就永远对不上）',
    C.includes("function evGroup(e){return e?((e.name||'活动')+' · '+(e.date||'')).trim():'';}")
    && /\(str\(pl\.get\("name"\) or "活动"\) \+ " · " \+ str\(pl\.get\("date"\) or ""\)\)\.strip\(\)/.test(hg)
    && /\(str\(nm\) \+ " · " \+ str\(dt\)\)\.strip\(\)/.test(mg)
    && (() => {   // 客户端所有拼目录名的地方：分隔符必须都是 ' · '（票据那条自带 ev 参数，不走 evGroup）
      const sites = [...C.matchAll(/\(\(?[a-z]+\.name\|\|'活动'\)\+'[^']*'\+\([a-z]+\.date\|\|''\)\)/g)];
      return sites.length >= 2 && sites.every(m => m[0].includes("+' · '+"));
    })());
  /* ⭐⭐ 方向锁。member_groups 读不到时**放行**到 未归活动/（写这一侧：宁可归错类），
     host_groups 读不到时必须**拒**（读这一侧：读不到名单就放行 = 名单一挂，全网主办的
     活动目录一起打开）。两个函数长得几乎一样，下一个人极容易照着 member_groups 抄成
     fail open —— 所以这条把**四个 return 的顺序**整个钉死：
       admin 放行 → 名单读不到 502 → 不是你的 403 → 通过。
     把第二个换成放行，序列立刻变成 None|None|(403|None，这条就红。 */
  check(py, '归属闸③ ⭐ 名单读不到 = 拒（fail closed）—— 方向和 member_groups 相反，别照抄',
    /owned = host_groups\(uid\)\s*\n\s*if owned is None:\s*\n\s*return \(502,/.test(gate)
    && ((gate.match(/return (?:None|\(\d{3},)/g) || []).join('|')
        === 'return None|return (502,|return (403,|return (502,|return (409,|return None')
    && !gate.includes('未归活动')            // 写那一侧的兜底搬过来 = 把公共垃圾桶打开
    // 对照组：写那一侧仍然 fail open。两个方向都钉住，下一个人才看得出这里的相反是**故意**的
    && /if allowed is None or group\.strip\(\) not in allowed:\s*\n\s*group = "未归活动"/.test(PY));
  /* ⭐⭐⭐ 上面那条钉的是**形状**（502 那一行 + 四个 return 的顺序），它对**判据本身**一无所知。
     2026-08-05 逐条实测，下面五种改法套件**全部全绿**：
       ① `if not owned:`                                → 名单非空就放行（≈ 全网主办互相看）
       ② `if False:`                                    → 这道闸整个不存在
       ③ `if group in {g[:120] for g in owned}:`         → 整条反过来：只有**别人的**活动放行
       ④ `if not any(g[:120] in group for g in owned):`  → 子串匹配（'甲 · 2026' 开得了 '甲 · 2026-08-05'）
       ⑤ `if group not in owned:`                        → 丢掉两侧的 120 截断
     ①②③④ 是**泄露**；⑤ 不是泄露，是**长活动名的主办被告知「这不是你的活动」**（网盘上的目录名
     本来就是截断后的那个）—— 注释里明写「那就是这把尺子最不该犯的错」。两类都要钉，所以判据
     必须逐字：not in（不是 in、不是 any 子串）· 集合来自 owned · **两侧都截到 120**
     （名单这侧 g[:120]，送进来这侧两条路各自 .strip()[:120]）。
     另外把闸里的**判定点清单**整个钉住：这个闸只该有三个 if。多一个 = 有人往授权闸里加了新分支
     （那是一条 RULING，必须当面看见，不是被一条断言默默放行），少一个/改一个 = 上面五种之一。
     ⚠ 判定点清单跑在 pyNoDoc 上：docstring 里将来写一句以 if 开头的话不该把这条锁弄红（规矩 9）。 */
  const gateCode = pyNoDoc(gate);
  const gateIfs = (gateCode.match(/\n\s*if [^\n]*:/g) || []).map(x => x.trim()).join(' | ');
  /* 2026-08-05 补的最后一道（owner 批准）：「是你的」还不够，还得是「**只**是你的」。
     host_groups 量的是「你有没有一场叫这个名字的活动」，而名字是调用方自己填的 ——
     从官网抄一个别家已公开活动的 title+post_date（0011 让 anon 读得到），在自己台上建一场
     同名同日的，host_groups(自己) 里立刻长出受害者的目录名。网盘那棵树只有一层
     ROOT/<活动名 · 日期>/，没有主办这一维，所以列/删/**看**三条路一起被放行。
     read_media 把字节接到同一把尺子后面之后，这条的代价从「泄 file_id」变成「来宾的正脸」。
     ⚠ 它同时修掉一个非恶意的老问题：两个主办同名同日的活动，字节本来就落进同一个目录。 */
  const GATE_IFS = 'if role == "admin": | if owned is None: | if group not in {g[:120] for g in owned}: | if n is None: | if n > 1:';
  check(py, '归属闸③b ⭐⭐ 判据逐字：not in · 集合来自 owned · 两侧都截 120（反过来/放宽/丢截断都要红）',
    gateIfs === GATE_IFS
    && /if group not in \{g\[:120\] for g in owned\}:\s*return \(403,/.test(gateCode)
    // 「两侧」的另一侧：送进闸的那个值，两条路都先 strip 再截 120（和 g[:120] 同一个数）
    && [trashBlk, listBlk].every(b => /group = \(body\.get\("group"\) or ""\)\.strip\(\)\[:120\]/.test(b))
    // 撞名这一道：读不到**拒**（不是放行），撞上了回 409 —— 两个方向都钉
    && /n = group_owners\(group\)\s*\n\s*if n is None:\s*\n\s*return \(502,/.test(gateCode)
    && /if n > 1:\s*\n\s*return \(409, \{"error": "group collision"/.test(gateCode));
  if (gateIfs !== GATE_IFS) console.error('    ↳ 闸里的判定点现在是：' + (gateIfs || '（一个都没读到）'));
  /* facilitator：403 不是一句「不给」。body 里把事实摊开（是哪一种、云端有几场），两条路的
     客户端都**读 reason 再分岔** —— 压成一句「请用主办账号登录」，主办就会去退出重登、换账号，
     而账号从头到尾都是对的（最常见那条来路是这场活动还没推上云端，等几秒就好）。
     这是跨层的**同一份合同**：代理写 reason、客户端读 reason，两边一起钉才作数。 */
  check(py, '归属闸③c：403 摊开 reason（两种）+ cloud_groups，客户端两条路都读它再分岔',
    /return \(403, \{"error": "not your group",\s*"reason": "no_cloud_events" if not owned else "not_in_your_events",\s*"cloud_groups": len\(owned\)\}\)/.test(gateCode)
    && [tr, sd].every(b =>
         /if\(r\.status===403\)\{let j=null;try\{j=await r\.json\(\);\}catch\(e3\)\{\}/.test(b)
         && /const rs=String\(\(j&&j\.reason\)\|\|''\);/.test(b)
         && /if\(rs==='no_cloud_events'\)return 'nocloud';/.test(b)
         && /if\(rs==='not_in_your_events'\)return 'notyours';/.test(b)
         && /return 'denied';/.test(b)));
  /* fail closed 还有第二半：host_groups 自己不许把「读不到」吞成「你一场活动都没有」。
     caller_ok 里那个 q()（每条自己兜异常、坏了回 []）是**另一种**语义，搬过来就会让
     一个错字变成「所有主办都不是自己活动的主人」，而错误码还是 403 —— 方向仍然对，
     但主办永远查不出该找谁。所以整个函数只有一个 except，而且只回 None。 */
  check(py, '归属闸④：查询不各自兜异常 —— 读不到只能整个 None，不能退化成空名单',
    (hg.match(/except Exception:/g) || []).length === 1
    && /except Exception:\s*\n\s*return None\s*$/.test(hg.trimEnd())
    && !/return \[\]/.test(hg) && !/return set\(\)/.test(hg)
    && /def rd\(path\)/.test(hg) && !/def q\(path\)/.test(hg)   // 名字都不许一样（语义不同）
    && /def q\(path\):[\s\S]{0,400}except Exception:\s*\n\s*return \[\]/.test(pyBody(PY, 'def caller_ok(user_token):')));
  /* 一把尺子只该有一份代码，也只该有一个调用它的地方：`host_groups(` 全文件只许出现两次
     （定义 + _group_gate 里那一次）。多出来的第三处 = 有人绕过了上面那条 fail-closed 的处置。 */
  /* ⚠ 2026-08-05 加了第三条：read_media（把照片字节读回来）。它**必须**进这条断言 ——
     这三条路泄的东西一条比一条重：list 泄一串 file_id，trash 能删掉别人的照片，
     read 直接把**照片本身**（真人来宾的正脸）送出去。新路自己另起一套判据，正是 08-05
     复查坐实的那个形状（只问「你是不是主办」，没问「这个 group 是不是**你的**活动」）。 */
  check(py, '归属闸⑤：list / trash / read 三条路都过同一把尺子（admin 例外是明写的）',
    [trashBlk, listBlk, readBlk].every(b =>
      /if role not in \("host", "admin"\):/.test(b)
      && /gate = self\._group_gate\(role, uid, group\)/.test(b)
      && /if gate:\s*\n\s*return self\._send\(gate\[0\], gate\[1\]\)/.test(b))
    && /if role == "admin":\s*\n\s*return None/.test(gate)
    && count(PY, /host_groups\(/g) === 2
    && count(PY, /group_owners\(/g) === 2);   // 定义 + 闸里那一处；第二处调用 = 有人绕开了闸
  /* ⭐ ⑤ 只验了「两条路都过同一把尺子」，**没有任何一条断言要求量过的那个值真的被送到下一层**。
     2026-08-05 实测：删掉 trash 转发 payload 里的 `"group": group,`，套件全绿 —— 而 doGet 的
     trash_scope 照样报 'group'、探针五个字段照样全绿，GAS 侧那道收窄**等于没上**（那一侧收到
     空 group → 'group required' → 代理裹成 502「等会儿再试」）。这就是 08-03 栽过的同一个坑
     换一层再来一次：可见信号全绿，而功能不在。
     所以这条钉的是**同一个变量**：闸拿去比的是 group，payload 里写的必须也是 group，
     而且这中间不许再有第二次赋值 —— 重新规范化一次，量的和送的就又不是同一个值了。 */
  check(py, '⭐ 闸量的值 = 送下去的值：三条路的 payload 里都是同一个 group 变量，中间不许改写',
    ['trash_media', 'list_media', 'read_media'].every((act, i) => {
      const b = [trashBlk, listBlk, readBlk][i];
      const g = b.indexOf('gate = self._group_gate(role, uid, group)');
      const p = b.indexOf('payload = {"action": "' + act + '"');
      if (g < 0 || p < 0 || g > p) return false;          // 先过闸、再拼 payload
      if (/\bgroup =/.test(b.slice(g, p))) return false;  // 量过之后又被改写 = 送的不是量过的那个
      return /"group": group[,}]/.test(b.slice(p));       // 送的就是量过的那一个变量
    }));
  /* 读这一侧**没有**「对不上就落 未归活动」那条兜底：写错目录只是归错类，读错目录是泄露。
     未归活动/ 是所有归不上的上传的公共垃圾桶，里面有别的主办的东西。 */
  check(py, '读/删这一侧没有 未归活动 兜底：空 group 直接拒，kind 写死 照片',
    /if not group or group == "未归活动":\s*\n\s*return self\._send\(400/.test(listBlk)
    && /"kind": "照片",/.test(listBlk)
    && /if not group:\s*\n\s*[\s\S]{0,200}return self\._send\(400, \{"error": "group required"\}\)/.test(trashBlk)
    && /if group == "未归活动":\s*\n\s*[\s\S]{0,300}return self\._send\(400, \{"error": "group not trashable"\}\)/.test(trashBlk)
    && !/group = "未归活动"/.test(listBlk) && !/group = "未归活动"/.test(trashBlk));
  /* 失败要说人话并带「哪一层、什么码」—— owner 只能把 toast 原话发回来。
     三种失败要做的事完全不同：501 去更新部署 / 503 去配密钥（还分两侧）/ 502 才是「等会儿再试」，
     而「两侧密钥不是同一串」这种永远不会自己好的毛病绝不能长成那句「等会儿再试」。 */
  check(py, '失败分层：net_why 分三种；501 带 gas_rev；503 分服务端/脚本两侧；密钥不符单独说',
    /def net_why\(e, secs\)/.test(PY)
    && /"GAS HTTP " \+ str\(e\.code\)/.test(PY)
    && /"timeout " \+ str\(secs\)/.test(PY)
    && /type\(e\)\.__name__ \+ ": "/.test(PY)
    && /return self\._send\(501, \{"error": "list not deployed", "gas_rev": gas_rev\(ex\)\}\)/.test(listBlk)
    && /return self\._send\(503, \{"error": "list not configured", "side": "server"\}\)/.test(listBlk)
    && /return self\._send\(503, \{"error": "list not configured", "side": "gas"\}\)/.test(listBlk)
    && /"detail": "secret mismatch"/.test(listBlk)
    /* ⚠ 这一行以前是 `=== 4`，加了 read_media 之后最省事的改法就是把它改成 6 —— 而改完
       「新那条路到底有没有分层」一个字都没被验证过（和上面 upSerial 那条同一个病）。
       所以先按**每条路各 2 条**（HTTPError 一条、其它异常一条）逐块钉住，全局那个数才是
       从三块加出来的：将来第四条打 GAS 的路要么自己也分层，要么当面撞红这一行。 */
    && [trashBlk, listBlk, readBlk].every(b => count(b, /net_why\(e, TIMEOUT/g) === 2)
    && count(PY, /net_why\(e, TIMEOUT/g) === 6);       // 丢回收站 2 + 列目录 2 + 读字节 2
  /* 回包逐字段重装，不整包透传：脚本以后加了什么字段，不该自动流到浏览器和 ym_doc.payload 里去。
     group_found / found 分开报 —— 「目录不在」（活动改过名/日期）和「目录在、没传过照片」
     是两句完全不同的话，压成一个标志就是让主办去猜自己该做哪件完全不同的事。 */
  check(py, '回包逐字段重装；group_found / found 分开报；一页大小由服务端写死',
    /files = \[\{k: it\.get\(k\) for k in \("file_id", "name", "mime_type", "ts", "url"\)\}/.test(listBlk)
    && /"group_found":\s*bool\(res\.get\("group_found"\)\)/.test(listBlk)
    && /"found":\s*bool\(res\.get\("found"\)\)/.test(listBlk)
    && /LIST_PAGE = 200/.test(PY) && /"limit": LIST_PAGE/.test(listBlk)
    && !/body\.get\("limit"\)/.test(PY)
    /* 超时预算是**一条链**，不是三个独立的数：归属查询挡在前面，它们和后面那一段加起来
       不能撞破 vercel.json 给这个函数写的 maxDuration=60 —— 撞破了平台直接掐掉整个请求，
       我们精心写的 detail 一个字都送不到主办眼前。所以这三个数要一起钉：
       最坏 TIMEOUT_OWN×3 + max(TIMEOUT_LIST, TIMEOUT_READ) = 5×3 + 40 = 55 < 60。 */
    && /TIMEOUT_OWN = 5/.test(PY) && /TIMEOUT_LIST = 40/.test(PY) && /TIMEOUT_READ = 40/.test(PY));

  /* ---- Apps Script：作用域收窄 + 版本自报 ---- */
  {
    const tm = fnBody(GAS, 'function trashMedia(body)');
    const ig = fnBody(GAS, 'function insideGroup(file, group)');
    const hp = fnBody(GAS, 'function hasParent(folder, parentId)');
    const lm = fnBody(GAS, 'function listMedia(body)');
    const um = fnBody(GAS, 'function uploadMedia(body)');
    const rev = (GAS.match(/const REV = '([^']+)'/) || [])[1] || '';
    /* ROOT 是**所有主办共用的一棵树**，所以 insideRoot 只挡住了「网盘里的别处」，
       一点都没挡住「别的主办」：拿到任意一个 file_id 就能删任意一场活动的照片。
       别人的 file_id 以前事实上不可枚举，list_media 一上线它就变成点两下的事。 */
    check(gas, 'GAS：丢回收站收窄成「ROOT/<活动>/ 底下」，insideRoot 留着当皮带',
      /if \(!group\) return jsonOut\(\{ ok: false, error: 'group required' \}\);/.test(tm)
      && /if \(!insideRoot\(file\)\) return jsonOut/.test(tm)
      && /if \(!insideGroup\(file, group\)\) return jsonOut\(\{ ok: false, error: 'not in group' \}\);/.test(tm)
      && tm.indexOf('!insideRoot(file)') < tm.indexOf('!insideGroup(file, group)')
      && /file\.setTrashed\(true\)/.test(tm)
      && /var group = clean\(body\.group \|\| ''\);/.test(tm)      // 和上传/列目录同一个 clean
      && !tm.includes("|| '未归活动'") && um.includes("|| '未归活动'"));
    /* 名字全等比，而且那个目录的父必须**就是** ROOT：少这一条，随便谁在网盘任意角落建一个
       同名目录、把文件塞进去就能冒充成「某某活动」，而皮带那条只问「走不走得到 ROOT」。 */
    check(gas, 'GAS：insideGroup 认「名字全等 + 父就是 ROOT」，hasParent 只看一层不递归',
      /if \(!group\) return false;/.test(ig)
      && /f\.getName\(\) === group && hasParent\(f, ROOT_FOLDER_ID\)/.test(ig)
      && !/clean\(f\.getName\(\)\)/.test(ig)
      && /depth < 12/.test(ig) && /seen\[fid\]/.test(ig)          // 环形结构挂不死
      && /function hasParent\(folder, parentId\)/.test(GAS)
      && !hp.slice(hp.indexOf('{')).includes('hasParent('));      // 递归 = 又回到「在 ROOT 底下」
    /* 08-03 的教训：gas.ok:true 只说明部署活着，不说明是哪一版（那次线上跑的是没有锁的旧版，
       所有可见信号却全绿）。这一版更险：动作名、字段名全没变，**只有作用域变了** ——
       不抬 rev、不报 trash_scope 的话，「收窄了没有」在线上没有任何可见痕迹。 */
    check(gas, 'GAS：REV 抬过 08-03 那一版，doGet 自报 trash_scope / list / read',
      rev.slice(0, 10) > '2026-08-03'
      && /trash_scope: 'group'/.test(GAS)
      && /actions: s \? \['upload_media', 'trash_media', 'list_media', 'read_media'\]/.test(GAS)
      /* read: s 是 08-05 加的第四个维度（规矩 13：让部署自己报出它是谁）。
         没有它，「照片显示不出来」只能靠一张一张试出来 —— 而这条路有三种完全不同的死法
         （脚本旧版 / 脚本缺钥匙 / 服务端缺钥匙），探针得能一眼分开。 */
      && /rev: REV, lock: true, trash: s, list: s, read: s/.test(GAS));
    /* 列目录是**只读**动作。findOrCreate 在这里 =「怀疑东西丢了」的主办点一下就在网盘里
       凭空长出一个空目录，下次再点看见「目录在、里面是空的」—— 只会让他更确信丢了。 */
    check(gas, 'GAS：列目录只读（不建不改不删）；回收站里的不算「网盘里还有」',
      !!lm && !lm.includes('findOrCreate') && !lm.includes('createFolder')
      && !lm.includes('createFile') && !lm.includes('setTrashed')
      && /root\.getFoldersByName\(group\)/.test(lm) && /g\.getFoldersByName\(kind\)/.test(lm)
      && /if \(f\.isTrashed\(\)\) \{ gone\+\+; continue; \}/.test(lm)
      && /var kind  = '照片';/.test(lm) && !/body\.kind/.test(lm)
      && /if \(group === '未归活动'\) return jsonOut\(\{ ok:false, error:'group not listable' \}\);/.test(lm)
      && !lm.includes("|| '未归活动'"));
    /* ⭐ 目录名三处走**同一个 clean()**：uploadMedia 建目录、trashMedia 判 insideGroup、
       listMedia 查目录。以前只钉了 trash 那一条，list 那条没钉 —— 2026-08-05 实测把 listMedia
       的 clean() 换成 String(...).trim()，套件全绿。后果：活动名里有 `/` 或连续两个空格时
       （建目录那侧 clean 会折叠掉），listMedia 从此**永远**查不到那个目录，屏幕上给出一句
       确信而错误的「网盘里没有这场活动的目录」，而照片就躺在那儿 —— 正是这个功能被造出来
       要解决的那类缺陷（字节在、够不着），不许在修它的功能里重造一遍。
       ⚠ 顺带钉住「group 只从这一行来」：多一处 body.group 就是多一个口径。 */
    check(gas, 'GAS：目录名三处同一个 clean（建/判/查）—— 换成 trim 就会给出确信而错误的「没有这个目录」',
      /var group = clean\(body\.group \|\| ''\);/.test(lm)
      && /var group = clean\(body\.group \|\| ''\);/.test(tm)
      && /findOrCreate\(root, clean\(group\) \|\| '未归活动'\)/.test(um)
      && /root\.getFoldersByName\(group\)/.test(lm)        // 查的就是 clean 过的那一个
      && [lm, tm].every(b => !b.replace(/var group = clean\(body\.group \|\| ''\);/, '').includes('body.group')));
    /* 规矩 10：把 clean() 切出来真跑一遍。上面钉的是「三处都调它」，这条钉的是「它到底做了
       什么」—— 折叠 `/` 和连续空白、截到 120（和代理那侧 [:120]、闸里 g[:120] 同一个数）。
       两条一起才等于「三处口径相同」：只钉调用点的话，有人把 clean 自己放宽（比如不再折叠
       空白），三处仍然「一致」地对不上网盘里已经建好的老目录。
       ⚠ clean 体内是正则字面量，必须拿**原始** gas 去切（规矩 9 的已知缺口）。 */
    {
      let CL = null, cboom = '';
      try { CL = new Function(fnBody(gas, 'function clean(s)') + '\n;return clean;')(); }
      catch (e) { cboom = e.message; }
      check(gas, '跑起来：clean() 折叠 / 和连续空白、截到 120（和代理那侧的 [:120] 同一口径）',
        !cboom && !!CL
        && CL('甲/乙 · 2026-08-05') === '甲 乙 · 2026-08-05'
        && CL('甲  乙 · 2026-08-05') === '甲 乙 · 2026-08-05'
        && CL('  甲 · 2026-08-05 ') === '甲 · 2026-08-05'
        && CL('あ'.repeat(200)).length === 120);
      if (cboom) console.error('    ↳ ' + cboom);
    }
    /* 先全排序再切页 —— 反过来（先切 200 再排）会让「挂回前 200 张之后再扫一次」永远拿回
       同样那 200 张，第 201 张一辈子出不来：那正是我们在修的那类缺陷（字节在、够不着）。
       扫不完就 overflow:true 老实说出来，别假装扫完了。 */
    check(gas, 'GAS：先全排序再切页；同名目录都遍历；扫不完时 overflow 说出来',
      /all\.sort\(function\(a,b\)\{ return \(a\.ts-b\.ts\) \|\| \(a\.file_id<b\.file_id\?-1:1\); \}\);/.test(lm)
      && lm.indexOf('all.sort(') < lm.indexOf('all.slice(skip')
      && /while \(gs\.hasNext\(\) && nGroup < 8\)/.test(lm)
      && /while \(ks\.hasNext\(\)\)/.test(lm)
      && /overflow = true/.test(lm) && /SCAN_MAX/.test(lm)
      && /mt\.indexOf\('image\/'\) !== 0/.test(lm)            // 非图片只计数、不列
      && /others\+\+/.test(lm));
  }

  /* ---- 客户端 ----（几个函数体在这个块的开头就切好了，见那里的说明） */
  /* 502 的那一句诊断在 body 的 detail 里。只报状态码的话，「两侧密钥不是同一串」
     「GAS 回了登录页」「超时」在屏幕上是同一句「HTTP 502」，而这三种要做的事完全不同。
     501 更要单独说：它是「部署落后」，owner 要去 Apps Script 点铅笔改现有部署，
     而 gas_rev 让他说得出线上是哪一版（08-05 线上正是 2026-08-03-lock）。 */
  check(s, '客户端：501 旧部署单独说（带 gas_rev）· 503 分两侧 · 502 把 detail 带出来',
    /if\(r\.status===501\)\{[\s\S]{0,160}return 'stale:'\+\(\(j&&j\.gas_rev\)\|\|'旧版'\)/.test(sd)
    && /er==='list not configured'\)return \(j&&j\.side==='gas'\)\?'nokey_gas':'nokey_srv'/.test(sd)
    && /const det=String\(\(j&&\(j\.detail\|\|j\.error\)\)\|\|''\);/.test(sd)
    && /if\(det==='secret mismatch'\)return 'mismatch:'\+r\.status/.test(sd)
    && /return \{fail:'HTTP '\+r\.status\+\(det\?' · '\+det:''\)\}/.test(sd)
    && !/return \{fail:'HTTP '\+r\.status\}/.test(sd)          // 回归闸：别再把 detail 丢了
    && ['请管理员用「Edit existing deployment」更新部署', '服务端缺 YM_DRIVE_SECRET',
        'Apps Script 缺 SHARED_SECRET', '两侧密钥不是同一串'].every(t => sc.includes(t)));
  /* ⭐ 客户端**真的把 group 送上去**了没有。别处钉的是**调用**（mediaTrash(m.driveId,group) /
     mediaScanDo(group,skip|0)），而 fetch body 里的那个字段是另一件事：2026-08-05 实测把 body 里
     的 `group:String(group||'')` 删掉，套件全绿 —— 后果是全体主办的「✕ 移除」当场全废
     （代理 400 group required），而屏幕上说的是「等会儿再试」。链条四节都要钉：
     evGroup(e) → 本地 const group（await 之前取成字符串快照，规矩 11）→ 函数参数 → body 字段。 */
  check(s, '客户端：✕ 移除 / 从网盘找回 都把 group 放进 fetch body（少这个字段 = 两条路当场全废）',
    /action:'trash_media',file_id:String\(driveId\|\|''\),group:String\(group\|\|''\)\}\)/.test(tr)
    && /action:'list_media',group:String\(group\|\|''\),skip:skip\|0\}\)/.test(sd)
    && /async function mediaTrash\(driveId,group\)\{/.test(C)
    && /async function mediaScanDo\(group,skip\)\{/.test(C)
    && /const group=evGroup\(e\);/.test(mb)                // 删：await 之前的字符串快照
    && /const evId=e\.id,group=evGroup\(e\);/.test(sc));   // 找回：同一口径的同一个字符串
  /* 403 的两种 reason 和另外几种码，在**两条路**上各自要说一句不同的人话，还要说得出「哪一层、
     什么码」。这一段在这一轮之前一条断言都没有：把 nocloud/notyours 压回一句「请用主办账号登录」，
     套件照样全绿 —— 而主办会去退出重登、换账号，账号却从头到尾都是对的。
     ⚠ 删这一侧还多一条硬要求：每一支都必须 return，**条目留着**。摘了条目而云端还在，
        就是屏幕在撒谎（这个功能存在的理由正是「屏幕说没有、网盘里其实有」）。 */
  const delSays = [['unwired', 'YM_DRIVE_SECRET'], ['noauth', '（401）'],
    ['nocloud', '等几秒同步完再点一次'], ['notyours', '这个名字不在你的活动里（403）'],
    ['denied', '请用主办账号登录'], ['notingroup', '把名字/日期改回上传那一版'],
    ['stalepage', '（400 · group required）'], ['ownership', '（502 · Supabase）'],
    ['mismatch', '两侧密钥不是同一串']];
  check(s, '客户端「✕ 移除」：每一种失败各说各话，而且都留着条目（摘了 = 屏幕在撒谎）',
    delSays.every(([c, t]) => { const b = branch(mb, c);
      return b.includes(t) && /return;/.test(b) && !b.includes('cur.media='); })
    && mb.indexOf('if(r!==true)') > mb.indexOf("if(r==='ownership')")            // 通用兜底排在所有分岔之后
    && mb.indexOf('cur.media=(cur.media||[]).filter') > mb.indexOf('if(r!==true)'));
  const scanSays = [['unwired', 'YM_DRIVE_EXEC'], ['noauth', '（401）'],
    ['nocloud', '等几秒同步完再点一次'], ['notyours', '这个名字不在你的活动里（403）'],
    ['denied', '请用主办账号登录'], ['stalepage', '页面是旧的'],
    ['ownership', '归属名单暂时读不到（502 · Supabase）'],
    ['nokey_srv', 'YM_DRIVE_SECRET'], ['nokey_gas', 'SHARED_SECRET']];
  check(s, '客户端「从网盘找回」：每一种失败各说各话，并且 die() 留在屏幕上（toast 1.8 秒就没了）',
    scanSays.every(([c, t]) => { const b = branch(sc, c); return b.includes(t) && /die\(/.test(b); }));
  /* 「改过名字/日期」这条死路（08-05 纠正的方向错）：代理那道闸比的是云端**当前** payload，
     改完名一推上去必然命中 → 放行；对不上的是网盘上**上传当时**建的老目录，所以拒绝发生在
     再下一层（GAS insideGroup → 'not in group' → 代理裹成 502）。它以前落进最后那支通用 502，
     屏幕说「等会儿再试」—— 而这条永远不会自己好，再点一百次都是同一句，条目也永远摘不掉。
     ⚠ 口径必须和找回面板 group_found:false 那句一致：同一个根因不许有第二种说法。
     ⚠ er 和 det 要**分开读**：ownership 那一支的 detail 是一句英文长句，只比 detail 认不出它。 */
  check(s, '客户端：改名死路有自己的码（not in group → notingroup），不落进通用 502；两处同一句口径',
    /if\(det==='not in group'\)return 'notingroup';/.test(tr)
    && tr.indexOf("return 'notingroup';") < tr.indexOf("return 'HTTP '+r.status")
    && branch(mb, 'notingroup').includes('把名字/日期改回上传那一版')
    && pn.includes('把名字/日期改回上传那一版')
    && [tr, sd].every(b => /const det=String\(\(j&&\(j\.detail\|\|j\.error\)\)\|\|''\);/.test(b)
      && /if\(er==='group required'\|\|det==='group required'\)return 'stalepage';/.test(b)
      && /if\(er==='ownership'\)return 'ownership';/.test(b)));
  /* 规矩 11 在这条路上有两层：回来先确认还在同一场（也含主办中途「✕ 收起」= 取消），
     再按 id 把活动找回来。外加一条兜底：将来代理多回一种字符串，宁可当面说「没认出来」，
     也不能让它悄悄走到下面被当成「一张都没有」—— 那就是又一次「屏幕说没有、网盘里其实有」。 */
  check(s, '客户端：找回回来后先验 evId、再按 id 找回活动；没认出来的回应当面说',
    sc.indexOf('await upSerial') < sc.indexOf('if(!S.mediaScan||S.mediaScan.evId!==evId)return;')
    && sc.indexOf('if(!S.mediaScan||S.mediaScan.evId!==evId)return;')
       < sc.indexOf('const cur=STORE.events.find(x=>x&&x.id===evId);if(!cur)return;')
    && /die\('没认出来的回应/.test(sc)
    // S.mediaScan 是纯 UI 态：写进活动就会被 cloudPushAll 推上 ym_doc，
    // 一台设备的一次扫描结果从此长在所有人的活动里
    && !/(?:cur|e|ev\(\))\.mediaScan/.test(C)
    && count(C, /S\.mediaScan=null/g) >= 4);        // mediaClose + go + 退账 + 换账号
  /* facilitator：把事实摊开让主办自己决定。「相册里都有了」是拿**一页**下**整个目录**的结论，
     truncated / overflow 时它是假的，而且和屏幕上还亮着的「继续看后面的」当面打架。 */
  check(s, '客户端：翻页时不下整目录的结论（toast 和面板同一条件分岔）',
    /\(r\.truncated\|\|r\.overflow\)\?\('这一页里的都已经在相册里了 —— 还没看完'/.test(sc)
    && /:!n\?\(partial/.test(pn)
    && /const seenN=\(sc\.skip\|0\)\+\(sc\.pageN\|0\)/.test(pn)
    && /partial=!!\(sc\.truncated\|\|sc\.overflow\)/.test(pn)
    && /onclick="mediaScan\(\$\{\(sc\.skip\|0\)\+200\}\)">继续看后面的/.test(pn));
  /* 重名 = 「很可能是当时重传前的那一份」（主办以为传失败又传了一次，网盘里躺着两份）。
     一键挂回默认绕开它们，但**不隐藏**：卡上标出来、脚注说清为什么不在那颗按钮里，
     要哪张由主办对着图决定。名单在**点的那一刻**重算，不是用扫描时的快照。 */
  check(s, '客户端：重名默认不进「全部挂回」，但摊开说清（不替主办做隐藏决定）',
    /const names=mediaDupNames\(sc\.evId\);/.test(ka)
    && /const rest=sc\.rows\.filter\(f=>!mediaIsDupName\(f,names\)\);/.test(ka)
    && /if\(!rest\.length\)\{toast\('剩下的每一张在相册里都有同名的/.test(ka)
    && /const dupNames=mediaDupNames\(sc\.evId\);/.test(pn)     // 画的这一刻也重算
    && /挂回其余 '\+restN\+' 张（跳过重名的 '\+dupN\+' 张）/.test(pn)
    && /const noBulk=\(n&&!restN\)\?/.test(pn)                  // 一张都不剩时说清为什么没那颗按钮
    && pn.includes('重名的那 ')
    // 08-05：卡片多带了一个 load/bad 占位态（懒加载），红框那一位仍然是 mdup
    && /class="mshot mnew\$\{d\?' mdup':''\}/.test(pn));
  /* 「上线了但看不见 = 等于没上线」：每一种结局都要画，而且要留在屏幕上 ——
     toast 1.8 秒就 remove，owner 能转述的只有还留着的字（why 里带着「哪一层、什么码」）。 */
  check(s, '客户端：面板每一种结局都画出来，失败留在屏幕上并说差哪一步',
    !!pn && !/if\(!n\)return ''/.test(pn)
    && /sc\.state==='err'\)return box\(line\('没读到网盘目录 —— '\+esc\(sc\.why\|\|''\)/.test(pn)
    && /再试一次<\/button>/.test(pn)
    /* 「怎么配」那一行：**没结果的那几屏必须有**（主办点了没反应，第一反应该是去找管理员，
       不是以为功能坏了），但**列出照片的那一屏必须没有** —— 刚看见几张待挂回的照片和一颗
       按得动的按钮，底下却写着「需要管理员配好密钥并更新部署」，是自己打自己的脸。
       两个方向都钉：串还在、且开关就是「这一屏有没有列出照片」(n>0)。 */
    && /const tailTxt='<p class="note9">找回需要管理员配好一把密钥并更新 Apps Script 部署/.test(pn)
    && /\$\{inner\}\$\{listed\?'':tailTxt\}/.test(pn)
    && /return box\(lead\+notes\+noBulk\+all\+cards\+more, n>0\);/.test(pn)
    && pn.includes('网盘里没有这场活动的目录')            // 目录不在（多半是改过名/日期）
    && pn.includes('但里面没有「照片」子目录')            // 目录在、从没传过
    // 空相册那句是**反着写**的：相册空着，恰恰是最该去网盘看一眼的时候（那个竞态的症状
    // 就是「toast 说传好了、相册是空的」），所以空态不止说「还没有照片」，还要指出下一步
    && /还没有照片[\s\S]{0,220}从网盘找回/.test(ms));
  /* 归档活动最需要找回照片（那些是过去的活动），而卡上原来整行动作都不画 ——
     「复盘」这道门在归档活动上根本不存在，媒体库和找回都住在复盘里。数一数：
     卡上「复盘 · 照片」→「媒体库」→「从网盘找回」= 3 下出结果。 */
  check(s, '客户端：归档活动到得了媒体库（3 下），只读时说清差哪一步',
    C.includes("ph==='archived'") && C.includes("ico('eye')+'复盘 · 照片'")
    && C.includes("go2(`openReview('${escJs(e.id)}')`,ico('eye')+'复盘 · 照片')")
    && /function openReview\(id\)\{S\.evId=id;S\.readonly=false;goReview\(\);\}/.test(C)
    && /S\.readonly\?`<p class="note9"[\s\S]{0,200}只读回看不能改相册/.test(ms)
    && ms.includes('退出只读回看')
    && /照片和「从网盘找回」不在这一页，在「复盘」里/.test(C));
  /* owner 的两条硬约束，加了这个功能之后一个字都不能松：
     ① 面板里不许出现任何指向网盘的链接（08-03），也不许有任何网盘地址（08-05）；
        取图和相册**走同一条路** —— 都是不带 src 的 <img data-mid>，字节由代理送来。
     ② 相册观感不变：整屏一栏、原比例、直接滚（找回的卡片沿用 .mshot，只换边框颜色）。
     ⚠ 「同一条路」这一位很要紧：面板要是自己另开一条取图路（哪怕只是图省事写个 src），
     08-05 修掉的那件事就在这里原样复发一次，而相册那边的锁一个都不会红。 */
  check(s, '客户端：找回面板里没有任何网盘地址，取图和相册同一条路（data-mid 懒加载）',
    /<img\$\{did\?` data-mid="\$\{esc\(did\)\}"`:''\} alt="\$\{esc\(f\.name\|\|''\)\}" onerror="mediaThumbFail\(this\)">/.test(pn)
    && !/<img src=/.test(pn) && !/driveThumb/.test(pn)
    && !/href=/.test(pn) && !/window\.open/.test(pn)
    && !/drive\.google\.com/.test(pn)
    && !/\.mgrid\{|\.mtile\{|class="mlight"/.test(C)
    && /\.mshot\.mnew\{border-color:var\(--brass\)\}/.test(C));
  /* 挂回 = 只往 payload 加一条引用，网盘上的字节一个都不动（它们本来就在那儿）。
     去重要在**点的这一刻**重算：扫完到点之间 cloudRefresh 可能已经把另一台设备挂回的
     那批拉下来了，照扫描时的名单硬加就会出现两条指向同一个文件的条目。 */
  check(s, '客户端：挂回只加引用，去重在点的这一刻重算',
    /const o=mediaOrphans\(\(sc\.rows\|\|\[\]\)\.filter/.test(ki)
    && /mediaKnownIds\(STORE\)\);/.test(ki)
    && /cur\.media\.push\(\{id:uid\(\),name:f\.name,driveId:f\.driveId,\s*\n?\s*url:f\.url,ts:f\.ts,rescued:1\}\)/.test(ki)
    && !/content_base64|createFile|upload_media/.test(ki)
    && /sc\.dup=\(sc\.dup\|0\)\+\(before-\(sc\.rows\|\|\[\]\)\.length\)/.test(ki));   // 脚注跟着涨，账才对得上

  /* ---- 规矩 10：跑起来（纯函数切出来，拿假数据钉住判定口径）----
     「按 driveId 去重、不是按文件名」这件事静态断言看不出来 —— 两台手机都会有 IMG_0001.jpg，
     同一张传两次也是两个不同的 Drive 文件。判错的后果是**照片再也找不回来**（被当成已有的
     滤掉了），而屏幕上只会说「相册里都有了」。 */
  {
    const src = ['function mediaList(', 'function mediaKnownIds(', 'function mediaOrphans(',
                 'function mediaDupNames(', 'function mediaIsDupName(']
      // ⚠ 用**原始** s：mediaOrphans 体内有正则字面量（/^image\//），stripComments 会从那对
      //   斜杠处把整行截断 —— 而这里要的是能跑的真代码，不是判断文本在不在
      .map(f => fnBody(s, f)).join('\n');
    const STORE = { events: [{ id: 'ev1',
      media: [{ id: 'm1', driveId: 'D1', name: 'IMG_0001.JPG' }] }] };
    let F = null, boom = '';
    try {
      F = new Function('STORE', src +
        '\n;return {mediaOrphans,mediaKnownIds,mediaDupNames,mediaIsDupName};')(STORE);
    } catch (e) { boom = e.message; }
    const files = [
      { file_id: 'D1', name: 'IMG_0001.JPG', mime_type: 'image/jpeg', ts: 1, url: 'u' }, // 相册里已有 → dup
      { file_id: 'D2', name: 'IMG_0001.JPG', mime_type: 'image/jpeg', ts: 2, url: 'u' }, // 同名、不同 id → 孤儿
      { file_id: 'D3', name: 'x.pdf', mime_type: 'application/pdf', ts: 3, url: 'u' },    // 非图片 → 不列
      { file_id: 'D2', name: 'IMG_0001.JPG', mime_type: 'image/jpeg', ts: 2, url: 'u' }, // 同一个 id 回来两次
      { file_id: 'D4', name: 'later.jpg', mime_type: 'image/jpeg', ts: 4, url: 'u' },
    ];
    const o = F ? F.mediaOrphans(files, F.mediaKnownIds(STORE)) : null;
    check(s, '跑起来：孤儿判定按 driveId 去重（不是按文件名），非图片不列，重复 id 只算一次',
      !boom && o && o.orphans.map(f => f.driveId).join(',') === 'D2,D4'
      && o.dup === 2 && o.skip === 1);
    const names = F ? F.mediaDupNames('ev1') : null;
    check(s, '跑起来：重名的（大小写不同也算）不进「全部挂回」，逐张挂回仍然给得出',
      !boom && names && names.has('img_0001.jpg')
      && o.orphans.filter(f => F.mediaIsDupName(f, names)).map(f => f.driveId).join(',') === 'D2'
      && o.orphans.filter(f => !F.mediaIsDupName(f, names)).map(f => f.driveId).join(',') === 'D4');
    if (boom) console.error('    ↳ ' + boom);
  }
}

/* ============ 照片显示 (2026-08-05) —— 字节走代理，三层一起验 ============
   病根：`<img src="(网盘缩略图服务)?id=…">`。那句 src 把取图这件事外包给**看的人那台
   浏览器**，于是「看不看得见」取决于它登没登一个对这个 Drive 有权限的 Google 账号。
   owner 2026-08-05：「this is not acceptable. other user can not login with my google
   account, we need add an photo read to authorized in google drive folder, I ask for it
   multiple times.」—— 沙龙的志愿者/嘉宾/别的主办没有、也不该有 owner 的 Google 账号。
   现在这条路：浏览器带着**自己的登录态**去代理要字节 → blob: URL → <img>。
   为什么不是「签发短时签名 URL」：那要新增一个不带登录态就能取到字节的公开端点和一把新
   密钥；这条路一个新端点、一把新密钥都不加，授权完全复用 host_groups/_group_gate 那把
   尺子（和上传/删除/找回同一把）。少一道新门就少一处能写错的地方 —— 08-05 刚被越权和
   假锁教训过。代价（没有跨页面 HTTP 缓存）用会话内缓存 + 懒加载 + 并发上限抵。
   三层写在一个块里，理由和上面那一节一样：客户端送 group → 代理按 host_groups 验 group
   → 脚本把作用域收窄到 ROOT/<group>/，这是**一件事**。拆开放的话，哪天有人只改一层，
   另外两层的断言全绿，而那正是最贵的那个缺陷的形状。 */
{
  const s = read('ym/organizer/index.html');
  const C = stripTplNotes(stripComments(s));
  const py = read('api/ym_file.py'), PY = stripPy(py);
  const gas = read('docs/apps-script-upload.js'), GAS = stripComments(gas);
  const readBlk = PY.slice(PY.indexOf('if action == "read_media":'),
                           PY.indexOf('group = (body.get("group") or "")[:120]'));
  const disp = PY.slice(PY.indexOf('action = body.get("action")'), PY.indexOf('who = caller_ok('));
  /* ⚠ readMedia 体内有正则字面量（`/[^\w-]/g`），但它里面**没有** `//` 也没有 `/*`，
     所以 stripComments 不会截断它（文件顶部记的那个已知缺口是 `/^image\//` 那种形状）。
     这里必须用剥过注释的 GAS：负向断言要判「这一段里不许有 `|| '未归活动'`」，而注释里
     恰恰合法地写着「同样没有 uploadMedia 那条 `|| '未归活动'` 的兜底」（规矩 9）。 */
  const rm = fnBody(GAS, 'function readMedia(body)');
  const rd = fnBody(C, 'async function mediaReadDo(');
  const pump = fnBody(C, 'function mediaPump(');
  const mq = fnBody(C, 'function mediaQueue(');
  const forget = fnBody(C, 'function mediaForget(');
  const wire = fnBody(C, 'function mediaLazyWire(');
  const ms = fnBody(C, 'function mediaSheet(');
  const pn = fnBody(C, 'function mediaScanPanel(');
  console.log('ym — 照片显示 / 取图走代理 (2026-08-05)');

  /* ⭐⭐ 这一条钉的是**一对因果**，不是一个字符串 —— 这一轮真正差点又白干的地方就在这里。
     占位期间卡片是 `.mshot.load`，CSS 里 `.mshot.load img{display:none}` 把 <img> 整个隐掉；
     而 display:none 的元素**没有布局盒**，IntersectionObserver 对它永远只报
     isIntersecting:false。所以一旦观察的是 <img> 本身，mediaImgLoad 一次都不会被调用，
     每张卡永久停在「读取中…」——屏幕上的样子和 owner 卡了好几天的那张几乎一模一样
     （一排文件名、图出不来），**而当时全套断言是绿的**（这一段一条都没钉 observe 的目标）。
     两半都要钉：CSS 那半（img 被隐掉）和 JS 那半（观察的是 .mshot 盒子）。
     哪天有人把 CSS 改成不再 display:none，这条会红 —— 那时候要重新想，而不是顺手放宽。 */
  check(s, '⭐⭐ 懒加载观察的是 .mshot 盒子，不是被 display:none 隐掉的 <img>（否则一张都取不回来）',
    /\.mshot\.load img,\.mshot\.bad img\{display:none\}/.test(C)
    && !!wire && /const box=\(el\.closest&&el\.closest\('\.mshot'\)\)\|\|el;/.test(wire)
    && /_mediaIO\.observe\(box\)/.test(wire)
    && !/_mediaIO\.observe\(el\)/.test(wire)
    // 回调里再从盒子里把图取出来（观察目标换了，消费端也必须跟着换，否则 getAttribute 拿到 null）
    && /x\.target\.querySelector\('img\[data-mid\]'\)/.test(wire));
  /* ⭐⭐ 「点照片能看大图、能下载」—— owner 2026-08-06 反复撞上的就是这一条：
     08-05 把相册的**显示**修好了，但卡片上唯一能点的还是 ✕（删除），整屏没有任何下载入口，
     所以「tap on photo try to download」的结果是**一点反应都没有**。
     四件事一起钉，缺一个这个功能就又是半残：
       ① 卡片可点 → mediaOpenOne；② mediaOpenOne 走 driveView（= 走鉴权代理，不碰 Google）；
       ③ ✕ 必须 stopPropagation（否则点删除会顺手把查看器也开出来）；
       ④ 查看器里那个下载是**真的带 href 的 <a> + download 文件名**
          （手机上 await 之后再 window.open 会被当成非用户手势的弹窗拦掉）。 */
  check(s, '⭐⭐ 相册：点照片能开查看器（大图 + 下载），✕ 不误触，下载是真链接',
    !!ms && /onclick="mediaOpenOne\('\$\{escJs\(did\)\}','\$\{escJs\(m\.name\|\|'照片'\)\}'\)"/.test(ms)
    && /onclick="event\.stopPropagation\(\);mediaDel\(/.test(ms)
    && /function mediaOpenOne\(driveId,name\)\{driveView\(driveId,mediaGroupNow\(\),name,''\);\}/.test(C)
    && /a\.href=_dvUrl;a\.download=name\|\|'file';/.test(C)
    && /a\.textContent=isImg\?'下载这张':'下载 \/ 打开';/.test(C));
  /* 查看器点开相册里那张时**借用**相册已经取回来的 blob（点开是瞬时的，也不再多打一次 GAS）。
     借来的东西不能由借的人销毁：_dvOwn=false 时 dvClose 不许 revoke ——
     revoke 掉的话，关掉查看器的同一瞬间，相册里那张就变成坏图。 */
  check(s, '查看器复用相册字节，且只 revoke 自己造的那一个（借来的不许销毁）',
    /const cached=_mediaBlob\.get\(id\);\s*\n\s*if\(cached\)\{_dvUrl=cached;_dvOwn=false;\}/.test(C)
    && /_dvUrl=URL\.createObjectURL\(r\.blob\);_dvOwn=true;/.test(C)
    && /if\(_dvUrl&&_dvOwn\)\{try\{URL\.revokeObjectURL\(_dvUrl\);\}catch\(e\)\{\}\}/.test(C));
  /* 占位高度不是审美，是**功能**：懒加载按「离视野 400px」触发，占位塌成一条细线的话，
     一屏里塞进来几十张卡，等于一进相册就全部排队 —— 懒加载名存实亡。 */
  check(s, '「读取中」的占位有高度，懒加载才真的按滚动展开', /\.mshot\.load\{min-height:\d{2,}px/.test(C));

  /* ---- Apps Script：读一张字节 ---- */
  /* ⭐ 这条是整轮里最重的一条。ROOT 是**所有主办共用的一棵树**，所以 insideRoot 只挡住了
     「网盘里的别处」，一点都没挡住「别的主办」—— 目录名 = 活动名 + ' · ' + 日期，而活动名
     和日期都是公开字段，任何一个 approved 主办都拼得出别人的目录名。少了 insideGroup 这一道，
     拿一个 file_id 就能把别人一整场活动的**照片本身**（真人来宾的正脸）读走，比 08-05 那条
     「能删别人的照片」还重一档。两道都要，顺序也要（皮带在前）。 */
  check(gas, '⭐ GAS：read_media 的作用域是两道（insideRoot 且 insideGroup），和 trashMedia 一样严',
    !!rm
    && /if \(!insideRoot\(file\)\) return jsonOut\(\{ ok:false, error:'not in group' \}\);/.test(rm)
    && /if \(!insideGroup\(file, group\)\) return jsonOut\(\{ ok:false, error:'not in group' \}\);/.test(rm)
    && rm.indexOf('!insideRoot(file)') < rm.indexOf('!insideGroup(file, group)')
    // 两道都在**取字节之前**：顺序反了就是「先读走再判断」，判断等于没有
    && rm.indexOf('!insideGroup(file, group)') < rm.indexOf('file.getBlob()')
    /* 两道都回同一句 'not in group' 是有意的：分开报就等于告诉调用方「这个 id 确实躺在这个
       网盘里，只是不在你的活动底下」—— 对合法调用者毫无用处，对试探的人是白送的答案。 */
    && count(rm, /error:'not in group'/g) === 2
    // 别扩成「按目录批量回字节」：批量那一版的作用域会写在循环外面，正是上面那个形状
    && !/getFiles\(\)|while \(/.test(rm));
  /* 密钥 fail-closed（没配 = 这条路根本不存在，不是「这次拒绝」）、group 走**同一个 clean()**
     （四处哪怕差一个空格，主办看到的就是「我的照片显示不出来」，而他手上没有任何线索能看出
     差的是一个空格），file_id 先洗成 [\w-]。空 group 直接拒 —— 这一侧**没有** uploadMedia
     那条「对不上就落 未归活动」的兜底：写错目录只是归错类，读错目录是泄露。 */
  check(gas, 'GAS：read_media 先验密钥、再 clean(group)、再洗 file_id；只读，回收站里的算 gone',
    /if \(!want\) return jsonOut\(\{ ok:false, error:'read not configured' \}\);/.test(rm)
    && /if \(String\(body\.secret\|\|''\) !== want\) return jsonOut\(\{ ok:false, error:'denied' \}\);/.test(rm)
    && /var group = clean\(body\.group \|\| ''\);/.test(rm)          // 和建/判/查同一个 clean
    && /if \(!group\) return jsonOut\(\{ ok:false, error:'group required' \}\);/.test(rm)
    && /var id = String\(body\.file_id \|\| ''\)\.replace\(\/\[\^\\w-\]\/g, ''\);/.test(rm)
    && /catch \(e\) \{ return jsonOut\(\{ ok:false, error:'gone' \}\); \}/.test(rm)
    && /if \(file\.isTrashed\(\)\) return jsonOut\(\{ ok:false, error:'gone' \}\);/.test(rm)
    && !rm.includes("|| '未归活动'")
    // 只读：一个建目录/改名/删除的动词都不许有（和 listMedia 同一条规矩）
    && !/findOrCreate|createFolder|createFile|setTrashed|setName/.test(rm)
    // group 只从那一行来 —— 多一处 body.group 就是多一个口径
    && !rm.replace(/var group = clean\(body\.group \|\| ''\);/, '').includes('body.group'));
  /* 只回图片 + 有体积上限，而且**先量后取**：getMimeType / getSize 是元数据（不搬字节），
     getBlob() 才把整张图读进内存。顺序反过来的话，「不是图片」和「太大」这两档要先把它
     整个读进来才拒得掉 —— 一张 40MB 的原图能把这次执行直接撑爆。
     「只回图片」还顺带把「用这条路读走 票据/ 里的发票」这个自由度关死了（那目录里是真名 + 金额）。 */
  check(gas, 'GAS：read_media 只回图片、有体积上限，而且先量后取（不为了拒一张先把它读进内存）',
    /const READ_MAX = 12 \* 1024 \* 1024;/.test(GAS)
    /* 2026-08-06 放行 PDF：票据和附件里 PDF 很常见，只放图片的话那两处就只能退回
       「在网盘打开」= 又把人送去 Google。白名单仍然只有这两类，错误码沿用 'not image'。 */
    && /if \(mime\.indexOf\('image\/'\) !== 0 && mime !== 'application\/pdf'\)\s*\n\s*return jsonOut\(\{ ok:false, error:'not image' \}\);/.test(rm)
    && /if \(file\.getSize\(\) > READ_MAX\)\s+return jsonOut\(\{ ok:false, error:'too big' \}\);/.test(rm)
    && rm.indexOf("error:'not image'") < rm.indexOf('file.getBlob()')
    && rm.indexOf('file.getSize() > READ_MAX') < rm.indexOf('file.getBlob()')
    && /return jsonOut\(\{ ok:true, mime_type: mime, name: file\.getName\(\),/.test(rm)
    && /size: bytes\.length, b64: Utilities\.base64Encode\(bytes\) \}\);/.test(rm));
  /* doPost 认得这个动作，**而且旧部署照旧落进 'Unknown action'** —— 代理专门认那一句，
     把它翻成 501「脚本还是旧版」。这条兜底本身就是一个信号：改成静默的 ok:false，
     「部署没更新」和「真的失败了」在主办眼里就长成同一句话（08-03 栽过的形状）。
     这一版几乎一定会被撞到：脚本要 owner 手动更新部署，而且只能走 Manage deployments →
     铅笔 → New version；点 New deployment 会换掉 /exec URL，四条路一起断。 */
  check(gas, 'GAS：doPost 认得 read_media，旧部署仍然落进 Unknown action（代理靠它翻 501）',
    /if \(action === 'read_media'\) \{\s*\n\s*return readMedia\(body\);\s*\n\s*\}/.test(GAS)
    && /return jsonOut\(\{ ok: false, error: 'Unknown action: ' \+ action \}\);/.test(GAS)
    && count(GAS, /function readMedia\(/g) === 1);

  /* ---- 代理：唯一一条不回 JSON 的路 ---- */
  /* ⚠ 08-05 的教训原样再来一次的位置：体积闸以前无条件挡在分发前面，于是每一个**不带
     content_base64** 的动作都死在 400 —— trash_media 从上线起两天一次都没走到过自己的分支，
     而所有可见信号都是绿的。read_media 同样不带正文，所以这条闸必须一直是「按动作」的形状。
     反向也钉：不带正文的动作**不许夹带**正文（省得将来有人靠它绕开这道闸）。 */
  check(py, '代理：体积闸按动作生效 —— read_media 不带正文，不许再被撞回 400',
    /if action not in ACTIONS:/.test(disp)
    && /data = body\.get\("content_base64"\) or ""/.test(disp)
    && /if action == "upload_media":\s*\n\s*if not data or len\(data\) > MAX_B64:\s*\n\s*return self\._send\(400, \{"error": "bad"\}\)\s*\n\s*elif data:\s*\n\s*return self\._send\(400, \{"error": "bad"\}\)/.test(disp)
    && !readBlk.includes('content_base64'));
  /* 规矩 13 的一半：让部署自己报出它是谁。**只有一份动作清单** —— do_POST 用它分发、
     ?probe 用它自报，所以探针不可能报出一个分发那边其实没有的动作。抄一份就会有
     「探针报着 read_media、分发那边没有」的那一天，而那正是 08-03 栽过的形状。 */
  check(py, '代理：ACTIONS 只有一份清单 —— 分发和 ?probe 读的是同一个元组',
    /ACTIONS = \("upload_media", "trash_media", "list_media", "read_media"\)/.test(PY)
    && count(PY, /^ACTIONS = /gm) === 1
    && /"actions": list\(ACTIONS\)/.test(PY)
    && !/"actions": \[/.test(PY));                 // 第二份手抄清单 = 探针开始说谎
  /* ⭐ read_media 是这个端点**唯一**从本站 origin 吐非 JSON 字节的路，content-type 完全由
     对面那句 mime_type 决定 —— 而「对面」是一个能被单独改、单独部署的 Apps Script
     （08-03：线上是哪一版，从外面看不出来）。对面哪天回一个 text/html，我们就在自家域名上
     开了一个存储型 XSS。所以两侧各挡一次：这一侧只认自己验过的 image/xxx，
     svg+xml 单独踢掉（image/* 里唯一带脚本能力的格式，而沙龙的照片永远不是 SVG）。 */
  check(py, '⭐ 代理：只吐自己验过的 image/*（svg 踢掉）+ nosniff；私有缓存不进中间层',
    (() => {
      const rmime = pyNoDoc(pyBody(PY, 'def read_mime(m):'));
      const sr = pyNoDoc(pyBody(PY, 'def _send_raw(self, mime, raw):'));
      return /m = str\(m or ""\)\.split\(";"\)\[0\]\.strip\(\)\.lower\(\)\[:80\]/.test(rmime)
        && /ok = "abcdefghijklmnopqrstuvwxyz0123456789\/\+-\."/.test(rmime)
        && /if not all\(c in ok for c in m\):\s*\n\s*return None/.test(rmime)
        // 白名单**只有两类**：image/*（svg 除外）和 application/pdf。svg 是 image/* 里唯一
        // 带脚本能力的；text/html 这类一个都不许进 —— 这条路用本站 origin 吐字节。
        && /if m == "application\/pdf":\s*\n\s*return m/.test(rmime)
        && /if not m\.startswith\("image\/"\) or m == "image\/svg\+xml":\s*\n\s*return None/.test(rmime)
        && /return m if m\[6:\] else None/.test(rmime)
        && /self\.send_header\("content-type", mime\)/.test(sr)
        && /self\.send_header\("content-length", str\(len\(raw\)\)\)/.test(sr)
        && /self\.send_header\("cache-control", "private, max-age=86400"\)/.test(sr)
        && /self\.send_header\("x-content-type-options", "nosniff"\)/.test(sr)
        && /self\._cors\(\)/.test(sr)
        // 出口只有一个，而且只有过完闸的 read_media 走得到（定义 1 次 + 调用 1 次）
        && count(PY, /_send_raw\(/g) === 2
        && count(readBlk, /return self\._send_raw\(mime, raw\)/g) === 1
        && /mime = read_mime\(res\.get\("mime_type"\)\)/.test(readBlk)
        && /if not mime:\s*\n\s*[\s\S]{0,80}return self\._send\(502, \{"error": "drive", "detail": "not image"\}\)/.test(readBlk);
    })());
  /* 失败要说得出「哪一层、什么码」，而且和另外两条路是**同一张码表** —— 主办只能把屏幕上
     那句话转述给管理员。501 去更新部署 / 503 去配密钥（还分两侧）/ 502 才是「等会儿再试」，
     而「两侧密钥不是同一串」这种永远不会自己好的毛病绝不能长成那句「等会儿再试」。
     字节这一段自己还多三档：base64 坏了 / ok:true 却没有字节 / 大过平台的响应上限 ——
     不分开说的话，它们在屏幕上都是一句没有 detail 的白码。 */
  check(py, '代理：read_media 的失败分层和另外两条同一张码表，字节这一段自己再分三档',
    /return self\._send\(501, \{"error": "read not deployed", "gas_rev": gas_rev\(ex\)\}\)/.test(readBlk)
    && /return self\._send\(503, \{"error": "read not configured", "side": "server"\}\)/.test(readBlk)
    && /return self\._send\(503, \{"error": "read not configured", "side": "gas"\}\)/.test(readBlk)
    && /"detail": "secret mismatch"/.test(readBlk)
    && /return self\._send\(502, \{"error": "drive", "detail": err\[:200\]\}\)/.test(readBlk)
    && /raw = base64\.b64decode\("".join\(str\(res\.get\("b64"\) or ""\)\.split\(\)\), validate=True\)/.test(readBlk)
    && /"detail": "bad base64"/.test(readBlk)
    && /"detail": "empty"/.test(readBlk)
    && /if len\(raw\) > READ_MAX_OUT:/.test(readBlk) && /"too big for proxy: "/.test(readBlk)
    // 未归活动/ 是所有归不上的上传的公共垃圾桶，读这一侧对它永远关死
    && /if not group or group == "未归活动":\s*\n\s*[\s\S]{0,400}return self\._send\(400, \{"error": "bad"\}\)/.test(readBlk)
    && !/group = "未归活动"/.test(readBlk));

  /* ---- 客户端 ---- */
  /* ⭐ 两处画照片的地方（相册 mediaSheet · 找回面板 mediaScanPanel）用的是**同一种** <img>：
     不带 src、只带 data-mid，字节等滚到眼前再去代理取。这一条钉的是「页面上没有任何一处
     还在让浏览器自己去 Google 取图」—— 全文件那条 drive.google.com 的锁在上一节，这里钉的
     是它的正面：新的路真的接上了，而不是照片干脆不画了。
     取图的 group 走**同一把尺子**（evGroup）：少送或中途改写这一个字段，代理的 _group_gate
     和 GAS 的 insideGroup 就都对不上，表现是「照片一张都读不出来」。 */
  check(s, '⭐ 客户端：相册和找回面板都是不带 src 的 <img data-mid>，group 走同一把 evGroup',
    C.includes("function mediaId(id){return String(id||'').replace(")
    && [ms, pn].every(b => /<img\$\{did\?` data-mid="\$\{esc\(did\)\}"`:''\}/.test(b) && !b.includes('<img src='))
    && /const did=mediaId\(m\.driveId\)/.test(ms) && /did=mediaId\(f\.driveId\)/.test(pn)
    && C.includes('function mediaGroupNow(){return evGroup(ev());}')
    && /mediaQueue\(id,mediaGroupNow\(\)\)/.test(C)
    && /action:'read_media',file_id:String\(id\|\|''\),group:String\(group\|\|''\)/.test(rd)
    && /const b=await r\.blob\(\);/.test(rd)
    // 占位要有交代：一片空白读起来就是「卡住了」。没有 driveId 的老条目直接画成失败态
    && [ms, pn].every(b => b.includes("did?'读取中…':"))
    && s.includes('.mshot.load,.mshot.bad{'));
  /* 取图有**自己**的小队列。不排 upSerial 的理由在上面那条锁的注释里（会和上传互相饿死），
     这一条钉的是这条队自己的三件事：并发上限、同一张不重取、以及**回包按 data-mid 现查现贴**。
     最后一件最容易写错也最容易漏：取图故意不标忙（不 upMark），所以 cloudRefresh 完全可能
     在半路 render() 一次、把整个 #app 换掉 —— 那时发起时的 <img> 已经是孤儿，字节取到了、
     屏幕却永远停在「读取中…」。这是规矩 11 的同一个形状（跨 await 不许攥着旧引用）。
     ⚠ finally 也要：少了它，一次 reject 就把 _mediaRun 永远留在高位，整条队从此不再发车。 */
  /* 并发 2 不是 3（owner 2026-08-05 实测三张里一张 502 timeout 30s）：Apps Script 会把
     同时来的请求**排队**，而超时时钟从「发出去」就开始走 —— 并发 3 时第三个在 GAS 队列里
     干等的时间全算进它自己的预算。降到 2 不会让整批更慢（GAS 反正排队），但每个请求的
     时钟和它真正被执行的时刻更接近。 */
  check(s, '客户端：取图自己一条队（并发 2 · 同一张不重取 · 回包按 data-mid 现查现贴）',
    C.includes('const MEDIA_PAR=2;')
    && /while\(_mediaRun<MEDIA_PAR&&_mediaQ\.length\)/.test(pump)
    && /\.finally\(\(\)=>\{_mediaRun--;_mediaBusy\.delete\(job\.id\);mediaPump\(\);\}\)/.test(pump)
    && /mediaPaint\(job\.id\);/.test(pump) && !/\.src=/.test(pump)      // 贴图只走 id，不走节点
    && C.includes("document.querySelectorAll('img[data-mid=\"'+k+'\"]')")
    && /if\(!k\|\|_mediaBusy\.has\(k\)\)return;/.test(mq)               // 已在飞的不重排
    && /if\(_mediaBlob\.has\(k\)\|\|_mediaWhy\.has\(k\)\)\{mediaPaint\(k\);return;\}/.test(mq)  // 成功/失败都不重取
    && /\{root:roll,rootMargin:'400px 0px'\}/.test(wire)                // 预取撑的是相册容器，不是视口
    && /if\(_mediaIO\)_mediaIO\.unobserve\(x\.target\);/.test(wire));   // 取一次就够
  /* 离开相册 = 把这一批 blob: 全部还回去。不 revoke 的话，每开一次相册就在页面里多留一整份
     照片字节（手机上开几次就是几十 MB），而这个 app 是单页、一天都不刷新一次。
     ⭐ 还要**让在飞的那几个当场作废**（代数 _mediaGen）：不然它们回来时会往刚清空的缓存里
     再塞一份 blob —— 相册关了，字节却留在页面里，正是要避免的那件事。
     出口不止 ✕：换页(go) 和「相册没开时的 mediaLazyWire」两道网兜住退出登录/换账号。 */
  check(s, '客户端：离开相册把 blob 全部 revoke，并让在飞的那几个当场作废',
    C.includes('function mediaClose(){S.mediaOpen=false;S.mediaScan=null;mediaForget();render();}')
    && fnBody(C, 'function go(v)').includes('mediaForget();')
    && /if\(!S\.mediaOpen\)\{mediaForget\(\);return;\}/.test(wire)
    && /_mediaGen\+\+;/.test(forget)
    && /_mediaQ\.length=0;_mediaBusy\.clear\(\);/.test(forget)
    && C.includes('_mediaBlob.forEach(u=>{try{URL.revokeObjectURL(u);}catch(e){}});')
    && /_mediaBlob\.clear\(\);_mediaWhy\.clear\(\);/.test(forget)
    // 作废要挡在 createObjectURL **前面**：造了就没人 revoke
    && /if\(gen!==_mediaGen\)return;/.test(pump)
    && pump.indexOf('if(gen!==_mediaGen)return;') < pump.indexOf('URL.createObjectURL')
    // render() 每次把 #app 整个换掉，上一批 <img> 和上一个观察者一起成了孤儿 —— 重挂
    && fnBody(C, 'function render()').includes('mediaLazyWire();'));
  /* 失败要说人话，而且要说得出**哪一层、什么码** —— 这一张读不出来时，屏幕上只剩一行文件名，
     那句话就是全部线索。三档要做的事完全不同：501 去更新部署（带线上那一版的 rev）/
     403 沿用 reason 的两条分岔 / 503 分服务端与脚本两侧。
     ⭐ 而且这些话写在**出问题的那一张卡片**上，不再是一句对所有人常亮的通用提示 ——
     那句通用提示（「去登 Google 账号」）就是这一轮被删掉的东西。 */
  check(s, '客户端：取图失败按码分岔说人话，并写在出问题的那一张卡片上',
    /if\(r\.status===501\)/.test(rd) && rd.includes('里面还没有「读取照片」这个动作')
    && rd.includes('(j&&j.gas_rev)')
    && /if\(rs==='no_cloud_events'\)/.test(rd) && /if\(rs==='not_in_your_events'\)/.test(rd)
    && /if\(r\.status===503\)/.test(rd) && rd.includes("side==='gas'?'Apps Script 缺 SHARED_SECRET'")
    && ["det==='not in group'", "det==='gone'", "det==='too big'", "det==='not image'",
        "det==='secret mismatch'", "er==='ownership'"].every(t => rd.includes(t))
    && /if\(!b\|\|!b\.size\)return \{why:'读回来是空的（0 字节）'\};/.test(rd)
    // 话落在那一张卡片的 .st 上（mediaPaintEl 贴失败态 / mediaThumbFail 贴「解不开」）
    && /const st=box\.querySelector\('\.st'\);\s*\n\s*if\(st\)\{st\.textContent=why\+' ';/.test(C)
    /* 超时/网络是**会自己好**的失败，而 _mediaWhy 一记就是一整个会话（为了不反复重取）。
       没有重试的话，那一张在这次会话里永远是一行字，只能关掉整个相册重开 ——
       owner 2026-08-05 就是这么撞上的。所以失败那一行里必须有出口，且它真的会擦掉记忆再排。 */
    && /function mediaRetry\(id\)\{[\s\S]{0,200}_mediaWhy\.delete\(k\);/.test(C)
    && /a\.onclick=\(\)=>mediaRetry\(id\);/.test(C)
    && /mediaQueue\(k,mediaGroupNow\(\)\);\}/.test(C)
    && fnBody(C, 'function mediaThumbFail(').includes("t.classList.add('bad');"));

  /* ---- 规矩 10：把取图那条队切出来真跑一遍 ----
     上面钉的是「这几行在不在」，跑起来钉的是「它到底做了什么」。这四件事静态断言都看不出来：
       · 懒加载真的**不预取**（一进相册就把整个目录拉下来 = 手机上几十兆流量）；
       · 并发真的卡在 MEDIA_PAR（把上限写大一点，静态断言一个字都不会红）；
       · 同一张真的只取一次（两个 <img> 指同一个 driveId 是常态：相册 + 找回面板）；
       · ⭐ 取图半路 render() 把 DOM 换掉之后，字节仍然贴得到**新**节点上 —— 这是这一段
         最容易写错的一件事（攥着发起时那个 <img> 就永远停在「读取中…」），而它只在
         「一边同步一边滚相册」时才出现，静态断言和肉眼都抓不住。
     手法：把 mediaId/缓存/队列那一段和 mediaPaintEl…mediaForget 那一段切出来真跑，
     只把 mediaReadDo 换成一个受控的假货（这样这条锁验的是**队列**，不是网络）。 */
  {
    const src = s.slice(s.indexOf('function mediaId(id)'), s.indexOf('async function mediaReadDo('))
              + s.slice(s.indexOf('function mediaPaintEl(el,id)'), s.indexOf('function mediaOpen()'));
    const tick = () => new Promise(r => setTimeout(r, 0));
    let made = 0; const revoked = [];
    const calls = []; const gates = new Map(); let inFlight = 0, peak = 0;
    const IOs = []; let observed = [];
    let DOM = [];
    const mkImg = mid => {
      const box = { cls: new Set(), st: { textContent: '' } };
      box.classList = { add: c => box.cls.add(c), remove: c => box.cls.delete(c) };
      box.st.appendChild = n => { box.st.kids = (box.st.kids || []).concat([n]); return n; };
      box.querySelector = sel => (sel === '.st' ? box.st : null);
      return { src: '', _mid: mid, box, closest: () => box,
               getAttribute: k => (k === 'data-mid' ? mid : null) };
    };
    const roll = { querySelectorAll: () => DOM.slice() };
    const env = {
      S: { mediaOpen: true },
      ev: () => ({ id: 'ev1' }),
      evGroup: () => '八月茶会 · 2026-08-10',
      URL: { createObjectURL: () => { made++; return 'blob:' + made; },
             revokeObjectURL: u => revoked.push(u) },
      document: {
        // 失败态会现造一个「重试」节点挂进 .st（超时是会自己好的失败，必须给出口）
        createElement: () => ({ className: '', textContent: '', onclick: null }),
        querySelector: sel => (sel === '.mroll' ? roll : null),
        querySelectorAll: sel => {
          const m = /img\[data-mid="([^"]+)"\]/.exec(sel);
          return m ? DOM.filter(e => e._mid === m[1]) : DOM.slice();
        },
      },
      IntersectionObserver: function (cb, opts) {
        this.cb = cb; this.opts = opts; IOs.push(this);
        this.observe = el => observed.push(el);
        this.unobserve = el => { observed = observed.filter(x => x !== el); };
        this.disconnect = () => { observed = []; };
      },
      // 受控的假 mediaReadDo：记下谁被取了，什么时候回
      mediaReadDo: id => {
        calls.push(id); inFlight++; peak = Math.max(peak, inFlight);
        return new Promise(res => gates.set(id, v => { inFlight--; res(v); }));
      },
    };
    const keys = Object.keys(env);
    let F = null, boom = '';
    try {
      F = new Function(...keys, src +
        '\n;return {mediaImgLoad,mediaLazyWire,mediaForget,MEDIA_PAR};')(...keys.map(k => env[k]));
    } catch (e) { boom = e.message; }   // 编译不过（少一个括号那种）也走下面同一条红
    /* ⚠ 整段驱动包在 try 里：这一段跑的是**真源码**，它一旦引用了一个测试台没注入的全局
       （2026-08-05 的变红验证当场撞到：把取图改成走 upSerial，这里就是一句
       `ReferenceError: upSerial is not defined`），不裹的话整个套件带着一屏堆栈崩掉，
       后面几十条锁一条都不跑 —— 崩掉和「一条锁红了」在 CI 里都是非零退出，但只有后者
       说得出是哪一件事坏了。所以异常翻成一条红，报错另起一行印出来。 */
    try {
    if (F) {
      // 同一个 driveId 挂两个 <img>（相册里一张、找回面板里一张），这是真会发生的形状
      DOM = ['D1', 'D1', 'D2', 'D3', 'D4', 'D5'].map(mkImg);
      F.mediaLazyWire();
      const noPrefetch = calls.length === 0 && observed.length === 6
        && IOs.length === 1 && IOs[0].opts.root === roll;
      IOs[0].cb(DOM.map(t => ({ isIntersecting: true, target: t })));
      await tick();
      check(s, '跑起来：懒加载不预取（挂上观察者但一张都不取），滚进视野才发车',
        noPrefetch && calls.length > 0);
      check(s, '跑起来：并发卡在 MEDIA_PAR，5 张只发 3 张；同一个 driveId 只排一次',
        peak === F.MEDIA_PAR && calls.length === F.MEDIA_PAR
        && new Set(calls).size === calls.length);
      // ⭐ 取图半路 cloudRefresh 走了一遍 render()：整个 #app 被换掉，发起时那些 <img> 成了孤儿
      const orphans = DOM;
      DOM = ['D1', 'D1', 'D2', 'D3', 'D4', 'D5'].map(mkImg);
      gates.get('D1')({ blob: {} });
      await tick();
      check(s, '⭐ 跑起来：取图半路 render() 换掉 DOM，字节仍然贴到新节点上（不是孤儿）',
        DOM.filter(e => e._mid === 'D1').every(e => e.src === 'blob:1')
        && orphans.filter(e => e._mid === 'D1').every(e => e.src === '')
        && calls.length === F.MEDIA_PAR + 1);          // 空出来的位子立刻发下一张
      gates.get('D2')({ blob: {} });
      gates.get('D3')({ why: '网盘脚本还是旧版（线上 2026-08-03）' });
      await tick();
      gates.get('D4')({ blob: {} }); gates.get('D5')({ blob: {} });
      await tick();
      const d3 = DOM.find(e => e._mid === 'D3');
      const done = calls.length;
      /* ⚠ 变红验证时发现的一件事，记在这儿省得下一个人白折腾：「同一张不重取」是**两道**
         守卫（mediaImgLoad 先 mediaPaintEl 短路一次，mediaQueue 里再查一次缓存），拆掉
         任意一道，行为都还是对的 —— 所以这条跑起来的锁只有把两道一起拆才会红。这不是锁松，
         是实现有冗余；上面那条静态锁盯的就是其中一道，两条合起来才把两道都盯住。 */
      const again = mkImg('D1'); DOM.push(again); F.mediaImgLoad(again, 'D1');
      const again3 = mkImg('D3'); DOM.push(again3); F.mediaImgLoad(again3, 'D3');
      check(s, '跑起来：失败落在那一张卡片上；成功/失败过的都不再重取（会话内缓存）',
        d3.box.cls.has('bad') && d3.box.st.textContent === '网盘脚本还是旧版（线上 2026-08-03） '
        // 失败那一行末尾多一个空格 + 一个「重试」子节点：超时/网络是会自己好的失败，
        // 而 _mediaWhy 一记就是一整个会话，没有出口的话那张卡这次会话里永远是一行字。
        && (d3.box.st.kids || []).length === 1 && d3.box.st.kids[0].textContent === '重试'
        && typeof d3.box.st.kids[0].onclick === 'function'
        && calls.length === done && again.src === 'blob:1' && again3.box.cls.has('bad'));
      const madeAll = made;
      F.mediaForget();
      check(s, '跑起来：离开相册把每一个 blob 都 revoke 掉（4 张成功 → 4 次 revoke）',
        madeAll === 4 && revoked.length === madeAll);
      // 关相册的那一刻还有一张在飞：它回来时不许再造 blob（造了就没人 revoke）
      const late = mkImg('D9'); DOM.push(late); F.mediaImgLoad(late, 'D9');
      await tick();
      const before = made;
      F.mediaForget();
      gates.get('D9')({ blob: {} });
      await tick();
      check(s, '跑起来：关相册时还在飞的那一张回来后当场作废，不再造 blob（不泄漏）',
        made === before && late.src === '');
    }
    } catch (e) { boom = boom || (e && e.message) || String(e); }
    check(s, '跑起来：取图那条队在测试台上跑得完（编译得了、也没引用测试台外的全局）', !boom);
    if (boom) console.error('    ↳ ' + boom);
  }
}

/* ============ 结构完整性：删着删着把闭合标签带走 (2026-08-06) ============
   ym/index.html 的 style 块闭合标签被「清掉演示数据」那一轮连着 .demo-note 一起删掉，
   于是浏览器把后面的 header / section / script / body **全当成 CSS 文本**吞进那个块里 ——
   线上 HTTP 200、HTML 12KB、`new Function` 语法检查全绿，而 document.body 一个节点都没有：
   **整站白屏，连登录入口都消失**，owner 自己也进不去。
   语法检查抓不到这一类：被吞掉的部分根本没被当成 JS 解析过，所以它「没有错」。
   这条锁问的是另一个问题：**成对的标签数量对不对**，以及有没有留下裸的 `/div>` 残片。 */
{
  console.log('ym — HTML 结构完整性');
  for (const f of ['ym/index.html', 'ym/organizer/index.html', 'ym/member/index.html']) {
    const h = read(f);
    if (!h) continue;
    const pairs = ['style', 'script', 'header', 'footer', 'nav', 'section'];
    const bad = [];
    for (const t of pairs) {
      // 只数**真正的标签**：CSS/JS 注释里提到 <details> 之类不算，所以要求 < 后面紧跟标签名
      const o = (h.match(new RegExp('<' + t + '[\\s>]', 'g')) || []).length;
      const c = (h.match(new RegExp('</' + t + '>', 'g')) || []).length;
      if (o !== c) bad.push(`<${t}> 开${o} 闭${c}`);
    }
    // 裸残片：整行只剩 `/div>` 或只剩 `>` 这种（删元素时把 `<` 一起带走了，会作为**可见文字**
    // 漏在页面上）。`>` 单独一行正是 2026-08-06 事故漏网的那半：`/[a-z]+>` 要求有字母，
    // 三个 `>` 就这么在落地页上挂了一天。
    h.split('\n').forEach((l, i) => {
      if (/^\s*\/?[a-z]*>\s*$/.test(l)) bad.push(`第${i + 1}行漏出裸标签 ${l.trim()}`);
    });
    check(h, `${f} — 成对标签数量相等，没有漏出的裸标签残片`, bad.length === 0);
    if (bad.length) console.error('    ↳ ' + bad.join(' / '));
  }
}

// ---------- deploy hygiene ----------
{
  /* リポジトリ分離後、サブドメインの配信を治めるのは**この**リポの .vercelignore。
     旧チェックは JJcashflow 側の .vercelignore を見ていた（あちらはもう ym を配信しない）。 */
  const v = read('ym/.vercelignore');
  console.log('ym/.vercelignore');
  check(v, 'plan/design/archive + docs excluded from the subdomain deploy',
    v.includes('design/') && v.includes('archive/') && v.includes('*.md'));
}

console.log('');
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('all ym checks passed');
