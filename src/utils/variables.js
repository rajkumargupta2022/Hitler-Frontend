// Project variables: {{name}} placeholders in a request are replaced with the project's values when sending.

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

// [{ key, value, enabled }] -> Map(key -> value), enabled rows only
export function variableMap(variables = []) {
  const map = new Map();
  variables.filter((v) => v.enabled && v.key.trim()).forEach((v) => map.set(v.key.trim(), v.value));
  return map;
}

// Replace every {{name}} we know; unknown ones are left untouched so they are easy to spot
export function substitute(text, map) {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  return text.replace(PLACEHOLDER, (whole, name) => (map.has(name) ? map.get(name) : whole));
}

const activeRows = (rows) => rows.filter((r) => r.enabled);

// The auth a request really uses: its own, or the project's default when it is set to "inherit"
// A request that picked Bearer/Basic but left the token (or username) empty also falls back to the project's default
export function effectiveAuth(auth, projectAuth) {
  const fallback = { type: 'none', token: '', username: '', password: '', ...(projectAuth || {}) };
  if (!auth || auth.type === 'inherit') return fallback;
  if (auth.type === 'bearer' && !(auth.token || '').trim()) return fallback;
  if (auth.type === 'basic' && !(auth.username || '').trim()) return fallback;
  return auth;
}

// A copy of the request with variables filled in everywhere a user can type
export function resolveDraft(draft, variables) {
  const map = variableMap(variables);
  const sub = (text) => substitute(text, map);
  const subRows = (rows) => rows.map((r) => ({ ...r, key: sub(r.key), value: sub(r.value) }));
  return {
    ...draft,
    url: sub(draft.url),
    params: subRows(draft.params),
    headers: subRows(draft.headers),
    body: { ...draft.body, content: sub(draft.body.content), fields: (draft.body.fields || []).map((f) => ({ ...f, key: sub(f.key), value: f.type === 'file' ? f.value : sub(f.value) })) },
    auth: { ...draft.auth, token: sub(draft.auth.token), username: sub(draft.auth.username), password: sub(draft.auth.password) },
  };
}

// Names used in the request that no variable defines (shown as a warning in the editor)
export function findUndefinedVariables(rawDraft, variables, projectAuth) {
  const draft = { ...rawDraft, auth: effectiveAuth(rawDraft.auth, projectAuth) };
  const map = variableMap(variables);
  const texts = [
    draft.url,
    ...activeRows(draft.params).flatMap((r) => [r.key, r.value]),
    ...activeRows(draft.headers).flatMap((r) => [r.key, r.value]),
    draft.body.type !== 'none' ? draft.body.content : '',
    ...(draft.body.type === 'formdata' ? activeRows(draft.body.fields || []).flatMap((r) => [r.key, r.type === 'text' ? r.value : '']) : []),
    draft.auth.type === 'bearer' ? draft.auth.token : '',
    draft.auth.type === 'basic' ? draft.auth.username : '',
    draft.auth.type === 'basic' ? draft.auth.password : '',
  ];
  const missing = new Set();
  texts.forEach((text) => {
    for (const match of (text || '').matchAll(PLACEHOLDER)) {
      if (!map.has(match[1])) missing.add(match[1]);
    }
  });
  return [...missing];
}
