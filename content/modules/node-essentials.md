---
summary: Node lets JavaScript leave the browser. It can read files, start servers and run programs. This station covers the everyday toolkit, files and paths, configuration through the environment, and npm.
time: 35
needs: js-modules, node-http-basics
---
## The problem this solves

In a browser, JavaScript is sandboxed: it cannot read your disk or open a server port, for good security reasons. A backend needs exactly those powers. **Node.js** is the JavaScript engine from Chrome (V8) packaged with APIs for the operating system: files, network, processes. Same language, different surroundings.

| | Browser | Node |
| --- | --- | --- |
| Global object | `window` | `globalThis` / `global` |
| Has | `document`, DOM, `localStorage` | `fs`, `http`, `process`, `path`, `child_process` |
| Does not have | file system, raw sockets | DOM, `window`, `alert` |
| Both have | `console`, `setTimeout`, `fetch`, `URL`, promises | |

## Step 1: the `process` object

```js run
const path = require('path');

console.log('node major version      :', process.versions.node.split('.')[0]);
console.log('arguments after the file:', process.argv.slice(2));
console.log('started from folder     :', path.basename(process.cwd()));
console.log('an environment variable :', 'HOME' in process.env ? 'HOME is set' : 'HOME is not set');

process.on('exit', code => console.log('exiting with code', code));
```

`process` is your program's view of itself: its arguments (`process.argv`), its environment (`process.env`), where it was started (`process.cwd()`), and events about its life. An **exit code** of 0 means success; anything else means failure, which is how scripts and CI systems know a step broke.

## Step 2: files

```js run
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'notes-'));
  const file = path.join(dir, 'todo.txt');

  await fs.writeFile(file, 'buy milk\n');
  await fs.appendFile(file, 'learn node\n');
  const text = await fs.readFile(file, 'utf8');
  console.log(JSON.stringify(text));
  console.log(text.trim().split('\n'));

  const info = await fs.stat(file);
  console.log('size:', info.size, 'bytes | is file:', info.isFile());
  console.log('folder contains:', await fs.readdir(dir));

  try { await fs.readFile(path.join(dir, 'missing.txt'), 'utf8'); }
  catch (e) { console.log('missing file ->', e.code); }

  await fs.rm(dir, { recursive: true });
})();
```

**What happened.** `fs/promises` gives file functions that return promises, so `await` works ([[js-promises]]). Without `'utf8'`, `readFile` returns raw bytes (a `Buffer`) instead of text. A missing file rejects with an error whose `code` is `'ENOENT'` ("no such entry"), the code you check for instead of matching on the message ([[js-errors]]).

**The three flavours of every fs function.**

| Flavour | Example | Use |
| --- | --- | --- |
| Promise | `await fs.promises.readFile(p)` | the default in modern code |
| Callback | `fs.readFile(p, (err, data) => {})` | older code; same behaviour |
| Synchronous | `fs.readFileSync(p)` | only at startup or in scripts. In a server it **blocks every other request** until the disk answers ([[node-runtime]]) |

### Twist: JSON files as a tiny database

```js run
const fs = require('fs/promises'), path = require('path'), os = require('os');

async function createStore(file) {
  const read = async () => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } };
  return {
    all: read,
    add: async item => { const items = await read(); items.push({ id: items.length + 1, ...item }); await fs.writeFile(file, JSON.stringify(items, null, 2)); return items.at(-1); },
  };
}
(async () => {
  const file = path.join(os.tmpdir(), `store-${process.pid}.json`);
  const store = await createStore(file);
  console.log(await store.all());
  await store.add({ title: 'first' });
  console.log(await store.add({ title: 'second' }));
  console.log((await fs.readFile(file, 'utf8')).split('\n').length, 'lines of pretty JSON on disk');
  await fs.rm(file);
})();
```

Good for learning and small scripts. It breaks down with two simultaneous writers (one overwrites the other) and with large data (the whole file is rewritten each time), which is why real applications use a database ([[mongo-modeling]]).

## Step 3: paths

```js run
const path = require('path');

console.log(path.join('uploads', 'images', '..', 'avatar.png'));
console.log(path.basename('/srv/app/uploads/avatar.png'), path.extname('avatar.final.png'), path.dirname('/srv/app/uploads/avatar.png'));
console.log(path.isAbsolute('./data.json'), path.isAbsolute('/etc/hosts'));
console.log(__filename.endsWith('.js'), path.basename(__dirname));

const uploads = path.resolve('/srv/app/uploads');
for (const name of ['photo.png', '../../etc/passwd']) {
  const target = path.resolve(uploads, name);
  console.log(name.padEnd(18), target.startsWith(uploads + path.sep) ? 'allowed' : 'REJECTED (escapes the uploads folder)');
}
```

- **Never build paths with `+`.** Windows uses `\`, Linux and macOS use `/`. `path.join` uses the right separator and cleans up `..`.
- A **relative** path (`./data.json`) is resolved from `process.cwd()`, the folder the command was run in, which is not necessarily the folder the file is in. For files that ship with your code, build the path from `__dirname` (CommonJS) or `import.meta.dirname` (ES modules, [[js-modules]]).
- The last three lines are a security check. If a user controls part of a file path, `../` lets them climb out of the intended folder (**path traversal**). Resolve the final path and confirm it is still inside the allowed directory.

## Step 4: configuration through environment variables

The same code runs on your laptop, on a test server and in production, with different database addresses and secrets in each. Those values must come from **outside the code**.

```js run
process.env.PORT = '4000';
process.env.DATABASE_URL = 'mongodb://localhost/dev';

function loadConfig(env) {
  const required = name => { if (!env[name]) throw new Error(`missing required environment variable ${name}`); return env[name]; };
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    isProduction: env.NODE_ENV === 'production',
  };
}

try { loadConfig(process.env); } catch (e) { console.log('startup stopped:', e.message); }
process.env.JWT_SECRET = 'dev-only-secret';
const config = loadConfig(process.env);
console.log({ ...config, jwtSecret: '<hidden>' });
console.log(typeof process.env.PORT, typeof config.port);
```

| Rule | Why |
| --- | --- |
| Read `process.env` in **one** config module | every other file imports typed, validated values |
| Validate at startup and **crash if something is missing** | a clear error at boot beats a mysterious failure at 3 a.m. |
| Everything in `process.env` is a **string** | convert numbers and booleans yourself |
| Keep secrets in a `.env` file locally and **never commit it** | add `.env` to `.gitignore`; commit a `.env.example` listing the names |
| In production, the platform injects the variables | Vercel, Render, Docker and Kubernetes all have a settings screen or secret store for this |

Node can load a `.env` file itself with `node --env-file=.env app.js`; the `dotenv` package does the same for older versions.

## Step 5: npm and package.json

`npm` (Node Package Manager) installs code other people published and runs your project's scripts.

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.js",
    "start": "node src/server.js",
    "test": "node --test"
  },
  "dependencies": { "express": "^5.1.0" },
  "devDependencies": { "eslint": "^9.0.0" }
}
```

| Command | Does |
| --- | --- |
| `npm init -y` | creates `package.json` |
| `npm install express` | downloads it into `node_modules/` and records it under `dependencies` |
| `npm install -D eslint` | records it under `devDependencies` (needed to develop, not to run) |
| `npm install` | installs everything listed, using the lock file |
| `npm ci` | clean install of **exactly** the lock file; what CI and production builds use |
| `npm run dev` | runs the `dev` script (`npm start` and `npm test` need no `run`) |
| `npx some-tool` | runs a package's command without installing it globally |

**Version numbers** are `major.minor.patch` (semantic versioning): patch for fixes, minor for new backward-compatible features, major for breaking changes.

```js run
function satisfies(version, range) {
  const [maj, min, pat] = version.split('.').map(Number);
  const [rMaj, rMin, rPat] = range.slice(1).split('.').map(Number);
  if (range[0] === '^') return maj === rMaj && (min > rMin || (min === rMin && pat >= rPat));
  if (range[0] === '~') return maj === rMaj && min === rMin && pat >= rPat;
}
for (const v of ['5.1.0', '5.1.9', '5.4.0', '6.0.0'])
  console.log(v, '| ^5.1.0:', String(satisfies(v, '^5.1.0')).padEnd(5), '| ~5.1.0:', satisfies(v, '~5.1.0'));
```

`^5.1.0` accepts any 5.x at or above 5.1.0. `~5.1.0` accepts only 5.1.x. Because a range can resolve to different versions on different days, **`package-lock.json` records the exact versions installed** and must be committed. `node_modules` is never committed.

## Step 6: a sensible project layout

```text
notes-api/
  src/
    server.js          starts listening (the only file that calls listen)
    app.js             builds and exports the Express app
    config.js          reads and validates process.env
    routes/            URL to controller mapping
    controllers/       HTTP in, HTTP out
    services/          business rules, no req/res
    models/            database access
    middleware/        auth, validation, error handler
  test/
  .env                 local secrets, not committed
  .env.example         the variable names, committed
  .gitignore           node_modules, .env
  package.json
  package-lock.json
```

Splitting `app.js` (builds the app) from `server.js` (starts it) lets tests import the app without opening a port ([[node-testing]]). The layers are explained in [[express-middleware]].

!!! key
- Node = V8 + operating system APIs. No DOM; yes files, network and processes.
- `fs/promises` with `await`; never the `Sync` versions inside request handlers.
- Build paths with `path.join`/`path.resolve`; anchor to `__dirname`, not the working directory.
- Configuration and secrets come from environment variables, read and validated in one place.
- `dependencies` vs `devDependencies`; commit the lock file, ignore `node_modules` and `.env`.
- `^` allows minor and patch updates, `~` patch only.
!!!

!!! trap
- Committing `.env` or pasting a secret in code. Once pushed, treat the secret as leaked and rotate it.
- `process.env.PORT || 3000` used in maths without `Number()`.
- A relative path that works when you run from the project root and fails when run from elsewhere.
- Using a user-supplied file name directly in a path.
- `npm install` in CI instead of `npm ci`, which can silently install different versions.
!!!

!!! twist What changes if...
- **...you need to run another program (a compiler, ffmpeg)?** `child_process.spawn` starts it as a separate process and gives you its output streams. The online judge runs submissions this way, inside a sandbox.
- **...the file is huge?** Read it as a stream or line by line with `readline` instead of `readFile` ([[node-runtime]]).
- **...you want the server to restart when you save?** `node --watch app.js` is built in; `nodemon` is the older tool.
- **...a dependency has a security hole?** `npm audit` lists known vulnerabilities; update, and keep the dependency list short.
!!!

!!! model
Node hands JavaScript the keys to the machine. `process` is who you are, `fs` and `path` are the disk, `process.env` is how the outside world configures you, and `package.json` is the list of what you need and how to start.
!!!

## Practice

?? Write a script that prints the number of lines, words and characters in a file given as a command-line argument.
```js run
const fs = require('fs/promises'), path = require('path'), os = require('os');
async function count(file) {
  const text = await fs.readFile(file, 'utf8');
  return { lines: text.split('\n').length, words: text.split(/\s+/).filter(Boolean).length, characters: text.length };
}
(async () => {
  const sample = path.join(os.tmpdir(), `sample-${process.pid}.txt`);
  await fs.writeFile(sample, 'the quick brown fox\njumps over\nthe lazy dog');
  console.log(await count(process.argv[2] ?? sample));
  await fs.rm(sample);
})();
```
Run as `node count.js notes.txt`. `process.argv[0]` is the node binary, `[1]` is the script, and real arguments start at `[2]`.
??

?? Why should a server never call `fs.readFileSync` inside a request handler?
The call blocks the single JavaScript thread until the disk responds. During that time no other request can be accepted or answered. With the async version, the read happens in libuv's thread pool and the event loop keeps serving others ([[node-runtime]]).
??

?? Your app works locally and crashes in production with "cannot read properties of undefined (reading 'split')" on `process.env.ALLOWED_ORIGINS.split(',')`. What went wrong and how do you prevent it?
The variable was not set in the production environment. Validate all required variables in the config module at startup and fail immediately with a message naming the missing variable.
??

?? What is the difference between `npm install` and `npm ci`?
`npm install` resolves version ranges and may update the lock file. `npm ci` deletes `node_modules` and installs exactly what the lock file says, failing if `package.json` and the lock file disagree. Use `ci` for reproducible builds.
??

?? `path.join('/uploads', userInput)` with `userInput = '../../etc/passwd'`. What is the result and how do you defend against it?
`/etc/passwd`: the `..` segments climb out of `/uploads`. Resolve the final path, check that it starts with the allowed directory plus a separator, and reject otherwise. Better still, never use user-provided names on disk; generate your own (a UUID) and store the original name in the database.
??
