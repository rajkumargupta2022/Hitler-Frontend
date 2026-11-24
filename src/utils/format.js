// Small display helpers used by the response viewer.

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 200 -> "2xx", 404 -> "4xx" (used for status colors)
export const statusGroup = (status) => `${Math.floor(status / 100)}xx`;

// Pretty-print JSON; leave anything else as it is
export function prettyBody(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// Split pretty-printed JSON into [{ type, text }] tokens so the viewer can color them.
// type: key | string | number | boolean | null | plain
const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function tokenizeJson(text) {
  const tokens = [];
  let last = 0;
  for (const m of text.matchAll(JSON_TOKEN)) {
    if (m.index > last) tokens.push({ type: 'plain', text: text.slice(last, m.index) });
    let type = 'number';
    if (m[1]) type = m[2] ? 'key' : 'string';
    else if (m[3]) type = 'boolean';
    else if (m[0] === 'null') type = 'null';
    if (type === 'key') {
      tokens.push({ type, text: m[1] }, { type: 'plain', text: m[2] });
    } else {
      tokens.push({ type, text: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'plain', text: text.slice(last) });
  return tokens;
}

export function isJson(body) {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

// Index of the first character that makes `text` invalid JSON, or null when it is valid.
// Used when the browser's own error message does not say where the mistake is.
function findJsonErrorPosition(text) {
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const fail = () => { throw i; };

  function value() {
    ws();
    const c = text[i];
    if (c === '{') {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        string(); ws();
        if (text[i] !== ':') fail();
        i++; value(); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        fail();
      }
    } else if (c === '[') {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        value(); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        fail();
      }
    } else if (c === '"') {
      string();
    } else {
      const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
      if (!m) fail();
      i += m[0].length;
    }
  }

  function string() {
    i++; // opening quote
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\n') fail();
      if (text[i] === '\\') i++;
      i++;
    }
    if (text[i] !== '"') fail();
    i++;
  }

  try {
    value(); ws();
    if (i < text.length) fail();
    return null;
  } catch (at) {
    return typeof at === 'number' ? at : null;
  }
}

// Checks request-body JSON while typing. Returns null when it is fine (or empty), otherwise
// { message, position } where position is the character index of the mistake (null if unknown).
// {{variables}} are swapped for same-length digits first so they never count as errors and positions stay correct.
export function jsonError(text) {
  if (!text || !text.trim()) return null;
  const checkable = text.replace(/\{\{[^}]*\}\}/g, (m) => '1'.repeat(m.length));
  try {
    JSON.parse(checkable);
    return null;
  } catch (err) {
    const msg = String(err.message);
    let position = null;
    const byPos = msg.match(/position (\d+)/);
    const byLine = msg.match(/line (\d+) column (\d+)/);
    if (byPos) {
      position = Number(byPos[1]);
    } else if (byLine) {
      const lines = text.split('\n');
      position = lines.slice(0, Number(byLine[1]) - 1).reduce((sum, l) => sum + l.length + 1, 0) + Number(byLine[2]) - 1;
    }
    if (position === null) position = findJsonErrorPosition(checkable);
    if (position !== null) position = Math.min(position, text.length);

    const before = position === null ? '' : text.slice(0, position);
    const line = before.split('\n').length;
    const column = position === null ? 0 : position - before.lastIndexOf('\n');
    const where = position === null ? '' : ` (line ${line}, column ${column})`;
    return { message: `Invalid JSON${where}: ${msg.replace(/,\s*".*" is not valid JSON$/s, '').replace(/ (?:in JSON )?at position \d+.*$/, '').replace(/\s*\(line \d+ column \d+\)/, '')}`, position };
  }
}

// Marks the token at `position` with error:true so the editor can underline it.
// A mistake inside plain text (a stray comma or brace) underlines just that character;
// a mistake at the very end (unexpected end of input) underlines the last real token.
export function markJsonError(tokens, position) {
  if (position === null || position === undefined) return tokens;
  const total = tokens.reduce((sum, t) => sum + t.text.length, 0);
  const target = position >= total ? total - 1 : position;
  const out = [];
  let offset = 0;
  let done = false;
  let lastReal = -1;

  tokens.forEach((t) => {
    const end = offset + t.text.length;
    if (!done && target >= offset && target < end) {
      if (t.type === 'plain') {
        const i = target - offset;
        if (t.text[i].trim()) {
          if (i > 0) out.push({ ...t, text: t.text.slice(0, i) });
          out.push({ ...t, text: t.text[i], error: true });
          if (i + 1 < t.text.length) out.push({ ...t, text: t.text.slice(i + 1) });
          done = true;
        } else if (position >= total && lastReal >= 0) {
          out[lastReal] = { ...out[lastReal], error: true }; // trailing whitespace: point at what came before
          out.push(t);
          done = true;
        } else {
          out.push(t); // whitespace itself is never underlined
        }
      } else {
        out.push({ ...t, error: true });
        done = true;
      }
    } else {
      out.push(t);
    }
    if (t.text.trim() && !t.error) lastReal = out.length - 1;
    offset = end;
  });
  return out;
}
