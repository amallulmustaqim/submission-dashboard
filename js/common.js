// Ensure a single global namespace
window.DTRC = window.DTRC || {};

(function () {
  // ===== Keys =====
  DTRC.LSK_FORM     = 'dtrc_submission_form_v2';
  DTRC.LSK_PROJECTS = 'dtrc_projects_v2';
  DTRC.ME_KEY       = 'dtrc_current_user';
  DTRC.ROLES_KEY    = 'dtrc_secretariat_roles';
  DTRC.ADMINS_KEY   = 'dtrc_admins';

  // ===== DOM helpers =====
  DTRC.$  = s => document.querySelector(s);
  DTRC.$$ = s => Array.from(document.querySelectorAll(s));
  DTRC.show = el => el && el.classList.remove('d-none');
  DTRC.hide = el => el && el.classList.add('d-none');

  // ===== Toast/notify =====
  DTRC.toast = null;
  DTRC.notify = (msg)=>{
    try{
      const body = DTRC.$('#toastBody');
      if (body) body.textContent = msg;
      if(!DTRC.toast && DTRC.$('#toast')){
        DTRC.toast = new bootstrap.Toast(DTRC.$('#toast'));
      }
      DTRC.toast && DTRC.toast.show();
    }catch(e){ /* ignore if page has no toast */ }
  };

  // ===== Formatting & time helpers =====
  DTRC.pad = n => (n < 10 ? "0" + n : "" + n);
  DTRC.fmtDate = iso => {
    if (!iso) return "–";
    const d = new Date(iso);
    const h = d.getHours(), m = DTRC.pad(d.getMinutes());
    const hh = h % 12 || 12, ampm = h < 12 ? "AM" : "PM";
    return `${DTRC.pad(d.getDate())}/${DTRC.pad(d.getMonth()+1)}/${d.getFullYear()} (${DTRC.pad(hh)}:${m} ${ampm})`;
  };
  DTRC.isoToLocalDT = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}-${DTRC.pad(d.getMonth()+1)}-${DTRC.pad(d.getDate())}T${DTRC.pad(d.getHours())}:${DTRC.pad(d.getMinutes())}`;
  };
  DTRC.localDTToISO = v => (v ? new Date(v).toISOString() : null);

  // Business days helpers
  // Default due time NOW set to 16:30 (4:30 PM) per requirement
  DTRC.addBizDays = (n) => {
    let d = new Date();
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) n--;
    }
    d.setHours(16, 30, 0, 0);
    return d.toISOString();
  };
  DTRC.addBizDaysAt = (n, hour = 16, minute = 30) => {
    let d = new Date();
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) n--;
    }
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  // ===== Text helpers =====
  DTRC.safePlain = html => {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    return tmp.textContent || tmp.innerText || "";
  };
  DTRC.quoteHtml = str => {
    if (!str) return "";
    return `<div class="quote">"${str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</div>`;
  };

  // ===== Storage / Auth =====
  DTRC.seed = ()=>{
    if(!localStorage.getItem(DTRC.ADMINS_KEY)){
      localStorage.setItem(DTRC.ADMINS_KEY, JSON.stringify(['amallul.latif@egnc.gov.bn']));
    }
    if(!localStorage.getItem(DTRC.ROLES_KEY)){
      localStorage.setItem(DTRC.ROLES_KEY, JSON.stringify({'amallul.latif@egnc.gov.bn':'edit'}));
    }
  };
  DTRC.getAdmins = ()=> JSON.parse(localStorage.getItem(DTRC.ADMINS_KEY)||'[]');
  DTRC.getRoles  = ()=> JSON.parse(localStorage.getItem(DTRC.ROLES_KEY)||'{}');
  DTRC.saveRoles = (obj)=> localStorage.setItem(DTRC.ROLES_KEY, JSON.stringify(obj));
  DTRC.setUser   = (u)=> localStorage.setItem(DTRC.ME_KEY, JSON.stringify(u));
  DTRC.getUser   = ()=>{ const raw=localStorage.getItem(DTRC.ME_KEY); return raw? JSON.parse(raw): null; };
  DTRC.logout    = ()=>{ localStorage.removeItem(DTRC.ME_KEY); location.href='index.html'; };

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

  // ===== Project helpers =====
  DTRC.roleOf = (p,email)=>{
    if(!email) return null;
    if(p.pmBusiness?.email?.toLowerCase()===email.toLowerCase()) return 'PM (Business)';
    if(p.pmTechnical?.email?.toLowerCase()===email.toLowerCase()) return 'PM (Technical)';
    if((p.members||[]).some(m=>m.email?.toLowerCase()===email.toLowerCase())) return 'Team Member';
    return null;
  };
  DTRC.isOverdue = (p)=> p.dueAt && (new Date(p.dueAt)<new Date()) && p.nextActor!=='none';
  DTRC.dueText   = (p)=> p.dueAt? DTRC.fmtDate(p.dueAt): '—';
  DTRC.latestActivityAt = (p)=> (p.timeline&&p.timeline.length)? p.timeline[p.timeline.length-1].at : (p.updatedAt||p.createdAt);

  // Files
  DTRC.filesToDataUrls = async (fileList) => {
    const files = Array.from(fileList || []);
    return Promise.all(files.map(f => new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res({ name:f.name, type:f.type||"", size:f.size||0, dataUrl: fr.result });
      fr.readAsDataURL(f);
    })));
  };
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

  // Unread toggles
  DTRC.toggleUnread = (id,who,flipOnly=false)=>{
    const arr=DTRC.loadProjects(); const idx=arr.findIndex(p=>p.id===id); if(idx<0) return;
    if(who==='pm'){ arr[idx].unread.pm = flipOnly? !arr[idx].unread.pm : !arr[idx].unread.pm; }
    if(who==='secretariat'){ arr[idx].unread.secretariat = flipOnly? !arr[idx].unread.secretariat : !arr[idx].unread.secretariat; }
    arr[idx].updatedAt=new Date().toISOString();
    if(!DTRC.safeSaveProjects(arr)) return;
    DTRC.updateActionBadges();
  };

  // ===== Badges =====
  DTRC.badgeClass = (st)=>({SUBMITTED:'text-bg-primary',FEEDBACK_REQUIRED:'text-bg-warning',APPROVED:'text-bg-success',NOT_APPROVED:'text-bg-danger',LETTER_ISSUED:'text-bg-secondary'}[st]||'text-bg-light');

  // ===== Notifications (localStorage “inbox”) =====
  const NOTICES_KEY = "dtrc_notices";
  const _readNotices  = () => JSON.parse(localStorage.getItem(NOTICES_KEY) || "[]");
  const _writeNotices = (arr) => localStorage.setItem(NOTICES_KEY, JSON.stringify(arr));

  DTRC.addNotice = (to, text, projId) => {
    const arr = _readNotices();
    arr.push({ to:(to||"").toLowerCase(), text, at:new Date().toISOString(), projId:projId||null });
    _writeNotices(arr);
  };
  DTRC.drainNotices = (to) => {
    const arr = _readNotices();
    const mine = arr.filter(n => n.to === (to||"").toLowerCase());
    _writeNotices(arr.filter(n => n.to !== (to||"").toLowerCase()));
    return mine;
  };
  DTRC.notifyProjectParticipants = (p, message) => {
    const emails = new Set();
    if (p.pmBusiness?.email) emails.add(p.pmBusiness.email.toLowerCase());
    if (p.pmTechnical?.email) emails.add(p.pmTechnical.email.toLowerCase());
    (p.members||[]).forEach(m=> m?.email && emails.add(m.email.toLowerCase()));
    emails.forEach(e => DTRC.addNotice(e, message, p.id));
  };

  // ===== Timeline mechanics =====
  DTRC.countUserSubmissions = (p) =>
    (p.timeline || []).filter(e => e.actor === "user" && e.isSubmission).length;

  DTRC.ordinal = (n) => {
    const o = ["th","st","nd","rd"], v = n % 100;
    return n + (o[(v - 20) % 10] || o[v] || o[0]);
  };

  // Push timeline + built-in hooks (auto PM notify on LETTER_ISSUED)
  DTRC.pushTimeline = function pushTimeline(p, entry){
    p.timeline = p.timeline || [];
    const toPush = Object.assign({ at: new Date().toISOString() }, entry);
    p.timeline.push(toPush);
    p.updatedAt = new Date().toISOString();

    // Auto-notify PMs when a letter is issued (no changes needed elsewhere)
    if (toPush.stage === 'LETTER_ISSUED') {
      const ref = p.letterRef ? ` Ref: ${p.letterRef}.` : '';
      DTRC.notifyProjectParticipants(p, `Letter has been issued for "${p.name}".${ref}`);
    }
  };

  // Renderer (supports boolean or options object for 3rd arg)
  // Usage:
  //  - old: DTRC.renderTimeline(el, project, true /*forPM*/)
  //  - new: DTRC.renderTimeline(el, project, {forPM:true, actor:'user'|'sec'|'all', includeInternal:false})
  DTRC.renderTimeline = function(el, project, optsOrForPM){
    let opts;
    if (typeof optsOrForPM === 'object' && optsOrForPM) {
      opts = {
        forPM: !!optsOrForPM.forPM,
        actor: optsOrForPM.actor || 'all',
        includeInternal: !!optsOrForPM.includeInternal
      };
    } else {
      const forPM = !!optsOrForPM;
      // legacy default: Secretariat sees internal, PM does not
      opts = { forPM, actor: 'all', includeInternal: !forPM };
    }

    const items = (project.timeline || [])
      .filter(e => {
        if (opts.actor === 'user' && e.actor !== 'user') return false;
        if (opts.actor === 'sec'  && e.actor !== 'sec')  return false;
        if (e.internal && (opts.forPM || !opts.includeInternal)) return false;
        return true;
      })
      .map(e => {
        const when = DTRC.fmtDate(e.at);
        const actorBadge =
          e.actor === 'sec'  ? `<span class="badge text-bg-primary">SEC</span>` :
          e.actor === 'user' ? `<span class="badge text-bg-info">USER</span>` :
                               `<span class="badge text-bg-secondary">SYS</span>`;
        const stageBadge    = e.stage    ? ` <span class="badge text-bg-light border">${e.stage}</span>` : '';
        const internalBadge = e.internal ? ` <span class="badge text-bg-warning">INTERNAL</span>` : '';
        const text  = e.text || '';
        const quote = e.quote
          ? `<div class="quote">"${e.quote.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</div>`
          : '';
        return `<li>${when} — ${actorBadge}${stageBadge}${internalBadge} ${text}${quote}</li>`;
      });

    el.innerHTML = items.length ? items.join('') : '<li class="text-muted">No events</li>';
  };

  // ===== Header widgets / counts =====
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
    const me=DTRC.getUser(), el=DTRC.$('#pmMyCount'); if(!el) return;
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

  // ===== Auth guard =====
  DTRC.guardAuth = (opts={})=>{
    const me=DTRC.getUser();
    if(!me){
      if(location.pathname.split('/').pop() !== 'index.html'){
        location.href='index.html';
      }
      return;
    }
    if(opts.requireSecretariat){
      if(!(me.isSecretariat)){
        alert('Not authorized for Secretariat console.');
        location.href='pm.html';
        return;
      }
    }
    const secLink = DTRC.$('#secLink');
    if(secLink){
      if(me.isSecretariat || me.isAdmin){ /* keep visible */ }
      else { secLink.classList.add('disabled'); secLink.href = '#'; }
    }
    DTRC.updateWhoAmI();
  };

  // ===== Common UI wiring =====
  document.addEventListener('DOMContentLoaded', ()=>{
    DTRC.seed();
    DTRC.updateWhoAmI();
    DTRC.updateActionBadges();

    const clearBtn = DTRC.$('#clearStorageBtn'); if(clearBtn) clearBtn.onclick = DTRC.clearAll;
    const logoutBtn= DTRC.$('#logoutBtn'); if(logoutBtn) logoutBtn.onclick = DTRC.logout;

    // small nicety: space badges in timeline
    const style = document.createElement('style');
    style.textContent = `
      #pmViewTimeline .badge, #pmTimeline .badge, #secTimeline .badge { margin-right: .25rem; }
    `;
    document.head.appendChild(style);

    setInterval(DTRC.updateActionBadges, 5000);
  });

})();
