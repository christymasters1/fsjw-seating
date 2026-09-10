"use strict";
(function(){
  function liveReservations(){try{return typeof reservations!=="undefined"?reservations:[];}catch(_){return [];}}
  function liveAssignments(){try{return typeof assignments!=="undefined"?assignments:[];}catch(_){return [];}}
  function liveGuests(){try{return typeof guests!=="undefined"?guests:[];}catch(_){return [];}}
  function rezGuestsSafe(rezId){try{return typeof rezGuests==="function"?rezGuests(rezId):liveGuests().filter(g=>String(g.rez_id||g.reservation_id||"")===String(rezId));}catch(_){return liveGuests().filter(g=>String(g.rez_id||g.reservation_id||"")===String(rezId));}}
  function rezExists(id){return liveReservations().some(r=>String(r.rez_id)===String(id));}
  function canonicalSeat(v){const s=String(v||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");const m=s.match(/^([A-Z]{1,3})0*(\d{1,3})$/);return m?m[1]+String(Number(m[2])):"";}

  function seatButton(target){
    let n=target;
    for(let i=0;i<5&&n;i++,n=n.parentElement){
      const t=String(n.textContent||"").trim();
      const r=n.getBoundingClientRect?.();
      if(/^\d{1,2}$/.test(t)&&r&&r.width>10&&r.width<80&&r.height>10&&r.height<80)return n;
    }
    return null;
  }

  function allowedRow(t){return /^(A|B|C|D|E|F|G|H|J|K|L|M|N|P|Q|R|S|T|V|W|X|Y|Z|AA|BB|CC)$/.test(t);}

  function rowLetterForSeat(btn){
    let n=btn?.parentElement;
    for(let depth=0;depth<7&&n;depth++,n=n.parentElement){
      const direct=[...n.children];
      const nums=direct.filter(el=>/^\d{1,2}$/.test(String(el.textContent||"").trim()));
      const letters=direct.filter(el=>allowedRow(String(el.textContent||"").trim().toUpperCase()));
      if(nums.length>=8&&letters.length===1)return String(letters[0].textContent||"").trim().toUpperCase();
    }
    const br=btn.getBoundingClientRect();const cy=br.top+br.height/2;
    const letters=[...document.querySelectorAll("div,span,b,strong")].filter(el=>{
      const t=String(el.textContent||"").trim().toUpperCase();if(!allowedRow(t))return false;
      const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;
      return Math.abs((r.top+r.height/2)-cy)<10;
    }).sort((a,b)=>Math.abs(a.getBoundingClientRect().left-br.left)-Math.abs(b.getBoundingClientRect().left-br.left));
    return letters.length?String(letters[0].textContent||"").trim().toUpperCase():null;
  }

  function seatIdFromClick(target){
    const btn=seatButton(target);if(!btn)return null;
    const num=String(btn.textContent||"").trim();
    const d=btn.dataset||{};
    const attrs=[d.seatId,d.seat,d.seatid,btn.getAttribute("data-seat-id"),btn.getAttribute("data-seat"),btn.id].filter(Boolean);
    for(const a of attrs){const c=canonicalSeat(a);if(c)return c;}
    const row=rowLetterForSeat(btn);return row?row+String(Number(num)):null;
  }

  function objectHasSeat(obj,seatId){
    const key=canonicalSeat(seatId);if(!key||!obj)return false;
    const entries=Object.entries(obj);
    for(const [k,v] of entries){
      const c=canonicalSeat(v);if(!c)continue;
      if(c===key&&(/seat/i.test(k)||String(v).match(/[A-Za-z]/)))return true;
    }
    return false;
  }

  function assignmentForSeat(seatId){return liveAssignments().find(a=>objectHasSeat(a,seatId))||null;}
  function guestForSeat(seatId){return liveGuests().find(g=>objectHasSeat(g,seatId))||null;}

  function rezFromObject(obj){
    if(!obj)return null;
    for(const [k,v] of Object.entries(obj)){
      if(!/(rez|reservation)/i.test(k))continue;
      if(rezExists(v))return String(v);
    }
    return null;
  }

  function guestIdFromObject(obj){
    if(!obj)return null;
    for(const [k,v] of Object.entries(obj)){
      if(/guest.*id|person.*id/i.test(k)&&v!==null&&v!==undefined&&String(v)!=="")return v;
    }
    return null;
  }

  function resolveReservation(seatId){
    const a=assignmentForSeat(seatId);
    const directRez=rezFromObject(a);if(directRez)return {rezId:directRez,guestId:guestIdFromObject(a)};

    const agid=guestIdFromObject(a);
    if(agid){
      const g=liveGuests().find(x=>String(x.id)===String(agid));
      const gr=rezFromObject(g);if(gr)return {rezId:gr,guestId:g?.id||agid};
      for(const r of liveReservations()) if(rezGuestsSafe(r.rez_id).some(x=>String(x.id)===String(agid))) return {rezId:String(r.rez_id),guestId:agid};
    }

    const g=guestForSeat(seatId);
    if(g){
      const gr=rezFromObject(g);if(gr)return {rezId:gr,guestId:g.id||null};
      for(const r of liveReservations()) if(rezGuestsSafe(r.rez_id).some(x=>String(x.id)===String(g.id))) return {rezId:String(r.rez_id),guestId:g.id||null};
    }

    if(a){
      const name=String(a.guest_name||a.name||a.guest||"").trim().toLowerCase();
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
