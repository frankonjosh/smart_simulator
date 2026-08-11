// Dev-only dashboard for the simulator. Served at GET /ui as a single
// self-contained HTML page (no build step, no static files) so it ships
// automatically wherever the sim runs. It only talks to the sim's own
// same-origin helper endpoints: /sim/state (read), /sim/seed/claim,
// /sim/seed/preauth, /sim/reset. No auth — intended for an internal
// demo/dev box, same trust level as the /sim/* helpers themselves.
export function registerUi(app) {
    const serve = async (_req, reply) => reply.type('text/html').send(PAGE);
    // /ui  — direct access when the sim's port is reachable (local dev).
    // /sim/ui — access behind an nginx reverse proxy that forwards the
    // whole /sim/ prefix here (server deploy). The page's data calls use
    // absolute /sim/* paths, which resolve correctly under both.
    app.get('/ui', serve);
    app.get('/sim/ui', serve);
}

// The client script below deliberately uses only single-quoted strings
// and '+' concatenation (no backticks, no ${}) so it can live inside
// this server-side template literal without escaping games.
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Curis SMART Simulator — DB Console</title>
<style>
  :root { --ink:#1b1b1b; --muted:#666; --line:#e2e2e2; --bg:#f6f6f4; --card:#fff;
          --accent:#1f5c7a; --accent2:#0d3d54; --danger:#a11; --ok:#137333; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
         color:var(--ink); background:var(--bg); }
  header { background:var(--accent2); color:#fff; padding:14px 20px; display:flex;
           align-items:center; gap:16px; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; font-weight:600; }
  header .sub { color:#bcd6e4; font-size:12px; }
  header .spacer { flex:1; }
  header label { color:#cfe3ee; font-size:12px; display:flex; align-items:center; gap:6px; }
  .wrap { padding:20px; max-width:1200px; margin:0 auto; }
  .row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:8px;
          padding:14px 16px; margin-bottom:16px; }
  .card h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted);
             margin:0 0 10px; }
  .controls { flex:1; min-width:320px; }
  .controls .field { margin-bottom:10px; }
  .controls label { display:block; font-size:12px; color:var(--muted); margin-bottom:3px; }
  input[type=text], textarea { width:100%; padding:7px 9px; border:1px solid var(--line);
          border-radius:6px; font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; }
  textarea { min-height:120px; resize:vertical; }
  .inline { display:flex; gap:10px; }
  .inline .field { flex:1; }
  button { border:0; border-radius:6px; padding:8px 14px; font-size:13px; font-weight:600;
           cursor:pointer; color:#fff; background:var(--accent); }
  button:hover { background:var(--accent2); }
  button.ghost { background:#eef2f4; color:var(--accent2); }
  button.danger { background:#fff; color:var(--danger); border:1px solid var(--danger); }
  button.danger.armed { background:var(--danger); color:#fff; }
  .btnrow { display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
  #msg { min-height:20px; font-size:13px; margin:4px 0 12px; }
  #msg.ok { color:var(--ok); } #msg.err { color:var(--danger); }
  details.tbl { background:var(--card); border:1px solid var(--line); border-radius:8px;
                margin-bottom:10px; overflow:hidden; }
  details.tbl > summary { cursor:pointer; padding:10px 14px; font-weight:600; list-style:none;
                display:flex; align-items:center; gap:8px; }
  details.tbl > summary::-webkit-details-marker { display:none; }
  .count { background:var(--accent); color:#fff; border-radius:10px; font-size:11px;
           padding:1px 8px; font-weight:600; }
  .count.zero { background:#d7d7d7; color:#555; }
  .scroll { overflow-x:auto; border-top:1px solid var(--line); }
  table { border-collapse:collapse; width:100%; font-size:12.5px; }
  th, td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line);
           white-space:nowrap; vertical-align:top; }
  th { background:#fafafa; color:var(--muted); position:sticky; top:0; font-weight:600; }
  td.json { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre;
            max-width:520px; overflow:hidden; text-overflow:ellipsis; }
  .empty { padding:14px; color:var(--muted); font-style:italic; }
  .muted { color:var(--muted); font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>Curis SMART Simulator</h1>
  <span class="sub">DB Console</span>
  <span class="spacer"></span>
  <label><input type="checkbox" id="auto"> auto-refresh (3s)</label>
  <button class="ghost" id="refresh" onclick="load()">Refresh now</button>
</header>

<div class="wrap">
  <div id="msg"></div>

  <div class="row">
    <div class="card controls">
      <h2>Seed a claim</h2>
      <div class="inline">
        <div class="field"><label>country</label><input type="text" id="c_country" value="KE"></div>
        <div class="field"><label>customerid (blank = all tenants)</label><input type="text" id="c_cust" value=""></div>
      </div>
      <div class="field">
        <label>payload JSON — <code>integ_scheme_code</code>, <code>member_number</code> &amp; <code>provider_code</code> must already exist in this tenant, or Curis rejects it on ingest</label>
        <textarea id="c_payload"></textarea>
      </div>
      <div class="btnrow"><button onclick="seedClaim()">Seed claim</button></div>
    </div>

    <div class="card controls">
      <h2>Seed a pre-auth</h2>
      <div class="inline">
        <div class="field"><label>country</label><input type="text" id="p_country" value="KE"></div>
        <div class="field"><label>customerid (blank = all tenants)</label><input type="text" id="p_cust" value=""></div>
      </div>
      <div class="field">
        <label>payload JSON (must include <code>Id</code>)</label>
        <textarea id="p_payload"></textarea>
      </div>
      <div class="btnrow"><button onclick="seedPreauth()">Seed pre-auth</button></div>
    </div>
  </div>

  <div class="card">
    <h2>Danger zone</h2>
    <p class="muted">Wipes every table in the simulator DB. Two clicks to confirm.</p>
    <div class="btnrow"><button class="danger" id="resetBtn" onclick="reset()">Reset simulator DB</button></div>
  </div>

  <div class="card" style="background:transparent;border:0;padding:0">
    <h2 style="padding-left:2px">Database</h2>
    <div id="tables"></div>
  </div>
</div>

<script>
// Curis's claim ingester parses this exact SMART shape. The scheme
// (integ_scheme_code), member (member_number/integ_member_number) and
// provider (provider_code) MUST already exist in the tenant named by
// customerid, or Curis rejects the claim on ingest ("scheme ... not
// found"). Edit the codes to match your own tenant's data.
var CLAIM_TEMPLATE = {
  claim_id: 90001,
  claim_code: "CLM-DEMO-001",
  member_number: "CLAUDE-CORP-MEM-00001",
  integ_member_number: "CLAUDE-CORP-MEM-00001",
  integ_scheme_code: "claude-scheme-2026",
  provider_code: "claude-hospital",
  visit_start: "2026-08-10",
  gross_amount: 2000,
  amount: 2000,
  policy_currency_code: "KES",
  diagnosis: [ { code: "A00", name: "Test diagnosis", coding_standard: "ICD10", is_primary: 1 } ],
  invoices: [ {
    invoice_id: "INV-DEMO-1", invoice_number: "INV-DEMO-1", invoice_date: "2026-08-10",
    amount: 2000, gross_amount: 2000,
    payer_benefit_code: "outpatient", benefit_desc: "Outpatient", service_type: "outpatient", pool_number: 1,
    line_items: [ { prov_item_code: "CONS", prov_item_name: "Consultation", quantity: 1, amount: 2000, unit_price: 2000, charge_date: "2026-08-10", service_group: "consultation" } ]
  } ]
};
var PREAUTH_TEMPLATE = {
  Id: 5001,
  member_number: "CLAUDE-CORP-MEM-00001",
  integ_scheme_code: "claude-scheme-2026",
  provider_code: "claude-hospital",
  benefit_code: "inpatient",
  requested_amount: 45000,
  items: [ { id: 1, description: "Admission", amount: 45000 } ]
};

function j(o){ return JSON.stringify(o, null, 2); }
function setMsg(text, kind){ var m=document.getElementById('msg'); m.textContent=text||''; m.className=kind||''; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function cell(v){
  if (v === null || v === undefined) return '<td class="muted">null</td>';
  if (typeof v === 'object') return '<td class="json">' + esc(JSON.stringify(v)) + '</td>';
  var s = String(v);
  if (s.length > 400) s = s.slice(0,400) + '…';
  return '<td>' + esc(s) + '</td>';
}

function renderTable(name, rows){
  var open = rows.length > 0 ? ' open' : '';
  var cz = rows.length === 0 ? ' zero' : '';
  var html = '<details class="tbl"' + open + '><summary>' + esc(name) +
             ' <span class="count' + cz + '">' + rows.length + '</span></summary>';
  if (rows.length === 0){ return html + '<div class="empty">no rows</div></details>'; }
  var cols = {};
  for (var i=0;i<rows.length;i++){ for (var k in rows[i]){ cols[k]=true; } }
  var colList = Object.keys(cols);
  html += '<div class="scroll"><table><thead><tr>';
  for (var c=0;c<colList.length;c++){ html += '<th>' + esc(colList[c]) + '</th>'; }
  html += '</tr></thead><tbody>';
  for (var r=0;r<rows.length;r++){
    html += '<tr>';
    for (var c2=0;c2<colList.length;c2++){ html += cell(rows[r][colList[c2]]); }
    html += '</tr>';
  }
  html += '</tbody></table></div></details>';
  return html;
}

function load(){
  fetch('/sim/state').then(function(res){ return res.json(); }).then(function(state){
    var out = '';
    var names = Object.keys(state);
    for (var i=0;i<names.length;i++){
      var rows = state[names[i]] || [];
      out += renderTable(names[i], rows);
    }
    document.getElementById('tables').innerHTML = out;
  }).catch(function(e){ setMsg('Could not load state: ' + e, 'err'); });
}

function postJson(url, body){
  return fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body) }).then(function(res){
      return res.json().then(function(d){ return { ok: res.ok, status: res.status, data: d }; });
  });
}

function parsePayload(id){
  var raw = document.getElementById(id).value;
  try { return JSON.parse(raw); }
  catch(e){ setMsg('Payload is not valid JSON: ' + e.message, 'err'); return null; }
}

function seedClaim(){
  var payload = parsePayload('c_payload'); if (!payload) return;
  postJson('/sim/seed/claim', {
    country: document.getElementById('c_country').value || 'KE',
    customerid: document.getElementById('c_cust').value || '',
    payload: payload
  }).then(function(r){
    if (r.ok) { setMsg('Seeded claim ' + (r.data.claim_id) + ' (customerid: "' + r.data.customerid + '")', 'ok'); load(); }
    else setMsg('Seed failed (' + r.status + '): ' + (r.data.error || JSON.stringify(r.data)), 'err');
  }).catch(function(e){ setMsg('Seed failed: ' + e, 'err'); });
}

function seedPreauth(){
  var payload = parsePayload('p_payload'); if (!payload) return;
  postJson('/sim/seed/preauth', {
    country: document.getElementById('p_country').value || 'KE',
    customerid: document.getElementById('p_cust').value || '',
    payload: payload
  }).then(function(r){
    if (r.ok) { setMsg('Seeded pre-auth ' + (r.data.preauth_id) + ' (customerid: "' + r.data.customerid + '")', 'ok'); load(); }
    else setMsg('Seed failed (' + r.status + '): ' + (r.data.error || JSON.stringify(r.data)), 'err');
  }).catch(function(e){ setMsg('Seed failed: ' + e, 'err'); });
}

var resetArmed = false, resetTimer = null;
function reset(){
  var b = document.getElementById('resetBtn');
  if (!resetArmed){
    resetArmed = true; b.classList.add('armed'); b.textContent = 'Click again to confirm reset';
    resetTimer = setTimeout(function(){ resetArmed=false; b.classList.remove('armed'); b.textContent='Reset simulator DB'; }, 4000);
    return;
  }
  clearTimeout(resetTimer); resetArmed=false; b.classList.remove('armed'); b.textContent='Reset simulator DB';
  postJson('/sim/reset', {}).then(function(r){
    if (r.ok) { setMsg('Simulator DB reset.', 'ok'); load(); }
    else setMsg('Reset failed (' + r.status + ')', 'err');
  }).catch(function(e){ setMsg('Reset failed: ' + e, 'err'); });
}

var autoTimer = null;
document.getElementById('auto').addEventListener('change', function(e){
  if (e.target.checked){ autoTimer = setInterval(load, 3000); }
  else { clearInterval(autoTimer); autoTimer = null; }
});

document.getElementById('c_payload').value = j(CLAIM_TEMPLATE);
document.getElementById('p_payload').value = j(PREAUTH_TEMPLATE);
load();
</script>
</body>
</html>`;
