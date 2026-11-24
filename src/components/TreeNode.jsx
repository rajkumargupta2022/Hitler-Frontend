// One row in the sidebar tree. Folders render their children recursively.
// Rows can be dragged: drop on the top/bottom edge to reorder, on a folder's middle to move inside it.
import { useEffect, useState } from 'react';
import MethodBadge from './MethodBadge.jsx';

// Closed / open folder icon (inherits the text color via currentColor)
function FolderIcon({ open }) {
  return (
    <svg className="folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" />
          <path d="M3.5 20h15.2a2 2 0 0 0 1.9-1.4l1.8-6.2a1 1 0 0 0-1-1.3H7.6a2 2 0 0 0-1.9 1.4L3 20z" fill="currentColor" fillOpacity=".15" />
        </>
      ) : (
        <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill="currentColor" fillOpacity=".15" />
      )}
    </svg>
  );
}

const hasRequest = (node, id) =>
  !!id && node.type === 'folder' && (node.children || []).some((c) => c._id === id || hasRequest(c, id));

export default function TreeNode({ node, depth, activeRequestId, actions, dnd, readOnly = false }) {
  // Folders start closed; only the path to the currently open request starts expanded
  const [isOpen, setIsOpen] = useState(() => hasRequest(node, activeRequestId));
  const [menu, setMenu] = useState(null); // { top, left } of the folder's action menu, null = closed

  // Close the menu on any outside click, Escape, or scroll
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  function toggleMenu(e) {
    e.stopPropagation();
    if (menu) return setMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ top: rect.bottom + 4, left: Math.max(8, rect.right - 170) }); // fixed position, so the sidebar's scroll area can't clip it
  }
  const choose = (fn) => () => {
    setMenu(null);
    fn();
  };
  const indent = { paddingLeft: `${10 + depth * 16}px` };
  const isFolder = node.type === 'folder';

  // Where on the row is the cursor? top edge = before, bottom edge = after, middle of a folder = inside
  function positionFor(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (isFolder) return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
    return ratio < 0.5 ? 'before' : 'after';
  }

  const dragProps = readOnly ? {} : {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', node.name); // Firefox needs some data to start a drag
      dnd.start(node);
    },
    onDragEnd: dnd.end,
    onDragOver: (e) => {
      if (!dnd.canDrop(node)) return;
      e.preventDefault(); // allows dropping here
      dnd.hover(node, positionFor(e));
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      dnd.drop(node, positionFor(e));
    },
  };

  const hint = dnd.hint && dnd.hint.id === node._id ? `drop-${dnd.hint.position}` : '';
  const dragging = dnd.draggedId === node._id ? 'is-dragging' : '';

  // ---- request row ----
  if (!isFolder) {
    const isActive = node._id === activeRequestId;
    return (
      <div className={`tree-row ${isActive ? 'is-active' : ''} ${hint} ${dragging}`} style={indent} {...dragProps}>
        <button className="tree-label" onClick={() => actions.openRequest(node._id)}>
          <MethodBadge method={node.method} />
          <span className="tree-name">{node.name}</span>
        </button>
        {!readOnly && (
          <div className="tree-tools">
            <button onClick={() => actions.deleteRequest(node)} aria-label={`Delete ${node.name}`} title="Delete">✕</button>
          </div>
        )}
      </div>
    );
  }

  // ---- folder row ----
  return (
    <div>
      <div className={`tree-row ${hint} ${dragging}`} style={indent} {...dragProps}>
        <button className="tree-label" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
          <FolderIcon open={isOpen} />
          <span className="tree-name folder-name">{node.name}</span>
        </button>
        {!readOnly && (
          <div className={`tree-tools ${menu ? 'is-open' : ''}`}>
            <button onClick={toggleMenu} onMouseDown={(e) => e.stopPropagation()} aria-label={`Actions for ${node.name}`} aria-haspopup="menu" aria-expanded={!!menu} title="Folder actions">⋯</button>
          </div>
        )}
        {menu && (
          <div className="tree-menu" role="menu" style={{ top: menu.top, left: menu.left }} onMouseDown={(e) => e.stopPropagation()}>
            <button role="menuitem" onClick={choose(() => actions.newRequest(node._id))}>New request</button>
            <button role="menuitem" onClick={choose(() => actions.newFolder(node._id))}>New folder</button>
            <button role="menuitem" onClick={choose(() => actions.renameFolder(node))}>Rename</button>
            <button role="menuitem" className="is-danger" onClick={choose(() => actions.deleteFolder(node))}>Delete</button>
          </div>
        )}
      </div>

      {isOpen && node.children.length === 0 && (
        <p className="tree-empty-folder muted small" style={{ paddingLeft: `${34 + depth * 16}px` }}>Empty folder</p>
      )}

      {isOpen &&
        node.children.map((child) => (
          <TreeNode key={child._id} node={child} depth={depth + 1} activeRequestId={activeRequestId} actions={actions} dnd={dnd} readOnly={readOnly} />
        ))}
    </div>
  );
}
