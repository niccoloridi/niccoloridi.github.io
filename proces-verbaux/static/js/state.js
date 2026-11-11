
export const state = {};
const languages = new Set(['fr', 'en', 'both']);
function savedLanguage() {
  try { return localStorage.getItem('pv-dl'); } catch { return null; }
}
export function readState() {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, Object.fromEntries(new URLSearchParams(location.search)));
  const [path, query = ''] = location.hash.slice(1).split('?');
  Object.assign(state, Object.fromEntries(new URLSearchParams(query)));
  if (!languages.has(state.dl)) state.dl = languages.has(savedLanguage()) ? savedLanguage() : 'both';
  try { localStorage.setItem('pv-dl', state.dl); } catch {  }
  return path || '/m/1';
}
export function link(path) {
  const url = new URL(location.href);
  url.search = new URLSearchParams(state).toString();
  url.hash = path;
  return `${url.pathname}${url.search}${url.hash}`;
}
export function navigate(path, patch = {}, replace = false) {
  Object.assign(state, patch);
  history[replace ? 'replaceState' : 'pushState'](null, '', link(path));
  window.dispatchEvent(new Event('pv:navigate'));
}
