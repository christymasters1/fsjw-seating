"use strict";
(function(){
  function liveReservations(){try{return typeof reservations!=="undefined"?reservations:[];}catch(_){return [];}}
  function liveAssignments(){try{return typeof assignments!=="undefined"?assignments:[];}catch(_){return [];}}
  function liveGuests(){try{return typeof guests!=="undefined"?guests:[];}catch(_){return [];}}
  function rezGuestsSafe(rezId){try{return typeof rezGuests==="function"?rezGuests(rezId):liveGuests().filter(g=>String(g.rez_id||g.reservation_id||"")===String(rezId));}catch(_){return liveGuests().filter(g=>String(g.rez_id||g.reservation_id||"")===String(rezId));}}
  function rezExists(id){return liveReservations().some(r=>String(r.rez_id)===String(id));}

  function seatButton(target){
    let n=target;
    for(let i=0;i<4&&n;i++,n=n.parentElement){
      const t=String(n.textContent||"").trim();
      const r=n.getBoundingClientRect?.();
      if(/^\d{1,2}$/.test(t)&&r&&r.width>10&&r.width<70&&r.height>10&&r.height<70)return n;
    }
    return null;
  }

  function rowLetterForSeat(btn){
    let n=btn?.parentElement;
    for(let depth=0;depth<6&&n;depth++,n=n.parentElement){
      const kids=[...n.querySelectorAll("button,div,span")];
      const nums=kids.filter(el=>/^\d{1,2}$/.test(String(el.textContent||"").trim()));
      if(nums.length<8)continue;
      const letters=kids.filter(el=>/^[A-Z]{1,2}$/.test(String(el.textContent||"").trim().toUpperCase()));
      const preferred=letters.find(el=>{
        const t=String(el.textContent||"").trim().toUpperCase();
        return /^(A|B|C|D|E|F|G|H|J|K|L|M|N|P|Q|R|S|T|V|W|X|Y|Z|AA|BB|CC)$/.test(t);
      });
      if(preferred)return String(preferred.textContent||"").trim().toUpperCase();
    }
    return null;
  }

  function seatIdFromClick(target){
    const btn=seatButton(target);if(!btn)return null;
    const num=String(btn.textContent||"").trim();
    const d=btn.dataset||{};
    const attrs=[d.seatId,d.seat,d.seatid,btn.getAttribute("data-seat-id"),btn.getAttribute("data-seat")].filter(Boolean);
    for(const a of attrs){const s=String(a).trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(/^[A-Z]{1,2}\d{1,2}$/.test(s))return s;}
    const id=String(btn.id||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    const m=id.match(/([A-Z]{1,2}\d{1,2})$/);if(m)return m[1];
    const row=rowLetterForSeat(btn);return row?row+num:null;
  }

  function normalizeSeat(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");}
  function assignmentForSeat(seatId){
    const key=normalizeSeat(seatId);
    return liveAssignments().find(a=>normalizeSeat(a.seat_id||a.seat||a.working_seat||a.rezmagic_seat)===key)||null;
  }
  function guestForSeat(seatId){
    const key=normalizeSeat(seatId);
    return liveGuests().find(g=>normalizeSeat(g.seat_id||g.seat||g.working_seat||g.rezmagic_seat)===key)||null;
  }

  function resolveReservation(seatId){
    const a=assignmentForSeat(seatId);
    const directRez=a&&(a.rez_id||a.reservation_id||a.reservation_number||a.rezId);
    if(directRez&&rezExists(directRez))return {rezId:String(directRez),guestId:a.guest_id||a.guestId||null};

    const assignmentGuestId=a&&(a.guest_id||a.guestId||a.person_id);
    if(assignmentGuestId){
      const g=liveGuests().find(x=>String(x.id)===String(assignmentGuestId));
      const gr=g&&(g.rez_id||g.reservation_id||g.reservation_number||g.rezId);
      if(gr&&rezExists(gr))return {rezId:String(gr),guestId:g.id};
      for(const r of liveReservations()){
        if(rezGuestsSafe(r.rez_id).some(x=>String(x.id)===String(assignmentGuestId)))return {rezId:String(r.rez_id),guestId:assignmentGuestId};
      }
    }

    const g=guestForSeat(seatId);
    if(g){
      const gr=g.rez_id||g.reservation_id||g.reservation_number||g.rezId;
      if(gr&&rezExists(gr))return {rezId:String(gr),guestId:g.id||null};
      for(const r of liveReservations()){
        if(rezGuestsSafe(r.rez_id).some(x=>String(x.id)===String(g.id)))return {rezId:String(r.rez_id),guestId:g.id||null};
      }
    }

    if(a){
      const name=String(a.guest_name||a.name||"").trim().toLowerCase();
      if(name){
        for(const r of liveReservations()){
          const hit=rezGuestsSafe(r.rez_id).find(x=>String(x.guest_name||x.name||"").trim().toLowerCase()===name);
          if(hit)return {rezId:String(r.rez_id),guestId:hit.id||null};
        }
      }
    }
    return null;
  }

  function openReservation(rezId,guestId){
    try{requestView="";}catch(_){} window.requestView="";
    try{selectedRez=String(rezId);}catch(_){} window.selectedRez=String(rezId);
    const gs=rezGuestsSafe(rezId),guest=(guestId?gs.find(g=>String(g.id)===String(guestId)):null)||gs[0]||null;
    try{selectedGuest=guest?.id||null;}catch(_){} window.selectedGuest=guest?.id||null;
    try{if(typeof renderAll==="function")renderAll();}catch(e){console.error("Seat click render failed",e);}
    try{if(typeof setStatus==="function")setStatus("Opened reservation #"+rezId+" from seat map.","ok");}catch(_){}
  }

  document.addEventListener("click",function(e){
    let inWork=false;try{inWork=!!requestView;}catch(_){} if(inWork)return;
    if(e.target.closest("input,textarea,select,a"))return;
    const seatId=seatIdFromClick(e.target);if(!seatId)return;
    const found=resolveReservation(seatId);if(!found)return;
    e.preventDefault();e.stopImmediatePropagation();
    openReservation(found.rezId,found.guestId);
  },true);
})();
