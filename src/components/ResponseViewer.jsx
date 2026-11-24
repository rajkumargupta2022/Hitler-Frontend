// Bottom half of the workspace: status, time, size, body/headers, and saved samples.
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBytes, isJson, prettyBody, statusGroup, tokenizeJson } from '../utils/format.js';

// Splits text on case-insensitive matches of query; `counter.n` numbers matches across segments.
function highlight(text, query, counter, active) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const out = [];
  let pos = 0;
  let idx;
  while ((idx = lower.indexOf(q, pos)) !== -1) {
    if (idx > pos) out.push(text.slice(pos, idx));
    const n = counter.n++;
    out.push(
      <mark key={`${idx}-${n}`} className={n === active ? 'search-hit is-current' : 'search-hit'}>
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    pos = idx + query.length;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function countMatches(text, query) {
  if (!query) return 0;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lower.indexOf(q, pos)) !== -1) { count++; pos += q.length; }
  return count;
}

export default function ResponseViewer({ response, requestName, isSending, samples, onSaveSample, onViewSample, onDeleteSample, readOnly = false }) {
  const [view, setView] = useState('Body');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(0);
  const bodyRef = useRef(null);

  const hasResult = !isSending && response && !response.error;
  const headerEntries = hasResult ? Object.entries(response.headers || {}) : [];

  // Body as segments so JSON syntax colouring and search highlighting combine.
  const segments = useMemo(() => {
    if (!hasResult || !response.body) return [];
    return isJson(response.body)
      ? tokenizeJson(prettyBody(response.body))
      : [{ type: 'text', text: response.body }];
  }, [hasResult, response]);

  const total = view === 'Body'
    ? segments.reduce((sum, s) => sum + countMatches(s.text, query), 0)
    : headerEntries.reduce((sum, [k, v]) => sum + countMatches(k, query) + countMatches(String(v), query), 0);
  const active = total ? Math.min(current, total - 1) : -1;

  useEffect(() => { setCurrent(0); }, [query, view, response]);

  useEffect(() => {
    bodyRef.current?.querySelector('mark.is-current')?.scrollIntoView({ block: 'nearest' });
  }, [active, query, view]);

  const step = (dir) => total && setCurrent((active + dir + total) % total);
  const onSearchKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') setQuery('');
  };

  const counter = { n: 0 };

  const download = (content, filename, mime) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Request name made filename-safe; falls back to "response" when blank.
  const baseName = (requestName || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_') || 'response';

  // Body only, pretty-printed when JSON.
  const exportBody = () => {
    const json = isJson(response.body || '');
    download(json ? prettyBody(response.body) : response.body || '', `${baseName}.${json ? 'json' : 'txt'}`, json ? 'application/json' : 'text/plain');
  };

  // Status, timing, headers and body together.
  const exportAll = () => {
    const body = response.body && isJson(response.body) ? JSON.parse(response.body) : response.body ?? '';
    const data = {
      status: response.status,
      statusText: response.statusText,
      timeMs: response.timeMs,
      sizeBytes: response.sizeBytes,
      headers: response.headers || {},
      body,
    };
    download(JSON.stringify(data, null, 2), `${baseName}-full.json`, 'application/json');
  };

  return (
    <section className="response">
      <div className="response-header">
        <h3>Response</h3>
        {hasResult && (
          <div className="response-actions">
            <button className="btn btn-small" onClick={exportBody}>Export body</button>
            <button className="btn btn-small" onClick={exportAll}>Export all</button>
            {!response.isSample && !readOnly && (
              <button className="btn btn-small" onClick={onSaveSample}>Save as sample</button>
            )}
          </div>
        )}
      </div>

      {isSending && <p className="muted">Waiting for the server to respond…</p>}
      {!isSending && !response && <p className="muted">Send the request to see the response here.</p>}
      {!isSending && response?.error && <div className="response-error">{response.error}</div>}

      {hasResult && (
        <>
          {response.isSample && <p className="note">Showing saved sample “{response.name}”</p>}

          <div className="response-meta">
            <span className={`status status-${statusGroup(response.status)}`}>
              {response.status} {response.statusText}
            </span>
            <span>{response.timeMs} ms</span>
            <span>{formatBytes(response.sizeBytes)}</span>
          </div>

          <div className="tabs" role="tablist">
            {['Body', 'Headers'].map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={view === tab}
                className={`tab ${view === tab ? 'is-active' : ''}`}
                onClick={() => setView(tab)}
              >
                {tab}
                {tab === 'Headers' && <span className="tab-count">{headerEntries.length}</span>}
              </button>
            ))}
          </div>

          <div className="response-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder={`Search ${view.toLowerCase()}…`}
              aria-label="Search response"
            />
            {query && (
              <>
                <span className="muted search-count">{total ? `${active + 1} / ${total}` : 'No results'}</span>
                <button className="icon-btn" onClick={() => step(-1)} disabled={!total} aria-label="Previous match">↑</button>
                <button className="icon-btn" onClick={() => step(1)} disabled={!total} aria-label="Next match">↓</button>
              </>
            )}
          </div>

          <div ref={bodyRef}>
            {view === 'Body' ? (
              <pre className="code-block">
                {!response.body && '(empty body)'}
                {segments.map((t, i) => (
                  <span key={i} className={t.type === 'text' ? undefined : `json-${t.type}`}>
                    {highlight(t.text, query, counter, active)}
                  </span>
                ))}
              </pre>
            ) : (
              <table className="headers-table">
                <tbody>
                  {headerEntries.map(([key, value]) => (
                    <tr key={key}>
                      <th>{highlight(key, query, counter, active)}</th>
                      <td>{highlight(String(value), query, counter, active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {samples.length > 0 && (
        <div className="samples">
          <h4>Saved samples</h4>
          <ul>
            {samples.map((sample) => (
              <li key={sample._id}>
                <button className="sample-link" onClick={() => onViewSample(sample)}>
                  <span className={`status status-${statusGroup(sample.status)}`}>{sample.status}</span>
                  {sample.name}
                </button>
                {!readOnly && <button className="icon-btn" onClick={() => onDeleteSample(sample)} aria-label={`Delete sample ${sample.name}`}>✕</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
