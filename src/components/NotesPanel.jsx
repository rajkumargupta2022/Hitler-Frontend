// Right-hand panel: write a markdown description for the open request, preview it, and save.
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LANGUAGES, generateSnippet } from '../utils/codegen.js';
import { highlight } from '../utils/highlight.js';
import { prepareRequest } from '../utils/prepareRequest.js';

const PLACEHOLDER = '# What this endpoint does\n\nWrite notes in **Markdown**: lists, `code`, tables, links…';

export default function NotesPanel({ description, isDirty, onChange, onSave, width, onResize, onHide, readOnly = false, draft, variables, projectAuth }) {
  const [mode, setMode] = useState('Write');
  const text = description || '';
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem('snippetLanguage') || 'curl'; } catch { return 'curl'; }
  });
  const [copied, setCopied] = useState(false);

  // Rebuilt from the request as it is being edited, with {{variables}} filled in
  const snippet = useMemo(() => {
    if (mode !== 'Code' || !draft) return '';
    try {
      return generateSnippet(language, prepareRequest(draft, variables, projectAuth));
    } catch {
      return '// Could not generate a snippet for this request yet.';
    }
  }, [mode, draft, variables, projectAuth, language]);

  function pickLanguage(id) {
    setLanguage(id);
    try { localStorage.setItem('snippetLanguage', id); } catch { /* storage blocked */ }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  // Drag the left edge: the panel is glued to the right of the window, so width = distance from the cursor to that edge
  function startResize(e) {
    e.preventDefault();
    document.body.classList.add('is-resizing');
    const move = (ev) => onResize(window.innerWidth - ev.clientX);
    const stop = () => {
      document.body.classList.remove('is-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  // Keyboard users can resize with the arrow keys
  function onHandleKey(e) {
    if (e.key === 'ArrowLeft') onResize(width + 20);
    if (e.key === 'ArrowRight') onResize(width - 20);
  }

  return (
    <aside className="notes" aria-label="Request description">
      <div
        className="notes-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize description panel"
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={onHandleKey}
        onDoubleClick={() => onResize(340)}
        title="Drag to resize (double-click to reset)"
      />
      <div className="notes-header">
        <h3>Description</h3>
        <button className="btn btn-small btn-ghost" onClick={onHide} aria-label="Hide description panel" title="Hide">✕</button>
        {!readOnly && (
          <button className="btn btn-small btn-primary notes-save" onClick={onSave} disabled={!isDirty}>
            {isDirty ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      <div className="tabs notes-tabs" role="tablist">
        {['Write', 'Preview', 'Code'].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mode === tab}
            className={`tab ${mode === tab ? 'is-active' : ''}`}
            onClick={() => setMode(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {mode === 'Code' ? (
        <div className="snippet">
          <div className="snippet-bar">
            <select value={language} onChange={(e) => pickLanguage(e.target.value)} aria-label="Language">
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button className="btn btn-small btn-ghost" onClick={copySnippet}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <pre className="snippet-code mono">
            <code>{highlight(snippet, language).map((t, i) => <span key={i} className={`tok-${t.type}`}>{t.text}</span>)}</code>
          </pre>
        </div>
      ) : mode === 'Write' ? (
        <textarea
          className="notes-input"
          value={text}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          readOnly={readOnly}
          aria-label="Description in Markdown"
        />
      ) : (
        <div className="markdown">
          {text.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          ) : (
            <p className="muted">Nothing to preview yet. Write something in the Write tab.</p>
          )}
        </div>
      )}
    </aside>
  );
}
