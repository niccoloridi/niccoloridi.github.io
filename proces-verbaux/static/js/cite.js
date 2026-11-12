


const TITLE = 'Procès-verbaux of the Proceedings of the Advisory Committee of Jurists';
const IMPRINT = '(The Hague: Van Langenhuysen Brothers, 1920)';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

let current = null;            // { meeting, routeId }
const turnsByMeeting = new Map(); // meeting n -> Map(seg_id -> turn)
let documents = null;           // Map(annex_id -> document)
let persons = null;             // Map(person_id -> short name)

async function json(path) {
  const response = await fetch(`/api/${path}`);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}
function shortName(name) {
  const words = (name || '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const last = words[words.length - 1];
  const particle = words[words.length - 2];
  return particle && /^(de|van|von|da|di)$/.test(particle) ? `${particle} ${last}` : last;
}
function preload(meeting) {
  if (!persons) json('speakers/persons').then(list => {
    persons = new Map(list.filter(p => p.role !== 'collective').map(p => [p.id, shortName(p.name)]));
  }).catch(() => { persons = new Map(); });
  if (!documents) json('documents').then(list => {
    documents = new Map(list.filter(d => d.annex_id).map(d => [d.annex_id, d]));
  }).catch(() => { documents = new Map(); });
  const n = meeting?.n;
  if (n && !turnsByMeeting.has(n)) {
    turnsByMeeting.set(n, new Map());
    json(`speakers/meetings/${n}/turns`).then(turns => {
      const bySeg = new Map();
      for (const turn of turns) for (const seg of turn.seg_ids || []) bySeg.set(seg, turn);
      turnsByMeeting.set(n, bySeg);
    }).catch(() => {});
  }
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
function longDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  return y ? `${d} ${MONTHS[m - 1]} ${y}` : '';
}
function pages(segment) {
  const printed = [...new Set((segment.page_markers || []).map(p => p.printed).filter(p => p != null))];
  if (!printed.length) return segment.printed_from != null ? `p. ${segment.printed_from}` : '';
  return printed.length === 1 ? `p. ${printed[0]}` : `pp. ${printed[0]}–${printed[printed.length - 1]}`;
}
const KINDS = { draft: 'Draft', amendment: 'Amendments', proposal: 'Proposal', memo: 'Memorandum', speech: 'Speech',
  agenda: 'Agenda', report: 'Report', resolution: 'Resolution', rules: 'Rules', letter: 'Letter',
  reference_plan: 'Plan', other: 'Text' };
const GROUPS = { drafting_committee: 'the Drafting Committee', five_neutral_powers: 'the Five Neutral Powers' };
function authorList(ids) {
  const names = (ids || []).map(id => persons?.get(id) || GROUPS[id] || '').filter(Boolean);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';
}

function annexTitle(doc) {
  const raw = (doc?.title_en || doc?.title_fr || '').split(' · ')[0].trim().replace(/\.$/, '');
  if (raw && raw.length <= 100 && !/^(annex|annexe)\b/i.test(raw)) return raw;
  const by = authorList(doc?.authors);
  if (by) return `${KINDS[doc.kind] || 'Text'} by ${by}`;
  return raw ? `${raw.slice(0, 97).replace(/\s+\S*$/, '')}…` : '';
}
export function citation(segment) {
  const meeting = current?.meeting;
  const parts = [TITLE];
  if (meeting?.n) {
    let where = `${ordinal(meeting.n)} Meeting (${longDate(meeting.date)})`;
    if (segment.annex_id) {
      const annex = (meeting.annexes || []).find(a => a.id === segment.annex_id);
      const title = annexTitle(documents?.get(segment.annex_id));
      where += `, Annex ${annex?.number || segment.annex_id.split('.a').pop()}${title ? `: ${title}` : ''}`;
    }
    parts.push(where);
  } else if (segment.doc === 'index') parts.push('Analytical Index');
  let page = pages(segment);
  const turn = !segment.annex_id && meeting?.n ? turnsByMeeting.get(meeting.n)?.get(segment.id) : null;
  const speaker = turn && persons?.get(turn.speaker_id);
  if (speaker) page += ` (${speaker})`;
  if (page) parts.push(page);
  const url = `${location.origin}${location.pathname}#/m/${current?.routeId ?? meeting?.id}/${segment.id}`;
  return `${parts.join(', ')} ${IMPRINT}, also available at ${url}.`;
}

function toast(message) {
  document.querySelector('#cite-toast')?.remove();
  const box = document.createElement('div');
  box.id = 'cite-toast';
  box.setAttribute('role', 'status');
  box.textContent = message;
  document.body.append(box);
  setTimeout(() => box.remove(), 4000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {  }
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.append(area); area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}

export function enableCitations(meeting, routeId, segmentsById) {
  current = { meeting, routeId, segmentsById };
  preload(meeting);
}

document.querySelector('#reader')?.addEventListener('click', async event => {
  const row = event.target.closest('article.segment');
  if (!row || !current?.segmentsById) return;
  if (event.target.closest('a, button, sup, input, summary, .continuation')) return;
  const selection = window.getSelection && String(window.getSelection());
  if (selection && selection.trim()) return;  // selecting text, not clicking
  const segment = current.segmentsById.get(row.id);
  if (!segment) return;
  const text = citation(segment);
  const ok = await copy(text);
  toast(ok ? `Copied: ${text}` : `Copy failed — ${text}`);
  row.classList.add('cited');
  setTimeout(() => row.classList.remove('cited'), 900);
});
