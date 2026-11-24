// Admin only: approve viewer accounts and choose which projects each viewer may read.
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { adminApi } from '../api/api.js';
import { getErrorMessage } from '../api/httpClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import Footer from '../components/Footer.jsx';

export default function AdminPage() {
  const { user } = useAuth();
  const [data, setData] = useState({ users: [], projects: [] });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    try {
      setData(await adminApi.users());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user.role === 'admin') load();
  }, [user.role]);

  if (user.role !== 'admin') return <Navigate to="/" replace />;

  async function save(target, changes) {
    setError('');
    try {
      await adminApi.updateUser(target._id, changes);
      // Update locally so the checkbox the admin just clicked does not jump around
      setData((prev) => ({ ...prev, users: prev.users.map((u) => (u._id === target._id ? { ...u, ...changes } : u)) }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const toggleProject = (target, projectId) => {
    const has = target.projectIds.includes(projectId);
    save(target, { projectIds: has ? target.projectIds.filter((id) => id !== projectId) : [...target.projectIds, projectId] });
  };

  const viewers = data.users.filter((u) => u.role === 'viewer');
  const others = data.users.filter((u) => u.role !== 'viewer');

  return (
    <div className="projects-page">
      <header className="topbar">
        <Logo />
        <Link to="/" className="btn btn-ghost">‹ Projects</Link>
      </header>

      <main className="projects-content">
        <h1>Users</h1>
        {error && <p className="field-error">{error}</p>}

        <h2>Viewers</h2>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : viewers.length === 0 ? (
          <p className="muted">No viewer accounts yet.</p>
        ) : (
          <ul className="project-list">
            {viewers.map((v) => (
              <li key={v._id} className="admin-user">
                <div className="admin-user-head">
                  <span className="project-name">{v.name} <span className="muted small">{v.email}</span></span>
                  <span className={`status ${v.approved ? 'status-2xx' : 'status-4xx'}`}>{v.approved ? 'Approved' : 'Pending'}</span>
                  <button className={`btn btn-small ${v.approved ? '' : 'btn-primary'}`} onClick={() => save(v, { approved: !v.approved })}>
                    {v.approved ? 'Revoke' : 'Approve'}
                  </button>
                </div>
                {v.approved && (
                  <div className="admin-projects">
                    <span className="muted small">Can view:</span>
                    {data.projects.length === 0 && <span className="muted small">no projects exist yet</span>}
                    {data.projects.map((p) => (
                      <label key={p._id} className="admin-check">
                        <input type="checkbox" checked={v.projectIds.includes(p._id)} onChange={() => toggleProject(v, p._id)} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {others.length > 0 && (
          <>
            <h2>Editors and admins</h2>
            <ul className="project-list">
              {others.map((u) => (
                <li key={u._id}>
                  <span className="project-name">{u.name} <span className="muted small">{u.email}</span></span>
                  <span className="muted small">{u.role}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
