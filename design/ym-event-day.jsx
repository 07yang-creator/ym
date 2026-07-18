import React, { useState, useRef, useEffect } from "react";

const C = {
  felt: "#16241E",
  feltUp: "#1E3129",
  stock: "#E8E0CD",
  stockDim: "#8E9A90",
  brass: "#C9A356",
  brassDim: "#6E5F36",
  ink: "#0E1512",
  muted: "#7C8F85",
  line: "#2C4238",
  alarm: "#D2604A",
};

const MEN = [
  { n: 1, name: "王思远", job: "建筑师" },
  { n: 2, name: "陈default", job: "" },
  { n: 3, name: "李泽宇", job: "医生" },
  { n: 4, name: "周明轩", job: "教师" },
  { n: 5, name: "吴俊杰", job: "工程师" },
  { n: 6, name: "郑家豪", job: "会计" },
  { n: 7, name: "孙志强", job: "律师" },
  { n: 8, name: "马文涛", job: "厨师" },
  { n: 9, name: "冯浩然", job: "设计师" },
  { n: 10, name: "许伟辰", job: "销售" },
];
MEN[1] = { n: 2, name: "陈立坤", job: "研究员" };

const WOMEN = [
  { n: 1, name: "陈雨桐", job: "护士" },
  { n: 2, name: "林静怡", job: "编辑" },
  { n: 3, name: "黄佳宁", job: "药剂师" },
  { n: 4, name: "赵晓萌", job: "设计师" },
  { n: 5, name: "刘欣然", job: "教师" },
  { n: 6, name: "何雅琳", job: "翻译" },
  { n: 7, name: "唐清雅", job: "咨询师" },
  { n: 8, name: "邓子涵", job: "程序员" },
  { n: 9, name: "苏梦琪", job: "策展人" },
  { n: 10, name: "曹亦柔", job: "会计" },
];

function Badge({ p, side, on, toggle }) {
  return (
    <button
      onClick={() => toggle(side, p.n)}
      aria-pressed={on}
      className="relative flex flex-col items-center justify-center rounded-sm"
      style={{
        width: "100%",
        aspectRatio: "1 / 1.15",
        background: on ? C.stock : "transparent",
        border: on ? `1px solid ${C.stock}` : `1px dashed ${C.line}`,
        color: on ? C.ink : C.stockDim,
        transform: on ? "translateY(-3px) rotate(-1.2deg)" : "none",
        boxShadow: on ? "0 6px 12px -4px rgba(0,0,0,.65)" : "none",
        transition: "transform 140ms ease, background 140ms ease, box-shadow 140ms ease",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          fontFamily: "Oswald, sans-serif",
          fontSize: 26,
          lineHeight: 1,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {p.n}
      </span>
      <span
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 9,
          marginTop: 3,
          opacity: on ? 0.75 : 0.5,
          letterSpacing: ".02em",
        }}
      >
        {on ? p.name.slice(0, 3) : "未到"}
      </span>
      {on && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 5,
            height: 5,
            borderRadius: 9,
            background: C.brass,
          }}
        />
      )}
    </button>
  );
}

function Column({ label, list, side, state, toggle }) {
  const here = list.filter((p) => state[side][p.n]).length;
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <span
          style={{
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 11,
            color: C.muted,
            letterSpacing: ".18em",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "Oswald, sans-serif",
            fontSize: 13,
            color: here === list.length ? C.brass : C.stockDim,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {here}/{list.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {list.map((p) => (
          <Badge key={p.n} p={p} side={side} on={state[side][p.n]} toggle={toggle} />
        ))}
      </div>
    </div>
  );
}

function Board({ state, toggle }) {
  const m = MEN.filter((p) => state.m[p.n]).length;
  const w = WOMEN.filter((p) => state.w[p.n]).length;
  const gap = Math.abs(m - w);
  const bad = gap >= 3;

  return (
    <div className="px-4 pb-28">
      <div
        className="flex items-center justify-between py-3 mb-3"
        style={{ borderBottom: `1px solid ${C.line}` }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 10,
              color: C.muted,
              letterSpacing: ".2em",
            }}
          >
            缘满沙龙 · 7月18日(土) 14:00
          </div>
          <div
            style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 15,
              color: C.stock,
              marginTop: 3,
              fontWeight: 500,
            }}
          >
            夏日茶会 · 十对十
          </div>
        </div>
        <div className="text-right">
          <div
            style={{
              fontFamily: "Oswald, sans-serif",
              fontSize: 22,
              color: bad ? C.alarm : C.stock,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {m}
            <span style={{ color: C.muted, fontSize: 15 }}> : </span>
            {w}
          </div>
          <div
            style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 9,
              color: bad ? C.alarm : C.muted,
              marginTop: 3,
              letterSpacing: ".1em",
            }}
          >
            {bad ? `差 ${gap} 人` : "平衡"}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Column label="男" list={MEN} side="m" state={state} toggle={toggle} />
        <div style={{ width: 1, background: C.line }} />
        <Column label="女" list={WOMEN} side="w" state={state} toggle={toggle} />
      </div>

      <p
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 10,
          color: C.muted,
          marginTop: 18,
          lineHeight: 1.7,
        }}
      >
        点号牌即签到，再点一次撤销。不弹确认框。
      </p>
    </div>
  );
}

function Record({ state }) {
  const arrived = [
    ...MEN.filter((p) => state.m[p.n]).map((p) => ({ ...p, side: "男" })),
    ...WOMEN.filter((p) => state.w[p.n]).map((p) => ({ ...p, side: "女" })),
  ];
  const [who, setWho] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [secs, setSecs] = useState(0);
  const t = useRef(null);

  useEffect(() => () => clearInterval(t.current), []);

  const start = () => {
    if (!who) return;
    setPhase("rec");
    setSecs(0);
    t.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };
  const stop = () => {
    if (phase !== "rec") return;
    clearInterval(t.current);
    setPhase("think");
    setTimeout(() => setPhase("card"), 1300);
  };

  if (!arrived.length)
    return (
      <div className="px-6 pt-16 pb-28">
        <p
          style={{
            fontFamily: "'Noto Sans JP', sans-serif",
            color: C.stock,
            fontSize: 14,
            lineHeight: 1.9,
          }}
        >
          还没有人签到。
          <br />
          <span style={{ color: C.muted }}>先去看板点几个号牌，再回来记录。</span>
        </p>
      </div>
    );

  return (
    <div className="px-4 pt-4 pb-28">
      <div
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 10,
          color: C.muted,
          letterSpacing: ".2em",
          marginBottom: 10,
        }}
      >
        记录对象
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {arrived.map((p) => {
          const on = who && who.n === p.n && who.side === p.side;
          return (
            <button
              key={p.side + p.n}
              onClick={() => {
                setWho(p);
                setPhase("idle");
              }}
              className="rounded-sm px-2.5 py-1.5"
              style={{
                background: on ? C.stock : "transparent",
                border: `1px solid ${on ? C.stock : C.line}`,
                color: on ? C.ink : C.stockDim,
                fontFamily: "Oswald, sans-serif",
                fontSize: 13,
                fontVariantNumeric: "tabular-nums",
                transition: "all 120ms ease",
              }}
            >
              {p.side}
              {p.n}
            </button>
          );
        })}
      </div>

      {phase !== "card" && (
        <div className="flex flex-col items-center pt-6">
          <button
            onMouseDown={start}
            onMouseUp={stop}
            onMouseLeave={stop}
            onTouchStart={(e) => {
              e.preventDefault();
              start();
            }}
            onTouchEnd={stop}
            disabled={!who}
            className="w-full flex flex-col items-center justify-center rounded-sm"
            style={{
              height: 112,
              background: phase === "rec" ? C.feltUp : "transparent",
              border: `1px solid ${phase === "rec" ? C.brass : C.line}`,
              opacity: who ? 1 : 0.35,
              cursor: who ? "pointer" : "not-allowed",
              transition: "border-color 160ms ease",
            }}
          >
            <div
              style={{
                height: 2,
                background: C.brass,
                width: phase === "rec" ? `${Math.min(secs * 8 + 12, 88)}%` : "12%",
                transition: "width 900ms linear",
                opacity: phase === "rec" ? 1 : 0.35,
              }}
            />
            <div
              style={{
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 11,
                color: phase === "rec" ? C.brass : C.muted,
                marginTop: 14,
                letterSpacing: ".12em",
              }}
            >
              {phase === "think"
                ? "整理中"
                : phase === "rec"
                ? `${secs}s · 松开结束`
                : who
                ? "按住说话"
                : "先选号牌"}
            </div>
          </button>
          <p
            style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 10,
              color: C.muted,
              marginTop: 16,
              lineHeight: 1.8,
              textAlign: "center",
            }}
          >
            屏幕不会亮红点。
            <br />
            对方看见的只有一条线。
          </p>
        </div>
      )}

      {phase === "card" && (
        <div
          className="rounded-sm p-4"
          style={{
            background: C.stock,
            color: C.ink,
            boxShadow: "0 10px 24px -8px rgba(0,0,0,.7)",
          }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 20 }}>
              {who.side}
              {who.n}
            </span>
            <span
              style={{
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 11,
                opacity: 0.5,
              }}
            >
              {who.name} · {who.job}
            </span>
          </div>

          <Field label="优点" value="沟通积极，主动介绍自己的工作" />
          <Field label="建议改进" value="谈到家庭话题时略紧张" />
          <Field label="后续跟进" value={null} hint="没听清 — 请补" />

          <div
            className="flex gap-2 mt-4 pt-3"
            style={{ borderTop: `1px solid rgba(14,21,18,.15)` }}
          >
            <button
              className="flex-1 rounded-sm py-2.5"
              style={{
                background: C.ink,
                color: C.stock,
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 12,
                letterSpacing: ".08em",
              }}
              onClick={() => setPhase("idle")}
            >
              确认存档
            </button>
            <button
              className="rounded-sm px-4"
              style={{
                border: `1px solid rgba(14,21,18,.25)`,
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 12,
              }}
              onClick={() => setPhase("idle")}
            >
              重录
            </button>
          </div>
          <p
            style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 9,
              opacity: 0.45,
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            未确认不入档。原始录音与转写一并保留。
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, hint }) {
  return (
    <div className="mb-3">
      <div
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 9,
          opacity: 0.5,
          letterSpacing: ".18em",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      {value ? (
        <div
          style={{
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {value}
        </div>
      ) : (
        <div
          style={{
            height: 22,
            borderBottom: `1.5px dotted rgba(14,21,18,.4)`,
            position: "relative",
          }}
        >
          <span
            style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 10,
              color: C.alarm,
              opacity: 0.85,
            }}
          >
            {hint}
          </span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("board");
  const [state, setState] = useState({
    m: { 1: true, 3: true, 5: true, 7: true, 9: true, 10: true },
    w: { 1: true, 2: true, 4: true, 5: true, 6: true, 8: true, 9: true, 10: true },
  });

  const toggle = (side, n) =>
    setState((s) => ({ ...s, [side]: { ...s[side], [n]: !s[side][n] } }));

  return (
    <div style={{ background: C.felt, minHeight: "100vh", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&family=Noto+Sans+JP:wght@400;500&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        button:focus-visible { outline: 2px solid ${C.brass}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <div className="max-w-md mx-auto pt-2">
        {tab === "board" ? <Board state={state} toggle={toggle} /> : <Record state={state} />}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0"
        style={{ background: C.felt, borderTop: `1px solid ${C.line}` }}
      >
        <div className="max-w-md mx-auto flex">
          {[
            ["board", "看板"],
            ["rec", "记录"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="flex-1 py-4"
              style={{
                color: tab === k ? C.brass : C.muted,
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 12,
                letterSpacing: ".2em",
                borderTop: `2px solid ${tab === k ? C.brass : "transparent"}`,
                marginTop: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}