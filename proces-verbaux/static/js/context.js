

import { link, navigate, state } from './state.js?v=b1c575ee6d';

const cache = new Map();
let panel;

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

export function contextLink(label, { meeting, segs = [], title = '' }, cls = '') {
  const a = el('a', label, `ctx-link ${cls}`.trim());
  const first = segs[0];
  a.href = link(first ? `/m/${meeting}/${first}` : `/m/${meeting}`);
  a.dataset.ctxMeeting = meeting;
  a.dataset.ctxSegs = segs.join(',');
  if (title) a.dataset.ctxTitle = title;
  a.title = 'Show in the context of the meeting';
  return a;
}

async function meetingData(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`/api/meetings/${encodeURIComponent(id)}`).then(r => {
      if (!r.ok) throw new Error(`Meeting unavailable (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(id);
}

function ensurePanel() {
  if (panel) return panel;
  panel = el('aside', undefined, 'ctx-panel');
  panel.id = 'context';
  panel.setAttribute('aria-label', 'Context in the meeting');
  panel.hidden = true;
  document.body.append(panel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closeContext(); });
  return panel;
}

export function closeContext() {
  if (!panel) return;
  panel.hidden = true;
  document.body.classList.remove('ctx-open');
}

const longDate = iso => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const en = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  return `${d} ${en[m - 1]} ${y}`;
};

export async function openContext({ meeting, segs = [], title = '' }) {
  const p = ensurePanel();
  p.hidden = false;
  document.body.classList.add('ctx-open');
  p.replaceChildren(el('p', 'Loading…', 'ctx-status'));
  let data;
  try { data = await meetingData(meeting); } catch (e) { p.replaceChildren(el('p', e.message, 'ctx-status')); return; }
  const list = data.segments || [];
  const wanted = new Set(segs);
  let idx = list.findIndex(s => wanted.has(s.id));
  if (idx < 0) idx = 0;
  const target = list[idx];

  let from = Math.max(0, idx - 4), to = Math.min(list.length, idx + Math.max(segs.length, 1) + 6);
  if (target?.annex_id) {
    from = list.findIndex(s => s.annex_id === target.annex_id);
    to = list.length - [...list].reverse().findIndex(s => s.annex_id === target.annex_id);
    from = Math.max(0, from - 2);
  }
  const head = el('div', undefined, 'ctx-head');
  const h = el('h2', title || (data.n ? `Meeting ${data.n} · ${longDate(data.date)}` : data.title_en || ''));
  const sub = el('p', data.n ? `Meeting ${data.n} · ${longDate(data.date)}${target?.annex_id ? ` · annex ${target.annex_id}` : ''}` : '', 'ctx-sub');
  const tools = el('div', undefined, 'ctx-tools');
  const open = el('button', 'Open in reader');
  open.onclick = () => { closeContext(); navigate(`/m/${data.n || meeting}/${target?.id || ''}`); };
  const close = el('button', '✕');
  close.setAttribute('aria-label', 'Close context');
  close.onclick = closeContext;
  tools.append(open, close);
  head.append(h, tools);
  p.replaceChildren(head, sub);
  const body = el('div', undefined, 'ctx-body');
  const render = (a, b) => {
    for (const s of list.slice(a, b)) {
      const row = el('article', undefined, `ctx-row ${wanted.has(s.id) ? 'hit' : ''} kind-${s.kind}`);
      row.dataset.seg = s.id;
      const langs = s.row_type === 'full' ? ['full'] : (state.dl === 'both' ? ['fr', 'en'] : [state.dl]);
      row.classList.toggle('one', langs.length === 1);
      for (const l of langs) {
        const c = el('div', undefined, `ctx-col ${l}`);
        c.lang = l === 'full' ? 'fr' : l;
        c.innerHTML = s[`${l}_html`] || '';
        row.append(c);
      }
      const ref = el('span', `p. ${s.printed_from ?? '—'} · ${s.id}`, 'ctx-ref');
      row.prepend(ref);
      body.append(row);
    }
  };
  if (from > 0) {
    const more = el('button', 'Show earlier', 'ctx-more');
    more.onclick = () => { const a = Math.max(0, from - 8); const keep = [...body.children]; body.replaceChildren(); render(a, from); body.append(...keep); from = a; if (!from) more.remove(); };
    p.append(more);
  }
  p.append(body);
  render(from, to);
  if (to < list.length) {
    const more = el('button', 'Show later', 'ctx-more');
    more.onclick = () => { const b = Math.min(list.length, to + 8); render(to, b); to = b; if (to >= list.length) more.remove(); };
    p.append(more);
  }
  const hit = body.querySelector('.hit');
  if (hit) hit.scrollIntoView({ block: 'center' });
}

document.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;

  const route = event.target.closest('a[data-route]');
  const m = route && document.body.dataset.view !== 'm' && !route.closest('#context') &&
    route.dataset.route.match(/^\/m\/([^/]+)\/(s\d{4}\.\d{2})/);
  if (m) {
    event.preventDefault();
    event.stopPropagation();
    openContext({ meeting: m[1], segs: [m[2]] });
    return;
  }
  const a = event.target.closest('a.ctx-link');
  if (!a) return;
  event.preventDefault();
  event.stopPropagation();
  openContext({ meeting: a.dataset.ctxMeeting, segs: (a.dataset.ctxSegs || '').split(',').filter(Boolean),
    title: a.dataset.ctxTitle || '' });
}, true);

window.addEventListener('hashchange', closeContext);
window.addEventListener('pv:navigate', closeContext);
