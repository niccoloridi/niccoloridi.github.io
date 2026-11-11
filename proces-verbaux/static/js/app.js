import { api } from './api.js?v=1509f92807';
import './context.js?v=1509f92807';
import { link, navigate, readState, state } from './state.js?v=1509f92807';
import { cancelChrono, chrono, element, rail } from './views/chrono.js?v=1509f92807';
import { render as topicsV1 } from './views/topics_v1.js?v=1509f92807';
import { render as members } from './views/members.js?v=1509f92807';
import { render as provisions } from './views/provisions.js?v=1509f92807';
import { render as search } from './views/search.js?v=1509f92807';
import { render as documents } from './views/documents.js?v=1509f92807';
import { render as about } from './views/about.js?v=1509f92807';

let meetings;
let currentPath = '/m/1';
let renderVersion = 0;
const future = { coal: 'Unavailable in this edition' };
const panel = document.querySelector('#facsimile');
const image = document.querySelector('#page-image');
const imageStatus = document.querySelector('#image-status');
const boxes = document.querySelector('#facs-boxes');
const facsToggle = document.querySelector('#facs-toggle');
const facsSync = document.querySelector('#facs-sync');
let facsPdf = null;
let follow = true;

function applyLanguage() {
  document.body.dataset.dl = state.dl;
  for (const button of document.querySelectorAll('button[data-dl]')) {
    button.setAttribute('aria-pressed', String(button.dataset.dl === state.dl));
  }
}
async function render() {
  const version = ++renderVersion;
  currentPath = readState();
  history.replaceState(null, '', link(currentPath));
  applyLanguage();
  const [, view, selected = '1', segment] = currentPath.split('/');
  document.body.dataset.view = view;
  for (const tab of document.querySelectorAll('#tabs a')) {
    const route = tab.dataset.view === 'm' ? `/m/${view === 'm' ? selected : '1'}` : `/${tab.dataset.view}`;
    tab.dataset.route = route;
    tab.href = link(route);
    if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  try {
    meetings ||= await api.meetings();
    if (version !== renderVersion) return;
    rail(meetings, view === 'm' ? selected : null);
    if (view === 'm') {
      await chrono(meetings, selected, segment);
      if (state.facs === '1' && panel.hidden) openFacsimile();
      window.dispatchEvent(new Event('pv:rendered'));
    }
    else if (view === 'topic') {
      cancelChrono();
      await topicsV1(document.querySelector('#reader'), state, api);
    } else if (view === 'about') {
      cancelChrono();
      await about(document.querySelector('#reader'), state, api);
    } else if (view === 'docs') {
      cancelChrono();
      await documents(document.querySelector('#reader'), state, api);
    } else if (view === 'search') {
      cancelChrono();
      await search(document.querySelector('#reader'), state, api);
    } else if (view === 'prov') {
      cancelChrono();
      await provisions(document.querySelector('#reader'), state, api);
    } else if (view === 'who') {
      cancelChrono();
      await members(document.querySelector('#reader'), state, api);
    } else {
      cancelChrono();
      const main = document.querySelector('#reader');
      main.removeAttribute('aria-busy');
      main.replaceChildren(element('h2', document.querySelector('#tabs [aria-current]')?.textContent || 'View'),
        element('p', future[view] ? `This view arrives in ${future[view]}.` : 'View not found.'));
    }
  } catch (error) {
    document.querySelector('#reader').replaceChildren(element('p', error.message, 'status'));
  }
}
document.addEventListener('click', event => {
  const route = event.target.closest('a[data-route]');
  if (route && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    event.preventDefault();
    navigate(route.dataset.route);
    return;
  }
  const anchor = event.target.closest('a.nref, a[data-anchor]');
  if (anchor) {
    event.preventDefault();
    const target = document.getElementById(anchor.dataset.anchor || anchor.getAttribute('href').slice(1));
    if (target) {
      target.tabIndex = -1;
      target.scrollIntoView({ block: 'center' });
      target.focus({ preventScroll: true });
      document.querySelectorAll('.note-highlight').forEach(node => node.classList.remove('note-highlight'));
      target.classList.add('note-highlight');
    }
  }
  const page = event.target.closest('button[data-pdf]');
  if (page) openFacsimile(Number(page.dataset.pdf), true);
  const language = event.target.closest('button[data-dl]');
  if (language) navigate(currentPath, { dl: language.dataset.dl }, true);
});
image.onload = () => { imageStatus.textContent = ''; drawCurrentBoxes(); };
image.onerror = () => { imageStatus.textContent = 'The facsimile could not be loaded.'; };

function persistFacs(open) { try { localStorage.setItem('pv-facs', open ? '1' : '0'); } catch {  } }
function setFacsPage(pdf) {
  if (!pdf || pdf === facsPdf) return;
  facsPdf = pdf;
  document.querySelector('#facsimile-title').textContent = `Facsimile · PDF ${pdf}`;
  imageStatus.textContent = 'Loading facsimile…';
  image.alt = `Original printed page, PDF ${pdf}`;
  image.src = window.PVStatic.mapApi(`/api/pages/${pdf}.jpg`, window.PV_STATIC);
  boxes.replaceChildren();
}
function openFacsimile(pdf, explicit = false) {
  panel.hidden = false;
  document.body.classList.add('facs-open');
  facsToggle.setAttribute('aria-pressed', 'true');
  persistFacs(true);
  if (explicit && pdf) { follow = false; facsSync.setAttribute('aria-pressed', 'false'); }
  setFacsPage(pdf || currentRow()?.dataset.pdf && Number(currentRow().dataset.pdf));
  drawCurrentBoxes();
}
function closeFacsimile() {
  panel.hidden = true;
  document.body.classList.remove('facs-open');
  facsToggle.setAttribute('aria-pressed', 'false');
  persistFacs(false);
}
function currentRow() {
  const top = document.querySelector('header').getBoundingClientRect().bottom + 8;
  for (const row of document.querySelectorAll('#reader article.segment')) {
    const r = row.getBoundingClientRect();
    if (r.bottom > top) return row;
  }
  return null;
}
function rectsOf(row) {
  let b;
  try { b = JSON.parse(row.dataset.bbox || '{}'); } catch { return []; }
  const out = [];
  for (const key of ['fr', 'en', 'full']) {
    let v = b[key];
    if (!Array.isArray(v) || !v.length) continue;
    if (Array.isArray(v[0])) v = v[0];  // merged segment: first page's box
    if (v.length === 4) out.push(v);
  }
  return out;
}
function drawCurrentBoxes() {
  if (panel.hidden) return;
  boxes.replaceChildren();
  const row = currentRow();
  const rows = [...document.querySelectorAll(`#reader article.segment[data-pdf="${facsPdf}"]`)];
  const ns = 'http://www.w3.org/2000/svg';
  for (const r of rows) {
    for (const [x0, y0, x1, y1] of rectsOf(r)) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', x0); rect.setAttribute('y', y0);
      rect.setAttribute('width', x1 - x0); rect.setAttribute('height', y1 - y0);
      rect.setAttribute('class', r === row ? 'cur' : '');
      rect.dataset.seg = r.id;
      boxes.append(rect);
    }
  }
  if (follow && row && rows.includes(row)) followScan(row);
}


function followScan(row) {
  const rects = rectsOf(row);
  const frame = image.parentElement;
  if (!rects.length || !image.complete || !frame.offsetHeight) return;
  const y0 = Math.min(...rects.map(r => r[1])), y1 = Math.max(...rects.map(r => r[3]));
  const top = document.querySelector('header').getBoundingClientRect().bottom + 8;
  const r = row.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (top - r.top) / (r.height || 1)));
  const y = (y0 + progress * (y1 - y0)) * frame.offsetHeight;
  const frameTop = frame.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
  panel.scrollTop = Math.max(0, frameTop + y - panel.clientHeight * 0.35);
}
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking || panel.hidden) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const row = currentRow();
    if (!row) return;
    if (follow) setFacsPage(Number(row.dataset.pdf));
    drawCurrentBoxes();
  });
}, { passive: true });
boxes.addEventListener('click', event => {
  const target = event.target.closest('rect');
  if (!target) return;
  const row = document.getElementById(target.dataset.seg);
  if (row) {
    row.scrollIntoView({ block: 'start', behavior: 'smooth' });
    row.classList.add('highlight');
    setTimeout(() => row.classList.remove('highlight'), 1600);
  }
});
facsToggle.onclick = () => (panel.hidden ? openFacsimile() : closeFacsimile());
facsSync.onclick = () => {
  follow = !follow;
  facsSync.setAttribute('aria-pressed', String(follow));
  if (follow) { const row = currentRow(); if (row) setFacsPage(Number(row.dataset.pdf)); drawCurrentBoxes(); }
};
document.querySelector('#facs-prev').onclick = () => { follow = false; facsSync.setAttribute('aria-pressed', 'false'); setFacsPage(Math.max(1, (facsPdf || 2) - 1)); drawCurrentBoxes(); };
document.querySelector('#facs-next').onclick = () => { follow = false; facsSync.setAttribute('aria-pressed', 'false'); setFacsPage((facsPdf || 0) + 1); drawCurrentBoxes(); };
document.querySelector('#close-facsimile').onclick = closeFacsimile;
window.addEventListener('pv:rendered', () => { if (!panel.hidden) { facsPdf = null; const row = currentRow(); setFacsPage(row ? Number(row.dataset.pdf) : null); drawCurrentBoxes(); } });
try {
  const theme = localStorage.getItem('pv-theme');
  if (theme) document.documentElement.dataset.theme = theme;
} catch {  }
document.querySelector('#theme').onclick = () => {
  const root = document.documentElement;
  const theme = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  root.dataset.theme = theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('pv-theme', root.dataset.theme); } catch {  }
};
try { if (localStorage.getItem('pv-facs') === '1') { panel.hidden = false; document.body.classList.add('facs-open'); facsToggle.setAttribute('aria-pressed', 'true'); } } catch {  }

(() => {
  const box = document.querySelector('#advisory');
  if (!box) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('pv-advisory') === '1'; } catch {  }
  box.hidden = dismissed;
  document.querySelector('#advisory-close').onclick = () => {
    box.hidden = true;
    try { sessionStorage.setItem('pv-advisory', '1'); } catch {  }
  };
})();
window.addEventListener('hashchange', render);
window.addEventListener('popstate', render);
window.addEventListener('pv:navigate', render);
render();
