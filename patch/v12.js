"use strict";
(function(){
  function norm(s){return String(s||"").replace(/\s+/g," ").trim();}
  function rezRecord(rezId){return (window.reservations||[]).find(r=>String(r.rez_id)===String(rezId));}
  function value(record,keys){for(const k of keys){const v=record?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim();}return "";}
  function fmtDate(raw){if(!raw)return "Not available";const d=new Date(raw);return Number.isNaN(d.getTime())?String(raw):d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
  function roomType(record){return value(record,["room_type","room_type_name","primary_category_name","category_name","primary_category","room_category_name","category_code","primary_category_code"])||"Not available";}
  function seatUpgradePaid(record){
    const raw=value(record,["seat_upgrade_paid","upgrade_fee_paid","seat_upgrade_fee_paid","upgrade_paid","seat_upgrade_payment_status"]);
    if(raw) return /^(1|true|yes|paid|complete|completed)$/i.test(raw)?"Paid":/^(0|false|no|unpaid|not paid|pending)$/i.test(raw)?"Not paid":raw;
    const text=((typeof requestText==="function"?requestText(record):"")+" "+JSON.stringify(record||{}));
    if(/seat upgrade[^\n]{0,80}(paid|payment complete)/i.test(text)) return "Paid";
    if(/seat upgrade[^\n]{0,80}(unpaid|not paid|payment due)/i.test(text)) return "Not paid";
    return "Not available";
  }
  function reservationDate(record){return fmtDate(value(record,["reservation_date","date_reserved","reserved_at","created_at","createdOn","rez_date","booking_date"]));}
  function checkInRaw(record){return value(record,["check_in","checkin","checkIn","arrival_date","arrival","start_date","stay_start","check_in_date","arrivalDate"]);}
  function checkOutRaw(record){return value(record,["check_out","checkout","checkOut","departure_date","departure","end_date","stay_end","check_out_date","departureDate"]);}
  function lengthOfStay(record){
    const raw=value(record,["length_of_stay","nights","number_of_nights","stay_length"]);
    if(raw) return /night/i.test(raw)?raw:raw+" night"+(String(raw)==="1"?"":"s");
    const a=new Date(checkInRaw(record)),b=new Date(checkOutRaw(record));
    if(!Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())){const n=Math.round((b-a)/86400000);if(n>=0)return n+" night"+(n===1?"":"s");}
    return "Not available";
  }
  function field(label,val){return '<div class="rightRezField"><span>'+esc(label)+'</span><b>'+esc(val)+'</b></div>';}

  function rightDetailHost(){
    const direct=document.getElementById("resDetail")||document.getElementById("detail");
    if(direct) return direct;
    const candidates=[...document.querySelectorAll("aside,section,div")];
    return candidates.find(el=>{
      const t=norm(el.firstElementChild?.textContent||el.textContent).toUpperCase();
      return t.startsWith("RESERVATION DETAILS") && el.textContent.length<12000;
    })||null;
  }

  function renderRightFields(){
    document.getElementById("reservationDetailsPrimary")?.remove();
    if(window.requestView) return;
    const record=rezRecord(window.selectedRez||selectedRez);
    const host=rightDetailHost();
    if(!host) return;
    let panel=host.querySelector("#rightReservationCoreFields");
    if(!record){if(panel)panel.remove();return;}
    if(!panel){panel=document.createElement("div");panel.id="rightReservationCoreFields";}
    panel.innerHTML='<div class="rightRezGrid">'
      +field("Room Type",roomType(record))
      +field("Seat Upgrade Fee",seatUpgradePaid(record))
      +field("Date of Reservation",reservationDate(record))
      +field("Check-In",fmtDate(checkInRaw(record)))
      +field("Check-Out",fmtDate(checkOutRaw(record)))
      +field("Length of Stay",lengthOfStay(record))
      +'</div>';
    const heading=[...host.querySelectorAll("h1,h2,h3,h4,h5,h6,.kicker,strong,b,div")].find(el=>/^reservation details$/i.test(norm(el.textContent)));
    if(heading){
      let anchor=heading;
      while(anchor.parentElement===host&&anchor.nextElementSibling&&anchor.nextElementSibling.textContent.trim()==="") anchor=anchor.nextElementSibling;
      anchor.insertAdjacentElement("afterend",panel);
    }else host.insertAdjacentElement("afterbegin",panel);
  }

  function forceReservationOpen(rezId){
    const record=rezRecord(rezId);if(!record)return;
    window.selectedRez=selectedRez=String(rezId);
    const gs=typeof rezGuests==="function"?rezGuests(rezId):[];
    window.selectedGuest=selectedGuest=gs.find(g=>!g.seat_id)?.id||gs[0]?.id||null;
    if(typeof renderAll==="function") renderAll();
    setTimeout(renderRightFields,0);
  }

  function findReservationIdFromClick(target){
    const sidebar=document.querySelector(".sidebar");if(!sidebar||!sidebar.contains(target))return null;
    let n=target;
    for(let i=0;i<6&&n&&sidebar.contains(n);i++,n=n.parentElement){
      const text=norm(n.textContent);
      const m=text.match(/#(\d{5,})/);
      if(m&&rezRecord(m[1]))return m[1];
    }
    return null;
  }

  document.addEventListener("click",function(e){
    if(e.target.closest("button,select,input,textarea,a"))return;
    const rezId=findReservationIdFromClick(e.target);
    if(rezId){e.preventDefault();forceReservationOpen(rezId);}
  },true);

  const priorRenderAll=window.renderAll;
  if(typeof priorRenderAll==="function"){
    window.renderAll=function(){priorRenderAll();setTimeout(renderRightFields,0);};
  }

  const style=document.createElement("style");
  style.textContent=`
    #reservationDetailsPrimary{display:none!important}
    #rightReservationCoreFields{margin:7px 0 11px;padding-bottom:10px;border-bottom:1px solid var(--line,#dfe4ea)}
    .rightRezGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .rightRezField{padding:7px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;min-width:0}
    .rightRezField span{display:block;font-size:8px;line-height:1.2;text-transform:uppercase;letter-spacing:.04em;font-weight:800;color:var(--muted,#6b7280);margin-bottom:2px}
    .rightRezField b{display:block;font-size:10px;line-height:1.3;color:var(--navy,#2B4692);word-break:break-word}
    .sidebar [class*="reservation"],.sidebar [class*="rez"]{cursor:pointer}
  `;
  document.head.appendChild(style);
  setTimeout(renderRightFields,0);
})();
