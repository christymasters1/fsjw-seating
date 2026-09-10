"use strict";
(function(){
  let detailByRez=new Map();
  let pendingDetailRows=[];

  function liveGuests(){try{return typeof guests!=="undefined"?guests:[];}catch(_){return [];}}
  function liveRezGuests(rezId){try{return typeof rezGuests==="function"?rezGuests(rezId):liveGuests().filter(g=>String(g.rez_id)===String(rezId));}catch(_){return liveGuests().filter(g=>String(g.rez_id)===String(rezId));}}
  function currentRezId(){try{return (typeof selectedRez!=="undefined"?selectedRez:null)||window.selectedRez||null;}catch(_){return window.selectedRez||null;}}
  function currentGuestId(){try{return (typeof selectedGuest!=="undefined"?selectedGuest:null)||window.selectedGuest||null;}catch(_){return window.selectedGuest||null;}}
  function text(v){return String(v??"").trim();}
  function fmtDate(raw){if(!raw)return "Not available";const d=new Date(raw);return Number.isNaN(d.getTime())?String(raw):d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
  function nights(a,b){const x=new Date(a),y=new Date(b);if(Number.isNaN(x.getTime())||Number.isNaN(y.getTime()))return "Not available";const n=Math.round((y-x)/86400000);return n>=0?n+" night"+(n===1?"":"s"):"Not available";}

  function selectedGuestName(rezId){
    const list=liveRezGuests(rezId),gid=currentGuestId();
    return (gid?list.find(g=>String(g.id)===String(gid)):null)?.guest_name||list[0]?.guest_name||"Reservation";
  }

  function renderImportedDetails(){
    const rezId=currentRezId(),panel=document.getElementById("rightReservationCoreFields");
    if(!rezId||!panel)return;
    const detail=detailByRez.get(String(rezId))||{};
    let name=panel.querySelector(".rightRezGuestName");
    if(!name){name=document.createElement("div");name.className="rightRezGuestName";panel.insertAdjacentElement("afterbegin",name);}
    name.innerHTML='<span>Viewing Guest</span><b>'+esc(selectedGuestName(rezId))+'</b>';

    const vals={
      "Room Type":detail.room_type,
      "Seat Upgrade Fee":detail.seat_upgrade_fee_status,
      "Date of Reservation":detail.reservation_date,
      "Check-In":detail.check_in,
      "Check-Out":detail.check_out,
      "Length of Stay":detail.length_of_stay
    };
    panel.querySelectorAll(".rightRezField").forEach(box=>{
      const label=text(box.querySelector("span")?.textContent),b=box.querySelector("b");
      if(!b||!vals[label])return;
      let v=vals[label];
      if(label!=="Seat Upgrade Fee"&&label!=="Length of Stay")v=fmtDate(v);
      b.textContent=v;
    });
  }

  async function loadDetailHistory(){
    try{
      const rows=await apiAll("audit_log?select=*&action=eq.reservation_detail_import&order=created_at.asc");
      const next=new Map();rows.forEach(r=>next.set(String(r.entity_id),r.new_value||{}));detailByRez=next;renderImportedDetails();
    }catch(e){console.error("Reservation detail history load failed",e);}
  }

  function deriveSeatUpgradeStatus(source){
    const addon=(text(source.AddOnCategoryName)+" "+text(source.AddOnProductName)).toLowerCase();
    if(!/seat upgrade|concert seating upgrade|gold to blue|same category/.test(addon))return "";
    let sawUnpaid=false,sawPaid=false;
    for(const [k,v0] of Object.entries(source)){
      if(!/(paid|payment.*status|balance|remaining|amount.*due)/i.test(k))continue;
      const v=text(v0);if(!v)continue;
      if(/paid|complete|completed|settled|yes|true/i.test(v))sawPaid=true;
      if(/unpaid|not paid|pending|due|no|false/i.test(v))sawUnpaid=true;
      if(/balance|remaining|amount.*due/i.test(k)){
        const n=Number(v.replace(/[$,]/g,""));if(Number.isFinite(n)){if(n===0)sawPaid=true;else if(n>0)sawUnpaid=true;}
      }
    }
    return sawUnpaid?"Not Paid":sawPaid?"Paid":"";
  }

  async function captureDetails(file){
    try{
      const parsed=parseCSV(await file.text());
      const rows=parsed.rows||parsed;const by=new Map();
      for(const source of rows){
        const rezId=text(source.RezId1);if(!rezId)continue;
        if(!by.has(rezId))by.set(rezId,{rez_id:rezId,reservation_date:text(source.CreatedOn),check_in:text(source.AdjStartDate),check_out:text(source.AdjEndDate),room_type:text(source.PrimaryCategoryCode),seat_upgrade_fee_status:""});
        const d=by.get(rezId);
        d.reservation_date=d.reservation_date||text(source.CreatedOn);
        d.check_in=d.check_in||text(source.AdjStartDate);
        d.check_out=d.check_out||text(source.AdjEndDate);
        d.room_type=d.room_type||text(source.PrimaryCategoryCode);
        d.seat_upgrade_fee_status=d.seat_upgrade_fee_status||deriveSeatUpgradeStatus(source);
      }
      pendingDetailRows=[...by.values()].map(d=>({...d,length_of_stay:nights(d.check_in,d.check_out)}));
    }catch(e){pendingDetailRows=[];console.error("Could not capture reservation detail fields",e);}
  }

  const priorPreflight=window.preflightCSV;
  if(typeof priorPreflight==="function"){
    window.preflightCSV=async function(file){
      await captureDetails(file);
      const result=await priorPreflight(file);
      setTimeout(()=>{
        const note=document.querySelector("#privacyHeld .small:last-child");
        if(note)note.innerHTML='<b>Upload whitelist:</b> Rez number, guest name, seat, sanitized comments/requests, room type, reservation date, check-in, check-out, length of stay, and a derived Seat Upgrade Fee Paid/Not Paid status. Raw CSV, card data, payment amounts, balances, email, phone and address are not stored.';
      },0);
      return result;
    };
  }

  const priorExecute=window.executeImport;
  if(typeof priorExecute==="function"){
    window.executeImport=async function(){
      const details=pendingDetailRows.slice();
      const result=await priorExecute();
      if(details.length&&typeof session!=="undefined"&&session?.user?.id){
        try{
          const changed=details.filter(d=>JSON.stringify(detailByRez.get(String(d.rez_id))||{})!==JSON.stringify(d));
          if(changed.length){
            for(let i=0;i<changed.length;i+=100){
              await api("audit_log",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(changed.slice(i,i+100).map(d=>({user_id:session.user.id,action:"reservation_detail_import",entity_type:"reservation",entity_id:String(d.rez_id),new_value:d}))) });
            }
          }
          pendingDetailRows=[];await loadDetailHistory();
        }catch(e){console.error("Detail metadata save failed",e);setStatus("RezMagic import completed, but reservation detail metadata could not be saved: "+e.message,"warn");}
      }
      return result;
    };
  }

  const priorRenderAll=window.renderAll;
  if(typeof priorRenderAll==="function")window.renderAll=function(){priorRenderAll();setTimeout(renderImportedDetails,0);};

  const priorLoadAll=window.loadAll;
  if(typeof priorLoadAll==="function")window.loadAll=async function(opts){const r=await priorLoadAll(opts);await loadDetailHistory();return r;};

  const style=document.createElement("style");
  style.textContent=`.rightRezGuestName{margin:0 0 8px;padding:8px 9px;background:#eef3ff;border:1px solid #cfdbf5;border-radius:7px}.rightRezGuestName span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;color:var(--muted,#6b7280);margin-bottom:2px}.rightRezGuestName b{display:block;font-size:13px;line-height:1.25;color:var(--navy,#2B4692)}`;
  document.head.appendChild(style);
  loadDetailHistory();setTimeout(renderImportedDetails,0);
})();
