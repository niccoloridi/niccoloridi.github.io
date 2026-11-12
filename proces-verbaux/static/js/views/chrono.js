import { api } from '../api.js?v=b1c575ee6d';
import { link, state } from '../state.js?v=b1c575ee6d';

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function title(meeting) {
  if (!meeting.n) return state.dl === 'fr' ? meeting.title_fr : meeting.title_en;
  return `${state.dl === 'fr' ? 'Séance' : 'Meeting'} ${meeting.n} · ${longDate(meeting.date, state.dl === 'fr' ? 'fr' : 'en')}`;
}
export function longDate(iso, lang = 'en') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = lang === 'fr' ? ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre',
    'octobre', 'novembre', 'décembre'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  return `${d}${lang === 'fr' && d === 1 ? 'er' : ''} ${months[m - 1]} ${y}`;
}
export function rail(meetings, selected) {
  const nav = document.querySelector('#meetings');
  nav.replaceChildren(element('p', 'Meetings · 1920', 'rail-label'));
  const list = element('ol');
  for (const meeting of meetings) {
    const item = element('li');
    const anchor = element('a', title(meeting));
    anchor.href = link(`/m/${meeting.id}`);
    anchor.dataset.route = `/m/${meeting.id}`;
    if (meeting.id === selected) anchor.setAttribute('aria-current', 'page');
    item.append(anchor);
    if (meeting.n) item.append(element('small', meeting.public ? 'public' : 'private'));
    const annexes = element('ul');
    for (const annex of meeting.annexes) {
      const child = element('li');
      const label = state.dl === 'fr' ? annex.label_fr || annex.label_en : annex.label_en || annex.label_fr;
      const a = element('a', label);
      a.href = link(`/m/${meeting.id}/${annex.seg_id}`);
      a.dataset.route = `/m/${meeting.id}/${annex.seg_id}`;
      child.append(a);
      annexes.append(child);
    }
    item.append(annexes);
    list.append(item);
  }
  nav.append(list);
}
function pageMarker(page, seen, host) {
  if (seen.has(page.pdf)) return;
  seen.add(page.pdf);
  const marker = element('div', undefined, 'page-marker');
  marker.id = `page-${page.pdf}`;
  const button = element('button', `${page.printed == null ? 'Front matter' : `p. ${page.printed}`} · PDF ${page.pdf}`);
  button.dataset.pdf = page.pdf;
  button.setAttribute('aria-label', `Open facsimile, PDF page ${page.pdf}`);
  marker.append(button);
  host.append(marker);
}
function noteList(notes) {
  const list = element('ol', undefined, 'notes');
  for (const note of notes) {
    const item = element('li', undefined, note.col);
    item.id = note.id;
    item.lang = note.col === 'full' ? 'fr' : note.col;
    const back = element('a', `${note.n}) ↩`, 'back');
    back.href = `#ref-${note.id}`;
    back.dataset.anchor = `ref-${note.id}`;
    back.setAttribute('aria-label', `Return to note ${note.n} reference`);
    const body = element('div');
    body.innerHTML = note.full_html;
    item.append(back, body);
    list.append(item);
  }
  return list;
}
let request = 0;
export async function chrono(meetings, id, segmentId) {
  const token = ++request;
  const main = document.querySelector('#reader');
  main.setAttribute('aria-busy', 'true');
  main.replaceChildren(element('p', 'Loading meeting…', 'status'));
  try {
    const meeting = await api.meeting(id);
    if (token !== request) return;
    main.replaceChildren(element('h2', title(meeting)));
    const intro = element('p', state.dl === 'fr' ? 'Édition en cours · texte en relecture — vérifiez le fac-similé avant de citer'
      : 'Edition in progress · text being proofread — check the facsimile before quoting', 'intro');
    main.append(intro);
    const sub = element('div', undefined, 'titles');
    for (const lang of ['fr', 'en']) {
      const text = element('p', meeting[`title_${lang}`] || '', lang);
      text.lang = lang;
      sub.append(text);
    }
    main.append(sub);
    const seen = new Set();
    const notesByPage = new Map();
    const segmentsByPage = new Map();
    for (const segment of meeting.segments) {
      if (!segmentsByPage.has(segment.pdf_from)) segmentsByPage.set(segment.pdf_from, []);
      segmentsByPage.get(segment.pdf_from).push(segment);
      for (const note of segment.note_details) {
        if (!notesByPage.has(note.page_pdf)) notesByPage.set(note.page_pdf, []);
        notesByPage.get(note.page_pdf).push(note);
      }
    }
    for (const page of meeting.pages) {
      pageMarker(page, seen, main);
      if (page.layout === 'blank') main.append(element('p', 'Blank page', 'blank'));
      for (const segment of segmentsByPage.get(page.pdf) || []) {
        const row = element('article', undefined, `segment ${segment.row_type} kind-${segment.kind}`);
        row.id = segment.id;
        row.dataset.pdf = segment.pdf_from;
        row.dataset.bbox = JSON.stringify({ fr: segment.bbox_fr, en: segment.bbox_en, full: segment.bbox_full });
        row.tabIndex = -1;
        row.setAttribute('aria-label', `Segment ${segment.id}`);
        for (const lang of segment.row_type === 'full' ? ['full'] : ['fr', 'en']) {
          const column = element('div', undefined, `column ${lang}`);
          column.lang = lang === 'full' ? (segment.doc === 'index' && page.pdf >= 781 ? 'en' : 'fr') : lang;
          column.innerHTML = segment[`${lang}_html`];
          row.append(column);
        }

        if (segment.page_markers.length > 1) {
          const continuation = element('div', 'Continues on ', 'continuation');
          for (const marker of segment.page_markers.slice(1)) {
            const button = element('button', `p. ${marker.printed} · PDF ${marker.pdf}`);
            button.dataset.pdf = marker.pdf;
            continuation.append(button);
          }
          row.append(continuation);
        }
        main.append(row);
      }
      if (notesByPage.has(page.pdf)) main.append(noteList(notesByPage.get(page.pdf)));
    }
    const pager = element('nav', undefined, 'pager');
    pager.setAttribute('aria-label', 'Previous and next meeting');
    const position = meetings.findIndex(item => item.id === id);
    for (const [offset, label] of [[-1, '← Previous'], [1, 'Next →']]) {
      const next = meetings[position + offset];
      if (!next) continue;
      const anchor = element('a', `${label} · ${title(next)}`);
      anchor.dataset.route = `/m/${next.id}`;
      anchor.href = link(anchor.dataset.route);
      pager.append(anchor);
    }
    main.append(pager);
    if (segmentId) {
      const target = document.getElementById(segmentId);
      if (target?.classList.contains('segment')) {
        target.classList.add('highlight');
        target.scrollIntoView({ block: 'center' });
        target.focus({ preventScroll: true });
      } else main.prepend(element('p', `Segment ${segmentId} is not in this meeting.`, 'status'));
    } else window.scrollTo(0, 0);
  } catch (error) {
    if (token === request) main.replaceChildren(element('p', error.message, 'status'));
  } finally {
    if (token === request) main.removeAttribute('aria-busy');
  }
}
export function cancelChrono() { request++; }
