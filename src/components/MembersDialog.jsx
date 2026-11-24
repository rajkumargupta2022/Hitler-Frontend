// Modal where a project's owner adds people by email and chooses viewer (read-only) or editor.
import { useEffect, useState } from 'react';
import { projectApi } from '../api/api.js';
import { getErrorMessage } from '../api/httpClient.js';

export default function MembersDialog({ project, onClose }) {
  const [data, setData] = useState(null); // { owner, members }
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectApi.members(project._id).then(setData).catch((err) => setError(getErrorMessage(err)));
  }, [project._id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      setData(await action());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    await run(() => projectApi.addMember(project._id, { email: email.trim(), role }));
    setEmail('');
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="members-title">
        <h3 id="members-title">Share “{project.name}”</h3>
        <p className="modal-message">
          Add people by the email they registered with. Editors can change requests; viewers can only read.
        </p>

        <form className="inline-form" onSubmit={handleAdd}>
          <input type="email" placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="btn btn-primary" disabled={busy || !email.trim()}>Add</button>
        </form>

        {error && <p className="field-error">{error}</p>}

        {data && (
          <ul className="project-list members-list">
            <li>
              <span className="project-name">{data.owner?.name || data.owner?.email}</span>
              <span className="muted small">Owner</span>
            </li>
            {data.members.map((m) => (
              <li key={m.id}>
                <span className="project-name">{m.name || m.email}</span>
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => run(() => projectApi.updateMember(project._id, m.id, { role: e.target.value }))}
                  aria-label={`Role of ${m.name || m.email}`}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => run(() => projectApi.removeMember(project._id, m.id))}>Remove</button>
              </li>
            ))}
            {data.members.length === 0 && <li className="muted">Not shared with anyone yet.</li>}
          </ul>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
