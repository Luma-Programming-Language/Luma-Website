Prism.languages.zura = {
  'comment': /\/\/.*/,
  'string': {
    pattern: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/,
    greedy: true
  },
  'number': /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
  'keyword': /\b(?:pub|priv|const|fn|have|auto|loop|if|else|return|enum|struct|typename|template|break|continue)\b/,
  'type': /\b(?:uint|int|float|bool|str|char|nil)\b/,
  'builtin': /@\w+/,
  'function': {
    pattern: /\bfn\s+\w+(?=\s*\()/,
    alias: 'function'
  },
  'operator': /[=(){}\[\],;.+\-*/<>]/,
  'variable': {
    pattern: /\b\w+\b/,
    alias: 'variable'
  }
};
