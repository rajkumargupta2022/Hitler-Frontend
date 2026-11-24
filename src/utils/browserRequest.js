// Sends a prepared request ({ method, url, headers, body, formData }) straight from the user's BROWSER
// instead of through our server. This is what makes http://localhost APIs testable on a hosted copy of the app,
// but the target API must allow cross-origin calls (CORS). Returns the same shape as /api/execute.
const TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

// Browsers refuse to let scripts set these, so don't even try
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'cookie', 'origin', 'referer', 'user-agent', 'connection', 'accept-encoding', 'date', 'upgrade', 'via']);

function base64ToBlob(data, type) {
  const bin = atob(data || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

// True for localhost and private-network addresses (the ones our server can never reach)
export function isLocalUrl(rawUrl) {
  try {
    const { hostname } = new URL(String(rawUrl).trim());
    const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost') || h === '::1') return true;
    const m = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  } catch {
    return false;
  }
}

export async function sendFromBrowser({ method, url, headers = {}, body, formData }) {
  let target;
  try {
    target = new URL(String(url).trim());
  } catch {
    throw new Error('Enter a full URL starting with http:// or https://');
  }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only http:// and https:// URLs are supported');

  const canHaveBody = !['GET', 'HEAD'].includes(method);
  const requestHeaders = {};
  Object.entries(headers).forEach(([k, v]) => {
    if (!FORBIDDEN_HEADERS.has(k.toLowerCase())) requestHeaders[k] = v;
  });

  let requestBody;
  if (canHaveBody && Array.isArray(formData)) {
    const form = new FormData();
    formData.forEach((f) => {
      if (f.type === 'file') form.append(f.key, base64ToBlob(f.data, f.contentType), f.filename || 'file');
      else form.append(f.key, f.value ?? '');
    });
    requestBody = form; // the browser adds the multipart Content-Type + boundary itself
  } else if (canHaveBody && body) {
    requestBody = String(body);
  }

  const startedAt = performance.now();
  let response;
  try {
    response = await fetch(target, { method, headers: requestHeaders, body: requestBody, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error(`No response after ${TIMEOUT_MS / 1000} seconds`);
    // The browser hides the real reason on purpose; these are the usual ones
    const failure = new Error(
      `The browser could not complete the request to ${target.host}. Check that the API is running, that it allows cross-origin requests (CORS) from ${window.location.origin}, ` +
      'and, if this site is https, that the API is reachable over https (or is localhost). Open the browser console (F12) for the exact reason.'
    );
    failure.isNetworkFailure = true; // lets the caller try another route
    throw failure;
  }

  const text = await response.text();
  const sizeBytes = new Blob([text]).size;
  if (sizeBytes > MAX_RESPONSE_BYTES) throw new Error('The response is larger than 5 MB, so it was not loaded');

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()), // only the headers the API exposes through CORS
    body: text,
    timeMs: Math.round(performance.now() - startedAt),
    sizeBytes,
  };
}
