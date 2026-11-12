
import { link, state } from '../state.js?v=32bb2641f0';
import { element, longDate } from './chrono.js?v=32bb2641f0';

let treeCache;
const get = async path => {
  const r = await fetch(`/api/${path}`);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
};
const label = n => {
  const fr = n.label_fr || '', en = n.label_en || '';
  if (state.dl === 'en') return en || fr;
  return fr || en;  // 34 English-only index entries have no French label
};
const sub = n => (state.dl === 'both' && n.label_en && n.label_en !== n.label_fr ? n.label_en : '');

function buildTree(nodes, selected, filter) {
  const kids = new Map();
  for (const n of nodes) {
    const k = n.parent || '';
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k).push(n);
  }
  for (const list of kids.values()) list.sort((a, b) => label(a).localeCompare(label(b), 'fr'));
  const f = filter.trim().toLowerCase();
  const matches = n => !f || `${n.label_fr} ${n.label_en || ''}`.toLowerCase().includes(f) ||
    (kids.get(n.id) || []).some(matches);
  const open = new Set();
  if (selected) {
    let cur = nodes.find(n => n.id === selected);
    while (cur) { open.add(cur.id); cur = nodes.find(n => n.id === cur.parent); }
  }
  const make = parent => {
    const ul = element('ul', undefined, 'tt');
    for (const n of kids.get(parent) || []) {
      if (!matches(n)) continue;
      const li = element('li');
      const a = element('a', undefined, n.id === selected ? 'on' : '');
      a.href = link(`/topic/${n.id}`);
      a.dataset.route = `/topic/${n.id}`;
      a.append(element('span', label(n)), element('span', String(n.n_pages || 0), 'cnt'));
      const children = kids.get(n.id);
      if (children?.length) {
        const d = element('details');
        if (open.has(n.id) || (f && children.some(matches))) d.open = true;
        const s = element('summary');
        s.append(a);
        d.append(s, make(n.id));
        li.append(d);
      } else li.append(a);
      ul.append(li);
    }
    return ul;
  };
  return make('');
}

function passageCard(p) {
  const card = element('article', undefined, 'tp-card');
  const head = element('div', undefined, 'tp-head');
  const go = element('a', `${p.printed ? `p. ${p.printed}` : `PDF ${p.pdf}`} · ${p.doc}`, 'tp-ref');
  const m = p.meeting ? `/m/${p.meeting}/${p.seg_id}` : `/m/${p.doc === 'index' ? 'index' : 'front'}/${p.seg_id}`;
  go.href = link(m);
  go.dataset.route = m;
  head.append(go);
  const body = element('div', undefined, 'tp-body');
  for (const lang of state.dl === 'both' ? ['fr', 'en'] : [state.dl]) {
    if (!p[lang]) continue;
    const t = element('p', p[lang] + (p[lang].length >= 420 ? '…' : ''), lang);
    t.lang = lang;
    body.append(t);
  }
  card.append(head, body);
  return card;
}

export async function topics(root, selected, meetings) {
  treeCache ||= await get('topics/tree');
  const wrap = element('div', undefined, 'topics');
  const left = element('aside', undefined, 'tp-tree');
  const right = element('section', undefined, 'tp-detail');
  const box = element('input');
  box.type = 'search';
  box.placeholder = state.dl === 'en' ? 'Filter topics…' : 'Filtrer les rubriques…';
  box.value = state.tf || '';
  box.setAttribute('aria-label', 'Filter topics');
  const treeHost = element('div');
  const draw = () => treeHost.replaceChildren(buildTree(treeCache, selected, box.value));
  box.oninput = () => { state.tf = box.value; draw(); };
  left.append(element('p', 'Index analytique · 1920', 'rail-label'), box, treeHost);
  draw();
  wrap.append(left, right);
  root.replaceChildren(wrap);

  if (!selected) {
    right.append(element('h2', state.dl === 'fr' ? 'Rubriques' : 'Topics'),
      element('p', 'The analytical index printed with the volume in 1920, parsed into a tree (French and English entries ' +
        'aligned). Choose a heading to see its printed entry and every passage on the pages it cites. Computed postings ' +
        'with evidence will refine this page-level view.', 'intro'));
    const big = [...treeCache].filter(n => !n.parent).sort((a, b) => (b.n_pages || 0) - (a.n_pages || 0)).slice(0, 24);
    const grid = element('div', undefined, 'tp-grid');
    for (const n of big) {
      const a = element('a', undefined, 'tp-tile');
      a.href = link(`/topic/${n.id}`);
      a.dataset.route = `/topic/${n.id}`;
      a.append(element('b', label(n)), element('span', `${n.n_pages} pages`));
      grid.append(a);
    }
    right.append(grid);
    return;
  }
  right.append(element('p', 'Loading…', 'status'));
  const d = await get(`topics/${encodeURIComponent(selected)}`);
  right.replaceChildren();
  const crumbs = element('p', undefined, 'tp-crumbs');
  d.path.forEach((c, i) => {
    const a = element('a', label(c));
    a.href = link(`/topic/${c.id}`);
    a.dataset.route = `/topic/${c.id}`;
    crumbs.append(a);
    if (i < d.path.length - 1) crumbs.append(' › ');
  });
  const h = element('h2', label(d));
  right.append(crumbs, h);
  if (sub(d)) right.append(element('p', sub(d), 'tp-en'));
  for (const e of d.printed) {
    if (state.dl !== 'both' && e.lang !== state.dl) continue;
    const p = element('p', undefined, 'tp-printed');
    p.append(element('span', e.lang === 'fr' ? 'Index 1920 (FR) ' : 'Index 1920 (EN) ', 'lab'), e.raw);
    right.append(p);
  }
  if (d.children.length) {
    const ch = element('div', undefined, 'tp-children');
    for (const c of d.children) {
      const a = element('a', `${label(c)} · ${c.n_pages}`);
      a.href = link(`/topic/${c.id}`);
      a.dataset.route = `/topic/${c.id}`;
      ch.append(a);
    }
    right.append(ch);
  }
  if (d.see.length) {
    const s = element('p', 'See also: ', 'tp-see');
    d.see.forEach((x, i) => {
      const a = element('a', label(x));
      a.href = link(`/topic/${x.id}`);
      a.dataset.route = `/topic/${x.id}`;
      s.append(a, i < d.see.length - 1 ? ', ' : '');
    });
    right.append(s);
  }

  const counts = new Array(35).fill(0);
  for (const p of d.passages) if (p.meeting) counts[p.meeting - 1]++;
  const max = Math.max(1, ...counts);
  const hist = element('div', undefined, 'tp-hist');
  hist.setAttribute('aria-label', 'Passages per meeting');
  counts.forEach((c, i) => {
    const b = element('i');
    b.style.height = `${(c / max) * 100}%`;
    b.title = `Meeting ${i + 1}: ${c}`;
    hist.append(b);
  });
  right.append(element('p', `${d.passages.length} passages on ${d.pages.length} cited pages`, 'lab'), hist);
  const bySection = new Map();
  for (const p of d.passages) {
    const k = p.meeting ? `m${p.meeting}` : p.doc;
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k).push(p);
  }
  for (const [k, list] of bySection) {
    const mt = meetings.find(m => `m${m.n}` === k);
    right.append(element('h3', mt ? `${state.dl === 'fr' ? 'Séance' : 'Meeting'} ${mt.n} · ${longDate(mt.date, state.dl === 'fr' ? 'fr' : 'en')}` : k, 'tp-sec'));
    for (const p of list) right.append(passageCard(p));
  }
}
