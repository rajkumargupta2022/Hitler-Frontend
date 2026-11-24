// Tiny syntax highlighter for the code snippets. Returns [{ type, text }] tokens;
// the Code panel colors them like VS Code (Dark+ / Light+).

const KEYWORDS = new Set((
  'import from as package func fun function const let var final val def class new return if else for while try catch await async ' +
  'public private static void int string String bool true false null nil None True False self this using namespace require use fmt ' +
  'throws throw defer go type struct interface extends implements echo print puts main end do then in of with is not and or'
).split(' '));
const HASH_COMMENT = new Set(['curl', 'python', 'ruby', 'powershell']);

export function highlight(code, languageId) {
  const hash = HASH_COMMENT.has(languageId);
  const rules = [
    ['comment', hash ? /#[^\n]*/y : /\/\/[^\n]*/y],
    ['string', /"(?:\.|[^"\\n])*"|'(?:\.|[^'\\n])*'/y],
    ['flag', languageId === 'curl' ? /--?[A-Za-z][\w-]*/y : /(?!)/y],
    ['number', /\b\d+(?:\.\d+)?\b/y],
    ['variable', /\$[A-Za-z_]\w*/y],
    ['word', /[A-Za-z_][\w]*/y],
    ['punct', /[^\sA-Za-z0-9_]/y],
    ['space', /\s+/y],
  ];

  const tokens = [];
  const push = (type, text) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type && type !== 'string') last.text += text;
    else tokens.push({ type, text });
  };

  let pos = 0;
  while (pos < code.length) {
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = pos;
      const m = re.exec(code);
      if (!m || m.index !== pos || m[0] === '') continue;
      let kind = type;
      if (type === 'word') {
        const next = code[pos + m[0].length];
        if (KEYWORDS.has(m[0])) kind = 'keyword';
        else if (next === '(') kind = 'function';
        else if (/^[A-Z]/.test(m[0])) kind = 'type';
        else kind = 'plain';
      }
      if (type === 'punct' || type === 'space') kind = 'plain';
      push(kind, m[0]);
      pos += m[0].length;
      matched = true;
      break;
    }
    if (!matched) { push('plain', code[pos]); pos += 1; }
  }
  return tokens;
}
