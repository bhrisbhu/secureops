import { useState, useEffect, Fragment, useRef } from "react";

// ─── font ─────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
document.head.appendChild(fontLink);

// ─── logo mark (SVG) ──────────────────────────────────────────────────────────
const LogoMark = ({ size = 32, radius = 8 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ borderRadius: radius, display:"block", flexShrink:0 }}>
    <defs>
      <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1e3a8a"/>
        <stop offset="100%" stopColor="#2563eb"/>
      </linearGradient>
    </defs>
    {/* background */}
    <rect width="32" height="32" rx={radius} fill="url(#lg1)"/>
    {/* outer diamond */}
    <rect x="9" y="9" width="14" height="14" rx="1.5"
      transform="rotate(45 16 16)"
      fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
    {/* middle diamond */}
    <rect x="11.5" y="11.5" width="9" height="9" rx="1"
      transform="rotate(45 16 16)"
      fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
    {/* inner diamond — solid */}
    <rect x="13.5" y="13.5" width="5" height="5" rx="0.5"
      transform="rotate(45 16 16)"
      fill="white"/>
  </svg>
);

// ─── storage ──────────────────────────────────────────────────────────────────
const K = { g:"so_g", l:"so_l", sc:"so_sc", ov:"so_ov", hi:"so_hi", pay:"so_pay", leads:"so_lds", inv:"so_inv", co:"so_co", log:"so_log", td:"so_td" };
import { load, save } from './supabase.js';

// ─── utils ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6","#a78bfa","#fb923c"];
const gc = i => COLS[i % COLS.length];
const dStr = (y,m,d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
// Returns TODAY's date in LOCAL time as YYYY-MM-DD (not UTC — avoids timezone rollover bugs)
const todayStr = () => { const d = new Date(); return dStr(d.getFullYear(), d.getMonth(), d.getDate()); };
const pDate = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const toMin = t => { if (!t) return 0; const [h,m] = t.split(":").map(Number); return h*60+(m||0); };
const calcH = (s,e) => { let a=toMin(s),b=toMin(e); if(b<=a)b+=1440; return Math.round((b-a)/60*100)/100; };
const shiftLabel = t => { if(!t)return""; const m=toMin(t); if(m>=960)return"🌆 Evening"; if(m<480)return"🌙 Overnight"; return""; };

function effShift(ds, gid, scs, ovs) {
  const dow = pDate(ds).getDay();
  const ov = ovs.find(o => o.date===ds && o.guardId===gid);
  if (ov) return ov;
  // Only consider schedules whose effective date range covers this date
  const sc = scs.find(s =>
    s.guardId===gid &&
    s.days.includes(dow) &&
    (!s.effectiveFrom || ds >= s.effectiveFrom) &&
    (!s.effectiveTo   || ds <= s.effectiveTo)
  );
  if (!sc) return null;
  return { guardId:gid, date:ds, locationId:sc.locationId, startTime:sc.startTime, endTime:sc.endTime, regularHours:sc.hours, statHours:0, absent:false };
}
function shiftsOn(ds, guards, scs, ovs) {
  const dow = pDate(ds).getDay();
  const ids = new Set();
  // Only pull in schedules that are active on this date
  scs.filter(s =>
    s.days.includes(dow) &&
    (!s.effectiveFrom || ds >= s.effectiveFrom) &&
    (!s.effectiveTo   || ds <= s.effectiveTo)
  ).forEach(s => ids.add(s.guardId));
  ovs.filter(o => o.date===ds).forEach(o => ids.add(o.guardId));
  return [...ids].map(id => {
    const sh = effShift(ds, id, scs, ovs);
    if (!sh || sh.absent) return null;
    const g = guards.find(x => x.id===id);
    return g ? { ...sh, guard:g } : null;
  }).filter(Boolean);
}

function mkCSV(fname, headers, rows) {
  const e = v => `"${String(v??"").replace(/"/g,'""')}"`;
  const csv = [headers,...rows].map(r=>r.map(e).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"}));
  a.download = fname+".csv"; a.click();
}

// ─── design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       "#eef2f7",   // page background — cool blue-grey
  surface:  "rgba(255,255,255,0.82)",   // frosted glass card
  surface2: "rgba(240,246,255,0.9)",    // elevated surface
  border:   "rgba(255,255,255,0.9)",    // glass border — bright
  borderHi: "rgba(0,80,255,0.15)",      // highlighted border
  blue:     "#0050ff",   // primary accent — electric blue
  blueDim:  "#0040cc",   // darker blue
  blueGlow: "rgba(0,80,255,0.08)",      // blue glow bg
  text:     "#0a0f1e",   // primary text — near black
  textSub:  "#4a5568",   // secondary text
  textMute: "#a0aec0",   // muted text
  green:    "#00b894",
  amber:    "#f6ad55",
  red:      "#e53e3e",
  purple:   "#7b61ff",
};

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight:"100vh",
    minHeight:"100dvh",
    background:"linear-gradient(135deg, #f2f6ff 0%, #f8f2ff 50%, #f2f9ff 100%)",
    backgroundAttachment:"fixed",
    color:T.text,
    fontFamily:"'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif",
    fontSize:"14px",
  },

  // sidebar — frosted glass
  sidebar: { position:"fixed", top:0, left:0, bottom:0, width:"220px", background:"rgba(255,255,255,0.75)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRight:"1px solid rgba(255,255,255,0.9)", display:"flex", flexDirection:"column", zIndex:100, boxShadow:"2px 0 24px rgba(0,80,255,0.06)" },
  sidebarLogo: { padding:"24px 20px 20px", borderBottom:"1px solid rgba(0,80,255,0.07)", display:"flex", alignItems:"center", gap:"10px" },
  sidebarLogoIcon: { width:"32px", height:"32px", background:"linear-gradient(135deg,#0040cc,#0050ff)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", boxShadow:"0 4px 12px rgba(0,80,255,0.3)" },
  sidebarLogoText: { fontSize:"15px", fontWeight:"700", color:T.text, letterSpacing:"-0.3px" },
  sidebarNav: { flex:1, padding:"12px 10px", overflowY:"auto" },
  sidebarSection: { fontSize:"9px", fontWeight:"700", color:T.textMute, textTransform:"uppercase", letterSpacing:"1.5px", padding:"10px 10px 4px" },
  navItem: active => ({
    display:"flex", alignItems:"center", gap:"10px", padding:"9px 12px", borderRadius:"8px",
    cursor:"pointer", border:"none", width:"100%", textAlign:"left", fontSize:"12px", fontWeight: active ? "600" : "400",
    transition:"all 0.15s",
    background: active ? "rgba(0,80,255,0.08)" : "transparent",
    color: active ? T.blue : "#4a5568",
    borderLeft: active ? `2px solid ${T.blue}` : "2px solid transparent",
    marginBottom:"1px",
  }),
  navIcon: { fontSize:"14px", width:"18px", textAlign:"center" },
  sidebarBottom: { padding:"12px 10px", borderTop:"1px solid rgba(0,80,255,0.07)" },
  signOutBtn: { display:"flex", alignItems:"center", gap:"10px", padding:"9px 12px", borderRadius:"8px", cursor:"pointer", border:"none", width:"100%", textAlign:"left", fontSize:"12px", fontWeight:"500", background:"transparent", color:T.red, transition:"all 0.15s" },

  // main content
  main: { marginLeft:"220px", padding:"28px 32px", maxWidth:"1120px" },
  pageTitle: { fontSize:"22px", fontWeight:"700", color:T.text, marginBottom:"4px", letterSpacing:"-0.5px" },
  pageSubtitle: { fontSize:"12px", color:T.textMute, marginBottom:"24px" },

  // cards — frosted glass
  card: { background:"rgba(255,255,255,0.8)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderRadius:"14px", border:"1px solid rgba(255,255,255,0.9)", padding:"20px", marginBottom:"16px", boxShadow:"0 2px 16px rgba(0,80,255,0.05), 0 1px 3px rgba(0,0,0,0.04)" },
  cardElevated: { background:"rgba(255,255,255,0.92)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:"14px", border:"1px solid rgba(0,80,255,0.12)", padding:"20px", marginBottom:"16px", boxShadow:"0 8px 32px rgba(0,80,255,0.1)" },
  ct: { fontSize:"10px", fontWeight:"700", color:T.textMute, marginBottom:"14px", textTransform:"uppercase", letterSpacing:"1.2px", display:"flex", alignItems:"center", gap:"6px" },

  // form elements
  lbl: { display:"block", fontSize:"11px", fontWeight:"600", color:T.textSub, marginBottom:"5px" },
  inp: { width:"100%", background:"rgba(255,255,255,0.9)", border:"1px solid rgba(0,80,255,0.12)", borderRadius:"8px", padding:"9px 12px", color:T.text, fontSize:"13px", outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" },
  sel: { width:"100%", background:"rgba(255,255,255,0.9)", border:"1px solid rgba(0,80,255,0.12)", borderRadius:"8px", padding:"9px 12px", color:T.text, fontSize:"13px", outline:"none", boxSizing:"border-box" },
  ta: { width:"100%", background:"rgba(255,255,255,0.9)", border:"1px solid rgba(0,80,255,0.12)", borderRadius:"8px", padding:"9px 12px", color:T.text, fontSize:"13px", outline:"none", boxSizing:"border-box", resize:"vertical", minHeight:"72px", lineHeight:"1.5" },

  // buttons
  bp: { background:"linear-gradient(135deg,#0040cc,#0050ff)", color:"#fff", border:"none", borderRadius:"8px", padding:"9px 18px", fontWeight:"600", fontSize:"13px", cursor:"pointer", boxShadow:"0 4px 12px rgba(0,80,255,0.3)", transition:"all 0.15s" },
  bs: { background:"rgba(0,184,148,0.08)", color:"#00a07a", border:"1px solid rgba(0,184,148,0.25)", borderRadius:"8px", padding:"9px 16px", fontWeight:"600", fontSize:"13px", cursor:"pointer", transition:"all 0.15s" },
  bo: { background:"rgba(255,255,255,0.8)", color:T.textSub, border:"1px solid rgba(0,80,255,0.12)", borderRadius:"8px", padding:"8px 16px", fontWeight:"600", fontSize:"13px", cursor:"pointer", transition:"all 0.15s" },
  bd: { background:"transparent", color:T.red, border:"1px solid rgba(229,62,62,0.25)", borderRadius:"6px", padding:"5px 10px", fontSize:"12px", cursor:"pointer", transition:"all 0.15s" },
  bsm: c => ({ background:"transparent", color:c||T.textSub, border:`1px solid ${c ? c+"33" : "rgba(0,80,255,0.12)"}`, borderRadius:"6px", padding:"4px 10px", fontSize:"11px", cursor:"pointer", fontWeight:"600", transition:"all 0.15s" }),

  // table
  tbl: { width:"100%", borderCollapse:"collapse" },
  th: { textAlign:"left", padding:"10px 14px", fontSize:"10px", fontWeight:"700", color:T.textMute, textTransform:"uppercase", letterSpacing:"0.8px", borderBottom:"1px solid rgba(0,80,255,0.08)", background:"rgba(240,246,255,0.6)" },
  td: { padding:"12px 14px", fontSize:"13px", borderBottom:"1px solid rgba(0,80,255,0.06)", transition:"background 0.1s" },

  // stat cards
  stat: { background:"rgba(255,255,255,0.8)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.9)", borderRadius:"14px", padding:"18px 20px", textAlign:"left", boxShadow:"0 2px 12px rgba(0,80,255,0.05)" },
  sn: { fontSize:"28px", fontWeight:"800", color:T.text, letterSpacing:"-1px", lineHeight:1 },
  sl: { fontSize:"11px", color:T.textMute, marginTop:"6px", fontWeight:"500" },

  // grids
  g2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" },
  g3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" },
  g4: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"12px" },
  g5: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:"12px" },
  row: { display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" },
  empty: { textAlign:"center", padding:"40px 20px", color:T.textMute, fontSize:"13px" },

  // pills / badges
  pill: c => ({ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"600", background:c+"18", color:c, border:`1px solid ${c}30` }),

  // divider
  divider: { height:"1px", background:"rgba(0,80,255,0.06)", margin:"16px 0" },
};

// ─── shared components ────────────────────────────────────────────────────────
const F = ({ children, style, ...p }) => <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", ...style }} {...p}>{children}</div>;

const Inp = ({ label, style, ...p }) => (
  <div>
    {label && <label style={S.lbl}>{label}</label>}
    <input style={{ ...S.inp, ...style }} {...p} />
  </div>
);

const Sel = ({ label, children, ...p }) => (
  <div>
    {label && <label style={S.lbl}>{label}</label>}
    <select style={S.sel} {...p}>{children}</select>
  </div>
);

const Stat = ({ label, value, color, min="120px", icon }) => (
  <div style={{ ...S.stat, flex:"1", minWidth:min, borderTop:`3px solid ${color||T.border}` }}>
    {icon && <div style={{ fontSize:"20px", marginBottom:"8px" }}>{icon}</div>}
    <div style={{ ...S.sn, color:color||T.text }}>{value}</div>
    <div style={S.sl}>{label}</div>
  </div>
);

// ─── confirm dialog ───────────────────────────────────────────────────────────
function Confirm({ msg, onYes, onNo }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, backdropFilter:"blur(4px)" }}
      onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
      <div style={{ background:T.surface, border:`1px solid #fecaca`, borderRadius:"16px", padding:"28px 32px", maxWidth:"380px", width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", textAlign:"center" }}>
        <div style={{ width:"48px", height:"48px", borderRadius:"50%", background:"#fef2f2", border:"1px solid #fecaca", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:"22px" }}>⚠️</div>
        <div style={{ fontSize:"14px", color:T.text, marginBottom:"6px", fontWeight:"600" }}>Are you sure?</div>
        <div style={{ fontSize:"13px", color:T.textSub, marginBottom:"24px", lineHeight:1.6 }}>{msg}</div>
        <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
          <button style={{ ...S.bd, padding:"9px 22px", fontSize:"13px", borderRadius:"8px" }} onClick={onYes}>Yes, Delete</button>
          <button style={{ ...S.bo, padding:"9px 22px", fontSize:"13px" }} onClick={onNo}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (msg, onYes) => setState({ msg, onYes });
  const el = state ? (
    <Confirm msg={state.msg}
      onYes={() => { state.onYes(); setState(null); }}
      onNo={() => setState(null)} />
  ) : null;
  return [el, ask];
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function Login({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const go = () => {
    setLoading(true);
    setTimeout(() => {
      if (u==="security" && p==="security") { onLogin("admin"); }
      else if (u==="guest" && p==="guest") { onLogin("guest"); }
      else { setErr("Invalid username or password."); setP(""); setLoading(false); }
    }, 400);
  };
  return (
    <div style={{ minHeight:"100vh", minHeight:"100dvh", background:"linear-gradient(135deg, #f2f6ff 0%, #f8f2ff 50%, #f2f9ff 100%)", backgroundAttachment:"fixed", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans',-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:"400px", padding:"0 20px" }}>
        <div style={{ textAlign:"center", marginBottom:"40px" }}>
          <div style={{ margin:"0 auto 16px", width:"56px", height:"56px", filter:"drop-shadow(0 8px 24px #3b82f650)" }}>
            <LogoMark size={56} radius={14}/>
          </div>
          <div style={{ fontSize:"24px", fontWeight:"700", color:T.text, letterSpacing:"-0.5px" }}>SecureOps</div>
          <div style={{ fontSize:"13px", color:T.textSub, marginTop:"4px" }}>Business Administration Platform</div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.85)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.9)", borderRadius:"20px", padding:"36px", boxShadow:"0 8px 40px rgba(0,80,255,0.12)" }}>
          <div style={{ fontSize:"16px", fontWeight:"600", color:T.text, marginBottom:"24px" }}>Sign in to your account</div>
          <div style={{ marginBottom:"16px" }}>
            <label style={S.lbl}>Username</label>
            <input style={{ ...S.inp, padding:"11px 14px" }} value={u} onChange={e=>setU(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus placeholder="Enter username"/>
          </div>
          <div style={{ marginBottom:"24px" }}>
            <label style={S.lbl}>Password</label>
            <input style={{ ...S.inp, padding:"11px 14px" }} type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Enter password"/>
          </div>
          {err && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"8px", padding:"10px 14px", fontSize:"13px", color:"#dc2626", marginBottom:"16px" }}>{err}</div>}
          <button style={{ ...S.bp, width:"100%", padding:"12px", fontSize:"14px", borderRadius:"10px", opacity:loading?0.7:1 }} onClick={go} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:"20px", fontSize:"11px", color:T.textMute }}>
          Developed by Christopher Hu
        </div>
      </div>
    </div>
  );
}

function MassWageUpdate({ guards, setGuards, ask }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("set");       // set | increase_fixed | increase_pct
  const [value, setValue] = useState("");
  const [scope, setScope] = useState("active");  // active | all
  const [preview, setPreview] = useState(false);

  const targetGuards = guards.filter(g =>
    scope === "all" ? true : g.status === "Active"
  );

  function calcNew(currentWage) {
    const cur = parseFloat(currentWage) || 0;
    const val = parseFloat(value) || 0;
    if (mode === "set")            return val;
    if (mode === "increase_fixed") return Math.round((cur + val) * 100) / 100;
    if (mode === "increase_pct")   return Math.round(cur * (1 + val / 100) * 100) / 100;
    return cur;
  }

  function applyUpdate() {
    const updated = guards.map(g => {
      if (scope === "active" && g.status !== "Active") return g;
      return { ...g, wage: String(calcNew(g.wage)) };
    });
    setGuards(updated); save(K.g, updated);
    ask && ask.addLog && ask.addLog("Updated","Employee",`Mass wage update — ${modeLabel}${value} applied to ${targetGuards.length} employee${targetGuards.length!==1?"s":""}`);
    setOpen(false); setValue(""); setPreview(false);
  }

  const modeLabel = mode === "set" ? "Set all to $" : mode === "increase_fixed" ? "Increase by $" : "Increase by %";

  return (
    <div style={{ ...S.card, borderColor: open ? T.borderHi : T.border }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }} onClick={()=>setOpen(o=>!o)}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:T.blueGlow, border:`1px solid ${T.blue}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>💲</div>
          <div>
            <div style={{ fontWeight:"600", color:T.text, fontSize:"13px" }}>Mass Wage Update</div>
            <div style={{ fontSize:"11px", color:T.textSub, marginTop:"1px" }}>Update hourly wage for multiple employees at once</div>
          </div>
        </div>
        <span style={{ color:T.textSub, fontSize:"13px" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop:"16px", borderTop:`1px solid ${T.border}`, paddingTop:"16px" }}>
          <div style={S.g3}>
            <div>
              <label style={S.lbl}>Update Type</label>
              <select style={S.sel} value={mode} onChange={e=>{ setMode(e.target.value); setValue(""); setPreview(false); }}>
                <option value="set">Set everyone to a specific wage</option>
                <option value="increase_fixed">Increase everyone by a fixed $ amount</option>
                <option value="increase_pct">Increase everyone by a percentage %</option>
              </select>
            </div>
            <div>
              <label style={S.lbl}>{modeLabel}</label>
              <input style={S.inp} type="number" step="0.01" min="0" value={value}
                onChange={e=>{ setValue(e.target.value); setPreview(false); }}
                placeholder={mode==="increase_pct" ? "e.g. 5  (for 5%)" : "e.g. 17.20"}
              />
            </div>
            <div>
              <label style={S.lbl}>Apply To</label>
              <select style={S.sel} value={scope} onChange={e=>{ setScope(e.target.value); setPreview(false); }}>
                <option value="active">Active employees only ({guards.filter(g=>g.status==="Active").length})</option>
                <option value="all">All employees ({guards.length})</option>
              </select>
            </div>
          </div>

          {value && parseFloat(value) > 0 && (
            <div style={{ marginTop:"12px" }}>
              <button style={{ ...S.bo, fontSize:"12px" }} onClick={()=>setPreview(p=>!p)}>
                {preview ? "Hide Preview" : `Preview Changes (${targetGuards.length} employee${targetGuards.length!==1?"s":""})`}
              </button>
            </div>
          )}

          {preview && value && (
            <div style={{ marginTop:"10px", background:T.bg, borderRadius:"8px", border:`1px solid ${T.border}`, overflow:"hidden" }}>
              <table style={S.tbl}>
                <thead><tr>{["Employee","Current Wage","New Wage","Change"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {targetGuards.map(g => {
                    const cur = parseFloat(g.wage)||0;
                    const nw  = calcNew(g.wage);
                    const diff = nw - cur;
                    return (
                      <tr key={g.id}>
                        <td style={S.td}><span style={{ fontWeight:"600", color:T.text }}>{g.name}</span></td>
                        <td style={S.td}>{cur ? `$${cur.toFixed(2)}/hr` : "—"}</td>
                        <td style={{ ...S.td, fontWeight:"700", color:T.green }}>${nw.toFixed(2)}/hr</td>
                        <td style={S.td}>
                          {diff !== 0 && <span style={{ color: diff>0 ? T.green : T.red, fontSize:"11px" }}>
                            {diff > 0 ? "+" : ""}${diff.toFixed(2)}/hr
                          </span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {value && parseFloat(value) > 0 && (
            <div style={{ marginTop:"12px" }}>
              <button style={S.bp} onClick={()=>
                ask(
                  `Update wages for ${targetGuards.length} employee${targetGuards.length!==1?"s":""}? This will overwrite their current hourly wages.`,
                  applyUpdate
                )
              }>
                Apply to {targetGuards.length} Employee{targetGuards.length!==1?"s":""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════════
function Employees({ guards, setGuards, addLog, isGuest }) {
  const blank = { name:"",badge:"",phone:"",email:"",sin:"",dob:"",address:"",startDate:"",endDate:"",wage:"",status:"Active",notes:"" };
  const [form, setForm] = useState(blank); const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState(""); const [exp, setExp] = useState(null);
  const [confirmEl, ask] = useConfirm();
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const origRef = useRef(null);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  function submit() {
    if (!form.name.trim()) return;
    const entry = { ...form, id: editing || uid() };
    const u = editing ? guards.map(g => g.id===editing ? entry : g) : [...guards, entry];
    setGuards(u); save(K.g, u); setForm(blank); setEditing(null);
    if (editing) {
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      const changed = JSON.stringify(origRef.current) !== JSON.stringify(entry);
      if (changed) addLog("Updated","Employee",`Updated employee: ${entry.name}`);
    } else {
      addLog("Created","Employee",`Added new employee: ${entry.name}`, `Wage: $${entry.wage||"—"}/hr · Status: ${entry.status}`);
    }
  }
  const del = id => ask("Delete this employee? This cannot be undone.", () => {
    const g = guards.find(x=>x.id===id);
    const u = guards.filter(g=>g.id!==id); setGuards(u); save(K.g,u);
    addLog("Deleted","Employee",`Deleted employee: ${g?.name||"Unknown"}`);
  });
  const edit = g => {
    setForm({...blank,...g}); setEditing(g.id); setExp(null);
    origRef.current = {...blank,...g};
    setTimeout(() => formRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
  };
  const rows = guards.filter(g => g.name.toLowerCase().includes(search.toLowerCase())||(g.badge||"").includes(search));
  return (
    <div>
      {confirmEl}
      {/* saved toast */}
      {saved && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", background:T.green, color:"#fff", padding:"12px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.4)", zIndex:999, display:"flex", alignItems:"center", gap:"8px" }}>
          ✓ Changes saved
        </div>
      )}
      <F style={{ marginBottom:"14px", flexWrap:"wrap" }}>
        {[["Total",guards.length],["Active",guards.filter(g=>g.status==="Active").length],["Inactive",guards.filter(g=>g.status==="Inactive").length],["On Leave",guards.filter(g=>g.status==="On Leave").length]].map(([l,v])=><Stat key={l} label={l} value={v} />)}
      </F>
      <div ref={formRef} style={S.card}>
        <div style={S.ct}>{editing?"Edit Employee":"Add Employee"}</div>
        {isGuest ? <div style={S.empty}>Sign in as admin to add or edit employees.</div> : <div>
        <div style={S.g5}>
          <Inp label="Full Name *" value={form.name} onChange={f("name")} />
          <Inp label="Badge #" value={form.badge} onChange={f("badge")} />
          <Inp label="Date of Birth" type="date" value={form.dob} onChange={f("dob")} />
          <Inp label="Start Date" type="date" value={form.startDate} onChange={f("startDate")} />
          <Inp label="End Date" type="date" value={form.endDate} onChange={f("endDate")} style={{ borderColor:"#7f1d1d" }} />
        </div>
        <div style={{ ...S.g4, marginTop:"8px" }}>
          <Inp label="Phone" type="tel" value={form.phone} onChange={f("phone")} />
          <Inp label="Email" type="email" value={form.email} onChange={f("email")} />
          <Inp label="SIN / ID #" value={form.sin} onChange={f("sin")} />
          <Inp label="Hourly Wage ($)" type="number" step="0.01" value={form.wage} onChange={f("wage")} />
        </div>
        <div style={{ ...S.g3, marginTop:"8px" }}>
          <Inp label="Address" value={form.address} onChange={f("address")} />
          <Sel label="Status" value={form.status} onChange={f("status")}><option>Active</option><option>Inactive</option><option>On Leave</option></Sel>
          <Inp label="Notes" value={form.notes} onChange={f("notes")} placeholder="Certifications…" />
        </div>
        <F style={{ marginTop:"10px" }}>
          <button style={S.bp} onClick={submit}>{editing?"Save Changes":"Add Employee"}</button>
          {editing && <button style={S.bo} onClick={()=>{setForm(blank);setEditing(null);}}>Cancel</button>}
        </F>
      </div>}
      </div>

      {/* ── MASS WAGE UPDATE ── */}
      {!isGuest && <MassWageUpdate guards={guards} setGuards={setGuards} ask={ask} />}

      <div style={S.card}>
        <F style={{ justifyContent:"space-between", marginBottom:"10px" }}>
          <div style={S.ct}>Employee Roster</div>
          <input style={{ ...S.inp, width:"170px" }} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        </F>
        {rows.length===0 ? <div style={S.empty}>No employees.</div> : (
          <table style={S.tbl}>
            <thead><tr>{["Name","Badge","DOB","Start","End","Wage","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((g,i) => (
                <Fragment key={g.id}>
                  <tr style={{ background: exp===g.id?"#f8faff":"transparent" }}>
                    <td style={S.td}><span style={{ color:gc(i), cursor:"pointer", fontWeight:"700" }} onClick={()=>setExp(exp===g.id?null:g.id)}>{g.name}</span></td>
                    <td style={S.td}>{g.badge||"—"}</td><td style={S.td}>{g.dob||"—"}</td>
                    <td style={S.td}>{g.startDate||"—"}</td>
                    <td style={S.td}>{g.endDate?<span style={{ color:"#f87171" }}>{g.endDate}</span>:"—"}</td>
                    <td style={S.td}>{g.wage?`$${parseFloat(g.wage).toFixed(2)}/hr`:"—"}</td>
                    <td style={S.td}><span style={S.pill(g.status==="Active"?"#10b981":g.status==="On Leave"?"#f59e0b":"#6b7280")}>{g.status}</span></td>
                    <td style={S.td}>{!isGuest && <F><button style={S.bsm()} onClick={()=>edit(g)}>Edit</button><button style={S.bd} onClick={()=>del(g.id)}>✕</button></F>}</td>
                  </tr>
                  {exp===g.id && <tr><td colSpan={8} style={{ ...S.td, background:"#f8faff" }}><F style={{ fontSize:"10px", color:"#475569" }}>{[["Email",g.email],["SIN",g.sin],["Address",g.address],["Notes",g.notes]].map(([l,v])=><span key={l}><span style={{ color:"#94a3b8" }}>{l}: </span>{v||"—"}</span>)}</F></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Build a self-contained Leaflet map as an HTML blob for use inside an iframe

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function Locations({ locs, setLocs, addLog, isGuest }) {
  const blankL = { name:"", client:"", contactName:"", contactEmail:"", contactPhone:"", clientAddress:"", contractStart:"", contractEnd:"", notes:"", rates:[] };
  const [form, setForm] = useState(blankL);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const blankRate = { effectiveDate:"", rate:"", notes:"" };
  const [rateForm, setRateForm] = useState(blankRate);
  const [confirmEl, ask] = useConfirm();
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const origRef = useRef(null);

  const ff = k => e => setForm(p=>({...p,[k]:e.target.value}));

  function submit() {
    if (!form.client.trim() && !form.name.trim()) {
      alert("Please enter at least a Client / Company Name.");
      return;
    }
    const entry = {
      ...form,
      id: editing || uid(),
      name: form.name.trim() || form.client.trim(),
    };
    const u = editing ? locs.map(l=>l.id===editing?entry:l) : [...locs, entry];
    setLocs(u); save(K.l, u); setForm(blankL);
    if (editing) {
      setSaved(true); setTimeout(()=>setSaved(false), 2500);
      const changed = JSON.stringify(origRef.current) !== JSON.stringify(entry);
      if (changed) addLog("Updated","Location",`Updated location: ${entry.name||entry.client}`,entry.client?`Client: ${entry.client}`:"");
    } else {
      addLog("Created","Location",`Added new location: ${entry.name||entry.client}`,entry.client?`Client: ${entry.client}`:"");
    }
    setEditing(null); setShowForm(false);
  }
  function edit(l) {
    setForm({...blankL,...l, rates:l.rates||[]}); setEditing(l.id); setShowForm(true); setExpanded(null);
    origRef.current = {...blankL,...l, rates:l.rates||[]};
    setTimeout(() => formRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
  }
  function del(id) { ask("Delete this location/client? This cannot be undone.", () => {
    const l=locs.find(x=>x.id===id);
    const u=locs.filter(l=>l.id!==id); setLocs(u); save(K.l,u);
    addLog("Deleted","Location",`Deleted location: ${l?.name||l?.client||"Unknown"}`);
  }); }

  function addRate(locId) {
    if (!rateForm.effectiveDate || !rateForm.rate) return;
    const loc = locs.find(l=>l.id===locId);
    const u = locs.map(l => {
      if (l.id!==locId) return l;
      const rates = [...(l.rates||[]), { ...rateForm, id:uid() }].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate));
      return { ...l, rates };
    });
    setLocs(u); save(K.l, u); setRateForm(blankRate);
    addLog("Created","Location",`Added billing rate for ${loc?.name||loc?.client||"location"}`,`$${rateForm.rate}/hr effective ${rateForm.effectiveDate}`);
  }
  function delRate(locId, rateId) {
    ask("Delete this billing rate entry?", () => {
      const loc=locs.find(l=>l.id===locId);
      const rate=(loc?.rates||[]).find(r=>r.id===rateId);
      const u = locs.map(l => l.id!==locId ? l : { ...l, rates:(l.rates||[]).filter(r=>r.id!==rateId) });
      setLocs(u); save(K.l, u);
      addLog("Deleted","Location",`Deleted billing rate for ${loc?.name||loc?.client||"location"}`,rate?`$${rate.rate}/hr from ${rate.effectiveDate}`:"");
    });
  }

  function currentRate(loc) {
    const today = todayStr();
    const past = (loc.rates||[]).filter(r=>r.effectiveDate<=today).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
    return past[0] || null;
  }

  return (
    <div>
      {confirmEl}
      {saved && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", background:T.green, color:"#fff", padding:"12px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.4)", zIndex:999, display:"flex", alignItems:"center", gap:"8px" }}>
          ✓ Changes saved
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <div ref={formRef} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <span style={{ fontSize:"11px", color:"#475569" }}>{locs.length} location{locs.length!==1?"s":""}</span>
        {!isGuest && <button style={S.bp} onClick={()=>{setForm(blankL);setEditing(null);setShowForm(s=>!s);}}>
          {showForm?"Cancel":"+ Add Location"}
        </button>}
      </div>

      {/* ── FORM ── */}
      {!isGuest && showForm && (
        <div style={{ ...S.card, border:"1px solid #bfdbfe" }}>
          <div style={S.ct}>{editing?"Edit Location / Client":"New Location / Client"}</div>
          <div style={S.g3}>
            <div><label style={S.lbl}>Client / Company Name *</label><input style={S.inp} value={form.client} onChange={ff("client")} placeholder="e.g. ABC Corp"/></div>
            <div><label style={S.lbl}>Location Name <span style={{ color:T.textMute, fontWeight:"400", textTransform:"none" }}>(optional — uses client name if blank)</span></label><input style={S.inp} value={form.name} onChange={ff("name")} placeholder="e.g. Downtown Mall"/></div>
            <div><label style={S.lbl}>Contact Person</label><input style={S.inp} value={form.contactName} onChange={ff("contactName")} placeholder="John Smith"/></div>
          </div>
          <div style={{ ...S.g3, marginTop:"8px" }}>
            <div><label style={S.lbl}>Contact Email</label><input style={S.inp} type="email" value={form.contactEmail} onChange={ff("contactEmail")}/></div>
            <div><label style={S.lbl}>Contact Phone</label><input style={S.inp} type="tel" value={form.contactPhone} onChange={ff("contactPhone")}/></div>
            <div><label style={S.lbl}>Client Address</label><input style={S.inp} value={form.clientAddress} onChange={ff("clientAddress")} placeholder="123 Main St, Toronto, ON"/></div>
          </div>
          <div style={{ ...S.g2, marginTop:"8px" }}>
            <div><label style={S.lbl}>Contract Start Date</label><input style={S.inp} type="date" value={form.contractStart} onChange={ff("contractStart")}/></div>
            <div><label style={S.lbl}>Contract End Date</label><input style={{ ...S.inp, borderColor: form.contractEnd && form.contractEnd < todayStr() ? "#ef4444" : undefined }} type="date" value={form.contractEnd} onChange={ff("contractEnd")}/></div>
          </div>
          <div style={{ marginTop:"8px" }}><label style={S.lbl}>Notes</label><textarea style={S.ta} value={form.notes} onChange={ff("notes")} placeholder="Contract terms, special instructions…"/></div>
          <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
            <button style={S.bp} onClick={submit}>{editing?"Save Changes":"Add Location"}</button>
            <button style={S.bo} onClick={()=>{setShowForm(false);setEditing(null);}}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── LOCATION CARDS ── */}
      {locs.length===0 ? <div style={S.card}><div style={S.empty}>No locations added yet.</div></div> :
        locs.map(l => {
          const cr = currentRate(l);
          const isExp = expanded===l.id;
          const contractExpired = l.contractEnd && l.contractEnd < todayStr();
          return (
            <div key={l.id} style={S.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"8px" }}>
                <div style={{ cursor:"pointer", flex:1 }} onClick={()=>setExpanded(isExp?null:l.id)}>
                  <div style={{ fontWeight:"700", color:"#0f172a", fontSize:"13px" }}>
                    {l.name}
                  </div>
                  {l.client && <div style={{ fontSize:"11px", color:"#475569", marginTop:"1px" }}>Client: {l.client}</div>}
                  {l.clientAddress && <div style={{ fontSize:"10px", color:"#94a3b8", marginTop:"1px" }}>{l.clientAddress}</div>}
                  <div style={{ display:"flex", gap:"8px", marginTop:"4px", flexWrap:"wrap" }}>
                    {cr && <span style={S.pill("#10b981")}>Rate: ${parseFloat(cr.rate).toFixed(2)}/hr</span>}
                    {l.contractEnd && <span style={S.pill(contractExpired?"#ef4444":"#3b82f6")}>{contractExpired?"Contract Expired":"Contract Until"}: {l.contractEnd}</span>}
</div>
                </div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  {!isGuest && <button style={S.bsm()} onClick={()=>edit(l)}>Edit</button>}
                  {!isGuest && <button style={S.bd} onClick={()=>del(l.id)}>Delete</button>}
                  <button style={S.bsm()} onClick={()=>setExpanded(isExp?null:l.id)}>{isExp?"▲":"▼"}</button>
                </div>
              </div>

              {isExp && (
                <div style={{ marginTop:"12px", borderTop:"1px solid #e2e8f0", paddingTop:"12px" }}>
                  <div style={{ display:"flex", gap:"20px", fontSize:"11px", color:"#475569", flexWrap:"wrap", marginBottom:"14px" }}>
                    {[["Contact",l.contactName],["Email",l.contactEmail],["Phone",l.contactPhone],["Contract Start",l.contractStart],["Contract End",l.contractEnd]].map(([label,val])=>val?(
                      <div key={label}><span style={{ color:"#94a3b8" }}>{label}: </span>{val}</div>
                    ):null)}
{l.notes && <div style={{ width:"100%" }}><span style={{ color:"#94a3b8" }}>Notes: </span>{l.notes}</div>}
                  </div>

                  <div style={{ background:"#f8faff", borderRadius:"7px", padding:"12px" }}>
                    <div style={{ fontSize:"10px", fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>Billing Rate History</div>
                    {(l.rates||[]).length===0 && <div style={{ fontSize:"11px", color:"#94a3b8", marginBottom:"8px" }}>No rates recorded yet.</div>}
                    {(l.rates||[]).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate)).map(r=>(
                      <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #e2e8f0" }}>
                        <div>
                          <span style={{ fontWeight:"700", color:"#34d399" }}>${parseFloat(r.rate).toFixed(2)}/hr</span>
                          <span style={{ fontSize:"10px", color:"#475569", marginLeft:"10px" }}>Effective: {r.effectiveDate}</span>
                          {r.notes && <span style={{ fontSize:"10px", color:"#94a3b8", marginLeft:"8px" }}>— {r.notes}</span>}
                        </div>
                        <button style={S.bd} onClick={()=>delRate(l.id,r.id)}>✕</button>
                      </div>
                    ))}
                    {!isGuest && <div style={{ marginTop:"10px" }}>
                      <div style={{ fontSize:"9px", color:"#94a3b8", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"0.5px" }}>Add New Rate</div>
                      <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", alignItems:"flex-end" }}>
                        <div><label style={S.lbl}>Effective Date</label><input style={{ ...S.inp, width:"140px" }} type="date" value={rateForm.effectiveDate} onChange={e=>setRateForm(p=>({...p,effectiveDate:e.target.value}))}/></div>
                        <div><label style={S.lbl}>Rate ($/hr)</label><input style={{ ...S.inp, width:"100px" }} type="number" step="0.01" value={rateForm.rate} onChange={e=>setRateForm(p=>({...p,rate:e.target.value}))} placeholder="23.00"/></div>
                        <div style={{ flex:1 }}><label style={S.lbl}>Note (optional)</label><input style={S.inp} value={rateForm.notes} onChange={e=>setRateForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. Rate increase Jan 2026"/></div>
                        <button style={S.bs} onClick={()=>addRate(l.id)}>Add Rate</button>
                      </div>
                    </div>}
                  </div>
                </div>
              )}
            </div>
          );
        })
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════
function Calendar({ guards, locs, scs, setScs, ovs, setOvs, addLog, isGuest }) {
  const today = new Date();
  const [yr, setYr] = useState(today.getFullYear()); const [mo, setMo] = useState(today.getMonth());
  const [sel, setSel] = useState(null); const [sub, setSub] = useState("cal");
  const [sf, setSf] = useState({ guardId:"", locationId:"", days:[], startTime:"", endTime:"", effectiveFrom:"", effectiveTo:"" });
  const [adjG, setAdjG] = useState(null);
  const [adj, setAdj] = useState({ startTime:"", endTime:"", regularHours:"", statHours:"", absent:false, locationId:"", notes:"" });
  const [adjSaved, setAdjSaved] = useState(false);
  const [scSaved, setScSaved] = useState(false);
  const [confirmEl, ask] = useConfirm();
  const [daySearch, setDaySearch] = useState("");
  const [bulk, setBulk] = useState({ guardId:"", fromDate:"", toDate:"" });
  const [bulkResult, setBulkResult] = useState(null);
  const [statDate, setStatDate] = useState("");
  const [scSearch, setScSearch] = useState("");
  const [editingSc, setEditingSc] = useState(null);
  // CRA remittance reminder — dismissed per month (stored as "YYYY-MM")
  const [crasDismissed, setCrasDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("so_cra_dismissed")||"[]"); } catch { return []; }
  });
  const dismissCra = (key) => {
    const updated = [...crasDismissed, key];
    setCrasDismissed(updated);
    try { localStorage.setItem("so_cra_dismissed", JSON.stringify(updated)); } catch {}
  };
  const [ccDismissed, setCcDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("so_cc_dismissed")||"[]"); } catch { return []; }
  });
  const dismissCc = (key) => {
    const updated = [...ccDismissed, key];
    setCcDismissed(updated);
    try { localStorage.setItem("so_cc_dismissed", JSON.stringify(updated)); } catch {}
  };

  const dim = new Date(yr,mo+1,0).getDate();
  const fd = new Date(yr,mo,1).getDay();
  const cells = [...Array(fd).fill(null), ...Array.from({length:dim},(_,i)=>i+1)];

  const prev = () => { if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1); setSel(null); setDaySearch(""); };
  const next = () => { if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1); setSel(null); setDaySearch(""); };

  const addSc = () => {
    if (!sf.guardId||!sf.locationId||!sf.days.length||!sf.startTime||!sf.endTime||!sf.effectiveFrom) {
      alert("Please fill in Employee, Location, Shift times, at least one day, and an Effective From date.");
      return;
    }
    const u = [...scs, { ...sf, id:uid(), hours:calcH(sf.startTime,sf.endTime), days:sf.days.map(Number) }];
    setScs(u); save(K.sc,u); setSf({ guardId:"",locationId:"",days:[],startTime:"",endTime:"",effectiveFrom:"",effectiveTo:"" });
    setScSaved(true); setTimeout(()=>setScSaved(false), 2500);
    const gn=guards.find(g=>g.id===sf.guardId)?.name||"?";
    const ln=locs.find(l=>l.id===sf.locationId)?.name||"?";
    addLog("Created","Schedule",`Created schedule for ${gn} at ${ln}`,`${sf.days.map(d=>DAYS[d]).join(", ")} · ${sf.startTime}–${sf.endTime} · From: ${sf.effectiveFrom||"—"}`);
  };
  const delSc = id => ask(
    "Remove this recurring schedule?\n\nAll past days from this schedule will be permanently saved so your historical hours are not lost.",
    () => {
      const sc = scs.find(s => s.id === id);
      if (!sc) return;

      // Bake every past scheduled day into a permanent override
      // so historical calendar data survives the schedule deletion.
      const today = todayStr();
      const start = sc.effectiveFrom || "2020-01-01";
      // End at yesterday (today's shift may still be in progress) or the schedule's end date, whichever is earlier
      const yd = new Date(); yd.setDate(yd.getDate()-1);
      const yesterday = dStr(yd.getFullYear(), yd.getMonth(), yd.getDate());
      const end = sc.effectiveTo && sc.effectiveTo < yesterday ? sc.effectiveTo : yesterday;

      const newOvs = [...ovs];
      let d = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");

      while (d <= endDate) {
        const ds = d.toISOString().slice(0,10);
        const dow = d.getDay();
        // Only bake days this schedule actually covers
        if (sc.days.includes(dow)) {
          // Only create an override if one doesn't already exist for this guard+date
          const alreadyOverridden = newOvs.some(o => o.date === ds && o.guardId === sc.guardId);
          if (!alreadyOverridden) {
            newOvs.push({
              id: uid(),
              date: ds,
              guardId: sc.guardId,
              locationId: sc.locationId,
              startTime: sc.startTime,
              endTime: sc.endTime,
              regularHours: sc.hours,
              statHours: 0,
              absent: false,
              notes: "auto-saved from deleted schedule",
            });
          }
        }
        d.setDate(d.getDate() + 1);
      }

      const newScs = scs.filter(s => s.id !== id);
      setOvs(newOvs); save(K.ov, newOvs);
      setScs(newScs); save(K.sc, newScs);
      const gn=guards.find(g=>g.id===sc.guardId)?.name||"?";
      const ln=locs.find(l=>l.id===sc.locationId)?.name||"?";
      addLog("Deleted","Schedule",`Removed schedule for ${gn} at ${ln}`,`${sc.days.map(d=>DAYS[d]).join(", ")} · ${sc.startTime}–${sc.endTime}`);
    }
  );
  const togDay = d => setSf(p => ({ ...p, days: p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d] }));

  const openAdj = g => {
    const ds = dStr(yr,mo,sel);
    const sh = effShift(ds, g.id, scs, ovs);
    setAdjG(g);
    setAdj({ startTime:sh?.startTime||"", endTime:sh?.endTime||"", regularHours:sh?.regularHours!==undefined?sh.regularHours:(sh?.hours||""), statHours:sh?.statHours||0, absent:sh?.absent||false, locationId:sh?.locationId||"", notes:sh?.notes||"" });
  };
  const saveAdj = () => {
    if (!adjG) return;
    // Location is required — can't save without one
    if (!adj.absent && !adj.locationId) {
      alert("Please select a location before saving. Hours must be tied to a location for reports to be accurate.");
      return;
    }
    const ds = dStr(yr,mo,sel);
    const base = ovs.filter(o=>!(o.date===ds&&o.guardId===adjG.id));
    const existing = ovs.find(o=>o.date===ds&&o.guardId===adjG.id);
    const ov = { id:uid(), date:ds, guardId:adjG.id, locationId:adj.locationId, startTime:adj.startTime, endTime:adj.endTime, regularHours:adj.absent?0:(parseFloat(adj.regularHours)||0), statHours:adj.absent?0:(parseFloat(adj.statHours)||0), absent:adj.absent, notes:adj.notes };
    const u=[...base,ov]; setOvs(u); save(K.ov,u); setAdjG(null);
    setAdjSaved(true); setTimeout(()=>setAdjSaved(false), 2500);
    // Only log if something actually changed
    const changed = !existing ||
      existing.regularHours !== ov.regularHours ||
      existing.statHours    !== ov.statHours ||
      existing.absent       !== ov.absent ||
      existing.startTime    !== ov.startTime ||
      existing.endTime      !== ov.endTime ||
      existing.locationId   !== ov.locationId;
    if (changed) {
      const gn = adjG.name;
      addLog("Adjusted","Hours",`Adjusted hours for ${gn} on ${ds}`, ov.absent?"Marked absent":`${ov.regularHours}h reg${ov.statHours>0?" + "+ov.statHours+"h stat":""}`);
    }
  };
  const remAdj = gid => ask("Reset this day's adjustment back to scheduled hours?", ()=>{ const ds=dStr(yr,mo,sel); const u=ovs.filter(o=>!(o.date===ds&&o.guardId===gid)); setOvs(u); save(K.ov,u); });

  const gName = id => guards.find(g=>g.id===id)?.name||"?";
  const lName = id => locs.find(l=>l.id===id)?.name||"?";
  const gIdx = id => guards.findIndex(g=>g.id===id);

  const selDs = sel ? dStr(yr,mo,sel) : null;
  const selDow = sel ? new Date(yr,mo,sel).getDay() : -1;
  const allOn = sel ? (() => {
    const ids = new Set();
    scs.filter(s =>
      s.days.includes(selDow) &&
      (!s.effectiveFrom || selDs >= s.effectiveFrom) &&
      (!s.effectiveTo   || selDs <= s.effectiveTo)
    ).forEach(s => ids.add(s.guardId));
    ovs.filter(o=>o.date===selDs).forEach(o=>ids.add(o.guardId));
    return guards.filter(g=>ids.has(g.id));
  })() : [];
  const unsch = sel ? guards.filter(g=>!allOn.find(x=>x.id===g.id)) : [];

  return (
    <div>
      {confirmEl}

      {/* ── SAVED TOASTS ── */}
      {adjSaved && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", background:T.green, color:"#fff", padding:"12px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.4)", zIndex:9998, display:"flex", alignItems:"center", gap:"8px" }}>
          ✓ Hours saved
        </div>
      )}
      {scSaved && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", background:T.blue, color:"#fff", padding:"12px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.4)", zIndex:9998, display:"flex", alignItems:"center", gap:"8px" }}>
          ✓ Schedule created
        </div>
      )}

      {/* ── ADJUST MODAL ── */}
      {adjG && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9990, backdropFilter:"blur(3px)", padding:"16px", overflowY:"auto" }}
          onWheel={e=>e.stopPropagation()}
          onTouchMove={e=>e.stopPropagation()}>
          <div style={{ background:T.surface, border:`1px solid ${T.blue}44`, borderRadius:"14px", padding:"24px 28px", width:"100%", maxWidth:"460px", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", overflowY:"auto", maxHeight:"90vh", WebkitOverflowScrolling:"touch" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <div style={{ fontWeight:"700", color:T.text, fontSize:"15px" }}>
                Adjust: <span style={{ color:gc(gIdx(adjG.id)) }}>{adjG.name}</span>
              </div>
              <div style={{ fontSize:"12px", color:T.textSub }}>{selDs} ({selDs ? DAYS[new Date(selDs+"T00:00:00").getDay()] : ""})</div>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", color:T.text, cursor:"pointer", marginBottom:"14px" }}>
              <input type="checkbox" checked={adj.absent} onChange={e=>setAdj(p=>({...p,absent:e.target.checked}))} style={{ width:"16px", height:"16px" }}/>
              Mark as Absent (no hours)
            </label>
            {!adj.absent && (
              <div>
                <div style={{ marginBottom:"12px" }}>
                  <label style={{ ...S.lbl, color: adj.locationId ? T.textSub : T.red }}>
                    Location * <span style={{ fontWeight:"400", fontSize:"10px" }}>{adj.locationId ? "" : "— required for reports"}</span>
                  </label>
                  <select style={{ ...S.sel, borderColor: adj.locationId ? T.border : T.red }} value={adj.locationId} onChange={e=>setAdj(p=>({...p,locationId:e.target.value}))}>
                    <option value="">Select location…</option>
                    {locs.map(l=><option key={l.id} value={l.id}>{l.name}{l.client?" — "+l.client:""}</option>)}
                  </select>
                </div>
                <div style={S.g2}>
                  <Inp label="Shift Start" type="time" value={adj.startTime} onChange={e=>{
                    const s=e.target.value, en=adj.endTime;
                    setAdj(p=>({...p, startTime:s, regularHours: s&&en ? calcH(s,en) : p.regularHours }));
                  }}/>
                  <Inp label="Shift End" type="time" value={adj.endTime} onChange={e=>{
                    const en=e.target.value, s=adj.startTime;
                    setAdj(p=>({...p, endTime:en, regularHours: s&&en ? calcH(s,en) : p.regularHours }));
                  }}/>
                </div>
                <div style={{ ...S.g2, marginTop:"10px" }}>
                  <Inp label="Regular Hours" type="number" step="0.5" value={adj.regularHours} onChange={e=>setAdj(p=>({...p,regularHours:e.target.value}))} placeholder="0"/>
                  <div>
                    <label style={{ ...S.lbl, color:T.amber }}>Stat Holiday Hours (1.5×)</label>
                    <input style={{ ...S.inp, borderColor:"#fcd34d" }} type="number" step="0.5" value={adj.statHours} onChange={e=>setAdj(p=>({...p,statHours:e.target.value}))} placeholder="0"/>
                  </div>
                </div>
                <div style={{ marginTop:"6px", fontSize:"11px", color:T.textMute }}>
                  Night shift crossing into stat? Enter only the hours <em>after midnight</em> on the stat day as stat hours.
                </div>
                <div style={{ marginTop:"10px" }}>
                  <Inp label="Notes" value={adj.notes} onChange={e=>setAdj(p=>({...p,notes:e.target.value}))} placeholder="Reason for adjustment…"/>
                </div>
              </div>
            )}
            <F style={{ marginTop:"16px" }}>
              <button style={{ ...S.bp, opacity:(!adj.absent && !adj.locationId) ? 0.5 : 1 }} onClick={saveAdj}>Save Hours</button>
              <button style={S.bo} onClick={()=>setAdjG(null)}>Cancel</button>
            </F>
            {!adj.absent && !adj.locationId && (
              <div style={{ marginTop:"8px", fontSize:"11px", color:T.red }}>
                ⚠ Select a location to enable saving — required for accurate reports.
              </div>
            )}
          </div>
        </div>
      )}

      <F style={{ marginBottom:"12px" }}>
        {(isGuest ? [["cal","📅 Calendar"]] : [["cal","📅 Calendar"],["sch","🔁 Schedules"],["stat","⭐ Stat Holiday"],["bulk","🗑 Bulk Delete Hours"]]).map(([t,l])=><button key={t} style={{ ...S.bp, background:sub===t?"#1d4ed8":"transparent", color:sub===t?"#fff":"#4a8ab0", border:"1px solid #e2e8f0" }} onClick={()=>{setSub(t);setBulkResult(null);}}>{l}</button>)}
      </F>

      {sub==="sch" && (
        <div>
          <div style={S.card}>
            <div style={S.ct}>Set Recurring Schedule</div>
            <div style={S.g4}>
              <Sel label="Employee" value={sf.guardId} onChange={e=>setSf(p=>({...p,guardId:e.target.value}))}><option value="">Select…</option>{guards.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</Sel>
              <Sel label="Location" value={sf.locationId} onChange={e=>setSf(p=>({...p,locationId:e.target.value}))}><option value="">Select…</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Sel>
              <Inp label="Shift Start" type="time" value={sf.startTime} onChange={e=>setSf(p=>({...p,startTime:e.target.value}))} />
              <Inp label="Shift End" type="time" value={sf.endTime} onChange={e=>setSf(p=>({...p,endTime:e.target.value}))} />
            </div>
            {sf.startTime&&sf.endTime&&<div style={{ marginTop:"4px", fontSize:"10px", color:"#475569" }}>→ {calcH(sf.startTime,sf.endTime)}h {shiftLabel(sf.startTime) ? <span style={{ marginLeft:"4px" }}>{shiftLabel(sf.startTime)}</span> : ""}</div>}
            <div style={{ ...S.g2, marginTop:"9px" }}>
              <div>
                <label style={{ ...S.lbl, color:"#60a5fa" }}>Effective From * <span style={{ color:"#94a3b8", textTransform:"none", fontWeight:"400" }}>(schedule starts on this date)</span></label>
                <input style={{ ...S.inp, borderColor:"#2563eb" }} type="date" value={sf.effectiveFrom} onChange={e=>setSf(p=>({...p,effectiveFrom:e.target.value}))}/>
              </div>
              <div>
                <label style={{ ...S.lbl, color:"#f59e0b" }}>Effective To <span style={{ color:"#94a3b8", textTransform:"none", fontWeight:"400" }}>(leave blank = ongoing)</span></label>
                <input style={{ ...S.inp, borderColor:"#fcd34d" }} type="date" value={sf.effectiveTo} onChange={e=>setSf(p=>({...p,effectiveTo:e.target.value}))}/>
              </div>
            </div>
            <div style={{ marginTop:"9px" }}><label style={S.lbl}>Recurring Days</label>
              <F style={{ marginTop:"4px" }}>{DAYS.map((d,i)=><button key={i} onClick={()=>togDay(i)} style={{ padding:"5px 9px", borderRadius:"4px", cursor:"pointer", fontWeight:"700", fontSize:"10px", background:sf.days.includes(i)?"#1d4ed8":"#ffffff", color:sf.days.includes(i)?"#fff":"#4a8ab0", border:`1px solid ${sf.days.includes(i)?"#3b82f6":"#e2e8f0"}` }}>{d}</button>)}</F>
            </div>
            <div style={{ marginTop:"9px", padding:"10px", background:"#f8faff", borderRadius:"6px", fontSize:"10px", color:"#94a3b8", lineHeight:1.6 }}>
              💡 <strong style={{ color:"#475569" }}>How date ranges work:</strong> The calendar only shows this schedule on days within the Effective From / To window. 
              Deleting a schedule <strong style={{ color:"#0f172a" }}>never</strong> changes past days — only overrides (manual adjustments) can do that.
              To change a schedule mid-month, set an end date on the old one and create a new one with the new start date.
            </div>
            <button style={{ ...S.bp, marginTop:"9px" }} onClick={addSc}>Save Schedule</button>
          </div>
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={S.ct}>All Recurring Schedules ({scs.length})</div>
              {scs.length > 0 && (
                <input style={{ ...S.inp, width:"200px" }} placeholder="Search employee or location…"
                  value={scSearch} onChange={e=>setScSearch(e.target.value)}/>
              )}
            </div>
            {scs.length===0 ? <div style={S.empty}>None.</div> : (() => {
              const q = scSearch.toLowerCase();
              const filtered = [...scs].filter(sc =>
                !q ||
                (guards.find(g=>g.id===sc.guardId)?.name||"").toLowerCase().includes(q) ||
                (locs.find(l=>l.id===sc.locationId)?.name||"").toLowerCase().includes(q) ||
                (locs.find(l=>l.id===sc.locationId)?.client||"").toLowerCase().includes(q)
              ).sort((a,b)=>{
                const na=guards.find(g=>g.id===a.guardId)?.name||"";
                const nb=guards.find(g=>g.id===b.guardId)?.name||"";
                return na!==nb ? na.localeCompare(nb) : (a.effectiveFrom||"").localeCompare(b.effectiveFrom||"");
              });
              return filtered.length === 0 ? (
                <div style={S.empty}>No schedules match "{scSearch}"</div>
              ) : (
                <table style={S.tbl}>
                  <thead><tr>{["Employee","Location","Days","Shift","Hours","Active From","Active To",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filtered.map(sc => {
                      const today = todayStr();
                      const isActive = (!sc.effectiveFrom||today>=sc.effectiveFrom) && (!sc.effectiveTo||today<=sc.effectiveTo);
                      const isPast   = sc.effectiveTo && today > sc.effectiveTo;
                      const isEditing = editingSc?.id === sc.id;
                      return (
                        <>
                          <tr key={sc.id} style={{ opacity: isPast ? 0.5 : 1 }}>
                            <td style={S.td}><span style={{ color:gc(gIdx(sc.guardId)), fontWeight:"700" }}>{gName(sc.guardId)}</span></td>
                            <td style={S.td}>{lName(sc.locationId)}</td>
                            <td style={S.td}>{sc.days.map(d=>DAYS[d]).join(", ")}</td>
                            <td style={S.td}>{sc.startTime}–{sc.endTime}{shiftLabel(sc.startTime) ? " "+shiftLabel(sc.startTime) : ""}</td>
                            <td style={S.td}>{sc.hours}h</td>
                            <td style={S.td}><span style={S.pill(isActive&&!isPast ? T.blue : T.textMute)}>{sc.effectiveFrom||"—"}</span></td>
                            <td style={S.td}>{sc.effectiveTo ? <span style={S.pill(isPast?"#6b7280":T.amber)}>{sc.effectiveTo}{isPast?" (ended)":""}</span> : <span style={S.pill(T.green)}>Ongoing</span>}</td>
                            <td style={S.td}>
                              <div style={{ display:"flex", gap:"5px" }}>
                                <button style={S.bsm(T.blue)} onClick={()=>setEditingSc(isEditing ? null : {...sc})}>
                                  {isEditing ? "Cancel" : "Edit"}
                                </button>
                                <button style={S.bd} onClick={()=>delSc(sc.id)}>Remove</button>
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr key={sc.id+"-edit"}>
                              <td colSpan="8" style={{ padding:"0", background:"rgba(0,80,255,0.03)" }}>
                                <div style={{ padding:"16px 20px", borderTop:`2px solid ${T.blue}22`, borderBottom:`1px solid ${T.border}` }}>
                                  <div style={{ fontSize:"11px", fontWeight:"600", color:T.blue, marginBottom:"12px", letterSpacing:"0.5px" }}>
                                    EDITING: {gName(sc.guardId)} @ {lName(sc.locationId)}
                                  </div>
                                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px", alignItems:"end" }}>
                                    <div>
                                      <label style={S.lbl}>Location</label>
                                      <select style={S.sel} value={editingSc.locationId} onChange={e=>setEditingSc(p=>({...p,locationId:e.target.value}))}>
                                        {locs.map(l=><option key={l.id} value={l.id}>{l.name||l.client}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={S.lbl}>Start Time</label>
                                      <input style={S.inp} type="time" value={editingSc.startTime} onChange={e=>setEditingSc(p=>({...p, startTime:e.target.value, hours:calcH(e.target.value,p.endTime)}))}/>
                                    </div>
                                    <div>
                                      <label style={S.lbl}>End Time</label>
                                      <input style={S.inp} type="time" value={editingSc.endTime} onChange={e=>setEditingSc(p=>({...p, endTime:e.target.value, hours:calcH(p.startTime,e.target.value)}))}/>
                                    </div>
                                    <div>
                                      <label style={S.lbl}>Active From</label>
                                      <input style={S.inp} type="date" value={editingSc.effectiveFrom||""} onChange={e=>setEditingSc(p=>({...p,effectiveFrom:e.target.value}))}/>
                                    </div>
                                    <div>
                                      <label style={S.lbl}>Active To (leave blank = ongoing)</label>
                                      <input style={S.inp} type="date" value={editingSc.effectiveTo||""} onChange={e=>setEditingSc(p=>({...p,effectiveTo:e.target.value}))}/>
                                    </div>
                                  </div>
                                  <div style={{ marginTop:"10px" }}>
                                    <label style={S.lbl}>Days</label>
                                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                                      {DAYS.map((d,i)=>(
                                        <button key={i} onClick={()=>setEditingSc(p=>({...p, days:p.days.includes(i)?p.days.filter(x=>x!==i):[...p.days,i]}))}
                                          style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"12px", cursor:"pointer", fontWeight:"600", border:`1px solid ${editingSc.days.includes(i)?T.blue:T.border}`, background:editingSc.days.includes(i)?"rgba(0,80,255,0.08)":"transparent", color:editingSc.days.includes(i)?T.blue:T.textSub }}>
                                          {d}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ display:"flex", gap:"8px", marginTop:"14px" }}>
                                    <button style={S.bp} onClick={()=>{
                                      const updated = scs.map(s=>s.id===editingSc.id ? {...editingSc} : s);
                                      setScs(updated); save(K.sc, updated);
                                      addLog("Updated","Schedule",`Updated schedule for ${gName(editingSc.guardId)} at ${lName(editingSc.locationId)}`);
                                      setEditingSc(null);
                                    }}>Save Changes</button>
                                    <button style={S.bo} onClick={()=>setEditingSc(null)}>Cancel</button>
                                    {editingSc.effectiveTo && (
                                      <button style={{ ...S.bsm(T.green) }} onClick={()=>setEditingSc(p=>({...p,effectiveTo:""}))}>
                                        Clear End Date (make ongoing)
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── STAT HOLIDAY MASS ADJUST ── */}
      {sub==="stat" && (
        <div>
          <div style={{ ...S.card, border:`1px solid ${T.amber}44` }}>
            <div style={S.ct}>⭐ Mass Stat Holiday — Apply to All Working Employees</div>
            <div style={{ fontSize:"12px", color:T.textSub, marginBottom:"14px", lineHeight:1.7 }}>
              Select a statutory holiday date. The tool finds employees working <strong style={{ color:T.text }}>on</strong> the stat day, 
              plus any night-shift employees whose shift <strong style={{ color:T.text }}>started the day before and crosses midnight</strong> into the stat holiday.
              Hours are automatically split: regular hours before midnight, stat hours after midnight.
            </div>
            <div style={{ maxWidth:"260px" }}>
              <label style={S.lbl}>Statutory Holiday Date *</label>
              <input style={S.inp} type="date" value={statDate} onChange={e=>{ setStatDate(e.target.value); }}/>
            </div>

            {statDate && (() => {
              // Helper dates
              const prevDate = (() => { const d=new Date(statDate+"T00:00:00"); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
              const nextDate = (() => { const d=new Date(statDate+"T00:00:00"); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();

              // 1. Employees scheduled ON the stat day itself
              const statShifts = shiftsOn(statDate, guards, scs, ovs)
                .filter(s => !s.absent && ((s.regularHours||s.hours||0)+(s.statHours||0))>0);

              // 2. Employees with a shift starting the PREVIOUS day that crosses midnight INTO the stat day
              // We look at the schedule (not just the override) to get startTime/endTime,
              // because manual overrides often only store hours, not the actual times.
              const prevShifts = shiftsOn(prevDate, guards, scs, ovs)
                .map(s => {
                  // If the override lacks start/end times, look them up from the schedule
                  if (!s.startTime || !s.endTime) {
                    const dow = pDate(prevDate).getDay();
                    const sc = scs.find(x =>
                      x.guardId===s.guardId &&
                      x.days.includes(dow) &&
                      (!x.effectiveFrom || prevDate >= x.effectiveFrom) &&
                      (!x.effectiveTo   || prevDate <= x.effectiveTo)
                    );
                    if (sc) return { ...s, startTime: sc.startTime, endTime: sc.endTime };
                  }
                  return s;
                })
                .filter(s => !s.absent && s.startTime && s.endTime && toMin(s.endTime) <= toMin(s.startTime) && toMin(s.endTime) > 0);
              const crossingIn = prevShifts
                .map(s => {
                  const statMins    = toMin(s.endTime);
                  const regularMins = 1440 - toMin(s.startTime);
                  return { ...s, isCrossingIn:true, prevDate, regularHoursOnPrev:Math.round(regularMins/60*100)/100, statHoursOnStat:Math.round(statMins/60*100)/100 };
                })
                .filter(s => s.statHoursOnStat > 0);

              // 3. Employees with a shift starting ON the stat day that crosses midnight INTO the next day
              //    These get: stat hours on the stat day (start → midnight), regular hours on next day (midnight → end)
              const crossingOut = statShifts
                .filter(s => s.startTime && s.endTime && toMin(s.endTime) < toMin(s.startTime));

              // Total unique employees affected (an employee can appear in both statShifts and crossingIn)
              const allAffectedIds = new Set([...statShifts.map(s=>s.guardId), ...crossingIn.map(s=>s.guardId)]);
              const totalEligible = allAffectedIds.size;

              return (
                <div style={{ marginTop:"14px" }}>
                  <div style={{ fontSize:"11px", fontWeight:"600", color:T.textSub, marginBottom:"10px" }}>
                    {totalEligible} employee{totalEligible!==1?"s":""} affected by stat holiday on {statDate}
                    {crossingOut.length>0 && <span style={{ color:T.amber, marginLeft:"8px" }}>({crossingOut.length} shift{crossingOut.length!==1?"s":""} cross into {nextDate})</span>}
                  </div>
                  {totalEligible === 0 ? (
                    <div style={{ fontSize:"12px", color:T.textMute }}>No employees scheduled on or crossing into this date.</div>
                  ) : (
                    <>
                      <div style={{ background:T.bg, borderRadius:"8px", border:`1px solid ${T.border}`, overflow:"hidden", marginBottom:"12px" }}>
                        <table style={S.tbl}>
                          <thead><tr>{["Employee","Shift","Type","Stat Hrs ★ (stat day)","Reg Hrs (next day)"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                          <tbody>
                            {/* Employees working on the stat day — shift stays within stat day */}
                            {statShifts.filter(s => !crossingOut.find(x=>x.guardId===s.guardId)).map(s => {
                              const total = (s.regularHours||s.hours||0)+(s.statHours||0);
                              return (
                                <tr key={"stat_"+s.guardId}>
                                  <td style={S.td}><span style={{ fontWeight:"700", color:gc(gIdx(s.guardId)) }}>{s.guard.name}</span></td>
                                  <td style={S.td}>{s.startTime&&s.endTime?`${s.startTime}–${s.endTime}`:"—"}</td>
                                  <td style={S.td}><span style={S.pill(T.amber)}>On stat day</span></td>
                                  <td style={S.td}><span style={{ color:T.amber, fontWeight:"700" }}>{total.toFixed(2)}h ★</span></td>
                                  <td style={S.td}><span style={{ color:T.textMute }}>—</span></td>
                                </tr>
                              );
                            })}
                            {/* Employees on stat day whose shift crosses INTO the next regular day */}
                            {crossingOut.map(s => {
                              const statMins = 1440 - toMin(s.startTime); // from start to midnight
                              const regMins  = toMin(s.endTime);          // from midnight to end
                              const statH = Math.round(statMins/60*100)/100;
                              const regH  = Math.round(regMins/60*100)/100;
                              return (
                                <tr key={"out_"+s.guardId} style={{ background:"#fffbeb" }}>
                                  <td style={S.td}><span style={{ fontWeight:"700", color:gc(gIdx(s.guardId)) }}>{s.guard.name}</span></td>
                                  <td style={S.td}>{s.startTime}–{s.endTime} <span style={{ fontSize:"9px", color:T.textMute }}>(ends {nextDate})</span></td>
                                  <td style={S.td}><span style={S.pill(T.amber)}>🌅 Crosses into {nextDate}</span></td>
                                  <td style={S.td}><span style={{ color:T.amber, fontWeight:"700" }}>{statH.toFixed(2)}h ★</span></td>
                                  <td style={S.td}><span style={{ color:T.textSub }}>{regH.toFixed(2)}h reg (on {nextDate})</span></td>
                                </tr>
                              );
                            })}
                            {/* Employees crossing IN from previous night */}
                            {crossingIn.map(s => (
                              <tr key={"cross_"+s.guardId} style={{ background:"#f0fdf4" }}>
                                <td style={S.td}><span style={{ fontWeight:"700", color:gc(gIdx(s.guardId)) }}>{s.guard.name}</span></td>
                                <td style={S.td}>{s.startTime}–{s.endTime} <span style={{ fontSize:"9px", color:T.textMute }}>(starts {prevDate})</span></td>
                                <td style={S.td}><span style={S.pill(T.purple)}>🌙 Crosses from {prevDate}</span></td>
                                <td style={S.td}><span style={{ color:T.amber, fontWeight:"700" }}>{s.statHoursOnStat.toFixed(2)}h ★</span></td>
                                <td style={S.td}><span style={{ color:T.textSub }}>{s.regularHoursOnPrev.toFixed(2)}h reg (on {prevDate})</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        style={{ ...S.bp, background:"linear-gradient(135deg,#92400e,#b45309)", boxShadow:"0 2px 8px #f59e0b30" }}
                        onClick={() => ask(
                          `Apply stat hours to ${totalEligible} employee${totalEligible!==1?"s":""}? Hours will be split automatically for shifts crossing midnight.`,
                          () => {
                            const newOvs = [...ovs];

                            // Employees working fully within the stat day
                            statShifts.filter(s=>!crossingOut.find(x=>x.guardId===s.guardId)).forEach(s => {
                              const total = (s.regularHours||s.hours||0)+(s.statHours||0);
                              const idx = newOvs.findIndex(o=>o.date===statDate&&o.guardId===s.guardId);
                              if (idx!==-1) newOvs.splice(idx,1);
                              newOvs.push({ id:uid(), date:statDate, guardId:s.guardId, locationId:s.locationId||"", startTime:s.startTime||"", endTime:s.endTime||"", regularHours:0, statHours:total, absent:false, notes:`Stat holiday — ${statDate}` });
                            });

                            // Employees on stat day crossing INTO next regular day
                            crossingOut.forEach(s => {
                              const statMins = 1440 - toMin(s.startTime);
                              const regMins  = toMin(s.endTime);
                              const statH = Math.round(statMins/60*100)/100;
                              const regH  = Math.round(regMins/60*100)/100;
                              // Stat day: from start to midnight
                              const idx = newOvs.findIndex(o=>o.date===statDate&&o.guardId===s.guardId);
                              if (idx!==-1) newOvs.splice(idx,1);
                              newOvs.push({ id:uid(), date:statDate, guardId:s.guardId, locationId:s.locationId||"", startTime:s.startTime||"", endTime:"23:59", regularHours:0, statHours:statH, absent:false, notes:`Stat holiday — ${statDate} (shift crosses into ${nextDate})` });
                              // Next day: from midnight to shift end
                              const nIdx = newOvs.findIndex(o=>o.date===nextDate&&o.guardId===s.guardId);
                              if (nIdx!==-1) newOvs.splice(nIdx,1);
                              newOvs.push({ id:uid(), date:nextDate, guardId:s.guardId, locationId:s.locationId||"", startTime:"00:00", endTime:s.endTime||"", regularHours:regH, statHours:0, absent:false, notes:`Regular hours — continuation of stat shift from ${statDate}` });
                            });

                            // Employees crossing IN from previous night
                            crossingIn.forEach(s => {
                              // Update prev day override: cap at midnight, mark regular hours only
                              const prevIdx = newOvs.findIndex(o=>o.date===prevDate&&o.guardId===s.guardId);
                              if (prevIdx!==-1) newOvs.splice(prevIdx,1);
                              newOvs.push({ id:uid(), date:prevDate, guardId:s.guardId, locationId:s.locationId||"", startTime:s.startTime||"", endTime:"23:59", regularHours:s.regularHoursOnPrev, statHours:0, absent:false, notes:`Night shift — stat holiday split (regular portion on ${prevDate})` });

                              // For the stat day: if there is already an override (e.g. the 11am–4pm manual entry),
                              // ADD the crossing stat hours to the existing stat hours rather than replacing the record.
                              const statIdx = newOvs.findIndex(o=>o.date===statDate&&o.guardId===s.guardId);
                              if (statIdx !== -1) {
                                // Merge: keep existing entry but add the crossing stat hours
                                const existing = newOvs[statIdx];
                                newOvs.splice(statIdx, 1);
                                newOvs.push({
                                  ...existing,
                                  statHours: Math.round(((existing.statHours||0) + s.statHoursOnStat)*100)/100,
                                  notes: (existing.notes||"") + ` + ${s.statHoursOnStat}h stat from night shift on ${prevDate}`,
                                });
                              } else {
                                // No existing entry — create a new one for the crossing hours
                                newOvs.push({ id:uid(), date:statDate, guardId:s.guardId, locationId:s.locationId||"", startTime:"00:00", endTime:s.endTime||"", regularHours:0, statHours:s.statHoursOnStat, absent:false, notes:`Stat holiday — ${statDate} (crossed from night shift on ${prevDate})` });
                              }
                            });

                            setOvs(newOvs); save(K.ov, newOvs);
                            setAdjSaved(true); setTimeout(()=>setAdjSaved(false), 2500);
                            setStatDate("");
                          }
                        )}
                      >
                        ⭐ Apply Stat Hours to {totalEligible} Employee{totalEligible!==1?"s":""}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {sub==="bulk" && (
        <div>
          <div style={{ ...S.card, border:"1px solid #ef444444" }}>
            <div style={S.ct}>🗑 Bulk Delete Employee Hours</div>
            <div style={{ fontSize:"11px", color:"#475569", marginBottom:"14px", lineHeight:1.6 }}>
              Select an employee and date range to preview and delete all hours in that period — whether they came from a recurring schedule or were manually entered.
            </div>
            <div style={S.g3}>
              <Sel label="Employee *" value={bulk.guardId} onChange={e=>setBulk(p=>({...p,guardId:e.target.value}))}>
                <option value="">Select employee…</option>
                {guards.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </Sel>
              <Inp label="From Date *" type="date" value={bulk.fromDate} onChange={e=>setBulk(p=>({...p,fromDate:e.target.value}))}/>
              <Inp label="To Date *" type="date" value={bulk.toDate} onChange={e=>setBulk(p=>({...p,toDate:e.target.value}))}/>
            </div>

            {bulk.guardId && bulk.fromDate && bulk.toDate && (() => {
              const gName = guards.find(g=>g.id===bulk.guardId)?.name||"?";

              // Walk every day in the range and collect any day that has hours
              // from EITHER a schedule OR an override
              const hits = [];
              let d = new Date(bulk.fromDate + "T00:00:00");
              const endD = new Date(bulk.toDate + "T00:00:00");
              while (d <= endD) {
                const ds = d.toISOString().slice(0,10);
                const sh = effShift(ds, bulk.guardId, scs, ovs);
                if (sh && !sh.absent && ((sh.regularHours||sh.hours||0) > 0 || (sh.statHours||0) > 0)) {
                  const existingOv = ovs.find(o => o.date===ds && o.guardId===bulk.guardId);
                  hits.push({
                    date: ds,
                    regularHours: sh.regularHours || sh.hours || 0,
                    statHours: sh.statHours || 0,
                    source: existingOv ? "override" : "schedule",
                    ovId: existingOv?.id || null,
                  });
                }
                d.setDate(d.getDate() + 1);
              }

              return (
                <div style={{ marginTop:"14px" }}>
                  <div style={{ fontSize:"10px", fontWeight:"700", color:"#475569", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>
                    Preview — {hits.length} day{hits.length!==1?"s":""} found for {gName}
                  </div>
                  {hits.length === 0 ? (
                    <div style={{ fontSize:"11px", color:"#94a3b8", padding:"8px 0" }}>
                      No hours found for this employee in the selected date range.
                    </div>
                  ) : (
                    <div style={{ background:"#f8faff", borderRadius:"7px", padding:"10px", maxHeight:"260px", overflowY:"auto" }}>
                      {hits.map(h => (
                        <div key={h.date} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #e2e8f0", fontSize:"11px" }}>
                          <span style={{ color:"#0f172a" }}>
                            {h.date} <span style={{ color:"#94a3b8" }}>({DAYS[pDate(h.date).getDay()]})</span>
                          </span>
                          <span style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                            <span style={{ color:"#34d399" }}>
                              {(h.regularHours + h.statHours).toFixed(2)}h
                              {h.statHours > 0 ? <span style={{ color:"#fbbf24" }}> (+{h.statHours}h stat)</span> : ""}
                            </span>
                            <span style={S.pill(h.source==="override" ? "#a78bfa" : "#3b82f6")}>
                              {h.source==="override" ? "manual" : "schedule"}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hits.length > 0 && (
                    <button
                      style={{ ...S.bd, marginTop:"12px", padding:"8px 20px", fontSize:"11px", borderRadius:"6px" }}
                      onClick={() => ask(
                        `Delete ${hits.length} day${hits.length!==1?"s":""} of hours for ${gName} between ${bulk.fromDate} and ${bulk.toDate}? This cannot be undone.`,
                        () => {
                          // For schedule-based days: add an "absent" override to zero them out
                          // For override-based days: remove the existing override
                          const newOvs = [...ovs];
                          hits.forEach(h => {
                            // Remove any existing override for this day
                            const idx = newOvs.findIndex(o => o.date===h.date && o.guardId===bulk.guardId);
                            if (idx !== -1) newOvs.splice(idx, 1);
                            // If it came from a schedule, we need an absent override to hide it
                            if (h.source === "schedule") {
                              newOvs.push({
                                id: uid(),
                                date: h.date,
                                guardId: bulk.guardId,
                                locationId: "",
                                startTime: "",
                                endTime: "",
                                regularHours: 0,
                                statHours: 0,
                                absent: true,
                                notes: "bulk deleted",
                              });
                            }
                          });
                          setOvs(newOvs); save(K.ov, newOvs);
                          setBulkResult({ deleted: hits.length, name: gName });
                          setBulk({ guardId:"", fromDate:"", toDate:"" });
                        }
                      )}
                    >
                      🗑 Delete {hits.length} Day{hits.length!==1?"s":""}
                    </button>
                  )}
                </div>
              );
            })()}

            {bulkResult && (
              <div style={{ marginTop:"12px", padding:"10px 14px", background:"#f0fdf4", borderRadius:"7px", border:"1px solid #bbf7d0", fontSize:"11px", color:"#15803d" }}>
                ✓ Deleted {bulkResult.deleted} day{bulkResult.deleted!==1?"s":""} of hours for {bulkResult.name}.
              </div>
            )}
          </div>
        </div>
      )}
      {sub==="cal" && (
        <div>
          {/* ── CRA PAYROLL REMITTANCE REMINDER ── */}
          {(() => {
            const now = new Date();
            const todayDay = now.getDate();
            const todayMo  = now.getMonth();
            const todayYr  = now.getFullYear();
            // Show reminder for the current real month only, on days 1–14
            const isCurrentMonth = (mo === todayMo && yr === todayYr);
            const isBeforeDue = todayDay <= 14;
            const craKey = `${todayYr}-${String(todayMo+1).padStart(2,"0")}`;
            const isDismissed = crasDismissed.includes(craKey);
            if (!isCurrentMonth || !isBeforeDue || isDismissed) return null;
            return (
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"10px", padding:"12px 16px", marginBottom:"14px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                  <span style={{ fontSize:"20px", marginTop:"1px" }}>🇨🇦</span>
                  <div>
                    <div style={{ fontWeight:"700", color:"#dc2626", fontSize:"13px", marginBottom:"3px" }}>
                      CRA Payroll Remittance Due by the 15th
                    </div>
                    <div style={{ fontSize:"12px", color:T.textSub, lineHeight:1.6 }}>
                      Remember to submit your payroll remittance to the CRA for <strong>{MONTHS[todayMo]} {todayYr}</strong> before the <strong>15th</strong>.
                      This includes CPP contributions, EI premiums, and income tax deducted from employee pay.
                    </div>
                  </div>
                </div>
                <button
                  style={{ flexShrink:0, background:"transparent", border:"1px solid #fecaca", borderRadius:"6px", padding:"5px 12px", fontSize:"11px", color:"#dc2626", cursor:"pointer", fontWeight:"600", whiteSpace:"nowrap" }}
                  onClick={()=>dismissCra(craKey)}>
                  ✓ Already Paid
                </button>
              </div>
            );
          })()}
          {/* ── CREDIT CARD REMINDER ── */}
          {(() => {
            const now = new Date();
            const todayDay = now.getDate();
            const todayMo  = now.getMonth();
            const todayYr  = now.getFullYear();
            const isCurrentMonth = (mo === todayMo && yr === todayYr);
            const isBeforeDue = todayDay <= 14;
            const ccKey = `cc-${todayYr}-${String(todayMo+1).padStart(2,"0")}`;
            const isDismissed = ccDismissed.includes(ccKey);
            if (!isCurrentMonth || !isBeforeDue || isDismissed) return null;
            return (
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"10px", padding:"12px 16px", marginBottom:"14px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                  <span style={{ fontSize:"20px", marginTop:"1px" }}>💳</span>
                  <div>
                    <div style={{ fontWeight:"700", color:"#1d4ed8", fontSize:"13px", marginBottom:"3px" }}>
                      Company Credit Card Bill Due by the 15th
                    </div>
                    <div style={{ fontSize:"12px", color:T.textSub, lineHeight:1.6 }}>
                      Don't forget to pay the company credit card bill for <strong>{MONTHS[todayMo]} {todayYr}</strong> before the <strong>15th</strong> to avoid interest charges.
                    </div>
                  </div>
                </div>
                <button
                  style={{ flexShrink:0, background:"transparent", border:"1px solid #bfdbfe", borderRadius:"6px", padding:"5px 12px", fontSize:"11px", color:"#1d4ed8", cursor:"pointer", fontWeight:"600", whiteSpace:"nowrap" }}
                  onClick={()=>dismissCc(ccKey)}>
                  ✓ Already Paid
                </button>
              </div>
            );
          })()}
          {/* ── UNSCHEDULED EMPLOYEE ALERT ── */}
          {(() => {
            const activeGuards = guards.filter(g => g.status === "Active");
            const unscheduled = activeGuards.filter(g => {
              // Check if this employee has any shift in the current month
              for (let d = 1; d <= dim; d++) {
                const ds = dStr(yr, mo, d);
                const sh = effShift(ds, g.id, scs, ovs);
                if (sh && !sh.absent && ((sh.regularHours||sh.hours||0) + (sh.statHours||0)) > 0) return false;
              }
              return true;
            });
            if (unscheduled.length === 0) return null;
            return (
              <div style={{ background:"#fffbeb", border:`1px solid ${T.amber}66`, borderRadius:"10px", padding:"12px 16px", marginBottom:"14px", display:"flex", alignItems:"flex-start", gap:"10px" }}>
                <span style={{ fontSize:"18px", marginTop:"1px" }}>⚠️</span>
                <div>
                  <div style={{ fontWeight:"700", color:T.amber, fontSize:"13px", marginBottom:"4px" }}>
                    {unscheduled.length} active employee{unscheduled.length!==1?" are":" is"} unscheduled in {MONTHS[mo]} {yr}
                  </div>
                  <div style={{ fontSize:"12px", color:T.textSub, lineHeight:1.6 }}>
                    {unscheduled.map(g=>g.name).join(", ")}
                  </div>
                  <div style={{ fontSize:"11px", color:T.textMute, marginTop:"4px" }}>
                    Go to the 🔁 Schedules tab to create a recurring schedule, or click a day on the calendar to add them manually.
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display:"grid", gridTemplateColumns:sel?"1fr 320px":"1fr", gap:"14px", alignItems:"start" }}>
          <div style={S.card}>
            <F style={{ justifyContent:"space-between", marginBottom:"8px" }}>
              <button style={S.bo} onClick={prev}>‹</button>
              <span style={{ fontSize:"14px", fontWeight:"700", color:"#0f172a" }}>{MONTHS[mo]} {yr}</span>
              <button style={S.bo} onClick={next}>›</button>
            </F>
            {/* Stat holiday indicator for this month */}
            {(() => {
              const statDays = [];
              for (let d=1; d<=dim; d++) {
                const ds = dStr(yr,mo,d);
                if (ovs.some(o=>o.date===ds&&(o.statHours||0)>0)) {
                  statDays.push(d);
                }
              }
              if (!statDays.length) return null;
              return (
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"8px", padding:"7px 12px", marginBottom:"10px", fontSize:"11px", color:"#92400e", display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ fontSize:"14px" }}>⭐</span>
                  <span><strong>Stat holiday hours</strong> recorded on: {statDays.map(d=>`${MONTHS[mo].slice(0,3)} ${d}`).join(", ")}</span>
                </div>
              );
            })()}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px", marginBottom:"3px" }}>{DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:"8px", fontWeight:"700", color:"#94a3b8", padding:"2px" }}>{d}</div>)}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px" }}>
              {cells.map((d,i) => {
                if (!d) return <div key={"e"+i} />;
                const ds = dStr(yr,mo,d);
                const shfts = shiftsOn(ds,guards,scs,ovs);
                const isTod = d===today.getDate()&&mo===today.getMonth()&&yr===today.getFullYear();
                const isSel = d===sel;
                const hasSt = ovs.some(o=>o.date===ds&&(o.statHours||0)>0);
                const hasOv = ovs.some(o=>o.date===ds);
                return (
                  <div key={d} onClick={()=>{setSel(isSel?null:d); setDaySearch("");}} style={{ minHeight:"58px", borderRadius:"5px", padding:"4px", cursor:"pointer", background:isSel?"#eff6ff":isTod?"#eff6ff":"#ffffff", border:`1px solid ${isSel?"#2563eb":isTod?"#bfdbfe":"#e2e8f0"}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                      <span style={{ fontSize:"10px", fontWeight:"700", color:isTod?"#60a5fa":"#475569" }}>{d}</span>
                      <span style={{ fontSize:"7px" }}>{hasSt?"🌟":""}{hasOv?"✎":""}</span>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"2px" }}>{shfts.slice(0,5).map(s=><div key={s.guardId} style={{ width:"6px", height:"6px", borderRadius:"50%", background:gc(gIdx(s.guardId)) }} title={s.guard.name} />)}{shfts.length>5&&<span style={{ fontSize:"7px", color:"#94a3b8" }}>+{shfts.length-5}</span>}</div>
                    {shfts.length>0&&<div style={{ fontSize:"7px", color:"#94a3b8", marginTop:"1px" }}>{shfts.length}g</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {sel && (
            <div>
              <div style={S.card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <div style={S.ct}>{DAYS[selDow]}, {MONTHS[mo]} {sel}</div>
                  <span style={{ fontSize:"9px", color:T.textMute }}>{allOn.length} on duty</span>
                </div>
                {allOn.length > 0 && (
                  <input
                    style={{ ...S.inp, marginBottom:"12px" }}
                    placeholder="Search employee…"
                    value={daySearch}
                    onChange={e => setDaySearch(e.target.value)}
                  />
                )}
                {allOn.length===0 && <div style={{ ...S.empty, padding:"10px" }}>No employees scheduled.</div>}

                {allOn.length > 0 && (() => {
                  const filtered = allOn.filter(g => g.name.toLowerCase().includes(daySearch.toLowerCase()));
                  if (filtered.length === 0) return (
                    <div style={{ fontSize:"11px", color:T.textMute, textAlign:"center", padding:"10px 0" }}>No employees match "{daySearch}"</div>
                  );

                  // Group by location
                  const groups = {};
                  filtered.forEach(g => {
                    const sh = effShift(selDs, g.id, scs, ovs);
                    const locId = sh?.locationId || "__none__";
                    if (!groups[locId]) groups[locId] = { locId, employees:[] };
                    groups[locId].employees.push({ g, sh });
                  });

                  return Object.values(groups).map(({ locId, employees }) => {
                    const loc = locs.find(l => l.id === locId);
                    const locLabel = loc ? (loc.name || loc.client) : "No Location";
                    const locColor = locId === "__none__" ? T.textMute : gc(locs.findIndex(l=>l.id===locId) % 7);
                    return (
                      <div key={locId} style={{ marginBottom:"10px" }}>
                        {/* location header bubble */}
                        <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"6px" }}>
                          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:locColor, flexShrink:0 }}/>
                          <div style={{ fontSize:"10px", fontWeight:"700", color:locColor, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                            {locLabel}
                          </div>
                          <div style={{ flex:1, height:"1px", background:`${locColor}22` }}/>
                          <div style={{ fontSize:"9px", color:T.textMute }}>{employees.length} emp.</div>
                        </div>
                        {/* employee chips grid */}
                        <div style={{ display:"flex", flexDirection:"column", gap:"5px", paddingLeft:"15px" }}>
                          {employees.map(({ g, sh }) => {
                            const ov = ovs.find(o=>o.date===selDs&&o.guardId===g.id);
                            const idx = gIdx(g.id);
                            const reg = sh?.regularHours||sh?.hours||0;
                            const stat = sh?.statHours||0;
                            return (
                              <div key={g.id} style={{ background:"rgba(255,255,255,0.7)", borderRadius:"8px", padding:"7px 10px", border:`1px solid ${locColor}22`, display:"flex", alignItems:"center", gap:"8px" }}>
                                {/* avatar */}
                                <div style={{ width:"26px", height:"26px", borderRadius:"6px", background:`${gc(idx)}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:"700", color:gc(idx), flexShrink:0 }}>
                                  {g.name.split(" ").map(x=>x[0]).join("").slice(0,2)}
                                </div>
                                {/* name + shift */}
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:"12px", fontWeight:"600", color:T.text }}>{g.name}</div>
                                  <div style={{ fontSize:"10px", color:T.textMute }}>
                                    {sh?.absent ? "Absent" : `${sh?.startTime||""}${sh?.endTime?"–"+sh.endTime:""}`}
                                    {reg>0 && ` · ${reg}h`}
                                    {stat>0 && ` · ${stat}h★`}
                                    {ov && <span style={{ color:T.green, marginLeft:"4px" }}>✎ adj</span>}
                                  </div>
                                </div>
                                {/* actions */}
                                {!isGuest && (
                                  <div style={{ display:"flex", gap:"4px" }}>
                                    <button style={{ ...S.bsm(T.blue), fontSize:"10px", padding:"3px 8px" }} onClick={()=>openAdj(g)}>Adjust</button>
                                    {ov && <button style={{ ...S.bsm(T.red), fontSize:"10px", padding:"3px 8px" }} onClick={()=>remAdj(g.id)}>Reset</button>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}

                {!isGuest && <div style={{ marginTop:"10px", borderTop:`1px solid ${T.border}`, paddingTop:"10px" }}>
                  <label style={S.lbl}>Add employee for this day</label>
                  <select style={S.sel} value="" onChange={e=>{ if(e.target.value){ const g=guards.find(x=>x.id===e.target.value); if(g) openAdj(g); } }}><option value="">Select…</option>{unsch.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
                </div>}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════
function Reports({ guards, locs, scs, ovs, history, setHistory, addLog, isGuest, sd, setSd, ed, setEd, sl, setSl }) {
  const gIdx = id => guards.findIndex(g=>g.id===id);

  function buildRpt(lid) {
    const start=pDate(sd),end=pDate(ed); const gm={};
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      const ds=d.toISOString().slice(0,10);
      shiftsOn(ds,guards,scs,ovs).filter(s=>s.locationId===lid).forEach(s=>{
        if(!gm[s.guardId])gm[s.guardId]={name:s.guard.name,regular:0,stat:0,days:[]};
        const r=s.regularHours||s.hours||0,st=s.statHours||0;
        gm[s.guardId].regular+=r; gm[s.guardId].stat+=st;
        gm[s.guardId].days.push({date:ds,startTime:s.startTime,endTime:s.endTime,regular:r,stat:st});
      });
    }
    return gm;
  }

  function doExcel(l) {
    const gm=buildRpt(l.id); const rows=[];
    Object.entries(gm).forEach(([,g])=>g.days.forEach(d=>rows.push([d.date,g.name,d.startTime||"",d.endTime||"",d.regular,d.stat,d.regular+d.stat])));
    mkCSV(`${l.name}_${sd}_${ed}`,["Date","Employee","Start","End","Regular Hrs","Stat Hrs","Total Hrs"],rows);
  }

  function saveHist() {
    const e={id:uid(),savedAt:new Date().toISOString(),startDate:sd,endDate:ed,data:locs.map(l=>({locationId:l.id,locationName:l.name,client:l.client||"",guards:buildRpt(l.id)}))};
    const u=[e,...history].slice(0,50); setHistory(u); save(K.hi,u);
    addLog("Created","Saved Report",`Saved report: ${sd} → ${ed}`,`${shown.length} location${shown.length!==1?"s":""}`);
    alert("Saved to History!");
  }

  const shown = sl==="all" ? locs : locs.filter(l=>l.id===sl);
  return (
    <div>
      <div style={S.card}>
        <div style={S.ct}>Report Settings</div>
        <F style={{ alignItems:"flex-end", flexWrap:"wrap" }}>
          <Inp label="Start Date" type="date" value={sd} onChange={e=>setSd(e.target.value)} />
          <Inp label="End Date" type="date" value={ed} onChange={e=>setEd(e.target.value)} />
          <Sel label="Location" value={sl} onChange={e=>setSl(e.target.value)}><option value="all">All Locations</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Sel>
          {!isGuest && <button style={{ ...S.bs, marginTop:"13px" }} onClick={saveHist}>💾 Save to History</button>}
        </F>
      </div>
      {shown.length===0&&<div style={S.card}><div style={S.empty}>No locations added yet.</div></div>}

      {/* ── EMPLOYEE TOTALS SUMMARY (only when viewing all locations) ── */}
      {sl==="all" && shown.length > 0 && (() => {
        // Aggregate hours across all locations per employee
        const empTotals = {};
        shown.forEach(l => {
          const gm = buildRpt(l.id);
          Object.entries(gm).forEach(([gid, g]) => {
            if (!empTotals[gid]) empTotals[gid] = { name:g.name, regular:0, stat:0, locations:[], days:[] };
            empTotals[gid].regular += g.regular;
            empTotals[gid].stat    += g.stat;
            if (!empTotals[gid].locations.includes(l.name)) empTotals[gid].locations.push(l.name);
            empTotals[gid].days = [...empTotals[gid].days, ...(g.days||[])];
          });
        });
        const entries = Object.entries(empTotals).filter(([,g])=>g.regular+g.stat>0)
          .sort((a,b)=>b[1].regular+b[1].stat - (a[1].regular+a[1].stat));
        if (!entries.length) return null;
        const multiLoc = entries.some(([,g])=>g.locations.length>1);
        return (
          <div style={{ ...S.card, border:`1px solid ${T.borderHi}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div>
                <div style={{ ...S.ct, fontWeight:"800", fontSize:"13px", color:T.text }}>Employee Totals — All Locations</div>
                {multiLoc && <div style={{ fontSize:"11px", color:T.textMute, marginTop:"-8px" }}>Some employees worked at multiple locations — hours are combined below.</div>}
              </div>
              <div style={{ fontSize:"12px", color:T.textSub }}>
                {sd} → {ed}
              </div>
            </div>
            <table style={S.tbl}>
              <thead>
                <tr>{["Employee","Location(s)","Regular","Stat ★","Total Hours"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {entries.map(([gid, g]) => {
                  const total = g.regular + g.stat;
                  const multipleLocations = g.locations.length > 1;
                  return (
                    <tr key={gid} style={{ background: multipleLocations ? "#eff6ff" : "transparent" }}>
                      <td style={S.td}>
                        <span style={{ color:gc(gIdx(gid)), fontWeight:"700" }}>{g.name}</span>
                        {multipleLocations && <span style={{ ...S.pill(T.blue), marginLeft:"8px", fontSize:"9px" }}>Multi-site</span>}
                      </td>
                      <td style={{ ...S.td, fontSize:"11px", color:T.textSub }}>
                        {g.locations.join(" · ")}
                      </td>
                      <td style={S.td}>{g.regular.toFixed(2)}h</td>
                      <td style={S.td}>
                        {g.stat > 0
                          ? <span style={{ color:"#d97706", fontWeight:"700" }}>{g.stat.toFixed(2)}h</span>
                          : "—"}
                      </td>
                      <td style={S.td}>
                        <strong style={{ color:T.text, fontSize:"14px" }}>{total.toFixed(2)}h</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* grand total row */}
            <div style={{ display:"flex", gap:"20px", marginTop:"12px", paddingTop:"10px", borderTop:`1px solid ${T.border}`, fontSize:"12px", color:T.textSub, flexWrap:"wrap" }}>
              <span>Total Regular: <strong style={{ color:T.text }}>{entries.reduce((s,[,g])=>s+g.regular,0).toFixed(2)}h</strong></span>
              {entries.some(([,g])=>g.stat>0) && <span>Total Stat: <strong style={{ color:"#d97706" }}>{entries.reduce((s,[,g])=>s+g.stat,0).toFixed(2)}h</strong></span>}
              <span>Grand Total: <strong style={{ color:T.blue }}>{entries.reduce((s,[,g])=>s+g.regular+g.stat,0).toFixed(2)}h</strong></span>
              <span style={{ color:T.textMute }}>{entries.length} employee{entries.length!==1?"s":""}</span>
            </div>
          </div>
        );
      })()}
      {shown.map(l=>{
        const gm=buildRpt(l.id); const ents=Object.entries(gm);
        const tr=ents.reduce((s,[,g])=>s+g.regular,0), ts=ents.reduce((s,[,g])=>s+g.stat,0);
        return(
          <div key={l.id} style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px", flexWrap:"wrap", gap:"8px" }}>
              <div><div style={{ fontSize:"13px", fontWeight:"800", color:"#0f172a" }}>{l.name}</div>{l.client&&<div style={{ fontSize:"9px", color:"#94a3b8" }}>Client: {l.client}</div>}</div>
              <F>
                <div style={{ textAlign:"center" }}><div style={{ fontSize:"14px", fontWeight:"800", color:"#60a5fa" }}>{tr.toFixed(2)}h</div><div style={{ fontSize:"8px", color:"#94a3b8" }}>Regular</div></div>
                {ts>0&&<div style={{ textAlign:"center" }}><div style={{ fontSize:"14px", fontWeight:"800", color:"#fbbf24" }}>{ts.toFixed(2)}h</div><div style={{ fontSize:"8px", color:"#94a3b8" }}>Stat ★</div></div>}
                <div style={{ textAlign:"center" }}><div style={{ fontSize:"14px", fontWeight:"800", color:"#34d399" }}>{(tr+ts).toFixed(2)}h</div><div style={{ fontSize:"8px", color:"#94a3b8" }}>Total</div></div>
                <button style={S.bs} onClick={()=>doExcel(l)}>📊 Excel</button>
              </F>
            </div>
            {ents.length===0 ? <div style={S.empty}>No hours.</div> : (
              <table style={S.tbl}>
                <thead><tr>{["Employee","Days Worked","Regular","Stat ★","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {ents.map(([gid,g]) => {
                    // Format dates adaptively based on how many days there are
                    const days = (g.days||[]).sort((a,b)=>a.date.localeCompare(b.date));
                    const dayStr = (() => {
                      if (!days.length) return "—";
                      const count = days.length;
                      const first = new Date(days[0].date+"T00:00:00");
                      const last  = new Date(days[days.length-1].date+"T00:00:00");
                      const fmt = d => d.toLocaleString("en-CA",{month:"short",day:"numeric"});
                      if (count <= 10) {
                        // Show individual dates grouped by month
                        const groups = {};
                        days.forEach(d => {
                          const dt = new Date(d.date+"T00:00:00");
                          const key = `${dt.getFullYear()}-${dt.getMonth()}`;
                          const label = dt.toLocaleString("en-CA",{month:"short"});
                          if (!groups[key]) groups[key] = { label, nums:[] };
                          groups[key].nums.push(dt.getDate());
                        });
                        return Object.values(groups).map(g=>`${g.label} ${g.nums.join(", ")}`).join(" · ");
                      } else if (count <= 20) {
                        // Show count + date range
                        return `${count} days · ${fmt(first)} – ${fmt(last)}`;
                      } else {
                        // Show count + range only
                        const yr = first.getFullYear()!==last.getFullYear() ? ` ${last.getFullYear()}`:"";
                        return `${count} days · ${fmt(first)} – ${fmt(last)}${yr}`;
                      }
                    })();
                    return (
                      <tr key={gid}>
                        <td style={S.td}><span style={{ color:gc(gIdx(gid)), fontWeight:"700" }}>{g.name}</span></td>
                        <td style={{ ...S.td, fontSize:"11px", color:T.textSub, maxWidth:"260px" }}>{dayStr}</td>
                        <td style={S.td}>{g.regular.toFixed(2)}h</td>
                        <td style={S.td}>{g.stat>0?<span style={{ color:"#d97706", fontWeight:"700" }}>{g.stat.toFixed(2)}h</span>:"—"}</td>
                        <td style={S.td}><strong style={{ color:T.text }}>{(g.regular+g.stat).toFixed(2)}h</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
function History({ history, setHistory, addLog, isGuest }) {
  const [exp, setExp] = useState(null);
  const [confirmEl, ask] = useConfirm();
  const del = id => ask("Delete this saved report?", ()=>{
    const h=history.find(x=>x.id===id);
    const u=history.filter(h=>h.id!==id); setHistory(u); save(K.hi,u); if(exp===id)setExp(null);
    addLog("Deleted","Saved Report",`Deleted saved report: ${h?.startDate||""} → ${h?.endDate||""}`);
  });
  function doExcel(h) {
    const rows=[];
    h.data.forEach(l=>Object.values(l.guards).forEach(g=>(g.days||[]).forEach(d=>rows.push([h.startDate,h.endDate,l.locationName,l.client||"",g.name,d.date,d.startTime||"",d.endTime||"",d.regular,d.stat,d.regular+d.stat]))));
    if(!rows.length) h.data.forEach(l=>Object.values(l.guards).forEach(g=>rows.push([h.startDate,h.endDate,l.locationName,l.client||"",g.name,"","","",g.regular,g.stat,g.regular+g.stat])));
    mkCSV(`history_${h.startDate}_${h.endDate}`,["Period Start","Period End","Location","Client","Employee","Date","Start","End","Regular","Stat","Total"],rows);
  }
  if (!history.length) return <div style={S.card}><div style={S.empty}>No saved reports. Save from the Reports page.</div></div>;
  return (
    <div>
      {confirmEl}
      {history.map(h => {
        const tot=h.data.reduce((s,l)=>s+Object.values(l.guards).reduce((s2,g)=>s2+g.regular+g.stat,0),0);
        const open=exp===h.id;
        return (
          <div key={h.id} style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }} onClick={()=>setExp(open?null:h.id)}>
              <div><div style={{ fontWeight:"700", color:"#0f172a", fontSize:"12px" }}>{h.startDate} → {h.endDate}</div><div style={{ fontSize:"9px", color:"#94a3b8", marginTop:"2px" }}>Saved {new Date(h.savedAt).toLocaleString()} · {h.data.length} loc · {tot.toFixed(2)}h</div></div>
              <F><span style={{ fontSize:"14px", fontWeight:"800", color:"#60a5fa" }}>{tot.toFixed(2)}h</span><button style={S.bs} onClick={e=>{e.stopPropagation();doExcel(h);}}>📊</button>{!isGuest && <button style={S.bd} onClick={e=>{e.stopPropagation();del(h.id);}}>Delete</button>}<span style={{ color:"#94a3b8" }}>{open?"▲":"▼"}</span></F>
            </div>
            {open&&<div style={{ marginTop:"10px", borderTop:"1px solid #e2e8f0", paddingTop:"10px" }}>
              {h.data.map(l=>{const ents=Object.entries(l.guards);if(!ents.length)return null;const lr=ents.reduce((s,[,g])=>s+g.regular,0),ls=ents.reduce((s,[,g])=>s+g.stat,0);return(<div key={l.locationId} style={{ marginBottom:"10px" }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}><span style={{ fontWeight:"700", color:"#3b82f6", fontSize:"11px" }}>{l.locationName}{l.client?" · "+l.client:""}</span><span style={{ fontSize:"9px", color:"#475569" }}>{lr.toFixed(2)}h reg{ls>0?" + "+ls.toFixed(2)+"h stat":""}</span></div><table style={S.tbl}><thead><tr>{["Employee","Regular","Stat","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{ents.map(([gid,g])=><tr key={gid}><td style={S.td}>{g.name}</td><td style={S.td}>{g.regular.toFixed(2)}h</td><td style={S.td}>{g.stat>0?<span style={{ color:"#fbbf24" }}>{g.stat.toFixed(2)}h ★</span>:"—"}</td><td style={S.td}><strong>{(g.regular+g.stat).toFixed(2)}h</strong></td></tr>)}</tbody></table></div>);})}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE
// ═══════════════════════════════════════════════════════════════════════════════
function Revenue({ locs, addLog, isGuest }) {
  const [pays, setPays] = useState([]);
  const [invs, setInvs] = useState([]);
  const [rdy, setRdy] = useState(false);
  const [fCl, setFCl] = useState("all");
  const [fSd, setFSd] = useState(`${new Date().getFullYear()}-01-01`);
  const [fEd, setFEd] = useState(todayStr());
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { locationId:"", clientName:"", billingStart:"", billingEnd:"", amountBilled:"", received:false, depositDate:"", notes:"", fromInvoice:false };
  const [form, setForm] = useState(blank);
  const [confirmEl, ask] = useConfirm();

  useEffect(() => {
    (async () => {
      const [d, iv] = await Promise.all([load(K.pay), load(K.inv)]);
      if (d) setPays(d);
      if (iv) setInvs(iv);
      setRdy(true);
    })();
  }, []);

  // Listen for invoice changes by polling storage key (simple cross-component sync)
  useEffect(() => {
    const interval = setInterval(async () => {
      const iv = await load(K.inv);
      if (iv) setInvs(iv);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const savePays = u => { setPays(u); save(K.pay, u); };
  const hst  = a => parseFloat(a||0) * 0.13;
  const tot  = a => parseFloat(a||0) + hst(a);
  const clientName = inv => inv.clientName || (locs.find(l=>l.id===inv.clientLocationId)?.client) || (locs.find(l=>l.id===inv.clientLocationId)?.name) || "—";

  // Build merged records: manual pays + invoice-derived entries
  // Invoice entries: paid invoices become received records; outstanding/overdue become pending
  const invoiceRows = invs.map(inv => ({
    id:           "inv_" + inv.id,
    fromInvoice:  true,
    invoiceId:    inv.id,
    invoiceNum:   inv.number,
    locationId:   inv.clientLocationId || "",
    clientName:   clientName(inv),
    billingStart: inv.date || "",
    billingEnd:   inv.dueDate || "",
    amountBilled: String(inv.afterDisc ?? inv.subtotal ?? 0),
    hst:          inv.hstAmt || 0,
    total:        inv.total || 0,
    received:     inv.status === "paid",
    depositDate:  inv.status === "paid" ? (inv.paidDate || inv.date || "") : "",
    notes:        inv.summary || "",
    status:       inv.status,
    currency:     inv.currency || "CAD",
  }));

  // Manual pays that are NOT linked to an invoice
  const manualRows = pays.filter(p => !p.fromInvoice || !invs.find(i => "inv_"+i.id === p.id));

  // Merge: invoice rows take precedence; manual rows fill in the rest
  const allRows = [...invoiceRows, ...manualRows];

  const inRange = r => {
    const s = r.billingStart || "";
    return (!fSd || s >= fSd) && (!fEd || s <= fEd);
  };
  const byClient = r => fCl === "all" || r.locationId === fCl || r.clientName === fCl;
  const filtered = allRows.filter(r => byClient(r) && inRange(r))
    .sort((a,b) => (b.billingStart||"").localeCompare(a.billingStart||""));

  const received    = filtered.filter(r => r.received);
  const pending     = filtered.filter(r => !r.received);
  const totalRcvd   = received.reduce((s,r) => s + (r.total || tot(r.amountBilled)), 0);
  const totalPend   = pending.reduce((s,r)  => s + (r.total || tot(r.amountBilled)), 0);

  function submit() {
    if (!form.amountBilled) return;
    const e = { ...form, id:editing||uid(), hst:hst(form.amountBilled), total:tot(form.amountBilled), fromInvoice:false };
    savePays(editing ? pays.map(p=>p.id===editing?e:p) : [...pays,e]);
    if(editing) addLog("Updated","Revenue",`Updated payment record for ${e.clientName||"—"}`,`$${parseFloat(e.amountBilled||0).toFixed(2)} · ${e.received?"Received":"Pending"}`);
    else addLog("Created","Revenue",`Added manual payment for ${e.clientName||"—"}`,`$${parseFloat(e.amountBilled||0).toFixed(2)}`);
    setForm(blank); setEditing(null); setShow(false);
  }
  function editRow(r) {
    if (r.fromInvoice) { alert("This record comes from an invoice. Edit the invoice directly in the Invoices tab."); return; }
    setForm({...blank,...r}); setEditing(r.id); setShow(true);
  }
  function delRow(r) {
    if (r.fromInvoice) { alert("This record is linked to an invoice. To remove it, delete the invoice in the Invoices tab."); return; }
    ask("Delete this payment record?", () => {
      savePays(pays.filter(p=>p.id!==r.id));
      addLog("Deleted","Revenue",`Deleted payment record for ${r.clientName||"—"}`,`$${parseFloat(r.amountBilled||0).toFixed(2)}`);
    });
  }

  function doExport() {
    mkCSV(`revenue_${fSd}_${fEd}`,
      ["Source","Invoice #","Client","Billing Start","Billing End","Billed","HST","Total","Currency","Status","Deposit Date","Notes"],
      filtered.map(r=>[
        r.fromInvoice?"Invoice":"Manual",
        r.invoiceNum||"",
        r.clientName,
        r.billingStart, r.billingEnd,
        parseFloat(r.amountBilled||0).toFixed(2),
        (r.hst||hst(r.amountBilled)).toFixed(2),
        (r.total||tot(r.amountBilled)).toFixed(2),
        r.currency||"CAD",
        r.received?"Received":"Pending",
        r.depositDate||"", r.notes||""
      ])
    );
  }

  if (!rdy) return <div style={S.card}><div style={S.empty}>Loading…</div></div>;

  return (
    <div>
      {confirmEl}

      {/* stats */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
        {[
          ["Total Records", filtered.length, T.text],
          ["Received",      received.length, T.green],
          ["Pending",       pending.length,  T.amber],
          ["Collected",     "$"+totalRcvd.toFixed(2), T.green],
          ["Pending Value", "$"+totalPend.toFixed(2), T.amber],
        ].map(([l,v,c]) => <Stat key={l} label={l} value={v} color={c} />)}
      </div>

      {/* filter bar */}
      <div style={S.card}>
        <div style={S.ct}>Revenue Summary</div>
        <F style={{ alignItems:"flex-end", flexWrap:"wrap" }}>
          <Inp label="Period Start" type="date" value={fSd} onChange={e=>setFSd(e.target.value)}/>
          <Inp label="Period End"   type="date" value={fEd} onChange={e=>setFEd(e.target.value)}/>
          <Sel label="Client" value={fCl} onChange={e=>setFCl(e.target.value)}>
            <option value="all">All Clients</option>
            {locs.map(l=><option key={l.id} value={l.id}>{l.client||l.name}</option>)}
          </Sel>
          <button style={{ ...S.bs, marginTop:"13px" }} onClick={doExport}>📊 Export Excel</button>
          {!isGuest && <button style={{ ...S.bp, marginTop:"13px" }} onClick={()=>{setForm(blank);setEditing(null);setShow(s=>!s);}}>+ Add Manual Entry</button>}
        </F>
        {/* revenue & HST stats for the selected period */}
        <div style={{ display:"flex", gap:"9px", marginTop:"14px", flexWrap:"wrap" }}>
          {(()=>{
            const periodRows = allRows.filter(r => byClient(r) && inRange(r));
            const rcvdRows   = periodRows.filter(r => r.received);
            const pendRows   = periodRows.filter(r => !r.received);
            const revTotal   = rcvdRows.reduce((s,r)=>s+(r.total||tot(r.amountBilled)),0);
            const hstTotal   = rcvdRows.reduce((s,r)=>s+(r.hst||hst(r.amountBilled)),0);
            const pendTotal  = pendRows.reduce((s,r)=>s+(r.total||tot(r.amountBilled)),0);
            return [
              ["Revenue Collected", "$"+revTotal.toFixed(2),  T.green],
              ["HST Collected",     "$"+hstTotal.toFixed(2),  T.purple],
              ["Pending",           "$"+pendTotal.toFixed(2), T.amber],
              ["Total Records",     periodRows.length,         T.text],
            ].map(([l,v,c])=>(
              <div key={l} style={{ ...S.stat, flex:"1", minWidth:"120px", borderTop:`3px solid ${c}` }}>
                <div style={{ ...S.sn, color:c, fontSize:"18px" }}>{v}</div>
                <div style={S.sl}>{l}{fCl!=="all" ? " — Client" : ""}</div>
              </div>
            ));
          })()}
        </div>
        <div style={{ fontSize:"11px", color:T.textMute, marginTop:"10px" }}>
          💡 Invoice records appear automatically. Use "Add Manual Entry" only for payments that don't have an invoice.
        </div>
      </div>

      {/* manual entry form */}
      {!isGuest && show && (
        <div style={{ ...S.card, border:`1px solid ${T.blue}` }}>
          <div style={S.ct}>{editing ? "Edit Manual Entry" : "New Manual Payment Entry"}</div>
          <div style={S.g3}>
            <Sel label="Client" value={form.locationId} onChange={e=>{const l=locs.find(x=>x.id===e.target.value);setForm(p=>({...p,locationId:e.target.value,clientName:l?l.client||l.name:p.clientName}));}}>
              <option value="">Select…</option>
              {locs.map(l=><option key={l.id} value={l.id}>{l.client||l.name}</option>)}
            </Sel>
            <Inp label="Client Name (override)" value={form.clientName} onChange={e=>setForm(p=>({...p,clientName:e.target.value}))} placeholder="Auto-filled"/>
            <Inp label="Amount Billed ($)" type="number" step="0.01" value={form.amountBilled} onChange={e=>setForm(p=>({...p,amountBilled:e.target.value}))} placeholder="0.00"/>
          </div>
          {form.amountBilled && (
            <div style={{ fontSize:"12px", color:T.textSub, margin:"8px 0" }}>
              HST (13%): <strong style={{ color:T.text }}>${hst(form.amountBilled).toFixed(2)}</strong>
              &nbsp;&nbsp; Total: <strong style={{ color:T.green }}>${tot(form.amountBilled).toFixed(2)}</strong>
            </div>
          )}
          <div style={{ ...S.g4, marginTop:"8px" }}>
            <Inp label="Billing Period Start" type="date" value={form.billingStart} onChange={e=>setForm(p=>({...p,billingStart:e.target.value}))}/>
            <Inp label="Billing Period End"   type="date" value={form.billingEnd}   onChange={e=>setForm(p=>({...p,billingEnd:e.target.value}))}/>
            <Inp label="Deposit Date"         type="date" value={form.depositDate}  onChange={e=>setForm(p=>({...p,depositDate:e.target.value}))}/>
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
              <label style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:T.green, cursor:"pointer", paddingBottom:"8px" }}>
                <input type="checkbox" checked={form.received} onChange={e=>setForm(p=>({...p,received:e.target.checked}))} style={{ width:"14px", height:"14px" }}/>
                Payment Received
              </label>
            </div>
          </div>
          <div style={{ marginTop:"8px" }}><label style={S.lbl}>Notes</label><textarea style={S.ta} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional…"/></div>
          <F style={{ marginTop:"10px" }}>
            <button style={S.bp} onClick={submit}>Save</button>
            <button style={S.bo} onClick={()=>{setShow(false);setEditing(null);}}>Cancel</button>
          </F>
        </div>
      )}

      {/* records table */}
      <div style={S.card}>
        <div style={S.ct}>Revenue Records ({filtered.length})</div>
        {filtered.length === 0 ? (
          <div style={S.empty}>No records for the selected filters.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={S.tbl}>
              <thead>
                <tr>{["Source","Client","Billing Period","Billed","HST","Total","Status","Deposit Date",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isInv = r.fromInvoice;
                  const rowBg = r.received ? "#f0fdf4" : r.status==="overdue" ? "#fef2f2" : "transparent";
                  const statusCol = r.received ? T.green : r.status==="overdue" ? T.red : T.amber;
                  const statusLabel = r.received ? "Received" : r.status==="overdue" ? "Overdue" : "Pending";
                  return (
                    <tr key={r.id} style={{ background:rowBg }}>
                      <td style={S.td}>
                        <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                          <span style={S.pill(isInv ? T.blue : T.purple)}>{isInv ? "Invoice" : "Manual"}</span>
                          {isInv && r.invoiceNum && <span style={{ fontSize:"10px", color:T.textMute }}>{r.invoiceNum}</span>}
                        </div>
                      </td>
                      <td style={S.td}><strong style={{ color:T.text }}>{r.clientName}</strong></td>
                      <td style={S.td}>
                        <span style={{ fontSize:"11px" }}>
                          {r.billingStart||"—"}{r.billingEnd && r.billingEnd!==r.billingStart ? ` → ${r.billingEnd}` : ""}
                        </span>
                      </td>
                      <td style={S.td}>{r.currency||"CAD"} ${parseFloat(r.amountBilled||0).toFixed(2)}</td>
                      <td style={S.td}>${(r.hst||hst(r.amountBilled)).toFixed(2)}</td>
                      <td style={S.td}><strong style={{ color:T.green }}>${(r.total||tot(r.amountBilled)).toFixed(2)}</strong></td>
                      <td style={S.td}><span style={S.pill(statusCol)}>{statusLabel}</span></td>
                      <td style={S.td}>{r.depositDate||"—"}</td>
                      <td style={S.td}>
                        <F>
                          {!isGuest && !isInv && <button style={S.bsm(T.blue)} onClick={()=>editRow(r)}>Edit</button>}
                          {isInv && <span style={{ fontSize:"10px", color:T.textMute }}>via Invoice</span>}
                          {!isGuest && <button style={S.bd} onClick={()=>delRow(r)}>✕</button>}
                        </F>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div style={{ marginTop:"12px", borderTop:`1px solid ${T.border}`, paddingTop:"10px", display:"flex", gap:"16px", fontSize:"11px", flexWrap:"wrap", color:T.textSub }}>
            <span>Billed: <strong style={{ color:T.text }}>${filtered.reduce((s,r)=>s+parseFloat(r.amountBilled||0),0).toFixed(2)}</strong></span>
            <span>HST: <strong style={{ color:T.text }}>${filtered.reduce((s,r)=>s+(r.hst||hst(r.amountBilled)),0).toFixed(2)}</strong></span>
            <span>Total: <strong style={{ color:T.green }}>${filtered.reduce((s,r)=>s+(r.total||tot(r.amountBilled)),0).toFixed(2)}</strong></span>
            <span>Collected: <strong style={{ color:T.green }}>${received.reduce((s,r)=>s+(r.total||tot(r.amountBilled)),0).toFixed(2)}</strong></span>
            <span>Pending: <strong style={{ color:T.amber }}>${pending.reduce((s,r)=>s+(r.total||tot(r.amountBilled)),0).toFixed(2)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════════
const STAGES = ["New Lead","Contacted","Meeting Scheduled","Proposal Sent","Negotiation","Signed Contract","Lost"];
const SCOL = { "New Lead":"#3b82f6","Contacted":"#06b6d4","Meeting Scheduled":"#8b5cf6","Proposal Sent":"#f59e0b","Negotiation":"#f97316","Signed Contract":"#10b981","Lost":"#6b7280" };
const SICO = { "New Lead":"🆕","Contacted":"📞","Meeting Scheduled":"📅","Proposal Sent":"📄","Negotiation":"🤝","Signed Contract":"✅","Lost":"❌" };

function Sales({ addLog, isGuest }) {
  const [leads, setLeads] = useState([]); const [rdy, setRdy] = useState(false);
  const [view, setView] = useState("board"); const [editing, setEditing] = useState(null);
  const [fStage, setFStage] = useState("all"); const [srch, setSrch] = useState("");
  const blank = { companyName:"", contactName:"", phone:"", email:"", address:"", serviceType:"", estimatedValue:"", stage:"New Lead", priority:"Medium", source:"", notes:"", nextAction:"", nextActionDate:"", createdAt:"", contractDate:"" };
  const [form, setForm] = useState(blank);
  const [confirmEl, ask] = useConfirm();
  useEffect(()=>{(async()=>{const d=await load(K.leads);if(d)setLeads(d);setRdy(true);})();},[]);
  const saveLeads = u => { setLeads(u); save(K.leads,u); };
  const ff = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const startNew = () => { setForm({...blank,createdAt:todayStr()}); setEditing(null); setView("form"); };
  const startEdit = l => { setForm({...blank,...l}); setEditing(l.id); setView("form"); };
  function submit() {
    if (!form.companyName.trim()) return;
    const e={...form,id:editing||uid(),createdAt:form.createdAt||todayStr()};
    saveLeads(editing?leads.map(l=>l.id===editing?e:l):[...leads,e]);
    if(editing) addLog("Updated","Sales",`Updated lead: ${e.companyName}`,`Stage: ${e.stage}`);
    else addLog("Created","Sales",`Added new lead: ${e.companyName}`,`Stage: ${e.stage}${e.estimatedValue?" · $"+e.estimatedValue+"/mo":""}`);
    setEditing(null); setView("board");
  }
  const del = id => ask("Delete this lead? This cannot be undone.", ()=>{
    const l=leads.find(x=>x.id===id);
    saveLeads(leads.filter(l=>l.id!==id));
    addLog("Deleted","Sales",`Deleted lead: ${l?.companyName||"Unknown"}`);
  });
  const advance = id => { const l=leads.find(x=>x.id===id); if(!l)return; const i=STAGES.indexOf(l.stage); if(i<STAGES.length-2) saveLeads(leads.map(x=>x.id===id?{...x,stage:STAGES[i+1],contractDate:STAGES[i+1]==="Signed Contract"?todayStr():x.contractDate}:x)); };
  const fLeads = leads.filter(l=>(fStage==="all"||l.stage===fStage)&&(srch===""||l.companyName.toLowerCase().includes(srch.toLowerCase())||l.contactName.toLowerCase().includes(srch.toLowerCase())));
  const signed = leads.filter(l=>l.stage==="Signed Contract");
  const active = leads.filter(l=>l.stage!=="Lost"&&l.stage!=="Signed Contract");
  if (!rdy) return <div style={S.card}><div style={S.empty}>Loading…</div></div>;
  return (
    <div>
      {confirmEl}
      <F style={{ marginBottom:"12px", flexWrap:"wrap" }}>
        {[["Total Leads",leads.length,"#0f172a"],["Active",active.length,"#3b82f6"],["Signed",signed.length,"#10b981"],["Pipeline","$"+active.reduce((s,l)=>s+parseFloat(l.estimatedValue||0),0).toFixed(0),"#f59e0b"],["Won","$"+signed.reduce((s,l)=>s+parseFloat(l.estimatedValue||0),0).toFixed(0),"#10b981"]].map(([l,v,c])=><Stat key={l} label={l} value={v} color={c}/>)}
      </F>
      <div style={S.card}>
        <F style={{ flexWrap:"wrap" }}>
          {!isGuest && <button style={S.bp} onClick={startNew}>+ New Lead</button>}
          {[["board","🗂 Board"],["list","☰ List"]].map(([v,l])=><button key={v} style={{ ...S.bo, background:view===v?"#172a45":"transparent", color:view===v?"#0f172a":"#4a8ab0" }} onClick={()=>setView(v)}>{l}</button>)}
          <input style={{ ...S.inp, width:"150px" }} placeholder="Search…" value={srch} onChange={e=>setSrch(e.target.value)}/>
          <select style={{ ...S.sel, width:"150px" }} value={fStage} onChange={e=>setFStage(e.target.value)}><option value="all">All Stages</option>{STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select>
{!isGuest &&           <button style={S.bs} onClick={()=>mkCSV("sales_leads",["Company","Contact","Phone","Email","Stage","Priority","Source","Service","Value","Next Action","Next Action Date","Created","Contract Date","Notes"],leads.map(l=>[l.companyName,l.contactName,l.phone,l.email,l.stage,l.priority,l.source,l.serviceType,l.estimatedValue,l.nextAction,l.nextActionDate,l.createdAt,l.contractDate,l.notes]))}>📊 Export</button>}
        </F>
      </div>

      {view==="board"&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:"10px", alignItems:"start" }}>
          {STAGES.map(stage=>{
            const c=SCOL[stage]; const sl=fLeads.filter(l=>l.stage===stage);
            return(
              <div key={stage} style={{ background:"#ffffff", borderRadius:"8px", border:`1px solid ${c}33`, overflow:"hidden" }}>
                <div style={{ background:c+"22", padding:"7px 10px", borderBottom:`1px solid ${c}33`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"9px", fontWeight:"700", color:c }}>{SICO[stage]} {stage}</span>
                  <span style={{ background:c, color:"#fff", borderRadius:"9px", padding:"1px 6px", fontSize:"9px", fontWeight:"700" }}>{sl.length}</span>
                </div>
                <div style={{ padding:"6px", minHeight:"50px" }}>
                  {sl.length===0&&<div style={{ fontSize:"9px", color:"#94a3b8", textAlign:"center", padding:"10px 0" }}>No leads</div>}
                  {sl.map(l=>(
                    <div key={l.id} style={{ background:"#f8faff", borderRadius:"5px", padding:"8px", marginBottom:"5px", borderLeft:`3px solid ${c}`, cursor:"pointer" }} onClick={()=>startEdit(l)}>
                      <div style={{ fontWeight:"700", color:"#0f172a", fontSize:"10px", marginBottom:"2px" }}>{l.companyName}</div>
                      {l.contactName&&<div style={{ fontSize:"9px", color:"#475569" }}>👤 {l.contactName}</div>}
                      {l.estimatedValue&&<div style={{ fontSize:"9px", color:"#34d399" }}>💰 ${parseFloat(l.estimatedValue).toLocaleString()}/mo</div>}
                      {l.nextActionDate&&<div style={{ fontSize:"8px", color:"#f59e0b" }}>📅 {l.nextActionDate}</div>}
                      {l.priority&&<div style={{ marginTop:"3px" }}><span style={S.pill(l.priority==="High"?"#ef4444":l.priority==="Medium"?"#f59e0b":"#3b82f6")}>{l.priority}</span></div>}
                      {!isGuest && stage!=="Signed Contract"&&stage!=="Lost"&&<button style={{ ...S.bsm(c), marginTop:"5px", width:"100%", textAlign:"center", fontSize:"8px" }} onClick={e=>{e.stopPropagation();advance(l.id);}}>→ {STAGES[STAGES.indexOf(stage)+1]}</button>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view==="list"&&(
        <div style={S.card}>
          <div style={S.ct}>All Leads ({fLeads.length})</div>
          {fLeads.length===0?<div style={S.empty}>No leads.</div>:<div style={{ overflowX:"auto" }}><table style={S.tbl}><thead><tr>{["Company","Contact","Phone","Stage","Priority","Value","Next Action","Created",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{fLeads.map(l=>{const c=SCOL[l.stage]||"#6b7280";return(<tr key={l.id}><td style={S.td}><span style={{ color:"#0f172a", fontWeight:"700", cursor:"pointer" }} onClick={()=>startEdit(l)}>{l.companyName}</span>{l.email&&<div style={{ fontSize:"9px", color:"#94a3b8" }}>{l.email}</div>}</td><td style={S.td}>{l.contactName||"—"}</td><td style={S.td}>{l.phone||"—"}</td><td style={S.td}><span style={S.pill(c)}>{SICO[l.stage]} {l.stage}</span></td><td style={S.td}><span style={S.pill(l.priority==="High"?"#ef4444":l.priority==="Medium"?"#f59e0b":"#3b82f6")}>{l.priority||"—"}</span></td><td style={S.td}>{l.estimatedValue?`$${parseFloat(l.estimatedValue).toLocaleString()}`:""}</td><td style={S.td}><div style={{ fontSize:"10px" }}>{l.nextAction||"—"}</div>{l.nextActionDate&&<div style={{ fontSize:"9px", color:"#f59e0b" }}>{l.nextActionDate}</div>}</td><td style={S.td}>{l.createdAt||"—"}</td><td style={S.td}><F>{!isGuest && <button style={S.bsm("#60a5fa")} onClick={()=>startEdit(l)}>Edit</button>}{!isGuest && <button style={S.bd} onClick={()=>del(l.id)}>✕</button>}</F></td></tr>);})}</tbody></table></div>}
        </div>
      )}

      {view==="form"&&(
        <div style={{ ...S.card, border:"1px solid #bfdbfe" }}>
          <div style={S.ct}>{editing?"Edit Lead":"New Lead"}</div>
          <div style={S.g3}><Inp label="Company Name *" value={form.companyName} onChange={ff("companyName")} placeholder="ABC Security Ltd"/><Inp label="Contact Name" value={form.contactName} onChange={ff("contactName")}/><Inp label="Phone" type="tel" value={form.phone} onChange={ff("phone")}/></div>
          <div style={{ ...S.g3, marginTop:"8px" }}><Inp label="Email" type="email" value={form.email} onChange={ff("email")}/><Inp label="Address" value={form.address} onChange={ff("address")}/><Inp label="Lead Source" value={form.source} onChange={ff("source")} placeholder="Referral, Cold Call…"/></div>
          <div style={{ ...S.g4, marginTop:"8px" }}>
            <Inp label="Service Type" value={form.serviceType} onChange={ff("serviceType")} placeholder="Mobile Patrol…"/>
            <Inp label="Est. Value ($/mo)" type="number" step="100" value={form.estimatedValue} onChange={ff("estimatedValue")}/>
            <Sel label="Priority" value={form.priority} onChange={ff("priority")}><option>High</option><option>Medium</option><option>Low</option></Sel>
            <Sel label="Stage" value={form.stage} onChange={ff("stage")}>{STAGES.map(s=><option key={s} value={s}>{s}</option>)}</Sel>
          </div>
          {form.stage==="Signed Contract"&&<div style={{ marginTop:"8px", maxWidth:"200px" }}><Inp label="Contract Signed Date" type="date" value={form.contractDate} onChange={ff("contractDate")} style={{ borderColor:"#059669" }}/></div>}
          <div style={{ ...S.g2, marginTop:"8px" }}><Inp label="Next Action" value={form.nextAction} onChange={ff("nextAction")} placeholder="Follow up call…"/><Inp label="Next Action Date" type="date" value={form.nextActionDate} onChange={ff("nextActionDate")}/></div>
          <div style={{ marginTop:"8px" }}><label style={S.lbl}>Notes</label><textarea style={S.ta} value={form.notes} onChange={ff("notes")} placeholder="Lead details, requirements, conversations…"/></div>
          <div style={{ marginTop:"10px", padding:"10px", background:"#f8faff", borderRadius:"6px" }}>
            <div style={{ fontSize:"9px", color:"#94a3b8", marginBottom:"6px", fontWeight:"700", textTransform:"uppercase" }}>Quick Stage</div>
            <F style={{ flexWrap:"wrap" }}>{STAGES.map(s=><button key={s} onClick={()=>setForm(p=>({...p,stage:s}))} style={{ padding:"3px 8px", borderRadius:"4px", cursor:"pointer", fontSize:"8px", fontWeight:"700", background:form.stage===s?SCOL[s]:"transparent", color:form.stage===s?"#fff":SCOL[s], border:`1px solid ${SCOL[s]}66` }}>{SICO[s]} {s}</button>)}</F>
          </div>
          <F style={{ marginTop:"10px" }}>
            <button style={S.bp} onClick={submit}>Save Lead</button>
            <button style={S.bo} onClick={()=>setView(editing?"list":"board")}>Cancel</button>
            {editing&&<button style={S.bd} onClick={()=>{ask("Delete this lead?",()=>{del(editing);setView("board");});}}>Delete</button>}
          </F>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════════
const INV_STATUS_COL = { draft:"#94a3b8", outstanding:"#f59e0b", overdue:"#ef4444", paid:"#10b981", sent:"#3b82f6" };

const DUE_SHORTCUTS = [
  ["On Receipt", 0], ["7 Days", 7], ["15 Days", 15],
  ["30 Days", 30], ["45 Days", 45], ["60 Days", 60], ["90 Days", 90],
];

function addDays(dateStr, n) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

function sendGmail(inv) {
  const clientEmail = inv.clientEmail || "";
  const subject = encodeURIComponent(`Invoice for ${inv.summary||inv.number} from ${inv.companyName||"SecureOps"}`);
  const body = encodeURIComponent(
`Hello,

Please find attached Invoice for ${inv.summary||inv.number}.

Best regards,
Chris
${inv.companyName||""}${inv.companyAddress?"\n"+inv.companyAddress:""}${inv.companyEmail?"\n"+inv.companyEmail:""}`
  );
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(clientEmail)}&su=${subject}&body=${body}`;
  window.open(url, "_blank");
}

function printInvoiceHTML(inv) {
  const sub = inv.items.reduce((s,it) => s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0), 0);
  const discVal = parseFloat(inv.discount)||0;
  const discAmt = inv.discountType==="percent" ? sub*(discVal/100) : discVal;
  const afterDisc = Math.max(0, sub - discAmt);
  const hstAmt = inv.hst ? afterDisc*0.13 : 0;
  const tot = afterDisc + hstAmt;
  const cur = inv.currency||"CAD";

  const itemRows = inv.items.map(it => {
    const amt = (parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top">
        <div style="font-weight:600;color:#111827;font-size:13px">${it.desc||""}</div>
        ${it.subDesc ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">${it.subDesc}</div>` : ""}
      </td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151">${it.qty}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151">$${parseFloat(it.price||0).toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827">$${amt.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Invoice ${inv.number}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111827;font-size:13px}
    .page{max-width:820px;margin:0 auto;padding:48px 52px;background:#fff}
    @media print{@page{margin:1cm;size:A4}body{background:#fff}.page{padding:24px;max-width:100%}}
  </style>
  </head><body><div class="page">

    <!-- TOP: logo left, INVOICE right -->
    <table width="100%" style="margin-bottom:24px"><tr>
      <td style="vertical-align:top;width:45%">
        ${inv.logo ? `<img src="${inv.logo}" style="max-height:90px;max-width:180px;object-fit:contain;display:block" alt="logo"/>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:38px;font-weight:700;color:#111827;letter-spacing:-1px;line-height:1">INVOICE</div>
        ${inv.summary ? `<div style="font-size:12px;color:#6b7280;margin-top:6px">${inv.summary}</div>` : ""}
        <div style="margin-top:16px;text-align:right">
          ${inv.companyName ? `<div style="font-weight:700;font-size:13px;color:#111827">${inv.companyName}</div>` : ""}
          ${inv.companyTax ? `<div style="font-size:12px;color:#374151;margin-top:2px">Tax Number: ${inv.companyTax}</div>` : ""}
          ${inv.companyAddress ? `<div style="font-size:12px;color:#374151;margin-top:2px">${inv.companyAddress}</div>` : ""}
          ${inv.companyEmail ? `<div style="font-size:12px;color:#374151;margin-top:2px">${inv.companyEmail}</div>` : ""}
        </div>
      </td>
    </tr></table>

    <!-- DIVIDER -->
    <hr style="border:none;border-top:1px solid #d1d5db;margin-bottom:24px"/>

    <!-- BILL TO + INVOICE DETAILS -->
    <table width="100%" style="margin-bottom:28px"><tr>
      <td style="vertical-align:top;width:50%;padding-right:24px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Bill To</div>
        ${inv.clientName ? `<div style="font-weight:700;font-size:14px;color:#111827">${inv.clientName}</div>` : ""}
        ${inv.clientContact ? `<div style="font-size:12px;color:#374151;margin-top:3px">Attn: ${inv.clientContact}</div>` : ""}
        ${inv.clientPhone ? `<div style="font-size:12px;color:#374151;margin-top:3px">${inv.clientPhone}</div>` : ""}
        ${inv.clientEmail ? `<div style="font-size:12px;color:#374151;margin-top:3px">${inv.clientEmail}</div>` : ""}
        ${inv.clientAddress ? `<div style="font-size:12px;color:#374151;margin-top:3px">${inv.clientAddress}</div>` : ""}
      </td>
      <td style="vertical-align:top">
        <table width="100%" style="font-size:12px;border-collapse:collapse">
          <tr>
            <td style="color:#6b7280;padding:4px 0;padding-right:16px">Invoice Number:</td>
            <td style="color:#111827;font-weight:600;text-align:right">${inv.number||"—"}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:4px 0;padding-right:16px">Invoice Date:</td>
            <td style="color:#111827;font-weight:600;text-align:right">${inv.date||"—"}</td>
          </tr>
          ${inv.dueDate ? `<tr>
            <td style="color:#6b7280;padding:4px 0;padding-right:16px">Payment Due:</td>
            <td style="color:#111827;font-weight:600;text-align:right">${inv.dueDate}</td>
          </tr>` : ""}
          <tr>
            <td colspan="2" style="padding:0"><div style="height:1px;background:#e5e7eb;margin:6px 0"></div></td>
          </tr>
          <tr style="background:#f3f4f6">
            <td style="color:#111827;font-weight:700;padding:6px 8px;font-size:13px">Amount Due (${cur}):</td>
            <td style="color:#111827;font-weight:800;font-size:14px;text-align:right;padding:6px 8px">$${tot.toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr></table>

    <!-- ITEMS TABLE -->
    <table width="100%" style="border-collapse:collapse;margin-bottom:4px">
      <thead>
        <tr style="background:#e09820">
          <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#fff">Items</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:700;color:#fff;width:12%">Quantity</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:700;color:#fff;width:16%">Price</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:700;color:#fff;width:16%">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- TOTALS right-aligned -->
    <table width="100%"><tr><td width="52%"></td>
      <td style="padding-top:16px">
        <table width="100%" style="font-size:13px;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;color:#6b7280;text-align:right;padding-right:20px">Subtotal:</td>
            <td style="text-align:right;color:#111827;font-weight:600;white-space:nowrap">$${sub.toFixed(2)}</td>
          </tr>
          ${discAmt>0?`<tr>
            <td style="padding:4px 0;color:#6b7280;text-align:right;padding-right:20px">Discount${inv.discountNote?" ("+inv.discountNote+")":""}:</td>
            <td style="text-align:right;color:#059669;font-weight:600">− $${discAmt.toFixed(2)}</td>
          </tr>`:""}
          ${inv.hst?`<tr>
            <td style="padding:4px 0;color:#6b7280;text-align:right;padding-right:20px">HST 13%:</td>
            <td style="text-align:right;color:#111827;font-weight:600">$${hstAmt.toFixed(2)}</td>
          </tr>`:""}
          <tr>
            <td colspan="2" style="padding:0"><div style="height:1px;background:#d1d5db;margin:8px 0"></div></td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#374151;font-weight:600;text-align:right;padding-right:20px">Total:</td>
            <td style="text-align:right;color:#111827;font-weight:700">$${tot.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0"><div style="height:1px;background:#d1d5db;margin:8px 0"></div></td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#111827;font-weight:700;text-align:right;padding-right:20px">Amount Due (${cur}):</td>
            <td style="text-align:right;color:#111827;font-weight:800;font-size:15px;white-space:nowrap">$${tot.toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr></table>

    ${inv.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#f9fafb;border-radius:4px;font-size:12px;color:#374151;line-height:1.6"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
    ${inv.attachments&&inv.attachments.length>0?`
    <div style="margin-top:12px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;font-size:12px">
      <strong style="color:#92400e">Attachments:</strong>
      ${inv.attachments.map(a=>`<span style="margin-left:8px;color:#1e40af">• ${a.name}</span>`).join("")}
    </div>`:""}

    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
      <span>${inv.companyName||""}${inv.companyEmail?" · "+inv.companyEmail:""}</span>
      <span>Generated ${new Date().toLocaleDateString("en-CA",{year:"numeric",month:"long",day:"numeric"})}</span>
    </div>

  </div></body></html>`;

  const w = window.open("","_blank","width=960,height=780");
  if (!w) { alert("Allow pop-ups in your browser to download the PDF."); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 800);
}


function Invoices({ locs, addLog, isGuest }) {
  const [invs, setInvs] = useState([]);
  const [rdy, setRdy]   = useState(false);
  const [view, setView] = useState("dashboard");
  const [editing, setEditing] = useState(null);
  const [confirmEl, ask] = useConfirm();
  const origRef = useRef(null);

  // saved company profile
  const [co, setCo] = useState({ companyName:"", companyAddress:"", companyEmail:"", companyPhone:"", companyTax:"", logo:"" });
  const [coSaved, setCoSaved] = useState(false);
  const [logoB64, setLogoB64] = useState("");

  const blankForm = () => ({
    number:"", date:todayStr(), dueDate:"", summary:"",
    clientLocationId:"", clientName:"", clientAddress:"", clientEmail:"",
    clientPhone:"", clientContact:"",
    items:[{ desc:"Security Services", qty:1, price:"" }],
    hst:true, notes:"", status:"draft",
    discount:"", discountType:"percent", discountNote:"",
    currency:"CAD",
    attachments:[],
  });
  const [form, setForm] = useState(blankForm());

  useEffect(() => {
    (async () => {
      const [d, c] = await Promise.all([load(K.inv), load(K.co)]);
      if (d) setInvs(d);
      if (c) { setCo(c); setLogoB64(c.logo||""); }
      setRdy(true);
    })();
  }, []);

  const saveInvs = u => { setInvs(u); save(K.inv, u); };
  const saveCoProfile = () => { const c={...co,logo:logoB64}; setCo(c); save(K.co,c); setCoSaved(true); setTimeout(()=>setCoSaved(false),2000); };

  const nextNum = () => {
    const nums = invs.map(i => parseInt((i.number||"0").replace(/\D/g,""))||0);
    return `INV-${String((nums.length ? Math.max(...nums) : 0)+1).padStart(4,"0")}`;
  };

  function startNew() {
    const f = blankForm(); f.number = nextNum();
    setForm(f); setEditing(null); setView("form");
  }
  function startEdit(inv) {
    setForm({ ...blankForm(), ...inv, items:inv.items?.length?inv.items:[{desc:"",qty:1,price:""}] });
    origRef.current = { ...inv };
    setEditing(inv.id); setView("form");
  }

  function calcTotals(f) {
    const src = f || form;
    const sub = src.items.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0), 0);
    const discVal = parseFloat(src.discount)||0;
    const discAmt = src.discountType==="percent" ? sub*(discVal/100) : discVal;
    const afterDisc = Math.max(0, sub - discAmt);
    const hstAmt = src.hst ? afterDisc*0.13 : 0;
    return { sub, discAmt, afterDisc, hstAmt, total:afterDisc+hstAmt };
  }

  function setItem(i, k, v) { const items=[...form.items]; items[i]={...items[i],[k]:v}; setForm(p=>({...p,items})); }
  const addItem    = () => setForm(p=>({...p,items:[...p.items,{desc:"",qty:1,price:""}]}));
  const removeItem = i  => ask("Remove this line item?", ()=>setForm(p=>({...p,items:p.items.filter((_,j)=>j!==i)})));

  function submit() {
    if (!form.clientName.trim()&&!form.clientLocationId) { alert("Please select or enter a client."); return; }
    const { sub, discAmt, afterDisc, hstAmt, total } = calcTotals();
    const entry = { ...form, ...co, logo:logoB64, id:editing||uid(), subtotal:sub, discAmt, afterDisc, hstAmt, total };
    saveInvs(editing ? invs.map(x=>x.id===editing?entry:x) : [...invs,entry]);
    if (editing) {
      const changed = JSON.stringify(origRef.current?.items) !== JSON.stringify(entry.items) ||
        origRef.current?.total !== entry.total ||
        origRef.current?.status !== entry.status ||
        origRef.current?.clientName !== entry.clientName ||
        origRef.current?.dueDate !== entry.dueDate ||
        origRef.current?.summary !== entry.summary;
      if (changed) addLog("Updated","Invoice",`Updated invoice ${entry.number}`,`Client: ${entry.clientName||"—"} · Total: $${entry.total?.toFixed(2)||"0"}`);
    } else {
      addLog("Created","Invoice",`Created invoice ${entry.number}`,`Client: ${entry.clientName||"—"} · Total: $${entry.total?.toFixed(2)||"0"} · Status: ${entry.status}`);
    }
    setEditing(null); setView("list");
  }

  function delInv(id) { ask("Delete this invoice? This cannot be undone.", ()=>{
    const inv=invs.find(x=>x.id===id);
    saveInvs(invs.filter(x=>x.id!==id));
    addLog("Deleted","Invoice",`Deleted invoice ${inv?.number||""}`,`Client: ${inv?.clientName||"—"}`);
  }); }
  function setStatus(id, st) {
    const inv=invs.find(x=>x.id===id);
    saveInvs(invs.map(x=>x.id===id?{...x,status:st}:x));
    addLog("Updated","Invoice",`Marked invoice ${inv?.number||""} as ${st}`,`Client: ${inv?.clientName||"—"}`);
  }

  const clientLabel = inv => inv.clientName||(locs.find(l=>l.id===inv.clientLocationId)?.client)||(locs.find(l=>l.id===inv.clientLocationId)?.name)||"—";

  // stats (all-time, no period filter needed here — see Revenue page for period breakdown)
  const outstanding = invs.filter(x=>x.status==="outstanding");
  const overdue     = invs.filter(x=>x.status==="overdue");
  const paid        = invs.filter(x=>x.status==="paid");
  const sent        = invs.filter(x=>x.status==="sent");
  const drafts      = invs.filter(x=>x.status==="draft");

  if (!rdy) return <div style={S.card}><div style={S.empty}>Loading…</div></div>;

  const subTabs = [["dashboard","📊 Dashboard"],["list","📄 All Invoices"],["form","➕ New Invoice"]];

  return (
    <div>
      {confirmEl}
      <div style={{ display:"flex", gap:"6px", marginBottom:"14px", flexWrap:"wrap" }}>
        {(isGuest ? [["dashboard","📊 Dashboard"],["list","📄 All Invoices"]] : subTabs).map(([v,l]) => (
          <button key={v} style={{ ...S.bp, background:view===v?"#1d4ed8":"transparent", color:view===v?"#fff":"#4a8ab0", border:"1px solid #e2e8f0" }}
            onClick={()=>{ if(v==="form") startNew(); else setView(v); }}>{l}</button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {view==="dashboard" && (
        <div>
          {/* ── STAT CARDS ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px", marginBottom:"20px" }}>
            {[["Drafts",drafts.length,"#94a3b8"],["Outstanding",outstanding.length,T.amber],["Overdue",overdue.length,T.red],["Paid",paid.length,T.green],["Total",invs.length,T.blue]].map(([l,v,c])=>(
              <div key={l} style={{ ...S.stat }}>
                <div style={{ fontSize:"26px", fontWeight:"800", color:c, letterSpacing:"-0.8px", lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:"11px", color:T.textMute, marginTop:"6px", fontWeight:"500" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* ── HINT ── */}
          <div style={{ ...S.card, background:"rgba(0,80,255,0.05)", border:"1px solid rgba(0,80,255,0.1)", padding:"12px 16px", marginBottom:"16px" }}>
            <div style={{ fontSize:"12px", color:T.blue }}>
              💡 For revenue totals and HST — visit the <strong>Revenue</strong> page.
            </div>
          </div>

          {/* ── TWO COLUMN: Drafts + Outstanding/Overdue ── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", alignItems:"start" }}>

            {/* LEFT — Drafts */}
            <div style={S.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <div style={S.ct}>📝 Drafts</div>
                <button style={S.bp} onClick={startNew}>+ New</button>
              </div>
              {drafts.length===0 ? <div style={S.empty}>No drafts.</div> : drafts.map(inv=>(
                <div key={inv.id} style={{ padding:"12px", background:"rgba(0,80,255,0.02)", borderRadius:"10px", border:"1px solid rgba(0,80,255,0.07)", marginBottom:"8px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
                    <div>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:T.text }}>{inv.number}</div>
                      <div style={{ fontSize:"11px", color:T.textMute, marginTop:"1px" }}>{clientLabel(inv)}</div>
                    </div>
                    <div style={{ fontSize:"13px", fontWeight:"700", color:"#94a3b8" }}>${(inv.total||0).toFixed(2)}</div>
                  </div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button style={S.bsm(T.blue)} onClick={()=>startEdit(inv)}>Edit</button>
                    <button style={S.bsm(T.green)} onClick={()=>setStatus(inv.id,"outstanding")}>✉ Mark as Sent</button>
                    <button style={S.bsm("#a78bfa")} onClick={()=>printInvoiceHTML(inv)}>PDF</button>
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT — Outstanding + Overdue */}
            <div>
              {outstanding.length>0 && <div style={{ ...S.card, marginBottom:"12px" }}>
                <div style={S.ct}>🟡 Outstanding</div>
                {outstanding.map(inv=>(
                  <div key={inv.id} style={{ padding:"12px", background:"rgba(246,173,85,0.05)", borderRadius:"10px", border:"1px solid rgba(246,173,85,0.15)", marginBottom:"8px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
                      <div>
                        <div style={{ fontSize:"13px", fontWeight:"700", color:T.text }}>{inv.number}</div>
                        <div style={{ fontSize:"11px", color:T.textMute }}>{clientLabel(inv)}{inv.dueDate ? ` · Due ${inv.dueDate}` : ""}</div>
                      </div>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:T.amber }}>${(inv.total||0).toFixed(2)}</div>
                    </div>
                    <div style={{ display:"flex", gap:"6px" }}>
                      <button style={S.bsm(T.green)} onClick={()=>setStatus(inv.id,"paid")}>✓ Paid</button>
                      <button style={S.bsm(T.red)} onClick={()=>setStatus(inv.id,"overdue")}>Overdue</button>
                      <button style={S.bsm(T.blue)} onClick={()=>startEdit(inv)}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>}
              {overdue.length>0 && <div style={S.card}>
                <div style={S.ct}>🔴 Overdue</div>
                {overdue.map(inv=>(
                  <div key={inv.id} style={{ padding:"12px", background:"rgba(229,62,62,0.04)", borderRadius:"10px", border:"1px solid rgba(229,62,62,0.12)", marginBottom:"8px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
                      <div>
                        <div style={{ fontSize:"13px", fontWeight:"700", color:T.text }}>{inv.number}</div>
                        <div style={{ fontSize:"11px", color:T.textMute }}>{clientLabel(inv)}{inv.dueDate ? ` · Due ${inv.dueDate}` : ""}</div>
                      </div>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:T.red }}>${(inv.total||0).toFixed(2)}</div>
                    </div>
                    <div style={{ display:"flex", gap:"6px" }}>
                      <button style={S.bsm(T.green)} onClick={()=>setStatus(inv.id,"paid")}>✓ Paid</button>
                      <button style={S.bsm(T.blue)} onClick={()=>startEdit(inv)}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>}
              {outstanding.length===0 && overdue.length===0 && (
                <div style={{ ...S.card, textAlign:"center" }}>
                  <div style={{ fontSize:"24px", marginBottom:"8px" }}>✓</div>
                  <div style={{ fontSize:"13px", color:T.green, fontWeight:"600" }}>All clear</div>
                  <div style={{ fontSize:"12px", color:T.textMute, marginTop:"4px" }}>No outstanding or overdue invoices</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ALL INVOICES ── */}
      {view==="list" && (
        <div style={S.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <div style={S.ct}>All Invoices ({invs.length})</div>
            <button style={S.bp} onClick={startNew}>+ New Invoice</button>
          </div>
          {invs.length===0?<div style={S.empty}>No invoices yet.</div>:(
            <div style={{ overflowX:"auto" }}>
              <table style={S.tbl}>
                <thead><tr>{["Invoice #","Client","Summary","Date","Due","Status","Total",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{[...invs].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(inv=>(
                  <tr key={inv.id}>
                    <td style={S.td}><strong style={{ color:"#0f172a" }}>{inv.number}</strong></td>
                    <td style={S.td}>{clientLabel(inv)}</td>
                    <td style={{ ...S.td, maxWidth:"160px", fontSize:"10px", color:"#475569" }}>{inv.summary||"—"}</td>
                    <td style={S.td}>{inv.date||"—"}</td>
                    <td style={S.td}>{inv.dueDate||"—"}</td>
                    <td style={S.td}><span style={S.pill(INV_STATUS_COL[inv.status]||"#6b7280")}>{inv.status}</span></td>
                    <td style={S.td}><strong>${(inv.total||0).toFixed(2)}</strong></td>
                    <td style={S.td}><div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                      {!isGuest && <button style={S.bsm("#60a5fa")} onClick={()=>startEdit(inv)}>Edit</button>}
                      <button style={S.bsm("#a78bfa")} onClick={()=>printInvoiceHTML(inv)}>🖨 PDF</button>
                      <button style={S.bsm("#ea4335")} title="Opens Gmail compose — remember to attach the PDF manually" onClick={()=>sendGmail(inv)}>✉ Send</button>
                      {!isGuest && inv.status==="draft" && <button style={S.bsm("#10b981")} onClick={()=>setStatus(inv.id,"outstanding")}>Mark as Sent</button>}
                      {!isGuest && inv.status==="outstanding" && <button style={S.bsm("#10b981")} onClick={()=>setStatus(inv.id,"paid")}>Paid</button>}
                      {!isGuest && inv.status==="outstanding" && <button style={S.bsm("#ef4444")} onClick={()=>setStatus(inv.id,"overdue")}>Overdue</button>}
                      {!isGuest && <button style={S.bd} onClick={()=>delInv(inv.id)}>✕</button>}
                      {!isGuest && <button style={S.bd} onClick={()=>delInv(inv.id)}>✕</button>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── FORM ── */}
      {view==="form" && !isGuest && (
        <div>
          {/* company profile — always saved */}
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={S.ct}>Your Company Details <span style={{ color:"#94a3b8", fontSize:"9px", fontWeight:"400" }}>(saved automatically across all invoices)</span></div>
              <button style={{ ...S.bs, fontSize:"9px" }} onClick={saveCoProfile}>{coSaved?"✓ Saved!":"💾 Save Profile"}</button>
            </div>
            <div style={S.g3}>
              <div><label style={S.lbl}>Company Name</label><input style={S.inp} value={co.companyName} onChange={e=>setCo(p=>({...p,companyName:e.target.value}))} placeholder="SecureOps Inc."/></div>
              <div><label style={S.lbl}>Address</label><input style={S.inp} value={co.companyAddress} onChange={e=>setCo(p=>({...p,companyAddress:e.target.value}))} placeholder="123 Main St, Toronto ON"/></div>
              <div><label style={S.lbl}>Phone</label><input style={S.inp} value={co.companyPhone} onChange={e=>setCo(p=>({...p,companyPhone:e.target.value}))} placeholder="(416) 555-0100"/></div>
            </div>
            <div style={{ ...S.g3, marginTop:"8px" }}>
              <div><label style={S.lbl}>Email</label><input style={S.inp} value={co.companyEmail} onChange={e=>setCo(p=>({...p,companyEmail:e.target.value}))} placeholder="billing@secureops.ca"/></div>
              <div><label style={S.lbl}>HST / Tax Number</label><input style={S.inp} value={co.companyTax} onChange={e=>setCo(p=>({...p,companyTax:e.target.value}))} placeholder="e.g. 123456789 RT0001"/></div>
              <div>
                <label style={S.lbl}>Company Logo</label>
                <div style={{ display:"flex", gap:"7px", alignItems:"center" }}>
                  <label style={{ ...S.bo, cursor:"pointer", fontSize:"9px", padding:"5px 10px" }}>
                    Upload Logo
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                      const f=e.target.files[0]; if(!f)return;
                      const r=new FileReader(); r.onload=ev=>{setLogoB64(ev.target.result);setCo(p=>({...p,logo:ev.target.result}));};
                      r.readAsDataURL(f);
                    }}/>
                  </label>
                  {logoB64&&<><img src={logoB64} alt="logo" style={{ height:"30px", borderRadius:"3px", border:"1px solid #e2e8f0" }}/><button style={S.bd} onClick={()=>{setLogoB64("");setCo(p=>({...p,logo:""}));}}>Remove</button></>}
                </div>
              </div>
            </div>
          </div>

          {/* invoice meta */}
          <div style={S.card}>
            <div style={S.ct}>Invoice Details</div>
            <div style={S.g4}>
              <div><label style={S.lbl}>Invoice #</label><input style={S.inp} value={form.number} onChange={e=>setForm(p=>({...p,number:e.target.value}))}/></div>
              <div><label style={S.lbl}>Invoice Date</label><input style={S.inp} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div>
                <label style={S.lbl}>Payment Due Date</label>
                <input style={S.inp} type="date" value={form.dueDate} onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))}/>
                <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", marginTop:"5px" }}>
                  {DUE_SHORTCUTS.map(([label,days])=>(
                    <button key={label} style={{ ...S.bsm("#475569"), fontSize:"8px", padding:"2px 6px" }}
                      onClick={()=>setForm(p=>({...p,dueDate:addDays(p.date,days)}))}>{label}</button>
                  ))}
                </div>
              </div>
              <div><label style={S.lbl}>Status</label>
                <select style={S.sel} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  <option value="draft">Draft</option>
                  <option value="outstanding">Outstanding</option>
                  <option value="sent">Sent</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <div style={{ ...S.g2, marginTop:"8px" }}>
              <div>
                <label style={S.lbl}>Currency</label>
                <select style={S.sel} value={form.currency||"CAD"} onChange={e=>setForm(p=>({...p,currency:e.target.value}))}>
                  {["CAD","USD","EUR","GBP","AUD","CHF","JPY","MXN","AED","SGD"].map(c=>(
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Invoice Summary / Description</label>
                <input style={S.inp} value={form.summary} onChange={e=>setForm(p=>({...p,summary:e.target.value}))} placeholder="e.g. Security Services — Downtown Mall — May 1–15, 2026"/>
              </div>
            </div>
          </div>

          {/* client — auto-fill from locations */}
          <div style={S.card}>
            <div style={S.ct}>Client / Bill To</div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Select Client</label>
                <select style={S.sel} value={form.clientLocationId} onChange={e=>{
                  const l=locs.find(x=>x.id===e.target.value);
                  setForm(p=>({...p,
                    clientLocationId:e.target.value,
                    clientName:      l ? l.client||l.name : p.clientName,
                    clientAddress:   l?.clientAddress||p.clientAddress,
                    clientEmail:     l?.contactEmail||p.clientEmail,
                    clientPhone:     l?.contactPhone||p.clientPhone,
                    clientContact:   l?.contactName||p.clientContact,
                  }));
                }}>
                  <option value="">Select…</option>
                  {locs.map(l=><option key={l.id} value={l.id}>{l.client||l.name}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Contact Person</label><input style={S.inp} value={form.clientContact} onChange={e=>setForm(p=>({...p,clientContact:e.target.value}))} placeholder="Auto-filled from Locations"/></div>
            </div>
            <div style={{ ...S.g3, marginTop:"8px" }}>
              <div><label style={S.lbl}>Client Phone</label><input style={S.inp} value={form.clientPhone} onChange={e=>setForm(p=>({...p,clientPhone:e.target.value}))} placeholder="Auto-filled"/></div>
              <div><label style={S.lbl}>Client Email</label><input style={S.inp} value={form.clientEmail} onChange={e=>setForm(p=>({...p,clientEmail:e.target.value}))} placeholder="Auto-filled"/></div>
              <div><label style={S.lbl}>Client Address</label><input style={S.inp} value={form.clientAddress} onChange={e=>setForm(p=>({...p,clientAddress:e.target.value}))}/></div>
            </div>
          </div>

          {/* line items */}
          <div style={S.card}>
            <div style={S.ct}>Line Items</div>
            {/* Past line item suggestions for selected client */}
            {(() => {
              // Collect unique descriptions from previous invoices for this client
              const clientId = form.clientLocationId;
              const clientName = form.clientName;
              const pastDescs = [...new Set(
                invs
                  .filter(inv =>
                    inv.id !== editing &&
                    (clientId ? inv.clientLocationId === clientId : inv.clientName === clientName)
                  )
                  .flatMap(inv => (inv.items||[]).map(it => it.desc).filter(Boolean))
              )];

              if (!pastDescs.length) return null;
              return (
                <div style={{ marginBottom:"10px", padding:"10px 12px", background:"#eff6ff", borderRadius:"8px", border:"1px solid #bfdbfe" }}>
                  <div style={{ fontSize:"10px", fontWeight:"600", color:"#1d4ed8", marginBottom:"6px" }}>
                    💡 Previous line items for this client — click to add
                  </div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {pastDescs.map(desc => (
                      <button key={desc}
                        style={{ background:"#fff", border:"1px solid #bfdbfe", borderRadius:"6px", padding:"4px 10px", fontSize:"11px", color:"#1e40af", cursor:"pointer", fontWeight:"500" }}
                        onClick={() => {
                          // Add as a new line item (or fill first empty one)
                          const emptyIdx = form.items.findIndex(it => !it.desc.trim());
                          if (emptyIdx !== -1) {
                            setItem(emptyIdx, "desc", desc);
                          } else {
                            setForm(p => ({ ...p, items:[...p.items, { desc, qty:1, price:"" }] }));
                          }
                        }}>
                        {desc}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <table style={S.tbl}>
              <thead><tr>{["Description","Qty","Unit Price ($)","Amount",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {form.items.map((it,i)=>{
                  const amt=(parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
                  // Get matching suggestions for this specific input as user types
                  const clientId = form.clientLocationId;
                  const clientName = form.clientName;
                  const suggestions = it.desc.trim().length > 0
                    ? [...new Set(
                        invs
                          .filter(inv => inv.id !== editing && (clientId ? inv.clientLocationId===clientId : inv.clientName===clientName))
                          .flatMap(inv => (inv.items||[]).map(x=>x.desc).filter(Boolean))
                      )].filter(d => d.toLowerCase().includes(it.desc.toLowerCase()) && d !== it.desc)
                    : [];
                  return (
                    <tr key={i}>
                      <td style={S.td}>
                        <div style={{ position:"relative" }}>
                          <input style={S.inp} value={it.desc}
                            onChange={e=>setItem(i,"desc",e.target.value)}
                            placeholder="e.g. Security Services — May 1–15"/>
                          {suggestions.length > 0 && (
                            <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:`1px solid ${T.border}`, borderRadius:"8px", boxShadow:"0 4px 16px rgba(0,0,0,0.1)", zIndex:100, marginTop:"2px", overflow:"hidden" }}>
                              {suggestions.slice(0,5).map(s => (
                                <div key={s}
                                  style={{ padding:"8px 12px", fontSize:"12px", color:T.text, cursor:"pointer", borderBottom:`1px solid ${T.border}` }}
                                  onMouseDown={e=>{ e.preventDefault(); setItem(i,"desc",s); }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <input style={{ ...S.inp, marginTop:"4px", fontSize:"11px", color:T.textSub, background:"#f8faff" }}
                          value={it.subDesc||""}
                          onChange={e=>setItem(i,"subDesc",e.target.value)}
                          placeholder="Sub-description (e.g. Number of Hours — 3 days)"/>
                      </td>
                      <td style={S.td}><input style={{ ...S.inp, width:"65px" }} type="number" min="0" value={it.qty} onChange={e=>setItem(i,"qty",e.target.value)}/></td>
                      <td style={S.td}><input style={{ ...S.inp, width:"100px" }} type="number" step="0.01" min="0" value={it.price} onChange={e=>setItem(i,"price",e.target.value)}/></td>
                      <td style={{ ...S.td, fontWeight:"700", color:"#0f172a" }}>${amt.toFixed(2)}</td>
                      <td style={S.td}>{form.items.length>1&&<button style={S.bd} onClick={()=>removeItem(i)}>✕</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button style={{ ...S.bo, marginTop:"8px", fontSize:"9px" }} onClick={addItem}>+ Add Line Item</button>
            <div style={{ marginTop:"14px", maxWidth:"320px", marginLeft:"auto", background:T.bg, borderRadius:"8px", padding:"14px", border:`1px solid ${T.border}` }}>
              {(()=>{ const {sub,discAmt,afterDisc,hstAmt,total}=calcTotals(); const cur=form.currency||"CAD"; return (<>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"6px", color:T.textSub }}><span>Subtotal</span><span>{cur} ${sub.toFixed(2)}</span></div>
                {/* discount */}
                <div style={{ marginBottom:"8px", padding:"10px", background:T.surface, borderRadius:"6px", border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:"11px", fontWeight:"600", color:T.textSub, marginBottom:"6px" }}>Discount (optional)</div>
                  <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                    <select style={{ ...S.sel, width:"90px", fontSize:"11px", padding:"5px 8px" }} value={form.discountType} onChange={e=>setForm(p=>({...p,discountType:e.target.value}))}>
                      <option value="percent">%</option>
                      <option value="fixed">$ Fixed</option>
                    </select>
                    <input style={{ ...S.inp, width:"80px", fontSize:"11px", padding:"5px 8px" }} type="number" min="0" step="0.01" value={form.discount} onChange={e=>setForm(p=>({...p,discount:e.target.value}))} placeholder="0"/>
                    <input style={{ ...S.inp, flex:1, fontSize:"11px", padding:"5px 8px" }} value={form.discountNote} onChange={e=>setForm(p=>({...p,discountNote:e.target.value}))} placeholder="Reason (optional)"/>
                  </div>
                  {discAmt>0&&<div style={{ fontSize:"11px", color:T.green, marginTop:"5px" }}>− {cur} ${discAmt.toFixed(2)} off</div>}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"6px", alignItems:"center" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:"5px", cursor:"pointer", color:T.textSub }}><input type="checkbox" checked={form.hst} onChange={e=>setForm(p=>({...p,hst:e.target.checked}))}/>HST (13%)</label>
                  <span style={{ color:T.textSub }}>{cur} ${hstAmt.toFixed(2)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"15px", fontWeight:"800", color:T.text, borderTop:`1px solid ${T.border}`, paddingTop:"8px" }}><span>Total ({cur})</span><span>${total.toFixed(2)}</span></div>
              </>); })()}
            </div>
          </div>

          {/* notes */}
          <div style={S.card}>
            <div style={S.ct}>Notes / Payment Instructions</div>
            <textarea style={S.ta} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. Please make cheques payable to SecureOps Inc. Payment due within 30 days."/>
          </div>

          {/* attachments */}
          <div style={S.card}>
            <div style={S.ct}>Attachments</div>
            <div style={{ fontSize:"12px", color:T.textSub, marginBottom:"10px" }}>
              Attach supporting documents to this invoice (e.g. timesheets, schedules). File names will appear on the PDF. Files are stored locally and will need to be sent alongside the PDF.
            </div>
            <label style={{ ...S.bo, cursor:"pointer", display:"inline-block", fontSize:"12px" }}>
              + Add Attachment
              <input type="file" multiple style={{ display:"none" }} onChange={e=>{
                const files = Array.from(e.target.files).map(f=>({ name:f.name, size:f.size }));
                setForm(p=>({ ...p, attachments:[...(p.attachments||[]), ...files] }));
                e.target.value="";
              }}/>
            </label>
            {(form.attachments||[]).length > 0 && (
              <div style={{ marginTop:"10px" }}>
                {form.attachments.map((a,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background:T.bg, borderRadius:"6px", marginBottom:"5px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:"12px", color:T.text }}>📎 {a.name} <span style={{ color:T.textMute, fontSize:"10px" }}>({(a.size/1024).toFixed(1)} KB)</span></div>
                    <button style={S.bd} onClick={()=>setForm(p=>({...p,attachments:p.attachments.filter((_,j)=>j!==i)}))}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
            <button style={S.bp} onClick={submit}>Save Invoice</button>
            <button style={{ ...S.bsm("#a78bfa"), padding:"7px 13px", fontSize:"10px" }} onClick={()=>{ const {sub,discAmt,afterDisc,hstAmt,total}=calcTotals(); printInvoiceHTML({...form,...co,logo:logoB64,subtotal:sub,discAmt,afterDisc,hstAmt,total}); }}>🖨 Preview PDF</button>
            <button style={{ ...S.bsm("#ea4335"), padding:"7px 13px", fontSize:"10px" }} title="Opens Gmail compose — remember to attach the PDF manually" onClick={()=>{ const {sub,discAmt,afterDisc,hstAmt,total}=calcTotals(); sendGmail({...form,...co,logo:logoB64,subtotal:sub,discAmt,afterDisc,hstAmt,total}); }}>✉ Send via Gmail</button>
            <button style={S.bo} onClick={()=>setView(editing?"list":"dashboard")}>Cancel</button>
            {editing&&<button style={S.bd} onClick={()=>delInv(editing)}>Delete Invoice</button>}
          </div>
          <div style={{ fontSize:"11px", color:T.textMute, marginTop:"8px" }}>
            💡 <strong>To send the invoice:</strong> Click "🖨 Preview PDF" first to download the PDF, then click "✉ Send via Gmail" — Gmail will open with the email pre-filled. Attach the PDF file before clicking Send.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════
const ACTION_STYLE = {
  Created: { color:"#15803d", bg:"#f0fdf4", border:"#bbf7d0", icon:"✦" },
  Updated: { color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe", icon:"✎" },
  Deleted: { color:"#dc2626", bg:"#fef2f2", border:"#fecaca", icon:"✕" },
  Adjusted: { color:"#d97706", bg:"#fffbeb", border:"#fde68a", icon:"⊙" },
};

function ActivityLog({ logEntries, setLogEntries }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmEl, ask] = useConfirm();

  const categories = [...new Set(logEntries.map(e=>e.category))].sort();
  const filtered = logEntries
    .filter(e => filter==="all" || e.category===filter)
    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.timestamp.localeCompare(a.timestamp));

  function clearLog() {
    ask("Clear the entire activity log? This cannot be undone.", () => {
      setLogEntries([]); save(K.log, []);
    });
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString("en-CA", { month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  return (
    <div>
      {confirmEl}
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"10px", marginBottom:"12px" }}>
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
            <input style={{ ...S.inp, width:"200px" }} placeholder="Search log…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={{ ...S.sel, width:"160px" }} value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <span style={{ fontSize:"12px", color:T.textMute }}>{filtered.length} entr{filtered.length!==1?"ies":"y"}</span>
            {logEntries.length>0 && <button style={S.bd} onClick={clearLog}>Clear Log</button>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={S.empty}>
            {logEntries.length === 0
              ? "No activity recorded yet. Changes you make in the app will appear here."
              : "No entries match your search."}
          </div>
        ) : (
          <div>
            {filtered.map(entry => {
              const st = ACTION_STYLE[entry.action] || ACTION_STYLE.Updated;
              return (
                <div key={entry.id} style={{ display:"flex", gap:"12px", alignItems:"flex-start", padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
                  {/* icon */}
                  <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:st.bg, border:`1px solid ${st.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", color:st.color, flexShrink:0, fontWeight:"700" }}>
                    {st.icon}
                  </div>
                  {/* content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", marginBottom:"2px" }}>
                      <span style={{ fontSize:"11px", fontWeight:"700", color:st.color, background:st.bg, border:`1px solid ${st.border}`, padding:"2px 8px", borderRadius:"20px" }}>{entry.action}</span>
                      <span style={{ fontSize:"11px", fontWeight:"600", color:T.textSub, background:T.surface2, border:`1px solid ${T.border}`, padding:"2px 8px", borderRadius:"20px" }}>{entry.category}</span>
                    </div>
                    <div style={{ fontSize:"13px", color:T.text, marginTop:"3px" }}>{entry.description}</div>
                    {entry.detail && <div style={{ fontSize:"11px", color:T.textMute, marginTop:"2px" }}>{entry.detail}</div>}
                  </div>
                  {/* time */}
                  <div style={{ fontSize:"11px", color:T.textMute, flexShrink:0, textAlign:"right" }}>{fmtTime(entry.timestamp)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── inspirational quotes ─────────────────────────────────────────────────────
const QUOTES = [
  // Motivational
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Work hard in silence. Let success make the noise.", author: "" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is not final, failure is not fatal — it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "" },
  { text: "Dream it. Wish it. Do it.", author: "" },
  { text: "Great things never come from comfort zones.", author: "" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "You didn't come this far to only come this far.", author: "" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "Don't limit your challenges. Challenge your limits.", author: "" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs" },
  { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { text: "Do what you can with all you have, wherever you are.", author: "Theodore Roosevelt" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving them.", author: "Zig Ziglar" },
  { text: "Whoever is happy will make others happy too.", author: "Anne Frank" },
  { text: "Try not to become a person of success, but rather try to become a person of value.", author: "Albert Einstein" },
  { text: "Too many of us are not living our dreams because we are living our fears.", author: "Les Brown" },
  { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "We may encounter many defeats, but we must not be defeated.", author: "Maya Angelou" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  // Business / Security company specific
  { text: "A business that makes nothing but money is a poor business.", author: "Henry Ford" },
  { text: "The best investment you can make is in yourself.", author: "Warren Buffett" },
  { text: "Chase the vision, not the money; the money will end up following you.", author: "Tony Hsieh" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "Earn trust, earn trust, earn trust. Then you can worry about the rest.", author: "Seth Godin" },
  { text: "Every problem is a gift — without problems we would not grow.", author: "Anthony Robbins" },
  { text: "Another day, another opportunity to build something great. 💼", author: "" },
  { text: "Security is not a product, but a process.", author: "Bruce Schneier" },
  // Funny / Light
  { text: "Why do they call it rush hour when nothing moves? 🤔", author: "" },
  { text: "I told my boss three companies were after me and I needed a raise. He asked which ones. I said gas, water, and electricity. 😄", author: "" },
  { text: "Coffee: because adulting is hard. ☕", author: "" },
  { text: "Dear Monday, I want to break up. I'm seeing Tuesday and dreaming about Friday. 📅", author: "" },
  { text: "The brain is a wonderful organ. It starts working the moment you get up and doesn't stop until you open your email. 📧", author: "" },
  { text: "I always give 100% at work: 13% Monday, 22% Tuesday, 26% Wednesday, 35% Thursday, 4% Friday. 📊", author: "" },
  { text: "People say nothing is impossible, but I do nothing every day. Just kidding — back to work. 😅", author: "" },
  { text: "Teamwork makes the dream work. Unless the team is just you and coffee. ☕", author: "" },
  { text: "Behind every successful person is a substantial amount of coffee. ☕", author: "" },
  { text: "Life is short. Smile while you still have teeth. 😁", author: "" },
];

// ─── sign-out quotes (funny, leaving-themed) ─────────────────────────────────
const SIGN_OUT_QUOTES = [
  { text: "Logging out like a responsible adult. See you on the other side. 👋", author: "" },
  { text: "You have signed out. Your couch is waiting. 🛋️", author: "" },
  { text: "Gone in 60 seconds. Or however long it takes to close this tab.", author: "" },
  { text: "Session ended. Please locate the nearest exit. 🚪", author: "" },
  { text: "Closing SecureOps... and opening the fridge. 🍕", author: "" },
  { text: "You're leaving? But we were just getting started! 😢", author: "" },
  { text: "And just like that... you're gone. Like a ninja. 🥷", author: "" },
  { text: "Logged out successfully. You are now free to stare at the wall.", author: "" },
  { text: "Bye! Don't forget to actually do the things on your to-do list. 📋", author: "" },
  { text: "Farewell. The guards will continue guarding without you. 🛡️", author: "" },
  { text: "You have escaped SecureOps. For now. We'll be here when you return. 😈", author: "" },
  { text: "Signing out. Time to touch grass. 🌿", author: "" },
  { text: "Access revoked. Your invoice won't pay itself though. Just saying. 💸", author: "" },
  { text: "Goodbye! Remember, sleep is just a free trial of death. Use it wisely. 😴", author: "" },
  { text: "SecureOps has left the chat. 💬", author: "" },
  { text: "You are now offline. Much like your motivation on a Monday. 📴", author: "" },
  { text: "Logged out. If found, please return to nearest laptop. 💻", author: "" },
  { text: "That's a wrap! Same time tomorrow? 🎬", author: "" },
  { text: "Out of office. Mentally, at least. 🧠", author: "" },
  { text: "Session terminated. Go eat something, you've been staring at screens. 🥗", author: "" },
  { text: "Signing off like it's the end of a very professional email. Best regards, SecureOps.", author: "" },
  { text: "You did good today. Now go pretend you have a social life. 🎉", author: "" },
  { text: "Logging you out before you make any more decisions today. 😅", author: "" },
  { text: "The building is secure. You, on the other hand, are leaving. 🏃", author: "" },
  { text: "Door's open, don't let the firewall hit you on the way out. 🔥", author: "" },
];

// ─── dashboard greetings ──────────────────────────────────────────────────────
const GREETINGS_MORNING = [
  "Good morning", "Rise and grind", "Morning, boss",
  "Top of the morning", "Another day, another opportunity",
  "Morning! Coffee's not going to drink itself ☕",
  "Good morning. Let's make today count.",
  "Up and at 'em",
];
const GREETINGS_AFTERNOON = [
  "Good afternoon", "Hope the morning was productive",
  "Afternoon hustle in progress 💪", "Halfway through the day — keep going",
  "Good afternoon. The invoices aren't going to send themselves.",
  "Afternoon check-in 📋",
];
const GREETINGS_EVENING = [
  "Good evening", "Wrapping up for the day?",
  "Evening grind 🌙", "Still at it — respect.",
  "Good evening. Don't forget to rest too.",
  "Evening mode: activated 🌆",
  "Night owl hours 🦉",
];
function getGreeting() {
  const h = new Date().getHours();
  const arr = h < 12 ? GREETINGS_MORNING : h < 17 ? GREETINGS_AFTERNOON : GREETINGS_EVENING;
  return arr[Math.floor(Math.random()*arr.length)];
}
function QuoteFlash({ quote, onDone }) {
  const [phase, setPhase] = useState("in"); // in | show | out
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 400);
    const t2 = setTimeout(() => setPhase("out"), 5200);  // show for ~4.8s
    const t3 = setTimeout(() => onDone(), 5800);          // total ~5.8s
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  function dismiss() { setPhase("out"); setTimeout(onDone, 600); }

  const opacity = phase === "in" ? 0 : phase === "show" ? 1 : 0;
  return (
    <div
      onClick={dismiss}
      style={{ position:"fixed", inset:0, background:"rgba(0,20,80,0.6)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, transition:"opacity 0.55s ease", opacity, cursor:"pointer" }}>
      <div style={{ textAlign:"center", padding:"48px 40px", maxWidth:"560px" }}>
        <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"20px" }}>
          {quote.author ? "Wisdom" : "Today's thought"}
        </div>
        <div style={{ fontSize:"23px", fontWeight:"600", color:"#fff", lineHeight:1.55, letterSpacing:"-0.3px", marginBottom:"18px" }}>
          "{quote.text}"
        </div>
        {quote.author && (
          <div style={{ fontSize:"13px", color:"rgba(255,255,255,0.45)" }}>— {quote.author}</div>
        )}
        <div style={{ marginTop:"32px", fontSize:"11px", color:"rgba(255,255,255,0.25)", letterSpacing:"1px" }}>
          tap anywhere to continue
        </div>
      </div>
    </div>
  );
}

// ─── App Dashboard ────────────────────────────────────────────────────────────
function AppDashboard({ guards, locs, scs, ovs, invs, isGuest, setTab, todos, setTodos }) {
  const today = todayStr();
  const todayShifts = locs.length > 0 || guards.length > 0 ? (() => {
    const dow = pDate(today).getDay();
    const ids = new Set();
    scs.filter(s => s.days.includes(dow) && (!s.effectiveFrom||today>=s.effectiveFrom) && (!s.effectiveTo||today<=s.effectiveTo)).forEach(s=>ids.add(s.guardId));
    ovs.filter(o=>o.date===today&&!o.absent).forEach(o=>ids.add(o.guardId));
    return [...ids].map(id => {
      const g = guards.find(x=>x.id===id); if(!g) return null;
      const sh = effShift(today,id,scs,ovs); if(!sh) return null;
      const loc = locs.find(l=>l.id===sh.locationId);
      return { ...sh, guard:g, locName:loc?.name||loc?.client||"—" };
    }).filter(Boolean);
  })() : [];

  const outstanding = invs.filter(x=>x.status==="outstanding");
  const overdue     = invs.filter(x=>x.status==="overdue");
  const drafts      = invs.filter(x=>x.status==="draft");
  const activeGuards = guards.filter(g=>g.status==="Active");
  const now = new Date();
  const hour = now.getHours();
  const [greeting] = useState(() => getGreeting());
  const guardColors = ["#0050ff","#7b61ff","#00b894","#f6ad55","#e53e3e","#00d4ff","#f472b6"];

  const [todoInput, setTodoInput] = useState("");
  function addTodo() {
    if (!todoInput.trim()) return;
    const updated = [{ id:uid(), text:todoInput.trim(), done:false, created:new Date().toISOString() }, ...todos];
    setTodos(updated); save(K.td, updated);
    setTodoInput("");
  }
  function toggleTodo(id) {
    const updated = todos.map(t => t.id===id ? {...t, done:!t.done} : t);
    setTodos(updated); save(K.td, updated);
  }
  function deleteTodo(id) {
    const updated = todos.filter(t => t.id!==id);
    setTodos(updated); save(K.td, updated);
  }
  function clearDone() {
    const updated = todos.filter(t => !t.done);
    setTodos(updated); save(K.td, updated);
  }
  const doneCt = todos.filter(t=>t.done).length;

  return (
    <div>
      {/* greeting */}
      <div style={{ marginBottom:"28px" }}>
        <div style={{ fontSize:"26px", fontWeight:"700", color:T.text, letterSpacing:"-0.5px" }}>{greeting}, Chris 👋</div>
        <div style={{ fontSize:"13px", color:T.textMute, marginTop:"4px" }}>
          {now.toLocaleDateString("en-CA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
        </div>
      </div>

      {/* top stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"20px" }}>
        {[
          ["Active Employees", activeGuards.length, T.blue, "👤", ()=>setTab("emp")],
          ["Locations", locs.length, T.purple, "📍", ()=>setTab("loc")],
          ["On Shift Today", todayShifts.length, T.green, "🕐", ()=>setTab("cal")],
          ["Invoices Due", outstanding.length+overdue.length, overdue.length>0?T.red:T.amber, "🧾", ()=>setTab("inv")],
        ].map(([l,v,c,icon,onClick])=>(
          <div key={l} style={{ ...S.stat, cursor:"pointer" }} onClick={onClick}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:"28px", fontWeight:"800", color:c, letterSpacing:"-1px", lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:"11px", color:T.textMute, marginTop:"6px", fontWeight:"500" }}>{l}</div>
              </div>
              <div style={{ fontSize:"22px", opacity:0.6 }}>{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TO-DO LIST ── */}
      <div style={{ ...S.card, marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <div style={S.ct}>✅ To-Do List</div>
          {doneCt > 0 && (
            <button style={{ ...S.bsm("#94a3b8"), fontSize:"11px" }} onClick={clearDone}>
              Clear {doneCt} done
            </button>
          )}
        </div>
        {/* input row */}
        <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
          <input
            style={{ ...S.inp, flex:1 }}
            placeholder="Add a task… e.g. Send invoice to ABC Corp"
            value={todoInput}
            onChange={e=>setTodoInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTodo()}
          />
          <button style={{ ...S.bp, padding:"9px 16px", whiteSpace:"nowrap" }} onClick={addTodo}>+ Add</button>
        </div>
        {/* task list */}
        {todos.length === 0 ? (
          <div style={{ ...S.empty, padding:"20px" }}>No tasks yet. Add something above.</div>
        ) : (
          <div>
            {todos.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", background:t.done?"rgba(0,184,148,0.04)":"rgba(255,255,255,0.6)", border:`1px solid ${t.done?"rgba(0,184,148,0.12)":"rgba(0,80,255,0.06)"}`, marginBottom:"6px", transition:"all 0.15s" }}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={()=>toggleTodo(t.id)}
                  style={{ width:"16px", height:"16px", accentColor:T.blue, cursor:"pointer", flexShrink:0 }}
                />
                <span style={{ flex:1, fontSize:"13px", color:t.done?T.textMute:T.text, textDecoration:t.done?"line-through":"none", transition:"all 0.15s" }}>
                  {t.text}
                </span>
                <button
                  onClick={()=>deleteTodo(t.id)}
                  style={{ background:"transparent", border:"none", cursor:"pointer", color:T.textMute, fontSize:"16px", lineHeight:1, padding:"2px 4px", borderRadius:"4px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* two column */}
      <div style={{ display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:"16px" }}>
        {/* today's shifts */}
        <div style={S.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <div style={S.ct}>Today's Shifts</div>
            <button style={{ ...S.bsm(T.blue), fontSize:"11px" }} onClick={()=>setTab("cal")}>View Calendar →</button>
          </div>
          {todayShifts.length === 0 ? (
            <div style={S.empty}>No shifts scheduled for today.</div>
          ) : todayShifts.map((s,i) => (
            <div key={s.guardId} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 0", borderBottom:"1px solid rgba(0,80,255,0.06)" }}>
              <div style={{ width:"34px", height:"34px", borderRadius:"10px", background:`${guardColors[i%guardColors.length]}15`, border:`1px solid ${guardColors[i%guardColors.length]}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"700", color:guardColors[i%guardColors.length], flexShrink:0 }}>
                {s.guard.name.split(" ").map(x=>x[0]).join("").slice(0,2)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"13px", fontWeight:"600", color:T.text }}>{s.guard.name}</div>
                <div style={{ fontSize:"11px", color:T.textMute }}>{s.locName}</div>
              </div>
              <div style={{ fontSize:"11px", color:guardColors[i%guardColors.length], fontWeight:"600", whiteSpace:"nowrap" }}>
                {s.startTime}–{s.endTime}
              </div>
            </div>
          ))}
        </div>

        {/* right column */}
        <div>
          {/* invoices summary */}
          <div style={{ ...S.card, marginBottom:"12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
              <div style={S.ct}>Invoices</div>
              <button style={{ ...S.bsm(T.blue), fontSize:"11px" }} onClick={()=>setTab("inv")}>View All →</button>
            </div>
            {[
              ["Drafts", drafts.length, "#94a3b8"],
              ["Outstanding", outstanding.length, T.amber],
              ["Overdue", overdue.length, T.red],
            ].map(([l,v,c]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(0,80,255,0.05)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:c }}/>
                  <span style={{ fontSize:"12px", color:T.textSub }}>{l}</span>
                </div>
                <span style={{ fontSize:"13px", fontWeight:"700", color:v>0?c:T.textMute }}>{v}</span>
              </div>
            ))}
            {!isGuest && <button style={{ ...S.bp, width:"100%", marginTop:"12px", padding:"9px" }} onClick={()=>setTab("inv")}>+ New Invoice</button>}
          </div>

          {/* quick links */}
          <div style={S.card}>
            <div style={S.ct}>Quick Access</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
              {[["📊 Reports","rep"],["💰 Revenue","pay"],["🗂 Saved Reports","his"],["🎯 Sales","sal"]].map(([l,id])=>(
                <button key={id} style={{ ...S.bo, padding:"10px", fontSize:"12px", textAlign:"center", borderRadius:"10px" }} onClick={()=>setTab(id)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id:"home", label:"Dashboard",    icon:"▦", section:"Operations" },
  { id:"emp",  label:"Employees",     icon:"👤", section:"Operations" },
  { id:"loc",  label:"Locations",     icon:"📍", section:"Operations" },
  { id:"cal",  label:"Calendar",      icon:"📅", section:"Operations" },
  { id:"rep",  label:"Reports",       icon:"📊", section:"Operations" },
  { id:"his",  label:"Saved Reports", icon:"🗂",  section:"Operations" },
  { id:"act",  label:"Activity Log",  icon:"📋", section:"Operations" },
  { id:"inv",  label:"Invoices",      icon:"🧾", section:"Finance" },
  { id:"pay",  label:"Revenue",       icon:"💰", section:"Finance" },
  { id:"sal",  label:"Sales",         icon:"🎯", section:"Finance" },
];

const PAGE_META = {
  home: { title:"Dashboard",     subtitle:"Welcome back — here's what's happening today" },
  emp: { title:"Employees",     subtitle:"Manage your employee records and personnel information" },
  loc: { title:"Locations",     subtitle:"Client sites, contracts, and billing rates" },
  cal: { title:"Calendar",      subtitle:"Schedules, shifts, and daily attendance" },
  rep: { title:"Reports",       subtitle:"Export hours by location and time period" },
  his: { title:"Saved Reports", subtitle:"Saved period reports" },
  act: { title:"Activity Log",  subtitle:"A running record of every change made in the app" },
  inv: { title:"Invoices",      subtitle:"Create and manage client invoices" },
  pay: { title:"Revenue",       subtitle:"Invoice payments, pending collections, and revenue tracking" },
  sal: { title:"Sales",         subtitle:"Lead pipeline and client acquisition" },
};

// ─── inject viewport meta and mobile CSS once ────────────────────────────────
if (!document.querySelector('meta[name="viewport"]')) {
  const vm = document.createElement("meta");
  vm.name = "viewport"; vm.content = "width=device-width, initial-scale=1, maximum-scale=1";
  document.head.appendChild(vm);
}
if (!document.getElementById("so-mobile-css")) {
  const st = document.createElement("style");
  st.id = "so-mobile-css";
  st.textContent = `
    html, body { height: 100%; }
    body { background: linear-gradient(135deg, #f2f6ff 0%, #f8f2ff 50%, #f2f9ff 100%); background-attachment: fixed; }
    @media (max-width: 768px) {
      .so-sidebar { transform: translateX(-100%); transition: transform 0.25s ease; }
      .so-sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,80,255,0.15); }
      .so-main { margin-left: 0 !important; padding: 68px 14px 40px !important; }
      .so-topbar { display: flex !important; }
    }
    @media (min-width: 769px) {
      .so-sidebar { transform: none !important; }
      .so-topbar { display: none !important; }
    }
  `;
  document.head.appendChild(st);
}

export default function App() {
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState("home");
  const [guards, setGuards] = useState([]);
  const [locs, setLocs] = useState([]);
  const [scs, setScs] = useState([]);
  const [ovs, setOvs] = useState([]);
  const [history, setHistory] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [invs, setInvsCache] = useState([]);
  const [todos, setTodos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quote, setQuote] = useState(null); // { text, author } | null
  const [repSd, setRepSd] = useState(() => new Date(Date.now()-14*86400000).toISOString().slice(0,10));
  const [repEd, setRepEd] = useState(() => todayStr());
  const [repSl, setRepSl] = useState("all");

  const isGuest = role === "guest";

  useEffect(() => {
    (async () => {
      const [g,l,sc,ov,hi,lg,iv,td] = await Promise.all([load(K.g),load(K.l),load(K.sc),load(K.ov),load(K.hi),load(K.log),load(K.inv),load(K.td)]);
      if(g) setGuards(g); if(l) setLocs(l); if(sc) setScs(sc); if(ov) setOvs(ov); if(hi) setHistory(hi);
      if(lg) setLogEntries(lg); if(iv) setInvsCache(iv); if(td) setTodos(td);
      setLoaded(true);
    })();
  }, []);

  // Keep invs cache in sync when invoices change (passed via context trick)
  const syncInvs = (u) => setInvsCache(u);

  const addLog = (action, category, description, detail="") => {
    if (isGuest) return;
    const entry = { id:uid(), timestamp:new Date().toISOString(), action, category, description, detail };
    setLogEntries(prev => {
      const updated = [entry, ...prev].slice(0, 500);
      save(K.log, updated);
      return updated;
    });
  };

  function handleLogin(r) {
    const q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
    setRole(r);
    setTab("home");
    setFadeIn(false);
    setQuote(q);
    setTimeout(() => setFadeIn(true), 50);
  }

  function handleSignOut() {
    const q = SIGN_OUT_QUOTES[Math.floor(Math.random()*SIGN_OUT_QUOTES.length)];
    setQuote(q);
    setTimeout(() => { setRole(null); setTab("home"); setFadeIn(false); }, 2800);
  }

  if (!role) return <Login onLogin={handleLogin} />;
  if (!loaded) return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"40px", height:"40px", margin:"0 auto 16px" }}><LogoMark size={40} radius={10}/></div>
        <div style={{ color:T.textSub, fontSize:"13px" }}>Loading SecureOps…</div>
      </div>
    </div>
  );

  const sections = ["Operations", "Finance"];
  const meta = PAGE_META[tab] || PAGE_META.home;
  const visibleTabs = isGuest ? TABS.filter(t => !["act"].includes(t.id)) : TABS;

  const navContent = (
    <>
      {isGuest && (
        <div style={{ margin:"10px 10px 0", padding:"8px 12px", background:"rgba(246,173,85,0.1)", border:"1px solid rgba(246,173,85,0.3)", borderRadius:"8px", fontSize:"11px", color:"#a07020", lineHeight:1.5 }}>
          👁 <strong>View only.</strong> You can view all data, generate reports, and download PDFs.
        </div>
      )}
      <nav style={S.sidebarNav}>
        {sections.map(section => (
          <div key={section}>
            <div style={S.sidebarSection}>{section}</div>
            {visibleTabs.filter(t=>t.section===section).map(t => (
              <button key={t.id} style={S.navItem(tab===t.id)} onClick={() => { setTab(t.id); setMenuOpen(false); }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:tab===t.id?T.blue:"rgba(0,80,255,0.15)", flexShrink:0 }}/>
                <span style={{ fontSize:"14px", lineHeight:1 }}>{t.icon}</span>
                <span>{t.label}</span>
                {!isGuest && t.id==="act" && logEntries.length>0 && (
                  <span style={{ marginLeft:"auto", background:T.blue, color:"#fff", fontSize:"9px", fontWeight:"700", padding:"1px 6px", borderRadius:"10px" }}>
                    {logEntries.length > 99 ? "99+" : logEntries.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={S.sidebarBottom}>
        <button style={S.signOutBtn} onClick={handleSignOut}>
          <span style={{ fontSize:"14px", lineHeight:1 }}>↩</span>
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div style={{ ...S.app, opacity:fadeIn?1:0, transition:"opacity 0.5s ease" }}>
      {/* Quote flash overlay */}
      {quote && <QuoteFlash quote={quote} onDone={()=>setQuote(null)}/>}

      {/* ── MOBILE TOP BAR ── */}
      <div className="so-topbar" style={{ display:"none", position:"fixed", top:0, left:0, right:0, height:"52px", background:"rgba(255,255,255,0.85)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.9)", zIndex:200, alignItems:"center", justifyContent:"space-between", padding:"0 16px", boxShadow:"0 1px 12px rgba(0,80,255,0.08)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <LogoMark size={28} radius={7}/>
          <span style={{ fontWeight:"700", fontSize:"14px", color:T.text }}>SecureOps</span>
        </div>
        <button onClick={()=>setMenuOpen(o=>!o)} style={{ background:"transparent", border:"none", cursor:"pointer", padding:"6px", fontSize:"20px", color:T.text, lineHeight:1 }}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ── MOBILE OVERLAY ── */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:149, backdropFilter:"blur(2px)" }} onClick={()=>setMenuOpen(false)}/>
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`so-sidebar${menuOpen?" open":""}`} style={{ ...S.sidebar, zIndex:150 }}>
        <div style={S.sidebarLogo}>
          <LogoMark size={32} radius={8}/>
          <div>
            <div style={S.sidebarLogoText}>SecureOps</div>
            <div style={{ fontSize:"10px", color:T.textMute }}>{isGuest ? "Guest View" : "Management"}</div>
          </div>
        </div>
        {navContent}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="so-main" style={{ ...S.main, paddingTop:"28px" }}>
        <div style={{ height:"0px" }} className="so-mobile-spacer"/>
        {tab !== "home" && <>
          <div style={S.pageTitle}>{meta.title}</div>
          <div style={S.pageSubtitle}>{meta.subtitle}</div>
        </>}
        {tab==="home" && <AppDashboard guards={guards} locs={locs} scs={scs} ovs={ovs} invs={invs} isGuest={isGuest} setTab={setTab} todos={todos} setTodos={setTodos}/>}
        {tab==="emp" && <Employees guards={guards} setGuards={setGuards} addLog={addLog} isGuest={isGuest} />}
        {tab==="loc" && <Locations locs={locs} setLocs={setLocs} addLog={addLog} isGuest={isGuest} />}
        {tab==="cal" && <Calendar guards={guards} locs={locs} scs={scs} setScs={setScs} ovs={ovs} setOvs={setOvs} addLog={addLog} isGuest={isGuest} />}
        {tab==="rep" && <Reports guards={guards} locs={locs} scs={scs} ovs={ovs} history={history} setHistory={setHistory} addLog={addLog} isGuest={isGuest} sd={repSd} setSd={setRepSd} ed={repEd} setEd={setRepEd} sl={repSl} setSl={setRepSl}/>}
        {tab==="his" && <History history={history} setHistory={setHistory} addLog={addLog} isGuest={isGuest} />}
        {tab==="act" && !isGuest && <ActivityLog logEntries={logEntries} setLogEntries={setLogEntries} />}
        {tab==="inv" && <Invoices locs={locs} addLog={addLog} isGuest={isGuest} onInvsChange={syncInvs}/>}
        {tab==="pay" && <Revenue locs={locs} addLog={addLog} isGuest={isGuest} />}
        {tab==="sal" && <Sales addLog={addLog} isGuest={isGuest} />}
      </main>
    </div>
  );
}