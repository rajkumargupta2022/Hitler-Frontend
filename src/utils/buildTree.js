// Turns the flat lists from the server into a nested tree for the sidebar.
//
//  folders:  [{ _id, name, parent, order }]      requests: [{ _id, name, method, folder, order }]
//  result:   [{ type: 'folder', name, children: [ ...folders, ...requests ] }, ...]
export function buildTree(folders, requests) {
  const folderNodes = new Map();
  folders.forEach((f) => folderNodes.set(f._id, { ...f, type: 'folder', children: [] }));

  const root = [];

  // Put each folder inside its parent (or at the root)
  folders.forEach((f) => {
    const node = folderNodes.get(f._id);
    const parent = f.parent ? folderNodes.get(f.parent) : null;
    (parent ? parent.children : root).push(node);
  });

  // Put each request inside its folder (or at the root)
  requests.forEach((r) => {
    const node = { ...r, type: 'request' };
    const parent = r.folder ? folderNodes.get(r.folder) : null;
    (parent ? parent.children : root).push(node);
  });

  sortNodes(root);
  return root;
}

// The order the user dragged things into comes first; items never dragged (order 0)
// fall back to folders first, then A-Z
function sortNodes(nodes) {
  nodes.sort((a, b) => {
    if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((n) => n.children && sortNodes(n.children));
}

export function findNode(nodes, id) {
  for (const node of nodes) {
    if (node._id === id) return node;
    const found = node.children && findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

// True if `id` is this node or anywhere inside it (used to stop a folder being dropped into itself)
export function containsId(node, id) {
  if (node._id === id) return true;
  return (node.children || []).some((child) => containsId(child, id));
}
