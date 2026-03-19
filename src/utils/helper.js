export function tokenizeLine(line) {
  const allMatches = [];

  // --- Regex definitions (each fresh instance, no shared state) ---
  // Comments: must be added first so keywords/strings inside comments are skipped
  const commentRe = /(\/\/.*$)/g;
  // Strings: handles escaped quotes; added early so keywords inside strings are skipped
  const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  // Language keywords & special values
  const keywordRe = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|true|false|null|undefined|new|class|extends|super|import|export|from|as|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|yield|static|get|set|this)\b/g;
  // Built-in globals & common APIs
  const builtinRe = /\b(console|Math|Array|Object|String|Number|Boolean|Date|Promise|RegExp|Error|Map|Set|WeakMap|WeakSet|JSON|Symbol|setTimeout|setInterval|clearTimeout|clearInterval|parseInt|parseFloat|isNaN|isFinite|fetch|document|window|navigator|location|localStorage|sessionStorage|require|module|process|globalThis)\b/g;
  // Function/method calls — identifier immediately before an optional-space then '('
  const funcRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g;
  // Numeric literals (decimal and hex)
  const numberRe = /\b(0x[0-9a-fA-F]+|\d+\.?\d*([eE][+-]?\d+)?)\b/g;
  // Operators
  const operatorRe = /(===|!==|=>|<=|>=|&&|\|\||[+\-*/%=!<>&|^~?:])/g;

  // Add matches — insertion order determines priority when indices tie (comments win over keywords, etc.)
  for (const m of line.matchAll(commentRe)) allMatches.push({ index: m.index, text: m[0], color: "#6272a4" }); // grey   – comments
  for (const m of line.matchAll(stringRe)) allMatches.push({ index: m.index, text: m[0], color: "#f1fa8c" }); // yellow – strings
  for (const m of line.matchAll(keywordRe)) allMatches.push({ index: m.index, text: m[0], color: "#ff79c6" }); // pink   – keywords
  for (const m of line.matchAll(builtinRe)) allMatches.push({ index: m.index, text: m[0], color: "#8be9fd" }); // cyan   – built-ins
  for (const m of line.matchAll(funcRe)) allMatches.push({ index: m.index, text: m[0], color: "#50fa7b" }); // green  – function calls
  for (const m of line.matchAll(numberRe)) allMatches.push({ index: m.index, text: m[0], color: "#bd93f9" }); // purple – numbers
  for (const m of line.matchAll(operatorRe)) allMatches.push({ index: m.index, text: m[0], color: "#ff79c6" }); // pink   – operators

  // Sort by position; for the same position, prefer the longer (more specific) match
  allMatches.sort((a, b) => a.index - b.index || b.text.length - a.text.length);

  const tokens = [];
  let lastIndex = 0;

  for (const match of allMatches) {
    if (match.index < lastIndex) continue; // overlaps an already-emitted token — skip

    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), color: "#f8f8f2" }); // default white
    }

    tokens.push({ text: match.text, color: match.color });
    lastIndex = match.index + match.text.length;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), color: "#f8f8f2" });
  }

  return tokens;
}
