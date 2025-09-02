// Namespace
window.DTRC = window.DTRC || {};

// ===== Keys =====
DTRC.LSK_FORM = 'dtrc_submission_form_v2';
DTRC.LSK_PROJECTS = 'dtrc_projects_v2';
DTRC.ME_KEY = 'dtrc_current_user';
DTRC.ROLES_KEY = 'dtrc_secretariat_roles';
DTRC.ADMINS_KEY = 'dtrc_admins';

// ===== DOM helpers =====
DTRC.$ = (s)=>document.querySelector(s);
DTRC.$$= (s)=>Array.from(document.querySelectorAll(s));
DTRC.show = (el)=> el && el.classList.remove('d-none');
DTRC.hide = (el)=> el && el.classList.add('d-none');

DTRC.toast = null;
DTRC.notify = (msg)=>{
  try {
    DTRC.$('#toastBody').textContent = msg;
    if(!DTRC.toast){
      DTRC.toast = new bootstrap.Toast(DTRC.$('#toast'));
    }
    DTRC.toast.show();
  } catch(e){ /* ignore in pages without toast */ }
};

DTRC.badgeClass = (st)=>({SUBMITTED:'text-bg-primary',FEEDBACK_REQUIRED:'text-bg-warning',APPROVED:'text-bg-success',NOT_APPROVED:'text-bg-danger',LETTER_ISSUED:'text-bg-secondary'}[st]||'text-bg-light');
DTRC.pad = (n)=>n<10?'0'+n:n;
DTRC.fmtDate = (iso)=>{
  if(!iso) return '–';
  const d = new Date(iso);
  let h=d.getHours(),m=DTRC.pad(d.getMinutes());
  const am=h<12; const hh=h%12||12; const ampm=am?'AM':'PM';
  return `${DTRC.pad(d.getDate())}/${DTRC.pad(d.getMonth()+1)}/${d.getFullYear()} (${DTRC.pad(hh)}:${m} ${ampm})`;
};
DTRC.addBizDays = (n)=>{ let d=new Date(); while(n>0){ d.setDate(d.getDate()+1); const day=d.getDay(); if(day!==0&&day!==6) n--; } d.setHours(17,0,0,0); return d.toISOString(); };
DTRC.isoToLocalDT = (iso)=>{ if(!iso) return ''; const d=new Date(iso); return `${d.getFullYear()}-${DTRC.pad(d.getMonth()+1)}-${DTRC.pad(d.getDate())}T${DTRC.pad(d.getHours())}:${DTRC.pad(d.getMinutes())}`; };
DTRC.localDTToISO = (v)=> v? new Date(v).toISOString(): null;

DTRC.safePlain = (html)=>{
  if(!html) return '';
  const tmp=document.createElement('div'); tmp.innerHTML=html;
  tmp.querySelectorAll('br').forEach(br=> br.replaceWith('\n'));
  return tmp.textContent || tmp.innerText || '';
};
DTRC.quoteHtml = (str)=>{
  if(!str) return '';
  return `<div class="quote">"${str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</div>`;
};
DTRC.humanLine = (e,forPM=false)=>{
  if(forPM && e.internal) return null;
  const when=DTRC.fmtDate(e.at);
  const who = e.actor==='sec'?'(sec)':e.actor==='user'?'(user)':'(system)';
  const stage = e.stage? `(${e.stage})` : '';
  const internal = e.internal? ' (INTERNAL)' : '';
  let base = `${when} — ${who}${stage}${internal} ${e.text||''}`;
  if(e.quote) base += DTRC.quoteHtml(e.quote);
  return `<li>${base}</li>`;
};
DTRC.renderTimeline = (el, p, forPM=false)=>{
  const items = (p.timeline||[]).map(e=> DTRC.humanLine(e,forPM)).filter(Boolean);
  el.innerHTML = items.length? items.join('') : '<li class="text-muted">No events</li>';
};

// ===== Storage / Auth =====
DTRC.seed = ()=>{
  if(!localStorage.getItem(DTRC.ADMINS_KEY)){ localStorage.setItem(DTRC.ADMINS_KEY, JSON.stringify(['amallul.latif@egnc.gov.bn'])); }
  if(!localStorage.getItem(DTRC.ROLES_KEY)){ localStorage.setItem(DTRC.ROLES_KEY, JSON.stringify({'amallul.latif@egnc.gov.bn':'edit'})); }
};
DTRC.getAdmins = ()=> JSON.parse(localStorage.getItem(DTRC.ADMINS_KEY)||'[]');
DTRC.getRoles = ()=> JSON.parse(localStorage.getItem(DTRC.ROLES_KEY)||'{}');
DTRC.saveRoles = (obj)=> localStorage.setItem(DTRC.ROLES_KEY, JSON.stringify(obj));
DTRC.setUser = (u)=> localStorage.setItem(DTRC.ME_KEY, JSON.stringify(u));
DTRC.getUser = ()=>{ const raw=localStorage.getItem(DTRC.ME_KEY); return raw? JSON.parse(raw): null; };
DTRC.logout = ()=>{ localStorage.removeItem(DTRC.ME_KEY); location.href='index.html'; };

DTRC.clearAll = ()=>{
  if(!confirm('This will clear cached submissions, roles, and sessions. Continue?')) return;
  localStorage.removeItem(DTRC.LSK_FORM);
  localStorage.removeItem(DTRC.LSK_PROJECTS);
  localStorage.removeItem(DTRC.ME_KEY);
  localStorage.removeItem(DTRC.ROLES_KEY);
  location.reload();
};

DTRC.loadProjects = ()=> JSON.parse(localStorage.getItem(DTRC.LSK_PROJECTS)||'[]');
DTRC.safeSaveProjects = (arr)=>{
  try{ localStorage.setItem(DTRC.LSK_PROJECTS, JSON.stringify(arr)); return true; }
  catch(e){ alert('Could not save (localStorage limit). Try clearing storage or fewer/lighter files.'); return false; }
};

DTRC.roleOf = (p,email)=>{
  if(!email) return null;
  if(p.pmBusiness?.email?.toLowerCase()===email.toLowerCase()) return 'PM (Business)';
  if(p.pmTechnical?.email?.toLowerCase()===email.toLowerCase()) return 'PM (Technical)';
  if((p.members||[]).some(m=>m.email?.toLowerCase()===email.toLowerCase())) return 'Team Member';
  return null;
};
DTRC.isOverdue = (p)=> p.dueAt && (new Date(p.dueAt)<new Date()) && p.nextActor!=='none';
DTRC.dueText = (p)=> p.dueAt? DTRC.fmtDate(p.dueAt): '—';
DTRC.latestActivityAt = (p)=> (p.timeline&&p.timeline.length)? p.timeline[p.timeline.length-1].at : (p.updatedAt||p.createdAt);

DTRC.listFiles = (items)=>{
  if(!items?.length) return '<li class="text-muted">No files</li>';
  return items.map(a=>`<li class="file-actions">[${a.kind}] <a href="${a.objectUrl||a.dataUrl||'#'}" download="${a.filename}" target="_blank">${a.filename}</a> — ${DTRC.fmtDate(a.uploadedAt)}</li>`).join('');
};
DTRC.latestAndArchive = (attachments)=>{
  const nonLetters=(attachments||[]).filter(a=>a.kind!=='letter');
  if(!nonLetters.length) return {latest:null,archive:[]};
  const sorted=[...nonLetters].sort((a,b)=> new Date(b.uploadedAt)-new Date(a.uploadedAt));
  return {latest:sorted[0], archive:sorted.slice(1)};
};

DTRC.toggleUnread = (id,who,flipOnly=false)=>{
  const arr=DTRC.loadProjects(); const idx=arr.findIndex(p=>p.id===id); if(idx<0) return;
  if(who==='pm'){ arr[idx].unread.pm = flipOnly? !arr[idx].unread.pm : !arr[idx].unread.pm; }
  if(who==='secretariat'){ arr[idx].unread.secretariat = flipOnly? !arr[idx].unread.secretariat : !arr[idx].unread.secretariat; }
  arr[idx].updatedAt=new Date().toISOString();
  if(!DTRC.safeSaveProjects(arr)) return;
  DTRC.updateActionBadges();
};

// ===== Common UI wiring (runs on every page) =====
DTRC.updateWhoAmI = ()=>{
  const me = DTRC.getUser();
  const el = DTRC.$('#whoami');
  if(!el) return;
  if(me){
    el.textContent = me.email + (me.isSecretariat? ` (Sec:${me.secRole}${me.isAdmin?', Admin':''})`: me.isAdmin?' (Admin)':'');
  } else {
    el.textContent = '–';
  }
};

DTRC.renderPMCounts = ()=>{
  const me=DTRC.getUser();
  const el=DTRC.$('#pmMyCount'); if(!el) return;
  const projects=DTRC.loadProjects().filter(p=> !!DTRC.roleOf(p,me?.email));
  const my=projects.filter(p=> p.nextActor==='pm').length;
  if(my>0){ el.textContent=my; el.style.display='inline-block'; } else el.style.display='none';
};
DTRC.renderSecCounts = ()=>{
  const el=DTRC.$('#secMyCount'); if(!el) return;
  const my=DTRC.loadProjects().filter(p=> p.nextActor==='secretariat').length;
  if(my>0){ el.textContent=my; el.style.display='inline-block'; } else el.style.display='none';
};
DTRC.updateActionBadges = ()=>{ DTRC.renderPMCounts(); DTRC.renderSecCounts(); };

DTRC.guardAuth = (opts={})=>{
  const me=DTRC.getUser();
  if(!me){
    // not logged in
    if(location.pathname.split('/').pop() !== 'index.html'){
      location.href='index.html';
    }
    return;
  }
  // restrict Secretariat page if not authorized
  if(opts.requireSecretariat){
    if(!(me.isSecretariat)){
      alert('Not authorized for Secretariat console.');
      location.href='pm.html';
      return;
    }
  }
  // show/hide Secretariat link visibility based on role
  const secLink = DTRC.$('#secLink');
  if(secLink){
    if(me.isSecretariat || me.isAdmin){ /* keep visible */ }
    else { secLink.classList.add('disabled'); secLink.href = '#'; }
  }
  DTRC.updateWhoAmI();
};

// Common buttons
document.addEventListener('DOMContentLoaded', ()=>{
  DTRC.seed();
  DTRC.updateWhoAmI();
  DTRC.updateActionBadges();
  const clearBtn = DTRC.$('#clearStorageBtn');
  if(clearBtn) clearBtn.onclick = DTRC.clearAll;
  const logoutBtn = DTRC.$('#logoutBtn');
  if(logoutBtn) logoutBtn.onclick = DTRC.logout;
  setInterval(DTRC.updateActionBadges, 5000);
});
