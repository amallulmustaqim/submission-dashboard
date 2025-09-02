// js/secretariat.js
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    // ===== Guard: required globals from common.js
    if (typeof $ !== 'function' || typeof loadProjects !== 'function') {
      console.error('common.js not loaded or loaded after secretariat.js');
      return;
    }

    // ===== Permissions
    const userCanEditSec = () => {
      const me = getUser();
      return !!(me?.isAdmin || (me?.isSecretariat && me?.secRole === 'edit'));
    };

    // ===== State
    let secFiltered = [], secTab = 'mine', secCurrent = null;
    const secModal = bootstrap.Modal.getOrCreateInstance('#secDetailModal');

    // ===== Helpers
    const deriveFocus = (p) => {
      const last = (p.timeline || []).slice(-1)[0];
      if (p.status === 'LETTER_ISSUED') return 'Completed — Letter issued';
      if (p.nextActor === 'secretariat') {
        if (p.status === 'SUBMITTED') {
          const cameFromFR = p.prevStatus === 'FEEDBACK_REQUIRED' ||
            (p.timeline || []).some(e => e.actor === 'user' && e.stage === 'FEEDBACK_REQUIRED' && e.isSubmission && e === last);
          return cameFromFR ? 'PM submitted updates — review required' : 'New submission — review pending';
        }
        if (p.status === 'APPROVED') return 'PM replied to approval — review required';
        if (p.status === 'NOT_APPROVED') return 'PM replied to meeting outcome — review required';
        return 'Awaiting Secretariat action';
      }
      if (p.nextActor === 'pm') {
        if (p.status === 'FEEDBACK_REQUIRED') return 'Feedback requested — PM to upload updates';
        if (p.status === 'APPROVED') return 'Approved with conditions — provide reply/update';
        if (p.status === 'NOT_APPROVED') return 'Not approved — respond to meeting outcome';
        return 'Awaiting PM action';
      }
      return '—';
    };
    const actorLabelForSec = (p) =>
      p.nextActor === 'secretariat'
        ? `You${p.secOwner ? ' (' + p.secOwner + ')' : ''}`
        : p.nextActor === 'pm'
          ? `PM (${p.pmBusiness?.name || p.pmBusiness?.email || '-'})`
          : 'None';
    const rowClassSec = (p) =>
      (p.nextActor === 'secretariat' && isOverdue(p)) ? 'table-danger row-own'
        : (p.nextActor === 'secretariat') ? 'table-warning row-own'
        : '';

    function applySecFilters() {
      const projects = loadProjects();
      const q = ($('#secQ').value || '').trim().toLowerCase();
      const st = $('#secStatusF').value;
      const me = getUser();
      let list = projects;
      if (q) list = list.filter(p => (`${p.name} ${p.department} ${p.ministry}`).toLowerCase().includes(q));
      if (st) list = list.filter(p => p.status === st);
      if (secTab === 'mine') list = list.filter(p => p.nextActor === 'secretariat');
      if (secTab === 'assigned') list = list.filter(p => (p.secOwner || '').toLowerCase() === (me?.email || '').toLowerCase());
      if (secTab === 'waiting') list = list.filter(p => p.nextActor === 'pm');
      if (secTab === 'completed') list = list.filter(p => p.status === 'LETTER_ISSUED');
      if (secTab === 'mine') list.sort((a,b)=> new Date(a.dueAt||'9999') - new Date(b.dueAt||'9999'));
      else list.sort((a,b)=> new Date((b.timeline?.slice(-1)[0]?.at)||b.updatedAt||0) - new Date((a.timeline?.slice(-1)[0]?.at)||a.updatedAt||0));
      secFiltered = list;
    }

    function renderSecCounts() {
      const projects = loadProjects();
      const my = projects.filter(p => p.nextActor === 'secretariat').length;
      const el = $('#secMyCount');
      if (!el) return;
      if (my > 0) { el.textContent = my; el.style.display = 'inline-block'; }
      else el.style.display = 'none';
    }

    function renderSec() {
      renderSecCounts(); applySecFilters();
      const tbody = $('#secRows'); if (!tbody) return;
      tbody.innerHTML = '';
      secFiltered.forEach((p, i) => {
        const unreadDot = p.unread?.secretariat ? `<span class="dot cursor-pointer" data-toggle-sec-unread="${p.id}" title="Click to mark read/unread"></span>` : '';
        const letterLine = p.letterRef ? `<div class="small text-muted">${p.letterRef}</div>` : '';
        const tr = document.createElement('tr'); tr.className = rowClassSec(p);
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${p.name} ${unreadDot}${letterLine}</td>
          <td>${p.department||'-'}</td>
          <td>${p.ministry||'-'}</td>
          <td>${p.mainType||'-'}</td>
          <td><span class="badge ${badgeClass(p.status)}">${p.status}</span></td>
          <td>${actorLabelForSec(p)}</td>
          <td>${deriveFocus(p)}</td>
          <td>${dueText(p)}</td>
          <td>${fmtDate((p.timeline?.slice(-1)[0]?.at)||p.updatedAt)}</td>
          <td><button class="btn btn-sm btn-outline-primary" data-sec-open="${p.id}">${p.nextActor==='secretariat'?'Review & Act':'Open'}</button></td>
        `;
        tbody.appendChild(tr);
      });
      // row actions
      $$('#secRows [data-sec-open]').forEach(btn => btn.onclick = () => openSec(btn.getAttribute('data-sec-open')));
      $$('#secRows [data-toggle-sec-unread]').forEach(dot => dot.onclick = () => toggleUnread(dot.getAttribute('data-toggle-sec-unread'), 'secretariat'));
    }

    function openSec(id) {
      const projects = loadProjects();
      secCurrent = projects.find(p => p.id === id);
      if (!secCurrent) return;
      secCurrent.seen = secCurrent.seen || {};
      secCurrent.seen.secretariatAt = new Date().toISOString();
      secCurrent.unread.secretariat = false;
      safeSaveProjects(projects);
      refreshSecModalContent();
      secModal.show();
      renderSec();
    }

    function refreshSecModalContent() {
      const p = secCurrent; if (!p) return;
      $('#secTitle').textContent = p.name;
      $('#secDept').textContent = p.department || '-';
      $('#secMinistry').textContent = p.ministry || '-';
      $('#secPMB').textContent = `${p.pmBusiness?.name||'-'} (${p.pmBusiness?.email||'-'})`;
      $('#secPMT').textContent = p.pmTechnical?.email ? `${p.pmTechnical?.name||'-'} (${p.pmTechnical?.email})` : '-';
      $('#secTypes').textContent = `${p.mainType||'-'}; Other: ${(p.otherTypes||[]).join(', ')||'-'} ${p.sharedServices?.length ? ' | EGNC SS: ' + p.sharedServices.join(', ') : ''}`;
      $('#secStatus').className = 'badge ' + badgeClass(p.status); $('#secStatus').textContent = p.status;
      $('#secLetterRef').textContent = p.letterRef || '—';
      const banner = p.nextActor === 'none'
        ? `Complete — Letter issued`
        : `Awaiting: <b>${p.nextActor==='pm'?'PM':'Secretariat'}</b>${p.secOwner && p.nextActor==='secretariat' ? ' ('+p.secOwner+')':''} • Due: <b>${dueText(p)}</b>${isOverdue(p)?' — <span class="text-danger">Overdue</span>':''}`;
      $('#secBanner').innerHTML = banner;

      $('#secFiles').innerHTML = listFiles(p.attachments);
      renderTimeline($('#secTimeline'), p, false);

      $('#secStatusSel').disabled = !userCanEditSec();
      $('#secApplyChange').disabled = !userCanEditSec();

      // reset blocks
      $('#blockFeedback').style.display = 'none';
      $('#blockApproved').style.display = 'none';
      $('#blockNotApproved').style.display = 'none';
      $('#blockLetter').style.display = 'none';
      $('#secFRReply').innerHTML = '';
      $('#remarks').innerHTML = '';
      $('#remarksNA').innerHTML = '';
      $('#letterFile').value = '';
      $('#letterRef').value = p.letterRef || '';
      $('#meetingOutcomeAP').value = '';
      $('#meetingOutcomeNA').value = '';
      $('#secDueAtFR').value = isoToLocalDT(addBizDays(10));
      $('#secDueAtAP').value = isoToLocalDT(addBizDays(10));
      $('#secDueAtNA').value = isoToLocalDT(addBizDays(10));

      // focal
      $('#secFocalEmail').value = p.secOwner || '';
      $('#secAssignedTo').textContent = p.secOwner || '—';

      // block toggle
      $('#secStatusSel').onchange = (e) => toggleSecBlocks(e.target.value);

      // mark RU
      $('#secMarkRU').onclick = () => { toggleUnread(p.id, 'secretariat', true); openSec(p.id); };

      // internal note (⚠️ this was one of the broken handlers)
      $('#secInternalNote').innerHTML = '';
      $('#secAddInternal').onclick = () => {
        const text = safePlain($('#secInternalNote').innerHTML.trim());
        if (!text) { alert('Type an internal note first.'); return; }
        const arr = loadProjects(); const idx = arr.findIndex(x => x.id === p.id); if (idx < 0) return;
        pushTimeline(arr[idx], { actor:'sec', stage: arr[idx].status, internal:true, text });
        if (!safeSaveProjects(arr)) return;
        secCurrent = arr[idx];
        $('#secInternalNote').innerHTML = '';
        renderTimeline($('#secTimeline'), secCurrent, false);
        renderSec();
        notify('Internal note added');
      };
    }

    function toggleSecBlocks(val) {
      $('#blockFeedback').style.display = (val === 'FEEDBACK_REQUIRED') ? '' : 'none';
      $('#blockApproved').style.display = (val === 'APPROVED') ? '' : 'none';
      $('#blockNotApproved').style.display = (val === 'NOT_APPROVED') ? '' : 'none';
      $('#blockLetter').style.display = (val === 'LETTER_ISSUED') ? '' : 'none';
    }

    // Prefill templates into RTE (ensure handlers are bound once DOM exists)
    const fillTemplate = (str, dueISO) => {
      if (!str) return '';
      const today = new Date();
      const fmtToday = `${pad(today.getDate())}/${pad(today.getMonth()+1)}/${today.getFullYear()}`;
      const dueTxt = dueISO ? fmtDate(dueISO) : '—';
      return str.replaceAll('{{DUE}}', dueTxt).replaceAll('{{TODAY}}', fmtToday);
    };
    $('#tplFR').onchange = () => {
      const tpl = $('#tplFR').value;
      const due = $('#secDueAtFR').value ? new Date($('#secDueAtFR').value).toISOString() : null;
      if (!tpl) return;
      if ($('#secFRReply').innerHTML.trim() && !confirm('Replace current text with the selected template?')) return;
      $('#secFRReply').innerHTML = fillTemplate(tpl, due);
    };
    $('#tplAP').onchange = () => {
      const tpl = $('#tplAP').value;
      const due = $('#secDueAtAP').value ? new Date($('#secDueAtAP').value).toISOString() : null;
      if (!tpl) return;
      if ($('#remarks').innerHTML.trim() && !confirm('Replace current text with the selected template?')) return;
      $('#remarks').innerHTML = fillTemplate(tpl, due);
    };
    $('#tplNA').onchange = () => {
      const tpl = $('#tplNA').value;
      const due = $('#secDueAtNA').value ? new Date($('#secDueAtNA').value).toISOString() : null;
      if (!tpl) return;
      if ($('#remarksNA').innerHTML.trim() && !confirm('Replace current text with the selected template?')) return;
      $('#remarksNA').innerHTML = fillTemplate(tpl, due);
    };

    // Undo last commented upload
    $('#undoCommented').onclick = () => {
      if (!secCurrent) return;
      const projects = loadProjects();
      const idx = projects.findIndex(x => x.id === secCurrent.id); if (idx < 0) return;
      const last = [...projects[idx].attachments].reverse().find(a => a.kind === 'commented');
      if (!last) { alert('No commented document to undo.'); return; }
      if (!confirm('Undo last commented upload?')) return;
      projects[idx].attachments = projects[idx].attachments.filter(a => a.id !== last.id);
      pushTimeline(projects[idx], { actor:'sec', stage: projects[idx].status, internal:true, text:`Removed commented upload: ${last.filename}` });
      if (projects[idx].status === 'FEEDBACK_REQUIRED') {
        projects[idx].status = projects[idx].prevStatus || 'SUBMITTED';
        projects[idx].nextActor = 'secretariat';
      }
      if (!safeSaveProjects(projects)) return;
      secCurrent = projects[idx];
      refreshSecModalContent();
      renderSec();
    };

    // Assign focal
    $('#secAssignFocal').onclick = () => {
      if (!secCurrent) return;
      const email = ($('#secFocalEmail').value || '').trim().toLowerCase();
      if (!email || !email.includes('@')) { alert('Enter a valid email'); return; }
      const arr = loadProjects(); const idx = arr.findIndex(p => p.id === secCurrent.id); if (idx < 0) return;
      arr[idx].secOwner = email; arr[idx].updatedAt = new Date().toISOString();
      if (!safeSaveProjects(arr)) return;
      secCurrent = arr[idx]; $('#secAssignedTo').textContent = secCurrent.secOwner;
      renderSec(); notify('Focal assigned');
    };

    // APPLY CHANGE (⚠️ this was the other broken handler)
    $('#secApplyChange').onclick = async () => {
      const me = getUser(); if (!me || !userCanEditSec()) { alert('Not allowed.'); return; }
      const projects = loadProjects();
      const idx = projects.findIndex(x => x.id === secCurrent?.id); if (idx < 0) return;
      const p = projects[idx];
      const val = $('#secStatusSel').value; if (!val) { alert('Select a status to apply.'); return; }
      p.prevStatus = p.status; if (!p.secOwner) p.secOwner = me.email;

      if (val === 'FEEDBACK_REQUIRED') {
        const files = await filesToDataUrls($('#feedbackFile').files);
        if (!files.length) { alert('Commented document is required.'); return; }
        files.forEach(f => p.attachments.push({ id:'A'+Math.random().toString(36).slice(2,8), kind:'commented', filename:f.name, mimeType:f.type, size:f.size, uploadedBy:'secretariat', uploadedAt:new Date().toISOString(), dataUrl:f.dataUrl }));
        const dueSel = $('#secDueAtFR').value; p.dueAt = dueSel ? localDTToISO(dueSel) : addBizDays(10);
        const plain = safePlain($('#secFRReply').innerHTML.trim());
        pushTimeline(p, { actor:'sec', stage:'FEEDBACK_REQUIRED', text:`Sent ARF back to user for feedback. See Remark:`, quote: plain ? `${plain}` : `Kindly review and revise per comments; resubmit by ${fmtDate(p.dueAt)}.` });
        p.status = 'FEEDBACK_REQUIRED'; p.nextActor = 'pm'; p.unread.pm = true; p.unread.secretariat = false;
        $('#feedbackFile').value = ''; $('#secFRReply').innerHTML=''; $('#tplFR').value='';
        notify('Sent to PM');
      }

      if (val === 'APPROVED') {
        const mo = await filesToDataUrls($('#meetingOutcomeAP').files);
        mo.forEach(f => p.attachments.push({ id:'A'+Math.random().toString(36).slice(2,8), kind:'meeting_outcome', filename:f.name, mimeType:f.type, size:f.size, uploadedBy:'secretariat', uploadedAt:new Date().toISOString(), dataUrl:f.dataUrl }));
        const dueSel = $('#secDueAtAP').value; p.dueAt = dueSel ? localDTToISO(dueSel) : addBizDays(10);
        const plain = safePlain($('#remarks').innerHTML.trim());
        pushTimeline(p, { actor:'sec', stage:'APPROVED', text:`ARF has been approved. See Remark:`, quote: plain ? `${plain}` : `Approved with conditions. Please confirm completion by ${fmtDate(p.dueAt)}.` });
        p.status = 'APPROVED'; p.nextActor = 'pm'; p.unread.pm = true; p.unread.secretariat = false;
        $('#remarks').innerHTML=''; $('#meetingOutcomeAP').value=''; $('#tplAP').value='';
        notify('Approved with remarks — assigned to PM');
      }

      if (val === 'NOT_APPROVED') {
        const mo = await filesToDataUrls($('#meetingOutcomeNA').files);
        if (!mo.length) { alert('Meeting Outcome attachment is required.'); return; }
        mo.forEach(f => p.attachments.push({ id:'A'+Math.random().toString(36).slice(2,8), kind:'meeting_outcome', filename:f.name, mimeType:f.type, size:f.size, uploadedBy:'secretariat', uploadedAt:new Date().toISOString(), dataUrl:f.dataUrl }));
        const dueSel = $('#secDueAtNA').value; p.dueAt = dueSel ? localDTToISO(dueSel) : addBizDays(10);
        const plain = safePlain($('#remarksNA').innerHTML.trim());
        pushTimeline(p, { actor:'sec', stage:'NOT_APPROVED', text:`ARF was not approved. See remark:`, quote: plain ? `${plain}` : `Not approved by LT. See meeting outcome. Please advise next steps by ${fmtDate(p.dueAt)}.` });
        p.status = 'NOT_APPROVED'; p.nextActor = 'pm'; p.unread.pm = true; p.unread.secretariat = false;
        $('#remarksNA').innerHTML=''; $('#meetingOutcomeNA').value=''; $('#tplNA').value='';
        notify('Not Approved outcome sent to PM');
      }

      if (val === 'LETTER_ISSUED') {
        const files = await filesToDataUrls($('#letterFile').files);
        if (!files.length) { alert('Upload the .msg letter.'); return; }
        const bad = files.find(f => !f.name.toLowerCase().endsWith('.msg'));
        if (bad) { alert('Only .msg files allowed for the letter.'); return; }
        files.forEach(f => p.attachments.push({ id:'A'+Math.random().toString(36).slice(2,8), kind:'letter', filename:f.name, mimeType:f.type, size:f.size, uploadedBy:'secretariat', uploadedAt:new Date().toISOString(), dataUrl:f.dataUrl }));
        const ref = ($('#letterRef').value || '').trim(); p.letterRef = ref;
        pushTimeline(p, { actor:'sec', stage:'LETTER_ISSUED', text:`Letter issued to user. Ref: ${ref || 'N/A'}` });
        p.status = 'LETTER_ISSUED'; p.nextActor = 'none'; p.unread.pm = true; p.unread.secretariat = false; p.dueAt = null;
        $('#letterFile').value=''; $('#letterRef').value='';
        notify('Letter issued — workflow complete');
      }

      projects[idx] = p;
      if (!safeSaveProjects(projects)) return;
      secCurrent = p;
      refreshSecModalContent();
      renderSec();
      // also refresh PM list if that tab is open in another page instance
    };

    // Tabs + filters
    $$('#secTabs .nav-link').forEach(a => a.onclick = (e) => {
      e.preventDefault();
      $$('#secTabs .nav-link').forEach(x => x.classList.remove('active'));
      a.classList.add('active'); secTab = a.getAttribute('data-tab'); renderSec();
    });
    $('#secApplyF').onclick = renderSec;
    $('#secClearF').onclick = () => { $('#secQ').value = ''; $('#secStatusF').value = ''; renderSec(); };
    $('#secExportAll').onclick = () => {
      const raw = localStorage.getItem('dtrc_projects_v2') || '[]';
      const blob = new Blob([raw], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'projects.json'; a.click();
    };

    // Init page: if not logged in, common.js should redirect to login. Otherwise render.
    renderSec();
  });
})();
