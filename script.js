const examples = {
  hello: `@module "main"

@use "io" as io

pub const main -> fn () int {
  let message: str = "Hello, Luma!";
  io::print_str("%s\\n", [message]);
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
  io::print_int("Point: (%d, %d)\\n", [origin.x, origin.y]);
  return 0;
}`,

  memory: `@module "main"

@use "io" as io

pub const main -> fn () int {
  let ptr: *int = cast<*int>(alloc(sizeof<int>));
  defer free(ptr);
  *ptr = 42;
  io::print_int("Value: %d\\n", [*ptr]);
  return 0;
}`,

  functions: `@module "main"

@use "io" as io

const fibonacci -> fn (n: int) int {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

pub const main -> fn () int {
  io::print_int("Fib(10): %d\\n", [fibonacci(10)]);
  return 0;
}`
};

// Syntax highlighter
function highlight(code) {
  const tokens = [];
  
  function addToken(match, type, index) {
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
  
  const stringRegex = /"([^"\\]|\\.)*"/g;
  let match;
  while ((match = stringRegex.exec(code)) !== null) {
    addToken(match[0], 'string', match.index);
  }
  
  const commentRegex = /\/\/.*/g;
  while ((match = commentRegex.exec(code)) !== null) {
    addToken(match[0], 'comment', match.index);
  }
  
  const moduleRegex = /@(module|use)\b/g;
  while ((match = moduleRegex.exec(code)) !== null) {
    addToken(match[0], 'module', match.index);
  }
  
  const functionRegex = /\b(alloc|free|sizeof|cast|print_str|print_int|fibonacci)(?=\s*\()/g;
  while ((match = functionRegex.exec(code)) !== null) {
    addToken(match[1], 'function', match.index);
  }
  
  const keywordRegex = /\b(pub|const|fn|let|struct|defer|if|return|as)\b/g;
  while ((match = keywordRegex.exec(code)) !== null) {
    addToken(match[1], 'keyword', match.index);
  }
  
  const typeRegex = /\b(int|str|void|Point)\b/g;
  while ((match = typeRegex.exec(code)) !== null) {
    addToken(match[1], 'type', match.index);
  }
  
  const numberRegex = /\b\d+\b/g;
  while ((match = numberRegex.exec(code)) !== null) {
    addToken(match[0], 'number', match.index);
  }
  
  tokens.sort((a, b) => a.start - b.start);
  
  let result = '';
  let lastIndex = 0;
  
  for (let token of tokens) {
    result += code.substring(lastIndex, token.start);
    result += `<span class="${token.type}">${token.text}</span>`;
    lastIndex = token.end;
  }
  
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

// Fetch latest version from GitHub
async function fetchLatestVersion() {
  const versionBadge = document.getElementById('versionBadge');
  const versionText = document.getElementById('versionText');
  
  try {
    const response = await fetch('https://api.github.com/repos/TheDevConnor/Luma/releases/latest');
    const data = await response.json();
    
    if (data.tag_name) {
      versionText.textContent = data.tag_name;
      versionBadge.classList.remove('loading');
      versionBadge.href = data.html_url;
    } else {
      versionText.textContent = 'v1.0.0';
      versionBadge.classList.remove('loading');
    }
  } catch (error) {
    console.error('Failed to fetch version:', error);
    versionText.textContent = 'Version';
    versionBadge.classList.remove('loading');
  }
}

// Seasonal mascot switcher
function getSeasonalMascot() {
  const now = new Date();
  const month = now.getMonth();
  
  if (month === 11) {
    return 'img/luma_christmas.png';
  }
  
  return 'img/luma.png';
}

function initSeasonalMascot() {
  const mascotImg = document.querySelector('.mascot');
  if (mascotImg) {
    mascotImg.src = getSeasonalMascot();
  }
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

// Initialize on load
initExamples();
initSeasonalMascot();
fetchLatestVersion();