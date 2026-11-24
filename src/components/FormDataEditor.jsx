// Form-data rows: Key | Text or File | Value. Files are read in the browser and sent with the request;
// they are NOT saved with the request (only the file name is), so pick them again after reopening.
import { useState } from 'react';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const EMPTY_ROW = { key: '', type: 'text', value: '', enabled: true };

// File -> { name, contentType, data (base64) }
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, contentType: file.type || 'application/octet-stream', data: String(reader.result).split(',')[1] || '' });
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

export default function FormDataEditor({ fields, onChange }) {
  const [error, setError] = useState('');

  const update = (index, changes) => onChange(fields.map((f, i) => (i === index ? { ...f, ...changes } : f)));
  const remove = (index) => onChange(fields.filter((_, i) => i !== index));
  const add = () => onChange([...fields, { ...EMPTY_ROW }]);

  async function pickFile(index, file) {
    if (!file) return;
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError(`"${file.name}" is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB, the limit for uploads here.`);
      return;
    }
    try {
      const data = await readFile(file);
      update(index, { value: data.name, file: data });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="kv">
      {fields.length === 0 ? (
        <p className="muted small">Add fields to send as multipart/form-data. Each field can be text or a file.</p>
      ) : (
        <table className="kv-table">
          <thead>
            <tr>
              <th className="kv-check"><span className="sr-only">Include</span></th>
              <th>Key</th>
              <th className="fd-type">Type</th>
              <th>Value</th>
              <th className="kv-remove"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((row, index) => (
              <tr key={index} className={row.enabled ? '' : 'is-disabled'}>
                <td className="kv-check">
                  <input type="checkbox" checked={row.enabled} onChange={(e) => update(index, { enabled: e.target.checked })} aria-label="Include this field" />
                </td>
                <td>
                  <input className="mono" value={row.key} placeholder="name" onChange={(e) => update(index, { key: e.target.value })} aria-label="Key" />
                </td>
                <td className="fd-type">
                  <select
                    value={row.type}
                    onChange={(e) => update(index, { type: e.target.value, value: '', file: undefined })}
                    aria-label="Field type"
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                  </select>
                </td>
                <td>
                  {row.type === 'file' ? (
                    <label className="fd-file">
                      <input type="file" onChange={(e) => pickFile(index, e.target.files[0])} />
                      <span className={row.file ? '' : 'muted'}>
                        {row.file ? row.file.name : row.value ? `${row.value} (choose the file again to send it)` : 'Choose file…'}
                      </span>
                    </label>
                  ) : (
                    <input className="mono" value={row.value} placeholder="value" onChange={(e) => update(index, { value: e.target.value })} aria-label="Value" />
                  )}
                </td>
                <td className="kv-remove">
                  <button type="button" className="icon-btn" onClick={() => remove(index)} aria-label="Remove field">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="btn btn-small" onClick={add}>Add field</button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
