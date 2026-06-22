function syncHighlight() {
    var input = document.getElementById('codeInput');
    var el = document.getElementById('highlightedCode');
    if (!input || !el) return;
    var code = input.value;
    el.innerHTML = code ? Prism.highlight(code, Prism.languages.luma, 'luma') : '';
}

var codeInput = document.getElementById('codeInput');
var codePre = document.querySelector('.playground-editor pre');
if (codeInput) {
    codeInput.addEventListener('input', syncHighlight);
}
if (codeInput && codePre) {
    codeInput.addEventListener('scroll', function() {
        codePre.scrollTop = this.scrollTop;
        codePre.scrollLeft = this.scrollLeft;
    });
}

function runInterpreter() {
    if (!codeInput) return;
    var inputCode = codeInput.value;
    var outputTerminal = document.getElementById('outputTerminal');
    if (!outputTerminal) return;
    outputTerminal.innerText = "";

    try {
        Module.callMain(["-c", inputCode]);
    } catch (e) {
        outputTerminal.innerText += "\nRuntime Exception!";
    }
}

function clearOutput() {
    var el = document.getElementById('outputTerminal');
    if (el) el.innerText = "Waiting for execution...";
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

// Theme Toggle
const themeBtn = document.getElementById('themeBtn');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    html.setAttribute('data-theme', savedTheme);
} else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
}

if (themeBtn) {
themeBtn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});
}

// Keyboard shortcut: Ctrl+Enter to run
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var codeInput = document.getElementById('codeInput');
        if (codeInput && document.activeElement === codeInput) {
            e.preventDefault();
            runInterpreter();
        }
    }
});

// Initialize on load
syncHighlight();
fetchLatestVersion();