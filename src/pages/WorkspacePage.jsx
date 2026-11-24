// The main screen: sidebar (folders + requests) | tabs + request editor + response | description.
// All data and actions live here; child components just display and call back.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { projectApi, folderApi, requestApi, sampleApi, executeApi } from '../api/api.js';
import { getErrorMessage } from '../api/httpClient.js';
import { useDialog } from '../context/DialogContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { prepareRequest } from '../utils/prepareRequest.js';
import { sendFromBrowser, isLocalUrl } from '../utils/browserRequest.js';
import Sidebar from '../components/Sidebar.jsx';
import TabBar from '../components/TabBar.jsx';
import RequestEditor from '../components/RequestEditor.jsx';
import NotesPanel from '../components/NotesPanel.jsx';
import ResponseViewer from '../components/ResponseViewer.jsx';
import VariablesDialog from '../components/VariablesDialog.jsx';
import SocketPanel from '../components/SocketPanel.jsx';

const NOTES_MIN = 260;
const NOTES_MAX = 760;
const NOTES_DEFAULT = 340;

// Read a saved UI preference; storage can be blocked, so never let it throw
function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: preferences just won't persist
  }
}

// Everything one open request needs: its editable copy, unsaved flag, last response and samples
const makeTab = (request, samples = []) => ({
  id: request._id,
  draft: request,
  isDirty: false,
  response: null,
  isSending: false,
  samples,
});

export default function WorkspacePage() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const { confirm, prompt } = useDialog();

  // ---- state ----
  const [project, setProject] = useState(null);
  const [folders, setFolders] = useState([]);
  const [requests, setRequests] = useState([]);

  const [tabs, setTabs] = useState([]); // every open request
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');
  // Read-only for viewers, and for an admin looking at someone else's project
  const readOnly = project != null && project.access !== 'owner' && project.access !== 'editor';
  const [varsOpen, setVarsOpen] = useState(false); // project variables dialog
  const [tabsRestored, setTabsRestored] = useState(false); // true once last visit's tabs are back

  const tab = tabs.find((t) => t.id === activeId) || null;
  const draft = tab?.draft || null; // the request shown in the editor
  const isDirty = tab?.isDirty || false;

  // Change one tab (by id) without touching the others
  const patchTab = useCallback((id, patch) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));
  }, []);

  // description panel: open/closed + width (dragged by the user), remembered between visits
  // WebSocket panel: opened from the sidebar; stays mounted once opened so its connection survives while you look at a request
  const [socketView, setSocketView] = useState('closed'); // 'closed' | 'visible' | 'hidden'
  const showingSocket = socketView === 'visible';
  const [notesOpen, setNotesOpen] = useState(() => readPref('notesOpen', true));
  const [notesWidth, setNotesWidth] = useState(() => readPref('notesWidth', NOTES_DEFAULT));
  useEffect(() => {
    writePref('notesOpen', notesOpen);
    writePref('notesWidth', notesWidth);
  }, [notesOpen, notesWidth]);

  // ---- loading ----
  const loadTree = useCallback(async () => {
    const data = await projectApi.tree(projectId);
    setProject(data.project);
    setFolders(data.folders);
    setRequests(data.requests);
    return data;
  }, [projectId]);

  useEffect(() => {
    loadTree().catch((err) => setError(getErrorMessage(err)));
  }, [loadTree]);

  // Reopen the tabs that were open last time in this project
  useEffect(() => {
    const saved = readPref(`tabs:${projectId}`, null);
    if (!saved?.ids?.length) {
      setTabsRestored(true);
      return;
    }
    Promise.all(
      saved.ids.map((id) =>
        Promise.all([requestApi.get(id), sampleApi.list(id)])
          .then(([request, samples]) => makeTab(request, samples))
          .catch(() => null) // deleted since last visit: skip it
      )
    ).then((restored) => {
      const alive = restored.filter(Boolean);
      setTabs((prev) => [...prev, ...alive.filter((t) => !prev.some((p) => p.id === t.id))]);
      setActiveId((current) => current || (alive.some((t) => t.id === saved.active) ? saved.active : alive[0]?.id || null));
      setTabsRestored(true);
    });
  }, [projectId]);

  // Remember which tabs are open (waits for the restore above so it never overwrites the saved list with an empty one)
  useEffect(() => {
    if (!tabsRestored) return;
    writePref(`tabs:${projectId}`, { ids: tabs.map((t) => t.id), active: activeId });
  }, [tabs, activeId, projectId, tabsRestored]);

  // Warn before closing the browser tab if any request has unsaved changes
  useEffect(() => {
    if (!tabs.some((t) => t.isDirty)) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [tabs]);

  // Runs an async action and shows any error in the red banner
  async function run(action) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // ---- tabs ----
  async function closeTab(id) {
    const target = tabs.find((t) => t.id === id);
    if (target?.isDirty) {
      const ok = await confirm({
        title: 'Unsaved changes',
        message: `"${target.draft.name}" has unsaved changes. Close it anyway?`,
        confirmLabel: 'Close without saving',
        danger: true,
      });
      if (!ok) return;
    }

    const index = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (id === activeId) {
      // activate the neighbour that slides into this spot (or the one before it)
      const next = remaining[index] || remaining[index - 1] || null;
      setActiveId(next ? next.id : null);
    }
  }

  // Drop tabs whose request no longer exists (after deleting a request or folder)
  function dropMissingTabs(existingIds) {
    const remaining = tabs.filter((t) => existingIds.has(t.id));
    if (remaining.length === tabs.length) return;
    setTabs(remaining);
    if (!remaining.some((t) => t.id === activeId)) setActiveId(remaining[0]?.id || null);
  }

  // ---- requests ----
  // Opening from the sidebar: jump to the tab if it is already open, otherwise load it into a new tab
  async function openRequest(requestId) {
    if (tabs.some((t) => t.id === requestId)) {
      setActiveId(requestId);
      return;
    }
    await run(async () => {
      const [request, samples] = await Promise.all([requestApi.get(requestId), sampleApi.list(requestId)]);
      setTabs((prev) => (prev.some((t) => t.id === request._id) ? prev : [...prev, makeTab(request, samples)]));
      setActiveId(request._id);
    });
  }

  function updateDraft(changes) {
    if (!tab) return;
    patchTab(tab.id, (t) => ({ draft: { ...t.draft, ...changes }, isDirty: true }));
  }

  // `quick` = the + button in the tab bar: create "Untitled Request" straight away, no name prompt
  async function newRequest(folderId = null, quick = false) {
    let name = 'Untitled Request';
    if (!quick) {
      name = await prompt({ title: 'New request', defaultValue: 'New request', confirmLabel: 'Create' });
      if (!name) return;
    }
    run(async () => {
      const created = await requestApi.create({ projectId, folderId, name });
      await loadTree();
      setTabs((prev) => [...prev, makeTab(created)]);
      setActiveId(created._id);
    });
  }

  async function deleteRequest(request) {
    const ok = await confirm({ title: 'Delete request?', message: `"${request.name}" and its saved samples will be deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    run(async () => {
      await requestApi.remove(request._id);
      const data = await loadTree();
      dropMissingTabs(new Set(data.requests.map((r) => r._id)));
    });
  }

  function saveRequest() {
    if (!tab) return;
    const { id, draft: toSave } = tab;
    run(async () => {
      const saved = await requestApi.update(id, toSave);
      // The server keeps only file names; carry the chosen files over so Send still works after Save
      const files = toSave.body?.fields || [];
      saved.body = { ...saved.body, fields: (saved.body?.fields || []).map((f, i) => (files[i]?.file ? { ...f, file: files[i].file } : f)) };
      patchTab(id, { draft: saved, isDirty: false });
      await loadTree(); // name or method may have changed in the sidebar
    });
  }

  async function sendRequest() {
    if (!tab) return;
    const { id, draft: toSend } = tab;
    patchTab(id, { isSending: true, response: null });
    try {
      const prepared = prepareRequest(toSend, project?.variables, project?.auth);
      // Local / private addresses can only be reached from the user's own browser; everything else goes through our server
      let result;
      if (isLocalUrl(prepared.url)) {
        try {
          result = await sendFromBrowser(prepared);
        } catch (browserErr) {
          if (!browserErr.isNetworkFailure) throw browserErr;
          // Browser could not do it (usually CORS or API not running). In local development our own server can often reach
          // localhost without CORS (needs ALLOW_PRIVATE_URLS=true); on a hosted server this is refused and the browser's explanation is shown.
          try {
            result = await executeApi.send(prepared);
          } catch (serverErr) {
            const msg = serverErr.response?.data?.message || '';
            throw /blocked on this server|Could not find the host/.test(msg) ? browserErr : new Error(`${browserErr.message}

Tried through the server too: ${msg || serverErr.message}`);
          }
        }
      } else {
        try {
          result = await executeApi.send(prepared);
        } catch (err) {
          // Names like http://my-pc or http://app.local look public but only exist on the user's network: the server says so, then the browser tries
          const msg = err.response?.data?.message || '';
          if (!/blocked on this server|Could not find the host/.test(msg)) throw err;
          result = await sendFromBrowser(prepared);
        }
      }
      patchTab(id, { response: result });
    } catch (err) {
      patchTab(id, { response: { error: err.response ? getErrorMessage(err) : err.message } });
    } finally {
      patchTab(id, { isSending: false });
    }
  }

  // ---- folders ----
  async function newFolder(parentId = null) {
    const name = await prompt({ title: 'New folder', placeholder: 'Folder name', confirmLabel: 'Create' });
    if (!name) return;
    run(async () => {
      await folderApi.create({ projectId, parentId, name });
      await loadTree();
    });
  }

  async function renameFolder(folder) {
    const name = await prompt({ title: 'Rename folder', defaultValue: folder.name, confirmLabel: 'Rename' });
    if (!name || name === folder.name) return;
    run(async () => {
      await folderApi.rename(folder._id, name);
      await loadTree();
    });
  }

  async function deleteFolder(folder) {
    const ok = await confirm({ title: 'Delete folder?', message: `"${folder.name}" and everything inside it will be deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    run(async () => {
      await folderApi.remove(folder._id);
      const data = await loadTree();
      dropMissingTabs(new Set(data.requests.map((r) => r._id)));
    });
  }

  // ---- drag & drop in the sidebar ----
  function moveNode(move) {
    run(async () => {
      await projectApi.move(projectId, move);
      // Keep an open tab's folder in step, otherwise its next Save would move the request back
      if (move.type === 'request') {
        patchTab(move.id, (t) => ({ draft: { ...t.draft, folder: move.parentId } }));
      }
      await loadTree();
    });
  }

  // ---- samples ----
  async function saveSample() {
    if (!tab?.response) return;
    const { id, response } = tab;
    const name = await prompt({
      title: 'Save as sample',
      defaultValue: `${response.status} ${response.statusText || 'example'}`,
      confirmLabel: 'Save',
    });
    if (!name) return;
    run(async () => {
      const created = await sampleApi.create(id, { ...response, name });
      patchTab(id, (t) => ({ samples: [created, ...t.samples] }));
    });
  }

  function viewSample(sample) {
    patchTab(tab.id, { response: { ...sample, isSample: true } });
  }

  async function deleteSample(sample) {
    const id = tab.id;
    const ok = await confirm({ title: 'Delete sample?', message: `"${sample.name}" will be deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    run(async () => {
      await sampleApi.remove(id, sample._id);
      patchTab(id, (t) => ({
        samples: t.samples.filter((s) => s._id !== sample._id),
        response: t.response?._id === sample._id ? null : t.response,
      }));
    });
  }

  // ---- project variables ----
  async function saveVariables(variables, auth) {
    try {
      const updated = await projectApi.update(projectId, { variables, auth });
      setProject((prev) => ({ ...prev, variables: updated.variables, auth: updated.auth }));
    } catch (err) {
      throw new Error(getErrorMessage(err)); // shown inside the dialog
    }
  }

  // ---- layout ----
  const sidebarActions = { openVariables: () => setVarsOpen(true), openSocket: () => setSocketView('visible'), openRequest: (id) => { setSocketView((v) => (v === 'visible' ? 'hidden' : v)); return openRequest(id); }, newRequest, deleteRequest, newFolder, renameFolder, deleteFolder, moveNode };

  return (
    <div
      className={`workspace ${draft && notesOpen && !showingSocket ? 'has-notes' : ''}`}
      style={{ '--notes-w': `${notesWidth}px` }}
    >
      <Sidebar
        project={project}
        variableCount={(project?.variables || []).filter((v) => v.enabled).length}
        folders={folders}
        requests={requests}
        activeRequestId={activeId}
        actions={sidebarActions}
        readOnly={readOnly}
      />

      <div className="workspace-center">
        {!showingSocket && <TabBar
          tabs={tabs}
          activeId={activeId}
          onSelect={(id) => { setSocketView((v) => (v === 'visible' ? 'hidden' : v)); setActiveId(id); }}
          onClose={closeTab}
          onNew={readOnly ? undefined : () => newRequest(null, true)}
          onShowDescription={draft && !notesOpen && !showingSocket ? () => setNotesOpen(true) : undefined}
        />}

        {socketView !== 'closed' && <SocketPanel projectId={projectId} variables={project?.variables} hidden={!showingSocket} />}

        <main className="workspace-main" hidden={showingSocket}>
          {error && (
            <div className="banner-error" role="alert">
              {error}
              <button className="icon-btn" onClick={() => setError('')} aria-label="Dismiss error">✕</button>
            </div>
          )}

          {tab ? (
            <>
              <RequestEditor
                key={tab.id}
                draft={tab.draft}
                variables={project?.variables}
          projectAuth={project?.auth}
                projectAuth={project?.auth}
                isDirty={tab.isDirty}
                isSending={tab.isSending}
                onChange={updateDraft}
                onSend={sendRequest}
                onSave={saveRequest}
                readOnly={readOnly}
              />
              <ResponseViewer
                key={`response-${tab.id}`}
                response={tab.response}
                requestName={tab.draft.name}
                isSending={tab.isSending}
                samples={tab.samples}
                onSaveSample={saveSample}
                onViewSample={viewSample}
                onDeleteSample={deleteSample}
                readOnly={readOnly}
              />
            </>
          ) : (
            <div className="empty-state">
              <h2>No request open</h2>
              <p className="muted">{readOnly ? 'Pick a request from the sidebar.' : 'Pick a request from the sidebar, or create a new one.'}</p>
              {!readOnly && <button className="btn btn-primary" onClick={() => newRequest(null)}>New request</button>}
            </div>
          )}
        </main>
      </div>

      {draft && notesOpen && !showingSocket && (
        <NotesPanel
          key={draft._id}
          description={draft.description}
          isDirty={isDirty}
          onChange={updateDraft}
          onSave={saveRequest}
          width={notesWidth}
          onResize={(w) => setNotesWidth(Math.min(NOTES_MAX, Math.max(NOTES_MIN, w)))}
          onHide={() => setNotesOpen(false)}
          readOnly={readOnly}
          draft={draft}
          variables={project?.variables}
        />
      )}

      {varsOpen && (
        <VariablesDialog variables={project?.variables || []} auth={project?.auth} onSave={saveVariables} readOnly={readOnly} onClose={() => setVarsOpen(false)} />
      )}

    </div>
  );
}
