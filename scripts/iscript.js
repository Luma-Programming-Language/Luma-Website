// Example programs
var examples = {
    hello: [
        'print = __builtin_print;',
        'print("Hello, World!");',
    ].join('\n'),
    vars: [
        'print = __builtin_print;',
        '',
        'x = 42;',
        'y: Int = 10;',
        'name = "Pie";',
        'flag: Bool = true;',
        '',
        'print(x);',
        'print(y);',
        'print(name);',
    ].join('\n'),
    loop: [
        'print = __builtin_print;',
        'infix + = (a, b) => __builtin_add(a, b);',
        '',
        'sum = 0;',
        'loop 10 => i {',
        '    sum = sum + i;',
        '};',
        'print(sum);',
    ].join('\n'),
    factorial: [
        'print = __builtin_print;',
        'infix + = (a, b) => __builtin_add(a, b);',
        'infix * = (a, b) => __builtin_mul(a, b);',
        'infix - = (a, b) => __builtin_sub(a, b);',
        '',
        'fact = (n) => {',
        '    result = 1;',
        '    loop n => i {',
        '        result = result * (i + 1);',
        '    };',
        '    result;',
        '};',
        '',
        'print(fact(5));',
    ].join('\n'),
    fizzbuzz: [
        'print = __builtin_print;',
        'infix % = (a, b) => __builtin_mod(a, b);',
        'infix(&&) and = (a, b) => __builtin_and(a, b);',
        '',
        'loop 16 => i {',
        '    match i {',
        '        a & __builtin_eq(a % 3, 0) and __builtin_eq(a % 5, 0) => print("FizzBuzz");',
        '        a & __builtin_eq(a % 3, 0) => print("Fizz");',
        '        a & __builtin_eq(a % 5, 0) => print("Buzz");',
        '        a => print(a);',
        '    };',
        '};',
    ].join('\n'),
    match: [
        'print = __builtin_print;',
        '',
        'x = 7;',
        'match x {',
        '    =1 | =2 | =3 => print("small");',
        '    a & __builtin_lt(a, 10) => print("medium");',
        '    a => print("large");',
        '};',
    ].join('\n'),
    classes: [
        'print = __builtin_print;',
        '',
        'infix + = (a, b) => __builtin_add(a, b);',
        'infix + = (a: String, b: String) => __builtin_concat(a, b);',
        '',
        'str =  __builtin_to_string;',
        'Point: Type = class {',
        '    x: Int = 0;',
        '    y: Int = 0;',
        '    show = () => {',
        '        print("Point(" + str(x) + ", " + str(y) + ")");',
        '    };',
        '};',
        'p: Point = Point(3, 4);',
        'p.show();',
    ].join('\n'),
    collections: [
        'print = __builtin_print;',
        '',
        'list = {1, 2, 3, 4, 5};',
        'print(__builtin_get(list, 0));',
        '__builtin_push(list, 6);',
        'print(__builtin_len(list));',
        '',
        'map = {"a": 1, "b": 2, "c": 3};',
        'print(__builtin_get(map, "a"));',
        '__builtin_set(map, "d", 4);',
    ].join('\n'),
    operators: [
        'print = __builtin_print;',
        'infix + = (a, b) => __builtin_add(a, b);',
        'infix * = (a, b) => __builtin_mul(a, b);',
        'prefix(!) neg = (x) => __builtin_neg(x);',
        '',
        'x = 5;',
        'y = 3;',
        'print(x + y * 2);',
        'print(neg x + y);',
    ].join('\n'),
};

function loadExample(name) {
    if (!name || !examples[name]) return;
    var code = examples[name];
    var input = document.getElementById('codeInput');
    if (!input) return;
    input.value = code;
    syncHighlight();
    clearOutput();
}

// Syntax highlighting via overlay
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
