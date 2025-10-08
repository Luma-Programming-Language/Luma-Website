const toggle = document.getElementById('toggleDark');
const body = document.body;

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark-mode', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  // Toggle icon if present
  if (toggle) {
    toggle.classList.toggle('bi-moon', !isDark);
    toggle.classList.toggle('bi-brightness-high-fill', isDark);
  }

  // Footer link colors
  document.querySelectorAll('.footer-link').forEach(link => {
    link.style.color = isDark ? '#DCDDDE' : '#23272A';
    link.style.transition = 'color 2s';
  });
}

// === On load ===
window.addEventListener("DOMContentLoaded", () => {
  const isDark = localStorage.getItem("theme") === "dark";
  applyTheme(isDark);

  const toggleDesktop = document.getElementById('toggleDark');
  const toggleMobile = document.getElementById('toggleDarkMobile');
  if (toggleDesktop) {
    toggleDesktop.addEventListener('click', () => {
      const darkNow = document.documentElement.classList.contains('dark-mode');
      applyTheme(!darkNow);
    });
  }
  if (toggleMobile) {
    toggleMobile.addEventListener('click', () => {
      const darkNow = document.documentElement.classList.contains('dark-mode');
      applyTheme(!darkNow);
    });
  }

  const currentPath = window.location.pathname.replace(/\/$/, ""); // removes trailing slash
  const links = document.querySelectorAll(".nav-bar nav ul li a");

  links.forEach(link => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, "");
    if (linkPath === currentPath) {
      link.classList.add("active");
    }
  });

  const codeSelector = document.getElementById("codeSelector");
  if (codeSelector) {
    codeSelector.dispatchEvent(new Event("change"));
  }

  const docsContainer = document.getElementById("docs-container");
  if (docsContainer) {
    if (typeof marked === 'undefined') {
      docsContainer.innerHTML = "<p>❌ Marked library not loaded. Please check your internet connection.</p>";
      return;
    }

    docsContainer.innerHTML = "<p>Loading documentation...</p>";

    // ✅ Custom Admonition Block Support
    const admonitionExtension = {
      extensions: [{
        name: 'admonition',
        level: 'block',
        start(src) {
          return src.match(/^\[!\w+\]/)?.index;
        },
        tokenizer(src) {
          const match = src.match(/^\[!(\w+)\][ \t]*(.*?)\n((?:.+\n?)*)/);
          if (match) {
            return {
              type: 'admonition',
              kind: match[1].toLowerCase(),
              title: match[2].trim(),
              text: match[3].trim()
            };
          }
        },
        renderer(token) {
          const title = token.title || token.kind.toUpperCase();
          return `
            <div class="admonition admonition-${token.kind}">
              <div class="admonition-title">${title}</div>
              <div class="admonition-body">${marked.parse(token.text)}</div>
            </div>
          `;
        }
      }]
    };
    marked.use(admonitionExtension);

    const url = `https://raw.githubusercontent.com/TheDevConnor/Luma/refs/heads/main/docs/docs.md?t=${Date.now()}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then(md => {
        docsContainer.innerHTML = marked.parse(md);

        // Auto-link and scroll to headings
        docsContainer.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
          const id = heading.textContent.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
          heading.id = id;
          heading.innerHTML = `<a href="#${id}" class="anchor-link">${heading.innerHTML}</a>`;
          heading.style.scrollBehavior = 'smooth';
          heading.style.cursor = 'pointer';
          heading.addEventListener('click', () => {
            window.location.hash = `#${id}`;
          });
        });

        Prism.highlightAll();
      })
      .catch(err => {
        docsContainer.innerHTML = "<p>❌ Failed to load docs. Try again later.</p>";
        console.error("Error loading docs:", err);
      });
  }

  // ✅ Fetch latest GitHub release version and update DOM
  fetch("https://api.github.com/repos/TheDevConnor/Luma/releases/latest")
    .then(res => res.json())
    .then(data => {
      let versionRaw = data.tag_name || data.name || "";
      let versionClean = versionRaw.replace(/^Release-/, ''); // Remove 'Release-' prefix
      versionClean = versionClean.split('-')[0];

      if (!versionClean) {
        console.warn("⚠️ No valid version found in GitHub release data. Using fallback version.");
        versionClean = "v0.1.0"; // fallback
      }

      const heading = document.getElementById("version-heading");
      const versionSpan = heading?.querySelector(".version-number");
      if (versionSpan) {
        versionSpan.textContent = versionClean;
      }
    })
    .catch(err => {
      console.warn("⚠️ Failed to fetch GitHub release version:", err);

      // Fallback version if fetch fails
      const heading = document.getElementById("version-heading");
      const versionSpan = heading?.querySelector(".version-number");
      if (versionSpan) {
        versionSpan.textContent = "v0.1.0";
      }
    });
});

// === HAMBURGER MENU TOGGLE ===
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");

    hamburger.innerHTML = navLinks.classList.contains("active")
      ? '<i class="bi bi-x"></i>'
      : '<i class="bi bi-list"></i>';
  });
}

// === CODE SELECTOR ===
const selector = document.getElementById('codeSelector');
const examples = document.querySelectorAll('.code-example');

if (selector && examples.length > 0) {
  selector.addEventListener('change', function () {
    examples.forEach(el => el.style.display = 'none');
    const selected = document.getElementById(this.value);
    if (selected) selected.style.display = 'block';
  });
}

// ====== LUMA CODE EXAMPLES ======
const codeSamples = {
  "Hello-World": `@module "main"

pub const main = fn () int {
  let person: [str; 7] = ["Software Dev", "Compiler Dev", 
                        "Low-Level Dev", "C Dev", 
                        "Rust Dev", "Zig Dev", "Zura Dev"];
  loop [i: int = 0](i < 7) : (++i) {
    output("Hello there, ", person[i], "!");
  }
  return 0;
}`,

  "Variables-and-Types": `@module "main"

pub const main = fn () int {
  // Primitive types
  let x: int = 42;              // Signed 64-bit integer
  let y: uint = 100;            // Unsigned 64-bit integer
  let pi: float = 3.14159;      // 32-bit float
  let e: double = 2.71828;      // 64-bit double
  let is_valid: bool = true;    // Boolean
  let initial: char = cast<char>(65);  // Character
  let message: str = "Hello, Luma!";   // String
  
  outputln("Integer: ", x);
  outputln("Float: ", pi);
  outputln("Boolean: ", is_valid);
  outputln("Message: ", message);
  
  return 0;
}`,

  "Enums-and-Switch": `@module "main"

const Status = enum {
  Active,
  Inactive,
  Pending,
};

const WeekDay = enum {
  Sunday,
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
};

const check_status = fn (s: Status) void {
  switch (s) {
    Status::Active => outputln("System is running");
    Status::Inactive => outputln("System is stopped");
    Status::Pending => outputln("System is starting");
  }
}

const classify_day = fn (day: WeekDay) void {
  switch (day) {
    WeekDay::Monday, WeekDay::Tuesday, WeekDay::Wednesday, 
    WeekDay::Thursday, WeekDay::Friday =>
      outputln("Weekday");
    WeekDay::Saturday, WeekDay::Sunday =>
      outputln("Weekend");
  }
}

pub const main = fn () int {
  let current: Status = Status::Active;
  check_status(current);
  
  classify_day(WeekDay::Saturday);
  
  return 0;
}`,

  "Structs": `@module "main"

const Point = struct {
  x: int,
  y: int,
};

const Player = struct {
pub:
  name: str,
  score: int,
priv:
  internal_id: uint,
};

pub const main = fn () int {
  // Create a point
  let origin: Point = Point { x: 0, y: 0 };
  let destination: Point = Point { x: 10, y: 20 };
  
  outputln("Origin: (", origin.x, ", ", origin.y, ")");
  outputln("Destination: (", destination.x, ", ", destination.y, ")");
  
  // Create a player
  let player: Player = Player {
    name: "Alice",
    score: 1000,
    internal_id: 12345,
  };
  
  outputln("Player: ", player.name);
  outputln("Score: ", player.score);
  
  return 0;
}`,

  "Control-Flow": `@module "main"

pub const main = fn () int {
  // If-elif-else
  let x: int = 7;
  if x > 10 {
    outputln("Large number");
  } elif x > 5 {
    outputln("Medium number");
  } else {
    outputln("Small number");
  }
  
  // For-style loop
  outputln("Counting to 5:");
  loop [i: int = 0](i < 5) : (++i) {
    outputln("  ", i);
  }
  
  // While-style loop
  outputln("Countdown from 3:");
  let counter: int = 3;
  loop (counter >= 0) : (--counter) {
    outputln("  ", counter);
  }
  
  // Infinite loop with break
  let count: int = 0;
  loop {
    if count >= 3 {
      break;
    }
    outputln("Loop iteration: ", count);
    ++count;
  }
  
  return 0;
}`,

  "Functions": `@module "main"

const add = fn (a: int, b: int) int {
  return a + b;
}

const fibonacci = fn (n: int) int {
  if n <= 1 {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const greet = fn (name: str) void {
  outputln("Hello, ", name, "!");
}

const swap = fn (a: *int, b: *int) void {
  let temp: int = *a;
  *a = *b;
  *b = temp;
}

pub const main = fn () int {
  // Basic function call
  let sum: int = add(5, 10);
  outputln("5 + 10 = ", sum);
  
  // Recursive function
  let fib: int = fibonacci(10);
  outputln("Fibonacci(10) = ", fib);
  
  // Void function
  greet("Luma Developer");
  
  // Pointer function
  let x: int = 5;
  let y: int = 10;
  outputln("Before swap: x=", x, ", y=", y);
  swap(&x, &y);
  outputln("After swap: x=", x, ", y=", y);
  
  return 0;
}`,

  "Memory-Management": `@module "main"

#returns_ownership
const create_buffer = fn (size: int) *int {
  let buffer: *int = cast<*int>(alloc(size * sizeof<int>));
  return buffer;
}

pub const main = fn () int {
  // Allocate memory
  let ptr: *int = cast<*int>(alloc(sizeof<int>));
  defer free(ptr);
  
  // Use the memory
  *ptr = 42;
  outputln("Value: ", *ptr);
  
  // Create buffer with ownership transfer
  let buffer: *int = create_buffer(10);
  defer free(buffer);
  
  // Initialize buffer
  loop [i: int = 0](i < 10) : (++i) {
    buffer[i] = i * 2;
  }
  
  // Print buffer contents
  outputln("Buffer contents:");
  loop [i: int = 0](i < 10) : (++i) {
    outputln("  buffer[", i, "] = ", buffer[i]);
  }
  
  // Memory freed automatically via defer
  return 0;
}`,

  "Module-System": `# File: math.lx
@module "math"

pub const PI: float = 3.14159265359;

pub const sqrt = fn (x: float) float {
  // Simplified implementation
  return x;
}

pub const pow = fn (base: float, exp: int) float {
  let result: float = 1.0;
  loop [i: int = 0](i < exp) : (++i) {
    result = result * base;
  }
  return result;
}

// File: main.lx
@module "main"

@use "math" as math

pub const main = fn () int {
  let radius: float = 5.0;
  let area: float = math::PI * math::pow(radius, 2);
  
  outputln("Circle radius: ", radius);
  outputln("Circle area: ", area);
  
  let root: float = math::sqrt(16.0);
  outputln("Square root of 16: ", root);
  
  return 0;
}`,

  "Generics": `@module "main"

// Generic functions (not yet implemented)
const add = fn<T>(a: T, b: T) T {
  return a + b;
}

const max = fn<T>(a: T, b: T) T {
  if a > b {
    return a;
  }
  return b;
}

// Generic structs (not yet implemented)
const Box = struct<T> {
  value: T,
  
  get = fn() T {
    return value;
  },
  
  set = fn(new_value: T) void {
    value = new_value;
  }
};

const Pair = struct<T, U> {
  first: T,
  second: U,
};

pub const main = fn () int {
  // Generic function usage
  outputln("add<int>(5, 10) = ", add<int>(5, 10));
  outputln("add<float>(3.14, 2.86) = ", add<float>(3.14, 2.86));
  
  let largest: int = max<int>(42, 17);
  outputln("max(42, 17) = ", largest);
  
  // Generic struct usage
  let int_box: Box<int> = Box { value: 42 };
  outputln("Box contains: ", int_box.get());
  
  let pair: Pair<int, str> = Pair {
    first: 1,
    second: "hello",
  };
  outputln("Pair: (", pair.first, ", ", pair.second, ")");
  
  return 0;
}`,
};

const codeSelector = document.getElementById("codeSelector");
if (codeSelector) {
  codeSelector.addEventListener("change", (e) => {
    const selected = e.target.value;
    const codeElement = document.getElementById("codeOutput");
    if (codeElement) {
      // Update text content
      codeElement.textContent = codeSamples[selected] || "";

      // Make sure the language class is set on <code>
      codeElement.className = "language-zura";

      // Trigger Prism to highlight
      Prism.highlightElement(codeElement);
    }
  });
}