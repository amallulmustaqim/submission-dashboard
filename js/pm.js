// PM page logic (enhanced: drain notices, timeline filters/badges)
let pmFiltered=[], pmTab='mine', pmCurrent=null;

// small wrapper for timeline rendering (new opts vs old boolean signature)
function _renderTL(el, proj, opts){
  try { return DTRC.renderTimeline(el, proj, opts); }
  catch(e){ return DTRC.renderTimeline(el, proj, !!(opts?.forPM)); }
}

function applyPMFilters(){
  const me=DTRC.getUser(); const projects=DTRC.loadProjects();
  const q=(DTRC.$('#pmQ')?.value||'').trim().toLowerCase(); const st=DTRC.$('#pmStatusF')?.value||'';
  let list=projects.filter(p=> !!DTRC.roleOf(p,me?.email));
  if(q) list=list.filter(p=> (`${p.name} ${p.department} ${p.ministry}`).toLowerCase().includes(q));
  if(st) list=list.filter(p=> p.status===st);
  if(pmTab==='mine') list=list.filter(p=> p.nextActor==='pm');
  if(pmTab==='waiting') list=list.filter(p=> p.nextActor==='secretariat');
  if(pmTab==='completed') list=list.filter(p=> p.status==='LETTER_ISSUED');
  if(pmTab==='mine') list.sort((a,b)=> new Date(a.dueAt||'9999') - new Date(b.dueAt||'9999'));
  else list.sort((a,b)=> new Date(DTRC.latestActivityAt(b)) - new Date(DTRC.latestActivityAt(a)));
  pmFiltered=list;
}
function actorLabelForPM(p){ if(p.nextActor==='pm') return 'You'; if(p.nextActor==='secretariat') return `Secretariat${p.secOwner? ' ('+p.secOwner+')':''}`; return 'None'; }
function rowClassPM(p){ if(p.nextActor==='pm'&&DTRC.isOverdue(p)) return 'table-danger row-own'; if(p.nextActor==='pm') return 'table-warning row-own'; return ''; }

function renderPM(){
  // Drain notifications once per page load
  if (!window.__dtrcNotesDrained) {
    try {
      const me = DTRC.getUser();
      if (me?.email && typeof DTRC.drainNotices === 'function') {
        const notes = DTRC.drainNotices(me.email);
        notes.forEach(n => (DTRC.notify ? DTRC.notify(n.text) : alert(n.text)));
      }
    } catch(e) { /* no-op */ }
    window.__dtrcNotesDrained = true;
  }

  DTRC.updateActionBadges(); applyPMFilters();
  const tbody=DTRC.$('#pmRows'); if(!tbody) return; tbody.innerHTML='';
  pmFiltered.forEach(p=>{
    const me=DTRC.getUser(); const role=DTRC.roleOf(p,me?.email)||'-';
    let action='—';
    if(p.nextActor==='pm' && (p.status==='FEEDBACK_REQUIRED'||p.status==='APPROVED'||p.status==='NOT_APPROVED')) action=`<button class="btn btn-sm btn-outline-primary" data-pm-edit="${p.id}">Open Action</button>`;
    if(p.status==='LETTER_ISSUED') action=`<button class="btn btn-sm btn-outline-success" data-view-letter="${p.id}">View Letter</button>`;
    const unreadDot=p.unread?.pm? `<span class="dot cursor-pointer" data-toggle-pm-unread="${p.id}" title="Click to mark read/unread"></span>`:'';
    const letterLine = p.letterRef? `<div class="small text-muted">${p.letterRef}</div>` : '';
    const tr=document.createElement('tr'); tr.className=rowClassPM(p);
    tr.innerHTML=`
      <td><a href="#" data-pm-view="${p.id}">${p.name}</a> ${unreadDot}${letterLine}</td>
      <td>${p.department||'-'}</td>
      <td>${p.ministry||'-'}</td>
      <td>${role}</td>
      <td><span class="badge ${DTRC.badgeClass(p.status)}">${p.status}</span></td>
      <td>${actorLabelForPM(p)}</td>
      <td>${DTRC.dueText(p)}</td>
      <td>${DTRC.fmtDate(DTRC.latestActivityAt(p))}</td>
      <td>${action}</td>
    `;
    tbody.appendChild(tr);
  });
  DTRC.$$('[data-pm-view]').forEach(a=> a.onclick=(e)=>{ e.preventDefault(); openPMView(a.getAttribute('data-pm-view')); });
  DTRC.$$('[data-pm-edit]').forEach(btn=> btn.onclick=()=> openPMEdit(btn.getAttribute('data-pm-edit')));
  DTRC.$$('[data-view-letter]').forEach(btn=> btn.onclick=()=> viewLetter(btn.getAttribute('data-view-letter')));
  DTRC.$$('[data-toggle-pm-unread]').forEach(dot=> dot.onclick=()=> DTRC.toggleUnread(dot.getAttribute('data-toggle-pm-unread'),'pm'));
}

const pmViewModal = ()=> bootstrap.Modal.getOrCreateInstance('#pmViewModal');
const pmEditModal = ()=> bootstrap.Modal.getOrCreateInstance('#pmEditModal');

function openPMView(id){
  const projects=DTRC.loadProjects(); const p=projects.find(x=>x.id===id); if(!p) return;
  p.seen.pmAt=new Date().toISOString(); p.unread.pm=false; DTRC.safeSaveProjects(projects);
  DTRC.$('#pmViewTitle').textContent=p.name;
  DTRC.$('#pmViewMeta').textContent=`Status: ${p.status} • Dept: ${p.department} • Ministry: ${p.ministry} • Latest: ${DTRC.fmtDate(DTRC.latestActivityAt(p))}`;
  const banner = p.nextActor==='none' ? `Complete — Letter issued` : `Awaiting: <b>${p.nextActor==='pm'?'PM':'Secretariat'}</b>${p.secOwner && p.nextActor==='secretariat' ? ' ('+p.secOwner+')':''} • Due: <b>${DTRC.dueText(p)}</b>${DTRC.isOverdue(p)?' — <span class="text-danger">Overdue</span>':''}`;
  DTRC.$('#pmViewBanner').innerHTML=banner;
  const owners=`PM(B): ${p.pmBusiness?.name||'-'} (${p.pmBusiness?.email||'-'})`+(p.pmTechnical?.email?` | PM(T): ${p.pmTechnical?.name||'-'} (${p.pmTechnical?.email})`:'')+(p.members?.length?` | Team: ${p.members.map(m=>`${m.name||m.email} (${m.email})`).join('; ')}`:'');
  DTRC.$('#pmViewOwners').textContent=owners||'—';
  const types=`${p.mainType||'-'}; Other: ${(p.otherTypes||[]).join(', ')||'-'} ${p.sharedServices?.length? ' | EGNC SS: '+p.sharedServices.join(', '):''}`;
  DTRC.$('#pmViewTypes').textContent=types;
  DTRC.$('#pmViewFiles').innerHTML=DTRC.listFiles(p.attachments);

  // Inject controls once (PM cannot see internal; checkbox disabled)
  if (!document.getElementById('pmViewTLControls')) {
    const h6 = document.querySelector('#pmViewTimeline')?.previousElementSibling;
    const div = document.createElement('div');
    div.id = 'pmViewTLControls';
    div.className = 'd-flex align-items-center gap-2 mb-2';
    div.innerHTML = `
      <select id="pmViewTLActor" class="form-select form-select-sm" style="max-width:180px">
        <option value="all">All actors</option>
        <option value="user">User only</option>
        <option value="sec">Secretariat only</option>
      </select>
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="pmViewTLShowInternal" disabled>
        <label class="form-check-label" for="pmViewTLShowInternal" title="Secretariat-only">Show internal</label>
      </div>`;
    h6?.after(div);
    document.getElementById('pmViewTLActor').onchange = () => _renderTL(document.getElementById('pmViewTimeline'), p, { forPM:true, actor: document.getElementById('pmViewTLActor').value, includeInternal:false });
  }
  _renderTL(document.getElementById('pmViewTimeline'), p, { forPM:true, actor: document.getElementById('pmViewTLActor')?.value || 'all', includeInternal:false });

  const btnRU = DTRC.$('#pmMarkRU'); if(btnRU) btnRU.onclick=()=>{ DTRC.toggleUnread(p.id,'pm',true); openPMView(p.id); };
  pmViewModal().show(); renderPM();
}

function openPMEdit(id){
  const projects=DTRC.loadProjects(); pmCurrent=projects.find(p=>p.id===id); if(!pmCurrent) return;
  pmCurrent.seen.pmAt=new Date().toISOString(); pmCurrent.unread.pm=false; DTRC.safeSaveProjects(projects);
  DTRC.$('#pmEditTitle').textContent=pmCurrent.name;
  DTRC.$('#pmEditMeta').textContent=`Status: ${pmCurrent.status} • Dept: ${pmCurrent.department} • Ministry: ${pmCurrent.ministry} • Latest: ${DTRC.fmtDate(DTRC.latestActivityAt(pmCurrent))}`;
  const banner = pmCurrent.nextActor==='none' ? `Complete — Letter issued` : `Awaiting: <b>${pmCurrent.nextActor==='pm'?'PM':'Secretariat'}</b> • Due: <b>${DTRC.dueText(pmCurrent)}</b>${DTRC.isOverdue(pmCurrent)?' — <span class="text-danger">Overdue</span>':''}`;
  DTRC.$('#pmEditBanner').innerHTML=banner;
  const isFR=pmCurrent.status==='FEEDBACK_REQUIRED', isAP=pmCurrent.status==='APPROVED', isNA=pmCurrent.status==='NOT_APPROVED';
  DTRC.$('#pmFRBlock').style.display=isFR?'':'none';
  DTRC.$('#pmApprovedBlock').style.display=isAP?'':'none';
  DTRC.$('#pmNABlock').style.display=isNA?'':'none';

  if(isFR){
    const lastSec=[...(pmCurrent.timeline||[])].reverse().find(t=>t.actor==='sec' && t.stage==='FEEDBACK_REQUIRED');
    DTRC.$('#pmFRRemark').innerHTML= lastSec? (DTRC.quoteHtml(lastSec.quote||DTRC.safePlain(lastSec.text||'')).replace(/^<div class="quote">/,'').replace(/<\/div>$/,'')) :'—';
    const parts=DTRC.latestAndArchive(pmCurrent.attachments||[]); DTRC.$('#pmFRLatest').innerHTML=parts.latest? DTRC.listFiles([parts.latest]):'<li class="text-muted">None</li>'; DTRC.$('#pmFRArchive').innerHTML=parts.archive.length? DTRC.listFiles(parts.archive):'<li class="text-muted">None</li>'; DTRC.$('#pmUpdateNotes').innerHTML=''; DTRC.$('#pmFRUpload').value='';
  }
  if(isAP){
    const lastSec=[...(pmCurrent.timeline||[])].reverse().find(t=>t.actor==='sec' && t.stage==='APPROVED');
    DTRC.$('#pmRemarksRO').innerHTML= lastSec? DTRC.quoteHtml(lastSec.quote||DTRC.safePlain(lastSec.text||'')) :'—';
    const parts=DTRC.latestAndArchive(pmCurrent.attachments||[]); DTRC.$('#pmAPLatest').innerHTML=parts.latest? DTRC.listFiles([parts.latest]):'<li class="text-muted">None</li>'; DTRC.$('#pmAPArchive').innerHTML=parts.archive.length? DTRC.listFiles(parts.archive):'<li class="text-muted">None</li>'; DTRC.$('#pmAPUpload').value=''; DTRC.$('#pmReply').innerHTML='';
  }
  if(isNA){
    const lastSec=[...(pmCurrent.timeline||[])].reverse().find(t=>t.actor==='sec' && t.stage==='NOT_APPROVED');
    DTRC.$('#pmNARemarksRO').innerHTML= lastSec? DTRC.quoteHtml(lastSec.quote||DTRC.safePlain(lastSec.text||'')) :'—';
    const parts=DTRC.latestAndArchive(pmCurrent.attachments||[]); DTRC.$('#pmNALatest').innerHTML=parts.latest? DTRC.listFiles([parts.latest]):'<li class="text-muted">None</li>'; DTRC.$('#pmNAArchive').innerHTML=parts.archive.length? DTRC.listFiles(parts.archive):'<li class="text-muted">None</li>'; DTRC.$('#pmNAUpload').value=''; DTRC.$('#pmNAReply').innerHTML='';
  }

  // Inject timeline filter controls (PM cannot see internal)
  if (!document.getElementById('pmEditTLControls')) {
    const h6 = document.querySelector('#pmTimeline')?.previousElementSibling;
    const div = document.createElement('div');
    div.id = 'pmEditTLControls';
    div.className = 'd-flex align-items-center gap-2 mb-2';
    div.innerHTML = `
      <select id="pmEditTLActor" class="form-select form-select-sm" style="max-width:180px">
        <option value="all">All actors</option>
        <option value="user">User only</option>
        <option value="sec">Secretariat only</option>
      </select>
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="pmEditTLShowInternal" disabled>
        <label class="form-check-label" for="pmEditTLShowInternal" title="Secretariat-only">Show internal</label>
      </div>`;
    h6?.after(div);
    document.getElementById('pmEditTLActor').onchange = () => {
      _renderTL(document.getElementById('pmTimeline'), pmCurrent, { forPM:true, actor: document.getElementById('pmEditTLActor').value, includeInternal:false });
    };
  }
  _renderTL(document.getElementById('pmTimeline'), pmCurrent, { forPM:true, actor: document.getElementById('pmEditTLActor')?.value || 'all', includeInternal:false });

  const btnRU = DTRC.$('#pmEditMarkRU'); if(btnRU) btnRU.onclick=()=>{ DTRC.toggleUnread(pmCurrent.id,'pm',true); openPMEdit(pmCurrent.id); };
  pmEditModal().show(); renderPM();
}

async function savePMEdit(){
  if(!pmCurrent) return; const projects=DTRC.loadProjects(); const idx=projects.findIndex(x=>x.id===pmCurrent.id); if(idx<0) return;
  const me=DTRC.getUser()?.email||'pm';

  if(projects[idx].status==='FEEDBACK_REQUIRED'){
    if(!confirm('Submit updates back to Secretariat? Status will change to SUBMITTED and assign to Secretariat.')) return;
    const files=await DTRC.filesToDataUrls(DTRC.$('#pmFRUpload').files);
    files.forEach(f=> projects[idx].attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'pm_update',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:me,uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
    const noteHtml=DTRC.$('#pmUpdateNotes').innerHTML.trim(); const notePlain=DTRC.safePlain(noteHtml);
    const cycle = DTRC.countUserSubmissions(projects[idx]) + 1;
    DTRC.pushTimeline(projects[idx], {actor:'user', stage:'FEEDBACK_REQUIRED', isSubmission:true, cycle, text:`${DTRC.ordinal(cycle)} ${projects[idx].formType} submission from ${me}. See update notes:`, quote: notePlain || undefined });
    projects[idx].prevStatus=projects[idx].status; projects[idx].status='SUBMITTED'; projects[idx].nextActor='secretariat'; projects[idx].unread.secretariat=true; projects[idx].unread.pm=false; projects[idx].dueAt=DTRC.addBizDays(3);
    if(!DTRC.safeSaveProjects(projects)) return; bootstrap.Modal.getInstance('#pmEditModal').hide(); renderPM(); DTRC.notify('Sent to Secretariat'); return;
  }

  if(projects[idx].status==='APPROVED'){
    const files=await DTRC.filesToDataUrls(DTRC.$('#pmAPUpload').files);
    const replyHtml=DTRC.$('#pmReply').innerHTML.trim(); const replyPlain=DTRC.safePlain(replyHtml);
    files.forEach(f=> projects[idx].attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'pm_update_after_approval',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:me,uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
    const cycle = DTRC.countUserSubmissions(projects[idx]) + 1;
    DTRC.pushTimeline(projects[idx], {actor:'user', stage:'APPROVED', isSubmission:true, cycle, text:`${DTRC.ordinal(cycle)} ${projects[idx].formType} submission from ${me}. See Remark:`, quote: replyPlain || undefined});
    projects[idx].nextActor='secretariat'; projects[idx].unread.secretariat=true; projects[idx].unread.pm=false; projects[idx].dueAt=DTRC.addBizDays(3);
    if(!DTRC.safeSaveProjects(projects)) return; bootstrap.Modal.getInstance('#pmEditModal').hide(); renderPM(); DTRC.notify('Reply sent to Secretariat'); return;
  }

  if(projects[idx].status==='NOT_APPROVED'){
    const files=await DTRC.filesToDataUrls(DTRC.$('#pmNAUpload').files);
    const replyHtml=DTRC.$('#pmNAReply').innerHTML.trim(); const replyPlain=DTRC.safePlain(replyHtml);
    files.forEach(f=> projects[idx].attachments.push({id:'A'+Math.random().toString(36).slice(2,8),kind:'pm_update_after_not_approved',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:me,uploadedAt:new Date().toISOString(),dataUrl:f.dataUrl}));
    const cycle = DTRC.countUserSubmissions(projects[idx]) + 1;
    DTRC.pushTimeline(projects[idx], {actor:'user', stage:'NOT_APPROVED', isSubmission:true, cycle, text:`${DTRC.ordinal(cycle)} ${projects[idx].formType} submission from ${me}. See Remark:`, quote: replyPlain || undefined});
    projects[idx].nextActor='secretariat'; projects[idx].unread.secretariat=true; projects[idx].unread.pm=false; projects[idx].dueAt=DTRC.addBizDays(3);
    if(!DTRC.safeSaveProjects(projects)) return; bootstrap.Modal.getInstance('#pmEditModal').hide(); renderPM(); DTRC.notify('Reply sent to Secretariat'); return;
  }
}
function viewLetter(id){
  const p=DTRC.loadProjects().find(x=>x.id===id); if(!p) return;
  const letters=(p.attachments||[]).filter(a=>a.kind==='letter');
  if(!letters.length) return alert('No letter found.');
  const refLine = `<div class="mb-2"><b>Letter Reference No.:</b> ${p.letterRef||'—'}</div>`;
  const list = `<ul class="small">${letters.map(a=>`<li><a href="${a.dataUrl||'#'}" download="${a.filename}" target="_blank">${a.filename}</a> — ${DTRC.fmtDate(a.uploadedAt)}</li>`).join('')}</ul>`;
  DTRC.$('#modalTitle').textContent='Letter(s)';
  DTRC.$('#modalBody').innerHTML=refLine+list;
  bootstrap.Modal.getOrCreateInstance('#modal').show();
}

document.addEventListener('DOMContentLoaded', ()=>{
  DTRC.guardAuth({}); // must be logged
  // Tabs
  DTRC.$$('#pmTabs .nav-link').forEach(a=> a.onclick=(e)=>{ e.preventDefault(); DTRC.$$('#pmTabs .nav-link').forEach(x=>x.classList.remove('active')); a.classList.add('active'); pmTab=a.getAttribute('data-tab'); renderPM(); });
  // Buttons
  const applyF = DTRC.$('#pmApplyF'); if(applyF) applyF.onclick = renderPM;
  const clearF = DTRC.$('#pmClearF'); if(clearF) clearF.onclick = ()=>{ DTRC.$('#pmQ').value=''; DTRC.$('#pmStatusF').value=''; renderPM(); };
  const exportAll = DTRC.$('#pmExportAll'); if(exportAll) exportAll.onclick = ()=>{ const raw=localStorage.getItem(DTRC.LSK_PROJECTS)||'[]'; const blob=new Blob([raw],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='projects.json'; a.click(); };
  const saveBtn = DTRC.$('#pmSaveEdit'); if(saveBtn) saveBtn.onclick = savePMEdit;
  renderPM();
});
