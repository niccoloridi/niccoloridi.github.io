import { element } from './chrono.js?v=1509f92807';
import { navigate } from '../state.js?v=1509f92807';
import { getPositions, layerControl, localText, quoteCard, routeAnchor, say, selector,
  stanceButton, table } from './debate.js?v=1509f92807';

function dendrogram(host, data, names, state) {
  if (!data.dendrogram.length) return;
  host.append(element('h3', say(state, 'Classification exploratoire · fréquences bootstrap',
    'Exploratory hierarchy · bootstrap frequencies')));
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  const width = 760, height = Math.max(140, data.members.length * 36 + 35);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.classList.add('pos-dendrogram');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', say(state,
    'Classification moyenne, distance 1 moins similarité; les branches ne sont pas des coalitions validées.',
    'Average linkage, distance 1 minus similarity; branches are not validated coalitions.'));
  const maxDistance = Math.max(1, ...data.dendrogram.map(d => d.distance));
  const positions = new Map();
  const append = (tag, attrs, text) => {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text; svg.append(el); return el;
  };
  (data.matrix || []).map(row => row.person_id).forEach((person, i) => {
    const index = data.members.indexOf(person), y = 24 + i * 36;
    positions.set(index, { x: 240, y });
    append('text', { x: 230, y: y + 4, 'text-anchor': 'end' }, names[person] || person);
  });
  data.dendrogram.forEach((branch, index) => {
    const left = positions.get(branch.left), right = positions.get(branch.right);
    const x = 250 + branch.distance / maxDistance * 430, y = (left.y + right.y) / 2;
    append('path', { d: `M${left.x},${left.y} H${x} V${right.y} H${right.x}`, fill: 'none' });
    append('text', { x: x + 5, y: y - 4 }, `${Math.round(branch.stability * 100)}%`);
    positions.set(data.members.length + index, { x, y });
  });
  host.append(svg);
}

export async function render(root, state, api) {
  const host = element('section', undefined, 'positions-view coalitions-view'); root.replaceChildren(host);
  host.setAttribute('aria-busy', 'true');
  const status = element('p', say(state, 'Chargement…', 'Loading…'), 'status'); host.append(status);
  try {
    const data = await getPositions(`coalitions?${new URLSearchParams({
      scope: state.scope || 'all', layer: state.layer || 'primary',
    })}`, api);
    if (!root.contains(host)) return;
    const names = Object.fromEntries(data.people.map(p => [p.id, p.name]));
    const props = Object.fromEntries(data.proposition_details.map(p => [p.id, p]));
    host.append(element('h2', say(state, 'Alignements enregistrés', 'Recorded alignment')));
    const controls = element('div', undefined, 'pos-controls'); host.append(controls);
    selector(controls, say(state, 'Périmètre', 'Scope'), data.scopes.map(s => [s.id, localText(s, state, 'label')]),
      data.scope, scope => navigate('/coal', { scope }));
    layerControl(controls, state, layer => navigate('/coal', { layer }));
    host.append(element('p', say(state,
      'Similarité = (accords − conflits) / propositions partagées. Les positions nuancées restent au dénominateur. Hachures : moins de 5 propositions partagées, exclues du regroupement.',
      'Similarity = (agreements − conflicts) / shared propositions. Qualified positions remain in the denominator. Hatching: fewer than 5 shared propositions, excluded from grouping.'), 'intro'));
    const verdicts = {
      above_null: ['Des groupes dépassent 95 % des permutations du signe par proposition.',
        'Reported groups beat 95% of within-proposition sign permutations.'],
      not_above_null: ['Aucun groupe ne dépasse le seuil de permutation à 95 %.',
        'No grouping beats the 95% permutation threshold.'],
      insufficient_evidence: ['Données insuffisantes pour signaler une coalition.',
        'Insufficient evidence to report a coalition.'],
      issue_descriptive: ['Par question : positions descriptives uniquement, sans regroupement.',
        'Issue scope: descriptive positions only; no clustering.'],
    };
    host.append(element('p', `${say(state, ...verdicts[data.verdict])}${
      data.null_p == null ? '' : ` p=${data.null_p.toFixed(3)}`}`, 'pos-verdict'));
    host.append(element('p', `${say(state, 'Graine', 'Seed')} ${data.seed} · bootstrap ${data.bootstraps} · ${
      say(state, 'permutations', 'permutations')} ${data.permutations}`, 'pos-legend'));
    for (const cluster of []) host.append(element('p',
      `${cluster.members.map(m => names[m] || m).join(', ')} · ${say(state, 'stabilité', 'stability')} ${
        (cluster.stability * 100).toFixed(0)}% · p=${cluster.null_p.toFixed(3)}`));
    const details = element('section', undefined, 'pos-evidence');
    details.hidden = true; details.tabIndex = -1; details.setAttribute('aria-live', 'polite');
    host.append(details);
    let clickVersion = 0;
    const body = table(host, ['', ...(data.matrix || []).map(row => row.person_id).map(m => names[m] || m)]);
    for (const a of (data.matrix || []).map(row => row.person_id)) {
      const row = element('tr'); row.append(element('th', names[a] || a));
      for (const b of (data.matrix || []).map(row => row.person_id)) {
        const td = element('td');
        if (a === b) { td.textContent = '—'; row.append(td); continue; }
        const pair = data.pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
        if (!pair) { td.textContent = '·'; row.append(td); continue; }
        const button = element('button', pair.sim == null ? '·' : pair.sim.toFixed(2),
          `pos-pair ${pair.eligible ? '' : 'pos-sparse'} ${pair.sim > 0 ? 'pos-positive' : pair.sim < 0 ? 'pos-negative' : ''}`);
        button.type = 'button';
        button.title = `${names[a]} ↔ ${names[b]} · ${say(state, 'partagées', 'shared')}=${pair.shared} · ${
          say(state, 'accords', 'agree')}=${pair.agree} · ${say(state, 'conflits', 'conflict')}=${pair.conflict} · ${
          say(state, 'IC', 'CI')} 90%: ${pair.ci?.map(n => n.toFixed(2)).join('…') || '—'}`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', async () => {
          const version = ++clickVersion;
          details.hidden = false;
          details.replaceChildren(element('p', say(state, 'Chargement…', 'Loading…')));
          try {
            const comparison = await getPositions(`compare?${new URLSearchParams({ a, b, layer: data.layer })}`, api);
            if (!root.contains(host) || version !== clickVersion) return;
            details.replaceChildren(routeAnchor(`${names[a]} ↔ ${names[b]}`,
              `/compare/${encodeURIComponent(a)},${encodeURIComponent(b)}`));
            for (const group of comparison.issues) {
              details.append(element('h3', localText(group.issue, state, 'label')));
              for (const prop of group.propositions) {
                details.append(routeAnchor(localText(prop, state), `/prop/${encodeURIComponent(prop.id)}`));
                for (const cell of [prop.a, prop.b]) for (const event of cell.timeline) details.append(quoteCard(event, state));
              }
            }
            if (!comparison.issues.length) details.append(element('p', say(state, 'Aucune proposition partagée.', 'No shared propositions.')));
            details.focus({ preventScroll: true });
          } catch (error) { if (version === clickVersion) details.replaceChildren(element('p', error.message, 'status')); }
        });
        td.append(button); row.append(td);
      }
      body.append(row);
    }
    dendrogram(host, data, names, state);
    if (data.louvain.groups.length) host.append(element('p', `${say(state,
      'Contrôle de robustesse Louvain (exploratoire)', 'Louvain robustness check (exploratory)')}: ${
      data.louvain.groups.map(g => g.map(m => names[m] || m).join(', ')).join(' | ')}`, 'pos-legend'));
    host.append(element('h3', say(state, 'Membres × propositions (ordre de la classification)',
      'Members × propositions (hierarchy order)')));
    const heatmap = table(host, ['', ...data.propositions.map(p => {
      const a = routeAnchor(p, `/prop/${encodeURIComponent(p)}`); a.title = localText(props[p], state); return a;
    })]);
    for (const member of data.matrix) {
      const row = element('tr'); row.append(element('th', names[member.person_id] || member.person_id));
      for (const cell of member.cells) {
        const td = element('td');
        if (cell) td.append(stanceButton(cell, state, details)); else td.textContent = '·'; row.append(td);
      }
      heatmap.append(row);
    }
    if (!data.propositions.length) host.append(element('p', say(state, 'Aucune position enregistrée.', 'No recorded positions.')));
  } catch (error) { if (root.contains(host)) host.append(element('p', error.message, 'status')); }
  finally { status.remove(); host.removeAttribute('aria-busy'); }
}
