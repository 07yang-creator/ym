/* ym — render-time enrichment for post bodies.  window.ymEnhance
 *
 * Runs AFTER ymSanitize.into(), on the tree the sanitizer BUILT — never on stored HTML.
 * Loaded by the public landing (reader overlay) and by the organizer editor's 预览.
 * The contenteditable editor itself does NOT run this: an iframe inside a
 * contenteditable is a caret trap, and the editor should show what is STORED.
 *
 * Two jobs, both display-only (the database row is never touched):
 *
 * 1. YouTube links → embedded player. The sanitizer rightly kills every <iframe>
 *    in stored HTML (sanitize.js KILL list — that stays). The embed is constructed
 *    HERE, by createElement, from nothing but a validated 11-char video id, so the
 *    only thing stored input controls is WHICH video plays — youtube-nocookie.com
 *    keeps it off the ad-cookie variant. The original link is kept (retitled to a
 *    short caption when its text is just the raw URL): if the embed is ever blocked
 *    (offline, region, embed-disabled videos), the link is still the way in.
 *
 * 2. Collapse runs of empty paragraphs. Paste from Word/Notion/公众号 leaves stacks
 *    of <p><br></p>; and images that the sanitizer dropped (data:/blob: src) leave
 *    the empty paragraphs that held them — the first real article shipped with a
 *    screen-high blank hole where photos were meant to be (owner, 2026-08-07).
 *    One empty paragraph is intentional spacing and is kept; a RUN collapses to one,
 *    and leading/trailing empties go entirely. Render-side on purpose: already-
 *    published rows are healed too, and the stored row stays exactly what was saved.
 *
 * 3. <figure> holding ≥2 <img> → self-rotating gallery (owner 2026-08-07, composer v1:
 *    「photo gallery (self rotating)」). The STORED format is the plain figure — that is
 *    the whole trick: sanitize.js keeps figure/img and strips class/style, so structure
 *    is the only marker that survives, and any reader without this file still shows an
 *    honest column of photos. The carousel chrome (track/dots/arrows/timer) is built
 *    HERE from the already-sanitized <img> nodes; a single-img figure stays as-is.
 */
(function (g) {
  'use strict';

  var ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var MAX_EMBEDS = 4;   // page-weight cap; further links stay plain links

  /* href → 11-char YouTube video id, or '' if it isn't one.
     Parse with URL() rather than one big regex: hosts are compared whole
     (evil-youtu.be.example.com must not match), and ?v= is read as a real
     query param wherever it sits in the string. */
  function videoId(href) {
    var u;
    try { u = new URL(String(href || '')); } catch (e) { return ''; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    var host = String(u.hostname || '').toLowerCase();
    var seg = (u.pathname || '/').split('/').filter(Boolean);
    var id = '';
    if (host === 'youtu.be') id = seg[0] || '';
    else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      if (seg[0] === 'watch') id = u.searchParams.get('v') || '';
      else if (seg[0] === 'shorts' || seg[0] === 'live' || seg[0] === 'embed') id = seg[1] || '';
    }
    return ID_RE.test(id) ? id : '';
  }

  function isEmptyBlock(el) {
    if (el.nodeType !== 1 || el.nodeName !== 'P') return false;
    if (el.querySelector('img')) return false;
    return !(el.textContent || '').replace(/[\s ]+/g, '');
  }

  function collapseEmpties(root) {
    var kids = Array.prototype.slice.call(root.children), run = [], seenContent = false, i;
    // drop 用自己的 j —— 它借用外层 i 的第一版让主循环每次 drop 后倒回去重走一段，
    // 遇到连片空段就永远打转（同步死循环，页面整个卡死；jsdom 复验当场抓到的）
    function drop(list, keepOne) {
      for (var j = keepOne ? 1 : 0; j < list.length; j++) list[j].remove();
    }
    for (i = 0; i < kids.length; i++) {
      if (isEmptyBlock(kids[i])) { run.push(kids[i]); continue; }
      // run ends at real content: before the FIRST content it goes entirely,
      // between content a single spacer survives
      drop(run, seenContent);
      run = []; seenContent = true;
    }
    drop(run, false);               // trailing empties always go
  }

  function embed(id) {
    var box = document.createElement('div');
    box.className = 'ytv';
    var f = document.createElement('iframe');
    f.setAttribute('src', 'https://www.youtube-nocookie.com/embed/' + id);
    f.setAttribute('title', '视频播放器');
    f.setAttribute('loading', 'lazy');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    box.appendChild(f);
    return box;
  }

  function embedVideos(root) {
    // idempotent: apply() twice must not double the players — processed links carry
    // .ytlink, and players already in the tree count toward the cap
    var seen = {}, n = root.querySelectorAll('.ytv').length;
    Array.prototype.forEach.call(root.querySelectorAll('a[href]'), function (a) {
      if (a.className === 'ytlink') return;
      var id = videoId(a.getAttribute('href'));
      if (!id || seen[id] || n >= MAX_EMBEDS) return;
      seen[id] = true; n++;
      // the player lands AFTER the top-level block holding the link, so a link
      // inside a list/blockquote never gets a block iframe nested inside it
      var blk = a;
      while (blk.parentNode && blk.parentNode !== root) blk = blk.parentNode;
      if (blk.parentNode !== root) { root.appendChild(embed(id)); return; }
      root.insertBefore(embed(id), blk.nextSibling);
      // a bare pasted URL as link text is noise once the player is there;
      // hand-written link text (「点这里看完整视频」) is kept as written
      if (/^https?:\/\//i.test((a.textContent || '').trim())) a.textContent = '▶ 在 YouTube 打开';
      a.className = 'ytlink';
    });
  }

  var GAL_MS = 3500;      // 自动轮播间隔
  var GAL_RESUME = 9000;  // 有人碰过之后，静置多久恢复自转

  /* figure(≥2 img) → 轮播。滑动 = track 的 translateX；计时器在节点离开文档后自杀
     （阅读器关掉 overlay 只是 remove 节点，不会来通知我们）。 */
  function buildGallery(fig) {
    var imgs = Array.prototype.slice.call(fig.querySelectorAll('img'));
    var gal = document.createElement('div');
    gal.className = 'gal';
    gal.setAttribute('role', 'region');
    gal.setAttribute('aria-label', '照片集');
    var track = document.createElement('div');
    track.className = 'gal-track';
    imgs.forEach(function (im) {
      var cell = document.createElement('div');
      cell.className = 'gal-cell';
      cell.appendChild(im);            // move the sanitized node itself — never re-parse
      track.appendChild(cell);
    });
    gal.appendChild(track);
    var prev = document.createElement('button');
    prev.className = 'gal-a gal-prev'; prev.textContent = '‹';
    prev.setAttribute('aria-label', '上一张');
    var next = document.createElement('button');
    next.className = 'gal-a gal-next'; next.textContent = '›';
    next.setAttribute('aria-label', '下一张');
    gal.appendChild(prev); gal.appendChild(next);
    var dots = document.createElement('div');
    dots.className = 'gal-dots';
    imgs.forEach(function (_, i) {
      var d = document.createElement('button');
      d.className = 'gal-dot' + (i ? '' : ' on');
      d.setAttribute('aria-label', '第 ' + (i + 1) + ' 张');
      d.addEventListener('click', function () { touch(); go(i); });
      dots.appendChild(d);
    });
    gal.appendChild(dots);

    var cur = 0, timer = null, holdUntil = 0;
    function go(i) {
      cur = (i + imgs.length) % imgs.length;
      track.style.transform = 'translateX(-' + (cur * 100) + '%)';
      Array.prototype.forEach.call(dots.children, function (d, j) {
        d.className = 'gal-dot' + (j === cur ? ' on' : '');
      });
    }
    function tick() {
      if (!gal.isConnected) { clearInterval(timer); return; }   // overlay 被关掉，别漏计时器
      if (Date.now() < holdUntil) return;                       // 有人在看，先不转
      go(cur + 1);
    }
    function touch() { holdUntil = Date.now() + GAL_RESUME; }
    prev.addEventListener('click', function () { touch(); go(cur - 1); });
    next.addEventListener('click', function () { touch(); go(cur + 1); });
    gal.addEventListener('pointerenter', touch);
    gal.addEventListener('touchstart', touch, { passive: true });
    timer = setInterval(tick, GAL_MS);

    fig.parentNode.replaceChild(gal, fig);
  }

  function galleries(root) {
    Array.prototype.forEach.call(root.querySelectorAll('figure'), function (fig) {
      if (fig.querySelectorAll('img').length >= 2) buildGallery(fig);
      // 单张的 figure 原样留下：普通大图，不配轮播衣裳
    });
  }

  function apply(root) {
    if (!root) return;
    collapseEmpties(root);
    embedVideos(root);
    galleries(root);
  }

  g.ymEnhance = { apply: apply, videoId: videoId };
})(window);
