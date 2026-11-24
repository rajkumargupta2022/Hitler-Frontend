// Auth tab: adds an Authorization header for you when the request is sent.
const LABELS = { none: 'No auth', bearer: 'Bearer token', basic: 'Basic auth' };

export default function AuthEditor({ auth, onChange, projectAuth }) {
  const setField = (field) => (e) => onChange({ ...auth, [field]: e.target.value });

  return (
    <div className="auth-editor">
      <label className="field">
        <span>Type</span>
        <select value={auth.type} onChange={setField('type')}>
          <option value="inherit">Inherit from project</option>
          <option value="none">No auth</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
        </select>
      </label>

      {auth.type === 'inherit' && (
        <p className="muted small">
          {projectAuth && projectAuth.type !== 'none'
            ? `Using the project's default: ${LABELS[projectAuth.type]}. Change it once under Variables → Default auth, or pick a different type here for this request only.`
            : 'The project has no default auth yet, so no Authorization header is added. Set one under Variables → Default auth.'}
        </p>
      )}

      {auth.type === 'none' && <p className="muted small">No Authorization header will be added.</p>}

      {(auth.type === 'bearer' || auth.type === 'basic') && projectAuth && projectAuth.type !== 'none' && (
        <p className="muted small">Leave this empty to use the project's default {LABELS[projectAuth.type].toLowerCase()}.</p>
      )}

      {auth.type === 'bearer' && (
        <label className="field">
          <span>Token</span>
          <input className="mono" value={auth.token} onChange={setField('token')} placeholder="eyJhbGciOi…" spellCheck={false} />
        </label>
      )}

      {auth.type === 'basic' && (
        <>
          <label className="field">
            <span>Username</span>
            <input value={auth.username} onChange={setField('username')} autoComplete="off" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={auth.password} onChange={setField('password')} autoComplete="off" />
          </label>
        </>
      )}
    </div>
  );
}
