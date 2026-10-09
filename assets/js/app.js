(() => {
  const data = window.FKSAVA_DATA;
  const qs = (s, c=document) => c.querySelector(s);
  const qsa = (s, c=document) => [...c.querySelectorAll(s)];
  const body = document.body;

  // Mobile menu
  const menuBtn = qs('#menuBtn');
  const mobileMenu = qs('#mobileMenu');
  menuBtn.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden', String(!open));
  });
  qsa('#mobileMenu a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
  }));

  // Age cards
  const agesStrip = qs('#agesStrip');
  data.years.forEach(group => {
    const card = document.createElement('button');
    card.className = 'age-card';
    card.innerHTML = `<img src="${group.image}" alt="Godište ${group.year}" loading="lazy"><span>${group.year}</span><small>Pogledaj ekipu</small>`;
    card.addEventListener('click', () => openAge(group.year));
    agesStrip.appendChild(card);
  });

  // Age drawer + player detail
  const drawer = qs('#ageDrawer');
  const backdrop = qs('#ageBackdrop');
  const drawerContent = qs('#ageDrawerContent');
  let activeYear = null;

  function openAge(year){
    activeYear = year;
    renderTeam(year);
    drawer.classList.add('open'); backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden','false'); body.classList.add('no-scroll');
  }
  function closeAge(){
    drawer.classList.remove('open'); backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden','true'); body.classList.remove('no-scroll');
  }
  function renderTeam(year){
    const group = data.years.find(y => y.year === year);
    drawerContent.innerHTML = `
      <div class="drawer-head">
        <div><span class="section-kicker">GODIŠTE ${year}</span><h2>Ekipa ${year}</h2><p>${group.coach} · ${group.players.length} demo profila</p></div>
        <span class="demo-badge">DEMO PODACI</span>
      </div>
      <div class="drawer-tabs"><button class="active">Igrači</button><a href="#utakmice" class="js-close-drawer">Utakmice</a><a href="#galerija" class="js-close-drawer">Galerija</a></div>
      <div class="players-row">
        ${group.players.map(p => `
          <button class="player-card" data-player="${p.id}">
            <div class="jersey-avatar"><span>${p.number}</span></div>
            <b>${p.name}</b><small>#${p.number} · ${p.position}</small>
          </button>`).join('')}
      </div>
      <p class="drawer-hint">Klik na igrača otvara profil i statistike u istom panelu.</p>`;
    qsa('.player-card', drawerContent).forEach(btn => btn.addEventListener('click', () => renderPlayer(year, btn.dataset.player)));
    qsa('.js-close-drawer', drawerContent).forEach(a => a.addEventListener('click', closeAge));
  }
  function renderPlayer(year, playerId){
    const group = data.years.find(y => y.year === year);
    const p = group.players.find(p => p.id === playerId);
    drawerContent.innerHTML = `
      <button class="back-link" id="backToTeam">← ${year}. godište</button>
      <div class="player-detail">
        <div class="jersey-avatar large"><span>${p.number}</span></div>
        <div class="player-main"><span class="section-kicker">IGRAČ · ${year}</span><h2>${p.name}</h2><p>#${p.number} · ${p.position}</p><small>${p.note}</small></div>
        <div class="stats-grid"><div><b>${p.appearances}</b><span>Utakmice</span></div><div><b>${p.goals}</b><span>Golovi</span></div><div><b>${p.assists}</b><span>Asistencije</span></div></div>
      </div>
      <div class="player-bottom"><button class="btn btn-gold" id="backToTeam2">Pogledaj celu ekipu</button><a class="btn btn-dark" href="#utakmice" id="playerMatches">Utakmice ovog uzrasta</a></div>`;
    qs('#backToTeam').onclick = () => renderTeam(year);
    qs('#backToTeam2').onclick = () => renderTeam(year);
    qs('#playerMatches').onclick = closeAge;
  }
  qs('#ageClose').addEventListener('click', closeAge);
  backdrop.addEventListener('click', closeAge);

  // Matches
  const matchesGrid = qs('#matchesGrid');
  data.matches.forEach((m,i) => {
    const card = document.createElement('button');
    card.className = 'match-card';
    card.innerHTML = `<div class="match-thumb"><img src="${m.image}" alt="" loading="lazy"><span class="play">▶</span></div><div class="match-copy"><b>${m.title}</b><span>${m.meta}</span><p>${m.description}</p></div>`;
    card.addEventListener('click', () => openVideo(i));
    matchesGrid.appendChild(card);
  });
  const videoModal = qs('#videoModal');
  const videoContent = qs('#videoContent');
  function openVideo(i){
    const m=data.matches[i];
    const media = m.videoId
      ? `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${m.videoId}?rel=0" title="${m.title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
      : `<div class="video-placeholder" style="background-image:url('${m.image}')"><span>▶</span><small>Dodajte YouTube link za ovu utakmicu u assets/js/data.js</small></div>`;
    videoContent.innerHTML = `${media}<div class="video-info"><span class="section-kicker">VIDEO</span><h2 id="videoTitle">${m.title}</h2><p>${m.description}</p><a class="btn btn-youtube" href="${m.videoId ? `https://www.youtube.com/watch?v=${m.videoId}` : data.youtubeSearch}" target="_blank" rel="noopener">▶ Otvori na YouTube-u</a></div>`;
    videoModal.classList.add('open'); videoModal.setAttribute('aria-hidden','false'); body.classList.add('no-scroll');
  }
  function closeVideo(){
    videoModal.classList.remove('open'); videoModal.setAttribute('aria-hidden','true'); videoContent.innerHTML=''; body.classList.remove('no-scroll');
  }
  qsa('.js-close-video').forEach(b=>b.addEventListener('click', closeVideo));
  videoModal.addEventListener('click', e => { if(e.target===videoModal) closeVideo(); });

  // Gallery
  const galleryGrid = qs('#galleryGrid');
  let lightIndex=0;
  data.gallery.forEach((src,i)=>{
    const btn=document.createElement('button'); btn.className='gallery-item';
    btn.innerHTML=`<img src="${src}" alt="FK Sava galerija ${i+1}" loading="lazy">`;
    btn.onclick=()=>openLightbox(i); galleryGrid.appendChild(btn);
  });
  const lightbox=qs('#lightbox'), lightImg=qs('#lightboxImage');
  function openLightbox(i){ lightIndex=i; lightImg.src=data.gallery[i]; lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden','false'); body.classList.add('no-scroll'); }
  function closeLightbox(){ lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden','true'); body.classList.remove('no-scroll'); }
  function moveLight(step){ lightIndex=(lightIndex+step+data.gallery.length)%data.gallery.length; lightImg.src=data.gallery[lightIndex]; }
  qs('#lightPrev').onclick=()=>moveLight(-1); qs('#lightNext').onclick=()=>moveLight(1);
  qsa('.js-close-lightbox').forEach(b=>b.addEventListener('click', closeLightbox));
  lightbox.addEventListener('click',e=>{if(e.target===lightbox) closeLightbox();});

  // Enrollment modal
  const enrollModal=qs('#enrollModal');
  const yearSelect=qs('#enrollForm select[name="year"]');
  data.years.forEach(y=>{ const o=document.createElement('option'); o.value=y.year; o.textContent=y.year; yearSelect.appendChild(o); });
  function openEnroll(){ enrollModal.classList.add('open'); enrollModal.setAttribute('aria-hidden','false'); body.classList.add('no-scroll'); const card=enrollModal.querySelector('.enroll-card'); if(card) card.scrollTop=0; if(window.matchMedia('(min-width: 721px)').matches) setTimeout(()=>qs('#enrollForm input')?.focus(),100); }
  function closeEnroll(){ enrollModal.classList.remove('open'); enrollModal.setAttribute('aria-hidden','true'); body.classList.remove('no-scroll'); }
  qsa('.js-open-enroll').forEach(b=>b.addEventListener('click', openEnroll));
  qsa('.js-close-enroll').forEach(b=>b.addEventListener('click', closeEnroll));
  enrollModal.addEventListener('click',e=>{if(e.target===enrollModal) closeEnroll();});
  qs('#enrollForm').addEventListener('submit',e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget);
    const msg=`FK Sava — prijava deteta\nRoditelj: ${fd.get('parent')}\nTelefon: ${fd.get('phone')}\nGodište deteta: ${fd.get('year')}\n${fd.get('note') ? `Poruka: ${fd.get('note')}` : ''}`;
    const link=`sms:${data.phoneTel}?&body=${encodeURIComponent(msg)}`;
    window.location.href=link;
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if(e.key!=='Escape') return;
    if(drawer.classList.contains('open')) closeAge();
    if(videoModal.classList.contains('open')) closeVideo();
    if(lightbox.classList.contains('open')) closeLightbox();
    if(enrollModal.classList.contains('open')) closeEnroll();
  });
})();
