


import { element } from './chrono.js?v=1509f92807';
import { link, state as sharedState } from '../state.js?v=1509f92807';

const requests = new WeakMap();
const labels = {
  members: ['Membres et intervenants', 'Members and speakers'],
  present: ['séances de présence', 'meetings present'], turns: ['interventions', 'turns'],
  words: ['Mots consignés', 'Recorded words'], presence: ['Présence', 'Attendance'],
  activity: ['Interventions par séance', 'Turns per meeting'],
  absent: ['absent', 'absent'], partial: ['présence partielle', 'partial attendance'],
  other: ['autre participant présent', 'other participant present'],
  attended: ['présent', 'present'], meeting: ['Séance', 'Meeting'],
  compare: ['Comparer avec', 'Compare with'], choose: ['Choisir une personne', 'Choose a person'],
  all: ['Tous les membres', 'All members'], loading: ['Chargement…', 'Loading…'],
  unresolved: ['Intervenant indéterminé', 'Unresolved speaker'],
  inferred: ['Attribution déduite', 'Inferred attribution'],
  excluded: ['interventions indéterminées exclues des statistiques nominatives',
    'unresolved turns excluded from person statistics'],
  empty: ['Aucune intervention consignée.', 'No recorded turns.'],
  member: ['membre', 'member'], adviser: ['conseiller', 'adviser'],
  secretariat: ['secrétariat', 'secretariat'], guest: ['invité', 'guest'],
  collective: ['Comité (impersonnel)', 'Committee (impersonal)'], chair: ['président', 'chair'],
  subturn_candidate: ['Autre intervenant possible dans ce passage', 'Possible other speaker within this passage'],
  fr_en_disagree: ['Désaccord entre les indices FR et EN', 'FR and EN cues disagree'],
  absent_speaker: ['Intervenant absent selon la liste de présence', 'Speaker absent in the attendance record'],
};
function tr(key, dl) {
  const pair = labels[key] || [key, key];
  return dl === 'both' && pair[0] !== pair[1] ? pair.join(' / ') : pair[dl === 'en' ? 1 : 0];
}
function anchor(text, path, className) {
  const a = element('a', text, className);
  a.href = link(path);
  a.dataset.route = path;
  return a;
}
async function read(path) {
  const response = await fetch(`/api/speakers/${path}`);
  if (!response.ok) {
    let message = `Speakers request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}
export const speakersApi = {
  persons: () => read('persons'),
  person: id => read(`persons/${encodeURIComponent(id)}`),
};

export function speakerChip(turn) {
  const dl = sharedState.dl || 'both';
  const cue = (dl === 'en' ? turn.cue_en || turn.cue_fr : turn.cue_fr || turn.cue_en)?.form;
  const name = turn.speaker_id === 'collective' ? tr('collective', dl)
    : cue || turn.speaker_id || tr('unresolved', dl);
  const chip = turn.speaker_id ? anchor(name, `/who/${turn.speaker_id}`, 'speaker-chip')
    : element('span', name, 'speaker-chip');
  chip.classList.add(turn.certain ? 'cued' : 'unresolved');
  chip.dataset.speaker = turn.speaker_id || '';
  const hints = [turn.capacity ? tr(turn.capacity, dl) : '',
    turn.certain ? '' : tr('unresolved', dl),
    ...(turn.flags || []).map(flag => tr(flag, dl))].filter(Boolean);
  chip.title = hints.join(' · ');
  if (turn.orig_lang) chip.append(element('small', ` · ${turn.orig_lang.toUpperCase()}`, 'original-language'));
  return chip;
}

function metadata(person, dl) {
  return [tr(person.role, dl), person.state, person.seat].filter(Boolean).join(' · ');
}
function presenceStrip(person, dl) {
  const section = element('section', undefined, 'members-presence');
  section.append(element('h3', tr('presence', dl)));
  const strip = element('ol', undefined, 'presence-strip');
  for (const entry of person.presence) {
    const cell = element('li', undefined, `presence-${entry.kind}`);
    const kind = entry.kind === 'present' ? 'attended' : entry.kind;
    const description = `${tr('meeting', dl)} ${entry.meeting}: ${tr(kind, dl)}${entry.note ? ` · ${entry.note}` : ''}`;
    const a = anchor(String(entry.meeting), `/m/${entry.meeting}`);
    a.title = description;
    a.setAttribute('aria-label', description);
    cell.append(a);
    strip.append(cell);
  }
  section.append(strip, element('p', `${tr('absent', dl)} ▧ · ${tr('partial', dl)} ◩`, 'presence-legend'));
  return section;
}
function activityStrip(person, dl, ceiling) {
  const section = element('section');
  section.append(element('h3', tr('activity', dl)));
  const strip = element('ol', undefined, 'turns-strip');
  for (const entry of person.presence) {
    const cell = element('li');
    const a = anchor('', `/m/${entry.meeting}`);
    const words = dl === 'fr' ? `FR ${entry.words_fr}` : dl === 'en' ? `EN ${entry.words_en}`
      : `FR ${entry.words_fr} · EN ${entry.words_en}`;
    const description = `${tr('meeting', dl)} ${entry.meeting}: ${entry.turns} ${tr('turns', dl)} · ${tr('words', dl)} ${words}`;
    a.title = description;
    a.setAttribute('aria-label', description);
    const bar = element('span', undefined, 'turns-bar');
    bar.style.height = `${4 * entry.turns / ceiling}rem`;
    a.append(bar, element('small', String(entry.meeting)));
    cell.append(a);
    strip.append(cell);
  }
  section.append(strip);
  return section;
}
function profile(person, dl, ceiling) {
  const card = element('article', undefined, 'member-profile');
  card.append(element('h2', person.name), element('p', metadata(person, dl)),
    element('p', `${person.meetings_present}/35 ${tr('present', dl)} · ${person.turns} ${tr('turns', dl)}`),
    presenceStrip(person, dl), activityStrip(person, dl, ceiling));
  const counts = dl === 'en' ? `EN ${person.words_en.toLocaleString()}`
    : dl === 'fr' ? `FR ${person.words_fr.toLocaleString()}`
      : `FR ${person.words_fr.toLocaleString()} · EN ${person.words_en.toLocaleString()}`;
  card.append(element('p', `${tr('words', dl)}: ${counts}`));
  card.append(element('p', `${person.excluded_unresolved_turns} ${tr('excluded', dl)}.`, 'members-note'));
  if (person.note) card.append(element('p', person.note, 'members-note'));
  card.append(element('h3', tr('turns', dl)));
  const list = element('ol', undefined, 'member-turns');
  for (const turn of person.turn_list) {
    const item = element('li');
    item.append(anchor(`${tr('meeting', dl)} ${turn.meeting} · ${turn.id}`,
      `/m/${turn.meeting}/${turn.seg_ids[0]}`), document.createTextNode(' · '), speakerChip(turn));
    if (turn.flags.length) item.append(element('p', turn.flags.map(f => tr(f, dl)).join(' · '), 'turn-warning'));
    for (const lang of dl === 'both' ? ['fr', 'en'] : [dl]) {
      const p = element('p', turn[`text_${lang}`] || '—', `turn-snippet ${lang}`);
      p.lang = lang;
      item.append(p);
    }
    list.append(item);
  }
  card.append(person.turn_list.length ? list : element('p', tr('empty', dl)));
  return card;
}

export async function render(root, state, api) {
  const token = Symbol();
  requests.set(root, token);
  const dl = ['fr', 'en', 'both'].includes(state.dl) ? state.dl : 'both';
  const service = api?.speakers || (api?.persons && api?.person ? api : speakersApi);
  root.classList.add('members-view');
  root.setAttribute('aria-busy', 'true');
  root.replaceChildren(element('p', tr('loading', dl), 'status'));
  try {
    const path = state.path || location.hash.slice(1).split('?')[0];
    const ids = (path.split('/')[2] || '').split(',').filter(Boolean).map(decodeURIComponent);
    if (ids.length > 2) throw new Error(dl === 'fr' ? 'Choisir deux personnes au maximum.' : 'Choose at most two people.');
    const persons = await service.persons();
    if (requests.get(root) !== token) return;
    if (!ids.length) {
      root.replaceChildren(element('h2', tr('members', dl)));
      const grid = element('div', undefined, 'member-cards');
      for (const person of persons) {
        const card = element('article', undefined, 'member-card');
        const h = element('h3');
        h.append(anchor(person.name, `/who/${person.id}`));
        card.append(h, element('p', metadata(person, dl)),
          element('p', `${person.meetings_present}/35 ${tr('present', dl)} · ${person.turns} ${tr('turns', dl)}`));
        grid.append(card);
      }
      root.append(grid);
      return;
    }
    const profiles = await Promise.all(ids.map(id => service.person(id)));
    if (requests.get(root) !== token) return;
    root.replaceChildren(anchor(tr('all', dl), '/who'));
    if (profiles.length === 1) {
      const label = element('label', `${tr('compare', dl)} `);
      const select = element('select');
      select.append(element('option', tr('choose', dl)));
      select.firstChild.value = '';
      for (const person of persons.filter(p => p.id !== ids[0])) {
        const option = element('option', person.name);
        option.value = person.id;
        select.append(option);
      }
      label.append(select);
      const go = anchor(tr('compare', dl), `/who/${ids[0]}`);
      go.hidden = true;
      select.addEventListener('change', () => {
        go.hidden = !select.value;
        go.dataset.route = `/who/${ids[0]},${select.value}`;
        go.href = link(go.dataset.route);
      });
      root.append(label, go);
    }
    const compare = element('div', undefined, profiles.length === 2 ? 'member-compare' : 'member-single');
    const ceiling = Math.max(1, ...profiles.flatMap(p => p.turns_per_meeting));
    for (const person of profiles) compare.append(profile(person, dl, ceiling));
    root.append(compare);
  } catch (error) {
    if (requests.get(root) === token) root.replaceChildren(element('p', error.message, 'status'));
  } finally {
    if (requests.get(root) === token) root.removeAttribute('aria-busy');
  }
}
