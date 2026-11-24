// Small colored label: GET, POST, PUT...
export default function MethodBadge({ method }) {
  return <span className={`method method-${method.toLowerCase()}`}>{method === 'DELETE' ? 'DEL' : method}</span>;
}
