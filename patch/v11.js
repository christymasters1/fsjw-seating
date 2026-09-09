"use strict";
(function(){
  function rezRecord(rezId){return (window.reservations||[]).find(r=>String(r.rez_id)===String(rezId));}
  function value(record,keys){for(const k of keys){const v=record?.[k];if(v!==undefined&&v!==null&&String(v).trim()) return String(v).trim();}return "";}
  function fmtDate(raw){if(!raw)return "Not available";const d=new Date(raw);return Number.isNaN(d.getTime())?String(raw):d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
  function roomType(record){return value(record,["room_type","room_type_name","primary_category_name","category_name","primary_category","room_category_name","category_code","primary_category_code"])||"Not available";}
  function seatUpgradePaid(record){
    const raw=value(record,["seat_upgrade_paid","upgrade_fee_paid","seat_upgrade_fee_paid","upgrade_paid","seat_upgrade_payment_status"]);
    if(raw) return /^(1|true|yes|paid|complete|completed)$/i.test(raw)?"Paid":/^(0|false|no|unpaid|not paid|pending)$/i.test(raw)?"Not paid":raw;
    const text=((typeof requestText==="function"?requestText(record):"")+" "+JSON.stringify(record||{})).toLowerCase();
    if(/seat upgrade[^\n]{0,60}(paid|payment complete)/i.test(text)) return "Paid";
    if(/seat upgrade[^\n]{0,60}(unpaid|not paid|payment due)/i.test(text)) return "Not paid";
    return "Not available";
  }
  function reservationDate(record){return fmtDate(value(record,["reservation_date","date_reserved","reserved_at","created_at","rez_date","booking_date"]));}
  function checkInRaw(record){return value(record,["check_in","checkin","arrival_date","arrival","start_date","stay_start","check_in_date"]);}
  function checkOutRaw(record){return value(record,["check_out","checkout","departure_date","departure","end_date","stay_end","check_out_date"]);}
  function checkIn(record){return fmtDate(checkInRaw(record));}
  function checkOut(record){return fmtDate(checkOutRaw(record));}
  function lengthOfStay(record){
    const raw=value(record,["length_of_stay","nights","number_of_nights","stay_length"]);
    if(raw) return /night/i.test(raw)?raw:raw+" night"+(String(raw)==="1"?"":"s");
    const a=new Date(checkInRaw(record)),b=new Date(checkOutRaw(record));
    if(!Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())){const n=Math.round((b-a)/86400000);if(n>=0)return n+" night"+(n===1?"":"s");}
    return "Not available";
  }
  function field(label,val){return '<div class="rezPrimaryField"><span>'+esc(label)+'</span><b>'+esc(val)+'</b></div>';}
  function findLeftSearch(){
    const wrap=document.getElementById("reservationSearchMode");
    if(!wrap)return null;
    const input=wrap.querySelector('input[type="search"],input[placeholder*="search" i],input[type="text"]');
    if(!input)return wrap;
    let n=input;
    for(let i=0;i<3&&n.parentElement&&wrap.contains(n.parentElement);i++){
      if(n.parentElement.children.length<=6)n=n.parentElement;else break;
    }
    return n;
  }
  function renderPrimaryDetails(){
    if(window.requestView)return;
    const record=rezRecord(window.selectedRez||selectedRez);if(!record)return;
    const searchWrap=document.getElementById("reservationSearchMode");if(!searchWrap)return;
    let panel=document.getElementById("reservationDetailsPrimary");
    if(!panel){panel=document.createElement("section");panel.id="reservationDetailsPrimary";panel.className="reservationDetailsPrimary";}
    panel.innerHTML='<div class="rezPrimaryHeading">Reservation Details</div><div class="rezPrimaryGrid">'
      +field("Room Type",roomType(record))
      +field("Seat Upgrade Fee",seatUpgradePaid(record))
      +field("Date of Reservation",reservationDate(record))
      +field("Check-In",checkIn(record))
      +field("Check-Out",checkOut(record))
      +field("Length of Stay",lengthOfStay(record))
      +'</div>';
    const search=findLeftSearch();
    if(search&&search!==searchWrap) search.insertAdjacentElement("afterend",panel); else searchWrap.insertAdjacentElement("afterbegin",panel);
    searchWrap.querySelectorAll(".rezExtraFields").forEach(el=>el.remove());
  }
  const priorRenderAll=window.renderAll;
  if(typeof priorRenderAll==="function") window.renderAll=function(){priorRenderAll();renderPrimaryDetails();};
  const style=document.createElement("style");
  style.textContent=`
    #reservationDetailsPrimary{margin:8px 0 10px;padding:9px;border:1px solid var(--line,#dfe4ea);border-radius:8px;background:#fff}
    .rezPrimaryHeading{font-size:10px;font-weight:900;color:var(--navy,#2B4692);text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px}
    .rezPrimaryGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .rezPrimaryField{min-width:0;padding:6px;background:#f8fafc;border:1px solid #e3e8ef;border-radius:6px}
    .rezPrimaryField span{display:block;font-size:8px;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:.03em;font-weight:800;margin-bottom:2px}
    .rezPrimaryField b{display:block;font-size:10px;color:var(--navy,#2B4692);line-height:1.25;word-break:break-word}
  `;
  document.head.appendChild(style);
  renderPrimaryDetails();
})();