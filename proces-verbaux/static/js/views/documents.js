import { element } from './chrono.js?v=31701b5892';
import { link } from '../state.js?v=31701b5892';

async function load(api) {
  if (typeof api.documents === 'function') return api.documents();
  if (api.documents?.list) return api.documents.list();
  const response = await fetch('/api/documents');
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}

const kindLabels = {
  speech: ['Discours', 'Speech'], intervention: ['Intervention', 'Intervention'],
  draft: ['Projet', 'Draft'], proposal: ['Proposition', 'Proposal'], amendment: ['Amendement', 'Amendment'],
  memo: ['Mémoire / note', 'Memo'], letter: ['Lettre', 'Letter'], resolution: ['Résolution', 'Resolution'],
  agenda: ['Ordre du jour', 'Agenda'], report: ['Rapport', 'Report'], rules: ['Règles', 'Rules'],
  reference_plan: ['Projet de référence', 'Reference plan'], reference: ['Référence', 'Reference'],
  other: ['Autre', 'Other'],
};
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const range = (from, to) => from == null ? '—' : from === to || to == null ? `${from}` : `${from}–${to}`;

export async function render(root, state, api) {
  const host = element('section', undefined, 'documents-view');
  root.replaceChildren(host);
  const fr = state.dl === 'fr';
  const say = (a, b) => fr ? a : b;
  const kindName = kind => (kindLabels[kind] || [kind, kind])[fr ? 0 : 1];
  host.append(element('h2', say('Documents', 'Documents')));
  const status = element('p', say('Chargement…', 'Loading documents…'), 'status');
  status.setAttribute('role', 'status');
  host.append(status);
  host.setAttribute('aria-busy', 'true');
  let records;
  try {
    records = await load(api);
  } catch (error) {
    if (root.contains(host)) {
      status.textContent = error.message;
      host.removeAttribute('aria-busy');
    }
    return;
  }
  if (!root.contains(host)) return;
  host.removeAttribute('aria-busy');
  const options = {
    tab: state.docs_tab || 'all', kind: state.docs_kind || '', author: state.docs_author || '',
    phase: state.docs_phase || '', lang: state.docs_lang || '', q: state.docs_q || '',
    from: state.docs_from || '', to: state.docs_to || '', sort: state.docs_sort || 'meeting',
    direction: state.docs_direction === 'desc' ? -1 : 1,
  };
  const tabs = element('nav', undefined, 'documents-tabs');
  tabs.setAttribute('aria-label', say('Catégories de documents', 'Document categories'));
  const allTab = element('button', say('Tous les documents', 'All documents'));
  const speechTab = element('button', say('Discours', 'Speeches'));
  allTab.type = speechTab.type = 'button';
  tabs.append(allTab, speechTab);
  const controls = element('div', undefined, 'documents-controls');
  const searchLabel = element('label', say('Filtrer le texte ', 'Filter text '));
  const search = element('input');
  search.type = 'search';
  search.value = options.q;
  searchLabel.append(search);
  controls.append(searchLabel);
  for (const [key, label] of [['from', say('Séance de ', 'Meeting from ')], ['to', say('à ', 'to ')]]) {
    const wrapper = element('label', label);
    const input = element('input');
    input.type = 'number'; input.min = '1'; input.max = '35'; input.value = options[key];
    input.oninput = () => { options[key] = input.value; draw(); };
    wrapper.append(input);
    controls.append(wrapper);
  }
  const clear = element('button', say('Effacer les filtres', 'Clear filters'));
  clear.type = 'button';
  controls.append(clear);
  const facets = element('div', undefined, 'documents-facets');
  const results = element('div');
  const count = element('p', undefined, 'documents-count');
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  host.replaceChildren(host.children[0], tabs, controls, facets, count, results);
  const authors = new Map();
  const phases = new Map();
  for (const record of records) {
    for (const author of record.author_details || []) authors.set(author.id, author.name);
    if (record.phase && record.phase_details) phases.set(record.phase,
      record.phase_details[fr ? 'label_fr' : 'label_en']);
  }
  const facetDefinitions = [
    ['kind', say('Type', 'Kind'), [...new Set(records.map(r => r.kind))].sort().map(k => [k, kindName(k)])],
    ['author', say('Auteur', 'Author'), [...authors].sort((a, b) => a[1].localeCompare(b[1]))],
    ['phase', 'Phase', [...phases]],
    ['lang', say('Langue', 'Language'), [['both', 'FR + EN'], ['fr-only', say('FR seulement', 'FR only')]]],
  ];
  const facetButtons = [];
  for (const [key, label, values] of facetDefinitions) {
    const group = element('fieldset');
    group.append(element('legend', label));
    for (const [value, title] of [['', say('Tous', 'All')], ...values]) {
      const button = element('button', title, 'document-chip');
      button.type = 'button';
      button.dataset.facet = key;
      button.dataset.value = value;
      button.onclick = () => { options[key] = options[key] === value ? '' : value; draw(); };
      group.append(button);
      facetButtons.push({ button, key, value, title });
    }
    facets.append(group);
  }

  function matches(record, except = '') {
    return (options.tab !== 'speeches' || ['speech', 'intervention'].includes(record.kind)) &&
      (except === 'kind' || !options.kind || record.kind === options.kind) &&
      (except === 'author' || !options.author || record.authors.includes(options.author)) &&
      (except === 'phase' || !options.phase || record.phase === options.phase) &&
      (except === 'lang' || !options.lang || record.lang === options.lang) &&
      (!options.from || record.meeting >= Number(options.from)) &&
      (!options.to || record.meeting <= Number(options.to)) &&
      (!options.q || normalize([record.id, record.title_fr, record.title_en,
        ...(record.author_details || []).map(a => a.name)].join(' ')).includes(normalize(options.q)));
  }

  function persist() {
    for (const [key, value] of Object.entries(options)) state[`docs_${key}`] =
      key === 'direction' ? value === -1 ? 'desc' : 'asc' : String(value);

    history.replaceState(null, '', link('/docs'));
  }

  function sourceAnchor(record, title) {
    const anchor = element('a', title);
    anchor.dataset.route = `/m/${record.meeting}/${record.seg_id}`;
    anchor.href = link(anchor.dataset.route);
    return anchor;
  }

  function draw() {
    persist();
    allTab.setAttribute('aria-pressed', String(options.tab !== 'speeches'));
    speechTab.setAttribute('aria-pressed', String(options.tab === 'speeches'));
    for (const { button, key, value, title } of facetButtons) {
      button.setAttribute('aria-pressed', String(options[key] === value));
      button.textContent = `${title} (${records.filter(r => matches(r, key) && (!value ||
        (key === 'author' ? r.authors.includes(value) : r[key] === value))).length})`;
    }
    const filtered = records.filter(r => matches(r));
    const value = record => {
      if (options.sort === 'title') return state.dl === 'en' ? record.title_en || record.title_fr : record.title_fr;
      if (options.sort === 'authors') return (record.author_details || []).map(a => a.name).join(', ');
      if (options.sort === 'pages') return record.pdf_from;
      if (options.sort === 'kind') return kindName(record.kind);
      return record[options.sort];
    };
    filtered.sort((a, b) => {
      const av = value(a), bv = value(b);
      const comparison = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
      return options.direction * comparison || a.pdf_from - b.pdf_from || a.id.localeCompare(b.id);
    });
    count.textContent = say(`${filtered.length} sur ${records.length} documents`,
      `${filtered.length} of ${records.length} documents`);
    if (!filtered.length) {
      results.replaceChildren(element('p', say('Aucun document ne correspond aux filtres.', 'No matching documents.')));
      return;
    }
    const table = element('table', undefined, 'documents-table');
    table.append(element('caption', say('Annexes et interventions consignées au procès-verbal',
      'Annexes and interventions recorded in the minutes')));
    const header = element('thead');
    const headRow = element('tr');
    for (const [key, label] of [['meeting', say('Séance', 'Meeting')], ['date', 'Date'],
      ['kind', say('Type', 'Kind')], ['title', say('Titre', 'Title')], ['authors', say('Auteurs', 'Authors')],
      ['pages', 'Pages'], ['lang', say('Langue', 'Language')]]) {
      const cell = element('th'); cell.scope = 'col';
      cell.setAttribute('aria-sort', options.sort === key ? options.direction === 1 ? 'ascending' : 'descending' : 'none');
      const button = element('button', label); button.type = 'button';
      button.onclick = () => {
        options.direction = options.sort === key ? -options.direction : 1;
        options.sort = key; draw();
      };
      cell.append(button); headRow.append(cell);
    }
    header.append(headRow); table.append(header);
    const body = element('tbody');
    for (const record of filtered) {
      const row = element('tr');
      row.append(element('td', String(record.meeting)), element('td', record.date));
      const kind = element('td'); kind.append(element('span', kindName(record.kind), `document-kind kind-${record.kind}`));
      const title = element('td');
      for (const lang of ['fr', 'en'].filter(l => state.dl === 'both' || !state.dl || state.dl === l)) {
        const paragraph = element('p'); paragraph.lang = lang;
        paragraph.append(sourceAnchor(record, record[`title_${lang}`] ||
          say('Traduction indisponible', 'Translation unavailable')));
        title.append(paragraph);
      }
      const authorsCell = element('td');
      for (const author of record.author_details || []) {
        if (authorsCell.children.length) authorsCell.append(element('span', ' · '));
        const authorNode = element(author.roster ? 'a' : 'span', author.name);
        if (author.roster) {
          authorNode.dataset.route = `/who/${author.id}`;
          authorNode.href = link(authorNode.dataset.route);
        }
        authorsCell.append(authorNode);
      }
      if (!record.authors.length) authorsCell.append(element('span', say('Non attribué', 'Unattributed')));
      const pages = element('td', `${range(record.printed_from, record.printed_to)} · PDF ${range(record.pdf_from, record.pdf_to)}`);
      row.append(kind, title, authorsCell, pages, element('td', record.lang === 'both' ? 'FR + EN' : 'FR'));
      row.onclick = event => {
        if (event.target.closest('a, button, input') || event.ctrlKey || event.metaKey || event.shiftKey || event.button) return;
        title.children[0]?.children[0]?.click();
      };
      body.append(row);
    }
    table.append(body);
    results.replaceChildren(table);
  }
  allTab.onclick = () => { options.tab = 'all'; draw(); };
  speechTab.onclick = () => { options.tab = 'speeches'; options.kind = ''; draw(); };
  search.oninput = () => { options.q = search.value; draw(); };
  clear.onclick = () => {
    Object.assign(options, { kind: '', author: '', phase: '', lang: '', q: '', from: '', to: '' });
    search.value = '';
    for (const input of controls.querySelectorAll('input[type="number"]')) input.value = '';
    draw();
  };
  draw();
}
