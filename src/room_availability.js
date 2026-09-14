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
  function importRows(text,fileName){
    const matrix=parseMatrix(text);
    if(matrix.length<2)throw new Error("The availability CSV has no data rows.");

    // RezMagic exports may place a report title and filters above the true headings.
    // Scan for the most likely header row instead of assuming it is row one.
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
    const categoryIndex=findHeader(headers,
      ["category","category name","room category","primary category name","accommodation category","room type","room type name","accommodation","unit type","inventory category","product","product name"],
      ["category","room type","accommodation","unit type","product"]);
    const occupancyIndex=findHeader(headers,
      ["occupancy","occupancy number","occupancy #","guests","guest occupancy","guest capacity","sleeps"],
      ["occupancy","guest capacity","sleeps"]);
    const availableIndex=findHeader(headers,
      ["available inventory","inventory available","available","availability","rooms available","available rooms","quantity available","qty available","remaining","remaining inventory","available quantity"],
      ["available","availability","inventory","remaining","quantity","qty"]);
    if(categoryIndex<0)throw new Error("I found the report headings, but not its room category or room type column.");
    const grouped=new Map();
    for(const row of dataRows){
      const category=String(row[categoryIndex]||"").trim();
      if(!category)continue;
      const occupancy=occupancyIndex>=0?String(row[occupancyIndex]||"").trim():"";
      const found=availableIndex>=0?positiveNumber(row[availableIndex]):null;
      const available=found===null?1:found;
      if(available<=0)continue;
      const key=category+"\u0000"+occupancy;
      const prior=grouped.get(key)||{category,occupancy,available:0};
      prior.available+=available;
      grouped.set(key,prior);
    }
    const items=[...grouped.values()].sort((a,b)=>
      a.category.localeCompare(b.category,undefined,{numeric:true})||
      a.occupancy.localeCompare(b.occupancy,undefined,{numeric:true}));
    if(!items.length)throw new Error("No available room inventory was found.");
    inventory={items,fileName:String(fileName||"Availability CSV"),updatedAt:new Date().toISOString()};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(inventory));
    render();
    const total=items.reduce((sum,item)=>sum+item.available,0);
    if(typeof setStatus==="function")setStatus(total+" available room"+(total===1?"":"s")+" loaded. No money fields were retained.","ok");
  }
  function load(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(saved&&Array.isArray(saved.items))inventory=saved;
    }catch(error){localStorage.removeItem(STORAGE_KEY);}
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
        '<div><b>'+escText(item.category)+'</b>'+
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
    const sidebar=document.querySelector(".sidebar");
    if(sidebar&&!document.getElementById("roomAvailabilityPanel")){
      const panel=document.createElement("section");
      panel.id="roomAvailabilityPanel";
      panel.innerHTML=
        '<div class="roomAvailabilityHead"><div><div class="kicker">Room Availability</div><div id="roomAvailabilityMeta" class="small"></div></div></div>'+
        '<div id="roomAvailabilityList"></div>';
      sidebar.insertBefore(panel,sidebar.firstChild);
    }
    render();
  }
  const style=document.createElement("style");
  style.textContent=`
    #roomAvailabilityPanel{border:1px solid #cfd9ee;background:#f8faff;border-radius:8px;padding:9px;margin-bottom:10px;flex:0 0 auto}
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
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
  else install();
})();
