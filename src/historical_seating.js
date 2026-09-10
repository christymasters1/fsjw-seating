"use strict";
(function(){
  const HISTORY_YEAR=2025;
  const ASSIGNED_SEATING_PRODUCT=/assigned seating/i;
  const SEAT_CODE=/^[A-HJ-NP-TV-Z]{1,2}\d{2}$/i;
  let historicalRecords=[];
  let historicalLinks=[];
  let overlayOn=false;
  let historyReady=false;
  let historyLoading=false;

  function norm(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
  function escHtml(v){if(typeof esc==="function")return esc(String(v??""));return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function unique(v){return [...new Set(v.filter(Boolean))];}
  function currentRez(){try{return String(selectedRez||"");}catch{return "";}}
  function currentGuests(){try{return Array.isArray(guests)?guests:(window.guests||[]);}catch{return window.guests||[];}}
  function currentGuestIndex(){const out=new Map();currentGuests().forEach(g=>{const n=norm(g.normalized_guest_name||g.guest_name);if(!n)return;if(!out.has(n))out.set(n,[]);out.get(n).push(g);});return out;}

  function parseCsvMatrix(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell="";}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);rows.push(row);row=[];cell="";}else cell+=c;}if(cell.length||row.length){row.push(cell);rows.push(row);}return rows;}
  function toObjects(matrix){if(matrix.length<2)return[];const headers=matrix[0].map(h=>String(h||"").trim());return matrix.slice(1).filter(r=>r.some(v=>String(v||"").trim())).map(cols=>{const o={};headers.forEach((h,i)=>o[h]=cols[i]??"");return o;});}
  function cleanComment(v){const text=String(v||"").trim();if(typeof sanitizeComment==="function"){try{const r=sanitizeComment(text);return r.clean||r.sanitized||text;}catch{}}return text.slice(0,4000);}
  async function sha256(v){const raw=String(v||"").trim().toLowerCase();if(!raw||!crypto?.subtle)return null;const bytes=new TextEncoder().encode(raw);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
  function normalizePhone(v){return String(v||"").replace(/\D/g,"").slice(-10);}
  function normalizeEmail(v){return String(v||"").trim().toLowerCase();}

  async function loadHistory(){if(historyLoading)return;historyLoading=true;try{historicalRecords=await apiAll("historical_guest_records?select=*&event_year=eq."+HISTORY_YEAR+"&order=guest_name.asc");historicalLinks=await apiAll("historical_links?select=*&event_year=eq."+HISTORY_YEAR);historyReady=true;}catch(e){console.error("Historical seating load failed",e);}finally{historyLoading=false;}}
  function recordsForRez(rezId){return historicalRecords.filter(r=>String(r.matched_rez_id||"")===String(rezId||""));}
  function linkedRezIds(rezId){const id=String(rezId||""),out=[];historicalLinks.forEach(l=>{if(String(l.matched_rez_id)===id)out.push(String(l.linked_rez_id));if(String(l.linked_rez_id)===id)out.push(String(l.matched_rez_id));});return unique(out).filter(x=>x!==id);}

  function historicalDetailsMarkup(rezId){
    const own=recordsForRez(rezId);
    if(!historyReady)return '<section class="history2025Native"><div class="history2025NativeTitle">2025 HISTORY</div><div class="history2025Empty">Loading 2025 history…</div></section>';
    if(!own.length)return '<section class="history2025Native"><div class="history2025NativeTitle">2025 HISTORY</div><div class="history2025Empty">No 2025 reservation matched to this guest.</div></section>';
    const seats=own.filter(r=>r.seat_id).map(r=>'<div><b>'+escHtml(r.guest_name)+'</b> · '+escHtml(r.seat_id)+'</div>').join("")||'<div>None recorded</div>';
    const comments=unique(own.flatMap(r=>[r.reservation_comments,r.guest_comments]).map(x=>String(x||"").trim())).map(c=>'<div class="history2025Comment">'+escHtml(c)+'</div>').join("")||'<div>None recorded</div>';
    const linkedRows=linkedRezIds(rezId).flatMap(id=>recordsForRez(id));
    const linked=linkedRows.length?linkedRows.map(r=>'<div><b>'+escHtml(r.guest_name)+'</b>'+(r.seat_id?' · '+escHtml(r.seat_id):'')+' <span class="history2025Rez">2026 #'+escHtml(r.matched_rez_id)+'</span></div>').join(""):'<div>None</div>';
    return '<section class="history2025Native"><div class="history2025NativeTitle">2025 HISTORY</div><div class="detailLabel">2025 Seating</div><div class="detailText">'+seats+'</div><div class="detailLabel">2025 Comments</div><div class="detailText">'+comments+'</div><div class="detailLabel">2025 Linked Guests</div><div class="detailText">'+linked+'</div></section><div class="history2025Rule"></div>';
  }
  window.historical2025DetailsMarkup=historicalDetailsMarkup;

  function findNotesHeading(){const sidebar=document.querySelector(".sidebar");if(!sidebar)return null;return [...sidebar.querySelectorAll("h1,h2,h3,h4,h5,h6")].find(h=>/christy\s*\+\s*cathy\s+notes/i.test(h.textContent||""))||null;}
  function renderHistoryDetailsDom(){
    const sidebar=document.querySelector(".sidebar");if(!sidebar)return;
    sidebar.querySelectorAll(".history2025,.history2025Native,.history2025Rule").forEach(el=>el.remove());
    const notesHeading=findNotesHeading();if(!notesHeading)return;
    const holder=document.createElement("div");holder.innerHTML=historicalDetailsMarkup(currentRez());
    const parent=notesHeading.parentNode;
    while(holder.firstChild)parent.insertBefore(holder.firstChild,notesHeading);
  }

  function seatCode(el){return String(el?.dataset?.seatId||el?.dataset?.seat||el?.getAttribute?.("data-seat-id")||el?.getAttribute?.("data-seat")||el?.textContent||"").trim().toUpperCase();}
  function overlaySeatMap(){
    document.querySelectorAll(".seat,.ttseat").forEach(el=>{el.classList.remove("history2025Own","history2025Linked");if(el.dataset.historyTitle){el.title=el.dataset.historyOriginalTitle||"";delete el.dataset.historyTitle;delete el.dataset.historyOriginalTitle;}});
    if(!overlayOn)return;const rezId=currentRez();if(!rezId)return;
    const own=recordsForRez(rezId).filter(r=>r.seat_id),linked=linkedRezIds(rezId).flatMap(id=>recordsForRez(id)).filter(r=>r.seat_id);
    const ownBySeat=new Map(),linkedBySeat=new Map();own.forEach(r=>ownBySeat.set(String(r.seat_id).toUpperCase(),r));linked.forEach(r=>linkedBySeat.set(String(r.seat_id).toUpperCase(),r));
    document.querySelectorAll(".seat,.ttseat").forEach(el=>{const code=seatCode(el),ownRec=ownBySeat.get(code),linkedRec=linkedBySeat.get(code),rec=ownRec||linkedRec;if(!rec)return;el.classList.add(ownRec?"history2025Own":"history2025Linked");el.dataset.historyOriginalTitle=el.title||"";el.dataset.historyTitle="1";el.title="2025: "+rec.guest_name+" · "+rec.seat_id+(rec.matched_rez_id?" · 2026 #"+rec.matched_rez_id:"");});
  }
  function ensureToggle(){const map=document.querySelector(".mapcard");if(!map)return;let btn=document.getElementById("toggle2025Seating");if(!btn){btn=document.createElement("button");btn.id="toggle2025Seating";btn.type="button";btn.className="toggle2025Seating";btn.addEventListener("click",()=>{overlayOn=!overlayOn;btn.textContent=overlayOn?"Hide 2025 Seating":"Show 2025 Seating";btn.classList.toggle("active",overlayOn);overlaySeatMap();});const legend=map.querySelector(".maplegend");if(legend)legend.insertAdjacentElement("afterend",btn);else map.insertBefore(btn,map.firstChild);}btn.textContent=overlayOn?"Hide 2025 Seating":"Show 2025 Seating";btn.classList.toggle("active",overlayOn);}
  function renderHistoricalUi(){ensureToggle();renderHistoryDetailsDom();overlaySeatMap();}

  function buildHistoricalLinks(records){const links=[],matched=records.filter(r=>r.matched_rez_id),candidates=matched.map(r=>({rez:String(r.matched_rez_id),full:norm(r.guest_name),last:norm(r.guest_name).split(" ").filter(Boolean).pop()||""})),lastCounts=new Map(),seen=new Set();candidates.forEach(c=>{if(c.last.length>=5)lastCounts.set(c.last,(lastCounts.get(c.last)||0)+1);});matched.forEach(source=>{const text=norm((source.reservation_comments||"")+" "+(source.guest_comments||""));if(!text||!/(seat|sit|room|near|beside|with|group|friend|together|next to)/i.test(text))return;candidates.forEach(c=>{if(c.rez===String(source.matched_rez_id))return;const fullHit=c.full.length>=6&&text.includes(c.full);const lastHit=!fullHit&&c.last.length>=5&&lastCounts.get(c.last)===1&&new RegExp("\\b"+c.last+"s?\\b","i").test(text);if(!fullHit&&!lastHit)return;const a=String(source.matched_rez_id),b=c.rez,key=[a,b].sort().join("|");if(seen.has(key))return;seen.add(key);links.push({event_year:HISTORY_YEAR,matched_rez_id:a,linked_rez_id:b,source_historical_rez_id:source.historical_rez_id,basis:fullHit?"2025 comment named guest":"2025 comment named unique surname"});});});return links;}

  async function importHistory(file){
    const rows=toObjects(parseCsvMatrix(await file.text()));if(!rows.length)throw new Error("The 2025 CSV has no data rows.");
    const required=["RezId1","PartyName","AddOnProductName","AddOnCategoryName","RezComments","GuestComments"],missing=required.filter(h=>!(h in rows[0]));if(missing.length)throw new Error("Missing 2025 columns: "+missing.join(", "));
    const dates=rows.map(r=>String(r.AdjStartDate||"")).filter(Boolean).slice(0,50).join(" ");if(dates&&!dates.includes("2025"))throw new Error("This file does not appear to be the 2025 event export.");
    const byKey=new Map();rows.forEach(source=>{const rez=String(source.RezId1||"").trim(),name=String(source.PartyName||"").trim(),n=norm(name);if(!rez||!name||!n)return;const key=rez+"|"+n;if(!byKey.has(key))byKey.set(key,{event_year:HISTORY_YEAR,historical_rez_id:rez,guest_name:name,normalized_guest_name:n,seat_id:null,reservation_comments:"",guest_comments:"",room_type:String(source.PrimaryCategoryCode||"").trim()||null,seat_upgrade_status:null,matched_rez_id:null,match_method:"unmatched",email:normalizeEmail(source.Email),phone:normalizePhone(source.ContactPhone),source_file:file.name});const item=byKey.get(key),product=String(source.AddOnProductName||"").trim(),addon=String(source.AddOnCategoryName||"").trim().toUpperCase();if(ASSIGNED_SEATING_PRODUCT.test(product)&&SEAT_CODE.test(addon))item.seat_id=addon;if(addon==="SUP")item.seat_upgrade_status="YES on reservation";item.reservation_comments=item.reservation_comments||cleanComment(source.RezComments);item.guest_comments=item.guest_comments||cleanComment(source.GuestComments);});
    const nameIndex=currentGuestIndex(),records=[];
    for(const item of byKey.values()){item.email_hash=await sha256(item.email);item.phone_hash=await sha256(item.phone);delete item.email;delete item.phone;const exact=nameIndex.get(item.normalized_guest_name)||[];if(exact.length===1){item.matched_rez_id=String(exact[0].rez_id);item.match_method="exact name";}records.push(item);}
    setStatus("Replacing 2025 historical seating…","busy");await api("historical_links?event_year=eq."+HISTORY_YEAR,{method:"DELETE",headers:{Prefer:"return=minimal"}});await api("historical_guest_records?event_year=eq."+HISTORY_YEAR,{method:"DELETE",headers:{Prefer:"return=minimal"}});await chunkedUpsert("historical_guest_records",records,"event_year,historical_rez_id,normalized_guest_name",100);const links=buildHistoricalLinks(records);if(links.length)await chunkedUpsert("historical_links",links,"event_year,matched_rez_id,linked_rez_id",100);historicalRecords=records;historicalLinks=links;historyReady=true;renderHistoricalUi();return{records:records.length,matched:records.filter(r=>r.matched_rez_id).length,links:links.length};
  }

  function ensureImportButton(){const actions=document.querySelector(".actions");if(!actions)return;let old=document.getElementById("import2025Btn");if(old&&old.dataset.nativeHistory==="1")return;if(old){const fresh=old.cloneNode(true);old.replaceWith(fresh);old=fresh;}const btn=old||document.createElement("button");btn.id="import2025Btn";btn.dataset.nativeHistory="1";btn.textContent="Import 2025 Seating";let input=document.getElementById("import2025NativeFile");if(!input){input=document.createElement("input");input.id="import2025NativeFile";input.type="file";input.accept=".csv,text/csv";input.style.display="none";actions.appendChild(input);}if(!old)actions.appendChild(btn);btn.onclick=()=>input.click();input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{setStatus("Reading 2025 historical seating locally…","busy");const r=await importHistory(file);setStatus("Imported "+r.records+" 2025 guest records; "+r.matched+" matched to 2026; "+r.links+" historical links found.","ok");}catch(e){console.error(e);setStatus("2025 import failed: "+e.message,"warn");}finally{input.value="";}};}

  document.addEventListener("click",event=>{if(!overlayOn)return;const seat=event.target.closest(".history2025Own,.history2025Linked");if(!seat)return;event.preventDefault();event.stopImmediatePropagation();setStatus(seat.title||"2025 historical seat. Read-only.","ok");},true);

  const priorRender=window.renderAll;if(typeof priorRender==="function")window.renderAll=function(){priorRender();ensureImportButton();requestAnimationFrame(renderHistoricalUi);};

  const style=document.createElement("style");style.textContent=`
    .history2025Native{margin:10px 0;padding:10px;border:2px solid #79bcae;border-radius:8px;background:#f0faf7}
    .history2025NativeTitle{font-size:12px;font-weight:900;color:#176b59;letter-spacing:.05em;margin-bottom:8px}
    .history2025Comment{margin-bottom:6px}
    .history2025Rez{color:var(--muted,#6b7280);font-size:9px}
    .history2025Empty{font-size:11px;color:var(--muted,#6b7280)}
    .history2025Rule{border-top:1px solid var(--line,#dfe4ea);margin:10px 0}
    .toggle2025Seating{display:block;margin:0 0 8px auto;border:1px solid #176b59;background:#fff;color:#176b59;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:800}
    .toggle2025Seating.active{background:#176b59;color:#fff}
    .seat.history2025Own,.ttseat.history2025Own{outline:4px solid #00a884!important;outline-offset:1px!important;box-shadow:0 0 0 2px #fff!important}
    .seat.history2025Linked,.ttseat.history2025Linked{outline:4px dashed #8a5cc7!important;outline-offset:1px!important;box-shadow:0 0 0 2px #fff!important}
  `;document.head.appendChild(style);

  loadHistory().then(()=>{ensureImportButton();renderHistoricalUi();});
  document.addEventListener("DOMContentLoaded",()=>{ensureImportButton();renderHistoricalUi();});
})();