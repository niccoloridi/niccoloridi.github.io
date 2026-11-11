async function get(path) {
  const response = await fetch(`/api/${path}`);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}
export const api = {
  meetings: () => get('meetings'),
  meeting: id => get(`meetings/${encodeURIComponent(id)}`),
  segment: id => get(`segments/${encodeURIComponent(id)}`),
};
