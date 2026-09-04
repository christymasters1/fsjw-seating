"use strict";
(function(){
  let roomRezMagicUpdates=[];
  const priorLoadAll=window.loadAll;
  const priorActiveOpenChanges=window.activeOpenChanges;
  const priorMarkEntered=window.markEntered;
  const priorRenderChanges=window.renderChanges;
  const priorSaveRequestStatus=window.saveRequestStatus;

  function roomRequestLabel(rezId){
    const record=reservations.find(r=>String(r.rez_id)===String(rezId));
    if(!record) return "Room upgrade request";
    const explicit=requestList(record).find(x=>/Room Type (?:Change )?Request/i.test(String(x)) && !/Suite/i.test(String(x)));
    if(explicit) return String(explicit);
    const text=requestText(record);
    const king=text.match(/(?:room upgrade|upgrade|request|want|wants|change)[^.!]{0,70}\bking(?: bed| room)?\b/i);
    if(king) return king[0].replace(/\s+/g," ").trim();
    return "Room upgrade request";
  }

  async function loadRoomQueue(){
    if(!session){roomRezMagicUpdates=[];return;}
    roomRezMagicUpdates=await apiAll("audit_log?select=*&action=eq.room_rezmagic_update&order=created_at.asc");
  }

  function latestRoomEvent(rezId){
    const rows=roomRezMagicUpdates.filter(x=>String(x.entity_id)===String(rezId));
    return rows.length?rows[rows.length-1]:null;
  }

  async function addRoomQueueEvent(rezId,status,extra={}){
    await api("audit_log",{
      method:"POST",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({
        user_id:session.user.id,
        action:"room_rezmagic_update",
        entity_type:"reservation",
        entity_id:String(rezId),
        new_value:{queue_status:status,request_type:"room",request_text:roomRequestLabel(rezId),...extra}
      })
    });
  }

  async function backfillApprovedRooms(){
    let added=0;
    for(const record of roomRequestRows()){
      if(latestRequestStatus(record.rez_id,"room")!=="approved") continue;
      const latest=latestRoomEvent(record.rez_id);
      const q=String(latest?.new_value?.queue_status||"");
      if(q==="needs_update"||q==="synced") continue;
      await addRoomQueueEvent(record.rez_id,"needs_update",{
        current_category_code:record.category_code||null,
        approved_by:"Existing approved request",
        approved_at:new Date().toISOString()
      });
      added++;
    }
    if(added) await loadRoomQueue();
  }

  function roomQueueRows(includeSynced=false){
    const latestByRez=new Map();
    roomRezMagicUpdates.forEach(event=>latestByRez.set(String(event.entity_id),event));
    const rows=[];
    latestByRez.forEach((event,rezId)=>{
      const q=String(event.new_value?.queue_status||"");
      if(q==="cancelled") return;
      if(q==="synced"&&!includeSynced) return;
      if(q!=="needs_update"&&q!=="synced") return;
      const names=rezGuests(rezId).map(g=>g.guest_name).join(" / ")||"Reservation";
      rows.push({
        id:"room:"+String(event.id),
        kind:"room_upgrade",
        rez_id:rezId,
        guest_id:null,
        guest_name:"ROOM · "+names,
        rezmagic_seat:"Room upgrade",
        working_seat:String(event.new_value?.request_text||roomRequestLabel(rezId)),
        status:q,
        created_at:event.created_at,
        updated_at:event.created_at
      });
    });
    return rows.sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0));
  }

  window.activeOpenChanges=function(){
    return [...priorActiveOpenChanges(),...roomQueueRows(false)];
  };

  window.rowsForQueue=function(){
    if(changeFilter==="synced"){
      return [...rezChanges.filter(c=>c.status==="synced"),...roomQueueRows(true).filter(c=>c.status==="synced")]
        .sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0));
    }
    const rows=activeOpenChanges();
    if(changeFilter==="open") return rows;
    if(changeFilter==="needs_update"||changeFilter==="entered"||changeFilter==="conflict") return rows.filter(c=>c.status===changeFilter);
    return [];
  };

  window.renderChanges=function(){
    priorRenderChanges();
    const headers=document.querySelectorAll("#changeslist .queue-table th");
    if(headers.length>=5){
      headers[2].textContent="RezMagic Current";
      headers[3].textContent="Requested / Working";
      headers[4].textContent="Update";
    }
  };

  window.markEntered=async function(changeId){
    const id=String(changeId||"");
    if(!id.startsWith("room:")) return priorMarkEntered(changeId);
    const eventId=id.slice(5);
    const source=roomRezMagicUpdates.find(x=>String(x.id)===eventId);
    if(!source) return;
    try{
      setStatus("Saving room upgrade as entered in RezMagic…","busy");
      await addRoomQueueEvent(source.entity_id,"synced",{
        current_category_code:source.new_value?.current_category_code||null,
        source_event_id:source.id,
        entered_by:session.user.email,
        entered_at:new Date().toISOString()
      });
      await loadRoomQueue();
      renderChanges();
      setStatus("Room upgrade marked entered in RezMagic and archived in Verified History.","ok");
    }catch(error){
      setStatus("Could not update room RezMagic item: "+error.message,"warn");
    }
  };

  window.saveRequestStatus=async function(rezId,type,status){
    await priorSaveRequestStatus(rezId,type,status);
    if(type!=="room") return;
    try{
      await loadRoomQueue();
      const current=latestRoomEvent(rezId);
      const q=String(current?.new_value?.queue_status||"");
      if(status==="approved"&&q!=="needs_update"){
        const record=reservations.find(r=>String(r.rez_id)===String(rezId));
        await addRoomQueueEvent(rezId,"needs_update",{
          current_category_code:record?.category_code||null,
          approved_by:session.user.email,
          approved_at:new Date().toISOString()
        });
        await loadRoomQueue();
        renderChanges();
        setStatus("Room upgrade approved and added to RezMagic Updates for manual entry.","ok");
      }else if(status!=="approved"&&q==="needs_update"){
        await addRoomQueueEvent(rezId,"cancelled",{
          cancelled_by:session.user.email,
          cancelled_at:new Date().toISOString()
        });
        await loadRoomQueue();
        renderChanges();
      }
    }catch(error){
      setStatus("Room request saved, but its RezMagic queue item could not be updated: "+error.message,"warn");
    }
  };

  window.loadAll=async function(opts){
    await priorLoadAll(opts);
    try{
      await loadRoomQueue();
      await backfillApprovedRooms();
      renderChanges();
      renderRequestWorkbench();
    }catch(error){
      console.error("Room RezMagic queue load failed",error);
    }
  };

  const priorRenderRequestWorkbench=window.renderRequestWorkbench;
  window.renderRequestWorkbench=function(){
    priorRenderRequestWorkbench();
    if(requestView==="room"){
      const info=document.getElementById("workQueueInfo");
      if(info) info.textContent="Approve a room upgrade here and it automatically moves into RezMagic Updates. After you manually make the change in RezMagic, click Mark Entered there so it is archived in history.";
    }
  };

  if(session&&reservations.length){
    loadRoomQueue().then(backfillApprovedRooms).then(()=>{renderChanges();renderRequestWorkbench();}).catch(console.error);
  }
})();
