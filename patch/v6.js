"use strict";
(function(){
  const oldWorkbench=document.getElementById("requestWorkbench");
  if(oldWorkbench) oldWorkbench.remove();

  const actions=document.querySelector(".actions");
  const changesBtn=document.getElementById("changes");
  if(actions && changesBtn && !document.querySelector('[data-work-mode="suite"]')){
    const defs=[["suite","Work Suites","suiteWorkBadge"],["room","Work Room Upgrades","roomWorkBadge"],["group","Work Group Seating","groupWorkBadge"]];
    defs.forEach(([mode,label,badgeId])=>{
      const b=document.createElement("button");
      b.className="workModeBtn"; b.dataset.workMode=mode;
      b.innerHTML=label+' <span id="'+badgeId+'" class="workBadge">0</span>';
      actions.insertBefore(b,changesBtn);
    });
  }

  const sidebar=document.querySelector(".sidebar");
  if(sidebar && !document.getElementById("workQueueMode")){
    const original=Array.from(sidebar.childNodes);
    const normal=document.createElement("div"); normal.id="reservationSearchMode";
    original.forEach(node=>normal.appendChild(node));
    sidebar.appendChild(normal);
    const work=document.createElement("div"); work.id="workQueueMode";
    work.innerHTML='<div class="workQueueHead"><div class="kicker" id="workQueueTitle">Working Queue</div><button id="queueBack" class="queueBack">All Reservations</button></div><div id="workMiniMetrics" class="workMiniMetrics"></div><div id="workQueueInfo" class="workQueueInfo"></div><div id="workCards" class="workCards"></div><div id="workQueueFooter" class="workQueueFooter"></div>';
    sidebar.appendChild(work);
  }

  requestView="";

  window.workRowRezId=function(row){return String(row?.rez_id||row?.dateRecord?.rez_id||"");};
  window.activeWorkRows=function(mode){
    if(mode==="suite") return suiteRequestRows().filter(r=>{const status=latestRequestStatus(r.rez_id,"suite");const need=Math.max(0,rezGuestCount(r.rez_id)-blueSeatsForRez(r.rez_id));return status==="pending"||(status==="confirmed"&&need>0);});
    if(mode==="room") return roomRequestRows().filter(r=>latestRequestStatus(r.rez_id,"room")==="pending");
    if(mode==="group") return groupRequestRows().filter(r=>latestRequestStatus(r.rez_id,"group")!=="completed");
    return [];
  };
  window.workStatusOptions=function(mode,status){
    const options=mode==="suite"?[["pending","Pending"],["confirmed","Suite Confirmed"],["waitlist","Waitlist"],["not_available","Not Available"]]:mode==="room"?[["pending","Pending"],["approved","Approved"],["waitlist","Waitlist"],["not_available","Not Available"]]:[["pending","Pending"],["working","Working"],["completed","Completed"]];
    return options.map(([v,l])=>'<option value="'+v+'"'+(status===v?' selected':'')+'>'+l+'</option>').join("");
  };

  window.saveRequestStatus=async function(rezId,type,status){
    try{
      setStatus("Saving request status…","busy");
      await api("audit_log",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({user_id:session.user.id,action:"request_status",entity_type:"reservation",entity_id:String(rezId),new_value:{request_type:type,status,email:session.user.email}})});
      requestStatuses=await apiAll("audit_log?select=*&action=eq.request_status&order=created_at.asc");
      if(requestView){const rows=activeWorkRows(requestView);const still=rows.some(r=>String(workRowRezId(r))===String(selectedRez));if(!still&&rows.length){selectedRez=String(workRowRezId(rows[0]));const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;}}
      renderAll();
      setStatus("Request status saved. Next request loaded.","ok");
    }catch(error){setStatus("Could not save request status: "+error.message,"warn");}
  };

  window.renderRequestWorkbench=function(){
    const searchMode=document.getElementById("reservationSearchMode"),queueMode=document.getElementById("workQueueMode"),cardsHost=document.getElementById("workCards"),metricsHost=document.getElementById("workMiniMetrics"),infoHost=document.getElementById("workQueueInfo"),footerHost=document.getElementById("workQueueFooter");
    if(!searchMode||!queueMode||!cardsHost) return;
    const suiteActive=activeWorkRows("suite"),roomActive=activeWorkRows("room"),groupActive=activeWorkRows("group");
    document.getElementById("suiteWorkBadge").textContent=suiteActive.length;document.getElementById("roomWorkBadge").textContent=roomActive.length;document.getElementById("groupWorkBadge").textContent=groupActive.length;
    document.querySelectorAll("[data-work-mode]").forEach(button=>{button.classList.toggle("active",button.dataset.workMode===requestView);button.onclick=()=>{requestView=button.dataset.workMode;const rows=activeWorkRows(requestView);if(rows.length&&!new Set(rows.map(workRowRezId)).has(String(selectedRez))){selectedRez=String(workRowRezId(rows[0]));const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;}renderAll();};});
    if(!requestView){searchMode.style.display="block";queueMode.style.display="none";return;}
    searchMode.style.display="none";queueMode.style.display="block";
    const labels={suite:"Suite Requests",room:"Room Upgrade Requests",group:"Group Seating"};document.getElementById("workQueueTitle").textContent=labels[requestView];
    const rows=activeWorkRows(requestView),visible=rows.slice(0,3);
    if(requestView==="suite"){
      const all=suiteRequestRows();const blueOccupied=assignments.filter(a=>{const row=String(a.seat_id||"").match(/^([A-Z]+)/)?.[1];return row&&BLUE_ROWS.has(row);}).length;const open=Math.max(0,BLUE_CAPACITY-blueOccupied);const committed=all.filter(r=>latestRequestStatus(r.rez_id,"suite")==="confirmed").reduce((sum,r)=>sum+Math.max(0,rezGuestCount(r.rez_id)-blueSeatsForRez(r.rez_id)),0);const sellable=Math.max(0,open-committed);
      metricsHost.innerHTML='<div class="workMiniMetric sellable"><b>'+sellable+'</b><span>Blue seats available to sell</span></div><div class="workMiniMetric"><b>'+committed+'</b><span>Blue seats committed to confirmed suites</span></div><div class="workMiniMetric"><b>'+open+'</b><span>Physically open blue seats</span></div><div class="workMiniMetric"><b>'+rows.length+'</b><span>Suite requests still needing action</span></div>';
      infoHost.textContent="Work oldest requests first. Confirming a suite immediately reserves the blue seats that party still needs.";
    }else if(requestView==="room"){
      metricsHost.innerHTML='<div class="workMiniMetric"><b>'+rows.length+'</b><span>Pending room upgrades</span></div><div class="workMiniMetric"><b>'+roomRequestRows().length+'</b><span>Total room-upgrade requests</span></div>';infoHost.textContent="Only the next three pending room upgrades are shown. Resolve one and the next request automatically feeds into the queue.";
    }else{
      const people=rows.reduce((s,r)=>s+Number(r.guestCount||0),0);metricsHost.innerHTML='<div class="workMiniMetric"><b>'+rows.length+'</b><span>Open seating groups</span></div><div class="workMiniMetric"><b>'+people+'</b><span>Guests in open groups</span></div>';infoHost.textContent="Open a group and its linked reservations stay purple on the map. Complete it and the next group feeds into the queue.";
    }
    cardsHost.innerHTML=visible.length?visible.map((r,index)=>{const rezId=workRowRezId(r),isGroup=requestView==="group",status=latestRequestStatus(rezId,requestView),names=isGroup?r.names:rezGuests(rezId).map(g=>g.guest_name).join(" / "),party=isGroup?r.guestCount:rezGuestCount(rezId),copy=isGroup?(r.memberIds.length+" linked reservations"):(requestText(r)||(requestView==="suite"?"Suite request":"Room upgrade request")),need=requestView==="suite"?Math.max(0,party-blueSeatsForRez(rezId)):0,active=String(selectedRez)===String(rezId)?" active":"",statusClass=status.replace(/[^a-z_]/g,"");return '<div class="workCard'+active+'" data-work-rez="'+esc(rezId)+'"><div class="workCardTop"><div class="workCardRez">'+(index===0?'WORK NOW · ':'')+'#'+esc(rezId)+'</div><span class="workCardStatus '+esc(statusClass)+'">'+esc(status.replace(/_/g," "))+'</span></div><div class="workCardNames">'+esc(names||"No guest name")+'</div><div class="workCardMeta">'+party+' guest'+(party===1?'':'s')+(isGroup?' · '+r.memberIds.map(id=>'#'+id).join(', '):' · reserved '+esc(formatRequestDate(r)))+'</div><div class="workCardRequest">'+esc(copy)+'</div>'+(requestView==="suite"?'<div class="workCardBlue">Needs '+need+' blue seat'+(need===1?'':'s')+'</div>':'')+'<div class="workCardActions"><select class="workStatusSelect" data-type="'+esc(requestView)+'" data-rez="'+esc(rezId)+'">'+workStatusOptions(requestView,status)+'</select><button class="workOpen" data-open-rez="'+esc(rezId)+'">Open</button></div></div>';}).join(""):'<div class="empty">Nothing pending in this queue.</div>';
    footerHost.textContent=rows.length>3?'Showing 3 of '+rows.length+' active requests. Finish one and the next automatically appears.':rows.length+' active request'+(rows.length===1?'':'s')+' in this queue.';
    document.getElementById("queueBack").onclick=()=>{requestView="";renderAll();};
    cardsHost.querySelectorAll(".workCard").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("select,button"))return;selectedRez=card.dataset.workRez;const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;renderAll();}));
    cardsHost.querySelectorAll(".workOpen").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();selectedRez=b.dataset.openRez;const gs=rezGuests(selectedRez);selectedGuest=gs[0]?.id||null;renderAll();}));
    cardsHost.querySelectorAll(".workStatusSelect").forEach(s=>{s.addEventListener("click",e=>e.stopPropagation());s.addEventListener("change",async e=>{e.stopPropagation();await saveRequestStatus(s.dataset.rez,s.dataset.type,s.value);});});
  };

  if(session && reservations.length) renderAll();
})();
