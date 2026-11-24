// Converts what the user typed in the editor into what /api/execute expects:
//   { method, url (with params), headers (with auth), body }
// {{variables}} from the project are filled in first.
import { resolveDraft, effectiveAuth } from './variables.js';

function buildUrl(rawUrl, params) {
  const url = rawUrl.trim();
  const activeParams = params.filter((p) => p.enabled && p.key.trim());
  if (activeParams.length === 0) return url;

  try {
    const parsed = new URL(url);
    activeParams.forEach((p) => parsed.searchParams.append(p.key.trim(), p.value));
    return parsed.toString();
  } catch {
    return url; // invalid URL: the server will return a clear error message
  }
}

function hasHeader(headers, name) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

// btoa() only handles basic characters, so encode as UTF-8 first
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes));
}

function addAuthHeader(headers, auth) {
  if (hasHeader(headers, 'authorization')) return; // a manual header wins
  if (auth.type === 'bearer' && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  if (auth.type === 'basic' && auth.username) {
    headers.Authorization = `Basic ${toBase64(`${auth.username}:${auth.password}`)}`;
  }
}

// projectAuth = the project's default auth, used by requests whose Auth type is "inherit"
export function prepareRequest(rawDraft, variables = [], projectAuth) {
  const draft = resolveDraft({ ...rawDraft, auth: effectiveAuth(rawDraft.auth, projectAuth) }, variables);

  // 1. Headers table -> object (only enabled rows with a key)
  const headers = {};
  draft.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => (headers[h.key.trim()] = h.value));

  // 2. Auth tab -> Authorization header
  addAuthHeader(headers, draft.auth);

  // 3. Body (GET and HEAD never send a body)
  let body;
  let formData;
  const canHaveBody = !['GET', 'HEAD'].includes(draft.method);
  if (canHaveBody && draft.body.type === 'formdata') {
    // The server builds the multipart body (and its boundary header), so no Content-Type here
    formData = (draft.body.fields || [])
      .filter((f) => f.enabled && f.key.trim())
      .map((f) =>
        f.type === 'file'
          ? { key: f.key.trim(), type: 'file', filename: f.file?.name, contentType: f.file?.contentType, data: f.file?.data || '' }
          : { key: f.key.trim(), type: 'text', value: f.value }
      );
  } else if (canHaveBody && draft.body.type !== 'none') {
    body = draft.body.content;
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = draft.body.type === 'json' ? 'application/json' : 'text/plain';
    }
  }

  return { method: draft.method, url: buildUrl(draft.url, draft.params), headers, body, formData };
}
