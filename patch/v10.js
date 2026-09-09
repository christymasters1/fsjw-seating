"use strict";
(function(){
  function norm(s){return String(s||"").replace(/\s+/g," ").trim().toLowerCase();}
  function nearestBlock(el){
    let n=el;
    for(let i=0;i<5&&n;i++,n=n.parentElement){
      const t=norm(n.textContent);
      if(t.length>20&&t.length<6000&&n.children.length>0) return n;
    }
    return el?.parentElement||el;
  }
  function byHeading(re){
    const all=[...document.querySelectorAll("h1,h2,h3,h4,h5,h6,.kicker,.section-title,.title,strong,b,div,span")];
    const hit=all.find(el=>re.test(norm(el.textContent)) && norm(el.textContent).length<80);
    return hit?nearestBlock(hit):null;
  }
  function searchBlock(){
    const inputs=[...document.querySelectorAll('input[type="search"],input[type="text"]')];
    const input=inputs.find(i=>/search|guest|reservation|name/i.test(String(i.placeholder||"")));
    if(!input) return null;
    let n=input;
    for(let i=0;i<4&&n.parentElement;i++){
      if(n.parentElement.children.length<=6 && norm(n.parentElement.textContent).length<800) n=n.parentElement;
      else break;
    }
    return n;
  }
  function detailBlock(){
    return document.getElementById("resDetail")||document.getElementById("detail")||byHeading(/reservation details?/i);
  }
  function legendBlock(){
    return document.querySelector(".legend,#legend,[class*='legend'],[id*='legend']")||byHeading(/^legend$/i);
  }
  function upcomingBlock(){
    return document.querySelector("#upcomingReservations,.upcomingReservations,[class*='upcoming'][class*='reservation'],[id*='upcoming'][id*='reservation']")||byHeading(/upcoming reservations?|next reservations?/i);
  }
  function ensureRightRail(layout){
    let rail=document.getElementById("rightReservationRail");
    if(!rail){
      rail=document.createElement("aside");
      rail.id="rightReservationRail";
      rail.innerHTML='<div class="rightRailTitle">Upcoming Reservations</div><div id="rightUpcomingHost"></div><div class="rightRailLegendTitle">Legend</div><div id="rightLegendHost"></div>';
      layout.appendChild(rail);
    }
    return rail;
  }
  function arrange(){
    const sidebar=document.querySelector(".sidebar");
    if(!sidebar||!sidebar.parentElement) return;
    const layout=sidebar.parentElement;
    layout.classList.add("fsjwThreeColumnLayout");
    const search=searchBlock();
    const detail=detailBlock();
    if(search&&detail&&search!==detail&&search.parentElement===detail.parentElement){
      detail.parentElement.insertBefore(search,detail);
    }else if(search&&detail&&sidebar.contains(search)&&sidebar.contains(detail)){
      sidebar.insertBefore(search,detail);
    }
    const rail=ensureRightRail(layout);
    const upHost=rail.querySelector("#rightUpcomingHost");
    const legHost=rail.querySelector("#rightLegendHost");
    const upcoming=upcomingBlock();
    const legend=legendBlock();
    if(upcoming&&!rail.contains(upcoming)&&upcoming!==sidebar&&upcoming!==layout){
      upHost.replaceChildren(upcoming);
    }
    if(legend&&!rail.contains(legend)&&legend!==sidebar&&legend!==layout){
      legHost.replaceChildren(legend);
    }
    const searchInput=search?.querySelector?.('input[type="search"],input[type="text"]')||(search?.matches?.('input')?search:null);
    if(searchInput && !searchInput.dataset.leftSearchLocked){
      searchInput.dataset.leftSearchLocked="1";
      searchInput.setAttribute("aria-label","Search reservations");
    }
  }
  const style=document.createElement("style");
  style.textContent=`
    .fsjwThreeColumnLayout{display:grid!important;grid-template-columns:minmax(250px,310px) minmax(640px,1fr) minmax(235px,285px)!important;gap:12px!important;align-items:start!important}
    .fsjwThreeColumnLayout>.sidebar{grid-column:1!important;min-width:0!important}
    #rightReservationRail{grid-column:3!important;min-width:0;background:#fff;border:1px solid var(--line,#dfe4ea);border-radius:10px;padding:10px;box-sizing:border-box;position:sticky;top:8px;max-height:calc(100vh - 16px);overflow:auto}
    .rightRailTitle,.rightRailLegendTitle{font-size:11px;font-weight:900;color:var(--navy,#2B4692);text-transform:uppercase;letter-spacing:.04em;margin:1px 0 8px}
    .rightRailLegendTitle{margin-top:14px;padding-top:10px;border-top:1px solid var(--line,#dfe4ea)}
    #rightUpcomingHost>*{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important}
    #rightLegendHost>*{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important}
    @media(max-width:1100px){.fsjwThreeColumnLayout{grid-template-columns:minmax(240px,300px) minmax(560px,1fr)!important}.fsjwThreeColumnLayout>#rightReservationRail{grid-column:1/-1!important;position:static!important;display:grid;grid-template-columns:2fr 1fr;gap:12px;max-height:none}.rightRailLegendTitle{margin-top:0;padding-top:0;border-top:0}}
  `;
  document.head.appendChild(style);
  arrange();
  const observer=new MutationObserver(()=>{clearTimeout(window.__fsjwLayoutTimer);window.__fsjwLayoutTimer=setTimeout(arrange,40);});
  observer.observe(document.body,{childList:true,subtree:true});
})();
