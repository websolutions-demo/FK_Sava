(async () => {
  const qs = (s, c=document) => c.querySelector(s);
  const qsa = (s, c=document) => [...c.querySelectorAll(s)];
  const body = document.body;
  const fallback = window.FKSAVA_DATA || {club:{}, years:[], matches:[], gallery:[]};

  async function loadData(){
    try {
      const r = await fetch(`club-data.json?v=${Date.now()}`, {cache:'no-store'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn('FK Sava: club-data.json nije dostupan, koristim ugrađeni fallback.', e);
      return fallback;
    }
  }
  const data = await loadData();
  const club = data.club || {};
  const years = Array.isArray(data.years) ? data.years : [];
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const gallery = Array.isArray(data.gallery) ? data.gallery : [];

  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safeSrc = v => esc(String(v || '').replace(/^javascript:/i,''));
  const byDateAsc = (a,b) => `${a.date||''}T${a.time||''}`.localeCompare(`${b.date||''}T${b.time||''}`);
  const byDateDesc = (a,b) => byDateAsc(b,a);
  const fmtDate = iso => {
    if(!iso) return '';
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}.`;
  };
  const groupFor = year => years.find(y => Number(y.year) === Number(year));
  const matchesFor = year => matches.filter(m => Number(m.year) === Number(year));
  const galleryFor = year => gallery.filter(g => g.year == null || Number(g.year) === Number(year));
  const scoreFor = m => (m.events || []).filter(e => e.type === 'goal').length;
  const playerStats = (year, playerId) => {
    const played = matchesFor(year).filter(m => m.status === 'played');
    return {
      appearances: played.filter(m => (m.lineup || []).includes(playerId)).length,
      goals: played.reduce((n,m) => n + (m.events || []).filter(e => e.type === 'goal' && e.scorerId === playerId).length, 0),
      assists: played.reduce((n,m) => n + (m.events || []).filter(e => e.type === 'goal' && e.assistPlayerId === playerId).length, 0)
    };
  };
  const playerName = (year,id) => {
    if(!id) return 'Autogol / nije upisano';
    const p = groupFor(year)?.players?.find(p => p.id === id);
    return p ? `${p.name} (#${p.number})` : 'Nepoznat igrač';
  };
  const matchTitle = m => m.venue === 'away' ? `${m.opponent} – FK Sava` : `FK Sava – ${m.opponent}`;
  const resultText = m => m.status === 'played'
    ? (m.venue === 'away' ? `${m.scoreAgainst ?? 0} : ${scoreFor(m)}` : `${scoreFor(m)} : ${m.scoreAgainst ?? 0}`)
    : (m.status === 'postponed' ? 'ODLOŽENO' : 'USKORO');

  // Mobile menu
  const menuBtn = qs('#menuBtn');
  const mobileMenu = qs('#mobileMenu');
  menuBtn?.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden', String(!open));
  });
  qsa('#mobileMenu a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded','false');
  }));

  // Age cards
  const agesStrip = qs('#agesStrip');
  years.forEach(group => {
    const card = document.createElement('button');
    card.className = 'age-card';
    card.innerHTML = `<img src="${safeSrc(group.image)}" alt="Godište ${esc(group.year)}" loading="lazy"><span>${esc(group.year)}</span><small>Pogledaj ekipu</small>`;
    card.addEventListener('click', () => openAge(group.year));
    agesStrip?.appendChild(card);
  });

  // Age drawer
  const drawer = qs('#ageDrawer');
  const backdrop = qs('#ageBackdrop');
  const drawerContent = qs('#ageDrawerContent');
  let activeYear = null;

  function openAge(year, tab='players'){
    activeYear = Number(year);
    if(tab === 'matches') renderAgeMatches(activeYear);
    else if(tab === 'gallery') renderAgeGallery(activeYear);
    else renderTeam(activeYear);
    drawer.classList.add('open'); backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden','false'); body.classList.add('no-scroll');
  }
  function closeAge(){
    drawer.classList.remove('open'); backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden','true'); body.classList.remove('no-scroll');
  }
  function tabs(year, active){
    return `<div class="drawer-tabs">
      <button data-age-tab="players" class="${active==='players'?'active':''}">Igrači</button>
      <button data-age-tab="matches" class="${active==='matches'?'active':''}">Utakmice</button>
      <button data-age-tab="gallery" class="${active==='gallery'?'active':''}">Galerija</button>
    </div>`;
  }
  function bindTabs(year){
    qsa('[data-age-tab]', drawerContent).forEach(b => b.onclick = () => {
      const t=b.dataset.ageTab;
      if(t==='matches') renderAgeMatches(year);
      else if(t==='gallery') renderAgeGallery(year);
      else renderTeam(year);
    });
  }
  function drawerHead(group, extra=''){
    return `<div class="drawer-head"><div><span class="section-kicker">GODIŠTE ${esc(group.year)}</span><h2>Ekipa ${esc(group.year)}</h2><p>${esc(group.coach || 'Trener — podatak kluba')} ${extra}</p></div><span class="demo-badge">SEZONA ${esc(data.meta?.season || '')}</span></div>`;
  }
  function playerVisual(p, large=false){
    if(p.photo) return `<div class="player-photo ${large?'large':''}"><img src="${safeSrc(p.photo)}" alt="${esc(p.name)}"></div>`;
    return `<div class="jersey-avatar ${large?'large':''}"><span>${esc(p.number)}</span></div>`;
  }
  function renderTeam(year){
    const group = groupFor(year); if(!group) return;
    const players=(group.players||[]).filter(p=>p.active!==false);
    drawerContent.innerHTML = `${drawerHead(group, `· ${players.length} igrača`)}${tabs(year,'players')}
      <div class="players-row">${players.map(p => {
        const s=playerStats(year,p.id);
        return `<button class="player-card" data-player="${esc(p.id)}">${playerVisual(p)}<b>${esc(p.name)}</b><small>#${esc(p.number)} · ${esc(p.position)}</small><span class="mini-stats">${s.appearances} U · ${s.goals} G · ${s.assists} A</span></button>`;
      }).join('')}</div>
      <p class="drawer-hint">Statistika se automatski računa iz odigranih utakmica i unetih strelaca/asistenata.</p>`;
    bindTabs(year);
    qsa('.player-card', drawerContent).forEach(btn => btn.addEventListener('click', () => renderPlayer(year, btn.dataset.player)));
  }
  function renderPlayer(year, playerId){
    const group=groupFor(year); const p=group?.players?.find(p=>p.id===playerId); if(!p) return;
    const s=playerStats(year,playerId);
    drawerContent.innerHTML = `<button class="back-link" id="backToTeam">← ${esc(year)}. godište</button>
      <div class="player-detail">${playerVisual(p,true)}
        <div class="player-main"><span class="section-kicker">IGRAČ · ${esc(year)}</span><h2>${esc(p.name)}</h2><p>#${esc(p.number)} · ${esc(p.position)}</p><small>${esc(p.note || '')}</small></div>
        <div class="stats-grid"><div><b>${s.appearances}</b><span>Utakmice</span></div><div><b>${s.goals}</b><span>Golovi</span></div><div><b>${s.assists}</b><span>Asistencije</span></div></div>
      </div><div class="player-bottom"><button class="btn btn-gold" id="backToTeam2">Cela ekipa</button><button class="btn btn-dark" id="playerMatches">Utakmice godišta</button></div>`;
    qs('#backToTeam').onclick = () => renderTeam(year);
    qs('#backToTeam2').onclick = () => renderTeam(year);
    qs('#playerMatches').onclick = () => renderAgeMatches(year);
  }
  function matchRows(list, year){
    if(!list.length) return `<div class="empty-state">Još nema unetih utakmica.</div>`;
    return `<div class="team-match-list">${list.map(m=>`<button class="team-match-row" data-match-id="${esc(m.id)}"><span><b>${esc(fmtDate(m.date))}</b><small>${esc(m.time || '')} · ${esc(m.competition || '')}</small></span><span class="match-opponent">${esc(matchTitle(m))}</span><strong class="${m.status==='played'?'result-played':'result-upcoming'}">${esc(resultText(m))}</strong></button>`).join('')}</div>`;
  }
  function renderAgeMatches(year){
    const group=groupFor(year); if(!group) return;
    const all=matchesFor(year);
    const played=all.filter(m=>m.status==='played').sort(byDateDesc);
    const upcoming=all.filter(m=>m.status!=='played').sort(byDateAsc);
    drawerContent.innerHTML = `${drawerHead(group, `· ${all.length} utakmica`)}${tabs(year,'matches')}
      <div class="age-match-columns"><section><h3>Rezultati</h3>${matchRows(played,year)}</section><section><h3>U najavi</h3>${matchRows(upcoming,year)}</section></div>`;
    bindTabs(year);
    qsa('[data-match-id]',drawerContent).forEach(b=>b.onclick=()=>renderMatchDetail(year,b.dataset.matchId));
  }
  function renderMatchDetail(year,id){
    const m=matches.find(m=>m.id===id); if(!m) return;
    const goals=(m.events||[]).filter(e=>e.type==='goal');
    drawerContent.innerHTML = `<button class="back-link" id="backToMatches">← Utakmice ${esc(year)}</button>
      <div class="match-detail">
        <span class="section-kicker">${esc(m.competition || 'UTAKMICA')} · ${esc(fmtDate(m.date))}</span>
        <h2>${esc(matchTitle(m))}</h2>
        <div class="big-score">${esc(resultText(m))}</div>
        ${m.status==='played' ? `<div class="goal-list"><h3>Golovi FK Sava</h3>${goals.length?goals.map(g=>`<div><b>⚽ ${esc(g.minute || '?')}'</b><span>${esc(playerName(year,g.scorerId))}${g.assistPlayerId?` · asist. ${esc(playerName(year,g.assistPlayerId))}`:''}</span></div>`).join(''):'<p>Nema unetih strelaca.</p>'}</div>` : `<p class="upcoming-note">${esc(m.note || 'Najavljena utakmica.')}</p>`}
        <div class="player-bottom">${m.videoId?`<button class="btn btn-youtube" id="matchVideoBtn">▶ Pogledaj video</button>`:''}<button class="btn btn-dark" id="backToMatches2">Nazad na tabelu</button></div>
      </div>`;
    qs('#backToMatches').onclick=()=>renderAgeMatches(year);
    qs('#backToMatches2').onclick=()=>renderAgeMatches(year);
    if(m.videoId) qs('#matchVideoBtn').onclick=()=>openMatchModal(m);
  }
  function renderAgeGallery(year){
    const group=groupFor(year); if(!group) return;
    const items=galleryFor(year);
    drawerContent.innerHTML = `${drawerHead(group, `· ${items.length} fotografija`)}${tabs(year,'gallery')}
      ${items.length?`<div class="drawer-gallery">${items.map((g,i)=>`<button data-team-gallery="${i}"><img src="${safeSrc(g.src)}" alt="${esc(g.caption || '')}"><span>${esc(g.caption || '')}</span></button>`).join('')}</div>`:'<div class="empty-state">Još nema fotografija za ovo godište.</div>'}`;
    bindTabs(year);
    qsa('[data-team-gallery]',drawerContent).forEach(b=>b.onclick=()=>openLightbox(Number(b.dataset.teamGallery),items));
  }
  qs('#ageClose')?.addEventListener('click', closeAge);
  backdrop?.addEventListener('click', closeAge);

  // Global matches
  const matchesGrid=qs('#matchesGrid');
  const featured=[...matches].sort(byDateDesc).slice(0,4);
  featured.forEach(m=>{
    const card=document.createElement('button'); card.className='match-card';
    card.innerHTML=`<div class="match-thumb"><img src="${safeSrc(m.image || 'assets/images/match1.jpg')}" alt="" loading="lazy"><span class="play">${m.videoId?'▶':'⚽'}</span></div><div class="match-copy"><b>${esc(matchTitle(m))}</b><span>${esc(m.year)} · ${esc(fmtDate(m.date))} · ${esc(resultText(m))}</span><p>${esc(m.competition || m.note || '')}</p></div>`;
    card.onclick=()=>openMatchModal(m); matchesGrid?.appendChild(card);
  });
  const videoModal=qs('#videoModal'), videoContent=qs('#videoContent');
  function openMatchModal(m){
    const media=m.videoId?`<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.videoId)}?rel=0" title="${esc(matchTitle(m))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`:`<div class="video-placeholder" style="background-image:url('${safeSrc(m.image || 'assets/images/match1.jpg')}')"><span>⚽</span><small>${esc(m.status==='upcoming'?'Utakmica je u najavi':'Video još nije dodat')}</small></div>`;
    const goals=(m.events||[]).filter(e=>e.type==='goal');
    videoContent.innerHTML=`${media}<div class="video-info"><span class="section-kicker">${esc(m.year)} · ${esc(fmtDate(m.date))}</span><h2 id="videoTitle">${esc(matchTitle(m))}</h2><div class="modal-result">${esc(resultText(m))}</div>${goals.length?`<p>${goals.map(g=>`⚽ ${esc(g.minute)}' ${esc(playerName(m.year,g.scorerId))}`).join('<br>')}</p>`:''}${m.videoId?`<a class="btn btn-youtube" href="https://www.youtube.com/watch?v=${encodeURIComponent(m.videoId)}" target="_blank" rel="noopener">▶ Otvori na YouTube-u</a>`:`<a class="btn btn-dark" href="${esc(club.youtubeSearch || '#')}" target="_blank" rel="noopener">YouTube kanal / pretraga</a>`}</div>`;
    videoModal.classList.add('open'); videoModal.setAttribute('aria-hidden','false'); body.classList.add('no-scroll');
  }
  function closeVideo(){ videoModal.classList.remove('open'); videoModal.setAttribute('aria-hidden','true'); videoContent.innerHTML=''; body.classList.remove('no-scroll'); }
  qsa('.js-close-video').forEach(b=>b.addEventListener('click',closeVideo));
  videoModal?.addEventListener('click',e=>{if(e.target===videoModal) closeVideo();});

  // Gallery/lightbox
  const galleryGrid=qs('#galleryGrid');
  let lightIndex=0, lightItems=gallery;
  gallery.forEach((g,i)=>{
    const btn=document.createElement('button'); btn.className='gallery-item';
    btn.innerHTML=`<img src="${safeSrc(g.src)}" alt="${esc(g.caption || `FK Sava galerija ${i+1}`)}" loading="lazy">`;
    btn.onclick=()=>openLightbox(i,gallery); galleryGrid?.appendChild(btn);
  });
  const lightbox=qs('#lightbox'), lightImg=qs('#lightboxImage');
  function openLightbox(i,items=gallery){ lightItems=items; lightIndex=i; lightImg.src=lightItems[i]?.src || ''; lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden','false'); body.classList.add('no-scroll'); }
  function closeLightbox(){ lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden','true'); body.classList.remove('no-scroll'); }
  function moveLight(step){ if(!lightItems.length) return; lightIndex=(lightIndex+step+lightItems.length)%lightItems.length; lightImg.src=lightItems[lightIndex].src; }
  qs('#lightPrev').onclick=()=>moveLight(-1); qs('#lightNext').onclick=()=>moveLight(1);
  qsa('.js-close-lightbox').forEach(b=>b.addEventListener('click',closeLightbox));
  lightbox?.addEventListener('click',e=>{if(e.target===lightbox) closeLightbox();});

  // Enrollment
  const enrollModal=qs('#enrollModal'), yearSelect=qs('#enrollForm select[name="year"]');
  years.forEach(y=>{ const o=document.createElement('option'); o.value=y.year; o.textContent=y.year; yearSelect?.appendChild(o); });
  function openEnroll(){ enrollModal.classList.add('open'); enrollModal.setAttribute('aria-hidden','false'); body.classList.add('no-scroll'); const card=enrollModal.querySelector('.enroll-card'); if(card) card.scrollTop=0; if(window.matchMedia('(min-width: 721px)').matches) setTimeout(()=>qs('#enrollForm input')?.focus(),100); }
  function closeEnroll(){ enrollModal.classList.remove('open'); enrollModal.setAttribute('aria-hidden','true'); body.classList.remove('no-scroll'); }
  qsa('.js-open-enroll').forEach(b=>b.addEventListener('click',openEnroll));
  qsa('.js-close-enroll').forEach(b=>b.addEventListener('click',closeEnroll));
  enrollModal?.addEventListener('click',e=>{if(e.target===enrollModal) closeEnroll();});
  qs('#enrollForm')?.addEventListener('submit',e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    const msg=`FK Sava — prijava deteta\nRoditelj: ${fd.get('parent')}\nTelefon: ${fd.get('phone')}\nGodište deteta: ${fd.get('year')}\n${fd.get('note') ? `Poruka: ${fd.get('note')}` : ''}`;
    window.location.href=`sms:${club.phoneTel || '+381652518845'}?&body=${encodeURIComponent(msg)}`;
  });

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    if(drawer?.classList.contains('open')) closeAge();
    if(videoModal?.classList.contains('open')) closeVideo();
    if(lightbox?.classList.contains('open')) closeLightbox();
    if(enrollModal?.classList.contains('open')) closeEnroll();
  });
})();
