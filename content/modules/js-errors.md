---
summary: Things fail. Networks drop, input is wrong, files are missing. Error handling is how a program notices a failure, stops the damage and tells the right person, in synchronous and asynchronous code.
time: 30
needs: js-promises
---
## The problem this solves

A function is asked to parse a number and receives `'abc'`. It has three choices: return a wrong value silently, crash the whole program, or **signal clearly that it could not do its job** and let the caller decide. JavaScript's mechanism for the third is the exception: `throw` to signal, `try/catch` to handle.

## Step 1: throw, try, catch, finally

```js run
function divide(a, b) {
  if (b === 0) throw new Error('cannot divide by zero');
  return a / b;
}

try {
  console.log(divide(10, 2));
  console.log(divide(1, 0));
  console.log('this line never runs');
} catch (error) {
  console.log('caught:', error.message);
} finally {
  console.log('finally always runs');
}
console.log('program continues');
```

**What happened.** `throw` stops the function immediately. Execution jumps out of every function on the call stack ([[js-execution-context]]) until it finds a `catch`. `finally` runs whether there was an error or not, which makes it the place for cleanup: closing a file, hiding a spinner, releasing a lock.

**Twist: nobody catches it.**

```js run
const { spawnSync } = require('child_process');
const result = spawnSync(process.execPath, ['-e', 'function f() { throw new Error("boom"); } f(); console.log("never printed");'], { encoding: 'utf8' });
console.log('exit code:', result.status);
console.log(result.stderr.split('\n').filter(l => /^Error|^\s+at f /.test(l)).slice(0, 2).join('\n'));
```

An uncaught error ends the program with a non-zero exit code and prints a **stack trace**: the chain of function calls that led there. Reading stack traces from the top is the first debugging skill.

**Twist: `finally` even beats `return`.**

```js run
function demo() {
  try { return 'from try'; }
  finally { console.log('finally runs before the function actually returns'); }
}
console.log(demo());
```

## Step 2: the Error object and built-in types

```js run
const samples = [
  () => undefinedName,
  () => null.name,
  () => (123).toUpperCase(),
  () => new Array(-1),
  () => JSON.parse('{bad json}'),
];
for (const fn of samples) {
  try { fn(); } catch (e) { console.log(e.name.padEnd(15), '|', e.message); }
}
```

| Type | You did | Typical cause |
| --- | --- | --- |
| `ReferenceError` | used a name that does not exist (or is in its TDZ) | typo, wrong scope |
| `TypeError` | used a value in a way its type does not allow | property of `undefined`, calling a non-function |
| `RangeError` | gave a number outside the allowed range | invalid array length, infinite recursion |
| `SyntaxError` | wrote code or JSON that cannot be parsed | invalid JSON from an API |

Every error has `name`, `message` and `stack`. Always throw `Error` objects, never plain strings: a string has no stack trace.

## Step 3: your own error types

```js run
class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL', cause } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.status = status; this.code = code;
  }
}
class NotFoundError extends AppError { constructor(what) { super(`${what} not found`, { status: 404, code: 'NOT_FOUND' }); } }
class ValidationError extends AppError { constructor(msg) { super(msg, { status: 422, code: 'VALIDATION' }); } }

function getUser(id) {
  if (typeof id !== 'number') throw new ValidationError('id must be a number');
  if (id !== 1) throw new NotFoundError('user ' + id);
  return { id, name: 'Asha' };
}
for (const id of [1, 7, 'x']) {
  try { console.log(getUser(id)); }
  catch (e) {
    if (e instanceof AppError) console.log(`${e.status} ${e.code}: ${e.message}  (${e.name})`);
    else throw e;
  }
}
```

**Why bother.** The code that *detects* a problem (deep in a service) is rarely the code that *knows what to do* about it (the HTTP layer). A custom error carries the facts across that gap: which kind of failure, which status code. `instanceof` works because classes extend `Error` ([[js-prototypes]]). The central error middleware in [[express-middleware]] is built on exactly this.

Note the `else throw e`: **only handle what you understand, and rethrow the rest.** Swallowing unknown errors hides bugs.

## Step 4: errors in asynchronous code

`try/catch` only catches errors thrown **while the try block is running**. Asynchronous work finishes later.

```js run
try {
  setTimeout(() => { try { throw new Error('inside timeout'); } catch (e) { console.log('must be caught inside the callback:', e.message); } }, 0);
} catch (e) {
  console.log('this outer catch can never see it');
}

const failing = () => Promise.reject(new Error('request failed'));

failing().catch(e => console.log('.catch():', e.message));

(async () => {
  try { await failing(); }
  catch (e) { console.log('try/catch with await:', e.message); }
})();
```

By the time the timer callback runs, the outer `try` block finished long ago ([[js-event-loop]]). Promises fix this by carrying the error forward: a rejection travels down the chain to the nearest `.catch`, and `await` turns a rejection back into a thrown error so ordinary `try/catch` works ([[js-promises]]).

**Twist: the missing `await`.**

```js run
const failing = () => Promise.reject(new Error('db down'));

async function withoutAwait() { try { return failing(); } catch (e) { return 'handled'; } }
async function withAwait() { try { return await failing(); } catch (e) { return 'handled'; } }

withoutAwait().then(v => console.log('without await:', v), e => console.log('without await: escaped the try ->', e.message));
withAwait().then(v => console.log('with await   :', v));
```

Without `await`, the function hands back the promise and leaves the `try` block before the rejection happens. This is one of the most common real-world bugs in Node code.

**Twist: an unhandled rejection kills the process.**

```js run
const { spawnSync } = require('child_process');
const r = spawnSync(process.execPath, ['-e', 'Promise.reject(new Error("nobody handled me")); setTimeout(() => console.log("still alive?"), 50);'], { encoding: 'utf8' });
console.log('exit code:', r.status, '| printed "still alive?":', r.stdout.includes('still alive'));
```

In current Node versions a rejected promise with no handler terminates the program. Every promise chain needs a `catch` somewhere.

## Step 5: patterns that keep code healthy

```js run
function parseAge(input) {
  const age = Number(input);
  if (!Number.isInteger(age) || age < 0 || age > 150) throw new RangeError(`invalid age: ${JSON.stringify(input)}`);
  return age;
}

function loadConfig(text) {
  try { return JSON.parse(text); }
  catch (cause) { throw new Error('config file is not valid JSON', { cause }); }
}

const safe = fn => (...args) => { try { return [null, fn(...args)]; } catch (e) { return [e, null]; } };

console.log(safe(parseAge)('42'), safe(parseAge)('abc')[0].message);
try { loadConfig('{oops'); } catch (e) { console.log(e.message, '| caused by:', e.cause.name); }
```

| Pattern | Idea |
| --- | --- |
| **Fail fast** | validate inputs at the top of a function and throw immediately, with a message that includes the bad value |
| **Wrap with `cause`** | catch a low-level error and throw a higher-level one that explains what you were trying to do, keeping the original in `cause` |
| **Handle at the boundary** | let errors travel up to one place (the route handler, the event handler) that logs and responds, instead of `try/catch` in every function |
| **Result tuple** | for *expected* failures (invalid user input), return `[error, value]` or `{ ok, error }` instead of throwing |

**Expected vs unexpected.** "Email already taken" is an expected outcome: handle it and show a message. "Cannot read properties of undefined" is a bug: log it with the stack, return a generic 500, and fix the code. Do not show bug details to users.

!!! key
- `throw` unwinds the stack to the nearest `catch`; `finally` always runs.
- Throw `Error` objects (or subclasses), never strings.
- Custom error classes carry a type and data from where the error is detected to where it is handled.
- `try/catch` cannot catch errors from a callback that runs later. Promises and `await` can.
- `return await` inside `try` if you want to catch the rejection there.
- Catch only what you can handle; rethrow the rest.
!!!

!!! trap
- An empty `catch {}` block. The error is gone and so is your chance to debug it.
- `catch (e) { console.log(e) }` and carrying on as if the operation succeeded.
- Wrapping every line in its own `try/catch`. Handle at boundaries.
- Throwing inside a `forEach(async ...)` callback: nothing awaits those promises ([[js-promises]]).
- Returning error details (stack traces, SQL) to API clients.
!!!

!!! twist What changes if...
- **...several promises can fail?** `Promise.all` rejects with the first error only; `Promise.allSettled` gives every outcome; `Promise.any` rejects with an `AggregateError` holding all of them.
- **...the failure is temporary (a network blip)?** Retry with a growing delay, but only operations that are safe to repeat ([[rest-api]] idempotency).
- **...a React component throws while rendering?** An error boundary catches it and shows a fallback instead of a blank page.
- **...you need last-resort handling in Node?** `process.on('uncaughtException')` and `'unhandledRejection'` are for logging and a clean exit, not for carrying on.
!!!

!!! model
An error is a message thrown upward: "I could not do what you asked, and here is why." Every function either handles it, adds context and passes it on, or gets out of the way.
!!!

## Practice

?? What is printed? `function f() { try { throw new Error('a'); } catch (e) { return 'catch'; } finally { return 'finally'; } }`
`'finally'`. A `return` in `finally` overrides any earlier `return` or thrown error. This is why you should never return from `finally`.

```js run
function f() { try { throw new Error('a'); } catch (e) { return 'catch'; } finally { return 'finally'; } }
console.log(f());
```
??

?? Write a `retry` helper that also stops immediately on errors that should not be retried.
```js run
class FatalError extends Error {}
async function retry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(i); }
    catch (e) { if (e instanceof FatalError || i === attempts) throw e; console.log(`attempt ${i} failed (${e.message}), retrying`); }
  }
}
(async () => {
  console.log(await retry(async n => { if (n < 3) throw new Error('timeout'); return 'success on attempt ' + n; }));
  try { await retry(async () => { throw new FatalError('invalid API key'); }); } catch (e) { console.log('gave up at once:', e.message); }
})();
```
??

?? Why should you throw `new Error('msg')` instead of `throw 'msg'`?
An `Error` records a stack trace at the point of creation, has a `name` and supports `instanceof` checks and `cause`. A thrown string has none of these, so the person debugging cannot tell where it came from.
??

?? In an Express app, where should errors be turned into HTTP responses?
In one error-handling middleware at the end of the chain. Routes and services throw typed errors (`NotFoundError`, `ValidationError`); the middleware maps known types to their status and message, and logs anything unknown and answers 500 with a generic message ([[express-middleware]]).
??

?? Why does `try { setTimeout(() => { throw new Error('x') }, 0) } catch {}` not catch the error?
`setTimeout` only schedules the callback and returns immediately, so the `try` block completes without error. The callback runs later as a separate task with an empty call stack beneath it; there is no enclosing `try` any more.
??
