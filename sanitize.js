/* ym — HTML sanitizer for host-authored post bodies.  window.ymSanitize
 *
 * Loaded by BOTH sides, and both matter:
 *   · organizer editor — filters clipboard HTML on paste (Notion / Word / 公众号 / Docs)
 *   · public landing   — filters AGAIN at render time. The database is not a trust
 *     boundary: anyone holding an approved organizer token can PUT arbitrary body_html
 *     straight to PostgREST, bypassing the editor entirely. Stored XSS on a public page
 *     is the worst thing this product could ship, so the render path re-sanitizes.
 *
 * Method: allowlist-CONSTRUCT. We parse once into an inert document, then rebuild a
 * fresh tree with createElement/setAttribute, copying only allowed tags and attributes.
 * Nothing is "stripped" from live markup — unknown nodes simply never get built. The
 * render path inserts NODES (not innerHTML), so there is no re-parse window for mXSS.
 *
 * Deliberately NOT allowed anywhere: style/class/id/name attributes (kills CSS tricks and
 * DOM clobbering), any on* handler, script/style/svg/math/iframe/object/embed/form/…,
 * and any URL scheme other than https:, http: and mailto:.
 */
(function (g) {
  'use strict';

  // rebuilt as-is
  var KEEP = {
    H2:1, H3:1, P:1, BR:1, STRONG:1, EM:1, U:1, S:1, UL:1, OL:1, LI:1, BLOCKQUOTE:1,
    A:1, IMG:1, HR:1, CODE:1, PRE:1, FIGURE:1, FIGCAPTION:1,
    TABLE:1, THEAD:1, TBODY:1, TR:1, TD:1, TH:1
  };

  // renamed to a canonical equivalent
  var RENAME = {
    B:'STRONG', I:'EM', H1:'H2', H4:'H3', H5:'H3', H6:'H3',
    STRIKE:'S', DEL:'S', INS:'U', BIG:'STRONG', CITE:'EM', Q:'EM', SAMP:'CODE', KBD:'CODE'
  };

  // dropped together with their subtree (contents are code/markup, never prose)
  var KILL = {
    SCRIPT:1, STYLE:1, LINK:1, META:1, BASE:1, TITLE:1, HEAD:1, NOSCRIPT:1, TEMPLATE:1,
    SVG:1, MATH:1, IFRAME:1, FRAME:1, FRAMESET:1, OBJECT:1, EMBED:1, APPLET:1, PARAM:1,
    FORM:1, INPUT:1, BUTTON:1, SELECT:1, OPTION:1, OPTGROUP:1, TEXTAREA:1, FIELDSET:1,
    CANVAS:1, AUDIO:1, VIDEO:1, SOURCE:1, TRACK:1, MAP:1, AREA:1, DIALOG:1, SLOT:1,
    XMP:1, PLAINTEXT:1, LISTING:1, MARQUEE:1, BGSOUND:1, KEYGEN:1, PORTAL:1
  };
  // everything else (DIV, SPAN, FONT, SECTION, custom elements, …) is UNWRAPPED:
  // the element vanishes, its safe children survive. Never remapped to a block tag —
  // that could produce invalid nesting the parser would restructure on the next pass.

  var MAX_LEN   = 200000;  // ~200KB of stored HTML
  var MAX_DEPTH = 14;
  var MAX_NODES = 4000;
  var MAX_IMGS  = 40;

  // Scheme allowlist. The value must START with an approved scheme after control
  // characters are removed — so "java\tscript:", "&#106;avascript:", "data:…" and
  // friends never match. Relative URLs are dropped too (nothing on this site needs them).
  function safeUrl(raw, forImage) {
    var u = String(raw == null ? '' : raw);
    u = u.replace(/[\u0000-\u0020\u007F-\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '');
    if (!u) return '';
    if (/^https?:\/\/[^\s]/i.test(u)) return u.slice(0, 2000);
    if (!forImage && /^mailto:[^\s@]+@[^\s@]+/i.test(u)) return u.slice(0, 320);
    return '';
  }

  function build(src, out, state, depth) {
    var kids = src.childNodes, i, node, name, el, url, txt;
    for (i = 0; i < kids.length; i++) {
      if (state.nodes > MAX_NODES || state.len > MAX_LEN) return;
      node = kids[i];

      if (node.nodeType === 3) {                       // text
        txt = node.nodeValue || '';
        state.len += txt.length;
        out.appendChild(document.createTextNode(txt));
        continue;
      }
      if (node.nodeType !== 1) continue;               // comments / PI / doctype → gone

      name = String(node.nodeName || '').toUpperCase();
      if (KILL[name]) continue;                        // subtree dropped
      // past the depth cap keep the words, drop the structure — and stop recursing, so the
      // cap actually bounds stack depth instead of merely bounding element creation
      if (depth >= MAX_DEPTH) {
        txt = node.textContent || '';
        state.len += txt.length;
        out.appendChild(document.createTextNode(txt));
        continue;
      }
      if (RENAME[name]) name = RENAME[name];
      if (!KEEP[name]) { build(node, out, state, depth + 1); continue; }   // unwrap

      state.nodes++;
      el = document.createElement(name);

      if (name === 'A') {
        url = safeUrl(node.getAttribute('href'), false);
        if (url) {
          el.setAttribute('href', url);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer nofollow');
        }
      } else if (name === 'IMG') {
        url = safeUrl(node.getAttribute('src'), true);
        if (!url || state.imgs >= MAX_IMGS) continue;
        state.imgs++;
        el.setAttribute('src', url);
        el.setAttribute('alt', String(node.getAttribute('alt') || '').slice(0, 200));
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      }

      if (name !== 'IMG' && name !== 'BR' && name !== 'HR') build(node, el, state, depth + 1);
      out.appendChild(el);
    }
  }

  // html string → safe DocumentFragment (nodes; nothing re-parsed downstream)
  function frag(html) {
    var f = document.createDocumentFragment();
    var s = String(html == null ? '' : html);
    if (!s) return f;
    if (s.length > MAX_LEN * 4) s = s.slice(0, MAX_LEN * 4);
    var doc;
    try {
      doc = new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html');
    } catch (e) { return f; }
    if (!doc || !doc.body) return f;
    build(doc.body, f, { nodes: 0, len: 0, imgs: 0 }, 0);
    return f;
  }

  // html string → safe html string (for storage). Serialising a tree we built ourselves.
  function html(input) {
    var box = document.createElement('div');
    box.appendChild(frag(input));
    var out = box.innerHTML;
    if (out.length > MAX_LEN) {
      out = out.slice(0, MAX_LEN);
      // don't end on half of a surrogate pair — Postgres rejects lone surrogates
      if (/[\uD800-\uDBFF]$/.test(out)) out = out.slice(0, -1);
    }
    return out;
  }

  // safe render: clears the target and appends sanitized NODES
  function into(el, input) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(frag(input));
  }

  // plain text fallback (used when a caller wants no markup at all)
  function text(input) {
    var box = document.createElement('div');
    box.appendChild(frag(input));
    return box.textContent || '';
  }

  g.ymSanitize = { frag: frag, html: html, into: into, text: text, safeUrl: safeUrl };
})(window);
