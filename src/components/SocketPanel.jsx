// WebSocket client: connect to a ws:// or wss:// address, send messages, and watch everything that comes back.
// The connection is made by the user's BROWSER (like Browser sends in the request editor), so ws://localhost works too.
// It stays mounted while hidden, so the connection survives switching to a request and back.
import { useEffect, useMemo, useRef, useState } from 'react';
import { substitute, variableMap } from '../utils/variables.js';
import { isJson, prettyBody, tokenizeJson } from '../utils/format.js';

const MAX_LOG = 500;
const STATUS_TEXT = { idle: 'Disconnected', connecting: 'Connecting…', open: 'Connected', closing: 'Closing…' };

// http(s):// is accepted too and turned into ws(s)://
function toSocketUrl(raw) {
  const text = raw.trim();
  if (/^https:\/\//i.test(text)) return text.replace(/^https/i, 'wss');
  if (/^http:\/\//i.test(text)) return text.replace(/^http/i, 'ws');
  return text;
}

// JSON text -> colored spans (same colors as the response viewer); anything else is shown as plain text
function Colored({ text, pretty = false }) {
  if (!isJson(text)) return text;
  const source = pretty ? prettyBody(text) : text;
  return tokenizeJson(source).map((t, i) => <span key={i} className={`json-${t.type}`}>{t.text}</span>);
}

function readSaved(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export default function SocketPanel({ projectId, variables = [], hidden }) {
  const storeKey = `socket:${projectId}`;
  const [form, setForm] = useState(() => readSaved(storeKey, { url: '', protocols: '', message: '' }));
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState([]); // { id, kind: 'sent' | 'received' | 'info' | 'error', text, time }
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const socket = useRef(null);
  const logBox = useRef(null);
  const counter = useRef(0);

  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify(form)); } catch { /* storage blocked */ }
  }, [form, storeKey]);

  // Close the connection when the user leaves the project
  useEffect(() => () => socket.current?.close(1000, 'Page closed'), []);

  // Newest message is shown on top; keep the list scrolled to it
  useEffect(() => {
    if (!hidden && logBox.current) logBox.current.scrollTop = 0;
  }, [log, hidden]);

  const resolvedUrl = useMemo(() => toSocketUrl(substitute(form.url, variableMap(variables))), [form.url, variables]);

  function add(kind, text) {
    counter.current += 1;
    setLog((current) => [...current, { id: counter.current, kind, text, time: new Date() }].slice(-MAX_LOG));
  }

  function connect() {
    setError('');
    let target;
    try {
      target = new URL(resolvedUrl);
    } catch {
      setError('Enter a full address such as ws://localhost:8080 or wss://echo.websocket.org');
      return;
    }
    if (!['ws:', 'wss:'].includes(target.protocol)) {
      setError('Use a ws:// or wss:// address');
      return;
    }

    const protocols = form.protocols.split(',').map((p) => p.trim()).filter(Boolean);
    let ws;
    try {
      ws = protocols.length ? new WebSocket(target.href, protocols) : new WebSocket(target.href);
    } catch (err) {
      setError(err.message);
      return;
    }
    socket.current = ws;
    setStatus('connecting');
    add('info', `Connecting to ${target.href}`);

    ws.onopen = () => {
      setStatus('open');
      add('info', `Connected${ws.protocol ? ` (protocol: ${ws.protocol})` : ''}`);
    };
    ws.onmessage = (event) => {
      add('received', typeof event.data === 'string' ? event.data : `[binary data, ${event.data.size ?? event.data.byteLength ?? '?'} bytes]`);
    };
    ws.onerror = () => {
      // The browser gives no details on purpose; these are the usual reasons
      add('error', `Could not connect. Check that the server is running and the address is right${window.location.protocol === 'https:' && target.protocol === 'ws:' && !['localhost', '127.0.0.1'].includes(target.hostname) ? ', and that it uses wss:// because this site is https' : ''}.`);
    };
    ws.onclose = (event) => {
      if (socket.current === ws) socket.current = null;
      setStatus('idle');
      add('info', `Disconnected (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`);
    };
  }

  function disconnect() {
    if (!socket.current) return;
    setStatus('closing');
    socket.current.close(1000, 'Closed by user');
  }

  function send() {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !form.message) return;
    const text = substitute(form.message, variableMap(variables));
    ws.send(text);
    add('sent', text);
  }

  const canSend = status === 'open' && form.message.length > 0;
  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const chosen = log.find((m) => m.id === selected);

  return (
    <section className="socket" hidden={hidden} aria-label="WebSocket">
      <div className="editor-title">
        <h3 className="socket-title">WebSocket</h3>
        <span className={`socket-status is-${status}`}>{STATUS_TEXT[status]}</span>
      </div>

      <form
        className="url-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (status === 'idle') connect();
        }}
      >
        <input
          className="url-input"
          placeholder="ws://localhost:8080  or  wss://echo.websocket.org"
          value={form.url}
          onChange={setField('url')}
          disabled={status !== 'idle'}
          spellCheck={false}
          aria-label="WebSocket address"
        />
        {status === 'idle' ? (
          <button className="btn btn-primary btn-send" type="submit" disabled={!form.url.trim()}>Connect</button>
        ) : (
          <button className="btn btn-send" type="button" onClick={disconnect} disabled={status === 'closing'}>Disconnect</button>
        )}
      </form>

      <label className="field socket-protocols">
        <span>Subprotocols (optional, comma separated)</span>
        <input value={form.protocols} onChange={setField('protocols')} disabled={status !== 'idle'} placeholder="graphql-ws, chat" spellCheck={false} />
      </label>
      {error && <p className="field-error">{error}</p>}
      <p className="muted small">
        Connects from your browser, so local servers work. Browsers cannot add custom headers to a WebSocket, so pass a token in the address
        (for example <code className="mono">?token=…</code> or <code className="mono">{'?token={{token}}'}</code>). Variables work here too.
      </p>

      <div className="socket-composer">
        <textarea
          className="socket-input mono"
          value={form.message}
          onChange={setField('message')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={'Message to send, e.g. {"type":"ping"}'}
          spellCheck={false}
          aria-label="Message"
        />
        <button className="btn btn-primary" onClick={send} disabled={!canSend} title="Ctrl+Enter">Send</button>
      </div>

      <div className="socket-log-bar">
        <h4>Messages <span className="muted small">({log.length})</span></h4>
        <button className="btn btn-small btn-ghost" onClick={() => { setLog([]); setSelected(null); }} disabled={log.length === 0}>Clear</button>
      </div>

      <div className="socket-log" ref={logBox} role="log" aria-live="polite">
        {log.length === 0 && <p className="muted small socket-empty">Connect, then send a message. Everything sent and received shows up here.</p>}
        {[...log].reverse().map((m, index) => (
          <button key={m.id} className={`socket-msg is-${m.kind} ${index === 0 ? 'is-latest' : ''} ${selected === m.id ? 'is-selected' : ''}`} onClick={() => setSelected(selected === m.id ? null : m.id)}>
            <span className="socket-arrow" aria-label={m.kind}>{m.kind === 'sent' ? '↑' : m.kind === 'received' ? '↓' : m.kind === 'error' ? '!' : '•'}</span>
            <span className="socket-text">{m.kind === 'info' || m.kind === 'error' ? m.text : <Colored text={m.text} />}</span>
            <time className="muted small">{m.time.toLocaleTimeString()}</time>
          </button>
        ))}
      </div>

      {chosen && (
        <pre className="socket-detail mono"><Colored text={chosen.text} pretty /></pre>
      )}
    </section>
  );
}
