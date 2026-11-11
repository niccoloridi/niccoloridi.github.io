
import { element } from './chrono.js?v=1c4899085d';
import { link } from '../state.js?v=1c4899085d';

const requests = new WeakMap();
async function get(path) {
  const response = await fetch(`/api/${path}`);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}
export const thesaurusApi = {
  tree: () => get('thesaurus/tree'),
  concept: (id, options = {}) => get(`thesaurus/concepts/${encodeURIComponent(id)}?${new URLSearchParams(options)}`),
  search: (q, passages = false) => get(`thesaurus/search?${new URLSearchParams({ q, passages })}`),
  clusters: () => get('thesaurus/clusters'),
};
const anchor = (text, route, css = '') => {
  const a = element('a', text, css);
  a.href = link(route);
  a.dataset.route = route;
  return a;
};
function label(c, state) {
  const fr = c.pref_fr || c.label_fr || '', en = c.pref_en || c.label_en || '';
  if (state.dl === 'en') return en || fr;
  if (state.dl === 'both' && fr && en && fr !== en) return `${fr} / ${en}`;
  return fr || en;
}
const conceptLink = (c, state) => anchor(label(c, state), `/topic/${encodeURIComponent(c.id)}`, 'th-chip');

function treeBranch(nodes, state, selected, parent = '') {
  const ul = element('ul', undefined, 'th-tree-list');
  for (const n of [...nodes].sort((a, b) => label(a, state).localeCompare(label(b, state)))) {
    const li = element('li');
    const a = conceptLink(n, state);
    a.className = n.id === selected ? 'th-selected' : '';
    if (n.id === selected) a.setAttribute('aria-current', 'page');
    a.append(element('small', ` ${n.propagated_count}`, 'th-count'));
    if (!n.propagated_count) a.classList.add('th-zero');
    if (n.also_under?.length) {
      const marker = element('span', ' ⧉', 'th-poly');
      marker.title = `Also under: ${n.also_under.map(c => label(c, state)).join('; ')}`;
      marker.setAttribute('aria-label', marker.title);
      a.append(marker);
    }
    if (n.children?.length) {
      const details = element('details');
      const summary = element('summary');
      summary.append(a);
      details.open = contains(n, selected);
      details.append(summary, treeBranch(n.children, state, selected, n.id));
      li.append(details);
    } else li.append(a);
    li.dataset.parent = parent;
    ul.append(li);
  }
  return ul;
}
function contains(node, selected) {
  return node.id === selected || (node.children || []).some(n => contains(n, selected));
}
function card(p, state) {
  const article = element('article', undefined, 'th-passage');
  const section = p.meeting || (p.doc === 'index' ? 'index' : 'front');
  const head = element('div', undefined, 'th-passage-head');
  head.append(anchor(`p. ${p.printed ?? '—'} · PDF ${p.pdf}`, `/m/${section}/${p.seg_id}`));
  if (p.speaker?.speaker_id) head.append(anchor(p.speaker.name || p.speaker.speaker_id,
    `/who/${p.speaker.speaker_id}`, 'th-chip'));
  for (const source of p.sources || []) head.append(element('span', source, `th-source th-${source}`));
  article.append(head);
  for (const lang of state.dl === 'both' ? ['fr', 'en', 'full'] : [state.dl, 'full']) {
    const text = p.texts?.[lang === 'full' ? 'full_text' : lang];
    if (!text) continue;
    const paragraph = element('p', undefined, lang);
    paragraph.lang = lang === 'full' ? 'und' : lang;

    if (p.highlighted?.[lang === 'full' ? 'full_text' : lang]) paragraph.innerHTML = p.highlighted[lang === 'full' ? 'full_text' : lang];
    else paragraph.textContent = text;
    article.append(paragraph);
  }
  return article;
}
function conceptBody(host, data, state) {
  host.replaceChildren();
  const nav = element('nav', undefined, 'th-breadcrumbs');
  nav.setAttribute('aria-label', 'All concept breadcrumb paths');
  for (const path of data.breadcrumb_paths) {
    const line = element('p');
    path.forEach((c, i) => { if (i) line.append(' › '); line.append(conceptLink(c, state)); });
    nav.append(line);
  }
  host.append(nav, element('h2', label(data, state)),
    element('p', data.status, 'th-status'), element('p', data.label_scope_note_en || ''));
  for (const [key, title] of [['broader', 'Broader'], ['narrower', 'Narrower'], ['related', 'Related']]) {
    if (!data[key]?.length) continue;
    const line = element('div', undefined, 'th-relations');
    line.append(element('b', `${title}: `));
    for (const c of data[key]) line.append(conceptLink(c, state));
    host.append(line);
  }
  const hist = element('div', undefined, 'th-histogram');
  hist.setAttribute('role', 'img');
  hist.setAttribute('aria-label', `Passages per meeting: ${data.histogram.map(x => `${x.meeting}: ${x.count}`).join(', ')}`);
  const max = Math.max(1, ...data.histogram.map(x => x.count));
  for (const entry of data.histogram) {
    const bar = element('span');
    bar.style.height = `${Math.max(2, entry.count / max * 100)}%`;
    bar.title = `Meeting ${entry.meeting}: ${entry.count}`;
    hist.append(bar);
  }
  host.append(element('p', `${data.direct_count} direct · ${data.propagated_count} including narrower concepts`), hist);
  if (data.members.length) {
    const members = element('div', undefined, 'th-relations');
    members.append(element('b', 'Members who spoke: '));
    for (const p of data.members) members.append(anchor(`${p.name} (${p.count})`, `/who/${p.id}`, 'th-chip'));
    host.append(members);
  }
  if (data.printed_entries.length) {
    const printed = element('details', undefined, 'th-printed');
    printed.append(element('summary', 'Index analytique, 1920'));
    for (const n of data.printed_entries) {
      printed.append(anchor(label(n, state), `/topic/printed/${encodeURIComponent(n.id)}`));
      for (const entry of n.entries) {
        if (state.dl !== 'both' && state.dl !== entry.lang) continue;
        const p = element('p', entry.raw); p.lang = entry.lang; printed.append(p);
      }
    }
    host.append(printed);
  }
  host.append(element('h3', `${data.passage_count} passages`));
  if (!data.groups.length) host.append(element('p', 'No passages match the selected sources.'));
  for (const group of data.groups) {
    const section = element('section', undefined, 'th-meeting');
    section.append(element('h3', group.meeting ? `Meeting ${group.meeting}` : group.section));
    for (const p of group.passages) section.append(card(p, state));
    host.append(section);
  }
}

async function printedLayer(host, state, id, valid) {
  const nodes = await get('topics/tree');
  if (!valid()) return;
  host.replaceChildren(element('h2', 'Index analytique, 1920'), anchor('← Thesaurus', '/topic'));
  const byParent = new Map();
  for (const node of nodes) {
    const key = node.parent || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  const draw = parent => {
    const ul = element('ul');
    for (const node of byParent.get(parent) || []) {
      const li = element('li');
      const a = anchor(label(node, state), `/topic/printed/${encodeURIComponent(node.id)}`);
      if (byParent.has(node.id)) {
        const details = element('details'); const summary = element('summary'); summary.append(a);
        details.append(summary, draw(node.id)); li.append(details);
      } else li.append(a);
      ul.append(li);
    }
    return ul;
  };
  if (!id) { host.append(draw('')); return; }
  const data = await get(`topics/${encodeURIComponent(id)}`);
  if (!valid()) return;
  host.append(element('h3', label(data, state)), anchor('Browse printed tree', '/topic/printed'));
  for (const entry of data.printed) {
    if (state.dl === 'both' || state.dl === entry.lang) host.append(element('p', entry.raw));
  }
  for (const child of data.children) host.append(anchor(label(child, state), `/topic/printed/${child.id}`, 'th-chip'));
  for (const p of data.passages) host.append(card({ ...p, texts: { fr: p.fr, en: p.en }, sources: ['printed'] }, state));
}

export async function render(root, state, api) {
  const token = {}, routeHash = location.hash;
  requests.set(root, token);
  const valid = () => requests.get(root) === token && root.isConnected && location.hash === routeHash;
  const service = api?.thesaurus || thesaurusApi;
  const path = location.hash.slice(1).split('?')[0].split('/');
  const selected = path[2] ? decodeURIComponent(path[2]) : null;
  const wrap = element('div', undefined, 'thesaurus');
  const left = element('aside', undefined, 'th-sidebar');
  left.setAttribute('aria-label', 'Thesaurus facets and search');
  const right = element('section', undefined, 'th-detail');
  const input = element('input');
  input.type = 'search'; input.placeholder = 'Search labels FR / EN; Enter for passages';
  input.setAttribute('aria-label', 'Search thesaurus labels in French or English');
  const results = element('div', undefined, 'th-search-results');
  results.setAttribute('aria-live', 'polite');
  const treeHost = element('nav'); treeHost.setAttribute('aria-label', 'Facet tree');
  left.append(element('h2', state.dl === 'fr' ? 'Thésaurus' : 'Thesaurus'), input, results, treeHost,
    anchor('Index analytique, 1920', '/topic/printed'));
  wrap.append(left, right); root.replaceChildren(wrap);
  right.append(element('p', 'Loading…', 'status'));
  let searchVersion = 0, timer;
  const search = async passages => {
    const version = ++searchVersion;
    try {
      const data = await service.search(input.value, passages);
      if (!valid() || version !== searchVersion) return;
      results.replaceChildren();
      for (const c of data.concepts) results.append(conceptLink(c, state));
      if (input.value && !data.concepts.length) results.append(element('p', 'No matching labels.'));
      if (passages) {
        right.replaceChildren(element('h2', `Passages: ${input.value}`));
        for (const p of data.passages) {
          const hit = element('article', undefined, 'th-passage');
          hit.append(anchor(`${p.meeting ? `Meeting ${p.meeting}` : p.doc} · PDF ${p.pdf_from}`,
            `/m/${p.meeting || (p.doc === 'index' ? 'index' : 'front')}/${p.seg_id}`));
          for (const lang of state.dl === 'both' ? ['fr', 'en'] : [state.dl]) {
            const snippet = element('p'); snippet.lang = lang;
            snippet.innerHTML = p[`snippet_${lang}`] || ''; hit.append(snippet);
          }
          right.append(hit);
        }
        if (data.warning) right.append(element('p', data.warning, 'status'));
        if (!data.passages.length && !data.warning) right.append(element('p', 'No matching passages.'));
      }
    } catch (error) { if (valid() && version === searchVersion) results.replaceChildren(element('p', error.message)); }
  };
  input.oninput = () => { searchVersion++; clearTimeout(timer); timer = setTimeout(() => search(false), 180); };
  input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); clearTimeout(timer); search(true); } };
  try {
    const data = await service.tree();
    if (!valid()) return;
    treeHost.replaceChildren(treeBranch(data.facets, state, selected));
    if (selected === 'printed') {
      await printedLayer(right, state, path[3] ? decodeURIComponent(path[3]) : null, valid); return;
    }
    if (!selected) {
      right.replaceChildren(element('h2', state.dl === 'fr' ? 'Index analytique' : 'Analytical index'),
        element('p', 'Explore the analytical index and related passages. Choose a facet or search French and English labels.'));
      const grid = element('div', undefined, 'th-facet-grid');
      for (const facet of data.facets) {
        const tile = conceptLink(facet, state); tile.className = 'th-facet-tile';
        tile.append(element('small', `${facet.propagated_count} passages`)); grid.append(tile);
      }
      grid.append(anchor('Index analytique, 1920', '/topic/printed', 'th-facet-tile')); right.append(grid); return;
    }
    const controls = element('div', undefined, 'th-controls');
    const labelNode = element('label'); const printed = element('input'); printed.type = 'checkbox';
    labelNode.append(printed, ' Also show every passage on the pages cited by the 1920 index');
    const sourceLabel = element('label', 'Source '); const source = element('select');
    for (const [value, text] of [['', 'Edition index'], ['printed', 'Index 1920 only']]) {
      const option = element('option', text); option.value = value; source.append(option);
    }
    sourceLabel.append(source);
    const descendantsLabel = element('label'); const descendants = element('input'); descendants.type = 'checkbox';
    descendants.checked = selected.startsWith('facet.') || selected === 'theme.instruments';
    descendantsLabel.append(descendants, ' Include narrower concepts');
    controls.append(labelNode, sourceLabel, descendantsLabel);
    const body = element('div'); right.replaceChildren(controls, body);
    let detailVersion = 0;
    const load = async () => {
      const version = ++detailVersion;
      body.setAttribute('aria-busy', 'true');
      try {
        const details = await service.concept(selected, { include_printed: printed.checked,
          ...(source.value ? { source: source.value } : {}), descendants: descendants.checked });
        if (!valid() || version !== detailVersion || !body.isConnected) return;
        conceptBody(body, details, state);
      } catch (error) { if (valid() && version === detailVersion) body.replaceChildren(element('p', error.message, 'status')); }
      finally { if (version === detailVersion) body.removeAttribute('aria-busy'); }
    };
    printed.onchange = () => {
      if (!printed.checked && source.value === 'printed') source.value = '';
      load();
    };
    source.onchange = () => {
      if (source.value === 'printed') printed.checked = true;
      load();
    };
    descendants.onchange = load;
    await load();
  } catch (error) { if (valid()) right.replaceChildren(element('p', error.message, 'status')); }
}
