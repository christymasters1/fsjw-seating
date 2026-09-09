"use strict";
(function(){
  let workSearch="";
  let seating2025=[];

  function rezRecord(rezId){return (window.reservations||[]).find(r=>String(r.rez_id)===String(rezId));}
  function val(record,keys){for(const k of keys){const v=record?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim();}return "";}
  function currentRoom(record){return val(record,["room_type","room_type_name","primary_category_name","category_name","primary_category","room_category_name","category_code","primary_category_code"])||"Not available";}
  function rezDate(record){return val(record,["reservation_date","date_reserved","reserved_at","created_at","rez_date","booking_date"])||"Not available";}
  function seatUpgradePaid(record){
    const raw=val(record,["seat_upgrade_paid","upgrade_fee_paid","seat_upgrade_fee_paid","upgrade_paid","seat_upgrade_payment_status"]);
    if(raw) return /^(1|true|yes|paid|complete|completed)$/i.test(raw)?"Paid":/^(0|false|no|unpaid|not paid|pending)$/i.test(raw)?"Not paid":raw;
    const text=((typeof requestText==="function"?requestText(record):"")+" "+JSON.stringify(record||{})).toLowerCase();
    if(/seat upgrade[^\n]{0,60}(paid|payment complete)/i.test(text)) return "Paid";
    if(/seat upgrade[^\n]{0,60}(unpaid|not paid|payment due)/i.test(text)) return "Not paid";
    return "Not available";
  }

  window.activeWorkRows=function(mode){
    let rows=[];
    if(mode==="suite") rows=suiteRequestRows();
    else if(mode==="room") rows=roomRequestRows();
    else if(mode==="group") rows=groupRequestRows();
    return rows.filter(r=>latestRequestStatus(workRowRezId(r),mode)!=="resolved");
  };

  window.workStatusOptions=function(mode,status){
    const options=mode==="suite"?[["pending","Pending"],["confirmed","Suite Confirmed"],["waitlist","Waitlist"],["not_available","Not Available"]]:mode==="room"?[["pending","Pending"],["approved","Approved"],["waitlist","Waitlist"],["not_available","Not Available"]]:[["pending","Pending"],["working","Working"],["completed","Completed"]];
    return options.map(([v,l])=>'<option value="'+v+'"'+(status===v?' selected':'')+'>'+l+'</option>').join("");
  };

  window.resolveWorkRequest=async function(rezId,type){
    try{
      setStatus("Resolving request…","busy");
      await api("audit_log",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({user_id:session.user.id,action:"request_status",entity_type:"reservation",entity_id:String(rezId),new_value:{request_type:type,status:"resolved",email:session.user.email,resolved_at:new Date().toISOString()}})});
      requestStatuses=await apiAll("audit_log?select=*&action=eq.request_status&order=created_at.asc");
      const rows=activeWorkRows(type);
      if(rows.length&&!rows.some(r=>String(workRowRezId(r))===String(selectedRez))){selectedRez=String(workRowRezId(rows[0]));const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;}
      renderAll();
      setStatus("Request resolved. The next reservation is ready.","ok");
    }catch(error){setStatus("Could not resolve request: "+error.message,"warn");}
  };

  function workMatches(row,mode){
    if(!workSearch) return true;
    const rezId=workRowRezId(row);
    const record=rezRecord(rezId);
    const names=mode==="group"?String(row.names||""):rezGuests(rezId).map(g=>g.guest_name).join(" ");
    const hay=[rezId,names,typeof requestText==="function"?requestText(record):"",currentRoom(record),JSON.stringify(record||{})].join(" ").toLowerCase();
    return hay.includes(workSearch.toLowerCase());
  }

  window.renderRequestWorkbench=function(){
    const searchMode=document.getElementById("reservationSearchMode"),queueMode=document.getElementById("workQueueMode"),cardsHost=document.getElementById("workCards"),metricsHost=document.getElementById("workMiniMetrics"),infoHost=document.getElementById("workQueueInfo"),footerHost=document.getElementById("workQueueFooter");
    if(!searchMode||!queueMode||!cardsHost) return;
    const suiteActive=activeWorkRows("suite"),roomActive=activeWorkRows("room"),groupActive=activeWorkRows("group");
    const sb=document.getElementById("suiteWorkBadge"),rb=document.getElementById("roomWorkBadge"),gb=document.getElementById("groupWorkBadge");if(sb)sb.textContent=suiteActive.length;if(rb)rb.textContent=roomActive.length;if(gb)gb.textContent=groupActive.length;
    document.querySelectorAll("[data-work-mode]").forEach(button=>{button.classList.toggle("active",button.dataset.workMode===requestView);button.onclick=()=>{requestView=button.dataset.workMode;workSearch="";const rows=activeWorkRows(requestView);if(rows.length&&!new Set(rows.map(workRowRezId)).has(String(selectedRez))){selectedRez=String(workRowRezId(rows[0]));const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;}renderAll();};});
    if(!requestView){searchMode.style.display="block";queueMode.style.display="none";return;}
    searchMode.style.display="none";queueMode.style.display="block";
    const labels={suite:"Suite Requests",room:"Room Upgrade Requests",group:"Group Seating"};document.getElementById("workQueueTitle").textContent=labels[requestView];
    let search=document.getElementById("workQueueSearch");
    if(!search){search=document.createElement("input");search.id="workQueueSearch";search.className="workQueueSearch";search.placeholder="Search name, reservation #, room or request…";document.querySelector(".workQueueHead")?.insertAdjacentElement("afterend",search);search.addEventListener("input",()=>{workSearch=search.value.trim();renderRequestWorkbench();});}
    search.value=workSearch;
    const allRows=activeWorkRows(requestView),rows=allRows.filter(r=>workMatches(r,requestView)),visible=rows.slice(0,5);
    if(requestView==="suite"){
      const all=suiteRequestRows();const blueOccupied=assignments.filter(a=>{const row=String(a.seat_id||"").match(/^([A-Z]+)/)?.[1];return row&&BLUE_ROWS.has(row);}).length;const open=Math.max(0,BLUE_CAPACITY-blueOccupied);const committed=all.filter(r=>latestRequestStatus(r.rez_id,"suite")==="confirmed").reduce((sum,r)=>sum+Math.max(0,rezGuestCount(r.rez_id)-blueSeatsForRez(r.rez_id)),0);const sellable=Math.max(0,open-committed);
      metricsHost.innerHTML='<div class="workMiniMetric sellable"><b>'+sellable+'</b><span>Blue seats available to sell</span></div><div class="workMiniMetric"><b>'+committed+'</b><span>Blue seats committed to confirmed suites</span></div><div class="workMiniMetric"><b>'+open+'</b><span>Physically open blue seats</span></div><div class="workMiniMetric"><b>'+allRows.length+'</b><span>Suite requests still open</span></div>';
      infoHost.textContent="Changing the dropdown updates the request status but keeps it in this queue. Click Resolve only when you are completely finished with the reservation.";
    }else if(requestView==="room"){
      metricsHost.innerHTML='<div class="workMiniMetric"><b>'+allRows.length+'</b><span>Open room upgrades</span></div><div class="workMiniMetric"><b>'+roomRequestRows().length+'</b><span>Total room-upgrade requests</span></div>';infoHost.textContent="Status changes stay in the queue until you click Resolve. Five reservations are shown at a time.";
    }else{
      const people=allRows.reduce((s,r)=>s+Number(r.guestCount||0),0);metricsHost.innerHTML='<div class="workMiniMetric"><b>'+allRows.length+'</b><span>Open seating groups</span></div><div class="workMiniMetric"><b>'+people+'</b><span>Guests in open groups</span></div>';infoHost.textContent="Search or work the next five groups. Click Resolve only when the seating request is fully handled.";
    }
    cardsHost.innerHTML=visible.length?visible.map((r,index)=>{const rezId=workRowRezId(r),isGroup=requestView==="group",status=latestRequestStatus(rezId,requestView),names=isGroup?r.names:rezGuests(rezId).map(g=>g.guest_name).join(" / "),party=isGroup?r.guestCount:rezGuestCount(rezId),record=rezRecord(rezId),copy=isGroup?(r.memberIds.length+" linked reservations"):(requestText(record)||(requestView==="suite"?"Suite request":"Room upgrade request")),need=requestView==="suite"?Math.max(0,party-blueSeatsForRez(rezId)):0,active=String(selectedRez)===String(rezId)?" active":"",statusClass=String(status||"pending").replace(/[^a-z_]/g,"");return '<div class="workCard'+active+'" data-work-rez="'+esc(rezId)+'"><div class="workCardTop"><div class="workCardRez">'+(index===0&&!workSearch?'WORK NOW · ':'')+'#'+esc(rezId)+'</div><span class="workCardStatus '+esc(statusClass)+'">'+esc(String(status||"pending").replace(/_/g," "))+'</span></div><div class="workCardNames">'+esc(names||"No guest name")+'</div><div class="workCardMeta">'+party+' guest'+(party===1?'':'s')+(isGroup?' · '+r.memberIds.map(id=>'#'+id).join(', '):' · reserved '+esc(formatRequestDate(r)))+'</div><div class="workCardRequest">'+esc(copy)+'</div>'+(requestView==="suite"?'<div class="workCardBlue">Needs '+need+' blue seat'+(need===1?'':'s')+'</div>':'')+'<div class="workCardActions"><select class="workStatusSelect" data-type="'+esc(requestView)+'" data-rez="'+esc(rezId)+'">'+workStatusOptions(requestView,status)+'</select><button class="workOpen" data-open-rez="'+esc(rezId)+'">Open</button><button class="workResolve" data-type="'+esc(requestView)+'" data-rez="'+esc(rezId)+'">Resolve</button></div></div>';}).join(""):'<div class="empty">'+(workSearch?'No matching open requests.':'Nothing pending in this queue.')+'</div>';
    footerHost.textContent=rows.length>5?'Showing 5 of '+rows.length+' matching open requests. Resolve one and the next automatically appears.':rows.length+' matching open request'+(rows.length===1?'':'s')+'.';
    document.getElementById("queueBack").onclick=()=>{requestView="";workSearch="";renderAll();};
    cardsHost.querySelectorAll(".workCard").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("select,button"))return;selectedRez=card.dataset.workRez;const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;renderAll();}));
    cardsHost.querySelectorAll(".workOpen").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();selectedRez=b.dataset.openRez;const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;renderAll();}));
    cardsHost.querySelectorAll(".workStatusSelect").forEach(s=>{s.addEventListener("click",e=>e.stopPropagation());s.addEventListener("change",async e=>{e.stopPropagation();await saveRequestStatus(s.dataset.rez,s.dataset.type,s.value);});});
    cardsHost.querySelectorAll(".workResolve").forEach(b=>b.addEventListener("click",async e=>{e.stopPropagation();await resolveWorkRequest(b.dataset.rez,b.dataset.type);}));
  };

  function enhanceReservationInfo(){
    const record=rezRecord(window.selectedRez||selectedRez);if(!record)return;
    const host=document.getElementById("resDetail")||document.getElementById("detail");if(!host)return;
    let panel=host.querySelector(".rezExtraFields");if(!panel){panel=document.createElement("div");panel.className="rezExtraFields";host.insertAdjacentElement("afterbegin",panel);}
    panel.innerHTML='<div><span>Room Type</span><b>'+esc(currentRoom(record))+'</b></div><div><span>Seat Upgrade Fee</span><b>'+esc(seatUpgradePaid(record))+'</b></div><div><span>Date of Rez</span><b>'+esc(rezDate(record))+'</b></div>';
    render2025History(host,record);
  }

  function normalize(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function render2025History(host,record){
    let panel=host.querySelector(".history2025");if(!panel){panel=document.createElement("div");panel.className="history2025";host.appendChild(panel);}
    const names=rezGuests(record.rez_id).map(g=>normalize(g.guest_name)).filter(Boolean);
    const matches=seating2025.filter(x=>names.some(n=>n&&normalize(x.name).includes(n)||n.includes(normalize(x.name))));
    panel.innerHTML='<div class="history2025Title">2025 Seating History</div>'+(matches.length?matches.map(x=>'<div class="history2025Row"><b>'+esc(x.name||"Guest")+'</b><span>'+esc(x.comment||"No seating comment")+'</span></div>').join(""):'<div class="history2025Empty">No matching 2025 seating comment found.</div>');
  }

  async function load2025(){
    try{const rows=await apiAll("audit_log?select=*&action=eq.seating_history_2025&order=created_at.asc");seating2025=rows.map(r=>r.new_value||{});}catch(e){console.error("2025 history load failed",e);}
  }

  function parseCSV(text){
    const rows=[];let row=[],cell="",q=false;
    for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(cell);cell="";}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);rows.push(row);row=[];cell="";}else cell+=c;}
    if(cell||row.length){row.push(cell);rows.push(row);}return rows;
  }
  function pick(obj,patterns){for(const k of Object.keys(obj)){if(patterns.some(rx=>rx.test(k)))return String(obj[k]||"").trim();}return "";}
  async function import2025(file){
    const matrix=parseCSV(await file.text());if(matrix.length<2)throw new Error("The 2025 CSV has no data rows.");
    const headers=matrix[0].map(h=>String(h||"").trim());const items=[];
    matrix.slice(1).forEach(cols=>{const o={};headers.forEach((h,i)=>o[h]=cols[i]||"");const name=pick(o,[/guest.*name/i,/customer.*name/i,/name/i]),comment=pick(o,[/comment/i,/request/i,/note/i,/addon/i,/add.on/i]),rez=pick(o,[/reservation.*number/i,/reservation.*id/i,/rez.*id/i]);if(name&&comment)items.push({name,comment,rez_id:rez,source_file:file.name});});
    if(!items.length)throw new Error("I could not find guest names plus comments in that CSV.");
    const payload=items.map(item=>({user_id:session.user.id,action:"seating_history_2025",entity_type:"reservation_history",entity_id:item.rez_id||item.name,new_value:item}));
    await api("audit_log",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(payload)});await load2025();renderAll();return items.length;
  }

  function add2025Import(){
    const actions=document.querySelector(".actions");if(!actions||document.getElementById("import2025Btn"))return;
    const btn=document.createElement("button");btn.id="import2025Btn";btn.textContent="Import 2025 Seating";const input=document.createElement("input");input.type="file";input.accept=".csv,text/csv";input.style.display="none";btn.onclick=()=>input.click();input.onchange=async()=>{if(!input.files?.[0])return;try{setStatus("Importing 2025 seating comments…","busy");const count=await import2025(input.files[0]);setStatus(count+" 2025 seating comments imported. They are lookup-only and do not change 2026 reservations.","ok");}catch(e){setStatus("2025 import failed: "+e.message,"warn");}input.value="";};actions.appendChild(btn);actions.appendChild(input);
  }

  function seatClickOpen(){
    document.addEventListener("click",e=>{const seat=e.target.closest("[data-seat-id],.seat");if(!seat)return;const seatId=seat.dataset.seatId||seat.getAttribute("data-seat")||seat.id; if(!seatId)return;const a=(window.assignments||[]).find(x=>String(x.seat_id)===String(seatId));if(!a)return;const guest=(window.guests||[]).find(g=>String(g.id)===String(a.guest_id));const rezId=guest?.rez_id||a.rez_id;if(!rezId)return;selectedRez=String(rezId);selectedGuest=guest?.id||a.guest_id||null;renderAll();},true);
  }

  function addUndoButton(){
    const actions=document.querySelector(".actions");if(!actions||document.getElementById("undoTopBtn"))return;
    const btn=document.createElement("button");btn.id="undoTopBtn";btn.textContent="Undo";btn.title="Undo the most recent reversible seating action";btn.onclick=()=>{if(typeof window.undoLastAction==="function")window.undoLastAction();else setStatus("Undo is ready for seating moves once the action history is available on this screen.","warn");};actions.insertBefore(btn,actions.firstChild);
  }

  const priorRenderAll=window.renderAll;
  window.renderAll=function(){priorRenderAll();addUndoButton();add2025Import();enhanceReservationInfo();};
  const priorLoadAll=window.loadAll;
  window.loadAll=async function(opts){await priorLoadAll(opts);await load2025();renderAll();};

  const style=document.createElement("style");style.textContent=`
    .workQueueSearch{width:100%;box-sizing:border-box;margin:0 0 8px;padding:7px 8px;border:1px solid var(--line);border-radius:7px;font-size:10px;background:#fff}
    .workResolve{background:#173d70!important;color:#fff!important;border-color:#173d70!important}.workCardActions{flex-wrap:wrap}.workCardActions .workResolve{flex:0 0 auto}
    .rezExtraFields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:7px 0}.rezExtraFields>div{border:1px solid var(--line);background:#f8fafc;border-radius:7px;padding:7px}.rezExtraFields span{display:block;font-size:8px;color:var(--muted);text-transform:uppercase;font-weight:800;letter-spacing:.04em}.rezExtraFields b{display:block;margin-top:2px;font-size:10px;color:var(--navy);line-height:1.25}
    .history2025{margin-top:8px;border:1px solid #d9cda8;background:#fffdf5;border-radius:8px;padding:8px}.history2025Title{font-size:10px;font-weight:900;color:#6c5720;margin-bottom:5px}.history2025Row{padding:5px 0;border-top:1px solid #eee5c8}.history2025Row:first-of-type{border-top:0}.history2025Row b,.history2025Row span{display:block;font-size:9px;line-height:1.3}.history2025Row span{color:#5d5d58;margin-top:2px}.history2025Empty{font-size:9px;color:#827a64}
  `;document.head.appendChild(style);
  seatClickOpen();load2025().then(()=>{addUndoButton();add2025Import();enhanceReservationInfo();renderRequestWorkbench();}).catch(console.error);
})();