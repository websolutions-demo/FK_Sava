(() => {
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmtDate = iso => { if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}.`; };

  let apiUrl = localStorage.getItem('fksava_api_url') || 'https://fk-sava-admin-api.onrender.com';
  let token = sessionStorage.getItem('fksava_admin_token') || '';
  let data = null;
  let currentYear = 2016;
  let currentTab = 'players';
  let isDirty = false;

  const loginShell=$('#loginShell'), adminApp=$('#adminApp'), apiUrlInput=$('#apiUrl'), passwordInput=$('#adminPassword'), loginStatus=$('#loginStatus');
  apiUrlInput.value=apiUrl;

  function toast(message,type='ok'){
    const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=message; document.body.appendChild(t); setTimeout(()=>t.remove(),3200);
  }
  function setDirty(v=true){
    isDirty=v; const el=$('#saveState'); if(!el) return; el.textContent=v?'Neobjavljene promene':'Sačuvano'; el.classList.toggle('dirty',v);
  }
  async function api(path, options={}){
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
    await loadRemote();
  }
  async function loadRemote(){
    const res=await api('/api/club-data');
    data=res.data || res;
    if(!data?.years) throw new Error('club-data.json nema očekivanu strukturu.');
    currentYear = data.years.some(y=>Number(y.year)===Number(currentYear)) ? currentYear : Number(data.years[0]?.year || 2016);
    openApp(); setDirty(false); render();
  }
  function openApp(){
    loginShell.hidden=true; adminApp.hidden=false;
    $('#seasonLabel').textContent=data.meta?.season || '';
    const select=$('#yearSelect'); select.innerHTML=data.years.map(y=>`<option value="${esc(y.year)}" ${Number(y.year)===Number(currentYear)?'selected':''}>${esc(y.year)}</option>`).join('');
  }

  $('#loginBtn').onclick=async()=>{ try{ await login(passwordInput.value); loginStatus.textContent=''; passwordInput.value=''; }catch(e){ loginStatus.textContent=e.message; } };
  passwordInput.addEventListener('keydown',e=>{ if(e.key==='Enter') $('#loginBtn').click(); });

  // try session token
  if(token){ loadRemote().catch(()=>{ token=''; sessionStorage.removeItem('fksava_admin_token'); loginShell.hidden=false; }); }

  $('#yearSelect').onchange=e=>{currentYear=Number(e.target.value);render();};
  $$('.admin-tabs button').forEach(b=>b.onclick=()=>{ currentTab=b.dataset.tab; $$('.admin-tabs button').forEach(x=>x.classList.toggle('active',x===b)); render(); });
  $('#reloadBtn').onclick=async()=>{
    if(isDirty && !confirm('Neobjavljene izmene će biti izgubljene. Učitati podatke sa GitHub-a?')) return;
    try{ await loadRemote(); toast('Učitani su najnoviji podaci sa GitHub-a.'); }catch(e){ toast(e.message,'error'); }
  };
  $('#publishBtn').onclick=async()=>{
    try{
      $('#publishBtn').disabled=true; $('#publishBtn').textContent='Objavljujem…';
      data.meta=data.meta||{}; data.meta.updatedAt=new Date().toISOString(); data.meta.schemaVersion=2;
      const res=await api('/api/club-data',{method:'PUT',body:JSON.stringify({data})});
      setDirty(false); toast(`Objavljeno ✓ ${res.commitSha ? res.commitSha.slice(0,7) : ''}`);
    }catch(e){ toast(e.message,'error'); }
    finally{$('#publishBtn').disabled=false;$('#publishBtn').textContent='Objavi promene';}
  };

  function group(){ return data.years.find(y=>Number(y.year)===Number(currentYear)); }
  function yearMatches(){ return data.matches.filter(m=>Number(m.year)===Number(currentYear)); }
  function yearGallery(){ return data.gallery.filter(g=>Number(g.year)===Number(currentYear)); }
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

  function render(){ if(!data) return; if(currentTab==='matches') renderMatches(); else if(currentTab==='gallery') renderGallery(); else renderPlayers(); }
  function head(kicker,titleText,sub,button=''){
    return `<div class="workspace-head"><div><span class="kicker">${esc(kicker)}</span><h1>${esc(titleText)}</h1><p>${esc(sub)}</p></div>${button}</div>`;
  }
  function renderPlayers(){
    const g=group(); const players=g.players||[];
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Igrači ${currentYear}`,`${g.coach || 'Trener nije upisan'} · statistika iz utakmica`,`<button class="btn gold" id="addPlayer">+ Dodaj igrača</button>`)+`
      <table class="data-table"><thead><tr><th>#</th><th>Igrač</th><th>Pozicija</th><th>Nastupi</th><th>Golovi</th><th>Asist.</th><th></th></tr></thead><tbody>${players.map(p=>{const s=statsFor(p.id);return `<tr><td class="num">${esc(p.number)}</td><td><b>${esc(p.name)}</b>${p.active===false?'<br><span class="pill">neaktivan</span>':''}</td><td>${esc(p.position)}</td><td class="num">${s.appearances}</td><td class="num">${s.goals}</td><td class="num">${s.assists}</td><td class="actions"><button class="btn ghost small" data-edit-player="${esc(p.id)}">Izmeni</button> <button class="btn danger small" data-delete-player="${esc(p.id)}">Obriši</button></td></tr>`}).join('')}</tbody></table>`;
    $('#addPlayer').onclick=()=>openPlayerEditor();
    $$('[data-edit-player]').forEach(b=>b.onclick=()=>openPlayerEditor(b.dataset.editPlayer));
    $$('[data-delete-player]').forEach(b=>b.onclick=()=>deletePlayer(b.dataset.deletePlayer));
  }
  function deletePlayer(id){
    const p=group().players.find(p=>p.id===id); if(!p) return;
    const used=yearMatches().some(m=>(m.lineup||[]).includes(id)||(m.events||[]).some(e=>e.scorerId===id||e.assistPlayerId===id));
    if(used){ alert('Igrač se koristi u utakmicama. Umesto brisanja označi ga kao neaktivnog ili prvo ukloni iz utakmica.'); return; }
    if(confirm(`Obrisati igrača ${p.name}?`)){ group().players=group().players.filter(x=>x.id!==id); setDirty(); renderPlayers(); }
  }

  function openPlayerEditor(id=''){
    const existing=id?group().players.find(p=>p.id===id):null; const p=existing?clone(existing):{id:uid(String(currentYear)),name:'',number:'',position:'Vezni',photo:'',active:true,note:''};
    openEditor(`<span class="kicker">IGRAČ · ${currentYear}</span><h2>${existing?'Izmeni igrača':'Dodaj igrača'}</h2><form id="playerForm"><div class="form-grid">
      <label>Ime i prezime<input name="name" required value="${esc(p.name)}"></label><label>Broj<input name="number" type="number" min="0" max="99" required value="${esc(p.number)}"></label>
      <label>Pozicija<select name="position">${['Golman','Odbrana','Vezni','Napadač'].map(x=>`<option ${p.position===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Aktivan<select name="active"><option value="true" ${p.active!==false?'selected':''}>Da</option><option value="false" ${p.active===false?'selected':''}>Ne</option></select></label>
      <label class="full">Putanja fotografije<input name="photo" value="${esc(p.photo||'')}" placeholder="assets/uploads/${currentYear}/igrac.jpg"></label><label class="full">Ili učitaj fotografiju<input name="photoFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="hint">Slika će biti sačuvana direktno u GitHub repo.</span></label>
      <label class="full">Napomena<textarea name="note" rows="3">${esc(p.note||'')}</textarea></label></div><div class="form-actions"><button type="button" class="btn ghost js-cancel">Otkaži</button><button class="btn gold" type="submit">Sačuvaj igrača</button></div></form>`);
    $('#playerForm').onsubmit=async e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget); try{
        let photo=fd.get('photo').trim(); const file=fd.get('photoFile'); if(file?.size) photo=await uploadImage(currentYear,file);
        Object.assign(p,{name:fd.get('name').trim(),number:Number(fd.get('number')),position:fd.get('position'),active:fd.get('active')==='true',photo,note:fd.get('note').trim()});
        if(existing) Object.assign(existing,p); else group().players.push(p);
        setDirty(); closeEditor(); renderPlayers();
      }catch(err){toast(err.message,'error');}
    };
  }

  function renderMatches(){
    const list=[...yearMatches()].sort((a,b)=>`${b.date}T${b.time||''}`.localeCompare(`${a.date}T${a.time||''}`));
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Utakmice ${currentYear}`,`Rezultati, najave, sastav, strelci i YouTube`,`<button class="btn gold" id="addMatch">+ Dodaj utakmicu</button>`)+`<div class="cards-list">${list.length?list.map(m=>`<article class="match-admin-card"><div class="date"><b>${esc(fmtDate(m.date))}</b><small>${esc(m.time||'')} · ${esc(m.competition||'')}</small></div><div><h3>${esc(title(m))}</h3><p>${(m.events||[]).filter(e=>e.type==='goal').length} upisana gola · ${(m.lineup||[]).length} igrača u sastavu</p></div><div><span class="pill ${esc(m.status)}">${esc(m.status==='played'?'ODIGRANA':m.status==='postponed'?'ODLOŽENA':'NAJAVA')}</span><div class="score-box">${esc(result(m))}</div></div><div class="actions"><button class="btn ghost small" data-edit-match="${esc(m.id)}">Izmeni</button> <button class="btn danger small" data-delete-match="${esc(m.id)}">Obriši</button></div></article>`).join(''):'<p class="muted">Još nema utakmica za ovo godište.</p>'}</div>`;
    $('#addMatch').onclick=()=>openMatchEditor();
    $$('[data-edit-match]').forEach(b=>b.onclick=()=>openMatchEditor(b.dataset.editMatch));
    $$('[data-delete-match]').forEach(b=>b.onclick=()=>{const m=data.matches.find(x=>x.id===b.dataset.deleteMatch);if(m&&confirm(`Obrisati utakmicu ${title(m)}?`)){data.matches=data.matches.filter(x=>x.id!==m.id);setDirty();renderMatches();}});
  }

  function openMatchEditor(id=''){
    const existing=id?data.matches.find(m=>m.id===id):null; const m=existing?clone(existing):{id:uid(`${currentYear}-m`),year:currentYear,date:new Date().toISOString().slice(0,10),time:'10:00',competition:'Prijateljska utakmica',venue:'home',opponent:'',status:'upcoming',scoreAgainst:null,lineup:[],events:[],videoId:'',image:'',note:''};
    const players=group().players||[];
    openEditor(`<span class="kicker">UTAKMICA · ${currentYear}</span><h2>${existing?'Izmeni utakmicu':'Dodaj utakmicu'}</h2><form id="matchForm"><div class="form-grid">
      <label>Datum<input name="date" type="date" required value="${esc(m.date)}"></label><label>Vreme<input name="time" type="time" value="${esc(m.time||'')}"></label>
      <label>Protivnik<input name="opponent" required value="${esc(m.opponent||'')}"></label><label>Takmičenje<input name="competition" value="${esc(m.competition||'')}"></label>
      <label>Domaćin<select name="venue"><option value="home" ${m.venue!=='away'?'selected':''}>FK Sava domaćin</option><option value="away" ${m.venue==='away'?'selected':''}>FK Sava gost</option></select></label><label>Status<select name="status"><option value="upcoming" ${m.status==='upcoming'?'selected':''}>Najavljena</option><option value="played" ${m.status==='played'?'selected':''}>Odigrana</option><option value="postponed" ${m.status==='postponed'?'selected':''}>Odložena</option></select></label>
      <label>Golovi protivnika<input name="scoreAgainst" type="number" min="0" value="${m.scoreAgainst??''}" placeholder="samo za odigranu"></label><label>YouTube video ID<input name="videoId" value="${esc(m.videoId||'')}" placeholder="npr. ACb081-H7eE"></label>
      <label class="full">Naslovna slika / putanja<input name="image" value="${esc(m.image||'')}" placeholder="assets/uploads/${currentYear}/match.jpg"></label><label class="full">Ili učitaj naslovnu sliku<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <label class="full">Napomena<textarea name="note" rows="2">${esc(m.note||'')}</textarea></label>
      <div class="full"><b>Sastav / nastupi</b><p class="hint">Označen igrač dobija jedan nastup kada je status utakmice „Odigrana“.</p><div class="lineup-grid">${players.map(p=>`<label class="check-player"><input type="checkbox" name="lineup" value="${esc(p.id)}" ${(m.lineup||[]).includes(p.id)?'checked':''}> #${esc(p.number)} ${esc(p.name)}</label>`).join('')}</div></div>
      <div class="full"><b>Golovi FK Sava</b><p class="hint">Rezultat FK Sava se automatski računa iz broja ovih redova. Strelac može ostati prazan kod autogola/nepoznatog strelca.</p><div class="goals-editor" id="goalsEditor"></div><button type="button" class="btn ghost small" id="addGoal">+ Dodaj gol</button></div>
    </div><div class="form-actions"><button type="button" class="btn ghost js-cancel">Otkaži</button><button class="btn gold" type="submit">Sačuvaj utakmicu</button></div></form>`);
    const goals=m.events?.filter(e=>e.type==='goal')||[]; goals.forEach(addGoalRow); if(!goals.length&&m.status==='played') addGoalRow();
    $('#addGoal').onclick=()=>addGoalRow();
    function playerOptions(selected='',allowEmpty=true){return `${allowEmpty?'<option value="">—</option>':''}${players.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>#${esc(p.number)} ${esc(p.name)}</option>`).join('')}`;}
    function addGoalRow(g={minute:'',scorerId:'',assistPlayerId:''}){
      const row=document.createElement('div');row.className='goal-row';row.innerHTML=`<input class="goal-minute" type="number" min="0" max="150" placeholder="min" value="${esc(g.minute||'')}"><select class="goal-scorer">${playerOptions(g.scorerId)}</select><select class="goal-assist">${playerOptions(g.assistPlayerId)}</select><button type="button" class="btn danger small remove-goal">Ukloni</button>`;row.querySelector('.remove-goal').onclick=()=>row.remove();$('#goalsEditor').appendChild(row);
    }
    $('#matchForm').onsubmit=async e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget); try{
        let image=fd.get('image').trim(); const file=fd.get('imageFile'); if(file?.size) image=await uploadImage(currentYear,file);
        const status=fd.get('status'); const events=status==='played'?$$('.goal-row',$('#goalsEditor')).map(r=>({type:'goal',minute:Number($('.goal-minute',r).value)||0,scorerId:$('.goal-scorer',r).value,assistPlayerId:$('.goal-assist',r).value})):[];
        Object.assign(m,{year:currentYear,date:fd.get('date'),time:fd.get('time'),opponent:fd.get('opponent').trim(),competition:fd.get('competition').trim(),venue:fd.get('venue'),status,scoreAgainst:status==='played'?(Number(fd.get('scoreAgainst'))||0):null,lineup:fd.getAll('lineup'),events,videoId:fd.get('videoId').trim(),image,note:fd.get('note').trim()});
        if(existing) Object.assign(existing,m); else data.matches.push(m);
        setDirty(); closeEditor(); renderMatches();
      }catch(err){toast(err.message,'error');}
    };
  }

  function renderGallery(){
    const items=yearGallery();
    $('#workspaceContent').innerHTML=head(`GODIŠTE ${currentYear}`,`Galerija ${currentYear}`,`Fotografije treninga, utakmica i ekipe`,`<button class="btn gold" id="addGallery">+ Dodaj fotografiju</button>`)+`<div class="gallery-admin-grid">${items.length?items.map(g=>`<article class="gallery-admin-card"><img src="${esc(g.src)}" alt=""><div class="gallery-admin-copy"><b>${esc(g.caption||'Bez opisa')}</b><small>${esc(g.category||'ostalo')}</small><div class="gallery-admin-actions"><button class="btn ghost small" data-edit-gallery="${esc(g.id)}">Izmeni</button><button class="btn danger small" data-delete-gallery="${esc(g.id)}">Obriši</button></div></div></article>`).join(''):'<p class="muted">Još nema fotografija za ovo godište.</p>'}</div>`;
    $('#addGallery').onclick=()=>openGalleryEditor();
    $$('[data-edit-gallery]').forEach(b=>b.onclick=()=>openGalleryEditor(b.dataset.editGallery));
    $$('[data-delete-gallery]').forEach(b=>b.onclick=()=>{const g=data.gallery.find(x=>x.id===b.dataset.deleteGallery);if(g&&confirm('Ukloniti fotografiju iz galerije? (Fajl ostaje u GitHub repozitorijumu.)')){data.gallery=data.gallery.filter(x=>x.id!==g.id);setDirty();renderGallery();}});
  }
  function openGalleryEditor(id=''){
    const existing=id?data.gallery.find(g=>g.id===id):null; const g=existing?clone(existing):{id:uid('g'),year:currentYear,category:'trening',src:'',caption:''};
    openEditor(`<span class="kicker">GALERIJA · ${currentYear}</span><h2>${existing?'Izmeni fotografiju':'Dodaj fotografiju'}</h2><form id="galleryForm"><div class="form-grid"><label>Kategorija<select name="category">${['trening','utakmica','ekipa','teren','događaj'].map(x=>`<option ${g.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Opis<input name="caption" value="${esc(g.caption||'')}"></label><label class="full">Postojeća putanja slike<input name="src" value="${esc(g.src||'')}" placeholder="assets/uploads/${currentYear}/slika.jpg"></label><label class="full">Ili učitaj novu fotografiju<input name="file" type="file" accept="image/jpeg,image/png,image/webp"><span class="hint">Do 5 MB. JPG, PNG ili WEBP.</span></label></div><div class="form-actions"><button type="button" class="btn ghost js-cancel">Otkaži</button><button class="btn gold" type="submit">Sačuvaj fotografiju</button></div></form>`);
    $('#galleryForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{let src=fd.get('src').trim();const f=fd.get('file');if(f?.size)src=await uploadImage(currentYear,f);if(!src)throw new Error('Izaberi sliku ili upiši putanju.');Object.assign(g,{year:currentYear,category:fd.get('category'),caption:fd.get('caption').trim(),src});if(existing)Object.assign(existing,g);else data.gallery.push(g);setDirty();closeEditor();renderGallery();}catch(err){toast(err.message,'error');}};
  }

  async function uploadImage(year,file){
    if(file.size>5*1024*1024) throw new Error('Slika je veća od 5 MB.');
    const contentBase64=await fileToBase64(file);
    toast('Učitavam sliku na GitHub…');
    const res=await api('/api/upload-image',{method:'POST',body:JSON.stringify({year,name:file.name,contentBase64})});
    return res.path;
  }
  function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('Ne mogu da pročitam fajl.'));r.readAsDataURL(file);});}

  const modal=$('#editorModal');
  function openEditor(html){$('#editorContent').innerHTML=html;modal.classList.add('open');modal.setAttribute('aria-hidden','false');$$('.js-cancel',modal).forEach(b=>b.onclick=closeEditor);}
  function closeEditor(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');$('#editorContent').innerHTML='';}
  $('#closeEditor').onclick=closeEditor; modal.addEventListener('click',e=>{if(e.target===modal)closeEditor();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeEditor();});

  $('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`fk-sava-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);};
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x.years||!x.matches||!x.gallery)throw new Error('JSON nije FK Sava backup.');data=x;setDirty();openApp();render();toast('Backup je učitan lokalno. Klikni „Objavi promene“ da ode na GitHub.');}catch(err){toast(err.message,'error');}e.target.value='';};
})();
