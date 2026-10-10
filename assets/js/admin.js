(() => {
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmtDate = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}.`; };
  const bytes = n => n < 1024 ? `${n} B` : n < 1024*1024 ? `${(n/1024).toFixed(0)} KB` : `${(n/1024/1024).toFixed(1)} MB`;

  let apiUrl = localStorage.getItem('fksava_api_url') || 'https://fk-sava-admin-api.onrender.com';
  let token = sessionStorage.getItem('fksava_admin_token') || '';
  let data = null;
  let currentYear = 2016;
  let currentTab = 'dashboard';
  let isDirty = false;
  let demoMode = false;
  const DRAFT_KEY = 'fksava_admin_draft_v3';

  const loginShell=$('#loginShell'), adminApp=$('#adminApp'), apiUrlInput=$('#apiUrl'), passwordInput=$('#adminPassword'), loginStatus=$('#loginStatus');
  apiUrlInput.value=apiUrl;

  function toast(message,type='ok',ms=3200){
    const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=message; document.body.appendChild(t); setTimeout(()=>t.remove(),ms);
  }
  function saveDraft(){
    if(!data || demoMode) return;
    try{ localStorage.setItem(DRAFT_KEY, JSON.stringify({savedAt:Date.now(),data,currentYear,currentTab})); }catch{}
  }
  function clearDraft(){ try{localStorage.removeItem(DRAFT_KEY);}catch{} }
  function setDirty(v=true){
    isDirty=v; const el=$('#saveState'); if(el){el.textContent=v?'Neobjavljeno':'Sačuvano';el.classList.toggle('dirty',v);} if(v) saveDraft();
  }
  async function api(path, options={}){
    if(demoMode) throw new Error('Demo režim nema pristup serveru.');
    const headers={'Content-Type':'application/json',...(options.headers||{})};
    if(token) headers.Authorization=`Bearer ${token}`;
    const r=await fetch(`${apiUrl.replace(/\/$/,'')}${path}`,{...options,headers});
    const text=await r.text(); let body={}; try{body=text?JSON.parse(text):{};}catch{body={message:text};}
    if(!r.ok) throw new Error(body.error || body.message || `HTTP ${r.status}`);
    return body;
  }
  async function login(password){
    apiUrl=apiUrlInput.value.trim().replace(/\/$/,'');
    localStorage.setItem('fksava_api_url',apiUrl);
    loginStatus.textContent='Povezujem se…';
    const res=await api('/api/login',{method:'POST',body:JSON.stringify({password})});
    token=res.token; sessionStorage.setItem('fksava_admin_token',token);
    await loadRemote(true);
  }
  async function loadRemote(checkDraft=false){
    const res=await api('/api/club-data');
    let remote=res.data || res;
    if(!remote?.years) throw new Error('club-data.json nema očekivanu strukturu.');
    if(checkDraft){
      try{
        const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
        if(draft?.data?.years && confirm('Na ovom telefonu postoje neobjavljene izmene. Vratiti ih?')){
          remote=draft.data; currentYear=Number(draft.currentYear||currentYear); currentTab=draft.currentTab||currentTab; isDirty=true;
        } else if(draft) clearDraft();
      }catch{}
    }
    data=remote;
    currentYear = data.years.some(y=>Number(y.year)===Number(currentYear)) ? currentYear : Number(data.years[0]?.year || 2016);
    openApp(); setDirty(isDirty); render();
  }
  async function loadDemo(){
    demoMode=true; token=''; sessionStorage.removeItem('fksava_admin_token');
    const r=await fetch(`club-data.json?v=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error('Ne mogu da učitam club-data.json.');
    data=await r.json();
    currentYear=Number(data.years.find(y=>Number(y.year)===2016)?.year || data.years[0]?.year || 2016);
    openApp(); $('#publishBtn').disabled=true; $('#publishBtn').textContent='Demo'; $('#saveState').textContent='Lokalno'; render();
    toast('Demo režim: možeš da testiraš unos i izvezeš JSON, ali nema objavljivanja.');
  }
  function openApp(){
    loginShell.hidden=true; adminApp.hidden=false;
    const season=data.meta?.season || '';
    $('#seasonLabelMobile').textContent=`SEZONA ${season}`;
    $('#adminName').textContent=data.meta?.adminName || 'Jovan Došlo · JR';
    syncYearSelects(); setTab(currentTab,false);
  }
  function syncYearSelects(){
    const html=data.years.map(y=>`<option value="${esc(y.year)}" ${Number(y.year)===Number(currentYear)?'selected':''}>${esc(y.year)}</option>`).join('');
    $('#yearSelect').innerHTML=html; $('#yearSelectMobile').innerHTML=html;
  }
  function logout(){
    token=''; sessionStorage.removeItem('fksava_admin_token'); adminApp.hidden=true; loginShell.hidden=false; passwordInput.value=''; loginStatus.textContent=''; demoMode=false;
  }

  $('#loginBtn').onclick=async()=>{ try{ await login(passwordInput.value); loginStatus.textContent=''; passwordInput.value=''; }catch(e){ loginStatus.textContent=e.message; } };
  $('#demoBtn').onclick=async()=>{ try{loginStatus.textContent='';await loadDemo();}catch(e){loginStatus.textContent=e.message;} };
  passwordInput.addEventListener('keydown',e=>{ if(e.key==='Enter') $('#loginBtn').click(); });
  if(token){ loadRemote(true).catch(()=>{ token=''; sessionStorage.removeItem('fksava_admin_token'); loginShell.hidden=false; }); }

  function yearChanged(v){currentYear=Number(v);syncYearSelects();render();}
  $('#yearSelect').onchange=e=>yearChanged(e.target.value);
  $('#yearSelectMobile').onchange=e=>yearChanged(e.target.value);
  $$('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  function setTab(tab,doRender=true){
    currentTab=tab; $$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); if(doRender) render();
  }
  $('#reloadBtn').onclick=async()=>{
    if(demoMode) return toast('Demo režim čita lokalni club-data.json.');
    if(isDirty && !confirm('Neobjavljene izmene će biti izgubljene. Učitati podatke sa GitHub-a?')) return;
    try{isDirty=false;clearDraft();await loadRemote(false);toast('Učitani su najnoviji podaci sa GitHub-a.');}catch(e){toast(e.message,'error');}
  };
  $('#publishBtn').onclick=async()=>{
    if(demoMode) return;
    try{
      $('#publishBtn').disabled=true; $('#publishBtn').textContent='Objavljujem…';
      data.meta=data.meta||{}; data.meta.updatedAt=new Date().toISOString(); data.meta.schemaVersion=3;
      const res=await api('/api/club-data',{method:'PUT',body:JSON.stringify({data})});
      clearDraft(); setDirty(false); toast(`Objavljeno ✓ ${res.commitSha ? res.commitSha.slice(0,7) : ''}`);
    }catch(e){ toast(e.message,'error',5000); }
    finally{$('#publishBtn').disabled=false;$('#publishBtn').textContent='Objavi';}
  };
  $('#logoutBtn').onclick=logout; $('#logoutBtnSide').onclick=logout;

  function group(){ return data.years.find(y=>Number(y.year)===Number(currentYear)); }
  function yearMatches(){ return (data.matches||[]).filter(m=>Number(m.year)===Number(currentYear)); }
  function yearGallery(){ return (data.gallery||[]).filter(g=>Number(g.year)===Number(currentYear)); }
  function scoreFor(m){ return (m.events||[]).filter(e=>e.type==='goal').length; }
  function statsFor(id){
    const played=yearMatches().filter(m=>m.status==='played');
    return {
      appearances:played.filter(m=>(m.lineup||[]).includes(id)).length,
      goals:played.reduce((n,m)=>n+(m.events||[]).filter(e=>e.type==='goal'&&e.scorerId===id).length,0),
      assists:played.reduce((n,m)=>n+(m.events||[]).filter(e=>e.type==='goal'&&e.assistPlayerId===id).length,0)
    };
  }
  function title(m){return m.venue==='away'?`${m.opponent} – FK Sava`:`FK Sava – ${m.opponent}`;}
  function result(m){if(m.status!=='played') return m.status==='postponed'?'ODLOŽENO':'USKORO'; return m.venue==='away'?`${m.scoreAgainst??0} : ${scoreFor(m)}`:`${scoreFor(m)} : ${m.scoreAgainst??0}`;}
  function mapsUrl(m){
    if(m.mapsUrl) return m.mapsUrl;
    if(m.latitude && m.longitude) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.latitude},${m.longitude}`)}`;
    const q=[m.venueName,m.address].filter(Boolean).join(', '); return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:'';
  }
  function videoIdFrom(v){
    const s=String(v||'').trim(); if(!s) return '';
    if(/^[\w-]{6,20}$/.test(s)) return s;
    try{const u=new URL(s); if(u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0]||''; if(u.hostname.includes('youtube.com')) return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||'';}catch{}
    return s;
  }

  function render(){ if(!data) return; if(currentTab==='players')renderPlayers(); else if(currentTab==='matches')renderMatches(); else if(currentTab==='gallery')renderGallery(); else renderDashboard(); }
  function head(kicker,titleText,sub,button=''){return `<div class="workspace-head"><div><span class="kicker">${esc(kicker)}</span><h1>${esc(titleText)}</h1><p>${esc(sub)}</p></div>${button}</div>`;}

  function renderDashboard(){
    const g=group(); const players=(g.players||[]).filter(p=>p.active!==false); const ms=yearMatches(); const played=ms.filter(m=>m.status==='played'); const upcoming=ms.filter(m=>m.status==='upcoming').sort((a,b)=>`${a.date}T${a.time||''}`.localeCompare(`${b.date}T${b.time||''}`)); const goals=played.reduce((n,m)=>n+scoreFor(m),0); const gal=yearGallery();
    const last=[...played].sort((a,b)=>`${b.date}T${b.time||''}`.localeCompare(`${a.date}T${a.time||''}`))[0]; const next=upcoming[0];
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Pregled ekipe ${currentYear}`,`${g.coach||'Trener nije upisan'} · sezona ${data.meta?.season||''}`)+`
      <div class="dashboard-grid"><div class="stat-card"><small>Igrači</small><b>${players.length}</b></div><div class="stat-card"><small>Odigrano</small><b>${played.length}</b></div><div class="stat-card"><small>Golovi</small><b>${goals}</b></div><div class="stat-card"><small>Fotografije</small><b>${gal.length}</b></div></div>
      <div class="quick-grid"><button class="quick-card" data-quick="player"><strong>+ Igrač</strong><span>Unesi igrača i fotografiju</span></button><button class="quick-card" data-quick="match"><strong>+ Utakmica</strong><span>Datum, mapa, rezultat, strelci</span></button><button class="quick-card" data-quick="gallery"><strong>+ Fotografije</strong><span>Dodaj više slika sa telefona</span></button></div>
      <div class="dashboard-two"><section class="panel-card"><h3>Sledeća utakmica</h3>${next?matchSummary(next,true):'<div class="empty-card">Nema najavljene utakmice.</div>'}</section><section class="panel-card"><h3>Poslednji rezultat</h3>${last?matchSummary(last,false):'<div class="empty-card">Još nema odigranih utakmica.</div>'}</section></div>`;
    $$('[data-quick]').forEach(b=>b.onclick=()=>{if(b.dataset.quick==='player')openPlayerEditor();if(b.dataset.quick==='match')openMatchEditor();if(b.dataset.quick==='gallery')openGalleryEditor();});
  }
  function matchSummary(m,showMap){const mu=mapsUrl(m);return `<div class="next-match"><span class="kicker">${esc(fmtDate(m.date))} · ${esc(m.time||'')}</span><div class="score-line">${esc(title(m))}</div><div class="meta">${esc(m.competition||'')} ${m.venueName?`· ${esc(m.venueName)}`:''}</div><b>${esc(result(m))}</b><div class="inline-actions"><button class="btn ghost small" data-dash-edit="${esc(m.id)}">Izmeni</button>${showMap&&mu?`<a class="btn ghost small" target="_blank" rel="noopener" href="${esc(mu)}">📍 Navigacija</a>`:''}</div></div>`;}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-dash-edit]');if(b)openMatchEditor(b.dataset.dashEdit);});

  function renderPlayers(){
    const g=group(); const players=g.players||[];
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Igrači ${currentYear}`,`${g.coach || 'Trener nije upisan'} · statistika se računa iz utakmica`,`<button class="btn gold" id="addPlayer">+ Dodaj igrača</button>`)+`
      <table class="data-table"><thead><tr><th>#</th><th>Igrač</th><th>Pozicija</th><th>Nastupi</th><th>Golovi</th><th>Asist.</th><th></th></tr></thead><tbody>${players.map(p=>{const s=statsFor(p.id);return `<tr><td class="num">${esc(p.number)}</td><td><div class="player-cell">${p.photo?`<img class="player-thumb" src="${esc(p.photo)}" alt="">`:`<span class="player-placeholder">${esc(p.number)}</span>`}<div><b>${esc(p.name)}</b>${p.active===false?'<br><span class="pill">neaktivan</span>':''}</div></div></td><td>${esc(p.position)}</td><td class="num">${s.appearances}</td><td class="num">${s.goals}</td><td class="num">${s.assists}</td><td class="actions"><button class="btn ghost small" data-edit-player="${esc(p.id)}">Izmeni</button> <button class="btn danger small" data-delete-player="${esc(p.id)}">Obriši</button></td></tr>`}).join('')}</tbody></table>`;
    $('#addPlayer').onclick=()=>openPlayerEditor(); $$('[data-edit-player]').forEach(b=>b.onclick=()=>openPlayerEditor(b.dataset.editPlayer)); $$('[data-delete-player]').forEach(b=>b.onclick=()=>deletePlayer(b.dataset.deletePlayer));
  }
  function deletePlayer(id){
    const p=group().players.find(p=>p.id===id); if(!p) return;
    const used=yearMatches().some(m=>(m.lineup||[]).includes(id)||(m.events||[]).some(e=>e.scorerId===id||e.assistPlayerId===id));
    if(used){alert('Igrač se koristi u utakmicama. Označi ga kao neaktivnog ili ga prvo ukloni iz tih utakmica.');return;}
    if(confirm(`Obrisati igrača ${p.name}?`)){group().players=group().players.filter(x=>x.id!==id);setDirty();renderPlayers();}
  }
  function openPlayerEditor(id=''){
    const existing=id?group().players.find(p=>p.id===id):null; const p=existing?clone(existing):{id:uid(String(currentYear)),name:'',number:'',position:'Vezni',photo:'',active:true,note:''};
    openEditor(`<span class="kicker">IGRAČ · ${currentYear}</span><h2>${existing?'Izmeni igrača':'Dodaj igrača'}</h2><form id="playerForm"><div class="form-grid">
      <label>Ime i prezime<input name="name" required value="${esc(p.name)}"></label><label>Broj<input name="number" type="number" min="0" max="99" required value="${esc(p.number)}"></label>
      <label>Pozicija<select name="position">${['Golman','Odbrana','Vezni','Napadač'].map(x=>`<option ${p.position===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Aktivan<select name="active"><option value="true" ${p.active!==false?'selected':''}>Da</option><option value="false" ${p.active===false?'selected':''}>Ne</option></select></label>
      <div class="section-divider">Fotografija igrača</div><label class="full">Izaberi fotografiju<input name="photoFile" id="playerPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="hint">Telefon može direktno da otvori kameru. Slika se automatski cropuje na 3:4, smanjuje i kompresuje pre slanja.</span></label>
      ${p.photo?`<div class="full image-preview"><img src="${esc(p.photo)}" alt=""><span class="hint">Trenutna fotografija</span></div>`:''}<label class="full">Napomena<textarea name="note" rows="3">${esc(p.note||'')}</textarea></label></div><div class="image-progress" id="playerImageProgress"></div><div class="form-actions"><button type="button" class="btn ghost js-cancel">Otkaži</button><button class="btn gold" type="submit">Sačuvaj igrača</button></div></form>`);
    $('#playerForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{let photo=p.photo||'';const file=fd.get('photoFile');if(file?.size){$('#playerImageProgress').textContent='Obrađujem fotografiju…';photo=await uploadImage(currentYear,file,'player');}Object.assign(p,{name:fd.get('name').trim(),number:Number(fd.get('number')),position:fd.get('position'),active:fd.get('active')==='true',photo,note:fd.get('note').trim()});if(existing)Object.assign(existing,p);else group().players.push(p);setDirty();closeEditor();renderPlayers();}catch(err){toast(err.message,'error',5000);}};
  }

  function renderMatches(){
    const list=[...yearMatches()].sort((a,b)=>`${b.date}T${b.time||''}`.localeCompare(`${a.date}T${a.time||''}`));
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Utakmice ${currentYear}`,`Najave, GPS lokacija, rezultat, strelci, asistencije i YouTube`,`<button class="btn gold" id="addMatch">+ Dodaj utakmicu</button>`)+`<div class="cards-list">${list.length?list.map(m=>{const mu=mapsUrl(m);return `<article class="match-admin-card"><div class="date"><b>${esc(fmtDate(m.date))}</b><small>${esc(m.time||'')}</small></div><div class="match-copy"><h3>${esc(title(m))}</h3><p>${esc(m.competition||'')} · <span class="pill ${esc(m.status)}">${m.status==='played'?'odigrana':m.status==='postponed'?'odložena':'najavljena'}</span></p>${m.venueName?`<p class="match-location">📍 ${esc(m.venueName)} ${mu?`· <a class="map-test" href="${esc(mu)}" target="_blank" rel="noopener">mapa</a>`:''}</p>`:''}</div><div class="score-box">${esc(result(m))}</div><div class="match-actions"><button class="btn ghost small" data-edit-match="${esc(m.id)}">Izmeni</button> <button class="btn danger small" data-delete-match="${esc(m.id)}">Obriši</button></div></article>`}).join(''):'<div class="empty-card">Još nema utakmica za ovo godište.</div>'}</div>`;
    $('#addMatch').onclick=()=>openMatchEditor(); $$('[data-edit-match]').forEach(b=>b.onclick=()=>openMatchEditor(b.dataset.editMatch)); $$('[data-delete-match]').forEach(b=>b.onclick=()=>{const m=data.matches.find(x=>x.id===b.dataset.deleteMatch);if(m&&confirm(`Obrisati utakmicu ${title(m)}?`)){data.matches=data.matches.filter(x=>x.id!==m.id);setDirty();renderMatches();}});
  }
  function openMatchEditor(id=''){
    const existing=id?data.matches.find(m=>m.id===id):null; const m=existing?clone(existing):{id:uid(`${currentYear}-m`),year:currentYear,date:new Date().toISOString().slice(0,10),time:'10:00',competition:'Prijateljska utakmica',venue:'home',opponent:'',status:'upcoming',scoreAgainst:null,lineup:[],events:[],videoId:'',image:'',note:'',venueName:'Teren FK Sava, Blok 45',address:'',mapsUrl:'',latitude:'',longitude:''};
    const players=group().players||[];
    openEditor(`<span class="kicker">UTAKMICA · ${currentYear}</span><h2>${existing?'Izmeni utakmicu':'Dodaj utakmicu'}</h2><form id="matchForm"><div class="form-grid">
      <div class="section-divider">Osnovni podaci</div><label>Datum<input name="date" type="date" required value="${esc(m.date)}"></label><label>Vreme<input name="time" type="time" value="${esc(m.time||'')}"></label>
      <label>Protivnik<input name="opponent" required value="${esc(m.opponent||'')}"></label><label>Takmičenje<input name="competition" value="${esc(m.competition||'')}"></label>
      <label>Domaćin<select name="venue"><option value="home" ${m.venue!=='away'?'selected':''}>FK Sava domaćin</option><option value="away" ${m.venue==='away'?'selected':''}>FK Sava gost</option></select></label><label>Status<select name="status"><option value="upcoming" ${m.status==='upcoming'?'selected':''}>Najavljena</option><option value="played" ${m.status==='played'?'selected':''}>Odigrana</option><option value="postponed" ${m.status==='postponed'?'selected':''}>Odložena</option></select></label>
      <div class="section-divider">Lokacija / navigacija za roditelje</div><label>Naziv terena<input name="venueName" value="${esc(m.venueName||'')}" placeholder="npr. Teren FK Sava"></label><label>Adresa<input name="address" value="${esc(m.address||'')}" placeholder="ulica / naselje / grad"></label>
      <label>Latitude <span class="hint">opciono</span><input name="latitude" inputmode="decimal" value="${esc(m.latitude||'')}" placeholder="44.000000"></label><label>Longitude <span class="hint">opciono</span><input name="longitude" inputmode="decimal" value="${esc(m.longitude||'')}" placeholder="20.000000"></label>
      <label class="full">Google Maps link <span class="hint">najlakše: Share → Copy link</span><input name="mapsUrl" inputmode="url" value="${esc(m.mapsUrl||'')}" placeholder="https://maps.app.goo.gl/..."></label>
      <div class="section-divider">Rezultat / video</div><label>Golovi protivnika<input name="scoreAgainst" type="number" min="0" value="${m.scoreAgainst??''}" placeholder="samo za odigranu"></label><label>YouTube link ili ID<input name="videoId" value="${esc(m.videoId||'')}" placeholder="https://youtu.be/... ili video ID"></label>
      <label class="full">Naslovna fotografija<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="hint">Automatski crop 16:9 i kompresija.</span></label>${m.image?`<div class="full image-preview wide"><img src="${esc(m.image)}" alt=""><span class="hint">Trenutna naslovna slika</span></div>`:''}
      <label class="full">Napomena<textarea name="note" rows="2">${esc(m.note||'')}</textarea></label>
      <div class="section-divider">Sastav / nastupi</div><div class="full"><p class="hint">Označen igrač dobija nastup kada je status „Odigrana“.</p><div class="lineup-grid">${players.map(p=>`<label class="check-player"><input type="checkbox" name="lineup" value="${esc(p.id)}" ${(m.lineup||[]).includes(p.id)?'checked':''}> #${esc(p.number)} ${esc(p.name)}</label>`).join('')}</div></div>
      <div class="section-divider">Golovi FK Sava</div><div class="full"><p class="hint">Golovi FK Sava računaju se iz ovih redova. Asistencija je opciona.</p><div class="goals-editor" id="goalsEditor"></div><button type="button" class="btn ghost small" id="addGoal">+ Dodaj gol</button></div>
    </div><div class="image-progress" id="matchImageProgress"></div><div class="form-actions"><button type="button" class="btn ghost js-cancel">Otkaži</button><button class="btn gold" type="submit">Sačuvaj utakmicu</button></div></form>`);
    const goals=m.events?.filter(e=>e.type==='goal')||[]; goals.forEach(addGoalRow); if(!goals.length&&m.status==='played') addGoalRow(); $('#addGoal').onclick=()=>addGoalRow();
    function playerOptions(selected=''){return `<option value="">—</option>${players.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>#${esc(p.number)} ${esc(p.name)}</option>`).join('')}`;}
    function addGoalRow(g={minute:'',scorerId:'',assistPlayerId:''}){const row=document.createElement('div');row.className='goal-row';row.innerHTML=`<input class="goal-minute" type="number" min="0" max="150" placeholder="min" value="${esc(g.minute||'')}"><select class="goal-scorer">${playerOptions(g.scorerId)}</select><select class="goal-assist">${playerOptions(g.assistPlayerId)}</select><button type="button" class="btn danger small remove-goal">Ukloni</button>`;row.querySelector('.remove-goal').onclick=()=>row.remove();$('#goalsEditor').appendChild(row);}
    $('#matchForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{let image=m.image||'';const file=fd.get('imageFile');if(file?.size){$('#matchImageProgress').textContent='Obrađujem naslovnu fotografiju…';image=await uploadImage(currentYear,file,'match');}const status=fd.get('status');const events=status==='played'?$$('.goal-row',$('#goalsEditor')).map(r=>({type:'goal',minute:Number($('.goal-minute',r).value)||0,scorerId:$('.goal-scorer',r).value,assistPlayerId:$('.goal-assist',r).value})) : [];Object.assign(m,{year:currentYear,date:fd.get('date'),time:fd.get('time'),opponent:fd.get('opponent').trim(),competition:fd.get('competition').trim(),venue:fd.get('venue'),status,scoreAgainst:status==='played'?(Number(fd.get('scoreAgainst'))||0):null,lineup:fd.getAll('lineup'),events,videoId:videoIdFrom(fd.get('videoId')),image,note:fd.get('note').trim(),venueName:fd.get('venueName').trim(),address:fd.get('address').trim(),mapsUrl:fd.get('mapsUrl').trim(),latitude:fd.get('latitude').trim(),longitude:fd.get('longitude').trim()});if(existing)Object.assign(existing,m);else data.matches.push(m);setDirty();closeEditor();renderMatches();}catch(err){toast(err.message,'error',5000);}};
  }

  function renderGallery(){
    const items=yearGallery();
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Galerija ${currentYear}`,`Fotografije treninga, utakmica i ekipe`,`<button class="btn gold" id="addGallery">+ Dodaj fotografije</button>`)+`<div class="gallery-admin-grid">${items.length?items.map(g=>`<article class="gallery-admin-card"><img src="${esc(g.src)}" alt=""><div class="gallery-admin-copy"><b>${esc(g.caption||'Bez opisa')}</b><small>${esc(g.category||'ostalo')}</small><div class="gallery-admin-actions"><button class="btn ghost small" data-edit-gallery="${esc(g.id)}">Izmeni</button><button class="btn danger small" data-delete-gallery="${esc(g.id)}">Obriši</button></div></div></article>`).join(''):'<div class="empty-card">Još nema fotografija za ovo godište.</div>'}</div>`;
    $('#addGallery').onclick=()=>openGalleryEditor(); $$('[data-edit-gallery]').forEach(b=>b.onclick=()=>openGalleryEditor(b.dataset.editGallery)); $$('[data-delete-gallery]').forEach(b=>b.onclick=()=>{const g=data.gallery.find(x=>x.id===b.dataset.deleteGallery);if(g&&confirm('Ukloniti fotografiju iz galerije?')){data.gallery=data.gallery.filter(x=>x.id!==g.id);setDirty();renderGallery();}});
  }
  function openGalleryEditor(id=''){
    const existing=id?data.gallery.find(g=>g.id===id):null; const g=existing?clone(existing):{id:uid('g'),year:currentYear,category:'trening',src:'',caption:''};
    openEditor(`<span class="kicker">GALERIJA · ${currentYear}</span><h2>${existing?'Izmeni fotografiju':'Dodaj fotografije'}</h2><form id="galleryForm"><div class="form-grid"><label>Kategorija<select name="category">${['trening','utakmica','ekipa','teren','događaj'].map(x=>`<option ${g.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Opis<input name="caption" value="${esc(g.caption||'')}" placeholder="npr. Utakmica protiv Zemuna"></label><label class="full">${existing?'Nova fotografija (opciono)':'Fotografije'}<input name="files" type="file" accept="image/jpeg,image/png,image/webp" ${existing?'':'multiple'}><span class="hint">Možeš izabrati više slika odjednom. Svaka se automatski smanjuje na max 1600 px i kompresuje pre slanja.</span></label>${existing&&g.src?`<div class="full image-preview"><img src="${esc(g.src)}" alt=""><span class="hint">Trenutna fotografija</span></div>`:''}</div><div class="image-progress" id="galleryProgress"></div><div class="form-actions"><button type="button" class="btn ghost js-cancel">Otkaži</button><button class="btn gold" type="submit">Sačuvaj</button></div></form>`);
    $('#galleryForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const files=[...e.currentTarget.elements.files.files];const category=fd.get('category');const caption=fd.get('caption').trim();try{if(existing){let src=g.src;if(files[0])src=await uploadImage(currentYear,files[0],'gallery',$('#galleryProgress'));Object.assign(existing,{year:currentYear,category,caption,src});}else{if(!files.length)throw new Error('Izaberi bar jednu fotografiju.');for(let i=0;i<files.length;i++){const progress=$('#galleryProgress');progress.textContent=`Fotografija ${i+1}/${files.length}: obrađujem…`;const src=await uploadImage(currentYear,files[i],'gallery',progress);data.gallery.push({id:uid('g'),year:currentYear,category,src,caption:caption ? (files.length>1?`${caption} ${i+1}`:caption) : files[i].name.replace(/\.[^.]+$/,'')});}}setDirty();closeEditor();renderGallery();}catch(err){toast(err.message,'error',5000);}};
  }

  async function uploadImage(year,file,mode='gallery',progressEl=null){
    const original=file.size; const optimized=await optimizeImage(file,mode); if(progressEl)progressEl.textContent=`${bytes(original)} → ${bytes(optimized.size)} · šaljem na GitHub…`; toast(`Slika optimizovana: ${bytes(original)} → ${bytes(optimized.size)}`,'ok',1800);
    const contentBase64=await fileToBase64(optimized); const res=await api('/api/upload-image',{method:'POST',body:JSON.stringify({year,name:optimized.name,contentBase64})}); return res.path;
  }
  async function optimizeImage(file,mode){
    if(!file.type.startsWith('image/')) throw new Error('Izabrani fajl nije fotografija.');
    const img=await loadImage(file); let sw=img.naturalWidth||img.width, sh=img.naturalHeight||img.height; let sx=0,sy=0,cw=sw,ch=sh,tw,th;
    if(mode==='player'){tw=900;th=1200;const tr=tw/th, sr=sw/sh;if(sr>tr){cw=sh*tr;sx=(sw-cw)/2;}else{ch=sw/tr;sy=(sh-ch)/2;}}
    else if(mode==='match'){tw=1280;th=720;const tr=tw/th,sr=sw/sh;if(sr>tr){cw=sh*tr;sx=(sw-cw)/2;}else{ch=sw/tr;sy=(sh-ch)/2;}}
    else {const max=1600;const scale=Math.min(1,max/Math.max(sw,sh));tw=Math.max(1,Math.round(sw*scale));th=Math.max(1,Math.round(sh*scale));}
    const canvas=document.createElement('canvas');canvas.width=tw;canvas.height=th;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#111';ctx.fillRect(0,0,tw,th);ctx.drawImage(img,sx,sy,cw,ch,0,0,tw,th);
    let blob=await canvasBlob(canvas,'image/webp',mode==='gallery'?.82:.84); let ext='.webp';
    if(!blob){blob=await canvasBlob(canvas,'image/jpeg',.86);ext='.jpg';}
    if(!blob) throw new Error('Ne mogu da obradim fotografiju.');
    const base=(file.name||'foto').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)||'foto'; return new File([blob],`${base}${ext}`,{type:blob.type,lastModified:Date.now()});
  }
  function canvasBlob(canvas,type,quality){return new Promise(resolve=>canvas.toBlob(resolve,type,quality));}
  function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Ne mogu da otvorim fotografiju.'));};img.src=url;});}
  function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('Ne mogu da pročitam fajl.'));r.readAsDataURL(file);});}

  const modal=$('#editorModal');
  function openEditor(html){$('#editorContent').innerHTML=html;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');$$('.js-cancel',modal).forEach(b=>b.onclick=closeEditor);}
  function closeEditor(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');$('#editorContent').innerHTML='';document.body.classList.remove('modal-open');}
  $('#closeEditor').onclick=closeEditor; modal.addEventListener('click',e=>{if(e.target===modal)closeEditor();}); document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeEditor();});

  $('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`fk-sava-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);};
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.years||!x.matches||!x.gallery)throw new Error('JSON nije FK Sava backup.');data=x;syncYearSelects();setDirty();render();toast('Backup je učitan. Klikni „Objavi“ da ode na GitHub.');}catch(err){toast(err.message,'error');}e.target.value='';};
})();
