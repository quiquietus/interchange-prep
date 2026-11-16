(() => {
  const app = document.getElementById('app');
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let idx;

  const store = {
    get(k) { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify([...v])); } catch {} }
  };
  let done = store.get('interchange.done'), watched = store.get('interchange.watched');
  const toggle = (set, key, id) => { set.has(id) ? set.delete(id) : set.add(id); store.set(key, set); };

  const lineOf = id => idx.lines.find(l => l.id === id);
  const st = id => idx.stations[id];
  const readyIds = () => Object.keys(idx.stations).filter(id => st(id).ready);

  function stop(id, opts = {}) {
    const s = st(id), cls = ['stop', s.ready ? '' : 'is-planned', done.has(id) ? 'is-done' : '', opts.current ? 'is-current' : ''].join(' ');
    const inner = `<span class="dot" aria-hidden="true"></span><span class="stop-name">${esc(s.title)}</span>` +
      (s.ready ? (done.has(id) ? '<span class="sr"> (done)</span>' : '') : '<span class="stop-note">planned</span>');
    return s.ready ? `<a class="${cls}" data-st="${id}" href="#/m/${id}">${inner}</a>` : `<span class="${cls}" data-st="${id}">${inner}</span>`;
  }

  function nextUp() {
    for (const l of idx.lines) for (const id of l.stations) if (st(id).ready && !done.has(id)) return id;
    return null;
  }

  function home() {
    const ready = readyIds(), nDone = ready.filter(id => done.has(id)).length, next = nextUp();
    const subjects = [...new Set(idx.lines.map(l => l.subject))];
    const map = subjects.map(sub => `
      <section class="zone">
        <h2 class="zone-name">${esc(sub)}</h2>
        ${idx.lines.filter(l => l.subject === sub).map(l => `
          <div class="line line-${l.id}">
            <div class="line-head"><span class="roundel">${l.code}</span><span class="line-name">${esc(l.name)}</span>
              <span class="line-count">${l.stations.filter(id => done.has(id)).length} of ${l.stations.length}</span></div>
            <div class="track">${l.stations.map(id => stop(id)).join('')}</div>
          </div>`).join('')}
      </section>`).join('');
    const projects = Object.values(idx.projects).map(p => `
      <a class="xchg ${p.ready ? '' : 'is-planned'}" href="#/p/${p.id}" data-project="${p.id}">
        <span class="xchg-symbol" aria-hidden="true"></span>
        <span class="xchg-title">${esc(p.title)}</span>
        <span class="xchg-tag">${esc(p.tagline)}</span>
        <span class="xchg-lines">${[...new Set(p.stations.map(id => st(id).line))].map(l => `<i class="pip line-${l}" title="${esc(lineOf(l).name)}"></i>`).join('')}
          <span>${p.stations.length} stations${p.ready ? '' : ', build guide planned'}</span></span>
      </a>`).join('');
    app.innerHTML = `
      <section class="hero">
        <h1>Learn each concept once.<br>Meet it again where a project needs it.</h1>
        <p class="lede">Every subject is a line and every topic is a station, in the order you should learn them. The three projects are interchanges: each one links back to the exact stations it is built from.</p>
        <div class="hero-row">
          ${next ? `<a class="btn btn-primary" href="#/m/${next}">${nDone ? 'Continue at' : 'Start at'} ${esc(st(next).title)}</a>` : '<span class="btn btn-primary">All written stations done</span>'}
          <div class="meter" role="img" aria-label="${nDone} of ${ready.length} written stations done">
            <div class="meter-bar"><span style="width:${ready.length ? (nDone / ready.length * 100) : 0}%"></span></div>
            <span>${nDone} of ${ready.length} written stations done, ${Object.keys(idx.stations).length - ready.length} more planned</span>
          </div>
        </div>
      </section>
      <div class="home-grid">
        <div class="map" id="map">${map}</div>
        <aside class="xchgs"><h2>Interchanges</h2><p class="hint">Hover or focus a project to light up its stations on the map.</p>${projects}</aside>
      </div>`;
    app.querySelectorAll('.xchg').forEach(el => {
      const on = v => {
        const ids = idx.projects[el.dataset.project].stations;
        $('#map').classList.toggle('is-filtering', v);
        ids.forEach(id => { const n = app.querySelector(`.stop[data-st="${id}"]`); if (n) n.classList.toggle('is-lit', v); });
      };
      el.addEventListener('mouseenter', () => on(true)); el.addEventListener('mouseleave', () => on(false));
      el.addEventListener('focus', () => on(true)); el.addEventListener('blur', () => on(false));
    });
  }

  function projectsPage() {
    app.innerHTML = `<section class="page-head"><h1>Projects</h1><p class="lede">Three builds for your resume. Each guide points back to the stations that explain its parts, so you never learn the same thing twice.</p></section>
      <div class="proj-list">${Object.values(idx.projects).map(p => `
        <article class="proj-card">
          <h2><a href="#/p/${p.id}">${esc(p.title)}</a></h2><p>${esc(p.tagline)}</p>
          <div class="chips">${p.stations.map(id => chip(id)).join('')}</div>
          <p class="status">${p.ready ? 'Blueprint and diagrams ready' : 'Build guide planned. The stations above are what it will connect.'}</p>
        </article>`).join('')}</div>`;
  }

  const chip = id => st(id).ready ? `<a class="chip line-${st(id).line}" href="#/m/${id}">${esc(st(id).title)}</a>` : `<span class="chip chip-planned line-${st(id).line}">${esc(st(id).title)}</span>`;

  function videoBlock(id) {
    const s = st(id), q = encodeURIComponent(s.videoSearch);
    let framed = false; try { framed = window.self !== window.top; } catch { framed = true; }
    if (s.video && framed) return `<p class="video-link"><a href="https://www.youtube.com/watch?v=${s.video}" target="_blank" rel="noopener">Watch: ${esc(s.videoTitle)}</a> <label class="check"><input type="checkbox" data-watch="${id}" ${watched.has(id) ? 'checked' : ''}> Watched</label></p>`;
    if (s.video) return `<figure class="video"><div class="video-frame"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${s.video}" title="${esc(s.videoTitle)}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      <figcaption>${esc(s.videoTitle)} <label class="check"><input type="checkbox" data-watch="${id}" ${watched.has(id) ? 'checked' : ''}> Watched</label></figcaption></figure>`;
    return `<p class="video-link">No video is pinned to this station yet. <a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Search YouTube for “${esc(s.videoSearch)}”</a></p>`;
  }

  function rail(lineId, currentId) {
    const l = lineOf(lineId);
    return `<aside class="rail line-${l.id}"><a class="rail-head" href="#/"><span class="roundel">${l.code}</span>${esc(l.name)}</a>
      <nav class="rail-track" aria-label="${esc(l.name)} stations">${l.stations.map(id => stop(id, { current: id === currentId })).join('')}</nav></aside>`;
  }

  async function load(id) { const r = await fetch(`data/${id}.json`); if (!r.ok) throw new Error('missing'); return r.json(); }

  async function modulePage(id, anchor) {
    const s = st(id);
    if (!s || !s.ready) return notFound(s ? `${s.title} is planned but not written yet.` : 'That station does not exist.');
    const data = await load(id), l = lineOf(s.line), i = l.stations.indexOf(id);
    const prev = l.stations[i - 1], next = l.stations[i + 1];
    const used = s.usedIn.length ? `<section class="used"><h2 id="used-in-projects">Where projects use this</h2><ul>${s.usedIn.map(u =>
      `<li><a href="#/p/${u.project}${u.section ? '/' + u.section : ''}"><span class="xchg-symbol" aria-hidden="true"></span>${esc(u.title)}${u.sectionText ? `<span class="used-sec">${esc(u.sectionText)}</span>` : ''}</a></li>`).join('')}</ul></section>` : '';
    app.innerHTML = `<div class="reader">${rail(s.line, id)}
      <article class="doc line-${s.line}">
        <header class="sign">
          <div class="sign-top"><span class="roundel">${l.code}</span><span>${esc(l.name)} line, station ${s.n} of ${l.stations.length}</span>${s.time ? `<span>about ${esc(s.time)} min</span>` : ''}</div>
          <h1>${esc(s.title)}</h1>
          <p class="lede">${esc(s.summary)}</p>
          ${s.needs.length ? `<p class="needs">Read first: ${s.needs.map(chip).join(' ')}</p>` : ''}
        </header>
        ${videoBlock(id)}
        <div class="prose">${data.html}</div>
        ${used}
        <div class="done-row"><button class="btn ${done.has(id) ? 'btn-done' : 'btn-primary'}" id="doneBtn">${done.has(id) ? 'Done. Mark as not done' : 'Mark station as done'}</button></div>
        <nav class="pager">${prev && st(prev).ready ? `<a href="#/m/${prev}"><small>Previous station</small>${esc(st(prev).title)}</a>` : '<span></span>'}
          ${next && st(next).ready ? `<a class="pager-next" href="#/m/${next}"><small>Next station</small>${esc(st(next).title)}</a>` : '<span></span>'}</nav>
      </article></div>`;
    $('#doneBtn').addEventListener('click', () => { toggle(done, 'interchange.done', id); modulePage(id); });
    after(anchor);
  }

  async function projectPage(id, anchor) {
    const p = idx.projects[id];
    if (!p) return notFound('That project does not exist.');
    let body;
    if (p.ready) body = `<div class="prose">${(await load(id)).html}</div>`;
    else body = `<div class="prose"><aside class="callout callout-model"><div class="callout-label">Planned</div><p>The full build guide for this project is not written yet. It will connect the stations listed above, with architecture, class, use case, sequence and ER diagrams, and the questions an interviewer asks about each decision.</p></aside></div>`;
    const byLine = {};
    p.stations.forEach(sid => (byLine[st(sid).line] = byLine[st(sid).line] || []).push(sid));
    app.innerHTML = `<div class="reader reader-project">
      <aside class="rail rail-project"><div class="rail-head"><span class="xchg-symbol" aria-hidden="true"></span>Stations on this interchange</div>
        ${Object.entries(byLine).map(([lid, ids]) => `<div class="rail-group line-${lid}"><div class="rail-group-name"><span class="roundel">${lineOf(lid).code}</span>${esc(lineOf(lid).name)}</div><nav class="rail-track">${ids.map(i => stop(i)).join('')}</nav></div>`).join('')}
      </aside>
      <article class="doc doc-project">
        <header class="sign"><div class="sign-top"><span class="xchg-symbol" aria-hidden="true"></span><span>Project interchange</span></div>
          <h1>${esc(p.title)}</h1><p class="lede">${esc(p.tagline)}</p></header>
        ${body}
      </article></div>`;
    after(anchor);
  }

  function videosPage() {
    const rows = idx.lines.map(l => {
      const ids = l.stations.filter(id => st(id).ready);
      if (!ids.length) return '';
      return `<section class="vid-line line-${l.id}"><h2><span class="roundel">${l.code}</span>${esc(l.name)}</h2><ul>${ids.map(id => {
        const s = st(id);
        const link = s.video ? `<a href="https://www.youtube.com/watch?v=${s.video}" target="_blank" rel="noopener">${esc(s.videoTitle)}</a>`
          : `<a class="muted" href="https://www.youtube.com/results?search_query=${encodeURIComponent(s.videoSearch)}" target="_blank" rel="noopener">Search: ${esc(s.videoSearch)}</a>`;
        return `<li><label class="check"><input type="checkbox" data-watch="${id}" ${watched.has(id) ? 'checked' : ''}><span class="sr">Watched</span></label>
          <a class="vid-st" href="#/m/${id}">${esc(s.title)}</a>${link}</li>`;
      }).join('')}</ul></section>`;
    }).join('');
    app.innerHTML = `<section class="page-head"><h1>Videos</h1><p class="lede">One short video per station where a good one is pinned. For the rest there is a ready-made search. Tick what you have watched.</p></section><div class="vids">${rows}</div>`;
  }

  function notFound(msg) { app.innerHTML = `<section class="page-head"><h1>Nothing at this stop</h1><p class="lede">${esc(msg)}</p><a class="btn btn-primary" href="#/">Back to the map</a></section>`; }

  let mermaidReady;
  function diagrams() {
    const nodes = app.querySelectorAll('pre.mermaid');
    if (!nodes.length) return;
    mermaidReady = mermaidReady || new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'vendor/mermaid.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    }).then(() => window.mermaid.initialize({
      startOnLoad: false, theme: 'base', securityLevel: 'strict',
      themeVariables: { fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: '15px', primaryColor: '#FFFFFF', primaryBorderColor: '#0F1B2D', primaryTextColor: '#0F1B2D',
        lineColor: '#0F1B2D', secondaryColor: '#E7F0FF', tertiaryColor: '#FFF4D6', noteBkgColor: '#FFF4D6', noteBorderColor: '#E8A400', actorBkg: '#E7F0FF', actorBorder: '#1E6FD9',
        signalColor: '#0F1B2D', labelBoxBkgColor: '#FFF4D6', labelBoxBorderColor: '#E8A400', clusterBkg: '#F3F5F8', clusterBorder: '#B8C0CC' }
    }));
    mermaidReady.then(() => window.mermaid.run({ nodes })).catch(e => console.error('diagram', e));
  }

  function after(anchor) {
    diagrams();
    const target = anchor && document.getElementById(anchor);
    if (target) { target.scrollIntoView(); target.classList.add('is-target'); } else window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  app.addEventListener('change', e => {
    const id = e.target.dataset && e.target.dataset.watch;
    if (id) toggle(watched, 'interchange.watched', id);
  });
  // in-page links inside prose (e.g. #section) must not break the hash router
  app.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && !a.getAttribute('href').startsWith('#/')) { e.preventDefault(); const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView(); }
  });

  async function route() {
    const [, kind, id, anchor] = location.hash.split('/');
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('is-active',
      a.dataset.nav === (kind === 'videos' ? 'videos' : kind === 'p' || kind === 'projects' ? 'projects' : 'home')));
    try {
      if (kind === 'm') await modulePage(id, anchor);
      else if (kind === 'p') await projectPage(id, anchor);
      else if (kind === 'projects') { projectsPage(); window.scrollTo(0, 0); }
      else if (kind === 'videos') { videosPage(); window.scrollTo(0, 0); }
      else { home(); window.scrollTo(0, 0); }
    } catch (e) { console.error(e); notFound('This page could not be loaded. Check your connection and try again.'); }
  }

  const q = $('#q'), results = $('#results');
  function search() {
    const term = q.value.trim().toLowerCase();
    if (term.length < 2) { results.hidden = true; return; }
    const hits = [];
    for (const [id, s] of Object.entries(idx.stations)) {
      if (!s.ready) continue;
      if (s.title.toLowerCase().includes(term) || (s.summary || '').toLowerCase().includes(term)) hits.push({ href: `#/m/${id}`, a: s.title, b: lineOf(s.line).name, line: s.line });
      for (const h of s.headings || []) if (h.text.toLowerCase().includes(term)) hits.push({ href: `#/m/${id}/${h.id}`, a: h.text, b: s.title, line: s.line });
    }
    for (const p of Object.values(idx.projects)) {
      if (p.title.toLowerCase().includes(term)) hits.push({ href: `#/p/${p.id}`, a: p.title, b: 'Project' });
      for (const h of p.headings || []) if (h.text.toLowerCase().includes(term)) hits.push({ href: `#/p/${p.id}/${h.id}`, a: h.text, b: p.title });
    }
    results.innerHTML = hits.length ? hits.slice(0, 12).map(h => `<a href="${h.href}" class="${h.line ? 'line-' + h.line : ''}"><span class="pip"></span><span>${esc(h.a)}</span><small>${esc(h.b)}</small></a>`).join('')
      : '<p>No station matches. Try a shorter word.</p>';
    results.hidden = false;
  }
  q.addEventListener('input', search);
  q.addEventListener('focus', search);
  document.addEventListener('click', e => { if (!e.target.closest('.search')) results.hidden = true; });
  results.addEventListener('click', () => { results.hidden = true; q.value = ''; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') results.hidden = true; });

  fetch('data/index.json').then(r => r.json()).then(d => { idx = d; window.addEventListener('hashchange', route); route(); })
    .catch(() => { app.innerHTML = '<section class="page-head"><h1>The map did not load</h1><p class="lede">Reload the page to try again.</p></section>'; });
})();
