// Lists the user's projects and lets them create, open or delete one.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectApi } from '../api/api.js';
import { getErrorMessage } from '../api/httpClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDialog } from '../context/DialogContext.jsx';
import MembersDialog from '../components/MembersDialog.jsx';
import Logo from '../components/Logo.jsx';
import Footer from '../components/Footer.jsx';

export default function ProjectsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const isPending = !user.approved; // only legacy accounts can still be waiting for approval
  const fileInput = useRef(null);
  const [importing, setImporting] = useState(false);
  const [sharing, setSharing] = useState(null); // project whose members dialog is open

  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function loadProjects() {
    try {
      setProjects(await projectApi.list());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isPending) setIsLoading(false);
    else loadProjects();
  }, [isPending]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const project = await projectApi.create({ name: newName.trim() });
      navigate(`/projects/${project._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // Reads a Postman / Hoppscotch / Insomnia (or this app's) JSON file and creates a new project from it
  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again
    if (!file) return;
    setError('');
    setImporting(true);
    try {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('That file is not valid JSON. Export your collection as JSON and try again.');
      }
      const result = await projectApi.importFile(data);
      navigate(`/projects/${result.project._id}`);
    } catch (err) {
      setError(err.response ? getErrorMessage(err) : err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleExport(project) {
    try {
      const data = await projectApi.exportJson(project._id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_') || 'project'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDelete(project) {
    const ok = await confirm({
      title: 'Delete project?',
      message: `"${project.name}" and all its folders and requests will be deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await projectApi.remove(project._id);
      loadProjects();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="projects-page">
      <header className="topbar">
        <Logo />
        <span className="muted small">{user.name}</span>
        {user.role === 'admin' && <Link to="/admin" className="btn btn-ghost">Manage users</Link>}
        <button className="btn btn-ghost" onClick={logout}>Log out</button>
      </header>

      <main className="projects-content">
        <h1>Projects</h1>

        {isPending && (
          <p className="note">Your account is waiting for admin approval. You will see projects here once an admin approves you and gives you access.</p>
        )}
        {!isPending && (
        <form className="inline-form" onSubmit={handleCreate}>
          <input
            placeholder="Project name, e.g. Payments API"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="New project name"
          />
          <button className="btn btn-primary" disabled={!newName.trim()}>Create project</button>
          <button type="button" className="btn btn-ghost" disabled={importing} onClick={() => fileInput.current?.click()} title="Import a Postman, Hoppscotch or Insomnia export (.json)">
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={handleImportFile} />
        </form>
        )}

        {error && <p className="field-error">{error}</p>}

        {isLoading ? (
          <p className="muted">Loading projects…</p>
        ) : projects.length === 0 ? (
          <p className="muted">{isPending ? '' : 'You have no projects yet. Name your first one above.'}</p>
        ) : (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project._id}>
                <Link to={`/projects/${project._id}`} className="project-link">
                  <span className="project-name">{project.name}</span>
                  {project.access !== 'owner' && <span className="muted small">Shared with you ({project.access})</span>}
                  <span className="muted small">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                </Link>
                <button className="btn btn-ghost btn-small" onClick={() => handleExport(project)}>Export JSON</button>
                {project.access === 'owner' && <button className="btn btn-ghost btn-small" onClick={() => setSharing(project)}>Share</button>}
                {project.access === 'owner' && <button className="btn btn-ghost btn-small" onClick={() => handleDelete(project)}>Delete</button>}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
      {sharing && <MembersDialog project={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}
