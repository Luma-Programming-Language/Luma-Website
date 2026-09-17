Prism.languages.luma = {
  'comment': [
    {
      pattern: /\/\/.*/,
      greedy: true
    },
    {
      pattern: /\/\*[\s\S]*?\*\//,
      greedy: true
    }
  ],
  'attr-name': {
    pattern: /#[a-z_]\w*/,
    greedy: true
  },
  'directive': {
    pattern: /@[a-z_]\w*/,
    alias: 'keyword'
  },
  'string': {
    pattern: /"(?:\\.|[^"\\])*"/,
    greedy: true
  },
  'char': {
    pattern: /'(?:\\.|[^'\\])'/,
    greedy: true
  },
  'number': /\b\d+(?:\.\d+)?\b/,
  'keyword': /\b(?:const|let|pub|fn|struct|enum|if|elif|else|switch|loop|break|continue|return|defer|true|false|void|as|match)\b/,
  'builtin': /\b(?:cast|sizeof|alloc|free|output|outputln|input|system)\b/,
  'type': /\b(?:i8|i16|i32|i64|u8|u16|u32|u64|f32|f64|byte|bool|void)\b/,
  'function': {
    pattern: /\b[A-Za-z_]\w*(?=\s*\()/,
    alias: 'function'
  },
  'operator': /::|\.\.|[+\-*/%]=?|&&?|\|\|?|!=|==|<=|>=|->|=|&/,
};
