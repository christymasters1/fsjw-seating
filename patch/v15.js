"use strict";
(function(){
  function liveReservations(){try{return typeof reservations!=="undefined"?reservations:[];}catch(_){return [];}}
  function liveAssignments(){try{return typeof assignments!=="undefined"?assignments:[];}catch(_){return [];}}
  function liveGuests(){try{return typeof guests!=="undefined"?guests:[];}catch(_){return [];}}
  function rezGuestsSafe(rezId){try{return typeof rezGuests==="function"?rezGuests(rezId):liveGuests().filter(g=>String(g.rez_id)===String(rezId));}catch(_){return liveGuests().filter(g=>String(g.rez_id)===String(rezId));}}
  function rezExists(id){return liveReservations().some(r=>String(r.rez_id)===String(id));}
  function assignmentForSeat(seatId){return liveAssignments().find(a=>String(a.seat_id||"").trim().toUpperCase()===String(seatId||"").trim().toUpperCase());}

  function seatNumberFromTarget(target){
    let n=target;
    for(let i=0;i<4&&n;i++,n=n.parentElement){
      const t=String(n.textContent||"").trim();
      if(/^\d{1,2}$/.test(t)){const num=Number(t);if(num>=1&&num<=40)return String(num);}
    }
    return null;
  }

  function rowFromVisualPosition(target){
    const rect=target.getBoundingClientRect();
    const cy=rect.top+rect.height/2;
    const candidates=[...document.querySelectorAll("div,span,b,strong")].filter(el=>{
      const t=String(el.textContent||"").trim().toUpperCase();
      if(!/^[A-Z]{1,2}$/.test(t))return false;
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height)return false;
      if(Math.abs((r.top+r.height/2)-cy)>12)return false;
      return r.left>rect.left-250&&r.left<rect.right+250;
    });
    if(!candidates.length)return null;
    candidates.sort((a,b)=>Math.abs((a.getBoundingClientRect().top+a.getBoundingClientRect().height/2)-cy)-Math.abs((b.getBoundingClientRect().top+b.getBoundingClientRect().height/2)-cy));
    return String(candidates[0].textContent||"").trim().toUpperCase();
  }

  function seatIdFromClick(target){
    let n=target;
    for(let i=0;i<5&&n;i++,n=n.parentElement){
      const d=n.dataset||{};
      const vals=[d.seatId,d.seat,d.seatid,n.getAttribute?.("data-seat-id"),n.getAttribute?.("data-seat")].filter(Boolean);
      for(const v of vals){const s=String(v).trim().toUpperCase();if(/^[A-Z]{1,2}\d{1,2}$/.test(s))return s;}
      const m=String(n.id||"").toUpperCase().match(/([A-Z]{1,2}\d{1,2})$/);if(m)return m[1];
    }
    const num=seatNumberFromTarget(target);if(!num)return null;
    const row=rowFromVisualPosition(target);if(!row)return null;
    return row+num;
  }

  function reservationForAssignment(a){
    if(!a)return null;
    if(a.rez_id&&rezExists(a.rez_id))return {rezId:String(a.rez_id),guestId:a.guest_id||null};
    if(a.guest_id){
      const g=liveGuests().find(x=>String(x.id)===String(a.guest_id));
      if(g?.rez_id&&rezExists(g.rez_id))return {rezId:String(g.rez_id),guestId:a.guest_id};
      for(const r of liveReservations()){
        if(rezGuestsSafe(r.rez_id).some(g=>String(g.id)===String(a.guest_id)))return {rezId:String(r.rez_id),guestId:a.guest_id};
      }
    }
    return null;
  }

  function openReservation(rezId,guestId){
    try{requestView="";}catch(_){} window.requestView="";
    try{selectedRez=String(rezId);}catch(_){} window.selectedRez=String(rezId);
    const gs=rezGuestsSafe(rezId),guest=(guestId?gs.find(g=>String(g.id)===String(guestId)):null)||gs[0]||null;
    try{selectedGuest=guest?.id||null;}catch(_){} window.selectedGuest=guest?.id||null;
    try{if(typeof renderAll==="function")renderAll();}catch(e){console.error(e);}
  }

  document.addEventListener("click",function(e){
    let inWork=false;try{inWork=!!requestView;}catch(_){} if(inWork)return;
    if(e.target.closest("input,textarea,select,a"))return;
    const seatId=seatIdFromClick(e.target);if(!seatId)return;
    const assignment=assignmentForSeat(seatId);if(!assignment)return;
    const found=reservationForAssignment(assignment);if(!found)return;
    e.preventDefault();e.stopImmediatePropagation();
    openReservation(found.rezId,found.guestId);
  },true);
})();
