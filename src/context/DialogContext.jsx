// In-app modal dialogs that replace window.confirm / window.prompt.
// Usage:  const { confirm, prompt } = useDialog();
//         if (!(await confirm({ title: 'Delete?', message: '...', danger: true }))) return;
//         const name = await prompt({ title: 'Folder name', defaultValue: 'New folder' }); // null if cancelled
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { kind, title, message, ..., resolve }
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const confirmRef = useRef(null);

  const open = useCallback((kind, options) => new Promise((resolve) => {
    setValue(options.defaultValue || '');
    setDialog({ kind, ...options, resolve });
  }), []);

  const confirm = useCallback((options) => open('confirm', options), [open]);
  const prompt = useCallback((options) => open('prompt', options), [open]);

  function close(result) {
    dialog.resolve(result);
    setDialog(null);
  }

  const cancel = () => close(dialog.kind === 'prompt' ? null : false);
  const accept = () => {
    if (dialog.kind === 'prompt') {
      if (!value.trim()) return; // an empty name is not accepted
      close(value.trim());
    } else {
      close(true);
    }
  };

  // Focus the input (prompt) or the confirm button, and close on Escape
  useEffect(() => {
    if (!dialog) return undefined;
    (dialog.kind === 'prompt' ? inputRef : confirmRef).current?.focus();
    inputRef.current?.select();
    const onKey = (e) => {
      if (e.key === 'Escape') cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onSubmit={(e) => {
              e.preventDefault();
              accept();
            }}
          >
            <h3 id="modal-title">{dialog.title}</h3>
            {dialog.message && <p className="modal-message">{dialog.message}</p>}
            {dialog.kind === 'prompt' && (
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={dialog.placeholder || ''}
                aria-label={dialog.title}
                spellCheck={false}
              />
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={cancel}>Cancel</button>
              <button
                type="submit"
                ref={confirmRef}
                className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                disabled={dialog.kind === 'prompt' && !value.trim()}
              >
                {dialog.confirmLabel || (dialog.kind === 'prompt' ? 'OK' : 'Confirm')}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
