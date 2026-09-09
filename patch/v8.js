"use strict";
(function(){
  function reservationFor(rezId){
    return (window.reservations||[]).find(r=>String(r.rez_id)===String(rezId));
  }

  function firstValue(record,keys){
    for(const key of keys){
      const value=record?.[key];
      if(value!==undefined&&value!==null&&String(value).trim()) return String(value).trim();
    }
    return "";
  }

  function currentRoomType(record){
    if(!record) return "Not available";
    const label=firstValue(record,[
      "room_type","room_type_name","primary_category_name","category_name","primary_category","room_category_name"
    ]);
    const code=firstValue(record,["category_code","primary_category_code"]);
    if(label&&code&&!label.toLowerCase().includes(code.toLowerCase())) return label+" ("+code+")";
    return label||code||"Not available";
  }

  function roomRequestItems(record){
    try{
      return (typeof requestList==="function"?requestList(record):[])
        .map(x=>String(x||"").trim())
        .filter(Boolean)
        .filter(x=>/room type|room upgrade|suite|king bed|ada|terrace|oceanfront|cabana|tower|room request/i.test(x));
    }catch(_){return [];}
  }

  function requestedRoomType(record){
    if(!record) return "No room request found";
    const items=roomRequestItems(record);
    const text=(typeof requestText==="function"?String(requestText(record)||""):"").replace(/\s+/g," ").trim();
    const combined=(items.join(" · ")+" "+text).trim();

    const specifics=[];
    const rules=[
      [/oceanfront atlantic suite/i,"Oceanfront Atlantic Suite"],
      [/clock(?:\s+king)?\s+tower\s+suite/i,"Clock Tower Suite"],
      [/king\s+terrace/i,"King Terrace"],
      [/oceanfront\s+terrace/i,"Oceanfront Terrace"],
      [/cabana/i,"Cabana Room"],
      [/king bed|room type change request to king|\bwants? king\b|\bking room\b/i,"King Bed / King Room"],
      [/room type change request to suite|\bsuite\b/i,"Suite"],
      [/\bada\b|accessible/i,"ADA / Accessible Room"]
    ];
    rules.forEach(([rx,label])=>{if(rx.test(combined)&&!specifics.includes(label)) specifics.push(label);});
    if(specifics.length) return specifics.join(" / ");
    if(items.length) return items.join(" · ");
    return text||"No room request found";
  }

  function roomRequestDetail(record){
    const text=(typeof requestText==="function"?String(requestText(record)||""):"").replace(/\s+/g," ").trim();
    const requested=requestedRoomType(record);
    if(!text||text===requested||text.length>220) return "";
    return text;
  }

  function roomInfoHtml(record,compact=false){
    const current=currentRoomType(record), requested=requestedRoomType(record), detail=roomRequestDetail(record);
    if(compact){
      return '<div class="roomTypeSummary"><div><span>Current room</span><b>'+esc(current)+'</b></div><div><span>Requested</span><b>'+esc(requested)+'</b></div></div>';
    }
    return '<div class="roomTypePanel"><div class="roomTypeCol"><span>Current room type</span><b>'+esc(current)+'</b></div><div class="roomTypeArrow">→</div><div class="roomTypeCol"><span>Requested room type</span><b>'+esc(requested)+'</b></div>'+(detail?'<div class="roomTypeDetail"><b>Room request detail:</b> '+esc(detail)+'</div>':'')+'</div>';
  }

  function enhanceWorkCards(){
    document.querySelectorAll("#workCards .workCard[data-work-rez]").forEach(card=>{
      if(card.querySelector(".roomTypeSummary")) return;
      const record=reservationFor(card.dataset.workRez);
      if(!record) return;
      const requestTextEl=card.querySelector(".workCardRequest");
      if(requestTextEl) requestTextEl.insertAdjacentHTML("afterend",roomInfoHtml(record,true));
    });
  }

  function enhanceSelectedReservation(){
    const record=reservationFor(window.selectedRez||selectedRez);
    if(!record) return;
    const host=document.getElementById("resDetail")||document.getElementById("detail");
    if(!host||host.querySelector(".roomTypePanel")) return;
    const first=host.firstElementChild;
    if(first) first.insertAdjacentHTML("afterend",roomInfoHtml(record,false));
    else host.insertAdjacentHTML("afterbegin",roomInfoHtml(record,false));
  }

  function enhanceRoomQueue(){
    document.querySelectorAll("#changeslist .queue-table tbody tr").forEach(row=>{
      if(row.dataset.roomTypesEnhanced) return;
      const text=row.textContent||"";
      const rezMatch=text.match(/#?(\d{6,})/);
      if(!rezMatch) return;
      const record=reservationFor(rezMatch[1]);
      if(!record) return;
      const cells=row.querySelectorAll("td");
      if(cells.length>=4){
        const current=currentRoomType(record), requested=requestedRoomType(record);
        if(/room/i.test(text)){
          cells[2].textContent=current;
          cells[3].textContent=requested;
          row.dataset.roomTypesEnhanced="1";
        }
      }
    });
  }

  function enhanceAllRoomInfo(){
    enhanceWorkCards();
    enhanceSelectedReservation();
    enhanceRoomQueue();
  }

  const priorRenderRequestWorkbench=window.renderRequestWorkbench;
  if(typeof priorRenderRequestWorkbench==="function"){
    window.renderRequestWorkbench=function(){
      priorRenderRequestWorkbench();
      enhanceWorkCards();
    };
  }

  const priorRenderChanges=window.renderChanges;
  if(typeof priorRenderChanges==="function"){
    window.renderChanges=function(){
      priorRenderChanges();
      enhanceRoomQueue();
    };
  }

  const priorRenderAll=window.renderAll;
  if(typeof priorRenderAll==="function"){
    window.renderAll=function(){
      priorRenderAll();
      enhanceAllRoomInfo();
    };
  }

  const style=document.createElement("style");
  style.textContent=`
    .roomTypePanel{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;margin:8px 0;padding:9px;border:1px solid #cfd9e6;background:#f7faff;border-radius:8px}
    .roomTypeCol span,.roomTypeSummary span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800;margin-bottom:2px}
    .roomTypeCol b{display:block;font-size:11px;line-height:1.3;color:var(--navy)}
    .roomTypeArrow{font-size:17px;color:var(--muted);font-weight:800}
    .roomTypeDetail{grid-column:1/-1;border-top:1px solid #dfe6ef;padding-top:6px;font-size:9px;line-height:1.35;color:#4f5863}
    .roomTypeSummary{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px;padding:6px;border-radius:6px;background:#f4f7fb;border:1px solid #dce4ee}
    .roomTypeSummary>div{min-width:0}.roomTypeSummary b{display:block;font-size:9px;line-height:1.25;color:var(--navy);word-break:break-word}
  `;
  document.head.appendChild(style);

  enhanceAllRoomInfo();
})();
