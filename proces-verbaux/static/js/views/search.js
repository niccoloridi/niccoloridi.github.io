import { element } from './chrono.js?v=500c5c3c2b';
import { link, navigate } from '../state.js?v=500c5c3c2b';

let request = 0;

async function get(path, params) {
  const response = await fetch(`/api/search${path}?${new URLSearchParams(params)}`);
  if (!response.ok) {
    let message = `Search failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}

function select(label, name, values, selected) {
  const wrapper = element('label', `${label} `);
  const control = element('select');
  control.name = name;
  for (const [value, text] of values) {
    const option = element('option', text);
    option.value = value;
    option.selected = value === selected;
    control.append(option);
  }
  wrapper.append(control);
  return wrapper;
}

function snippet(target, text) {
  const parsed = new DOMParser().parseFromString(text || '', 'text/html');
  function append(host, node) {
    if (node.nodeType === Node.TEXT_NODE) host.append(document.createTextNode(node.textContent));
    else if (node.nodeName === 'MARK') {
      const mark = element('mark');
      mark.textContent = node.textContent;
      host.append(mark);
    } else for (const child of node.childNodes) append(host, child);
  }
  append(target, parsed.body);
}

export async function render(root, state, api = {}) {
  const token = ++request;
  const container = element('div', undefined, 'search-view');
  root.replaceChildren(container);
  root = container;
  root.removeAttribute('aria-busy');
  const form = element('form', undefined, 'search-form');
  const label = element('label', 'Search the proceedings ');
  const input = element('input');
  input.type = 'search';
  input.name = 'q';
  input.value = state.q || '';
  input.maxLength = 2000;
  input.placeholder = 'Words, ideas, or “quoted phrases”';
  label.append(input);
  form.append(label,
    select('Mode', 'mode', [['hybrid', 'Match + related'], ['exact', 'Exact'], ['semantic', 'Related']], state.mode || 'hybrid'),
    select('Search language', 'lang', [['both', 'FR + EN'], ['fr', 'French'], ['en', 'English']], state.lang || 'both'));
  const button = element('button', 'Search');
  button.type = 'submit';
  form.append(button);
  const status = element('p', '', 'status');
  status.setAttribute('role', 'status');
  const results = element('div', undefined, 'search-results');
  root.replaceChildren(element('h2', 'Search'), form, status, results);
  if (state.m || state.doc) {
    status.textContent = [state.m && `Meetings ${state.m}`, state.doc && `Document ${state.doc}`]
      .filter(Boolean).join(' · ');
  }
  form.onsubmit = event => {
    event.preventDefault();
    navigate('/search', Object.fromEntries(new FormData(form)));
  };
  const params = Object.fromEntries(['q', 'mode', 'lang', 'm', 'doc'].filter(key => state[key])
    .map(key => [key, state[key]]));
  params.k = '50';

  async function show(items, target, allowSimilar = true) {
    const groups = new Map();
    for (const hit of items) {
      const key = hit.meeting ?? hit.doc;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(hit);
    }
    target.replaceChildren();
    for (const [meeting, hits] of groups) {
      const section = element('section', undefined, 'search-group');
      section.append(element('h3', `${typeof meeting === 'number' ? `Meeting ${meeting}` : meeting} · ${hits.length} results`));
      for (const hit of hits) {
        const card = element('article', undefined, 'search-card');
        const lexical = hit.match !== 'related';
        const dense = hit.match !== 'lexical';
        const header = element('header');
        const anchor = element('a', hit.seg_id);
        anchor.dataset.route = `/m/${hit.meeting ?? hit.doc}/${hit.seg_id}`;
        anchor.href = link(anchor.dataset.route);
        const badge = element('span', hit.match === 'both' ? 'match + related' : lexical ? 'match' : 'related', 'rank-badge');
        badge.title = badge.textContent;
        header.append(anchor, document.createTextNode(' '), badge);
        if (hit.pdf_from) header.append(element('small', ` · PDF ${hit.pdf_from}`));
        const pair = element('div', undefined, 'search-pair');
        for (const lang of state.dl === 'fr' ? ['fr'] : state.dl === 'en' ? ['en'] : ['fr', 'en']) {
          const column = element('div', undefined, `search-column ${lang}`);
          column.lang = lang;
          column.append(element('small', lang.toUpperCase()));
          const body = element('p');
          snippet(body, hit[`snippet_${lang}`]);
          column.append(body);
          pair.append(column);
        }
        card.append(header, pair);
        if (allowSimilar) {
          const more = element('button', 'More like this');
          more.type = 'button';
          const related = element('div', undefined, 'search-related');
          more.onclick = async () => {
            more.disabled = true;
            related.textContent = 'Loading similar passages…';
            try {
              const scope = Object.fromEntries(['lang', 'm', 'doc'].filter(key => state[key])
                .map(key => [key, state[key]]));
              scope.k = '10';
              const similar = api.similar ? await api.similar(hit.seg_id, scope)
                : await get(`/similar/${encodeURIComponent(hit.seg_id)}`, scope);
              if (token !== request || !root.isConnected) return;
              if (similar.length) await show(similar, related, false);
              else related.textContent = 'No similar passages found.';
            } catch (error) { related.textContent = error.message; }
            finally { more.disabled = false; }
          };
          card.append(more, related);
        }
        section.append(card);
      }
      target.append(section);
    }
  }
  if (!state.q?.trim()) {
    status.textContent = 'Enter a query. Double quotes search for a phrase in the text.';
    return;
  }
  root.setAttribute('aria-busy', 'true');
  status.textContent = 'Searching…';
  try {
    const hits = api.search ? await api.search(params) : await get('', params);
    if (token !== request || !root.isConnected) return;
    await show(hits, results);
    status.textContent = `${hits.length} results${hits.length === 50 ? ' (first 50)' : ''}`;
    if (state.m || state.doc) status.textContent += ` · ${[state.m && `meetings ${state.m}`, state.doc].filter(Boolean).join(' · ')}`;
  } catch (error) {
    if (token === request) status.textContent = error.message;
  } finally {
    if (token === request) root.removeAttribute('aria-busy');
  }
}
