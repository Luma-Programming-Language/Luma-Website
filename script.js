// Code examples with syntax highlighting
const examples = {
  hello: `@module "main"

@use "io" as io

pub const main -> fn () int {
  let message: str = "Hello, Luma!";
  io::print_str("%s\\\\n", [message]);
  return 0;
}`,

  structs: `@module "main"

@use "io" as io

const Point -> struct {
  x: int,
  y: int,
};

pub const main -> fn () int {
  let origin: Point = Point { x: 0, y: 0 };
  io::print_int("Point: (%d, %d)\\\\n", [origin.x, origin.y]);
  return 0;
}`,

  memory: `@module "main"

@use "io" as io

pub const main -> fn () int {
  let ptr: *int = cast<*int>(alloc(sizeof<int>));
  defer free(ptr);
  *ptr = 42;
  io::print_int("Value: %d\\\\n", [*ptr]);
  return 0;
}`,

  functions: `@module "main"

@use "io" as io

const fibonacci -> fn (n: int) int {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

pub const main -> fn () int {
  io::print_int("Fib(10): %d\\\\n", [fibonacci(10)]);
  return 0;
}`
};

// Syntax highlighter
function highlight(code) {
  // Use a token-based approach to avoid conflicts
  const tokens = [];
  let position = 0;
  
  // Helper to add a token
  function addToken(match, type, index) {
    // Check if this position is already tokenized
    for (let token of tokens) {
      if (index >= token.start && index < token.end) return;
    }
    tokens.push({
      start: index,
      end: index + match.length,
      text: match,
      type: type
    });
  }
  
  // 1. Find strings (highest priority)
  const stringRegex = /"([^"\\]|\\.)*"/g;
  let match;
  while ((match = stringRegex.exec(code)) !== null) {
    addToken(match[0], 'string', match.index);
  }
  
  // 2. Find comments
  const commentRegex = /\/\/.*/g;
  while ((match = commentRegex.exec(code)) !== null) {
    addToken(match[0], 'comment', match.index);
  }
  
  // 3. Module directives
  const moduleRegex = /@(module|use)\b/g;
  while ((match = moduleRegex.exec(code)) !== null) {
    addToken(match[0], 'module', match.index);
  }
  
  // 4. Function calls
  const functionRegex = /\b(alloc|free|sizeof|cast|print_str|print_int|fibonacci)(?=\s*\()/g;
  while ((match = functionRegex.exec(code)) !== null) {
    addToken(match[1], 'function', match.index);
  }
  
  // 5. Keywords
  const keywordRegex = /\b(pub|const|fn|let|struct|defer|if|return|as)\b/g;
  while ((match = keywordRegex.exec(code)) !== null) {
    addToken(match[1], 'keyword', match.index);
  }
  
  // 6. Types
  const typeRegex = /\b(int|str|void|Point)\b/g;
  while ((match = typeRegex.exec(code)) !== null) {
    addToken(match[1], 'type', match.index);
  }
  
  // 7. Numbers
  const numberRegex = /\b\d+\b/g;
  while ((match = numberRegex.exec(code)) !== null) {
    addToken(match[0], 'number', match.index);
  }
  
  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);
  
  // Build the highlighted string
  let result = '';
  let lastIndex = 0;
  
  for (let token of tokens) {
    // Add any text before this token
    result += code.substring(lastIndex, token.start);
    // Add the highlighted token
    result += `<span class="${token.type}">${token.text}</span>`;
    lastIndex = token.end;
  }
  
  // Add any remaining text
  result += code.substring(lastIndex);
  
  return result;
}

// Initialize code examples
function initExamples() {
  Object.keys(examples).forEach(key => {
    const code = examples[key]
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const highlighted = highlight(code);
    document.getElementById(`code-${key}`).innerHTML = highlighted;
  });
}

// Theme Toggle
const themeBtn = document.getElementById('themeBtn');
const html = document.documentElement;

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefersDark) {
  html.setAttribute('data-theme', 'dark');
}

themeBtn.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
});

// Code Example Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const codeContents = document.querySelectorAll('.code-content');
const codeLabel = document.getElementById('codeLabel');

const exampleLabels = {
  'hello': 'hello.lx',
  'structs': 'structs.lx',
  'memory': 'memory.lx',
  'functions': 'functions.lx'
};

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const example = btn.dataset.example;
    
    tabBtns.forEach(b => b.classList.remove('active'));
    codeContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.querySelector(`.code-content[data-example="${example}"]`).classList.add('active');
    
    codeLabel.textContent = exampleLabels[example];
  });
});

function getSeasonalMascot() {
  const now = new Date();
  const month = now.getMonth(); // 0-11 (0 = January, 11 = December)
  const day = now.getDate();
  
  // Show Christmas mascot during December
  if (month === 11) {
    return 'img/luma_christmas.png';
  }
  
  // Default mascot
  return 'img/luma.png';
}

// Apply the seasonal mascot on page load
function initSeasonalMascot() {
  const mascotImg = document.querySelector('.mascot');
  if (mascotImg) {
    mascotImg.src = getSeasonalMascot();
  }
}

initSeasonalMascot();
initExamples();