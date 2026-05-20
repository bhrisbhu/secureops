import { useState, useEffect, Fragment, useRef } from "react";

// ─── font ─────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
document.head.appendChild(fontLink);

// ─── storage ──────────────────────────────────────────────────────────────────
const K = { g:"so_g", l:"so_l", sc:"so_sc", ov:"so_ov", hi:"so_hi", pay:"so_pay", leads:"so_lds", inv:"so_inv", co:"so_co" };
import { load, save } from './supabase.js';

// ─── utils ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6","#a78bfa","#fb923c"];
const gc = i => COLS[i % COLS.length];
const dStr = (y,m,d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const pDate = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const toMin = t => { if (!t) return 0; const [h,m] = t.split(":").map(Number); return h*60+(m||0); };
const calcH = (s,e) => { let a=toMin(s),b=toMin(e); if(b<=a)b+=1440; return Math.round((b-a)/60*100)/100; };

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
  bg:       "#0c0f1a",   // page background
  surface:  "#111827",   // card surface
  surface2: "#1a2235",   // elevated surface
  border:   "#1f2d45",   // default border
  borderHi: "#2d4a6e",   // highlighted border
  blue:     "#3b82f6",   // primary accent
  blueDim:  "#1d4ed8",   // darker blue
  blueGlow: "#3b82f620", // blue glow bg
  text:     "#f0f6ff",   // primary text
  textSub:  "#8da3c0",   // secondary text
  textMute: "#3d5470",   // muted text
  green:    "#10b981",
  amber:    "#f59e0b",
  red:      "#ef4444",
  purple:   "#a78bfa",
};

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif", fontSize:"14px" },

  // sidebar
  sidebar: { position:"fixed", top:0, left:0, bottom:0, width:"220px", background:T.surface, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", zIndex:100, boxShadow:"4px 0 24px rgba(0,0,0,0.4)" },
  sidebarLogo: { padding:"24px 20px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:"10px" },
  sidebarLogoIcon: { width:"32px", height:"32px", background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", boxShadow:"0 2px 8px #3b82f640" },
  sidebarLogoText: { fontSize:"15px", fontWeight:"700", color:T.text, letterSpacing:"0.5px" },
  sidebarNav: { flex:1, padding:"12px 10px", overflowY:"auto" },
  sidebarSection: { fontSize:"9px", fontWeight:"700", color:T.textMute, textTransform:"uppercase", letterSpacing:"1.5px", padding:"8px 10px 4px" },
  navItem: active => ({
    display:"flex", alignItems:"center", gap:"10px", padding:"9px 12px", borderRadius:"8px",
    cursor:"pointer", border:"none", width:"100%", textAlign:"left", fontSize:"13px", fontWeight:"500",
    transition:"all 0.15s",
    background: active ? T.blueGlow : "transparent",
    color: active ? T.blue : T.textSub,
    borderLeft: active ? `2px solid ${T.blue}` : "2px solid transparent",
    marginBottom:"2px",
  }),
  navIcon: { fontSize:"15px", width:"20px", textAlign:"center" },
  sidebarBottom: { padding:"12px 10px", borderTop:`1px solid ${T.border}` },
  signOutBtn: { display:"flex", alignItems:"center", gap:"10px", padding:"9px 12px", borderRadius:"8px", cursor:"pointer", border:"none", width:"100%", textAlign:"left", fontSize:"13px", fontWeight:"500", background:"transparent", color:"#f87171", transition:"all 0.15s" },

  // main content
  main: { marginLeft:"220px", padding:"28px 32px", maxWidth:"1100px" },
  pageTitle: { fontSize:"22px", fontWeight:"700", color:T.text, marginBottom:"6px", letterSpacing:"-0.3px" },
  pageSubtitle: { fontSize:"13px", color:T.textSub, marginBottom:"24px" },

  // cards
  card: { background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"20px", marginBottom:"16px", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" },
  cardElevated: { background:T.surface2, borderRadius:"12px", border:`1px solid ${T.borderHi}`, padding:"20px", marginBottom:"16px", boxShadow:"0 4px 16px rgba(0,0,0,0.4)" },
  ct: { fontSize:"11px", fontWeight:"700", color:T.textSub, marginBottom:"14px", textTransform:"uppercase", letterSpacing:"1px", display:"flex", alignItems:"center", gap:"6px" },

  // form elements
  lbl: { display:"block", fontSize:"11px", fontWeight:"600", color:T.textSub, marginBottom:"5px" },
  inp: { width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"9px 12px", color:T.text, fontSize:"13px", outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" },
  sel: { width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"9px 12px", color:T.text, fontSize:"13px", outline:"none", boxSizing:"border-box" },
  ta: { width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"9px 12px", color:T.text, fontSize:"13px", outline:"none", boxSizing:"border-box", resize:"vertical", minHeight:"72px", lineHeight:"1.5" },

  // buttons
  bp: { background:"linear-gradient(135deg,#1d4ed8,#2563eb)", color:"#fff", border:"none", borderRadius:"8px", padding:"9px 18px", fontWeight:"600", fontSize:"13px", cursor:"pointer", boxShadow:"0 2px 8px #3b82f630", transition:"all 0.15s" },
  bs: { background:"#052e16", color:"#6ee7b7", border:`1px solid #065f46`, borderRadius:"8px", padding:"9px 16px", fontWeight:"600", fontSize:"13px", cursor:"pointer", transition:"all 0.15s" },
  bo: { background:"transparent", color:T.textSub, border:`1px solid ${T.border}`, borderRadius:"8px", padding:"8px 16px", fontWeight:"600", fontSize:"13px", cursor:"pointer", transition:"all 0.15s" },
  bd: { background:"transparent", color:T.red, border:`1px solid #7f1d1d`, borderRadius:"6px", padding:"5px 10px", fontSize:"12px", cursor:"pointer", transition:"all 0.15s" },
  bsm: c => ({ background:"transparent", color:c||T.textSub, border:`1px solid ${c||T.border}`, borderRadius:"6px", padding:"4px 10px", fontSize:"11px", cursor:"pointer", fontWeight:"600", transition:"all 0.15s" }),

  // table
  tbl: { width:"100%", borderCollapse:"collapse" },
  th: { textAlign:"left", padding:"10px 14px", fontSize:"11px", fontWeight:"600", color:T.textMute, textTransform:"uppercase", letterSpacing:"0.8px", borderBottom:`1px solid ${T.border}`, background:T.surface },
  td: { padding:"12px 14px", fontSize:"13px", borderBottom:`1px solid ${T.border}`, transition:"background 0.1s" },

  // stat cards
  stat: { background:T.surface, border:`1px solid ${T.border}`, borderRadius:"12px", padding:"18px 20px", textAlign:"left", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" },
  sn: { fontSize:"28px", fontWeight:"800", color:T.text, letterSpacing:"-1px", lineHeight:1 },
  sl: { fontSize:"11px", color:T.textSub, marginTop:"6px", fontWeight:"500" },

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
  divider: { height:"1px", background:T.border, margin:"16px 0" },
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, backdropFilter:"blur(4px)" }}>
      <div style={{ background:T.surface2, border:`1px solid ${T.red}40`, borderRadius:"16px", padding:"28px 32px", maxWidth:"380px", width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.6)", textAlign:"center" }}>
        <div style={{ width:"48px", height:"48px", borderRadius:"50%", background:"#ef444418", border:"1px solid #ef444430", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:"22px" }}>⚠️</div>
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
      if (u==="security"&&p==="security") onLogin();
      else { setErr("Invalid username or password."); setP(""); setLoading(false); }
    }, 400);
  };
  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans',-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ width:"100%", maxWidth:"400px", padding:"0 20px" }}>
        <div style={{ textAlign:"center", marginBottom:"40px" }}>
          <div style={{ width:"56px", height:"56px", background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", borderRadius:"14px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"26px", margin:"0 auto 16px", boxShadow:"0 8px 32px #3b82f640" }}>🛡</div>
          <div style={{ fontSize:"24px", fontWeight:"700", color:T.text, letterSpacing:"-0.5px" }}>SecureOps</div>
          <div style={{ fontSize:"13px", color:T.textSub, marginTop:"4px" }}>Business Administration Platform</div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"16px", padding:"32px", boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize:"16px", fontWeight:"600", color:T.text, marginBottom:"24px" }}>Sign in to your account</div>
          <div style={{ marginBottom:"16px" }}>
            <label style={S.lbl}>Username</label>
            <input style={{ ...S.inp, padding:"11px 14px" }} value={u} onChange={e=>setU(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus placeholder="Enter username"/>
          </div>
          <div style={{ marginBottom:"24px" }}>
            <label style={S.lbl}>Password</label>
            <input style={{ ...S.inp, padding:"11px 14px" }} type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Enter password"/>
          </div>
          {err && <div style={{ background:"#ef444412", border:"1px solid #ef444430", borderRadius:"8px", padding:"10px 14px", fontSize:"13px", color:"#fca5a5", marginBottom:"16px" }}>{err}</div>}
          <button style={{ ...S.bp, width:"100%", padding:"12px", fontSize:"14px", borderRadius:"10px", opacity:loading?0.7:1 }} onClick={go} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
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
function Employees({ guards, setGuards }) {
  const blank = { name:"",badge:"",phone:"",email:"",sin:"",dob:"",address:"",startDate:"",endDate:"",wage:"",status:"Active",notes:"" };
  const [form, setForm] = useState(blank); const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState(""); const [exp, setExp] = useState(null);
  const [confirmEl, ask] = useConfirm();
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  function submit() {
    if (!form.name.trim()) return;
    const entry = { ...form, id: editing || uid() };
    const u = editing ? guards.map(g => g.id===editing ? entry : g) : [...guards, entry];
    setGuards(u); save(K.g, u); setForm(blank); setEditing(null);
    if (editing) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }
  const del = id => ask("Delete this employee? This cannot be undone.", () => { const u = guards.filter(g=>g.id!==id); setGuards(u); save(K.g,u); });
  const edit = g => {
    setForm({...blank,...g}); setEditing(g.id); setExp(null);
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
      </div>

      {/* ── MASS WAGE UPDATE ── */}
      <MassWageUpdate guards={guards} setGuards={setGuards} ask={ask} />

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
                  <tr style={{ background: exp===g.id?"#091420":"transparent" }}>
                    <td style={S.td}><span style={{ color:gc(i), cursor:"pointer", fontWeight:"700" }} onClick={()=>setExp(exp===g.id?null:g.id)}>{g.name}</span></td>
                    <td style={S.td}>{g.badge||"—"}</td><td style={S.td}>{g.dob||"—"}</td>
                    <td style={S.td}>{g.startDate||"—"}</td>
                    <td style={S.td}>{g.endDate?<span style={{ color:"#f87171" }}>{g.endDate}</span>:"—"}</td>
                    <td style={S.td}>{g.wage?`$${parseFloat(g.wage).toFixed(2)}/hr`:"—"}</td>
                    <td style={S.td}><span style={S.pill(g.status==="Active"?"#10b981":g.status==="On Leave"?"#f59e0b":"#6b7280")}>{g.status}</span></td>
                    <td style={S.td}><F><button style={S.bsm()} onClick={()=>edit(g)}>Edit</button><button style={S.bd} onClick={()=>del(g.id)}>✕</button></F></td>
                  </tr>
                  {exp===g.id && <tr><td colSpan={8} style={{ ...S.td, background:"#091420" }}><F style={{ fontSize:"10px", color:"#5a8ab0" }}>{[["Email",g.email],["SIN",g.sin],["Address",g.address],["Notes",g.notes]].map(([l,v])=><span key={l}><span style={{ color:"#3a6a8a" }}>{l}: </span>{v||"—"}</span>)}</F></td></tr>}
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
function Locations({ locs, setLocs }) {
  const blankL = { name:"", client:"", contactName:"", contactEmail:"", contactPhone:"", clientAddress:"", contractStart:"", contractEnd:"", notes:"", rates:[] };
  const [form, setForm] = useState(blankL);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const blankRate = { effectiveDate:"", rate:"", notes:"" };
  const [rateForm, setRateForm] = useState(blankRate);
  const [confirmEl, ask] = useConfirm();

  const ff = k => e => setForm(p=>({...p,[k]:e.target.value}));

  function submit() {
    if (!form.client.trim() && !form.name.trim()) {
      alert("Please enter at least a Client / Company Name.");
      return;
    }
    // If location name left blank, use client name as the location name
    const entry = {
      ...form,
      id: editing || uid(),
      name: form.name.trim() || form.client.trim(),
    };
    const u = editing ? locs.map(l=>l.id===editing?entry:l) : [...locs, entry];
    setLocs(u); save(K.l, u); setForm(blankL); setEditing(null); setShowForm(false);
  }
  function edit(l) { setForm({...blankL,...l, rates:l.rates||[]}); setEditing(l.id); setShowForm(true); setExpanded(null); }
  function del(id) { ask("Delete this location/client? This cannot be undone.", () => { const u=locs.filter(l=>l.id!==id); setLocs(u); save(K.l,u); }); }

  function addRate(locId) {
    if (!rateForm.effectiveDate || !rateForm.rate) return;
    const u = locs.map(l => {
      if (l.id!==locId) return l;
      const rates = [...(l.rates||[]), { ...rateForm, id:uid() }].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate));
      return { ...l, rates };
    });
    setLocs(u); save(K.l, u); setRateForm(blankRate);
  }
  function delRate(locId, rateId) {
    ask("Delete this billing rate entry?", () => {
      const u = locs.map(l => l.id!==locId ? l : { ...l, rates:(l.rates||[]).filter(r=>r.id!==rateId) });
      setLocs(u); save(K.l, u);
    });
  }

  function currentRate(loc) {
    const today = new Date().toISOString().slice(0,10);
    const past = (loc.rates||[]).filter(r=>r.effectiveDate<=today).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
    return past[0] || null;
  }

  return (
    <div>
      {confirmEl}

      {/* ── TOOLBAR ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <span style={{ fontSize:"11px", color:"#5a8ab0" }}>{locs.length} location{locs.length!==1?"s":""}</span>
        <button style={S.bp} onClick={()=>{setForm(blankL);setEditing(null);setShowForm(s=>!s);}}>
          {showForm?"Cancel":"+ Add Location"}
        </button>
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <div style={{ ...S.card, border:"1px solid #2563eb" }}>
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
            <div><label style={S.lbl}>Contract End Date</label><input style={{ ...S.inp, borderColor: form.contractEnd && form.contractEnd < new Date().toISOString().slice(0,10) ? "#ef4444" : undefined }} type="date" value={form.contractEnd} onChange={ff("contractEnd")}/></div>
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
          const contractExpired = l.contractEnd && l.contractEnd < new Date().toISOString().slice(0,10);
          return (
            <div key={l.id} style={S.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"8px" }}>
                <div style={{ cursor:"pointer", flex:1 }} onClick={()=>setExpanded(isExp?null:l.id)}>
                  <div style={{ fontWeight:"700", color:"#e0f0ff", fontSize:"13px" }}>
                    {l.name}
                  </div>
                  {l.client && <div style={{ fontSize:"11px", color:"#5a8ab0", marginTop:"1px" }}>Client: {l.client}</div>}
                  {l.clientAddress && <div style={{ fontSize:"10px", color:"#3a6a8a", marginTop:"1px" }}>{l.clientAddress}</div>}
                  <div style={{ display:"flex", gap:"8px", marginTop:"4px", flexWrap:"wrap" }}>
                    {cr && <span style={S.pill("#10b981")}>Rate: ${parseFloat(cr.rate).toFixed(2)}/hr</span>}
                    {l.contractEnd && <span style={S.pill(contractExpired?"#ef4444":"#3b82f6")}>{contractExpired?"Expired":"Until"}: {l.contractEnd}</span>}
</div>
                </div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  <button style={S.bsm()} onClick={()=>edit(l)}>Edit</button>
                  <button style={S.bd} onClick={()=>del(l.id)}>Delete</button>
                  <button style={S.bsm()} onClick={()=>setExpanded(isExp?null:l.id)}>{isExp?"▲":"▼"}</button>
                </div>
              </div>

              {isExp && (
                <div style={{ marginTop:"12px", borderTop:"1px solid #1e3a5f", paddingTop:"12px" }}>
                  <div style={{ display:"flex", gap:"20px", fontSize:"11px", color:"#5a8ab0", flexWrap:"wrap", marginBottom:"14px" }}>
                    {[["Contact",l.contactName],["Email",l.contactEmail],["Phone",l.contactPhone],["Contract Start",l.contractStart],["Contract End",l.contractEnd]].map(([label,val])=>val?(
                      <div key={label}><span style={{ color:"#3a6a8a" }}>{label}: </span>{val}</div>
                    ):null)}
{l.notes && <div style={{ width:"100%" }}><span style={{ color:"#3a6a8a" }}>Notes: </span>{l.notes}</div>}
                  </div>

                  <div style={{ background:"#070d19", borderRadius:"7px", padding:"12px" }}>
                    <div style={{ fontSize:"10px", fontWeight:"700", color:"#5a8ab0", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>Billing Rate History</div>
                    {(l.rates||[]).length===0 && <div style={{ fontSize:"11px", color:"#3a6a8a", marginBottom:"8px" }}>No rates recorded yet.</div>}
                    {(l.rates||[]).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate)).map(r=>(
                      <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #1e3a5f" }}>
                        <div>
                          <span style={{ fontWeight:"700", color:"#34d399" }}>${parseFloat(r.rate).toFixed(2)}/hr</span>
                          <span style={{ fontSize:"10px", color:"#5a8ab0", marginLeft:"10px" }}>Effective: {r.effectiveDate}</span>
                          {r.notes && <span style={{ fontSize:"10px", color:"#3a6a8a", marginLeft:"8px" }}>— {r.notes}</span>}
                        </div>
                        <button style={S.bd} onClick={()=>delRate(l.id,r.id)}>✕</button>
                      </div>
                    ))}
                    <div style={{ marginTop:"10px" }}>
                      <div style={{ fontSize:"9px", color:"#3a6a8a", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"0.5px" }}>Add New Rate</div>
                      <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", alignItems:"flex-end" }}>
                        <div><label style={S.lbl}>Effective Date</label><input style={{ ...S.inp, width:"140px" }} type="date" value={rateForm.effectiveDate} onChange={e=>setRateForm(p=>({...p,effectiveDate:e.target.value}))}/></div>
                        <div><label style={S.lbl}>Rate ($/hr)</label><input style={{ ...S.inp, width:"100px" }} type="number" step="0.01" value={rateForm.rate} onChange={e=>setRateForm(p=>({...p,rate:e.target.value}))} placeholder="23.00"/></div>
                        <div style={{ flex:1 }}><label style={S.lbl}>Note (optional)</label><input style={S.inp} value={rateForm.notes} onChange={e=>setRateForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. Rate increase Jan 2026"/></div>
                        <button style={S.bs} onClick={()=>addRate(l.id)}>Add Rate</button>
                      </div>
                    </div>
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
function Calendar({ guards, locs, scs, setScs, ovs, setOvs }) {
  const today = new Date();
  const [yr, setYr] = useState(today.getFullYear()); const [mo, setMo] = useState(today.getMonth());
  const [sel, setSel] = useState(null); const [sub, setSub] = useState("cal");
  const [sf, setSf] = useState({ guardId:"", locationId:"", days:[], startTime:"", endTime:"", effectiveFrom:"", effectiveTo:"" });
  const [adjG, setAdjG] = useState(null);
  const [adj, setAdj] = useState({ startTime:"", endTime:"", regularHours:"", statHours:"", absent:false, locationId:"", notes:"" });
  const [confirmEl, ask] = useConfirm();
  const [daySearch, setDaySearch] = useState("");
  const [bulk, setBulk] = useState({ guardId:"", fromDate:"", toDate:"" });
  const [bulkResult, setBulkResult] = useState(null); // { deleted, previewing }

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
  };
  const delSc = id => ask(
    "Remove this recurring schedule?\n\nAll past days from this schedule will be permanently saved so your historical hours are not lost.",
    () => {
      const sc = scs.find(s => s.id === id);
      if (!sc) return;

      // Bake every past scheduled day into a permanent override
      // so historical calendar data survives the schedule deletion.
      const today = new Date().toISOString().slice(0,10);
      const start = sc.effectiveFrom || "2020-01-01";
      // End at yesterday (today's shift may still be in progress) or the schedule's end date, whichever is earlier
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
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
    const ds = dStr(yr,mo,sel);
    const base = ovs.filter(o=>!(o.date===ds&&o.guardId===adjG.id));
    const ov = { id:uid(), date:ds, guardId:adjG.id, locationId:adj.locationId, startTime:adj.startTime, endTime:adj.endTime, regularHours:adj.absent?0:(parseFloat(adj.regularHours)||0), statHours:adj.absent?0:(parseFloat(adj.statHours)||0), absent:adj.absent, notes:adj.notes };
    const u=[...base,ov]; setOvs(u); save(K.ov,u); setAdjG(null);
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
      <F style={{ marginBottom:"12px" }}>
        {[["cal","📅 Calendar"],["sch","🔁 Schedules"],["bulk","🗑 Bulk Delete Hours"]].map(([t,l])=><button key={t} style={{ ...S.bp, background:sub===t?"#1d4ed8":"transparent", color:sub===t?"#fff":"#4a8ab0", border:"1px solid #1e3a5f" }} onClick={()=>{setSub(t);setBulkResult(null);}}>{l}</button>)}
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
            {sf.startTime&&sf.endTime&&<div style={{ marginTop:"4px", fontSize:"10px", color:"#5a8ab0" }}>→ {calcH(sf.startTime,sf.endTime)}h {toMin(sf.endTime)<toMin(sf.startTime)?"(overnight)":""}</div>}
            <div style={{ ...S.g2, marginTop:"9px" }}>
              <div>
                <label style={{ ...S.lbl, color:"#60a5fa" }}>Effective From * <span style={{ color:"#3a6a8a", textTransform:"none", fontWeight:"400" }}>(schedule starts on this date)</span></label>
                <input style={{ ...S.inp, borderColor:"#2563eb" }} type="date" value={sf.effectiveFrom} onChange={e=>setSf(p=>({...p,effectiveFrom:e.target.value}))}/>
              </div>
              <div>
                <label style={{ ...S.lbl, color:"#f59e0b" }}>Effective To <span style={{ color:"#3a6a8a", textTransform:"none", fontWeight:"400" }}>(leave blank = ongoing)</span></label>
                <input style={{ ...S.inp, borderColor:"#92400e" }} type="date" value={sf.effectiveTo} onChange={e=>setSf(p=>({...p,effectiveTo:e.target.value}))}/>
              </div>
            </div>
            <div style={{ marginTop:"9px" }}><label style={S.lbl}>Recurring Days</label>
              <F style={{ marginTop:"4px" }}>{DAYS.map((d,i)=><button key={i} onClick={()=>togDay(i)} style={{ padding:"5px 9px", borderRadius:"4px", cursor:"pointer", fontWeight:"700", fontSize:"10px", background:sf.days.includes(i)?"#1d4ed8":"#0a1628", color:sf.days.includes(i)?"#fff":"#4a8ab0", border:`1px solid ${sf.days.includes(i)?"#3b82f6":"#1e3a5f"}` }}>{d}</button>)}</F>
            </div>
            <div style={{ marginTop:"9px", padding:"10px", background:"#070d19", borderRadius:"6px", fontSize:"10px", color:"#3a6a8a", lineHeight:1.6 }}>
              💡 <strong style={{ color:"#5a8ab0" }}>How date ranges work:</strong> The calendar only shows this schedule on days within the Effective From / To window. 
              Deleting a schedule <strong style={{ color:"#e0f0ff" }}>never</strong> changes past days — only overrides (manual adjustments) can do that.
              To change a schedule mid-month, set an end date on the old one and create a new one with the new start date.
            </div>
            <button style={{ ...S.bp, marginTop:"9px" }} onClick={addSc}>Save Schedule</button>
          </div>
          <div style={S.card}>
            <div style={S.ct}>All Recurring Schedules ({scs.length})</div>
            {scs.length===0 ? <div style={S.empty}>None.</div> : (
              <table style={S.tbl}>
                <thead><tr>{["Employee","Location","Days","Shift","Hours","Active From","Active To",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...scs].sort((a,b)=>{
                    const na=guards.find(g=>g.id===a.guardId)?.name||"";
                    const nb=guards.find(g=>g.id===b.guardId)?.name||"";
                    return na!==nb ? na.localeCompare(nb) : (a.effectiveFrom||"").localeCompare(b.effectiveFrom||"");
                  }).map(sc => {
                    const today = new Date().toISOString().slice(0,10);
                    const isActive = (!sc.effectiveFrom||today>=sc.effectiveFrom) && (!sc.effectiveTo||today<=sc.effectiveTo);
                    const isPast   = sc.effectiveTo && today > sc.effectiveTo;
                    return (
                      <tr key={sc.id} style={{ opacity: isPast ? 0.5 : 1 }}>
                        <td style={S.td}><span style={{ color:gc(gIdx(sc.guardId)), fontWeight:"700" }}>{gName(sc.guardId)}</span></td>
                        <td style={S.td}>{lName(sc.locationId)}</td>
                        <td style={S.td}>{sc.days.map(d=>DAYS[d]).join(", ")}</td>
                        <td style={S.td}>{sc.startTime}–{sc.endTime}{toMin(sc.endTime)<toMin(sc.startTime)?" 🌙":""}</td>
                        <td style={S.td}>{sc.hours}h</td>
                        <td style={S.td}>
                          <span style={S.pill(isActive&&!isPast ? "#60a5fa" : "#3a6a8a")}>
                            {sc.effectiveFrom||"—"}
                          </span>
                        </td>
                        <td style={S.td}>
                          {sc.effectiveTo
                            ? <span style={S.pill(isPast?"#6b7280":"#f59e0b")}>{sc.effectiveTo}{isPast?" (ended)":""}</span>
                            : <span style={S.pill("#10b981")}>Ongoing</span>
                          }
                        </td>
                        <td style={S.td}><button style={S.bd} onClick={()=>delSc(sc.id)}>Remove</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {sub==="bulk" && (
        <div>
          <div style={{ ...S.card, border:"1px solid #ef444444" }}>
            <div style={S.ct}>🗑 Bulk Delete Employee Hours</div>
            <div style={{ fontSize:"11px", color:"#5a8ab0", marginBottom:"14px", lineHeight:1.6 }}>
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
                  <div style={{ fontSize:"10px", fontWeight:"700", color:"#5a8ab0", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>
                    Preview — {hits.length} day{hits.length!==1?"s":""} found for {gName}
                  </div>
                  {hits.length === 0 ? (
                    <div style={{ fontSize:"11px", color:"#3a6a8a", padding:"8px 0" }}>
                      No hours found for this employee in the selected date range.
                    </div>
                  ) : (
                    <div style={{ background:"#070d19", borderRadius:"7px", padding:"10px", maxHeight:"260px", overflowY:"auto" }}>
                      {hits.map(h => (
                        <div key={h.date} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #1e3a5f", fontSize:"11px" }}>
                          <span style={{ color:"#dce8f5" }}>
                            {h.date} <span style={{ color:"#3a6a8a" }}>({DAYS[pDate(h.date).getDay()]})</span>
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
              <div style={{ marginTop:"12px", padding:"10px 14px", background:"#064e3b", borderRadius:"7px", border:"1px solid #059669", fontSize:"11px", color:"#6ee7b7" }}>
                ✓ Deleted {bulkResult.deleted} day{bulkResult.deleted!==1?"s":""} of hours for {bulkResult.name}.
              </div>
            )}
          </div>
        </div>
      )}
      {sub==="cal" && (
        <div style={{ display:"grid", gridTemplateColumns:sel?"1fr 320px":"1fr", gap:"14px", alignItems:"start" }}>
          <div style={S.card}>
            <F style={{ justifyContent:"space-between", marginBottom:"12px" }}>
              <button style={S.bo} onClick={prev}>‹</button>
              <span style={{ fontSize:"14px", fontWeight:"700", color:"#e0f0ff" }}>{MONTHS[mo]} {yr}</span>
              <button style={S.bo} onClick={next}>›</button>
            </F>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px", marginBottom:"3px" }}>{DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:"8px", fontWeight:"700", color:"#3a6a8a", padding:"2px" }}>{d}</div>)}</div>
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
                  <div key={d} onClick={()=>{setSel(isSel?null:d); setDaySearch("");}} style={{ minHeight:"58px", borderRadius:"5px", padding:"4px", cursor:"pointer", background:isSel?"#162a50":isTod?"#0d2040":"#0a1628", border:`1px solid ${isSel?"#2563eb":isTod?"#1a4070":"#1e3a5f"}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                      <span style={{ fontSize:"10px", fontWeight:"700", color:isTod?"#60a5fa":"#5a8ab0" }}>{d}</span>
                      <span style={{ fontSize:"7px" }}>{hasSt?"🌟":""}{hasOv?"✎":""}</span>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"2px" }}>{shfts.slice(0,5).map(s=><div key={s.guardId} style={{ width:"6px", height:"6px", borderRadius:"50%", background:gc(gIdx(s.guardId)) }} title={s.guard.name} />)}{shfts.length>5&&<span style={{ fontSize:"7px", color:"#3a6a8a" }}>+{shfts.length-5}</span>}</div>
                    {shfts.length>0&&<div style={{ fontSize:"7px", color:"#3a6a8a", marginTop:"1px" }}>{shfts.length}g</div>}
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
                  <span style={{ fontSize:"9px", color:"#3a6a8a" }}>{allOn.length} on duty</span>
                </div>
                {allOn.length > 0 && (
                  <input
                    style={{ ...S.inp, marginBottom:"10px" }}
                    placeholder="Search employee…"
                    value={daySearch}
                    onChange={e => setDaySearch(e.target.value)}
                  />
                )}
                {allOn.length===0 && <div style={{ ...S.empty, padding:"10px" }}>No employees scheduled.</div>}
                {allOn
                  .filter(g => g.name.toLowerCase().includes(daySearch.toLowerCase()))
                  .map(g => {
                  const sh = effShift(selDs,g.id,scs,ovs);
                  const ov = ovs.find(o=>o.date===selDs&&o.guardId===g.id);
                  const idx = gIdx(g.id);
                  const reg = sh?.regularHours||sh?.hours||0, stat = sh?.statHours||0;
                  return (
                    <div key={g.id} style={{ background:"#070d19", borderRadius:"5px", padding:"8px", marginBottom:"6px", borderLeft:`3px solid ${gc(idx)}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <div><div style={{ fontWeight:"700", color:gc(idx), fontSize:"11px" }}>{g.name}</div><div style={{ fontSize:"9px", color:"#3a6a8a" }}>{sh?.locationId?lName(sh.locationId):"—"}{sh?.startTime?` · ${sh.startTime}–${sh.endTime}`:""}</div></div>
                        <div style={{ textAlign:"right" }}>{sh?.absent?<span style={S.pill("#ef4444")}>Absent</span>:<div>{reg>0&&<div style={{ fontSize:"10px", color:"#e0f0ff", fontWeight:"700" }}>{reg}h reg</div>}{stat>0&&<div style={{ fontSize:"9px", color:"#fbbf24" }}>{stat}h stat ★</div>}</div>}{ov&&<div style={{ fontSize:"8px", color:"#34d399" }}>adj</div>}</div>
                      </div>
                      <F style={{ marginTop:"6px" }}><button style={S.bsm("#60a5fa")} onClick={()=>openAdj(g)}>Adjust</button>{ov&&<button style={S.bsm("#f87171")} onClick={()=>remAdj(g.id)}>Reset</button>}</F>
                    </div>
                  );
                })}
                {daySearch && allOn.filter(g=>g.name.toLowerCase().includes(daySearch.toLowerCase())).length===0 && (
                  <div style={{ fontSize:"11px", color:"#3a6a8a", textAlign:"center", padding:"10px 0" }}>No employees match "{daySearch}"</div>
                )}
                <div style={{ marginTop:"8px", borderTop:"1px solid #1e3a5f", paddingTop:"8px" }}>
                  <label style={S.lbl}>Add employee for this day</label>
                  <select style={S.sel} value="" onChange={e=>{ if(e.target.value){ const g=guards.find(x=>x.id===e.target.value); if(g) openAdj(g); } }}><option value="">Select…</option>{unsch.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
                </div>
              </div>
              {adjG && (
                <div style={{ ...S.card, border:"1px solid #2563eb" }}>
                  <div style={S.ct}>Adjust: {adjG.name}</div>
                  <label style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"10px", color:"#e0f0ff", cursor:"pointer", marginBottom:"9px" }}><input type="checkbox" checked={adj.absent} onChange={e=>setAdj(p=>({...p,absent:e.target.checked}))}/>Mark Absent</label>
                  {!adj.absent&&<div>
                    <div style={S.g2}><Inp label="Start" type="time" value={adj.startTime} onChange={e=>setAdj(p=>({...p,startTime:e.target.value}))}/><Inp label="End" type="time" value={adj.endTime} onChange={e=>setAdj(p=>({...p,endTime:e.target.value}))}/></div>
                    <div style={{ ...S.g2, marginTop:"7px" }}><Inp label="Regular Hours" type="number" step="0.5" value={adj.regularHours} onChange={e=>setAdj(p=>({...p,regularHours:e.target.value}))} placeholder="0"/><div><label style={{ ...S.lbl, color:"#fbbf24" }}>Stat Hours (1.5×)</label><input style={{ ...S.inp, borderColor:"#92400e" }} type="number" step="0.5" value={adj.statHours} onChange={e=>setAdj(p=>({...p,statHours:e.target.value}))} placeholder="0"/></div></div>
                    <div style={{ marginTop:"7px" }}><Sel label="Location" value={adj.locationId} onChange={e=>setAdj(p=>({...p,locationId:e.target.value}))}><option value="">Select…</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Sel></div>
                    <div style={{ marginTop:"7px" }}><Inp label="Notes" value={adj.notes} onChange={e=>setAdj(p=>({...p,notes:e.target.value}))} placeholder="Reason…"/></div>
                  </div>}
                  <F style={{ marginTop:"9px" }}><button style={S.bp} onClick={saveAdj}>Save</button><button style={S.bo} onClick={()=>setAdjG(null)}>Cancel</button></F>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════
function Reports({ guards, locs, scs, ovs, history, setHistory }) {
  const tod = new Date().toISOString().slice(0,10);
  const two = new Date(Date.now()-14*86400000).toISOString().slice(0,10);
  const [sd, setSd] = useState(two); const [ed, setEd] = useState(tod); const [sl, setSl] = useState("all");
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
    const u=[e,...history].slice(0,50); setHistory(u); save(K.hi,u); alert("Saved to History!");
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
          <button style={{ ...S.bs, marginTop:"13px" }} onClick={saveHist}>💾 Save to History</button>
        </F>
      </div>
      {shown.length===0&&<div style={S.card}><div style={S.empty}>No locations added yet.</div></div>}
      {shown.map(l=>{
        const gm=buildRpt(l.id); const ents=Object.entries(gm);
        const tr=ents.reduce((s,[,g])=>s+g.regular,0), ts=ents.reduce((s,[,g])=>s+g.stat,0);
        return(
          <div key={l.id} style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px", flexWrap:"wrap", gap:"8px" }}>
              <div><div style={{ fontSize:"13px", fontWeight:"800", color:"#e0f0ff" }}>{l.name}</div>{l.client&&<div style={{ fontSize:"9px", color:"#3a6a8a" }}>Client: {l.client}</div>}</div>
              <F>
                <div style={{ textAlign:"center" }}><div style={{ fontSize:"14px", fontWeight:"800", color:"#60a5fa" }}>{tr.toFixed(2)}h</div><div style={{ fontSize:"8px", color:"#3a6a8a" }}>Regular</div></div>
                {ts>0&&<div style={{ textAlign:"center" }}><div style={{ fontSize:"14px", fontWeight:"800", color:"#fbbf24" }}>{ts.toFixed(2)}h</div><div style={{ fontSize:"8px", color:"#3a6a8a" }}>Stat ★</div></div>}
                <div style={{ textAlign:"center" }}><div style={{ fontSize:"14px", fontWeight:"800", color:"#34d399" }}>{(tr+ts).toFixed(2)}h</div><div style={{ fontSize:"8px", color:"#3a6a8a" }}>Total</div></div>
                <button style={S.bs} onClick={()=>doExcel(l)}>📊 Excel</button>
              </F>
            </div>
            {ents.length===0?<div style={S.empty}>No hours.</div>:<table style={S.tbl}><thead><tr>{["Employee","Regular","Stat ★","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{ents.map(([gid,g])=><tr key={gid}><td style={S.td}><span style={{ color:gc(gIdx(gid)), fontWeight:"700" }}>{g.name}</span></td><td style={S.td}>{g.regular.toFixed(2)}h</td><td style={S.td}>{g.stat>0?<span style={{ color:"#fbbf24", fontWeight:"700" }}>{g.stat.toFixed(2)}h</span>:"—"}</td><td style={S.td}><strong style={{ color:"#e0f0ff" }}>{(g.regular+g.stat).toFixed(2)}h</strong></td></tr>)}</tbody></table>}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
function History({ history, setHistory }) {
  const [exp, setExp] = useState(null);
  const [confirmEl, ask] = useConfirm();
  const del = id => ask("Delete this saved report?", ()=>{ const u=history.filter(h=>h.id!==id); setHistory(u); save(K.hi,u); if(exp===id)setExp(null); });
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
              <div><div style={{ fontWeight:"700", color:"#e0f0ff", fontSize:"12px" }}>{h.startDate} → {h.endDate}</div><div style={{ fontSize:"9px", color:"#3a6a8a", marginTop:"2px" }}>Saved {new Date(h.savedAt).toLocaleString()} · {h.data.length} loc · {tot.toFixed(2)}h</div></div>
              <F><span style={{ fontSize:"14px", fontWeight:"800", color:"#60a5fa" }}>{tot.toFixed(2)}h</span><button style={S.bs} onClick={e=>{e.stopPropagation();doExcel(h);}}>📊</button><button style={S.bd} onClick={e=>{e.stopPropagation();del(h.id);}}>Delete</button><span style={{ color:"#3a6a8a" }}>{open?"▲":"▼"}</span></F>
            </div>
            {open&&<div style={{ marginTop:"10px", borderTop:"1px solid #1e3a5f", paddingTop:"10px" }}>
              {h.data.map(l=>{const ents=Object.entries(l.guards);if(!ents.length)return null;const lr=ents.reduce((s,[,g])=>s+g.regular,0),ls=ents.reduce((s,[,g])=>s+g.stat,0);return(<div key={l.locationId} style={{ marginBottom:"10px" }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}><span style={{ fontWeight:"700", color:"#7ab3d3", fontSize:"11px" }}>{l.locationName}{l.client?" · "+l.client:""}</span><span style={{ fontSize:"9px", color:"#5a8ab0" }}>{lr.toFixed(2)}h reg{ls>0?" + "+ls.toFixed(2)+"h stat":""}</span></div><table style={S.tbl}><thead><tr>{["Employee","Regular","Stat","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{ents.map(([gid,g])=><tr key={gid}><td style={S.td}>{g.name}</td><td style={S.td}>{g.regular.toFixed(2)}h</td><td style={S.td}>{g.stat>0?<span style={{ color:"#fbbf24" }}>{g.stat.toFixed(2)}h ★</span>:"—"}</td><td style={S.td}><strong>{(g.regular+g.stat).toFixed(2)}h</strong></td></tr>)}</tbody></table></div>);})}
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
function Revenue({ locs }) {
  const [pays, setPays] = useState([]);
  const [invs, setInvs] = useState([]);
  const [rdy, setRdy] = useState(false);
  const [fCl, setFCl] = useState("all");
  const [fSd, setFSd] = useState(`${new Date().getFullYear()}-01-01`);
  const [fEd, setFEd] = useState(new Date().toISOString().slice(0,10));
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
    setForm(blank); setEditing(null); setShow(false);
  }
  function editRow(r) {
    if (r.fromInvoice) { alert("This record comes from an invoice. Edit the invoice directly in the Invoices tab."); return; }
    setForm({...blank,...r}); setEditing(r.id); setShow(true);
  }
  function delRow(r) {
    if (r.fromInvoice) { alert("This record is linked to an invoice. To remove it, delete the invoice in the Invoices tab."); return; }
    ask("Delete this payment record?", () => savePays(pays.filter(p=>p.id!==r.id)));
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
          <button style={{ ...S.bp, marginTop:"13px" }} onClick={()=>{setForm(blank);setEditing(null);setShow(s=>!s);}}>+ Add Manual Entry</button>
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
      {show && (
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
                  const rowBg = r.received ? "#030f07" : r.status==="overdue" ? "#1a0505" : "transparent";
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
                          {!isInv && <button style={S.bsm(T.blue)} onClick={()=>editRow(r)}>Edit</button>}
                          {isInv && <span style={{ fontSize:"10px", color:T.textMute }}>via Invoice</span>}
                          <button style={S.bd} onClick={()=>delRow(r)}>✕</button>
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

function Sales() {
  const [leads, setLeads] = useState([]); const [rdy, setRdy] = useState(false);
  const [view, setView] = useState("board"); const [editing, setEditing] = useState(null);
  const [fStage, setFStage] = useState("all"); const [srch, setSrch] = useState("");
  const blank = { companyName:"", contactName:"", phone:"", email:"", address:"", serviceType:"", estimatedValue:"", stage:"New Lead", priority:"Medium", source:"", notes:"", nextAction:"", nextActionDate:"", createdAt:"", contractDate:"" };
  const [form, setForm] = useState(blank);
  const [confirmEl, ask] = useConfirm();
  useEffect(()=>{(async()=>{const d=await load(K.leads);if(d)setLeads(d);setRdy(true);})();},[]);
  const saveLeads = u => { setLeads(u); save(K.leads,u); };
  const ff = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const startNew = () => { setForm({...blank,createdAt:new Date().toISOString().slice(0,10)}); setEditing(null); setView("form"); };
  const startEdit = l => { setForm({...blank,...l}); setEditing(l.id); setView("form"); };
  function submit() {
    if (!form.companyName.trim()) return;
    const e={...form,id:editing||uid(),createdAt:form.createdAt||new Date().toISOString().slice(0,10)};
    saveLeads(editing?leads.map(l=>l.id===editing?e:l):[...leads,e]); setEditing(null); setView("board");
  }
  const del = id => ask("Delete this lead? This cannot be undone.", ()=>{ saveLeads(leads.filter(l=>l.id!==id)); });
  const advance = id => { const l=leads.find(x=>x.id===id); if(!l)return; const i=STAGES.indexOf(l.stage); if(i<STAGES.length-2) saveLeads(leads.map(x=>x.id===id?{...x,stage:STAGES[i+1],contractDate:STAGES[i+1]==="Signed Contract"?new Date().toISOString().slice(0,10):x.contractDate}:x)); };
  const fLeads = leads.filter(l=>(fStage==="all"||l.stage===fStage)&&(srch===""||l.companyName.toLowerCase().includes(srch.toLowerCase())||l.contactName.toLowerCase().includes(srch.toLowerCase())));
  const signed = leads.filter(l=>l.stage==="Signed Contract");
  const active = leads.filter(l=>l.stage!=="Lost"&&l.stage!=="Signed Contract");
  if (!rdy) return <div style={S.card}><div style={S.empty}>Loading…</div></div>;
  return (
    <div>
      {confirmEl}
      <F style={{ marginBottom:"12px", flexWrap:"wrap" }}>
        {[["Total Leads",leads.length,"#e0f0ff"],["Active",active.length,"#3b82f6"],["Signed",signed.length,"#10b981"],["Pipeline","$"+active.reduce((s,l)=>s+parseFloat(l.estimatedValue||0),0).toFixed(0),"#f59e0b"],["Won","$"+signed.reduce((s,l)=>s+parseFloat(l.estimatedValue||0),0).toFixed(0),"#10b981"]].map(([l,v,c])=><Stat key={l} label={l} value={v} color={c}/>)}
      </F>
      <div style={S.card}>
        <F style={{ flexWrap:"wrap" }}>
          <button style={S.bp} onClick={startNew}>+ New Lead</button>
          {[["board","🗂 Board"],["list","☰ List"]].map(([v,l])=><button key={v} style={{ ...S.bo, background:view===v?"#172a45":"transparent", color:view===v?"#e0f0ff":"#4a8ab0" }} onClick={()=>setView(v)}>{l}</button>)}
          <input style={{ ...S.inp, width:"150px" }} placeholder="Search…" value={srch} onChange={e=>setSrch(e.target.value)}/>
          <select style={{ ...S.sel, width:"150px" }} value={fStage} onChange={e=>setFStage(e.target.value)}><option value="all">All Stages</option>{STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select>
          <button style={S.bs} onClick={()=>mkCSV("sales_leads",["Company","Contact","Phone","Email","Stage","Priority","Source","Service","Value","Next Action","Next Action Date","Created","Contract Date","Notes"],leads.map(l=>[l.companyName,l.contactName,l.phone,l.email,l.stage,l.priority,l.source,l.serviceType,l.estimatedValue,l.nextAction,l.nextActionDate,l.createdAt,l.contractDate,l.notes]))}>📊 Export</button>
        </F>
      </div>

      {view==="board"&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:"10px", alignItems:"start" }}>
          {STAGES.map(stage=>{
            const c=SCOL[stage]; const sl=fLeads.filter(l=>l.stage===stage);
            return(
              <div key={stage} style={{ background:"#0a1628", borderRadius:"8px", border:`1px solid ${c}33`, overflow:"hidden" }}>
                <div style={{ background:c+"22", padding:"7px 10px", borderBottom:`1px solid ${c}33`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"9px", fontWeight:"700", color:c }}>{SICO[stage]} {stage}</span>
                  <span style={{ background:c, color:"#fff", borderRadius:"9px", padding:"1px 6px", fontSize:"9px", fontWeight:"700" }}>{sl.length}</span>
                </div>
                <div style={{ padding:"6px", minHeight:"50px" }}>
                  {sl.length===0&&<div style={{ fontSize:"9px", color:"#3a6a8a", textAlign:"center", padding:"10px 0" }}>No leads</div>}
                  {sl.map(l=>(
                    <div key={l.id} style={{ background:"#070d19", borderRadius:"5px", padding:"8px", marginBottom:"5px", borderLeft:`3px solid ${c}`, cursor:"pointer" }} onClick={()=>startEdit(l)}>
                      <div style={{ fontWeight:"700", color:"#e0f0ff", fontSize:"10px", marginBottom:"2px" }}>{l.companyName}</div>
                      {l.contactName&&<div style={{ fontSize:"9px", color:"#5a8ab0" }}>👤 {l.contactName}</div>}
                      {l.estimatedValue&&<div style={{ fontSize:"9px", color:"#34d399" }}>💰 ${parseFloat(l.estimatedValue).toLocaleString()}/mo</div>}
                      {l.nextActionDate&&<div style={{ fontSize:"8px", color:"#f59e0b" }}>📅 {l.nextActionDate}</div>}
                      {l.priority&&<div style={{ marginTop:"3px" }}><span style={S.pill(l.priority==="High"?"#ef4444":l.priority==="Medium"?"#f59e0b":"#3b82f6")}>{l.priority}</span></div>}
                      {stage!=="Signed Contract"&&stage!=="Lost"&&<button style={{ ...S.bsm(c), marginTop:"5px", width:"100%", textAlign:"center", fontSize:"8px" }} onClick={e=>{e.stopPropagation();advance(l.id);}}>→ {STAGES[STAGES.indexOf(stage)+1]}</button>}
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
          {fLeads.length===0?<div style={S.empty}>No leads.</div>:<div style={{ overflowX:"auto" }}><table style={S.tbl}><thead><tr>{["Company","Contact","Phone","Stage","Priority","Value","Next Action","Created",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{fLeads.map(l=>{const c=SCOL[l.stage]||"#6b7280";return(<tr key={l.id}><td style={S.td}><span style={{ color:"#e0f0ff", fontWeight:"700", cursor:"pointer" }} onClick={()=>startEdit(l)}>{l.companyName}</span>{l.email&&<div style={{ fontSize:"9px", color:"#3a6a8a" }}>{l.email}</div>}</td><td style={S.td}>{l.contactName||"—"}</td><td style={S.td}>{l.phone||"—"}</td><td style={S.td}><span style={S.pill(c)}>{SICO[l.stage]} {l.stage}</span></td><td style={S.td}><span style={S.pill(l.priority==="High"?"#ef4444":l.priority==="Medium"?"#f59e0b":"#3b82f6")}>{l.priority||"—"}</span></td><td style={S.td}>{l.estimatedValue?`$${parseFloat(l.estimatedValue).toLocaleString()}`:""}</td><td style={S.td}><div style={{ fontSize:"10px" }}>{l.nextAction||"—"}</div>{l.nextActionDate&&<div style={{ fontSize:"9px", color:"#f59e0b" }}>{l.nextActionDate}</div>}</td><td style={S.td}>{l.createdAt||"—"}</td><td style={S.td}><F><button style={S.bsm("#60a5fa")} onClick={()=>startEdit(l)}>Edit</button><button style={S.bd} onClick={()=>del(l.id)}>✕</button></F></td></tr>);})}</tbody></table></div>}
        </div>
      )}

      {view==="form"&&(
        <div style={{ ...S.card, border:"1px solid #2563eb" }}>
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
          <div style={{ marginTop:"10px", padding:"10px", background:"#070d19", borderRadius:"6px" }}>
            <div style={{ fontSize:"9px", color:"#3a6a8a", marginBottom:"6px", fontWeight:"700", textTransform:"uppercase" }}>Quick Stage</div>
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
const INV_STATUS_COL = { outstanding:"#f59e0b", overdue:"#ef4444", paid:"#10b981" };

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
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${it.desc||""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">$${parseFloat(it.price||0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">$${amt.toFixed(2)}</td>
    </tr>`;
  }).join("");
  const statusColor = inv.status==="paid"?"#065f46":inv.status==="overdue"?"#7f1d1d":"#78350f";
  const statusBg    = inv.status==="paid"?"#d1fae5":inv.status==="overdue"?"#fee2e2":"#fef3c7";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Invoice ${inv.number}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:48px;color:#1a2a3a;font-size:13px;max-width:820px;margin:0 auto}
    .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
    .logo-img{max-height:72px;max-width:200px;object-fit:contain;margin-bottom:6px}
    .company-name{font-size:16px;font-weight:700;color:#1a2a4a}
    .company-sub{font-size:11px;color:#666;margin-top:2px}
    .inv-block{text-align:right}
    .inv-label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px}
    .inv-num{font-size:28px;font-weight:800;color:#1a3a6a;margin:2px 0}
    .status-badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background:${statusBg};color:${statusColor};margin-top:4px}
    .summary-box{background:#f0f4ff;border-left:4px solid #1a3a6a;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:24px;font-size:12px;color:#1a2a4a;line-height:1.5}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f8faff;border-radius:8px;padding:18px;margin-bottom:28px}
    .meta h4{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:6px;font-weight:700}
    .meta p{margin:2px 0;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:0}
    thead tr{background:#1a3a6a}
    thead th{color:#fff;padding:9px 12px;text-align:left;font-size:11px;font-weight:600}
    thead th.r{text-align:right}thead th.c{text-align:center}
    .totals-wrap{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
    .tot-row{display:flex;justify-content:space-between;padding:7px 14px;font-size:12px;border-top:1px solid #eee}
    .tot-row.final{background:#1a3a6a;color:#fff;font-weight:700;font-size:15px}
    .notes-box{margin-top:20px;background:#f8faff;border-radius:6px;padding:14px;font-size:12px;color:#555;line-height:1.5}
    .footer{margin-top:28px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
    @media print{@page{margin:1.2cm}body{padding:0}}
  </style></head><body>
  <div class="top">
    <div>
      ${inv.logo ? `<img src="${inv.logo}" class="logo-img" alt="logo"/>` : ""}
      ${inv.companyName ? `<div class="company-name">${inv.companyName}</div>` : ""}
      ${inv.companyAddress ? `<div class="company-sub">${inv.companyAddress}</div>` : ""}
      ${inv.companyPhone ? `<div class="company-sub">${inv.companyPhone}</div>` : ""}
      ${inv.companyEmail ? `<div class="company-sub">${inv.companyEmail}</div>` : ""}
      ${inv.companyTax ? `<div class="company-sub">HST/GST #: ${inv.companyTax}</div>` : ""}
    </div>
    <div class="inv-block">
      <div class="inv-label">Invoice</div>
      <div class="inv-num">${inv.number}</div>
      <div class="status-badge">${inv.status}</div>
    </div>
  </div>
  ${inv.summary ? `<div class="summary-box"><strong>Re:</strong> ${inv.summary}</div>` : ""}
  <div class="meta">
    <div>
      <h4>Bill To</h4>
      <p><strong>${inv.clientName||"—"}</strong></p>
      ${inv.clientContact ? `<p style="color:#555">Attn: ${inv.clientContact}</p>` : ""}
      ${inv.clientAddress ? `<p style="color:#555">${inv.clientAddress}</p>` : ""}
      ${inv.clientEmail ? `<p style="color:#555">${inv.clientEmail}</p>` : ""}
      ${inv.clientPhone ? `<p style="color:#555">${inv.clientPhone}</p>` : ""}
    </div>
    <div>
      <h4>Invoice Details</h4>
      <p>Invoice Date: <strong>${inv.date||"—"}</strong></p>
      ${inv.dueDate ? `<p>Due Date: <strong>${inv.dueDate}</strong></p>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals-wrap">
    <div class="tot-row"><span>Subtotal</span><span>${cur} $${sub.toFixed(2)}</span></div>
    ${discAmt>0 ? `<div class="tot-row"><span>Discount${inv.discountNote?" — "+inv.discountNote:""}${inv.discountType==="percent"?" ("+discVal+"%)":""}</span><span style="color:#059669">− ${cur} $${discAmt.toFixed(2)}</span></div>` : ""}
    ${inv.hst ? `<div class="tot-row"><span>HST (13%)</span><span>${cur} $${hstAmt.toFixed(2)}</span></div>` : ""}
    <div class="tot-row final"><span>Total (${cur})</span><span>$${tot.toFixed(2)}</span></div>
  </div>
  ${inv.notes ? `<div class="notes-box"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
  ${inv.attachments&&inv.attachments.length>0 ? `<div class="notes-box" style="margin-top:12px"><strong>Attachments:</strong> ${inv.attachments.map(a=>a.name).join(", ")}</div>` : ""}
  <div class="footer">Generated by SecureOps &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</div>
  </body></html>`;
  const w = window.open("","_blank","width=900,height=720");
  if (!w) { alert("Allow pop-ups in your browser to download the PDF."); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 700);
}

function Invoices({ locs }) {
  const [invs, setInvs] = useState([]);
  const [rdy, setRdy]   = useState(false);
  const [view, setView] = useState("dashboard");
  const [editing, setEditing] = useState(null);
  const [confirmEl, ask] = useConfirm();

  // saved company profile
  const [co, setCo] = useState({ companyName:"", companyAddress:"", companyEmail:"", companyPhone:"", companyTax:"", logo:"" });
  const [coSaved, setCoSaved] = useState(false);
  const [logoB64, setLogoB64] = useState("");

  const blankForm = () => ({
    number:"", date:new Date().toISOString().slice(0,10), dueDate:"", summary:"",
    clientLocationId:"", clientName:"", clientAddress:"", clientEmail:"",
    clientPhone:"", clientContact:"",
    items:[{ desc:"Security Services", qty:1, price:"" }],
    hst:true, notes:"", status:"outstanding",
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
    setEditing(null); setView("list");
  }

  function delInv(id)        { ask("Delete this invoice? This cannot be undone.", ()=>saveInvs(invs.filter(x=>x.id!==id))); }
  function setStatus(id, st) { saveInvs(invs.map(x=>x.id===id?{...x,status:st}:x)); }

  const clientLabel = inv => inv.clientName||(locs.find(l=>l.id===inv.clientLocationId)?.client)||(locs.find(l=>l.id===inv.clientLocationId)?.name)||"—";

  // stats (all-time, no period filter needed here — see Revenue page for period breakdown)
  const outstanding = invs.filter(x=>x.status==="outstanding");
  const overdue     = invs.filter(x=>x.status==="overdue");
  const paid        = invs.filter(x=>x.status==="paid");

  if (!rdy) return <div style={S.card}><div style={S.empty}>Loading…</div></div>;

  const subTabs = [["dashboard","📊 Dashboard"],["list","📄 All Invoices"],["form","➕ New Invoice"]];

  return (
    <div>
      {confirmEl}
      <div style={{ display:"flex", gap:"6px", marginBottom:"14px", flexWrap:"wrap" }}>
        {subTabs.map(([v,l]) => (
          <button key={v} style={{ ...S.bp, background:view===v?"#1d4ed8":"transparent", color:view===v?"#fff":"#4a8ab0", border:"1px solid #1e3a5f" }}
            onClick={()=>{ if(v==="form") startNew(); else setView(v); }}>{l}</button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {view==="dashboard" && (
        <div>
          <div style={{ display:"flex", gap:"9px", marginBottom:"14px", flexWrap:"wrap" }}>
            {[["Outstanding",outstanding.length,"#f59e0b"],["Overdue",overdue.length,"#ef4444"],["Paid (All Time)",paid.length,"#10b981"],["Total Invoices",invs.length,T.text]].map(([l,v,c])=>(
              <div key={l} style={{ ...S.stat, flex:"1", minWidth:"110px", borderTop:`3px solid ${c}` }}>
                <div style={{ ...S.sn, color:c, fontSize:"20px" }}>{v}</div><div style={S.sl}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ ...S.card, background:T.surface2, border:`1px solid ${T.borderHi}` }}>
            <div style={{ fontSize:"12px", color:T.textSub }}>
              💡 For revenue totals, HST collected, and period breakdowns — visit the <strong style={{ color:T.blue }}>Revenue</strong> page in the sidebar.
            </div>
          </div>
          {overdue.length>0&&<div style={S.card}><div style={S.ct}>🔴 Overdue Invoices</div>
            <table style={S.tbl}><thead><tr>{["Invoice #","Client","Date","Due","Total",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{overdue.map(inv=><tr key={inv.id}><td style={S.td}><strong style={{ color:T.text }}>{inv.number}</strong></td><td style={S.td}>{clientLabel(inv)}</td><td style={S.td}>{inv.date||"—"}</td><td style={S.td}>{inv.dueDate||"—"}</td><td style={S.td}><strong style={{ color:T.red }}>${(inv.total||0).toFixed(2)}</strong></td><td style={S.td}><div style={{ display:"flex",gap:"5px" }}><button style={S.bsm(T.green)} onClick={()=>setStatus(inv.id,"paid")}>Mark Paid</button><button style={S.bsm(T.blue)} onClick={()=>startEdit(inv)}>Edit</button></div></td></tr>)}</tbody>
            </table></div>}
          {outstanding.length>0&&<div style={S.card}><div style={S.ct}>🟡 Outstanding Invoices</div>
            <table style={S.tbl}><thead><tr>{["Invoice #","Client","Date","Due","Total",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{outstanding.map(inv=><tr key={inv.id}><td style={S.td}><strong style={{ color:T.text }}>{inv.number}</strong></td><td style={S.td}>{clientLabel(inv)}</td><td style={S.td}>{inv.date||"—"}</td><td style={S.td}>{inv.dueDate||"—"}</td><td style={S.td}><strong style={{ color:T.amber }}>${(inv.total||0).toFixed(2)}</strong></td><td style={S.td}><div style={{ display:"flex",gap:"5px" }}><button style={S.bsm(T.green)} onClick={()=>setStatus(inv.id,"paid")}>Mark Paid</button><button style={S.bsm(T.red)} onClick={()=>setStatus(inv.id,"overdue")}>Overdue</button><button style={S.bsm(T.blue)} onClick={()=>startEdit(inv)}>Edit</button></div></td></tr>)}</tbody>
            </table></div>}
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
                    <td style={S.td}><strong style={{ color:"#e0f0ff" }}>{inv.number}</strong></td>
                    <td style={S.td}>{clientLabel(inv)}</td>
                    <td style={{ ...S.td, maxWidth:"160px", fontSize:"10px", color:"#5a8ab0" }}>{inv.summary||"—"}</td>
                    <td style={S.td}>{inv.date||"—"}</td>
                    <td style={S.td}>{inv.dueDate||"—"}</td>
                    <td style={S.td}><span style={S.pill(INV_STATUS_COL[inv.status]||"#6b7280")}>{inv.status}</span></td>
                    <td style={S.td}><strong>${(inv.total||0).toFixed(2)}</strong></td>
                    <td style={S.td}><div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                      <button style={S.bsm("#60a5fa")} onClick={()=>startEdit(inv)}>Edit</button>
                      <button style={S.bsm("#a78bfa")} onClick={()=>printInvoiceHTML(inv)}>🖨 PDF</button>
                      {inv.status!=="paid"&&<button style={S.bsm("#10b981")} onClick={()=>setStatus(inv.id,"paid")}>Paid</button>}
                      {inv.status==="outstanding"&&<button style={S.bsm("#ef4444")} onClick={()=>setStatus(inv.id,"overdue")}>Overdue</button>}
                      <button style={S.bd} onClick={()=>delInv(inv.id)}>✕</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── FORM ── */}
      {view==="form" && (
        <div>
          {/* company profile — always saved */}
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={S.ct}>Your Company Details <span style={{ color:"#3a6a8a", fontSize:"9px", fontWeight:"400" }}>(saved automatically across all invoices)</span></div>
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
                  {logoB64&&<><img src={logoB64} alt="logo" style={{ height:"30px", borderRadius:"3px", border:"1px solid #1e3a5f" }}/><button style={S.bd} onClick={()=>{setLogoB64("");setCo(p=>({...p,logo:""}));}}>Remove</button></>}
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
                    <button key={label} style={{ ...S.bsm("#5a8ab0"), fontSize:"8px", padding:"2px 6px" }}
                      onClick={()=>setForm(p=>({...p,dueDate:addDays(p.date,days)}))}>{label}</button>
                  ))}
                </div>
              </div>
              <div><label style={S.lbl}>Status</label>
                <select style={S.sel} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
                  <option value="outstanding">Outstanding</option>
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
            <table style={S.tbl}>
              <thead><tr>{["Description","Qty","Unit Price ($)","Amount",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {form.items.map((it,i)=>{
                  const amt=(parseFloat(it.qty)||0)*(parseFloat(it.price)||0);
                  return (
                    <tr key={i}>
                      <td style={S.td}><input style={S.inp} value={it.desc} onChange={e=>setItem(i,"desc",e.target.value)} placeholder="e.g. Security Services — May 1–15"/></td>
                      <td style={S.td}><input style={{ ...S.inp, width:"65px" }} type="number" min="0" value={it.qty} onChange={e=>setItem(i,"qty",e.target.value)}/></td>
                      <td style={S.td}><input style={{ ...S.inp, width:"100px" }} type="number" step="0.01" min="0" value={it.price} onChange={e=>setItem(i,"price",e.target.value)}/></td>
                      <td style={{ ...S.td, fontWeight:"700", color:"#e0f0ff" }}>${amt.toFixed(2)}</td>
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

          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
            <button style={S.bp} onClick={submit}>Save Invoice</button>
            <button style={{ ...S.bsm("#a78bfa"), padding:"7px 13px", fontSize:"10px" }} onClick={()=>{ const {sub,discAmt,afterDisc,hstAmt,total}=calcTotals(); printInvoiceHTML({...form,...co,logo:logoB64,subtotal:sub,discAmt,afterDisc,hstAmt,total}); }}>🖨 Preview PDF</button>
            <button style={S.bo} onClick={()=>setView(editing?"list":"dashboard")}>Cancel</button>
            {editing&&<button style={S.bd} onClick={()=>delInv(editing)}>Delete Invoice</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"emp",  label:"Employees",  icon:"👤", section:"Operations" },
  { id:"loc",  label:"Locations",  icon:"📍", section:"Operations" },
  { id:"cal",  label:"Calendar",   icon:"📅", section:"Operations" },
  { id:"rep",  label:"Reports",    icon:"📊", section:"Operations" },
  { id:"his",  label:"History",    icon:"🗂",  section:"Operations" },
  { id:"inv",  label:"Invoices",   icon:"🧾", section:"Finance" },
  { id:"pay",  label:"Revenue",    icon:"💰", section:"Finance" },
  { id:"sal",  label:"Sales",      icon:"🎯", section:"Finance" },
];

const PAGE_META = {
  emp: { title:"Employees", subtitle:"Manage your employee records and personnel information" },
  loc: { title:"Locations", subtitle:"Client sites, contracts, and billing rates" },
  cal: { title:"Calendar", subtitle:"Schedules, shifts, and daily attendance" },
  rep: { title:"Reports", subtitle:"Export hours by location and time period" },
  his: { title:"History", subtitle:"Saved period reports" },
  inv: { title:"Invoices", subtitle:"Create and manage client invoices" },
  pay: { title:"Revenue", subtitle:"Invoice payments, pending collections, and revenue tracking" },
  sal: { title:"Sales", subtitle:"Lead pipeline and client acquisition" },
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("emp");
  const [guards, setGuards] = useState([]);
  const [locs, setLocs] = useState([]);
  const [scs, setScs] = useState([]);
  const [ovs, setOvs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [g,l,sc,ov,hi] = await Promise.all([load(K.g),load(K.l),load(K.sc),load(K.ov),load(K.hi)]);
      if(g) setGuards(g); if(l) setLocs(l); if(sc) setScs(sc); if(ov) setOvs(ov); if(hi) setHistory(hi);
      setLoaded(true);
    })();
  }, []);

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  if (!loaded) return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"40px", height:"40px", background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", margin:"0 auto 16px" }}>🛡</div>
        <div style={{ color:T.textSub, fontSize:"13px" }}>Loading SecureOps…</div>
      </div>
    </div>
  );

  const sections = ["Operations", "Finance"];
  const meta = PAGE_META[tab];

  return (
    <div style={S.app}>
      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={S.sidebarLogoIcon}>🛡</div>
          <div>
            <div style={S.sidebarLogoText}>SecureOps</div>
            <div style={{ fontSize:"10px", color:T.textMute }}>Management</div>
          </div>
        </div>
        <nav style={S.sidebarNav}>
          {sections.map(section => (
            <div key={section}>
              <div style={S.sidebarSection}>{section}</div>
              {TABS.filter(t=>t.section===section).map(t => (
                <button key={t.id} style={S.navItem(tab===t.id)} onClick={() => setTab(t.id)}>
                  <span style={S.navIcon}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={S.sidebarBottom}>
          <button style={S.signOutBtn} onClick={() => setLoggedIn(false)}>
            <span style={S.navIcon}>↩</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={S.main}>
        <div style={S.pageTitle}>{meta.title}</div>
        <div style={S.pageSubtitle}>{meta.subtitle}</div>
        {tab==="emp" && <Employees guards={guards} setGuards={setGuards} />}
        {tab==="loc" && <Locations locs={locs} setLocs={setLocs} />}
        {tab==="cal" && <Calendar guards={guards} locs={locs} scs={scs} setScs={setScs} ovs={ovs} setOvs={setOvs} />}
        {tab==="rep" && <Reports guards={guards} locs={locs} scs={scs} ovs={ovs} history={history} setHistory={setHistory} />}
        {tab==="his" && <History history={history} setHistory={setHistory} />}
        {tab==="inv" && <Invoices locs={locs} />}
        {tab==="pay" && <Revenue locs={locs} />}
        {tab==="sal" && <Sales />}
      </main>
    </div>
  );
}