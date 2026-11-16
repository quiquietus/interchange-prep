const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { marked } = require('marked');
const hljs = require('highlight.js');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/curriculum.json'), 'utf8'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function frontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (!m) return { meta, body: src };
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

// registry of every station and project title, used to resolve [[links]]
const titles = {};
const stationLine = {};
for (const line of cur.lines) for (const st of line.stations) { titles[st.id] = st.title; stationLine[st.id] = line.id; }
for (const p of cur.projects) titles[p.id] = p.title;
const projectIds = new Set(cur.projects.map(p => p.id));
const videos = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/videos.json'), 'utf8'));

let runCount = 0;
function runCode(code, file, name) {
  const tmp = path.join(ROOT, 'tmp', name || `run-${++runCount}.js`);
  if (name) runCount++;
  fs.writeFileSync(tmp, code);
  const r = spawnSync('node', ['--expose-gc', '--test-reporter=spec', tmp], { encoding: 'utf8', timeout: 15000, cwd: ROOT });
  if (r.status !== 0) {
    console.error(`\nRUN FAILED in ${file}:\n${code}\n--- stderr ---\n${r.stderr}\n${r.stdout}`);
    process.exit(1);
  }
  return r.stdout.replace(/\s+$/, '');
}

function highlight(code, lang) {
  const map = { jsx: 'javascript', js: 'javascript', sh: 'bash', http: 'http', json: 'json', text: 'plaintext' };
  const l = map[lang] || lang;
  if (l && hljs.getLanguage(l)) return hljs.highlight(code, { language: l }).value;
  return esc(code);
}

function render(md, ctx) {
  const links = ctx.links;
  // [[id]] or [[id|label]] chips
  md = md.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
    if (!titles[id]) { console.error(`Unknown link [[${id}]] in ${ctx.file}`); process.exit(1); }
    links.push({ id, at: ctx.section });
    const isP = projectIds.has(id);
    const cls = isP ? 'chip chip-project' : `chip line-${stationLine[id]}`;
    if (!isP && !fs.existsSync(path.join(ROOT, 'content/modules', id + '.md')))
      return `<span class="${cls} chip-planned" title="Planned station, not written yet">${esc(label || titles[id])}</span>`;
    return `<a class="${cls}" href="#/${isP ? 'p' : 'm'}/${id}">${esc(label || titles[id])}</a>`;
  });

  const renderer = new marked.Renderer();
  let pendingOutput = null;
  renderer.code = function (tok) {
    const text = tok.text, info = (tok.lang || '').trim();
    const [lang, flag] = info.split(/\s+/);
    if (lang === 'mermaid') return `<figure class="diagram"><pre class="mermaid">${esc(text)}</pre></figure>`;
    if (lang === 'output') return `<div class="out out-expected"><div class="out-tag">Expected result</div><pre>${esc(text)}</pre></div>`;
    const named = (flag || '').match(/^(file|run)=(.+)$/);
    if (named && named[1] === 'file') fs.writeFileSync(path.join(ROOT, 'tmp', named[2]), text);
    let html = `<div class="code"><div class="code-tag">${esc(named ? named[2] : lang || 'code')}</div><pre><code>${highlight(text, lang)}</code></pre></div>`;
    if (flag === 'run' || (named && named[1] === 'run')) {
      const out = runCode(text, ctx.file, named && named[2]);
      html += `<div class="out out-ran"><div class="out-tag">Output, ran on Node ${process.versions.node.split('.')[0]}</div><pre>${esc(out)}</pre></div>`;
    }
    return html;
  };
  renderer.heading = function (tok) {
    const inner = this.parser.parseInline(tok.tokens);
    const id = slug(tok.text);
    if (tok.depth === 2) ctx.headings.push({ id, text: tok.text });
    return `<h${tok.depth} id="${id}">${inner}</h${tok.depth}>`;
  };
  renderer.table = function (tok) {
    const row = (cells, tag) => '<tr>' + cells.map(c => `<${tag}>${this.parser.parseInline(c.tokens)}</${tag}>`).join('') + '</tr>';
    return `<div class="table-wrap"><table><thead>${row(tok.header, 'th')}</thead><tbody>${tok.rows.map(r => row(r, 'td')).join('')}</tbody></table></div>`;
  };
  return marked.parse(md, { renderer, gfm: true });
}

// splits the body into plain markdown, ?? toggles and !!! callouts, tracking the current h2 for link back-references
function renderBody(body, file) {
  const ctx = { file, links: [], headings: [], section: null };
  const lines = body.split('\n');
  let html = '', buf = [], i = 0, inFence = false;
  const flush = () => { if (buf.length) { html += render(buf.join('\n'), ctx); buf = []; } };
  const labels = { key: 'Interview-critical', trap: 'Common trap', twist: 'Twist', model: 'Mental model', why: 'Why this works' };
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) inFence = !inFence;
    if (!inFence && /^## /.test(ln)) { flush(); ctx.section = { id: slug(ln.slice(3)), text: ln.slice(3) }; }
    if (!inFence && /^\?\? /.test(ln)) {
      flush();
      const q = ln.slice(3); const inner = []; i++;
      while (i < lines.length && lines[i].trim() !== '??') inner.push(lines[i++]);
      html += `<details class="qa"><summary>${marked.parseInline(q)}</summary><div class="ans">${render(inner.join('\n'), ctx)}</div></details>`;
      i++; continue;
    }
    const c = !inFence && ln.match(/^!!! (\w+)\s*(.*)$/);
    if (c) {
      flush();
      const inner = []; i++;
      while (i < lines.length && lines[i].trim() !== '!!!') inner.push(lines[i++]);
      html += `<aside class="callout callout-${c[1]}"><div class="callout-label">${labels[c[1]] || c[1]}${c[2] ? ': ' + marked.parseInline(c[2]) : ''}</div>${render(inner.join('\n'), ctx)}</aside>`;
      i++; continue;
    }
    buf.push(ln); i++;
  }
  flush();
  return { html, links: ctx.links, headings: ctx.headings };
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.cpSync(path.join(ROOT, 'site'), OUT, { recursive: true });

const index = { lines: [], stations: {}, projects: {} };
const usedIn = {}; // station id -> [{project, title, section}]

for (const p of cur.projects) {
  const f = path.join(ROOT, 'content/projects', p.id + '.md');
  const entry = { ...p, ready: false, stations: [] };
  if (fs.existsSync(f)) {
    const { meta, body } = frontmatter(fs.readFileSync(f, 'utf8'));
    const r = renderBody(body, f);
    entry.ready = true; entry.headings = r.headings;
    const seen = new Set();
    for (const l of r.links) {
      if (projectIds.has(l.id)) continue;
      if (!entry.stations.includes(l.id)) entry.stations.push(l.id);
      const key = l.id + '|' + (l.at ? l.at.id : '');
      if (seen.has(key)) continue; seen.add(key);
      (usedIn[l.id] = usedIn[l.id] || []).push({ project: p.id, title: p.title, section: l.at ? l.at.id : '', sectionText: l.at ? l.at.text : '' });
    }
    fs.writeFileSync(path.join(OUT, 'data', p.id + '.json'), JSON.stringify({ meta, html: r.html }));
  } else {
    entry.stations = p.plannedStations || [];
  }
  index.projects[p.id] = entry;
}

for (const line of cur.lines) {
  index.lines.push({ id: line.id, name: line.name, subject: line.subject, code: line.code, stations: line.stations.map(s => s.id) });
  line.stations.forEach((st, n) => {
    const f = path.join(ROOT, 'content/modules', st.id + '.md');
    const entry = { title: st.title, line: line.id, n: n + 1, level: st.level || '', ready: false, usedIn: usedIn[st.id] || [] };
    if (fs.existsSync(f)) {
      const { meta, body } = frontmatter(fs.readFileSync(f, 'utf8'));
      const r = renderBody(body, f);
      Object.assign(entry, {
        ready: true, summary: meta.summary || '', time: meta.time || '', headings: r.headings,
        needs: meta.needs ? meta.needs.split(',').map(s => s.trim()) : [],
        video: (videos[st.id] || [])[0] || meta.video || '', videoTitle: (videos[st.id] || [])[1] || meta.videoTitle || '', videoSearch: meta.videoSearch || st.title + ' explained'
      });
      for (const n of entry.needs) if (!titles[n]) { console.error(`Unknown prerequisite ${n} in ${f}`); process.exit(1); }
      fs.writeFileSync(path.join(OUT, 'data', st.id + '.json'), JSON.stringify({ html: r.html }));
    }
    index.stations[st.id] = entry;
  });
}
fs.writeFileSync(path.join(OUT, 'data', 'index.json'), JSON.stringify(index));
fs.copyFileSync(path.join(ROOT, 'node_modules/mermaid/dist/mermaid.min.js'), path.join(OUT, 'vendor/mermaid.min.js'));
const ready = Object.values(index.stations).filter(s => s.ready).length;
console.log(`Built ${ready}/${Object.keys(index.stations).length} stations, ${runCount} code blocks executed.`);
