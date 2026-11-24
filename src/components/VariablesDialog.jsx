// Modal for editing a project's variables. Saved on the project, usable in every request as {{name}}.
import { useEffect, useState } from 'react';
import KeyValueTable from './KeyValueTable.jsx';

export default function VariablesDialog({ variables, auth, onSave, onClose, readOnly = false }) {
  const [rows, setRows] = useState(() => variables.map((v) => ({ ...v })));
  const [defaultAuth, setDefaultAuth] = useState(() => ({ type: 'none', token: '', username: '', password: '', ...(auth || {}) }));
  const setAuthField = (field) => (e) => setDefaultAuth({ ...defaultAuth, [field]: e.target.value });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await onSave(rows.filter((r) => r.key.trim()), defaultAuth);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save variables');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="vars-title">
        <h3 id="vars-title">Project variables &amp; default auth</h3>
        <p className="modal-message">
          Define a value once, then use it in any request of this project as <code className="mono">{'{{name}}'}</code>
          {' '}— in the URL, params, headers, body or auth. Example: <code className="mono">{'{{baseUrl}}/users'}</code>
        </p>

        <fieldset className="ro-fieldset" disabled={readOnly}>
        <div className="vars-table">
          <KeyValueTable
            rows={rows}
            onChange={setRows}
            keyPlaceholder="baseUrl"
            valuePlaceholder="https://api.example.com"
            emptyText="No variables yet."
          />
        </div>

        <h4 className="modal-subtitle">Default auth</h4>
        <p className="modal-message">
          Set a token once and every request whose Auth tab says <strong>Inherit from project</strong> (the default for new requests) uses it.
          Open a request&apos;s Auth tab to use a different token for just that request.
        </p>
        <div className="auth-editor">
          <label className="field">
            <span>Type</span>
            <select value={defaultAuth.type} onChange={setAuthField('type')}>
              <option value="none">No auth</option>
              <option value="bearer">Bearer token</option>
              <option value="basic">Basic auth</option>
            </select>
          </label>
          {defaultAuth.type === 'bearer' && (
            <label className="field">
              <span>Token</span>
              <input className="mono" value={defaultAuth.token} onChange={setAuthField('token')} placeholder="eyJhbGciOi…  (or {{token}})" spellCheck={false} />
            </label>
          )}
          {defaultAuth.type === 'basic' && (
            <>
              <label className="field"><span>Username</span><input value={defaultAuth.username} onChange={setAuthField('username')} autoComplete="off" /></label>
              <label className="field"><span>Password</span><input type="password" value={defaultAuth.password} onChange={setAuthField('password')} autoComplete="off" /></label>
            </>
          )}
        </div>
        </fieldset>

        <p className="muted small">Values are stored as plain text, so avoid real production secrets.</p>
        {error && <p className="field-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
          {!readOnly && (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
