---
summary: A real program is hundreds of files. Modules let each file keep its own names private and share only what it chooses. JavaScript has two module systems, and knowing how they differ explains a whole class of confusing errors.
time: 30
needs: js-closures, js-errors
---
## The problem this solves

In the early web every `<script>` file shared one global scope. Two files that both declared `var user` silently overwrote each other, and the only way to know what a file needed was to read all of it. A **module** fixes both problems:

- every file has its **own scope**; nothing leaks unless exported;
- every file **states its dependencies** at the top with imports.

| | CommonJS (CJS) | ES modules (ESM) |
| --- | --- | --- |
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Came from | Node.js, 2009 | the language standard, 2015 |
| Loading | synchronous, at run time, when the line executes | resolved before running; asynchronous |
| Can be conditional | yes, `require` is an ordinary function call | static `import` must be top-level; `import()` for dynamic |
| What you receive | a **copy** of the exported value at that moment | a **live binding** to the exporter's variable |
| Used in Node when | file is `.cjs`, or `.js` with no `"type": "module"` | file is `.mjs`, or `.js` with `"type": "module"` in package.json |
| Browsers | no (needs a bundler) | yes, `<script type="module">` |

## Step 1: CommonJS

```js file=math.cjs
const PI = 3.14159;
const secret = 'not exported, invisible outside this file';

function circleArea(r) { return PI * r * r; }
function square(n) { return n * n; }

module.exports = { circleArea, square };
```

```js run
const math = require('./math.cjs');
const { square } = require('./math.cjs');

console.log(math.circleArea(2), square(5));
console.log(Object.keys(math), typeof secret);
```

**What happened.** `require` runs the file and returns whatever it assigned to `module.exports`. `secret` was never exported, so it does not exist here (`typeof` gives `'undefined'`).

**How Node does it.** Node wraps each file in a function before running it:

```js
(function (exports, require, module, __filename, __dirname) {
  // your file's code
});
```

That is why a file's variables are private: they are local variables of a function ([[js-closures]]). And it is where `require`, `module` and `__dirname` come from; they are parameters, not globals.

### Twist: a module runs once

```js file=counter.cjs
console.log('  (counter.cjs is being executed)');
let count = 0;
module.exports = { increment: () => ++count, current: () => count };
```

```js run
const a = require('./counter.cjs');
const b = require('./counter.cjs');

a.increment(); a.increment();
console.log('same object:', a === b, '| b sees:', b.current());
```

The file's code ran **once**. Node keeps a cache keyed by the file's full path, and every later `require` gets the same exports object. So module-level state is shared by everyone who imports it. This is why a database connection created in one module is naturally a single shared instance (the Singleton idea in [[lld-creational]]).

## Step 2: ES modules

```js file=shapes.mjs
export const sides = { triangle: 3, square: 4 };
export function perimeter(shape, length) { return sides[shape] * length; }
export default function describe(shape) { return `a ${shape} has ${sides[shape]} sides`; }
```

```js run=main.mjs
import describe, { perimeter, sides as SIDES } from './shapes.mjs';
import * as shapes from './shapes.mjs';

console.log(describe('triangle'));
console.log(perimeter('square', 5), SIDES.square);
console.log(Object.keys(shapes));
```

| Export kind | Export | Import | Rule |
| --- | --- | --- | --- |
| Named | `export const x`, `export function f` | `import { x, f } from` | names must match (rename with `as`); many per file |
| Default | `export default ...` | `import anyName from` | one per file; the importer picks the name |
| Everything | | `import * as ns from` | an object of all exports |

Prefer named exports: the name is fixed, so editors can find and rename every use, and a typo is an error instead of a silent `undefined`.

### Twist: live bindings vs copies

```js file=live.mjs
export let count = 0;
export function increment() { count++; }
```

```js run=live-main.mjs
import { count, increment } from './live.mjs';
console.log('before:', count);
increment();
console.log('after :', count, ' <- the imported name tracks the exporter\'s variable');
try { count = 99; } catch (e) { console.log(e.name + ': imports are read-only'); }
```

An ESM import is a **live, read-only view** of the exporting module's variable. In CommonJS, `const { count } = require(...)` copies the number at that moment and never updates.

### Twist: imports are hoisted and static

```js file=hoisted-dep.mjs
console.log('  dependency runs first, even though its import is on line 2 of main');
```

```js run=hoist.mjs
console.log('main starts');
import './hoisted-dep.mjs';
console.log('main ends');
```

**All static imports are resolved and executed before any line of the importing file**, wherever they are written. Because imports are static, tools can know the full dependency graph without running anything. That enables **tree shaking**: a bundler removes exports nobody imports.

For loading on demand, use the dynamic form, which returns a promise:

```js run=dynamic.mjs
const wantsCharts = true;
if (wantsCharts) {
  const { perimeter } = await import('./shapes.mjs');
  console.log('loaded only when needed:', perimeter('triangle', 2));
}
```

`import()` is how code splitting works in React ([[react-performance]]). Note the bare `await` at the top level, which ES modules allow.

## Step 3: circular dependencies

```js file=a.cjs
exports.loaded = false;
const b = require('./b.cjs');
console.log('  in a: b.loaded =', b.loaded);
exports.loaded = true;
```

```js file=b.cjs
exports.loaded = false;
const a = require('./a.cjs');
console.log('  in b: a.loaded =', a.loaded, '(a is only half finished)');
exports.loaded = true;
```

```js run
const a = require('./a.cjs');
console.log('main: a.loaded =', a.loaded);
```

`a` requires `b`, which requires `a`. Node does not loop forever: when `b` asks for `a`, it receives `a`'s exports **as they are so far**, which is the unfinished object. This is the cause of the classic "it is `undefined` here but works elsewhere" bug. The fix is structural: move the shared part into a third module that both import.

## Step 4: what a bundler does

Browsers can load ES modules directly, but a real app has thousands of small files, and fetching each one separately is slow. A **bundler** (Vite, webpack, esbuild, Rollup) reads your entry file, follows every import to build the dependency graph, and outputs a few optimized files.

| Step | What it does |
| --- | --- |
| Resolve | find each imported file, including packages in `node_modules` |
| Transform | compile JSX and TypeScript, convert newer syntax for older browsers |
| Tree-shake | drop exports that are never imported |
| Split | separate chunks for routes and dynamic imports |
| Minify | shorten names, remove whitespace |

`package.json` is the manifest: `dependencies` (needed to run), `devDependencies` (needed to build and test), `scripts`, and `"type": "module"` to make `.js` files ES modules. `package-lock.json` pins exact versions so every machine installs the same thing.

!!! key
- Modules give each file its own scope and explicit dependencies.
- CJS: `require` is a synchronous function call, exports are an object, values are copied. ESM: static `import`, live read-only bindings, asynchronous, tree-shakeable.
- A module's code runs once and is cached. Module-level variables are shared state.
- Node wraps CJS files in a function; that is where `require`, `module`, `__dirname` come from. ES modules have no `__dirname`; use `import.meta.url` or `import.meta.dirname`.
- Named exports over default exports.
- Dynamic `import()` returns a promise and enables code splitting.
!!!

!!! trap
- `exports = { a }` does nothing: it rebinds the local parameter. Use `module.exports = { a }` or `exports.a = a`.
- Mixing systems: `require` is not defined in an ES module; `import` statements fail in a CommonJS file. Check the file extension and `"type"`.
- Importing a default as a named export or the reverse: you get `undefined` or an error.
- Circular imports giving half-initialized modules.
- Forgetting the file extension in Node ESM: `import './util'` fails; it must be `'./util.js'`.
!!!

!!! twist What changes if...
- **...an ES module needs a CommonJS package?** `import pkg from 'cjs-package'` works: the whole `module.exports` arrives as the default export.
- **...a CommonJS file needs an ES module?** Use `await import('esm-package')`. Recent Node versions also allow `require()` of ES modules that have no top-level `await`.
- **...you want the cache cleared (for tests)?** `delete require.cache[require.resolve('./file')]` in CJS. ESM has no supported way; restructure to pass dependencies in.
!!!

!!! model
A module is a room with a door. Everything inside is private; exports are what you pass out through the door; imports are what you ask other rooms for. Each room is built once and shared.
!!!

## Practice

?? What is the difference between `module.exports` and `exports`?
`exports` starts as a reference to the same object as `module.exports`. Adding properties (`exports.a = 1`) works because both names point to that object. Assigning a new value to `exports` only changes the local variable; `require` returns `module.exports`, so the assignment is lost.

```js file=broken-exports.cjs
exports = { lost: true };
exports.alsoLost = true;
module.exports.kept = true;
```

```js run
console.log(require('./broken-exports.cjs'));
```
??

?? Why can bundlers tree-shake ES modules but not CommonJS reliably?
ES `import` and `export` are static declarations at the top level, so a tool can list exactly which names are used without running code. `require` is a function call that can appear inside an `if`, take a computed string, or have its result passed around, so usage cannot be determined in general.
??

?? A config module creates a database connection at the top level. It is imported in 20 files. How many connections are opened?
One. The module's code runs on the first import, and the cached exports are returned for the other 19.
??

?? How do you load a heavy library only when the user opens a certain page?
`const { default: Chart } = await import('chart-library')` inside the code that runs for that page. The bundler puts it in a separate chunk that is downloaded on first use. In React, `React.lazy(() => import('./ChartPage'))` with `Suspense` does this per component.
??

?? What are `dependencies`, `devDependencies` and the lock file for?
`dependencies` are needed when the app runs (express, mongoose). `devDependencies` are needed only to develop, build or test (a bundler, a test runner). The lock file records the exact resolved version of every package in the tree so installs are reproducible.
??
