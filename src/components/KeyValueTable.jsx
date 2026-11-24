// Reusable table of { key, value, enabled } rows — used for Params and Headers.
const EMPTY_ROW = { key: '', value: '', enabled: true };

export default function KeyValueTable({ rows, onChange, keyPlaceholder, valuePlaceholder, emptyText }) {
  const updateRow = (index, changes) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));
  const addRow = () => onChange([...rows, { ...EMPTY_ROW }]);

  return (
    <div className="kv">
      {rows.length === 0 ? (
        <p className="muted small">{emptyText}</p>
      ) : (
        <table className="kv-table">
          <thead>
            <tr>
              <th className="kv-check"><span className="sr-only">Include</span></th>
              <th>Key</th>
              <th>Value</th>
              <th className="kv-remove"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={row.enabled ? '' : 'is-disabled'}>
                <td className="kv-check">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(index, { enabled: e.target.checked })}
                    aria-label="Include this row"
                  />
                </td>
                <td>
                  <input
                    className="mono"
                    value={row.key}
                    placeholder={keyPlaceholder}
                    onChange={(e) => updateRow(index, { key: e.target.value })}
                    aria-label="Key"
                  />
                </td>
                <td>
                  <input
                    className="mono"
                    value={row.value}
                    placeholder={valuePlaceholder}
                    onChange={(e) => updateRow(index, { value: e.target.value })}
                    aria-label="Value"
                  />
                </td>
                <td className="kv-remove">
                  <button className="icon-btn" onClick={() => removeRow(index)} aria-label="Remove row">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="btn btn-small" onClick={addRow}>Add row</button>
    </div>
  );
}
