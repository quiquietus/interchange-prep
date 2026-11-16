---
summary: Express removes the chores from a raw Node server. This station builds a complete small API step by step. Routes, reading input, sending responses, and splitting the code into files.
time: 40
needs: node-http-basics, node-essentials
---
## The problem this solves

In [[node-http-basics]] you wrote a server by hand. Three chores appeared in every route: matching the method and path with `if` statements, collecting body chunks and parsing JSON, and writing headers before sending. With fifty routes that code is unmanageable. **Express** is a small library that does those chores so each route is only its own logic.

```js run
const express = require('express');
const app = express();

app.get('/hello', (req, res) => {
  res.json({ message: 'hello from express' });
});

const server = app.listen(0, async () => {
  const res = await fetch(`http://localhost:${server.address().port}/hello`);
  console.log(res.status, res.headers.get('content-type'), await res.json());
  server.close(); server.closeAllConnections();
});
```

Compare with the raw version: no `if` on the method, no `writeHead`, no `JSON.stringify`. `app.get(path, handler)` registers a **route**; `res.json(value)` sets the header, converts and sends.

In your own project you would write `app.listen(3000)` and open `http://localhost:3000/hello` in a browser. The examples here use port `0` (any free port) and call themselves with `fetch`, so that the output you see is real.

## Step 1: the request object, three places input arrives

```js run
const express = require('express');
const app = express();
app.use(express.json());

app.get('/users/:userId/orders/:orderId', (req, res) => res.json({ params: req.params }));
app.get('/search', (req, res) => res.json({ query: req.query }));
app.post('/echo', (req, res) => res.json({ body: req.body, contentType: req.get('content-type') }));

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  console.log(await (await fetch(base + '/users/7/orders/42')).json());
  console.log(await (await fetch(base + '/search?q=keyboard&maxPrice=3000&tag=usb&tag=rgb')).json());
  console.log(await (await fetch(base + '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Asha', age: 22 }) })).json());
  server.close(); server.closeAllConnections();
});
```

| Input | Where in the request | Read with | Always a string? |
| --- | --- | --- | --- |
| Path parameters | `/users/:userId` in the URL path | `req.params.userId` | yes |
| Query string | after `?` | `req.query.q` | yes (or an array if repeated, like `tag`) |
| Body | sent with POST, PUT, PATCH | `req.body` | no; JSON keeps numbers and booleans |
| Headers | metadata | `req.get('name')` | yes |

`app.use(express.json())` is what fills `req.body`. It is a **middleware**: a function that runs before your routes on every request. The mechanism is the subject of [[express-middleware]]; for now, remember it must come **before** the routes.

**Twist: forget `express.json()`.**

```js run
const express = require('express');
const app = express();
app.post('/echo', (req, res) => res.json({ bodyIs: typeof req.body }));
const server = app.listen(0, async () => {
  const res = await fetch(`http://localhost:${server.address().port}/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
  console.log(await res.json());
  server.close(); server.closeAllConnections();
});
```

`req.body` is `undefined`. This is the first bug almost everyone hits.

## Step 2: the response object

```js run
const express = require('express');
const app = express();

app.get('/json', (req, res) => res.json({ ok: true }));
app.get('/text', (req, res) => res.send('plain text'));
app.get('/created', (req, res) => res.status(201).location('/things/9').json({ id: 9 }));
app.get('/empty', (req, res) => res.status(204).end());
app.get('/old-page', (req, res) => res.redirect(301, '/json'));
app.get('/missing', (req, res) => res.status(404).json({ error: 'not here' }));

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  for (const path of ['/json', '/text', '/created', '/empty', '/old-page', '/missing', '/no-such-route']) {
    const res = await fetch(base + path, { redirect: 'manual' });
    const type = (res.headers.get('content-type') || '-').split(';')[0];
    console.log(path.padEnd(15), res.status, type.padEnd(17), res.headers.get('location') ?? '', (await res.text()).slice(0, 40).replace(/\n/g, ' '));
  }
  server.close(); server.closeAllConnections();
});
```

`res.status(code)` returns `res`, so calls chain. Note the `/text` row: `res.send` with a string labels it `text/html`; use `res.type('text/plain').send(...)` when you mean plain text. The last line shows what Express does when no route matches: a 404 with an HTML page. An API should return JSON there instead, which you will add below.

**The rule: each request gets exactly one response.** After `res.json`, `res.send`, `res.end` or `res.redirect`, the request is over.

## Step 3: a complete CRUD API

CRUD is the four basic operations on data: **C**reate, **R**ead, **U**pdate, **D**elete. Here they are for a list of tasks kept in memory.

```js run
const express = require('express');
const app = express();
app.use(express.json());

let tasks = [{ id: 1, title: 'learn express', done: false }];
let nextId = 2;
const findTask = (req, res) => {
  const task = tasks.find(t => t.id === Number(req.params.id));
  if (!task) res.status(404).json({ error: 'task not found' });
  return task;
};

app.get('/tasks', (req, res) => {
  const { done } = req.query;
  res.json(done === undefined ? tasks : tasks.filter(t => String(t.done) === done));
});
app.get('/tasks/:id', (req, res) => { const task = findTask(req, res); if (task) res.json(task); });
app.post('/tasks', (req, res) => {
  const title = req.body?.title?.trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});
app.patch('/tasks/:id', (req, res) => {
  const task = findTask(req, res); if (!task) return;
  if (typeof req.body.done === 'boolean') task.done = req.body.done;
  if (typeof req.body.title === 'string') task.title = req.body.title;
  res.json(task);
});
app.delete('/tasks/:id', (req, res) => {
  const task = findTask(req, res); if (!task) return;
  tasks = tasks.filter(t => t !== task);
  res.status(204).end();
});
app.use((req, res) => res.status(404).json({ error: `no route for ${req.method} ${req.path}` }));

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    console.log(method.padEnd(6), path.padEnd(18), res.status, await res.text());
  };
  await call('POST', '/tasks', { title: 'write notes' });
  await call('POST', '/tasks', { title: '   ' });
  await call('GET', '/tasks');
  await call('PATCH', '/tasks/2', { done: true });
  await call('GET', '/tasks?done=true');
  await call('DELETE', '/tasks/1');
  await call('GET', '/tasks/1');
  await call('GET', '/nothing');
  server.close(); server.closeAllConnections();
});
```

**Read the routes as a pattern.** Each one does the same four things in the same order:

1. **Read input** from `params`, `query` or `body`.
2. **Check it.** If it is wrong, respond with a 4xx and `return`.
3. **Do the work.**
4. **Respond** with the right status: 200 for a read or update, 201 for a create, 204 for a delete, 404 when the thing does not exist.

Notice `return res.status(400)...`. Without `return`, the function would continue and try to respond a second time.

The final `app.use(...)` has no path, so it matches anything that reached it, meaning no route above answered. That is the JSON 404 handler.

**What is wrong with this version** (on purpose, each fixed in a later station):

| Weakness | Fixed in |
| --- | --- |
| Data vanishes when the server restarts | a database: [[mongo-modeling]] |
| Validation is hand-written and thin | [[node-validation-security]] |
| An unexpected error would crash or hang the request | error middleware: [[express-middleware]] |
| Anyone can delete anything | [[auth-jwt]] |
| No tests | [[node-testing]] |
| Everything is in one file | Step 4, next |

## Step 4: split it into files with a Router

One file with every route does not scale. An `express.Router()` is a mini-app that holds a group of routes and can be mounted under a path.

```js file=tasks.routes.js
const express = require('express');
const router = express.Router();

const tasks = [{ id: 1, title: 'learn routers', done: false }];

router.get('/', (req, res) => res.json(tasks));
router.get('/:id', (req, res) => {
  const task = tasks.find(t => t.id === Number(req.params.id));
  task ? res.json(task) : res.status(404).json({ error: 'task not found' });
});

module.exports = router;
```

```js file=app.js
const express = require('express');
const tasksRouter = require('./tasks.routes');

const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/tasks', tasksRouter);
app.use((req, res) => res.status(404).json({ error: 'route not found' }));

module.exports = app;
```

```js run
const app = require('./app');

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  for (const path of ['/health', '/api/tasks', '/api/tasks/1', '/api/tasks/9', '/tasks']) {
    const res = await fetch(base + path);
    console.log(path.padEnd(14), res.status, JSON.stringify(await res.json()));
  }
  server.close(); server.closeAllConnections();
});
```

Three files, three jobs:

- **`tasks.routes.js`** knows about tasks. Its paths are written relative to wherever it is mounted (`/` and `/:id`).
- **`app.js`** assembles the application: global middleware, then each router under its prefix, then the 404 handler. It **exports** the app without starting it.
- **The entry file** (`server.js` in a real project) imports the app and calls `listen`.

Because `app.js` does not listen, a test can import it and start it on a temporary port ([[node-testing]]). The modules system that makes this work is [[js-modules]].

A `/health` route that returns 200 is standard: load balancers and hosting platforms call it to check the server is alive ([[hld-scaling]]).

## Step 5: async handlers

Real handlers wait for a database. Mark the handler `async` and `await` inside.

```js run
const express = require('express');
const app = express();

const db = { findUser: id => new Promise((resolve, reject) => setTimeout(() => id === 1 ? resolve({ id, name: 'Asha' }) : id === 2 ? resolve(null) : reject(new Error('connection lost')), 10)) };

app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json(user);
});
app.use((err, req, res, next) => res.status(500).json({ error: 'something went wrong on our side' }));

const server = app.listen(0, async () => {
  for (const id of [1, 2, 3]) {
    const res = await fetch(`http://localhost:${server.address().port}/users/${id}`);
    console.log(`/users/${id}`, res.status, JSON.stringify(await res.json()));
  }
  server.close(); server.closeAllConnections();
});
```

Three outcomes: found (200), not found (404), and the database failing (500). The 500 came from the four-argument function at the bottom, an **error-handling middleware**. In Express 5 a rejected promise in an async handler is passed to it automatically; in Express 4 you had to catch and forward it yourself. Details in [[express-middleware]]. Notice the client gets a generic message, not "connection lost": internal details stay in your logs ([[js-errors]]).

!!! key
- `app.METHOD(path, handler)` registers a route; `req` is the input, `res` is the output.
- Input comes from `req.params`, `req.query`, `req.body` (needs `express.json()`), and headers.
- One response per request; `return` after an early response.
- Status codes: 200 read/update, 201 create, 204 delete, 400 bad input, 404 not found.
- Routes are matched **in the order they were registered**.
- Split into routers, an `app.js` that exports the app, and a `server.js` that listens.
!!!

!!! trap
- `express.json()` registered after the routes, or not at all.
- `req.params.id === 5` is always false; params are strings. Convert with `Number()`.
- Defining `/tasks/:id` before `/tasks/search`: `search` is captured as an id. Put specific routes first.
- "Cannot set headers after they are sent": two responses for one request, usually a missing `return`.
- Keeping data in a variable and expecting it to survive a restart or be shared between several server processes ([[node-scaling]]).
!!!

!!! twist What changes if...
- **...you need to serve the frontend's files too?** `app.use(express.static('public'))` serves a folder of static files.
- **...the frontend is on another origin (localhost:5173 calling localhost:3000)?** The browser blocks it until the server sends CORS headers; add the `cors` middleware ([[node-validation-security]]).
- **...a route needs a file upload?** `express.json()` only handles JSON. Multipart form data needs a parser such as `multer`, which streams the file to disk or storage.
- **...you want to try routes without writing fetch calls?** Use `curl`, the VS Code REST Client, Postman or Thunder Client.
!!!

!!! model
Express is a list of "if the request looks like this, run that function". Each function reads from `req`, decides, and answers once through `res`.
!!!

## Practice

?? Add `PUT /tasks/:id` that replaces a task completely. How does it differ from PATCH?
PUT expects the whole new representation and overwrites every field; a field left out is lost or reset. PATCH changes only the fields sent. So PUT must validate that all required fields are present and return 400 otherwise.
??

?? What does this respond with, and why? `app.get('/a', (req, res) => { if (!req.query.x) res.status(400).json({ error: 'x required' }); res.json({ x: req.query.x }); });` called as `/a`.
The client gets the 400, and the server logs "Cannot set headers after they are sent" because execution continued to the second `res.json`. Add `return` before the first response.
??

?? Build a route `GET /products` supporting `?minPrice=`, `?maxPrice=` and `?sort=price|-price`.
```js run
const products = [{ name: 'mouse', price: 700 }, { name: 'keyboard', price: 2500 }, { name: 'monitor', price: 9000 }];
function listProducts(query) {
  const min = Number(query.minPrice ?? 0), max = Number(query.maxPrice ?? Infinity);
  if (Number.isNaN(min) || Number.isNaN(max)) return [400, { error: 'prices must be numbers' }];
  const result = products.filter(p => p.price >= min && p.price <= max);
  if (query.sort === 'price') result.sort((a, b) => a.price - b.price);
  if (query.sort === '-price') result.sort((a, b) => b.price - a.price);
  return [200, result.map(p => p.name)];
}
console.log(listProducts({ minPrice: '1000', sort: '-price' }));
console.log(listProducts({ maxPrice: 'cheap' }));
```
The logic is a plain function of the query object, which makes it testable without a server. The route is then one line: `const [status, body] = listProducts(req.query); res.status(status).json(body);`.
??

?? Why export the app from `app.js` instead of calling `listen` there?
So other code can use the app without opening a fixed port: tests start it on a temporary port, and a serverless platform can wrap it. Only the entry file decides the port and starts listening.
??

?? In what order does Express check routes, and what happens if two match?
In registration order. The first matching handler runs; if it responds, later ones never run. If it calls `next()`, Express continues to the next match. That is exactly how middleware works ([[express-middleware]]).
??
