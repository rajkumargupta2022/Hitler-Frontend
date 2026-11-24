// Left panel: project name + the folder/request tree (drag rows to reorder or move them).
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildTree, containsId, findNode } from '../utils/buildTree.js';
import TreeNode from './TreeNode.jsx';

export default function Sidebar({ project, variableCount = 0, folders, requests, activeRequestId, actions, readOnly = false }) {
  const tree = useMemo(() => buildTree(folders, requests), [folders, requests]);

  // ---- drag & drop ----
  const dragged = useRef(null); // the tree node being dragged
  const [draggedId, setDraggedId] = useState(null);
  const [hint, setHint] = useState(null); // { id, position } of the row showing a drop line, or { id: 'root' }

  const clear = () => {
    dragged.current = null;
    setDraggedId(null);
    setHint(null);
  };

  // A folder can't be dropped on itself or anything inside it
  const canDrop = (target) => Boolean(dragged.current) && !containsId(dragged.current, target._id);

  // Children of a folder (or the root list when parentId is null)
  const siblingsOf = (parentId) => (parentId ? findNode(tree, parentId).children : tree);

  function dropOn(target, position) {
    const item = dragged.current;
    clear();
    if (!item || containsId(item, target._id)) return;

    let parentId;
    let list;
    if (position === 'inside') {
      parentId = target._id;
      list = [...target.children.filter((n) => n._id !== item._id), item]; // goes to the end of that folder
    } else {
      parentId = (target.type === 'folder' ? target.parent : target.folder) || null;
      list = siblingsOf(parentId).filter((n) => n._id !== item._id);
      const at = list.findIndex((n) => n._id === target._id);
      list.splice(position === 'before' ? at : at + 1, 0, item);
    }
    actions.moveNode({ type: item.type, id: item._id, parentId, orderedIds: list.map((n) => ({ type: n.type, id: n._id })) });
  }

  // Dropping on the empty space below the tree moves the item to the end of the project root
  function dropOnRoot(e) {
    e.preventDefault();
    const item = dragged.current;
    clear();
    if (!item) return;
    const list = [...tree.filter((n) => n._id !== item._id), item];
    actions.moveNode({ type: item.type, id: item._id, parentId: null, orderedIds: list.map((n) => ({ type: n.type, id: n._id })) });
  }

  const dnd = {
    draggedId,
    hint,
    start: (node) => {
      dragged.current = node;
      setDraggedId(node._id);
    },
    end: clear,
    canDrop,
    hover: (node, position) => {
      if (!hint || hint.id !== node._id || hint.position !== position) setHint({ id: node._id, position });
    },
    drop: dropOn,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="back-link">‹ All projects</Link>
        <h2 className="sidebar-title">{project ? project.name : 'Loading…'}</h2>
        {!readOnly && (
          <div className="sidebar-actions">
            <button className="btn btn-small" onClick={() => actions.newRequest(null)}>New request</button>
            <button className="btn btn-small" onClick={() => actions.newFolder(null)}>New folder</button>
          </div>
        )}
        <button className="btn btn-small vars-btn" onClick={actions.openVariables} title="Variables you can use in requests as {{name}}">
          {'{ }'} Variables{variableCount > 0 && <span className="tab-count">{variableCount}</span>}
        </button>
        <button className="btn btn-small vars-btn" onClick={actions.openSocket} title="Connect to a WebSocket server and send messages">
          ⚡ WebSocket
        </button>
      </div>

      <nav
        className={`tree ${hint?.id === 'root' ? 'drop-root' : ''}`}
        aria-label="Folders and requests"
        onDragOver={(e) => {
          if (!dragged.current) return;
          e.preventDefault();
          if (hint?.id !== 'root') setHint({ id: 'root' });
        }}
        onDrop={dropOnRoot}
      >
        {tree.length === 0 ? (
          <p className="muted small tree-empty">{readOnly ? 'Nothing here yet.' : 'Nothing here yet. Create a request or a folder to start.'}</p>
        ) : (
          tree.map((node) => (
            <TreeNode key={node._id} node={node} depth={0} activeRequestId={activeRequestId} actions={actions} dnd={dnd} readOnly={readOnly} />
          ))
        )}
        {tree.length > 0 && !readOnly && <p className="muted small tree-hint">Drag to reorder or move into a folder</p>}
      </nav>
    </aside>
  );
}
