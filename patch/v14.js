"use strict";
(function(){
  function liveReservations(){try{return typeof reservations!=="undefined"?reservations:[];}catch(_){return [];}}
  function liveGuests(){try{return typeof guests!=="undefined"?guests:[];}catch(_){return [];}}
  function rezGuestsSafe(rezId){try{return typeof rezGuests==="function"?rezGuests(rezId):liveGuests().filter(g=>String(g.rez_id)===String(rezId));}catch(_){return liveGuests().filter(g=>String(g.rez_id)===String(rezId));}}
  function rezExists(id){return liveReservations().some(r=>String(r.rez_id)===String(id));}

  function openHomeReservation(rezId){
    if(!rezExists(rezId)) return;
    try{requestView="";}catch(_){} window.requestView="";
    try{selectedRez=String(rezId);}catch(_){} window.selectedRez=String(rezId);
    const gs=rezGuestsSafe(rezId);
    const guest=gs[0]||null;
    try{selectedGuest=guest?.id||null;}catch(_){} window.selectedGuest=guest?.id||null;
    try{if(typeof renderAll==="function")renderAll();}catch(e){console.error("Could not render selected home reservation",e);}
  }

  function cardRezId(target){
    const home=document.getElementById("reservationSearchMode")||document.querySelector(".sidebar");
    if(!home||!home.contains(target)) return null;
    let n=target;
    for(let i=0;i<7&&n&&home.contains(n);i++,n=n.parentElement){
      const attrs=[n.dataset?.rez,n.dataset?.rezId,n.getAttribute?.("data-rez"),n.getAttribute?.("data-rez-id")].filter(Boolean);
      for(const a of attrs){if(rezExists(a))return String(a);}
      const m=String(n.textContent||"").match(/#(\d{5,})/);
      if(m&&rezExists(m[1])) return m[1];
    }
    return null;
  }

  document.addEventListener("click",function(e){
    if(e.target.closest("button,select,input,textarea,a")) return;
    let inWork=false;try{inWork=!!requestView;}catch(_){} if(inWork)return;
    const rezId=cardRezId(e.target);if(!rezId)return;
    e.preventDefault();e.stopPropagation();
    openHomeReservation(rezId);
  },true);

  const style=document.createElement("style");
  style.textContent=`#reservationSearchMode [data-rez],#reservationSearchMode [data-rez-id],#reservationSearchMode .reservation-card,#reservationSearchMode .rez-card{cursor:pointer}`;
  document.head.appendChild(style);
})();
