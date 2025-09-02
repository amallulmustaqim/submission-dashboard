// Secretariat page logic (enhanced: 4:30pm defaults, timeline filters/badges, internal-note datetime, PM notice on letter)
function userCanEditSec(){ const me=DTRC.getUser(); return !!(me?.isAdmin || (me?.isSecretariat && me?.secRole==='edit')); }
let secFiltered=[], secTab='mine', secCurrent=null;

// Small wrapper to call the new DTRC.renderTimeline(opts) and gracefully fall back to old signature
function _renderTL(el, proj, opts){
  try { return DTRC.renderTimeline(el, proj, opts); }
  catch(e){ return DTRC.renderTimeline(el, proj, !!(opts?.forPM)); }
}

const deriveFocus=p=>{
  const last = (p.timeline||[]).slice(-1)[0];
  if(p.status==='LETTER_ISSUED') return 'Completed — Letter issued';
  if(p.nextActor==='secretariat'){
    if(p.status==='SUBMITTED'){
      const cameFromFR = p.prevStatus==='FEEDBACK_REQUIRED' || (p.timeline||[]).some(e=>e.actor==='user' && e.stage==='FEEDBACK_REQUIRED' && e.isSubmission && e===last);
      return cameFromFR ? 'PM submitted updates — review required' : 'New submission — review pending';
    }
    if(p.status==='APPROVED') return 'PM replied to approval — review required';
    if(p.status==='NOT_APPROVED') return 'PM replied to meeting outcome — review required';
    return 'Awaiting Secretariat action';
  }
  if(p.nextActor==='pm'){
    if(p.status==='FEEDBACK_REQUIRED') return 'Feedback requested — PM to upload updates';
    if(p.status==='APPROVED') return 'Approved with conditions — provide reply/update';
    if(p.status==='NOT_APPROVED') return 'Not approved — respond to meeting outcome';
    return 'Awaiting PM action';
  }
  return '—';
};

function applySecFilters(){
  const projects=DTRC.loadProjects(); const q=(DTRC.$('#secQ')?.value||'').trim().toLowerCase(); const st=DTRC.$('#secStatusF')?.value||''; const me=DTRC.getUser();
  let list=projects;
  if(q) list=list.filter(p=> (`${p.name} ${p.department} ${p.ministry}`).toLowerCase().includes(q));
  if(st) list=list.filter(p=> p.status===st);
  if(secTab==='mine') list=list.filter(p=> p.nextActor==='secretariat');
  if(secTab==='assigned') list=list.filter(p=> (p.secOwner||'').toLowerCase()=== (me?.email||'').toLowerCase());
  if(secTab==='waiting') list=list.filter(p=> p.nextActor==='pm');
  if(secTab==='completed') list=list.filter(p=> p.status==='LETTER_ISSUED');
  if(secTab==='mine') list.sort((a,b)=> new Date(a.dueAt||'9999') - new Date(b.dueAt||'9999'));
  else list.sort((a,b)=> new Date((b.timeline?.slice(-1)[0]?.at)||b.updatedAt||0) - new Date((a.timeline?.slice(-1)[0]?.at)||a.updatedAt||0));
  secFiltered=list;
}
function actorLabelForSec(p){ if(p.nextActor==='secretariat') return `You${p.secOwner? ' ('+p.secOwner+')':''}`; if(p.nextActor==='pm') return `PM (${p.pmBusiness?.name||p.pmBusiness?.email||'-'})`; return 'None'; }
function rowClassSec(p){ if(p.nextActor==='secretariat'&&DTRC.isOverdue(p)) return 'table-danger row-own'; if(p.nextActor==='secretariat') return 'table-warning row-own'; return ''; }

function renderSec(){
  DTRC.updateActionBadges(); applySecFilters();
  const tbody=DTRC.$('#secRows'); if(!tbody) return; tbody.innerHTML='';
  secFiltered.forEach((p,i)=>{
    const unreadDot=p.unread?.secretariat? `<span class="dot cursor-pointer" data-toggle-sec-unread="${p.id}" title="Click to mark read/unread"></span>`:'';
    const letterLine = p.letterRef? `<div class="small text-muted">${p.letterRef}</div>` : '';
    const tr=document.createElement('tr'); tr.className=rowClassSec(p);
    tr.innerHTML=`
      <td>${i+1}</td>
      <td>${p.name} ${unreadDot}${letterLine}</td>
      <td>${p.department||'-'}</td>
      <td>${p.ministry||'-'}</td>
      <td>${p.mainType||'-'}</td>
      <td><span class="badge ${DTRC.badgeClass(p.status)}">${p.status}</span></td>
      <td>${actorLabelForSec(p)}</td>
      <td>${deriveFocus(p)}</td>
      <td>${DTRC.dueText(p)}</td>
      <td>${DTRC.fmtDate((p.timeline?.slice(-1)[0]?.at)||p.updatedAt)}</td>
      <td><button class="btn btn-sm btn-outline-primary" data-sec-open="${p.id}">${p.nextActor==='secretariat'?'Review & Act':'Open'}</button></td>
    `;
    tbody.appendChild(tr);
  });
  DTRC.$$('[data-sec-open]').forEach(btn=> btn.onclick=()=> openSec(btn.getAttribute('data-sec-open')));
  DTRC.$$('[data-toggle-sec-unread]').forEach(dot=> dot.onclick=()=> DTRC.toggleUnread(dot.getAttribute('data-toggle-sec-unread'),'secretariat'));
}

const secModal = ()=> bootstrap.Modal.getOrCreateInstance('#secDetailModal');

function openSec(id){
  const projects=DTRC.loadProjects(); secCurrent=projects.find(p=>p.id===id); if(!secCurrent) return;
  secCurrent.seen.secretariatAt=new Date().toISOString(); secCurrent.unread.secretariat=false; DTRC.safeSaveProjects(projects);
  refreshSecModalContent(); secModal().show(); renderSec();
}

function refreshSecModalContent(){
  if(!secCurrent) return;
  DTRC.$('#secTitle').textContent=secCurrent.name;
  DTRC.$('#secDept').textContent=secCurrent.department||'-';
  DTRC.$('#secMinistry').textContent=secCurrent.ministry||'-';
  DTRC.$('#secPMB').textContent=`${secCurrent.pmBusiness?.name||'-'} (${secCurrent.pmBusiness?.email||'-'})`;
  DTRC.$('#secPMT').textContent=secCurrent.pmTechnical?.email? `${secCurrent.pmTechnical?.name||'-'} (${secCurrent.pmTechnical?.email})`:'-';
  DTRC.$('#secTypes').textContent=`${secCurrent.mainType||'-'}; Other: ${(secCurrent.otherTypes||[]).join(', ')||'-'} ${secCurrent.sharedServices?.length? ' | EGNC SS: '+secCurrent.sharedServices.join(', '):''}`;
  const s= DTRC.$('#secStatus'); s.className='badge '+DTRC.badgeClass(secCurrent.status); s.textContent=secCurrent.status;
  DTRC.$('#secLetterRef').textContent=secCurrent.letterRef||'—';
  const banner = secCurrent.nextActor==='none' ? `Complete — Letter issued` : `Awaiting: <b>${secCurrent.nextActor==='pm'?'PM':'Secretariat'}</b>${secCurrent.secOwner && secCurrent.nextActor==='secretariat' ? ' ('+secCurrent.secOwner+')':''} • Due: <b>${DTRC.dueText(secCurrent)}</b>${DTRC.isOverdue(secCurrent)?' — <span class="text-danger">Overdue</span>':''}`;
  DTRC.$('#secBanner').innerHTML=banner;

  DTRC.$('#secFiles').innerHTML=DTRC.listFiles(secCurrent.attachments);

  // Inject timeline filter controls (once)
  if (!document.getElementById('secTLControls')) {
    const h6 = document.querySelector('#secTimeline')?.previousElementSibling; // the <h6> Timeline header
    const controls = document.createElement('div');
    controls.id = 'secTLControls';
    controls.className = 'd-flex align-items-center gap-2 mb-2';
    controls.innerHTML = `
      <select id="secTLActor" class="form-select form-select-sm" style="max-width:180px">
        <option value="all">All actors</option>
        <option value="user">User only</option>
        <option value="sec">Secretariat only</option>
      </select>
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="secTLShowInternal">
        <label class="form-check-label" for="secTLShowInternal">Show internal</label>
      </div>`;
    h6?.after(controls);
    document.getElementById('secTLActor').onchange = () => _renderTL(DTRC.$('#secTimeline'), secCurrent, { forPM:false, actor: document.getElementById('secTLActor').value, includeInternal: document.getElementById('secTLShowInternal').checked });
    document.getElementById('secTLShowInternal').onchange = () => _renderTL(DTRC.$('#secTimeline'), secCurrent, { forPM:false, actor: document.getElementById('secTLActor').value, includeInternal: document.getElementById('secTLShowInternal').checked });
  }
  const actorSel = document.getElementById('secTLActor')?.value || 'all';
  const showInt = !!document.getElementById('secTLShowInternal')?.checked;
  _renderTL(DTRC.$('#secTimeline'), secCurrent, { forPM:false, actor: actorSel, includeInternal: showInt });

  // Editability
  DTRC.$('#secStatusSel').disabled=!userCanEditSec(); DTRC.$('#secApplyChange').disabled=!userCanEditSec();
  DTRC.$('#blockFeedback').style.display='none'; DTRC.$('#blockApproved').style.display='none'; DTRC.$('#blockNotApproved').style.display='none'; DTRC.$('#blockLetter').style.display='none';
  DTRC.$('#secFRReply').innerHTML=''; DTRC.$('#remarks').innerHTML=''; DTRC.$('#remarksNA').innerHTML='';
  DTRC.$('#letterFile').value=''; DTRC.$('#letterRef').value=secCurrent.letterRef||'';
  DTRC.$('#meetingOutcomeAP').value=''; DTRC.$('#meetingOutcomeNA').value='';

  // Prefill due dates: business +10 at 16:30
  const setDue = (el)=>{ const x=DTRC.$(el); if(x) x.value = (DTRC.isoToLocalDT((DTRC.addBizDaysAt? DTRC.addBizDaysAt(10,16,30): DTRC.addBizDays(10)))) };
  setDue('#secDueAtFR'); setDue('#secDueAtAP'); setDue('#secDueAtNA');

  // Focal
  const focal=DTRC.$('#secFocalEmail'); if(focal){ focal.value=secCurrent.secOwner||''; }
  const assigned=DTRC.$('#secAssignedTo'); if(assigned){ assigned.textContent=secCurrent.secOwner||'—'; }

  DTRC.$('#secStatusSel').onchange=e=> toggleSecBlocks(e.target.value);
  const markRU=DTRC.$('#secMarkRU'); if(markRU) markRU.onclick=()=>{ DTRC.toggleUnread(secCurrent.id,'secretariat',true); openSec(secCurrent.id); };

  // Internal note: add datetime-local (once) and default to now
  if (!document.getElementById('secInternalAt')) {
    const dt = document.createElement('input');
    dt.type = 'datetime-local';
    dt.className = 'form-control form-control-sm mt-2';
    dt.id = 'secInternalAt';
    const hint = document.createElement('div');
    hint.className = 'form-text';
    hint.textContent = 'Timestamp for this internal note (defaults to now).';
    const box = document.getElementById('secInternalNote').parentElement;
    box.insertBefore(dt, document.getElementById('secInternalNote').nextSibling);
    box.insertBefore(hint, dt.nextSibling);
  }
  document.getElementById('secInternalAt').value = DTRC.isoToLocalDT(new Date().toISOString());

  const internal = DTRC.$('#secInternalNote'); if(internal){ internal.innerHTML=''; }
  const addInt = DTRC.$('#secAddInternal');
  if(addInt) addInt.onclick=()=>{
    const text=DTRC.safePlain(DTRC.$('#secInternalNote').innerHTML.trim());
    if(!text) return alert('Type an internal note first.');
    const arr=DTRC.loadProjects(); const idx=arr.findIndex(x=>x.id===secCurrent.id); if(idx<0) return;
    const atISO = DTRC.localDTToISO(document.getElementById('secInternalAt').value) || new Date().toISOString();
    DTRC.pushTimeline(arr[idx], {actor:'sec', stage: arr[idx].status, internal:true, text, at: atISO}); 
    if(!DTRC.safeSaveProjects(arr)) return;
    secCurrent=arr[idx];
    DTRC.$('#secInternalNote').innerHTML='';
    document.getElementById('secInternalAt').value = DTRC.isoToLocalDT(new Date().toISOString());
    _renderTL(DTRC.$('#secTimeline'), secCurrent, { forPM:false, actor: document.getElementById('secTLActor')?.value || 'all', includeInternal: !!document.getElementById('secTLShowInternal')?.checked });
    renderSec(); DTRC.notify('Internal note added');
  };
}
function toggleSecBlocks(val){
  DTRC.$('#blockFeedback').style.display = (val==='FEEDBACK_REQUIRED')? '' : 'none';
  DTRC.$('#blockApproved').style.display = (val==='APPROVED')? '' : 'none';
  DTRC.$('#blockNotApproved').style.display = (val==='NOT_APPROVED')? '' : 'none';
  DTRC.$('#blockLetter').style.display   = (val==='LETTER_ISSUED')? '' : 'none';
}

function fillTemplate(str,dueISO){
  if(!str) return '';
  const today = new Date();
  const fmtToday = `${DTRC.pad(today.getDate())}/${DTRC.pad(today.getMonth()+1)}/${today.getFullYear()}`;
  const dueTxt = dueISO? DTRC.fmtDate(dueISO) : '—';
  return str.replaceAll('{{DUE}}', dueTxt).replaceAll('{{TODAY}}', fmtToday);
}

document.addEventListener('DOMContentLoaded', ()=>{
  DTRC.guardAuth({requireSecretariat:true});
  // toggle templates
  const tplFR = DTRC.$('#tplFR'); if(tplFR) tplFR.onchange=()=>{ const tpl=tplFR.value; const due=DTRC.$('#secDueAtFR').value? new Date(DTRC.$('#secDueAtFR').value).toISOString(): null; if(!tpl) return; if(DTRC.$('#secFRReply').innerHTML.trim() && !confirm('Replace current text with the selected template?')) return; DTRC.$('#secFRReply').innerHTML = fillTemplate(tpl,due); };
  const tplAP = DTRC.$('#tplAP'); if(tplAP) tplAP.onchange=()=>{ const tpl=tplAP.value; const due=DTRC.$('#secDueAtAP').value? new Date(DTRC.$('#secDueAtAP').value).toISOString(): null; if(!tpl) return; if(DTRC.$('#remarks').innerHTML.trim() && !confirm('Replace current text with the selected template?')) return; DTRC.$('#remarks').innerHTML = fillTemplate(tpl,due); };
  const tplNA = DTRC.$('#tplNA'); if(tplNA) tplNA.onchange=()=>{ const tpl=tplNA.value; const due=DTRC.$('#secDueAtNA').value? new Date(DTRC.$('#secDueAtNA').value).toISOString(): null; if(!tpl) return; if(DTRC.$('#remarksNA').innerHTML.trim() && !confirm('Replace current text with the selected template?')) return; DTRC.$('#remarksNA').innerHTML = fillTemplate(tpl,due); };

  // Undo commented upload
  const undoBtn = DTRC.$('#undoCommented');
  if(undoBtn) undoBtn.onclick=()=>{
    if(!secCurrent) return; const projects=DTRC.loadProjects(); const idx=projects.findIndex(x=>x.id===secCurrent.id); if(idx<0) return;
    const last=[...projects[idx].attachments].reverse().find(a=>a.kind==='commented'); if(!last) return alert('No commented document to undo.');
    if(!confirm('Undo last commented upload?')) return;
    projects[idx].attachments=projects[idx].attachments.filter(a=>a.id!==last.id);
    DTRC.pushTimeline(projects[idx], {actor:'sec', stage: projects[idx].status, internal:true, text:`Removed commented upload: ${last.filename}`});
    if(projects[idx].status==='FEEDBACK_REQUIRED'){ projects[idx].status=projects[idx].prevStatus || 'SUBMITTED'; projects[idx].nextActor='secretariat'; }
    if(!DTRC.safeSaveProjects(projects)) return;
    secCurrent=projects[idx]; refreshSecModalContent(); renderSec();
  };

  // Assign focal
  const assign = DTRC.$('#secAssignFocal');
  if(assign) assign.onclick=()=>{
    if(!secCurrent) return; const email=(DTRC.$('#secFocalEmail').value||'').trim().toLowerCase();
    if(!email || !email.includes('@')) return alert('Enter a valid email');
    const arr=DTRC.loadProjects(); const idx=arr.findIndex(p=>p.id===secCurrent.id); if(idx<0) return;
    arr[idx].secOwner=email; arr[idx].updatedAt=new Date().toISOString();
    if(!DTRC.safeSaveProjects(arr)) return;
    secCurrent=arr[idx]; DTRC.$('#secAssignedTo').textContent=secCurrent.secOwner; renderSec(); DTRC.notify('Focal assigned');
  };

  // Apply status change
  const applyBtn = DTRC.$('#secApplyChange');
  if(applyBtn) applyBtn.onclick= async ()=>{
    const me=DTRC.getUser(); if(!me || !userCanEditSec()) return alert('Not allowed.');
    const projects=DTRC.loadProjects(); const idx=projects.findIndex(x=>x.id===secCurrent.id); if(idx<0) return;
    const p=projects[idx]; const val=DTRC.$('#secStatusSel').value; if(!val) return alert('Select a status to apply.');
    p.prevStatus=p.status; if(!p.secOwner) p.secOwner=me.email;

    if(val==='FEEDBACK_REQUIRED'){
      const files=await DTRC.filesToDataUrls(DTRC.$('#feedbackFile').files); if(!files.length) return alert('Commented document is required.');
      files.forEach(f=> p.attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'commented',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:'secretariat',uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
      const dueSel=DTRC.$('#secDueAtFR').value; p.dueAt = dueSel? DTRC.localDTToISO(dueSel): (DTRC.addBizDaysAt? DTRC.addBizDaysAt(10,16,30): DTRC.addBizDays(10));
      const plain=DTRC.safePlain(DTRC.$('#secFRReply').innerHTML.trim());
      DTRC.pushTimeline(p, {actor:'sec', stage:'FEEDBACK_REQUIRED', text:`Sent ARF back to user for feedback. See Remark:`, quote: plain? `${plain}` : `Kindly review and revise per comments; resubmit by ${DTRC.fmtDate(p.dueAt)}.`});
      p.status='FEEDBACK_REQUIRED'; p.nextActor='pm'; p.unread.pm=true; p.unread.secretariat=false;
      DTRC.$('#feedbackFile').value=''; DTRC.$('#secFRReply').innerHTML=''; DTRC.$('#tplFR').value='';
      DTRC.notify('Sent to PM');
    }

    if(val==='APPROVED'){
      const mo=await DTRC.filesToDataUrls(DTRC.$('#meetingOutcomeAP').files);
      mo.forEach(f=> p.attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'meeting_outcome',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:'secretariat',uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
      const dueSel=DTRC.$('#secDueAtAP').value; p.dueAt = dueSel? DTRC.localDTToISO(dueSel): (DTRC.addBizDaysAt? DTRC.addBizDaysAt(10,16,30): DTRC.addBizDays(10));
      const plain=DTRC.safePlain(DTRC.$('#remarks').innerHTML.trim());
      DTRC.pushTimeline(p, {actor:'sec', stage:'APPROVED', text:`ARF has been approved. See Remark:`, quote: plain? `${plain}` : `Approved with conditions. Please confirm completion by ${DTRC.fmtDate(p.dueAt)}.`});
      p.status='APPROVED'; p.nextActor='pm'; p.unread.pm=true; p.unread.secretariat=false;
      DTRC.$('#remarks').innerHTML=''; DTRC.$('#meetingOutcomeAP').value=''; DTRC.$('#tplAP').value='';
      DTRC.notify('Approved with remarks — assigned to PM');
    }

    if(val==='NOT_APPROVED'){
      const mo=await DTRC.filesToDataUrls(DTRC.$('#meetingOutcomeNA').files); if(!mo.length) return alert('Meeting Outcome attachment is required.');
      mo.forEach(f=> p.attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'meeting_outcome',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:'secretariat',uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
      const dueSel=DTRC.$('#secDueAtNA').value; p.dueAt = dueSel? DTRC.localDTToISO(dueSel): (DTRC.addBizDaysAt? DTRC.addBizDaysAt(10,16,30): DTRC.addBizDays(10));
      const plain=DTRC.safePlain(DTRC.$('#remarksNA').innerHTML.trim());
      DTRC.pushTimeline(p, {actor:'sec', stage:'NOT_APPROVED', text:`ARF was not approved. See remark:`, quote: plain? `${plain}` : `Not approved by LT. See meeting outcome. Please advise next steps by ${DTRC.fmtDate(p.dueAt)}.`});
      p.status='NOT_APPROVED'; p.nextActor='pm'; p.unread.pm=true; p.unread.secretariat=false;
      DTRC.$('#remarksNA').innerHTML=''; DTRC.$('#meetingOutcomeNA').value=''; DTRC.$('#tplNA').value='';
      DTRC.notify('Not Approved outcome sent to PM');
    }

    if(val==='LETTER_ISSUED'){
      const files=await DTRC.filesToDataUrls(DTRC.$('#letterFile').files); if(!files.length) return alert('Upload the .msg letter.');
      const bad=files.find(f=>!f.name.toLowerCase().endsWith('.msg')); if(bad) return alert('Only .msg files allowed for the letter.');
      files.forEach(f=> p.attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'letter',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:'secretariat',uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
      const ref=(DTRC.$('#letterRef').value||'').trim(); p.letterRef=ref;
      DTRC.pushTimeline(p, {actor:'sec', stage:'LETTER_ISSUED', text:`Letter issued to user. Ref: ${ref||'N/A'}`});
      p.status='LETTER_ISSUED'; p.nextActor='none'; p.unread.pm=true; p.unread.secretariat=false; p.dueAt=null;
      DTRC.$('#letterFile').value=''; DTRC.$('#letterRef').value='';
      // Notify all PM participants
      if (typeof DTRC.notifyProjectParticipants === 'function') {
        DTRC.notifyProjectParticipants(p, `Letter issued for “${p.name}”${p.letterRef ? ` — Ref: ${p.letterRef}` : ''}.`);
      } else {
        // Fallback: push notices individually
        const emails = new Set();
        if (p.pmBusiness?.email) emails.add(p.pmBusiness.email.toLowerCase());
        if (p.pmTechnical?.email) emails.add(p.pmTechnical.email.toLowerCase());
        (p.members||[]).forEach(m=>m?.email && emails.add(m.email.toLowerCase()));
        emails.forEach(e=> DTRC.addNotice && DTRC.addNotice(e, `Letter issued for “${p.name}”. Ref: ${p.letterRef||'N/A'}`, p.id));
      }
      DTRC.notify('Letter issued — workflow complete');
    }

    projects[idx]=p; if(!DTRC.safeSaveProjects(projects)) return;
    secCurrent=p; refreshSecModalContent(); renderSec();
  };

  // Tabs
  DTRC.$$('#secTabs .nav-link').forEach(a=> a.onclick=(e)=>{ e.preventDefault(); DTRC.$$('#secTabs .nav-link').forEach(x=>x.classList.remove('active')); a.classList.add('active'); secTab=a.getAttribute('data-tab'); renderSec(); });

  const applyF = DTRC.$('#secApplyF'); if(applyF) applyF.onclick = renderSec;
  const clearF = DTRC.$('#secClearF'); if(clearF) clearF.onclick = ()=>{ DTRC.$('#secQ').value=''; DTRC.$('#secStatusF').value=''; renderSec(); };
  const exportAll = DTRC.$('#secExportAll'); if(exportAll) exportAll.onclick = ()=>{ const raw=localStorage.getItem(DTRC.LSK_PROJECTS)||'[]'; const blob=new Blob([raw],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='projects.json'; a.click(); };

  // Roles modal
  const rolesBtn = DTRC.$('#assignRolesBtn');
  if(rolesBtn){ 
    const me=DTRC.getUser();
    if(me?.isAdmin) DTRC.show(rolesBtn);
    rolesBtn.onclick=()=>{ renderRoles(); bootstrap.Modal.getOrCreateInstance('#assignRolesModal').show(); };
  }
  const addRoleBtn = DTRC.$('#addRole'); if(addRoleBtn) addRoleBtn.onclick=()=>{ const email=(DTRC.$('#roleEmail').value||'').trim().toLowerCase(); const type=DTRC.$('#roleType').value; if(!email||!email.includes('@')) return alert('Enter a valid email'); const roles=DTRC.getRoles(); roles[email]=type; DTRC.saveRoles(roles); DTRC.$('#roleEmail').value=''; renderRoles(); };
  
  renderSec();
});

function renderRoles(){
  const roles=DTRC.getRoles();
  const tbody=DTRC.$('#rolesRows'); if(!tbody) return; tbody.innerHTML='';
  Object.entries(roles).forEach(([email,role])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${email}</td><td>${role.toUpperCase()}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger" data-del-role="${email}">Remove</button></td>`;
    tbody.appendChild(tr);
  });
  DTRC.$$('[data-del-role]').forEach(btn=> btn.onclick=()=>{ const email=btn.getAttribute('data-del-role'); const roles=DTRC.getRoles(); delete roles[email]; DTRC.saveRoles(roles); renderRoles(); });
}
