import { element } from './chrono.js?v=5bf29e1df6';
import { link, navigate } from '../state.js?v=5bf29e1df6';
import { contextLink } from '../context.js?v=5bf29e1df6';

export const glyphs = { support: '●', oppose: '○', conditional: '◐', unclear: '◌', abstain: '−' };
const stanceLabels = {
  support: ['Soutien', 'Support'], oppose: ['Opposition', 'Oppose'], conditional: ['Conditionnel', 'Conditional'],
  unclear: ['Incertain', 'Unclear'], abstain: ['Abstention', 'Abstain'],
};
export const say = (state, fr, en) => state.dl === 'fr' ? fr : state.dl === 'both' ? `${fr} / ${en}` : en;
export function localText(row, state, prefix = 'text') {
  const fr = row?.[`${prefix}_fr`], en = row?.[`${prefix}_en`];
  return state.dl === 'both' && fr && en && fr !== en ? `${fr} / ${en}`
    : (state.dl === 'fr' ? fr || en : en || fr) || row?.id || '—';
}
export function routeAnchor(text, route) {
  const a = element('a', text);
  a.href = link(route); a.dataset.route = route;
  return a;
}
export async function getPositions(path, api) {
  if (typeof api?.positions === 'function') return api.positions(path);
  const response = await fetch(`/api/positions/${path}`);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}
export function selector(host, label, values, value, onChange) {
  const wrapper = element('label', `${label} `), select = element('select');
  for (const [key, text] of values) {
    const option = element('option', text); option.value = key;
    select.append(option);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  wrapper.append(select); host.append(wrapper);
  return select;
}
export function layerControl(host, state, onChange) {
  return selector(host, say(state, 'Couche', 'Layer'), [
    ['votes-only', say(state, 'Votes nominatifs', 'Named votes')],
    ['primary', say(state, 'Positions consignées et votes', 'Recorded positions + votes')],
    ['+disputed', say(state, 'Avec désaccords', 'Include disputed')],
  ], state.layer || 'primary', onChange);
}
export function quoteCard(event, state) {
  const card = element('div', undefined, 'pos-quote');
  const text = element('blockquote', event.quote || say(state, 'Sans citation', 'No quotation'));
  if (event.lang) text.lang = event.lang;
  const labels = stanceLabels[event.stance];
  card.append(element('small', [event.person_id, labels ? say(state, ...labels) : '', event.layer,
    event.mode].filter(Boolean).join(' · ')), text);
  if (event.condition) card.append(element('p', event.condition));
  if (event.seg_id && event.meeting) card.append(contextLink(
    `${say(state, 'Séance', 'Meeting')} ${event.meeting} · ${event.seg_id}`,
    { meeting: event.meeting, segs: [event.seg_id] }));
  return card;
}
export function showQuotes(host, cell, state) {
  host.replaceChildren(element('h3', `${cell.person_id} · ${cell.prop_id}`));
  for (const event of cell.timeline || [cell]) host.append(quoteCard(event, state));
  host.hidden = false;
  host.focus({ preventScroll: true });
}
export function stanceButton(cell, state, details) {
  const button = element('button', glyphs[cell.stance] || '·', `pos-glyph pos-${cell.layer || 'none'}`);
  button.type = 'button';
  const labels = stanceLabels[cell.stance];
  const label = labels ? say(state, ...labels) : say(state, 'Aucune position', 'No position');
  button.title = `${label} · ${cell.layer || '—'}${cell.mixed ? ' · ↔' : ''}`;
  button.setAttribute('aria-label', `${cell.person_id || ''}: ${button.title}`);
  button.disabled = !cell.timeline?.length && !cell.quote;
  button.addEventListener('click', () => showQuotes(details, cell, state));
  return button;
}
export function table(host, headers) {
  const scroll = element('div', undefined, 'pos-scroll'), table = element('table', undefined, 'pos-matrix');
  const head = element('thead'), row = element('tr');
  for (const header of headers) {
    const th = element('th'); th.scope = 'col';
    th.append(typeof header === 'string' ? document.createTextNode(header) : header); row.append(th);
  }
  head.append(row);
  const body = element('tbody'); table.append(head, body); scroll.append(table); host.append(scroll);
  return body;
}
function detailsPanel(host, state) {
  const details = element('section', undefined, 'pos-evidence');
  details.tabIndex = -1; details.hidden = true;
  details.setAttribute('aria-label', say(state, 'Citations', 'Quotations'));
  host.append(details); return details;
}
export function outcomeText(outcome, state) {
  const labels = { adopted: ['Adopté', 'Adopted'], rejected: ['Rejeté', 'Rejected'],
    withdrawn: ['Retiré', 'Withdrawn'], referred: ['Renvoyé', 'Referred'], renumbered: ['Renuméroté', 'Renumbered'] };
  return `${labels[outcome.outcome] ? say(state, ...labels[outcome.outcome]) : outcome.outcome || '—'}${
    ['for', 'against', 'abstain'].some(k => outcome[k] != null)
      ? ` (${outcome.for ?? '—'} / ${outcome.against ?? '—'} / ${outcome.abstain ?? '—'})` : ''}`;
}
function legend(host, state) {
  host.append(element('p', Object.entries(stanceLabels).map(([key, labels]) =>
    `${glyphs[key]} ${say(state, ...labels)}`).join(' · '), 'pos-legend'));
  host.append(element('p', say(state, 'Plein : accord · contour : désaccord · encadré : vote · grisé : absent',
    'Solid: agreed · outlined: disputed · boxed: vote · shaded: absent'), 'pos-legend'));
}
function layerPath(path, state) { return `${path}?${new URLSearchParams({ layer: state.layer || 'primary' })}`; }

async function debateView(host, state, api, meeting) {
  const data = await getPositions(`${layerPath(`meetings/${meeting}/debate`, state)}${
    state.issue ? `&issue=${encodeURIComponent(state.issue)}` : ''}`, api);
  if (!host.isConnected) return;
  host.append(element('h2', `${say(state, 'Carte du débat', 'Debate map')} · ${meeting}`));
  const nav = element('nav', undefined, 'pos-meetings');
  nav.setAttribute('aria-label', say(state, 'Séances', 'Meetings'));
  for (let n = 1; n <= 35; n++) {
    const a = routeAnchor(String(n), `/debate/${n}`);
    if (n === meeting) a.setAttribute('aria-current', 'page'); nav.append(a);
  }
  host.append(nav);
  const controls = element('div', undefined, 'pos-controls'); host.append(controls);
  layerControl(controls, state, layer => navigate(`/debate/${meeting}`, { layer }));
  selector(controls, say(state, 'Question', 'Issue'), [['', say(state, 'Toutes', 'All')],
    ...data.available_issues.map(i => [i.id, localText(i, state, 'label')])], state.issue || '',
  issue => navigate(`/debate/${meeting}`, { issue }));
  legend(host, state);
  const details = detailsPanel(host, state);
  if (!data.issues.length) host.append(element('p', say(state, 'Aucune position enregistrée.', 'No recorded positions.')));
  for (const group of data.issues) {
    host.append(element('h3', localText(group.issue, state, 'label')));
    const body = table(host, [say(state, 'Proposition', 'Proposition'), ...data.members.map(m => m.name),
      say(state, 'Décision (pour / contre / abstention)', 'Outcome (for / against / abstain)')]);
    for (const prop of group.propositions) {
      const row = element('tr'), title = element('th'); title.scope = 'row';
      title.append(routeAnchor(localText(prop, state), `/prop/${encodeURIComponent(prop.id)}`)); row.append(title);
      for (const cell of prop.cells) {
        const td = element('td', undefined, cell.present ? '' : 'pos-absent');
        if (!cell.present) td.title = say(state, 'Absent', 'Absent');
        td.append(stanceButton(cell, state, details)); row.append(td);
      }
      const outcome = element('td', prop.outcomes.map(o => outcomeText(o, state)).join('; ') || '—');
      if (prop.tally_violations.length) outcome.append(element('strong', say(state, ' ⚠ Décompte incohérent',
        ' ⚠ Tally violation')));
      row.append(outcome); body.append(row);
    }
  }
}

export async function renderProposition(host, state, api, propId) {
  const data = await getPositions(layerPath(`propositions/${encodeURIComponent(propId)}`, state), api);
  if (!host.isConnected) return;
  host.append(element('h2', localText(data, state)), element('p', localText(data.issue, state, 'label')));
  const controls = element('div', undefined, 'pos-controls'); host.append(controls);
  layerControl(controls, state, layer => navigate(`/prop/${encodeURIComponent(propId)}`, { layer }));
  for (const lineage of data.lineages) host.append(routeAnchor(lineage, `/prov/${encodeURIComponent(lineage)}`));
  if (data.parent) host.append(element('p', say(state, 'Précise :', 'Refines: ')),
    routeAnchor(data.parent, `/prop/${encodeURIComponent(data.parent)}`));
  for (const rival of data.rivals || []) host.append(element('p', say(state, 'Rivale :', 'Rival: ')),
    routeAnchor(rival, `/prop/${encodeURIComponent(rival)}`));
  legend(host, state);
  const details = detailsPanel(host, state);
  const meetings = [...new Set(data.timeline.map(e => e.meeting))].sort((a, b) => a - b);
  const body = table(host, [say(state, 'Membre', 'Member'), ...meetings.map(String)]);
  for (const person of data.members) {
    const row = element('tr'); row.append(element('th', person.name));
    for (const meeting of meetings) {
      const td = element('td');
      const events = data.timeline.filter(e => e.person_id === person.id && e.meeting === meeting);
      for (const event of events) td.append(stanceButton({ ...event, timeline: [event] }, state, details));
      row.append(td);
    }
    body.append(row);
  }
  host.append(element('h3', say(state, 'Historique des décisions', 'Outcome history')));
  for (const outcome of data.outcomes) {
    host.append(element('p', `${outcome.meeting} · ${outcomeText(outcome, state)}`), quoteCard(outcome, state));
  }
  host.append(element('h3', say(state, 'Citations', 'Quotations')));
  if (!data.timeline.length) host.append(element('p', say(state, 'Aucune position enregistrée.', 'No recorded positions.')));
  for (const event of data.timeline) host.append(quoteCard(event, state));
}

export async function renderCompare(host, state, api, a, b) {
  const data = await getPositions(`compare?${new URLSearchParams({ a, b, layer: state.layer || 'primary' })}`, api);
  if (!host.isConnected) return;
  host.append(element('h2', `${data.a.name} ↔ ${data.b.name}`));
  const controls = element('div', undefined, 'pos-controls'); host.append(controls);
  layerControl(controls, state, layer => navigate(`/compare/${encodeURIComponent(a)},${encodeURIComponent(b)}`, { layer }));
  for (const group of data.issues) {
    host.append(element('h3', localText(group.issue, state, 'label')));
    for (const prop of group.propositions) {
      const section = element('section', undefined, 'pos-comparison');
      section.append(routeAnchor(localText(prop, state), `/prop/${encodeURIComponent(prop.id)}`), element('p',
        prop.comparison === 'agree' ? say(state, 'Accord', 'Agreement') : prop.comparison === 'conflict'
          ? say(state, 'Désaccord', 'Conflict') : say(state, 'Position nuancée / incertaine', 'Qualified / unclear')));
      for (const [person, cell] of [[data.a, prop.a], [data.b, prop.b]]) {
        section.append(element('h4', person.name));
        for (const event of cell.timeline) section.append(quoteCard(event, state));
      }
      host.append(section);
    }
  }
  if (!data.issues.length) host.append(element('p', say(state, 'Aucune proposition partagée.', 'No shared propositions.')));
}

export async function renderPersonPositions(root, personId, state) {
  const host = element('section', undefined, 'positions-view'); root.replaceChildren(host);
  host.setAttribute('aria-busy', 'true');
  try {
    const data = await getPositions(layerPath(`persons/${encodeURIComponent(personId)}/positions`, state));
    if (!root.contains(host)) return;
    host.append(element('h3', say(state, 'Positions', 'Positions')));
    const controls = element('div', undefined, 'pos-controls'); host.append(controls);
    layerControl(controls, state, layer => { renderPersonPositions(root, personId, { ...state, layer }); });
    const details = detailsPanel(host, state);
    for (const group of data.issues) {
      host.append(element('h4', localText(group.issue, state, 'label')));
      const body = table(host, [say(state, 'Proposition', 'Proposition'), say(state, 'Chronologie', 'Timeline')]);
      for (const prop of group.propositions) {
        const row = element('tr'), title = element('th'), timeline = element('td');
        title.append(routeAnchor(localText(prop, state), `/prop/${encodeURIComponent(prop.id)}`));
        if (prop.reversal) title.append(element('strong', say(state, ' ↔ Renversement', ' ↔ Reversal')));
        for (const event of prop.position.timeline) {
          timeline.append(element('small', `${event.meeting} `), stanceButton({ ...event, timeline: [event] }, state, details));
        }
        row.append(title, timeline); body.append(row);
      }
    }
    host.append(element('h4', say(state, 'Propositions présentées et sort', 'Proposals authored and fate')));
    for (const prop of data.proposals) {
      const p = element('p'); p.append(routeAnchor(localText(prop, state), `/prop/${encodeURIComponent(prop.id)}`),
        document.createTextNode(` · ${prop.outcomes.map(o => outcomeText(o, state)).join('; ') || '—'}`)); host.append(p);
    }
    const names = Object.fromEntries(data.members.map(m => [m.id, m.name]));
    for (const [key, title] of [['closest', say(state, 'Plus proches', 'Closest')],
      ['furthest', say(state, 'Plus éloignés', 'Furthest')]]) {
      host.append(element('h4', title));
      if (!data[key].length) host.append(element('p', say(state, 'Moins de 5 propositions partagées.', 'Fewer than 5 shared propositions.')));
      for (const pair of data[key]) {
        const p = element('p'); p.append(routeAnchor(names[pair.person_id] || pair.person_id,
          `/compare/${encodeURIComponent(personId)},${encodeURIComponent(pair.person_id)}`),
        document.createTextNode(` · n=${pair.shared} · sim=${pair.sim.toFixed(2)} · IC/CI 90% ${pair.ci.map(x => x.toFixed(2)).join('…')}`));
        host.append(p);
      }
    }
    if (!data.issues.length) host.append(element('p', say(state, 'Aucune position enregistrée.', 'No recorded positions.')));
  } catch (error) { if (root.contains(host)) host.append(element('p', error.message, 'status')); }
  finally { host.removeAttribute('aria-busy'); }
}

export async function render(root, state, api) {
  const host = element('section', undefined, 'positions-view'); root.replaceChildren(host);
  host.setAttribute('aria-busy', 'true');
  const status = element('p', say(state, 'Chargement…', 'Loading…'), 'status'); host.append(status);
  const [path] = location.hash.slice(1).split('?');
  const [, view = 'debate', selected = '15'] = path.split('/');
  try {
    if (view === 'prop') await renderProposition(host, state, api, decodeURIComponent(selected));
    else if (view === 'compare') {
      const [a, b] = selected.split(',').map(decodeURIComponent); await renderCompare(host, state, api, a, b);
    } else await debateView(host, state, api, Number(selected) || 15);
  } catch (error) { if (root.contains(host)) host.append(element('p', error.message, 'status')); }
  finally { status.remove(); host.removeAttribute('aria-busy'); }
}
