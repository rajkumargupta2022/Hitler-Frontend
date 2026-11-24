// Row of open requests above the editor: method + name, a dot when unsaved, ✕ to close, + for a new request,
// and a ▾ menu that lists every open tab. Tabs shrink to share the width, so the bar never scrolls sideways.
import { useEffect, useRef, useState } from 'react';
import MethodBadge from './MethodBadge.jsx';

export default function TabBar({ tabs, activeId, onSelect, onClose, onNew, onShowDescription }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Middle-click closes a tab, like in a browser
  const onAuxClick = (e, id) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(id);
    }
  };

  return (
    <div className="tabbar">
      <div className="tabbar-scroll" role="tablist" aria-label="Open requests">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={`req-tab ${isActive ? 'is-active' : ''}`}
              onMouseDown={(e) => e.button === 1 && e.preventDefault()}
              onAuxClick={(e) => onAuxClick(e, tab.id)}
              title={tab.draft.name}
            >
              <button role="tab" aria-selected={isActive} className="req-tab-main" onClick={() => onSelect(tab.id)}>
                <MethodBadge method={tab.draft.method} />
                <span className="req-tab-name">{tab.draft.name || 'Untitled'}</span>
              </button>
              {tab.isDirty && <span className="dirty-dot" title="Unsaved changes" />}
              <button className="req-tab-close" onClick={() => onClose(tab.id)} aria-label={`Close ${tab.draft.name}`} title="Close">✕</button>
            </div>
          );
        })}
      </div>

      {onNew && <button className="tabbar-btn" onClick={onNew} aria-label="New request" title="New request">+</button>}

      <div className="tabbar-menu-wrap" ref={menuRef}>
        <button
          className="tabbar-btn"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="All open requests"
          aria-expanded={menuOpen}
          title="All open requests"
        >
          ▾
        </button>
        {menuOpen && (
          <ul className="tabbar-menu">
            {tabs.length === 0 && <li className="muted small tabbar-menu-empty">No open requests</li>}
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  className={`tabbar-menu-item ${tab.id === activeId ? 'is-active' : ''}`}
                  onClick={() => {
                    onSelect(tab.id);
                    setMenuOpen(false);
                  }}
                >
                  <MethodBadge method={tab.draft.method} />
                  <span className="req-tab-name">{tab.draft.name || 'Untitled'}</span>
                  {tab.isDirty && <span className="dirty-dot" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {onShowDescription && (
        <button className="tabbar-desc" onClick={onShowDescription} title="Show the description and code panel">📝 Description</button>
      )}
    </div>
  );
}
