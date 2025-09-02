// Submission page logic
DTRC.ALL_TYPES=[
  'Maintenance & Support','Subscription (Procurement/Renewal)',
  'Hardware Procurement (Central)','Hardware Procurement (Direct)',
  'Software licensing (Central)','Software licensing (Direct)',
  'In-house Development (Shared Services)','In-house Development (3rd-Party services)',
  'Utilization of EGNC Shared Services'
];
DTRC.SHARED_SERVICES=['Migration to CWH','Migration to OGPC','NCDB','NIH','EGNC Development Services','Mobile Application Hosting Services','BruneiID'];

DTRC.formState = {formType:'ARF',activityName:'',department:'',ministry:'',
  pmBusiness:{email:'',name:''},pmTechnical:{email:'',name:''},members:[],
  mainType:'',otherTypes:[],sharedServices:[],
  documents:[],declared:false,meta:{savedAt:null}};

DTRC.filesToDataUrls = (fileList)=>{
  const files=Array.from(fileList||[]);
  return Promise.all(files.map(f=> new Promise(res=>{
    const fr=new FileReader(); fr.onload=()=>res({name:f.name,type:f.type||'',size:f.size||0,dataUrl:fr.result}); fr.readAsDataURL(f);
  })));
};

DTRC.setSaved = ()=>{
  const el = DTRC.$('#saveState'); if(!el) return;
  el.textContent = DTRC.formState.meta.savedAt? ('Saved '+new Date(DTRC.formState.meta.savedAt).toLocaleTimeString()):'Not saved';
};
DTRC.saveForm = ()=>{ localStorage.setItem(DTRC.LSK_FORM, JSON.stringify(DTRC.formState)); DTRC.formState.meta.savedAt=new Date().toISOString(); DTRC.setSaved(); DTRC.refreshSummary(); };
DTRC.loadForm = ()=>{ const raw=localStorage.getItem(DTRC.LSK_FORM); if(raw) DTRC.formState=JSON.parse(raw); DTRC.setSaved(); };

DTRC.MOCK_AD=[
  {email:'rahman@egnc.gov.bn',name:'A. Rahman'},
  {email:'slee@egnc.gov.bn',name:'S. Lee'},
  {email:'nisa@egnc.gov.bn',name:'Nisa Hj. M.'},
  {email:'faizal@mtic.gov.bn',name:'Faizal A.'},
  {email:'lina@moh.gov.bn',name:'Lina B.'},
  {email:'amallul.latif@egnc.gov.bn',name:'Amallul Latif'},
  {email:'shahrul.ghani@egnc.gov.bn',name:'Shahrul Ghani'},
  {email:'zaiton.mahmud@egnc.gov.bn',name:'Zaiton Mahmud'}
];
DTRC.adLookup=(email)=>{
  const hit=DTRC.MOCK_AD.find(x=>x.email.toLowerCase()===email.toLowerCase());
  if(hit) return hit.name;
  if(email.includes('@')){ const local=email.split('@')[0].replace(/[._]/g,' '); return local? local.replace(/\b\w/g,c=>c.toUpperCase()):''; } return '';
};

DTRC.renderMainType=()=>{
  const el = DTRC.$('#mainType'); if(!el) return;
  el.innerHTML=`<option value="">Select…</option>`+DTRC.ALL_TYPES.map(t=>`<option ${DTRC.formState.mainType===t?'selected':''}>${t}</option>`).join('');
  el.onchange = e=>{ DTRC.formState.mainType=e.target.value; DTRC.formState.otherTypes=DTRC.formState.otherTypes.filter(x=>x!==DTRC.formState.mainType); DTRC.saveForm(); DTRC.renderOtherTypes(); DTRC.renderSharedServicesBlock(); DTRC.refreshSummary(); };
};
DTRC.renderOtherTypes=()=>{
  const box=DTRC.$('#otherTypes'); if(!box) return; box.innerHTML='';
  const rem=DTRC.ALL_TYPES.filter(t=>t!==DTRC.formState.mainType);
  rem.forEach(t=>{
    const id='ot_'+t.replace(/\W+/g,'_');
    const wrap=document.createElement('div'); wrap.className='form-check';
    wrap.innerHTML=`<input class="form-check-input" type="checkbox" id="${id}" ${DTRC.formState.otherTypes.includes(t)?'checked':''}><label class="form-check-label" for="${id}">${t}</label>`;
    box.appendChild(wrap);
    box.querySelector('#'+id).onchange = ev=>{
      if(ev.target.checked){ if(!DTRC.formState.otherTypes.includes(t)) DTRC.formState.otherTypes.push(t); }
      else { DTRC.formState.otherTypes=DTRC.formState.otherTypes.filter(x=>x!==t); }
      DTRC.saveForm(); DTRC.renderSharedServicesBlock(); DTRC.refreshSummary();
    };
  });
};
DTRC.renderSharedServicesBlock=()=>{
  const selected=DTRC.formState.mainType==='Utilization of EGNC Shared Services'||DTRC.formState.otherTypes.includes('Utilization of EGNC Shared Services');
  const block=DTRC.$('#sharedServicesBlock');
  if(selected){ DTRC.show(block); DTRC.renderSharedServices(); } else { DTRC.hide(block); DTRC.formState.sharedServices=[]; DTRC.saveForm(); }
};
DTRC.renderSharedServices=()=>{
  const box=DTRC.$('#sharedServices'); if(!box) return; box.innerHTML='';
  DTRC.SHARED_SERVICES.forEach(s=>{
    const id='ss_'+s.replace(/\W+/g,'_');
    const row=document.createElement('div'); row.className='form-check';
    row.innerHTML=`<input class="form-check-input" type="checkbox" id="${id}" ${DTRC.formState.sharedServices.includes(s)?'checked':''}><label class="form-check-label" for="${id}">${s}</label>`;
    box.appendChild(row);
    row.querySelector('#'+id).onchange = e=>{
      if(e.target.checked){ if(!DTRC.formState.sharedServices.includes(s)) DTRC.formState.sharedServices.push(s); }
      else { DTRC.formState.sharedServices=DTRC.formState.sharedServices.filter(x=>x!==s); }
      DTRC.saveForm();
    };
  });
};
DTRC.renderMembers=()=>{
  const box=DTRC.$('#memPills'); if(!box) return; box.innerHTML='';
  (DTRC.formState.members||[]).forEach((m,i)=>{
    const span=document.createElement('span'); span.className='pill';
    span.innerHTML=`${m.name||'Unknown'} <span class="text-muted">(${m.email})</span> <button class="btn btn-sm btn-link p-0" data-del="${i}">×</button>`;
    box.appendChild(span);
  });
  box.querySelectorAll('[data-del]').forEach(btn=> btn.onclick=()=>{ const i=+btn.getAttribute('data-del'); DTRC.formState.members.splice(i,1); DTRC.saveForm(); DTRC.renderMembers(); });
};
DTRC.renderDocs=()=>{
  const ul=DTRC.$('#docList'); if(!ul) return; ul.innerHTML='';
  (DTRC.formState.documents||[]).forEach((f,i)=>{
    const li=document.createElement('li'); li.className='file-actions d-flex justify-content-between align-items-center';
    const a=document.createElement('a'); a.href=f.dataUrl||'#'; a.download=f.name; a.target='_blank'; a.textContent=f.name;
    const del=document.createElement('button'); del.textContent='Delete'; del.onclick=()=>{ DTRC.formState.documents.splice(i,1); DTRC.saveForm(); DTRC.renderDocs(); };
    li.appendChild(a); li.appendChild(del); ul.appendChild(li);
  });
  const sumDocs=DTRC.$('#sumDocs'); if(sumDocs) sumDocs.textContent=String((DTRC.formState.documents||[]).length);
};
DTRC.refreshSummary=()=>{
  const s = DTRC.formState;
  const set = (id,txt)=>{ const el=DTRC.$(id); if(el) el.textContent=txt; };
  set('#sumFormType', s.formType||'ARF');
  set('#sumMainType', s.mainType||'–');
  const others=(s.otherTypes||[]).slice();
  if(s.sharedServices?.length) others.push('EGNC SS: '+s.sharedServices.join(', '));
  set('#sumOtherTypes', others.length? others.join(', '):'–');
};

DTRC.filesToDataUrls; // already defined

DTRC.validateSubmission=()=>{
  ['activityName','department','ministry'].forEach(id=>{ const el=DTRC.$('#'+id); if(el) el.classList.remove('is-invalid'); });
  const du = DTRC.$('#docUpload'); if(du) du.classList.remove('is-invalid');
  const pmerr = DTRC.$('#pmBizErr'); if(pmerr) pmerr.style.display='none';
  let ok=true;
  const mark=(id,good)=>{ const el=DTRC.$('#'+id); if(!el) return; if(!good){ el.classList.add('is-invalid'); ok=false; } };
  mark('activityName', !!DTRC.formState.activityName);
  mark('department', !!DTRC.formState.department);
  mark('ministry', !!DTRC.formState.ministry);
  if(!(DTRC.formState.pmBusiness.email && DTRC.formState.pmBusiness.name)){ if(pmerr) pmerr.style.display=''; ok=false; }
  if(!DTRC.formState.mainType){ const mt=DTRC.$('#mainType'); if(mt) mt.classList.add('is-invalid'); ok=false; } else { const mt=DTRC.$('#mainType'); if(mt) mt.classList.remove('is-invalid'); }
  if(!DTRC.formState.documents.length){ if(du) du.classList.add('is-invalid'); ok=false; }
  if(!DTRC.formState.declared){ ok=false; }
  return ok;
};

DTRC.countUserSubmissions=(p)=> (p.timeline||[]).filter(e=> e.actor==='user' && e.isSubmission).length;
DTRC.ordinal=(n)=>{ const o=['th','st','nd','rd'], v=n%100; return n+(o[(v-20)%10]||o[v]||o[0]); };
DTRC.pushTimeline=(p, entry)=>{ p.timeline=p.timeline||[]; p.timeline.push(Object.assign({at:new Date().toISOString()}, entry)); p.updatedAt=new Date().toISOString(); };

DTRC.newProjectFromForm=()=>{
  const now=new Date().toISOString();
  const s=DTRC.formState;
  const proj={
    id:'P'+Date.now(), formType:s.formType,
    name:s.activityName, department:s.department, ministry:s.ministry,
    pmBusiness:s.pmBusiness, pmTechnical:s.pmTechnical, members:s.members,
    mainType:s.mainType, otherTypes:s.otherTypes, sharedServices:s.sharedServices,
    status:'SUBMITTED', prevStatus:null, letterRef:'',
    nextActor:'secretariat', secOwner:'', dueAt:DTRC.addBizDays(3),
    unread:{pm:false,secretariat:true}, seen:{pmAt:null,secretariatAt:null},
    attachments:(s.documents||[]).map(f=>({id:'A'+Math.random().toString(36).slice(2,8),kind:'initial',filename:f.name,mimeType:f.type,size:f.size,uploadedBy:s.pmBusiness.email||'requestor',uploadedAt:now,dataUrl:f.dataUrl})),
    timeline:[],
    createdBy:s.pmBusiness.email||'requestor', createdAt:now, updatedAt:now
  };
  DTRC.pushTimeline(proj, {actor:'user', stage:'SUBMITTED', isSubmission:true, cycle:1, text:`First ${proj.formType} Submission from ${proj.pmBusiness.email}`});
  return proj;
};

DTRC.submitForm=()=>{
  if(!DTRC.validateSubmission()){ 
    const body = '<div class="text-danger">Some required fields are missing. Check highlights and the declaration.</div>';
    DTRC.$('#modalTitle').textContent='Please complete required items';
    DTRC.$('#modalBody').innerHTML=body;
    bootstrap.Modal.getOrCreateInstance('#modal').show();
    return;
  }
  const project=DTRC.newProjectFromForm(); const arr=DTRC.loadProjects(); arr.push(project);
  if(!DTRC.safeSaveProjects(arr)) return;
  const sfs=DTRC.$('#sumFirstSubmitted'); if(sfs) sfs.textContent=DTRC.fmtDate(project.createdAt);
  DTRC.notify('Submission received');
  const html = `<p>Status: <span class="badge text-bg-primary">Submitted</span> • Next Actor: <b>Secretariat</b> • Due: ${DTRC.fmtDate(project.dueAt)}</p>`;
  DTRC.$('#modalTitle').textContent='Submission Received';
  DTRC.$('#modalBody').innerHTML=html;
  bootstrap.Modal.getOrCreateInstance('#modal').show();
  setTimeout(()=>{ location.href='pm.html'; }, 800);
};

DTRC.paintSubmission=()=>{
  // radio
  DTRC.$$('#view-submission input[name="formType"]').forEach(r=>{
    r.checked=(r.value===DTRC.formState.formType);
    r.onchange=()=>{ if(r.checked){ DTRC.formState.formType=r.value; DTRC.saveForm(); } };
  });
  const setVal = (id,val,handler)=>{ const el=DTRC.$('#'+id); if(!el) return; el.value=val||''; el.oninput=handler; };
  setVal('activityName', DTRC.formState.activityName, e=>{ DTRC.formState.activityName=e.target.value; DTRC.saveForm(); });
  setVal('department', DTRC.formState.department, e=>{ DTRC.formState.department=e.target.value; DTRC.saveForm(); });
  const min = DTRC.$('#ministry'); if(min){ min.value=DTRC.formState.ministry||''; min.onchange=e=>{ DTRC.formState.ministry=e.target.value; DTRC.saveForm(); }; }

  DTRC.renderMainType(); DTRC.renderOtherTypes(); DTRC.renderSharedServicesBlock();

  // AD
  const pmBizEmail = DTRC.$('#pmBizEmail'), pmBizName = DTRC.$('#pmBizName'), pmTechEmail = DTRC.$('#pmTechEmail'), pmTechName = DTRC.$('#pmTechName');
  if(pmBizEmail && pmBizName){
    pmBizEmail.value=DTRC.formState.pmBusiness.email||''; pmBizName.textContent=DTRC.formState.pmBusiness.name||'–';
    const btn = DTRC.$('#pmBizResolve');
    if(btn) btn.onclick=()=>{ const em=pmBizEmail.value.trim(); if(!em.includes('@')) return alert('Enter a valid email'); const name=DTRC.adLookup(em); DTRC.formState.pmBusiness={email:em,name}; DTRC.saveForm(); pmBizName.textContent=name||'Not found'; };
  }
  if(pmTechEmail && pmTechName){
    pmTechEmail.value=DTRC.formState.pmTechnical.email||''; pmTechName.textContent=DTRC.formState.pmTechnical.name||'–';
    const btn = DTRC.$('#pmTechResolve');
    if(btn) btn.onclick=()=>{ const em=pmTechEmail.value.trim(); if(!em){ DTRC.formState.pmTechnical={email:'',name:''}; DTRC.saveForm(); pmTechName.textContent='–'; return; } if(!em.includes('@')) return alert('Enter a valid email'); const name=DTRC.adLookup(em); DTRC.formState.pmTechnical={email:em,name}; DTRC.saveForm(); pmTechName.textContent=name||'Not found'; };
  }
  const memAdd = DTRC.$('#memAdd');
  if(memAdd) memAdd.onclick=()=>{ const em=(DTRC.$('#memEmail').value||'').trim(); if(!em||!em.includes('@')) return alert('Enter a valid email'); if((DTRC.formState.members||[]).some(m=>m.email.toLowerCase()===em.toLowerCase())) return alert('Already added'); const name=DTRC.adLookup(em); DTRC.formState.members.push({email:em,name}); DTRC.$('#memEmail').value=''; DTRC.saveForm(); DTRC.renderMembers(); };
  DTRC.renderMembers();

  // uploads
  const doc = DTRC.$('#docUpload');
  if(doc){ doc.onchange=async()=>{ const arr=await DTRC.filesToDataUrls(doc.files); DTRC.formState.documents=(DTRC.formState.documents||[]).concat(arr); doc.value=''; DTRC.saveForm(); DTRC.renderDocs(); }; }
  DTRC.renderDocs();

  const declared = DTRC.$('#declared');
  if(declared){ declared.checked=!!DTRC.formState.declared; declared.onchange=e=>{ DTRC.formState.declared=e.target.checked; DTRC.saveForm(); }; }

  // top actions
  const exportBtn = DTRC.$('#exportBtn'); if(exportBtn) exportBtn.onclick = ()=>{ DTRC.$('#modalTitle').textContent='Export Draft'; DTRC.$('#modalBody').innerHTML=`<pre class="code">${JSON.stringify(DTRC.formState,null,2)}</pre>`; bootstrap.Modal.getOrCreateInstance('#modal').show(); };
  const importBtn = DTRC.$('#importBtn'); if(importBtn) importBtn.onclick = ()=>{ DTRC.$('#modalTitle').textContent='Import JSON'; DTRC.$('#modalBody').innerHTML = `<textarea class="form-control" rows="10" id="jsonIn" placeholder='Paste JSON'></textarea><div class="text-end mt-2"><button class="btn btn-primary btn-sm" id="doImport" type="button">Load</button></div>`; bootstrap.Modal.getOrCreateInstance('#modal').show(); };
  document.addEventListener('click', e=>{ if(e.target && e.target.id==='doImport'){ try{ const obj=JSON.parse(DTRC.$('#jsonIn').value||'{}'); DTRC.formState=Object.assign(DTRC.formState,obj); DTRC.saveForm(); DTRC.paintSubmission(); bootstrap.Modal.getInstance('#modal').hide(); }catch(err){ alert('Invalid JSON'); } }});

  const loadSample = DTRC.$('#loadSample'); if(loadSample) loadSample.onclick=()=>{ DTRC.formState={formType:'ARF',activityName:'GovBN Core Portal (Phase 1)',department:'EGNC',ministry:'MTIC (Transport & Infocommunications)',pmBusiness:{email:'rahman@egnc.gov.bn',name:'A. Rahman'},pmTechnical:{email:'slee@egnc.gov.bn',name:'S. Lee'},members:[{email:'nisa@egnc.gov.bn',name:'Nisa Hj. M.'}],mainType:'In-house Development (Shared Services)',otherTypes:['Utilization of EGNC Shared Services'],sharedServices:['BruneiID'],documents:[],declared:true,meta:{savedAt:new Date().toISOString()}}; DTRC.saveForm(); DTRC.paintSubmission(); };

  const submit = DTRC.$('#submitBtn'); if(submit) submit.onclick = DTRC.submitForm;
  const sfs=DTRC.$('#sumFirstSubmitted'); if(sfs) sfs.textContent='–';
  DTRC.refreshSummary();
};

document.addEventListener('DOMContentLoaded', ()=>{
  DTRC.guardAuth({}); // must be logged in
  DTRC.loadForm(); 
  DTRC.paintSubmission();
});
