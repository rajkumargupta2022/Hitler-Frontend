// Body tab: choose None / JSON / Text and type the content.
import { useMemo, useRef, useState } from 'react';
import FormDataEditor from './FormDataEditor.jsx';
import { jsonError, markJsonError, tokenizeJson } from '../utils/format.js';

const HEIGHT_MIN = 120;
const HEIGHT_MAX = 900;
const HEIGHT_DEFAULT = 260;

const clampHeight = (h) => Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, h));

function savedHeight() {
  try {
    const value = Number(localStorage.getItem('bodyHeight'));
    return value ? clampHeight(value) : HEIGHT_DEFAULT;
  } catch {
    return HEIGHT_DEFAULT;
  }
}

const BODY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'formdata', label: 'Form-data' },
];

export default function BodyEditor({ body, method, onChange }) {
  const [formatError, setFormatError] = useState('');
  const highlightRef = useRef(null);
  const gutterRef = useRef(null);
  const [height, setHeight] = useState(savedHeight); // editor height in px, set by dragging the bar below it

  // Drag the bar under the editor up or down to change its height (remembered between visits)
  function startResize(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;
    let latest = height;
    document.body.classList.add('is-resizing-v');
    const move = (ev) => {
      latest = clampHeight(startHeight + ev.clientY - startY);
      setHeight(latest);
    };
    const stop = () => {
      document.body.classList.remove('is-resizing-v');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      try {
        localStorage.setItem('bodyHeight', String(latest));
      } catch {
        // ignore: the height just won't persist
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function resizeByKey(e) {
    if (e.key === 'ArrowDown') setHeight((h) => clampHeight(h + 20));
    if (e.key === 'ArrowUp') setHeight((h) => clampHeight(h - 20));
  }
  // Live check: while the JSON is wrong, underline the spot and show what is wrong
  const problem = useMemo(() => (body.type === 'json' ? jsonError(body.content) : null), [body.type, body.content]);
  const tokens = useMemo(
    () => (body.type === 'json' ? markJsonError(tokenizeJson(body.content), problem?.position) : []),
    [body.type, body.content, problem]
  );
  // Line numbers; the line with the JSON mistake is shown in red
  const lineCount = body.content.split('\n').length;
  const errorLine = problem && problem.position !== null ? body.content.slice(0, problem.position).split('\n').length : 0;
  const bodyIsIgnored = ['GET', 'HEAD'].includes(method) && body.type !== 'none';

  function formatJson() {
    try {
      onChange({ ...body, content: JSON.stringify(JSON.parse(body.content), null, 2) });
      setFormatError('');
    } catch {
      setFormatError('This is not valid JSON yet, so it can’t be formatted. Check for missing quotes or commas.');
    }
  }

  return (
    <div className="body-editor">
      <div className="body-types">
        {BODY_TYPES.map((t) => (
          <label key={t.value} className="radio">
            <input
              type="radio"
              name="body-type"
              checked={body.type === t.value}
              onChange={() => onChange({ ...body, type: t.value })}
            />
            {t.label}
          </label>
        ))}
        {body.type === 'json' && (
          <button type="button" className="btn btn-small" onClick={formatJson}>Format JSON</button>
        )}
        {body.type === 'json' && body.content.trim() && (
          <span className={`json-status ${problem ? 'is-bad' : 'is-ok'}`} role="status">
            {problem ? '✕ Invalid JSON' : '✓ Valid JSON'}
          </span>
        )}
      </div>

      {bodyIsIgnored && <p className="note">{method} requests are sent without a body. Switch the method to POST, PUT or PATCH to send it.</p>}

      {body.type === 'none' ? (
        <p className="muted small">This request has no body.</p>
      ) : body.type === 'formdata' ? (
        <FormDataEditor fields={body.fields || []} onChange={(fields) => onChange({ ...body, fields })} />
      ) : (
        <div className="code-editor-wrap">
        <div className={`code-editor ${body.type === 'json' ? 'is-json' : ''} ${problem ? 'has-error' : ''}`} style={{ height }}>
          <pre className="code-gutter" ref={gutterRef} aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i} className={i + 1 === errorLine ? 'gutter-error' : undefined}>{i + 1}{'\n'}</span>
            ))}
          </pre>
          {body.type === 'json' && (
            <pre className="code-highlight" ref={highlightRef} aria-hidden="true">
              {tokens.map((t, i) => (
                <span key={i} className={`json-${t.type}${t.error ? ' json-invalid' : ''}`}>{t.text}</span>
              ))}
              {'\n'}
            </pre>
          )}
          <textarea
            className="code-area"
            spellCheck={false}
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            onScroll={(e) => {
              if (highlightRef.current) {
                highlightRef.current.scrollTop = e.target.scrollTop;
                highlightRef.current.scrollLeft = e.target.scrollLeft;
              }
              if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
            }}
            placeholder={body.type === 'json' ? '{\n  "name": "Asha",\n  "role": "admin"\n}' : 'Plain text body'}
            aria-label="Request body"
          />
        </div>
        <div
          className="code-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize body editor"
          aria-valuenow={height}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={resizeByKey}
          onDoubleClick={() => setHeight(HEIGHT_DEFAULT)}
          title="Drag to resize (double-click to reset)"
          
        />
        </div>
      )}

      {problem && body.type !== 'none' && <p className="field-error" role="alert">{problem.message}</p>}
      {!problem && formatError && <p className="field-error">{formatError}</p>}
    </div>
  );
}
