"use strict";
(function(){
  const STORAGE_KEY="fsjw_room_availability_v1";
  const MONEY_HEADER=/(rate|price|cost|amount|fee|payment|balance|revenue|total.?charge|currency|deposit)/i;
  let inventory={items:[],fileName:"",updatedAt:""};

  function escText(value){
    return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function cleanHeader(value){
    return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ");
  }
  function parseMatrix(text){
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(ch===","&&!quoted){row.push(cell);cell="";}
      else if((ch==="\n"||ch==="\r")&&!quoted){
        if(ch==="\r"&&next==="\n")i++;
        row.push(cell);cell="";
        if(row.some(v=>String(v).trim()))rows.push(row);
        row=[];
      }else cell+=ch;
    }
    if(cell||row.length){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);}
    return rows;
  }
  function findHeader(headers,exact,contains){
    const normalized=headers.map(cleanHeader);
    for(const name of exact){const i=normalized.indexOf(name);if(i>=0)return i;}
    for(let i=0;i<normalized.length;i++){
      if(MONEY_HEADER.test(headers[i]))continue;
      if(contains.some(term=>normalized[i].includes(term)))return i;
    }
    return -1;
  }
  function positiveNumber(value){
    const match=String(value??"").replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
    if(!match)return null;
    const number=Number(match[0]);
    return Number.isFinite(number)&&number>=0?number:null;
  }
  function normalizeCode(value){return String(value||"").trim().toUpperCase();}
  function lookupByCode(code){
    const target=normalizeCode(code);
    if(!target)return null;
    const matches=inventory.items.filter(item=>normalizeCode(item.categoryCode)===target);
    if(!matches.length)return null;
    const withName=matches.find(item=>item.categoryName);
    const withOccupancy=matches.find(item=>item.occupancy);
    return {
      categoryCode:target,
      categoryName:(withName&&withName.categoryName)||"",
      occupancy:(withOccupancy&&withOccupancy.occupancy)||""
    };
  }
  function expose(){
    window.FSJWRoomAvailability={lookupByCode,getInventory:()=>inventory};
  }
  function importRows(text,fileName){
    const matrix=parseMatrix(text);
    if(matrix.length<2)throw new Error("The availability CSV has no data rows.");

    let headerRowIndex=-1;
    let bestScore=-1;
    const scanLimit=Math.min(matrix.length,30);
    for(let rowIndex=0;rowIndex<scanLimit;rowIndex++){
      const cells=matrix[rowIndex].map(cleanHeader);
      let score=0;
      if(cells.some(v=>/(category|room type|accommodation|unit type|product)/.test(v)))score+=4;
      if(cells.some(v=>/(occupancy|guest capacity|sleeps)/.test(v)))score+=3;
      if(cells.some(v=>/(available|availability|inventory|remaining|quantity|qty)/.test(v)))score+=3;
      if(cells.filter(Boolean).length>=2)score+=1;
      if(score>bestScore){bestScore=score;headerRowIndex=rowIndex;}
    }
    if(headerRowIndex<0||bestScore<4)throw new Error("I could not identify the inventory headings in this report.");
    const headers=matrix[headerRowIndex].map(h=>String(h).trim());
    const dataRows=matrix.slice(headerRowIndex+1);

    const categoryCodeIndex=findHeader(headers,
      ["category code","primary category code","room category code","accommodation category code","room type code","unit type code"],
      ["category code","room type code","unit type code"]);
    const categoryNameIndex=findHeader(headers,
      ["category name","primary category name","room category name","accommodation category name","room type name","unit type name","product name"],
      ["category name","room category name","room type name","unit type name","product name"]);
    const genericCategoryIndex=findHeader(headers,
      ["category","room category","accommodation category","room type","accommodation","unit type","inventory category","product"],
      ["room category","room type","accommodation","unit type","inventory category"]);
    const occupancyIndex=findHeader(headers,
      ["occupancy","occupancy number","occupancy #","guests","guest occupancy","guest capacity","sleeps"],
      ["occupancy","guest capacity","sleeps"]);
    const availableIndex=findHeader(headers,
      ["available inventory","inventory available","available","availability","rooms available","available rooms","quantity available","qty available","remaining","remaining inventory","available quantity"],
      ["available","availability","inventory","remaining","quantity","qty"]);

    if(categoryCodeIndex<0 && categoryNameIndex<0 && genericCategoryIndex<0){
      throw new Error("I found the report headings, but not its room category fields.");
    }

    const grouped=new Map();
    for(const row of dataRows){
      let categoryCode=categoryCodeIndex>=0?String(row[categoryCodeIndex]||"").trim():"";
      let categoryName=categoryNameIndex>=0?String(row[categoryNameIndex]||"").trim():"";
      const generic=genericCategoryIndex>=0?String(row[genericCategoryIndex]||"").trim():"";
      if(!categoryCode && generic && /^[A-Z0-9-]{2,12}$/i.test(generic))categoryCode=generic;
      if(!categoryName && generic && generic!==categoryCode)categoryName=generic;
      if(!categoryCode && !categoryName)continue;
      const occupancy=occupancyIndex>=0?String(row[occupancyIndex]||"").trim():"";
      const found=availableIndex>=0?positiveNumber(row[availableIndex]):null;
      const available=found===null?1:found;
      if(available<=0)continue;
      const key=(categoryCode||categoryName)+"\u0000"+occupancy;
      const prior=grouped.get(key)||{categoryCode,categoryName,occupancy,available:0};
      if(!prior.categoryCode&&categoryCode)prior.categoryCode=categoryCode;
      if(!prior.categoryName&&categoryName)prior.categoryName=categoryName;
      prior.available+=available;
      grouped.set(key,prior);
    }
    const items=[...grouped.values()].sort((a,b)=>
      (a.categoryCode||a.categoryName).localeCompare((b.categoryCode||b.categoryName),undefined,{numeric:true})||
      a.occupancy.localeCompare(b.occupancy,undefined,{numeric:true}));
    if(!items.length)throw new Error("No available room inventory was found.");
    inventory={items,fileName:String(fileName||"Availability CSV"),updatedAt:new Date().toISOString()};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(inventory));
    expose();
    render();
    if(typeof renderDetails==="function")renderDetails();
    const total=items.reduce((sum,item)=>sum+item.available,0);
    if(typeof setStatus==="function")setStatus(total+" available room"+(total===1?"":"s")+" loaded. Category names and occupancy are now available to reservation details.","ok");
  }
  function load(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(saved&&Array.isArray(saved.items))inventory=saved;
    }catch(error){localStorage.removeItem(STORAGE_KEY);}
    expose();
  }
  function render(){
    const host=document.getElementById("roomAvailabilityList");
    const meta=document.getElementById("roomAvailabilityMeta");
    if(!host||!meta)return;
    if(!inventory.items.length){
      meta.textContent="Upload the latest availability CSV.";
      host.innerHTML='<div class="roomAvailabilityEmpty">No inventory loaded.</div>';
      return;
    }
    const total=inventory.items.reduce((sum,item)=>sum+Number(item.available||0),0);
    const date=inventory.updatedAt?new Date(inventory.updatedAt):null;
    meta.textContent=total+" available · "+(date&&!Number.isNaN(date.getTime())?date.toLocaleString():"Latest upload");
    host.innerHTML=inventory.items.map(item=>
      '<div class="roomAvailabilityRow">'+
        '<div><b>'+escText(item.categoryName||item.categoryCode)+'</b>'+
        (item.categoryCode&&item.categoryName?'<span>'+escText(item.categoryCode)+'</span>':'')+
        (item.occupancy?'<span>Occupancy '+escText(item.occupancy)+'</span>':'')+'</div>'+
        '<strong>'+escText(item.available)+'</strong>'+
      '</div>'
    ).join("");
  }
  function install(){
    const actions=document.querySelector(".actions");
    if(actions&&!document.getElementById("availabilityCsvFile")){
      const label=document.createElement("label");
      label.className="fileAction";
      label.innerHTML='Import Room Availability CSV<input id="availabilityCsvFile" type="file" accept=".csv,text/csv" hidden>';
      actions.insertBefore(label,document.getElementById("refresh"));
      label.querySelector("input").addEventListener("change",async event=>{
        const file=event.target.files&&event.target.files[0];
        event.target.value="";
        if(!file)return;
        try{
          if(typeof setStatus==="function")setStatus("Reading room availability CSV locally…","busy");
          importRows(await file.text(),file.name);
        }catch(error){
          if(typeof setStatus==="function")setStatus("Availability import failed: "+error.message,"warn");
          else alert(error.message);
        }
      });
    }
    placePanel();
    render();
  }
  function placePanel(){
    const rail=document.getElementById("rightReservationRail");
    if(!rail)return false;
    let panel=document.getElementById("roomAvailabilityPanel");
    if(!panel){
      panel=document.createElement("section");
      panel.id="roomAvailabilityPanel";
      panel.innerHTML=
        '<div class="roomAvailabilityHead"><div><div class="kicker">Room Availability</div><div id="roomAvailabilityMeta" class="small"></div></div></div>'+
        '<div id="roomAvailabilityList"></div>';
    }
    const upcomingTitle=rail.querySelector(".rightRailTitle");
    if(panel.parentElement!==rail || panel.nextElementSibling!==upcomingTitle){
      rail.insertBefore(panel,upcomingTitle||rail.firstChild);
    }
    return true;
  }
  const style=document.createElement("style");
  style.textContent=`
    @media(min-width:1101px){
      .fsjwThreeColumnLayout{grid-template-columns:minmax(250px,310px) minmax(0,1fr) minmax(280px,320px)!important;grid-template-areas:"left map right"!important}
      .fsjwThreeColumnLayout>.rightbar,.fsjwThreeColumnLayout>.sidebar{grid-area:left!important;min-width:0!important}
      .fsjwThreeColumnLayout>.mapcard{grid-area:map!important;grid-column:2!important;grid-row:1!important;width:100%!important;min-width:0!important;max-width:none!important;margin:0!important;left:auto!important;right:auto!important;transform:none!important;justify-self:stretch!important;overflow:auto!important}
      .fsjwThreeColumnLayout>#rightReservationRail{grid-area:right!important;grid-column:3!important;grid-row:1!important;width:100%!important;min-width:0!important;margin:0!important;left:auto!important;right:auto!important;transform:none!important}
    }
    #roomAvailabilityPanel{border:1px solid #cfd9ee;background:#f8faff;border-radius:8px;padding:9px;margin:0 0 12px;flex:0 0 auto}
    .roomAvailabilityHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding-bottom:7px;border-bottom:1px solid #dfe5f1}
    #roomAvailabilityMeta{font-size:9px;margin-top:3px}
    #roomAvailabilityList{max-height:245px;overflow:auto;margin-top:6px;padding-right:2px}
    .roomAvailabilityRow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 5px;border-bottom:1px solid #e5e9f2}
    .roomAvailabilityRow:last-child{border-bottom:0}
    .roomAvailabilityRow b{display:block;font-size:10px;line-height:1.25;color:var(--ink,#172033)}
    .roomAvailabilityRow span{display:block;font-size:9px;color:var(--muted,#6b7280);margin-top:2px}
    .roomAvailabilityRow strong{display:flex;align-items:center;justify-content:center;min-width:28px;height:25px;padding:0 7px;border-radius:999px;background:#e8f6ee;color:#17653d;font-size:11px}
    .roomAvailabilityEmpty{font-size:10px;color:var(--muted,#6b7280);padding:8px 4px 2px}
  `;
  document.head.appendChild(style);
  load();
  const keepPlaced=()=>{
    if(!placePanel())return;
    render();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
  else install();
  window.setTimeout(keepPlaced,100);
  window.setTimeout(keepPlaced,500);
  const placementObserver=new MutationObserver(()=>window.requestAnimationFrame(keepPlaced));
  placementObserver.observe(document.body,{childList:true,subtree:true});
})();
