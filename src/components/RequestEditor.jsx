// Top half of the workspace: name, method + URL bar, and the Params/Headers/Body/Auth tabs.
import { useState } from 'react';
import KeyValueTable from './KeyValueTable.jsx';
import BodyEditor from './BodyEditor.jsx';
import AuthEditor from './AuthEditor.jsx';
import { findUndefinedVariables } from '../utils/variables.js';
import { isLocalUrl } from '../utils/browserRequest.js';
import { prepareRequest } from '../utils/prepareRequest.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const TABS = ['Params', 'Headers', 'Body', 'Auth'];

const countActive = (rows) => rows.filter((r) => r.enabled && r.key.trim()).length;

export default function RequestEditor({ draft, variables = [], projectAuth, isDirty, isSending, onChange, onSend, onSave, readOnly = false }) {
  const [activeTab, setActiveTab] = useState('Body');

  // Same rule WorkspacePage uses when sending: check the URL after {{variables}} are filled in
  let sendsFromBrowser = false;
  try { sendsFromBrowser = isLocalUrl(prepareRequest(draft, variables, projectAuth).url); } catch { /* half-typed URL */ }

  const undefinedVars = findUndefinedVariables(draft, variables, projectAuth);
  const tabCounts = { Params: countActive(draft.params), Headers: countActive(draft.headers) };

  function handleSubmit(e) {
    e.preventDefault(); // pressing Enter in the URL box sends the request
    onSend();
  }

  return (
    <section className="editor">
      <div className="editor-title">
        <input
          className="name-input"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          readOnly={readOnly}
          aria-label="Request name"
        />
        {!readOnly && (
          <button className="btn" onClick={onSave} disabled={!isDirty}>
            {isDirty ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      <form className="url-bar" onSubmit={handleSubmit}>
        <select
          className={`method-select method-${draft.method.toLowerCase()}`}
          value={draft.method}
          onChange={(e) => onChange({ method: e.target.value })}
          disabled={readOnly}
          aria-label="HTTP method"
        >
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          className="url-input"
          placeholder="https://api.example.com/users"
          value={draft.url}
          onChange={(e) => onChange({ url: e.target.value })}
          readOnly={readOnly}
          aria-label="Request URL"
          spellCheck={false}
        />
        <button className="btn btn-primary btn-send" type="submit" disabled={isSending || !draft.url.trim()}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>

      {/* The app picks the sender itself: local/private URLs go from the browser, everything else from the server */}
      {sendsFromBrowser && (
        <p className="muted small send-note">Local address: this request is sent from your browser, so the API must allow CORS.</p>
      )}

      {undefinedVars.length > 0 && (
        <p className="note var-warning">
          Not defined in Variables: {undefinedVars.map((name) => `{{${name}}}`).join(', ')}. They will be sent as typed.
        </p>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tab ${activeTab === tab ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tabCounts[tab] > 0 && <span className="tab-count">{tabCounts[tab]}</span>}
          </button>
        ))}
      </div>

      <fieldset className="ro-fieldset" disabled={readOnly}>
      <div className="tab-panel" role="tabpanel">
        {activeTab === 'Params' && (
          <KeyValueTable
            rows={draft.params}
            onChange={(params) => onChange({ params })}
            keyPlaceholder="page"
            valuePlaceholder="1"
            emptyText="Query params are added to the end of the URL, like ?page=1"
          />
        )}
        {activeTab === 'Headers' && (
          <KeyValueTable
            rows={draft.headers}
            onChange={(headers) => onChange({ headers })}
            keyPlaceholder="Accept"
            valuePlaceholder="application/json"
            emptyText="No headers yet. Content-Type is set for you when you add a body."
          />
        )}
        {activeTab === 'Body' && (
          <BodyEditor body={draft.body} method={draft.method} onChange={(body) => onChange({ body })} />
        )}
        {activeTab === 'Auth' && <AuthEditor auth={draft.auth} projectAuth={projectAuth} onChange={(auth) => onChange({ auth })} />}
      </div>
      </fieldset>
    </section>
  );
}
