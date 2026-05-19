import { useState, useEffect, Fragment } from "react";

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

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight:"100vh", background:"#070d19", color:"#dce8f5", fontFamily:"monospace" },
  hdr: { background:"#0a1628", borderBottom:"1px solid #1e3a5f", padding:"0 16px", display:"flex", alignItems:"center", gap:"10px", minHeight:"52px", flexWrap:"wrap" },
  logo: { fontSize:"14px", fontWeight:"700", color:"#e0f0ff", letterSpacing:"2px", marginRight:"8px" },
  nb: a => ({ padding:"4px 9px", borderRadius:"4px", border:"none", cursor:"pointer", fontSize:"9px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.5px", background:a?"#1d4ed8":"transparent", color:a?"#fff":"#4a8ab0" }),
  main: { maxWidth:"1200px", margin:"0 auto", padding:"20px 14px" },
  card: { background:"#0a1628", borderRadius:"10px", border:"1px solid #1e3a5f", padding:"16px", marginBottom:"14px" },
  ct: { fontSize:"10px", fontWeight:"700", color:"#5a8ab0", marginBottom:"12px", textTransform:"uppercase", letterSpacing:"1px" },
  lbl: { display:"block", fontSize:"9px", fontWeight:"700", color:"#3a6a8a", marginBottom:"3px", textTransform:"uppercase", letterSpacing:"0.5px" },
  inp: { width:"100%", background:"#070d19", border:"1px solid #1e3a5f", borderRadius:"5px", padding:"7px 9px", color:"#dce8f5", fontSize:"11px", outline:"none", boxSizing:"border-box" },
  sel: { width:"100%", background:"#070d19", border:"1px solid #1e3a5f", borderRadius:"5px", padding:"7px 9px", color:"#dce8f5", fontSize:"11px", outline:"none", boxSizing:"border-box" },
  ta: { width:"100%", background:"#070d19", border:"1px solid #1e3a5f", borderRadius:"5px", padding:"7px 9px", color:"#dce8f5", fontSize:"11px", outline:"none", boxSizing:"border-box", resize:"vertical", minHeight:"56px" },
  bp: { background:"#1d4ed8", color:"#fff", border:"none", borderRadius:"5px", padding:"7px 13px", fontWeight:"700", fontSize:"10px", cursor:"pointer" },
  bs: { background:"#064e3b", color:"#6ee7b7", border:"1px solid #059669", borderRadius:"5px", padding:"7px 12px", fontWeight:"700", fontSize:"10px", cursor:"pointer" },
  bo: { background:"transparent", color:"#5a8ab0", border:"1px solid #1e3a5f", borderRadius:"5px", padding:"6px 12px", fontWeight:"700", fontSize:"10px", cursor:"pointer" },
  bd: { background:"transparent", color:"#f87171", border:"1px solid #7f1d1d", borderRadius:"4px", padding:"3px 7px", fontSize:"9px", cursor:"pointer" },
  bsm: c => ({ background:"transparent", color:c||"#5a8ab0", border:`1px solid ${c||"#1e3a5f"}`, borderRadius:"4px", padding:"2px 7px", fontSize:"9px", cursor:"pointer", fontWeight:"700" }),
  tbl: { width:"100%", borderCollapse:"collapse" },
  th: { textAlign:"left", padding:"6px 9px", fontSize:"8px", fontWeight:"700", color:"#3a6a8a", textTransform:"uppercase", borderBottom:"1px solid #1e3a5f" },
  td: { padding:"7px 9px", fontSize:"11px", borderBottom:"1px solid #0a1628" },
  stat: { background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:"8px", padding:"12px", textAlign:"center" },
  sn: { fontSize:"20px", fontWeight:"800", color:"#e0f0ff" },
  sl: { fontSize:"8px", color:"#3a6a8a", marginTop:"2px", textTransform:"uppercase", letterSpacing:"0.5px" },
  g2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"9px" },
  g3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"9px" },
  g4: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"9px" },
  g5: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:"9px" },
  row: { display:"flex", gap:"7px", alignItems:"center", flexWrap:"wrap" },
  empty: { textAlign:"center", padding:"28px", color:"#3a6a8a", fontSize:"11px" },
  pill: c => ({ display:"inline-block", padding:"2px 7px", borderRadius:"20px", fontSize:"8px", fontWeight:"700", background:c+"22", color:c, border:`1px solid ${c}44` }),
};
const F = ({ children, style, ...p }) => <div style={{ display:"flex", gap:"7px", alignItems:"center", flexWrap:"wrap", ...style }} {...p}>{children}</div>;
const Inp = ({ label, style, ...p }) => <div><label style={S.lbl}>{label}</label><input style={{ ...S.inp, ...style }} {...p} /></div>;
const Sel = ({ label, children, ...p }) => <div><label style={S.lbl}>{label}</label><select style={S.sel} {...p}>{children}</select></div>;
const Stat = ({ label, value, color, min="90px" }) => <div style={{ ...S.stat, flex:"1", minWidth:min, borderColor:(color||"#1e3a5f")+"66" }}><div style={{ ...S.sn, color:color||"#e0f0ff", fontSize:"18px" }}>{value}</div><div style={S.sl}>{label}</div></div>;

// ─── confirm dialog ───────────────────────────────────────────────────────────
function Confirm({ msg, onYes, onNo }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div style={{ background:"#0a1628", border:"1px solid #ef4444", borderRadius:"10px", padding:"24px 28px", maxWidth:"340px", textAlign:"center" }}>
        <div style={{ fontSize:"22px", marginBottom:"10px" }}>⚠️</div>
        <div style={{ fontSize:"13px", color:"#dce8f5", marginBottom:"18px", lineHeight:1.5 }}>{msg}</div>
        <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
          <button style={{ ...S.bd, padding:"7px 18px", fontSize:"11px" }} onClick={onYes}>Yes, Delete</button>
          <button style={{ ...S.bo, padding:"7px 18px", fontSize:"11px" }} onClick={onNo}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
// useConfirm hook — returns [confirmEl, askConfirm(msg, onYes)]
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
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  const go = () => { if (u==="security"&&p==="security") onLogin(); else { setErr("Invalid credentials."); setP(""); } };
  return (
    <div style={{ minHeight:"100vh", background:"#070d19", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:"12px", padding:"40px 34px", width:"300px" }}>
        <div style={{ textAlign:"center", marginBottom:"26px" }}>
          <div style={{ fontSize:"36px" }}>🛡</div>
          <div style={{ fontSize:"18px", fontWeight:"800", color:"#e0f0ff", letterSpacing:"3px", marginTop:"6px" }}>SECURE<span style={{ color:"#3b82f6" }}>OPS</span></div>
          <div style={{ fontSize:"9px", color:"#3a6a8a", marginTop:"4px", letterSpacing:"2px" }}>SECURITY MANAGEMENT</div>
        </div>
        <div style={{ marginBottom:"10px" }}><label style={S.lbl}>Username</label><input style={S.inp} value={u} onChange={e=>setU(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus /></div>
        <div style={{ marginBottom:"16px" }}><label style={S.lbl}>Password</label><input style={S.inp} type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} /></div>
        {err && <div style={{ color:"#f87171", fontSize:"10px", textAlign:"center", marginBottom:"10px" }}>{err}</div>}
        <button style={{ ...S.bp, width:"100%", padding:"9px", fontSize:"12px" }} onClick={go}>Sign In</button>
      </div>
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
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  function submit() {
    if (!form.name.trim()) return;
    const entry = { ...form, id: editing || uid() };
    const u = editing ? guards.map(g => g.id===editing ? entry : g) : [...guards, entry];
    setGuards(u); save(K.g, u); setForm(blank); setEditing(null);
  }
  const del = id => ask("Delete this employee? This cannot be undone.", () => { const u = guards.filter(g=>g.id!==id); setGuards(u); save(K.g,u); });
  const edit = g => { setForm({...blank,...g}); setEditing(g.id); setExp(null); };
  const rows = guards.filter(g => g.name.toLowerCase().includes(search.toLowerCase())||(g.badge||"").includes(search));
  return (
    <div>
      {confirmEl}
      <F style={{ marginBottom:"14px", flexWrap:"wrap" }}>
        {[["Total",guards.length],["Active",guards.filter(g=>g.status==="Active").length],["Inactive",guards.filter(g=>g.status==="Inactive").length],["On Leave",guards.filter(g=>g.status==="On Leave").length]].map(([l,v])=><Stat key={l} label={l} value={v} />)}
      </F>
      <div style={S.card}>
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
function Locations({ locs, setLocs }) {
  const blankL = { name:"", client:"", contactName:"", contactEmail:"", contactPhone:"", clientAddress:"", contractStart:"", contractEnd:"", notes:"", rates:[] };
  const [form, setForm] = useState(blankL);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  // billing rate sub-form
  const blankRate = { effectiveDate:"", rate:"", notes:"" };
  const [rateForm, setRateForm] = useState(blankRate);
  const [confirmEl, ask] = useConfirm();

  const ff = k => e => setForm(p=>({...p,[k]:e.target.value}));

  function submit() {
    if (!form.name.trim()) return;
    const entry = { ...form, id: editing || uid() };
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

  // current rate = most recent rate whose effectiveDate <= today
  function currentRate(loc) {
    const today = new Date().toISOString().slice(0,10);
    const past = (loc.rates||[]).filter(r=>r.effectiveDate<=today).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate));
    return past[0] || null;
  }

  return (
    <div>
      {confirmEl}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <span style={{ fontSize:"11px", color:"#5a8ab0" }}>{locs.length} location{locs.length!==1?"s":""}</span>
        <button style={S.bp} onClick={()=>{setForm(blankL);setEditing(null);setShowForm(s=>!s);}}>
          {showForm?"Cancel":"+ Add Location"}
        </button>
      </div>

      {showForm && (
        <div style={{ ...S.card, border:"1px solid #2563eb" }}>
          <div style={S.ct}>{editing?"Edit Location / Client":"New Location / Client"}</div>
          <div style={S.g3}>
            <div><label style={S.lbl}>Location Name *</label><input style={S.inp} value={form.name} onChange={ff("name")} placeholder="e.g. Downtown Mall"/></div>
            <div><label style={S.lbl}>Client / Company Name</label><input style={S.inp} value={form.client} onChange={ff("client")} placeholder="e.g. ABC Corp"/></div>
            <div><label style={S.lbl}>Contact Person</label><input style={S.inp} value={form.contactName} onChange={ff("contactName")} placeholder="John Smith"/></div>
          </div>
          <div style={{ ...S.g3, marginTop:"8px" }}>
            <div><label style={S.lbl}>Contact Email</label><input style={S.inp} type="email" value={form.contactEmail} onChange={ff("contactEmail")}/></div>
            <div><label style={S.lbl}>Contact Phone</label><input style={S.inp} type="tel" value={form.contactPhone} onChange={ff("contactPhone")}/></div>
            <div><label style={S.lbl}>Client Address</label><input style={S.inp} value={form.clientAddress} onChange={ff("clientAddress")}/></div>
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

      {/* locations list */}
      {locs.length===0 ? <div style={S.card}><div style={S.empty}>No locations added yet.</div></div> :
        locs.map(l => {
          const cr = currentRate(l);
          const isExp = expanded===l.id;
          const contractExpired = l.contractEnd && l.contractEnd < new Date().toISOString().slice(0,10);
          return (
            <div key={l.id} style={S.card}>
              {/* header row */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"8px" }}>
                <div style={{ cursor:"pointer", flex:1 }} onClick={()=>setExpanded(isExp?null:l.id)}>
                  <div style={{ fontWeight:"700", color:"#e0f0ff", fontSize:"13px" }}>{l.name}</div>
                  {l.client && <div style={{ fontSize:"11px", color:"#5a8ab0", marginTop:"1px" }}>Client: {l.client}</div>}
                  <div style={{ display:"flex", gap:"10px", marginTop:"4px", flexWrap:"wrap" }}>
                    {cr && <span style={S.pill("#10b981")}>Current Rate: ${parseFloat(cr.rate).toFixed(2)}/hr</span>}
                    {l.contractEnd && <span style={S.pill(contractExpired?"#ef4444":"#3b82f6")}>{contractExpired?"Contract Expired":"Contract Until"}: {l.contractEnd}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"5px" }}>
                  <button style={S.bsm()} onClick={()=>edit(l)}>Edit</button>
                  <button style={S.bd} onClick={()=>del(l.id)}>Delete</button>
                  <button style={S.bsm()} onClick={()=>setExpanded(isExp?null:l.id)}>{isExp?"▲":"▼"}</button>
                </div>
              </div>

              {/* expanded details */}
              {isExp && (
                <div style={{ marginTop:"12px", borderTop:"1px solid #1e3a5f", paddingTop:"12px" }}>
                  <div style={{ display:"flex", gap:"20px", fontSize:"11px", color:"#5a8ab0", flexWrap:"wrap", marginBottom:"14px" }}>
                    {[["Contact",l.contactName],["Email",l.contactEmail],["Phone",l.contactPhone],["Address",l.clientAddress],["Contract Start",l.contractStart],["Contract End",l.contractEnd]].map(([label,val])=>val?(
                      <div key={label}><span style={{ color:"#3a6a8a" }}>{label}: </span>{val}</div>
                    ):null)}
                    {l.notes && <div style={{ width:"100%" }}><span style={{ color:"#3a6a8a" }}>Notes: </span>{l.notes}</div>}
                  </div>

                  {/* billing rate history */}
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
                    {/* add new rate */}
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
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Payments({ locs }) {
  const [pays, setPays] = useState([]); const [rdy, setRdy] = useState(false);
  const [fCl, setFCl] = useState("all"); const [fSd, setFSd] = useState(`${new Date().getFullYear()}-01-01`); const [fEd, setFEd] = useState(new Date().toISOString().slice(0,10));
  const [show, setShow] = useState(false); const [editing, setEditing] = useState(null);
  const blank = { locationId:"", clientName:"", billingStart:"", billingEnd:"", amountBilled:"", received:false, depositDate:"", notes:"" };
  const [form, setForm] = useState(blank);
  const [confirmEl, ask] = useConfirm();
  useEffect(()=>{(async()=>{const d=await load(K.pay);if(d)setPays(d);setRdy(true);})();},[]);
  const savePays = u => { setPays(u); save(K.pay,u); };
  const hst = a => parseFloat(a||0)*0.13;
  const tot = a => parseFloat(a||0)+hst(a);
  const dispCl = p => p.clientName||(locs.find(l=>l.id===p.locationId)?.client)||(locs.find(l=>l.id===p.locationId)?.name)||"—";
  function submit() {
    if (!form.amountBilled) return;
    const e={...form,id:editing||uid(),hst:hst(form.amountBilled),total:tot(form.amountBilled)};
    savePays(editing?pays.map(p=>p.id===editing?e:p):[...pays,e]); setForm(blank); setEditing(null); setShow(false);
  }
  const edit = p => { setForm({...blank,...p}); setEditing(p.id); setShow(true); };
  const del = id => ask("Delete this payment record?", ()=>savePays(pays.filter(p=>p.id!==id)));
  const toggleRcv = id => savePays(pays.map(p=>p.id===id?{...p,received:!p.received}:p));
  const inRange = p => { const s=p.billingStart||""; return(!fSd||s>=fSd)&&(!fEd||s<=fEd); };
  const filtered = pays.filter(p=>(fCl==="all"||p.locationId===fCl)&&inRange(p)).sort((a,b)=>(b.billingStart||"").localeCompare(a.billingStart||""));
  const rcvd = filtered.filter(p=>p.received), outst = filtered.filter(p=>!p.received);
  function doExport() {
    mkCSV(`payments_${fSd}_${fEd}`,["Client","Billing Start","Billing End","Amount Billed","HST 13%","Total","Received","Deposit Date","Notes"],
      filtered.map(p=>[dispCl(p),p.billingStart,p.billingEnd,parseFloat(p.amountBilled||0).toFixed(2),(p.hst||hst(p.amountBilled)).toFixed(2),(p.total||tot(p.amountBilled)).toFixed(2),p.received?"Yes":"No",p.depositDate||"",p.notes||""])
    );
  }
  if (!rdy) return <div style={S.card}><div style={S.empty}>Loading…</div></div>;
  return (
    <div>
      {confirmEl}
      <F style={{ marginBottom:"12px", flexWrap:"wrap" }}>
        {[["Total",filtered.length,"#e0f0ff"],["Received",rcvd.length,"#10b981"],["Outstanding",outst.length,"#f59e0b"],["Collected","$"+rcvd.reduce((s,p)=>s+(p.total||tot(p.amountBilled)),0).toFixed(2),"#10b981"],["Pending","$"+outst.reduce((s,p)=>s+(p.total||tot(p.amountBilled)),0).toFixed(2),"#f59e0b"]].map(([l,v,c])=><Stat key={l} label={l} value={v} color={c}/>)}
      </F>
      <div style={S.card}>
        <div style={S.ct}>Filter & Export</div>
        <F style={{ alignItems:"flex-end", flexWrap:"wrap" }}>
          <Inp label="Period Start" type="date" value={fSd} onChange={e=>setFSd(e.target.value)}/>
          <Inp label="Period End" type="date" value={fEd} onChange={e=>setFEd(e.target.value)}/>
          <Sel label="Client" value={fCl} onChange={e=>setFCl(e.target.value)}><option value="all">All Clients</option>{locs.map(l=><option key={l.id} value={l.id}>{l.client||l.name}</option>)}</Sel>
          <button style={{ ...S.bs, marginTop:"13px" }} onClick={doExport}>📊 Export Excel</button>
          <button style={{ ...S.bp, marginTop:"13px" }} onClick={()=>{setForm(blank);setEditing(null);setShow(s=>!s);}}>+ Add Payment</button>
        </F>
      </div>
      {show&&(
        <div style={{ ...S.card, border:"1px solid #2563eb" }}>
          <div style={S.ct}>{editing?"Edit Payment":"New Payment Entry"}</div>
          <div style={S.g3}>
            <Sel label="Client (Location)" value={form.locationId} onChange={e=>{const l=locs.find(x=>x.id===e.target.value);setForm(p=>({...p,locationId:e.target.value,clientName:l?l.client||l.name:p.clientName}))}}><option value="">Select…</option>{locs.map(l=><option key={l.id} value={l.id}>{l.name}{l.client?" — "+l.client:""}</option>)}</Sel>
            <Inp label="Client Name (override)" value={form.clientName} onChange={e=>setForm(p=>({...p,clientName:e.target.value}))} placeholder="Auto-filled"/>
            <Inp label="Amount Billed ($)" type="number" step="0.01" value={form.amountBilled} onChange={e=>setForm(p=>({...p,amountBilled:e.target.value}))} placeholder="0.00"/>
          </div>
          {form.amountBilled&&<div style={{ fontSize:"11px", color:"#5a8ab0", margin:"6px 0" }}>HST (13%): <strong style={{ color:"#e0f0ff" }}>${hst(form.amountBilled).toFixed(2)}</strong> &nbsp; Total: <strong style={{ color:"#34d399" }}>${tot(form.amountBilled).toFixed(2)}</strong></div>}
          <div style={{ ...S.g4, marginTop:"8px" }}>
            <Inp label="Billing Period Start" type="date" value={form.billingStart} onChange={e=>setForm(p=>({...p,billingStart:e.target.value}))}/>
            <Inp label="Billing Period End" type="date" value={form.billingEnd} onChange={e=>setForm(p=>({...p,billingEnd:e.target.value}))}/>
            <Inp label="Deposit Date" type="date" value={form.depositDate} onChange={e=>setForm(p=>({...p,depositDate:e.target.value}))}/>
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}><label style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11px", color:"#10b981", cursor:"pointer", padding:"7px 0" }}><input type="checkbox" checked={form.received} onChange={e=>setForm(p=>({...p,received:e.target.checked}))} style={{ width:"14px", height:"14px" }}/>Payment Received</label></div>
          </div>
          <div style={{ marginTop:"8px" }}><label style={S.lbl}>Notes</label><textarea style={S.ta} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional…"/></div>
          <F style={{ marginTop:"9px" }}><button style={S.bp} onClick={submit}>Save</button><button style={S.bo} onClick={()=>{setShow(false);setEditing(null);}}>Cancel</button></F>
        </div>
      )}
      <div style={S.card}>
        <div style={S.ct}>Payment Records ({filtered.length})</div>
        {filtered.length===0?<div style={S.empty}>No records for selected filters.</div>:<div style={{ overflowX:"auto" }}><table style={S.tbl}><thead><tr>{["Client","Billing Period","Billed","HST","Total","Received","Deposit",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(p=><tr key={p.id} style={{ background:p.received?"#06150e":"transparent" }}>
          <td style={S.td}><strong style={{ color:"#e0f0ff" }}>{dispCl(p)}</strong></td>
          <td style={S.td}><span style={{ fontSize:"10px" }}>{p.billingStart||"—"}{p.billingEnd&&p.billingEnd!==p.billingStart?` → ${p.billingEnd}`:""}</span></td>
          <td style={S.td}>${parseFloat(p.amountBilled||0).toFixed(2)}</td>
          <td style={S.td}>${(p.hst||hst(p.amountBilled)).toFixed(2)}</td>
          <td style={S.td}><strong style={{ color:"#34d399" }}>${(p.total||tot(p.amountBilled)).toFixed(2)}</strong></td>
          <td style={S.td}><label style={{ display:"flex", alignItems:"center", gap:"4px", cursor:"pointer" }}><input type="checkbox" checked={p.received} onChange={()=>toggleRcv(p.id)}/><span style={{ fontSize:"9px", color:p.received?"#10b981":"#f59e0b", fontWeight:"700" }}>{p.received?"Received":"Pending"}</span></label></td>
          <td style={S.td}>{p.depositDate||"—"}</td>
          <td style={S.td}><F><button style={S.bsm("#60a5fa")} onClick={()=>edit(p)}>Edit</button><button style={S.bd} onClick={()=>del(p.id)}>✕</button></F></td>
        </tr>)}</tbody></table></div>}
        {filtered.length>0&&<div style={{ marginTop:"10px", borderTop:"1px solid #1e3a5f", paddingTop:"8px", display:"flex", gap:"14px", fontSize:"10px", flexWrap:"wrap", color:"#5a8ab0" }}>
          <span>Billed: <strong style={{ color:"#e0f0ff" }}>${filtered.reduce((s,p)=>s+parseFloat(p.amountBilled||0),0).toFixed(2)}</strong></span>
          <span>HST: <strong style={{ color:"#e0f0ff" }}>${filtered.reduce((s,p)=>s+(p.hst||hst(p.amountBilled)),0).toFixed(2)}</strong></span>
          <span>Total: <strong style={{ color:"#34d399" }}>${filtered.reduce((s,p)=>s+(p.total||tot(p.amountBilled)),0).toFixed(2)}</strong></span>
          <span>Collected: <strong style={{ color:"#10b981" }}>${rcvd.reduce((s,p)=>s+(p.total||tot(p.amountBilled)),0).toFixed(2)}</strong></span>
          <span>Outstanding: <strong style={{ color:"#f59e0b" }}>${outst.reduce((s,p)=>s+(p.total||tot(p.amountBilled)),0).toFixed(2)}</strong></span>
        </div>}
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
  const hstAmt = inv.hst ? sub*0.13 : 0;
  const tot = sub + hstAmt;
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
      ${inv.clientAddress ? `<p style="color:#555">${inv.clientAddress}</p>` : ""}
      ${inv.clientEmail ? `<p style="color:#555">${inv.clientEmail}</p>` : ""}
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
    <div class="tot-row"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>
    ${inv.hst ? `<div class="tot-row"><span>HST (13%)</span><span>$${hstAmt.toFixed(2)}</span></div>` : ""}
    <div class="tot-row final"><span>Total</span><span>$${tot.toFixed(2)}</span></div>
  </div>
  ${inv.notes ? `<div class="notes-box"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
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

  // dashboard filters
  const [fyStart, setFyStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [fyEnd,   setFyEnd]   = useState(`${new Date().getFullYear()}-12-31`);
  const [fClient, setFClient] = useState("all");

  const blankForm = () => ({
    number:"", date:new Date().toISOString().slice(0,10), dueDate:"", summary:"",
    clientLocationId:"", clientName:"", clientAddress:"", clientEmail:"",
    items:[{ desc:"Security Services", qty:1, price:"" }],
    hst:true, notes:"", status:"outstanding",
    // company fields merged in at submit time from co profile
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
    const hstAmt = src.hst ? sub*0.13 : 0;
    return { sub, hstAmt, total:sub+hstAmt };
  }

  function setItem(i, k, v) { const items=[...form.items]; items[i]={...items[i],[k]:v}; setForm(p=>({...p,items})); }
  const addItem    = () => setForm(p=>({...p,items:[...p.items,{desc:"",qty:1,price:""}]}));
  const removeItem = i  => ask("Remove this line item?", ()=>setForm(p=>({...p,items:p.items.filter((_,j)=>j!==i)})));

  function submit() {
    if (!form.clientName.trim()&&!form.clientLocationId) { alert("Please select or enter a client."); return; }
    const { sub, hstAmt, total } = calcTotals();
    const entry = { ...form, ...co, logo:logoB64, id:editing||uid(), subtotal:sub, hstAmt, total };
    saveInvs(editing ? invs.map(x=>x.id===editing?entry:x) : [...invs,entry]);
    setEditing(null); setView("list");
  }

  function delInv(id)        { ask("Delete this invoice? This cannot be undone.", ()=>saveInvs(invs.filter(x=>x.id!==id))); }
  function setStatus(id, st) { saveInvs(invs.map(x=>x.id===id?{...x,status:st}:x)); }

  const clientLabel = inv => inv.clientName||(locs.find(l=>l.id===inv.clientLocationId)?.client)||(locs.find(l=>l.id===inv.clientLocationId)?.name)||"—";

  // stats
  const inPeriod    = inv => (inv.date||"") >= fyStart && (inv.date||"") <= fyEnd;
  const byClient    = inv => fClient==="all" || inv.clientLocationId===fClient;
  const outstanding = invs.filter(x=>x.status==="outstanding");
  const overdue     = invs.filter(x=>x.status==="overdue");
  const paid        = invs.filter(x=>x.status==="paid");
  const fyRevenue   = paid.filter(inPeriod).reduce((s,x)=>s+(x.total||0),0);
  const clientRev   = invs.filter(inPeriod).filter(byClient).filter(x=>x.status==="paid").reduce((s,x)=>s+(x.total||0),0);
  const clientHST   = invs.filter(inPeriod).filter(byClient).filter(x=>x.status==="paid").reduce((s,x)=>s+(x.hstAmt||0),0);
  const periodInvs  = invs.filter(inPeriod).filter(byClient);

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
            {[["Outstanding",outstanding.length,"#f59e0b"],["Overdue",overdue.length,"#ef4444"],["Paid (All Time)",paid.length,"#10b981"],["FY Revenue","$"+fyRevenue.toFixed(2),"#3b82f6"]].map(([l,v,c])=>(
              <div key={l} style={{ ...S.stat, flex:"1", minWidth:"110px", borderColor:c+"44" }}>
                <div style={{ ...S.sn, color:c, fontSize:"18px" }}>{v}</div><div style={S.sl}>{l}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.ct}>Revenue & HST Filter</div>
            <div style={{ display:"flex", gap:"9px", flexWrap:"wrap", alignItems:"flex-end" }}>
              <div><label style={S.lbl}>Period Start</label><input style={S.inp} type="date" value={fyStart} onChange={e=>setFyStart(e.target.value)}/></div>
              <div><label style={S.lbl}>Period End</label><input style={S.inp} type="date" value={fyEnd} onChange={e=>setFyEnd(e.target.value)}/></div>
              <div><label style={S.lbl}>Client</label>
                <select style={{ ...S.sel, minWidth:"160px" }} value={fClient} onChange={e=>setFClient(e.target.value)}>
                  <option value="all">All Clients</option>
                  {locs.map(l=><option key={l.id} value={l.id}>{l.client||l.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:"9px", marginTop:"12px", flexWrap:"wrap" }}>
              {[["Revenue in Period","$"+clientRev.toFixed(2),"#3b82f6"],["HST Collected","$"+clientHST.toFixed(2),"#a78bfa"],["Invoices in Period",periodInvs.length,"#e0f0ff"],["Outstanding",periodInvs.filter(x=>x.status==="outstanding").length,"#f59e0b"],["Overdue",periodInvs.filter(x=>x.status==="overdue").length,"#ef4444"]].map(([l,v,c])=>(
                <div key={l} style={{ ...S.stat, flex:"1", minWidth:"110px", borderColor:c+"44" }}>
                  <div style={{ ...S.sn, color:c, fontSize:"17px" }}>{v}</div><div style={S.sl}>{l}{fClient!=="all"?" — Client":""}</div>
                </div>
              ))}
            </div>
          </div>
          {overdue.length>0&&<div style={S.card}><div style={S.ct}>🔴 Overdue Invoices</div>
            <table style={S.tbl}><thead><tr>{["Invoice #","Client","Date","Due","Total",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{overdue.map(inv=><tr key={inv.id}><td style={S.td}><strong style={{ color:"#e0f0ff" }}>{inv.number}</strong></td><td style={S.td}>{clientLabel(inv)}</td><td style={S.td}>{inv.date||"—"}</td><td style={S.td}>{inv.dueDate||"—"}</td><td style={S.td}><strong style={{ color:"#ef4444" }}>${(inv.total||0).toFixed(2)}</strong></td><td style={S.td}><div style={{ display:"flex",gap:"5px" }}><button style={S.bsm("#10b981")} onClick={()=>setStatus(inv.id,"paid")}>Mark Paid</button><button style={S.bsm("#60a5fa")} onClick={()=>startEdit(inv)}>Edit</button></div></td></tr>)}</tbody>
            </table></div>}
          {outstanding.length>0&&<div style={S.card}><div style={S.ct}>🟡 Outstanding Invoices</div>
            <table style={S.tbl}><thead><tr>{["Invoice #","Client","Date","Due","Total",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{outstanding.map(inv=><tr key={inv.id}><td style={S.td}><strong style={{ color:"#e0f0ff" }}>{inv.number}</strong></td><td style={S.td}>{clientLabel(inv)}</td><td style={S.td}>{inv.date||"—"}</td><td style={S.td}>{inv.dueDate||"—"}</td><td style={S.td}><strong style={{ color:"#f59e0b" }}>${(inv.total||0).toFixed(2)}</strong></td><td style={S.td}><div style={{ display:"flex",gap:"5px" }}><button style={S.bsm("#10b981")} onClick={()=>setStatus(inv.id,"paid")}>Mark Paid</button><button style={S.bsm("#ef4444")} onClick={()=>setStatus(inv.id,"overdue")}>Overdue</button><button style={S.bsm("#60a5fa")} onClick={()=>startEdit(inv)}>Edit</button></div></td></tr>)}</tbody>
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
            <div style={{ marginTop:"8px" }}>
              <label style={S.lbl}>Invoice Summary / Description <span style={{ color:"#3a6a8a", fontWeight:"400", textTransform:"none" }}>(appears on PDF under invoice number)</span></label>
              <input style={S.inp} value={form.summary} onChange={e=>setForm(p=>({...p,summary:e.target.value}))} placeholder="e.g. Security Services — Downtown Mall — May 1–15, 2026"/>
            </div>
          </div>

          {/* client — auto-fill from locations + saved per invoice */}
          <div style={S.card}>
            <div style={S.ct}>Client / Bill To</div>
            <div style={S.g3}>
              <div><label style={S.lbl}>Select Client (from Locations)</label>
                <select style={S.sel} value={form.clientLocationId} onChange={e=>{
                  const l=locs.find(x=>x.id===e.target.value);
                  setForm(p=>({...p, clientLocationId:e.target.value,
                    clientName: l?l.client||l.name:p.clientName,
                    clientAddress: l?.clientAddress||p.clientAddress,
                    clientEmail: l?.contactEmail||p.clientEmail,
                  }));
                }}>
                  <option value="">Select…</option>
                  {locs.map(l=><option key={l.id} value={l.id}>{l.name}{l.client?" — "+l.client:""}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Client Name</label><input style={S.inp} value={form.clientName} onChange={e=>setForm(p=>({...p,clientName:e.target.value}))} placeholder="Auto-filled or type"/></div>
              <div><label style={S.lbl}>Client Email</label><input style={S.inp} value={form.clientEmail} onChange={e=>setForm(p=>({...p,clientEmail:e.target.value}))}/></div>
            </div>
            <div style={{ marginTop:"8px" }}><label style={S.lbl}>Client Address</label><input style={S.inp} value={form.clientAddress} onChange={e=>setForm(p=>({...p,clientAddress:e.target.value}))}/></div>
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
            <div style={{ marginTop:"14px", maxWidth:"280px", marginLeft:"auto", background:"#070d19", borderRadius:"7px", padding:"12px" }}>
              {(()=>{ const {sub,hstAmt,total}=calcTotals(); return (<>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:"5px", color:"#5a8ab0" }}><span>Subtotal</span><span>${sub.toFixed(2)}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:"7px", alignItems:"center" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:"5px", cursor:"pointer", color:"#5a8ab0" }}><input type="checkbox" checked={form.hst} onChange={e=>setForm(p=>({...p,hst:e.target.checked}))}/>HST (13%)</label>
                  <span style={{ color:"#5a8ab0" }}>${hstAmt.toFixed(2)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"14px", fontWeight:"800", color:"#e0f0ff", borderTop:"1px solid #1e3a5f", paddingTop:"7px" }}><span>Total</span><span>${total.toFixed(2)}</span></div>
              </>); })()}
            </div>
          </div>

          {/* notes */}
          <div style={S.card}>
            <div style={S.ct}>Notes / Payment Instructions</div>
            <textarea style={S.ta} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. Please make cheques payable to SecureOps Inc. Payment due within 30 days."/>
          </div>

          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
            <button style={S.bp} onClick={submit}>Save Invoice</button>
            <button style={{ ...S.bsm("#a78bfa"), padding:"7px 13px", fontSize:"10px" }} onClick={()=>{ const {sub,hstAmt,total}=calcTotals(); printInvoiceHTML({...form,...co,logo:logoB64,subtotal:sub,hstAmt,total}); }}>🖨 Preview PDF</button>
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
  {id:"emp",label:"🪪 Employees"},{id:"loc",label:"📍 Locations"},
  {id:"cal",label:"📅 Calendar"},{id:"rep",label:"📊 Reports"},
  {id:"his",label:"🗂 History"},{id:"inv",label:"🧾 Invoices"},
  {id:"pay",label:"💰 Payments"},{id:"sal",label:"🎯 Sales"},
];

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
  if (!loaded) return <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}><div style={{ color:"#3a6a8a", letterSpacing:"2px" }}>LOADING…</div></div>;

  return (
    <div style={S.app}>
      <header style={S.hdr}>
        <div style={S.logo}>🛡 SECURE<span style={{ color:"#3b82f6" }}>OPS</span></div>
        <nav style={{ display:"flex", gap:"2px", marginLeft:"auto", flexWrap:"wrap" }}>
          {TABS.map(t => <button key={t.id} style={S.nb(tab===t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
          <button style={{ ...S.nb(false), color:"#f87171", marginLeft:"6px" }} onClick={() => setLoggedIn(false)}>Sign Out</button>
        </nav>
      </header>
      <main style={S.main}>
        {tab==="emp" && <Employees guards={guards} setGuards={setGuards} />}
        {tab==="loc" && <Locations locs={locs} setLocs={setLocs} />}
        {tab==="cal" && <Calendar guards={guards} locs={locs} scs={scs} setScs={setScs} ovs={ovs} setOvs={setOvs} />}
        {tab==="rep" && <Reports guards={guards} locs={locs} scs={scs} ovs={ovs} history={history} setHistory={setHistory} />}
        {tab==="his" && <History history={history} setHistory={setHistory} />}
        {tab==="inv" && <Invoices locs={locs} />}
        {tab==="pay" && <Payments locs={locs} />}
        {tab==="sal" && <Sales />}
      </main>
    </div>
  );
}