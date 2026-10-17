import { shallowRef } from 'vue';
function read() {
  const [path, query = ''] = (location.hash.slice(1) || '/components').split('?');
  return { path, query: new URLSearchParams(query) };
}
export const route = shallowRef(read());
window.addEventListener('hashchange', () => {
  route.value = read();
  window.scrollTo(0, 0);
});
export function go(path: string, values: Record<string, string> = {}) {
  const q = new URLSearchParams(values);
  location.hash = path + (q.size ? '?' + q : '');
}
export function updateQuery(values: Record<string, string>) {
  const q = new URLSearchParams(route.value.query);
  Object.entries(values).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
  history.replaceState(null, '', '#' + route.value.path + (q.size ? '?' + q : ''));
  route.value = read();
}
