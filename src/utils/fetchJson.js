// Resolves to null when the server has nothing to say (e.g. 204: feature not configured)
export default async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? null : res.json();
}
