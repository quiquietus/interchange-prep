---
summary: The final test of the JavaScript line. Rebuild the tools you have been using, call, apply and bind, an event emitter and a working Promise, from nothing. If you can write these, you understand this, closures, the event loop and promises for real.
time: 50
needs: js-this, js-closures, js-promises, js-errors
---
## Why build what already exists

Using `bind`, `emitter.on` or `new Promise` shows you know the interface. Interviewers ask you to **implement** them because the implementation cannot be faked: each one forces a specific concept into the open.

| Build | Concept it proves |
| --- | --- |
| `call`, `apply`, `bind` | `this` is decided by the call site ([[js-this]]) |
| `EventEmitter` | closures and the observer pattern ([[js-closures]], [[lld-behavioral]]) |
| `Promise` | states, the microtask queue, chaining ([[js-promises]], [[js-event-loop]]) |
| `Promise.all`, `race`, `allSettled` | coordinating many async results |
| `async/await` runner | generators ([[js-iterators]]) |

For each: the problem, a first version, then the twists an interviewer adds.

## Build 1: call, apply, bind

**The key insight.** There is no direct way to "set `this`". But there is a rule: in `obj.fn()`, `this` is `obj`. So to run `fn` with `this = obj`, **temporarily make `fn` a property of `obj` and call it as a method**.

```js run
Function.prototype.myCall = function (thisArg, ...args) {
  const target = thisArg == null ? globalThis : Object(thisArg);
  const key = Symbol('fn');
  target[key] = this;
  try { return target[key](...args); }
  finally { delete target[key]; }
};
Function.prototype.myApply = function (thisArg, args = []) { return this.myCall(thisArg, ...args); };

function introduce(greeting, mark) { return `${greeting}, I am ${this.name}${mark}`; }
const user = { name: 'Asha' };

console.log(introduce.myCall(user, 'Hi', '!'));
console.log(introduce.myApply(user, ['Hello', '.']));
console.log(Object.keys(user), ' <- no leftover property');
```

**Line by line.**

- Inside `myCall`, `this` is the function being called, because of `introduce.myCall(...)`: the thing left of the dot.
- A `Symbol` key cannot collide with any existing property of the target.
- `target[key](...args)` is a method call, so inside `introduce`, `this` is `target`.
- `finally` removes the temporary property even if the function throws ([[js-errors]]).
- `Object(thisArg)` wraps a primitive such as `5` so a property can be attached; `null`/`undefined` fall back to the global object, as in sloppy mode.

### bind, including the `new` twist

```js run
Function.prototype.myBind = function (thisArg, ...preset) {
  const fn = this;
  function bound(...later) {
    const calledWithNew = this instanceof bound;
    return fn.apply(calledWithNew ? this : thisArg, [...preset, ...later]);
  }
  bound.prototype = Object.create(fn.prototype);
  return bound;
};

function introduce(greeting, mark) { return `${greeting}, I am ${this.name}${mark}`; }
const hey = introduce.myBind({ name: 'Ravi' }, 'Hey');
console.log(hey('?'));
console.log(hey.call({ name: 'someone else' }, '!'), ' <- a bound this cannot be overridden');

function Point(x, y) { this.x = x; this.y = y; }
const PointAtX5 = Point.myBind({ ignored: true }, 5);
const p = new PointAtX5(9);
console.log(p.x, p.y, p instanceof Point);
```

`bind` returns a new function that remembers `fn`, `thisArg` and the preset arguments in a closure. The twist most candidates miss: **when a bound function is called with `new`, the bound `this` is ignored** and the new object is used. `this instanceof bound` detects that, and linking the prototypes makes `instanceof Point` work ([[js-prototypes]]).

## Build 2: an event emitter

```js run
class Emitter {
  #events = new Map();
  on(name, listener) {
    if (!this.#events.has(name)) this.#events.set(name, []);
    this.#events.get(name).push(listener);
    return () => this.off(name, listener);
  }
  off(name, listener) {
    const list = this.#events.get(name) ?? [];
    this.#events.set(name, list.filter(l => l !== listener && l.original !== listener));
  }
  once(name, listener) {
    const wrapper = (...args) => { this.off(name, wrapper); listener(...args); };
    wrapper.original = listener;
    return this.on(name, wrapper);
  }
  emit(name, ...args) {
    const list = this.#events.get(name) ?? [];
    for (const listener of [...list]) listener(...args);
    return list.length > 0;
  }
}

const chat = new Emitter();
const unsubscribe = chat.on('message', (from, text) => console.log(`[log] ${from}: ${text}`));
chat.once('message', from => console.log(`[welcome] first message from ${from}`));

chat.emit('message', 'asha', 'hello');
chat.emit('message', 'ravi', 'hi');
unsubscribe();
console.log('anyone listening after unsubscribe?', chat.emit('message', 'meera', 'anyone?'));
```

**Decisions worth saying aloud.**

- A `Map` from event name to an array of listeners. An array, not a Set, so the same function can be registered twice and order is kept.
- `on` returns an unsubscribe function, so the caller does not need to keep the listener reference.
- `emit` loops over a **copy** (`[...list]`). Without it, a `once` listener removing itself during the loop would shift the array and the next listener would be skipped.
- `once` wraps the listener, and stores the original on the wrapper so `off(name, original)` still finds it.

Node's `EventEmitter`, DOM events, Socket.IO ([[websockets]]) and Redux's `subscribe` are this structure.

## Build 3: a Promise

Three rules from [[js-promises]] decide the whole design:

1. A promise is `pending`, then `fulfilled` or `rejected`, **once**, forever.
2. `then` returns a **new promise**, settled by what the callback returns or throws.
3. Callbacks always run **asynchronously**, as microtasks.

```js run
class MyPromise {
  #state = 'pending'; #value; #handlers = [];

  constructor(executor) {
    try { executor(v => this.#resolve(v), e => this.#settle('rejected', e)); }
    catch (e) { this.#settle('rejected', e); }
  }
  #resolve(value) {
    if (value === this) return this.#settle('rejected', new TypeError('a promise cannot resolve to itself'));
    if (value && typeof value.then === 'function') {
      try { value.then(v => this.#resolve(v), e => this.#settle('rejected', e)); }
      catch (e) { this.#settle('rejected', e); }
      return;
    }
    this.#settle('fulfilled', value);
  }
  #settle(state, value) {
    if (this.#state !== 'pending') return;
    this.#state = state; this.#value = value;
    this.#handlers.forEach(h => this.#run(h));
  }
  #run({ onFulfilled, onRejected, resolve, reject }) {
    queueMicrotask(() => {
      const handler = this.#state === 'fulfilled' ? onFulfilled : onRejected;
      if (typeof handler !== 'function') return this.#state === 'fulfilled' ? resolve(this.#value) : reject(this.#value);
      try { resolve(handler(this.#value)); } catch (e) { reject(e); }
    });
  }
  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const h = { onFulfilled, onRejected, resolve, reject };
      this.#state === 'pending' ? this.#handlers.push(h) : this.#run(h);
    });
  }
  catch(onRejected) { return this.then(undefined, onRejected); }
  finally(fn) { return this.then(v => { fn(); return v; }, e => { fn(); throw e; }); }
  static resolve(v) { return new MyPromise(res => res(v)); }
  static reject(e) { return new MyPromise((_, rej) => rej(e)); }
}

console.log('1 sync start');
new MyPromise(resolve => { console.log('2 executor runs synchronously'); resolve(10); resolve(99); })
  .then(v => v * 2)
  .then(v => new MyPromise(res => setTimeout(() => res(v + 1), 10)))
  .then(v => { console.log('4 chained value:', v); throw new Error('boom'); })
  .then(() => console.log('skipped'))
  .catch(e => { console.log('5 caught:', e.message); return 'recovered'; })
  .finally(() => console.log('6 finally'))
  .then(v => console.log('7 continues with:', v));
console.log('3 sync end');
```

**How each rule became code.**

| Rule | Where |
| --- | --- |
| Settles once | `#settle` returns immediately unless the state is `pending`, so the second `resolve(99)` is ignored |
| Executor errors become rejections | the `try/catch` in the constructor |
| `then` returns a new promise | `then` creates a `MyPromise` and stores its `resolve`/`reject` beside the callbacks |
| Callback result settles the next promise | `resolve(handler(value))`, with `catch` turning a throw into `reject` |
| Returning a promise makes the chain wait | `#resolve` checks for a `then` method and subscribes to it instead of fulfilling with the promise object |
| A missing handler passes the value through | the `typeof handler !== 'function'` branch; this is how a rejection skips `then`s until a `catch` |
| Always asynchronous | `queueMicrotask` in `#run`, which is why `3 sync end` prints before `4` |
| Handlers attached before or after settling both work | `then` queues if pending, runs at once otherwise |

**Twist: does it interoperate with the real thing?**

```js run
class MiniPromise {
  constructor(executor) { this.callbacks = []; this.done = false;
    executor(v => { if (this.done) return; this.done = true; this.value = v; this.callbacks.forEach(cb => queueMicrotask(() => cb(v))); }); }
  then(cb) { return new MiniPromise(res => { const run = v => res(cb(v)); this.done ? queueMicrotask(() => run(this.value)) : this.callbacks.push(run); }); }
}
(async () => {
  const value = await new MiniPromise(res => setTimeout(() => res('awaited a hand-made thenable'), 10));
  console.log(value);
  console.log(await Promise.all([new MiniPromise(r => r(1)), 2, Promise.resolve(3)]));
})();
```

`await` and `Promise.all` accept any object with a `then` method (a **thenable**). The language does not check for the built-in class; it follows the protocol. That is the same reason `#resolve` above checks for `.then` instead of `instanceof`.

### The combinators

```js run
const all = promises => new Promise((resolve, reject) => {
  const results = []; let pending = promises.length;
  if (!pending) return resolve(results);
  promises.forEach((p, i) => Promise.resolve(p).then(v => { results[i] = v; if (--pending === 0) resolve(results); }, reject));
});
const allSettled = promises => all(promises.map(p => Promise.resolve(p).then(
  value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason: reason.message }))));
const race = promises => new Promise((resolve, reject) => promises.forEach(p => Promise.resolve(p).then(resolve, reject)));
const any = promises => new Promise((resolve, reject) => {
  const errors = []; let pending = promises.length;
  promises.forEach((p, i) => Promise.resolve(p).then(resolve, e => { errors[i] = e; if (--pending === 0) reject(new AggregateError(errors, 'all rejected')); }));
});

const ok = (v, ms) => new Promise(r => setTimeout(() => r(v), ms));
const bad = (m, ms) => new Promise((_, r) => setTimeout(() => r(new Error(m)), ms));
(async () => {
  console.log('all       :', await all([ok('a', 20), 'b', ok('c', 5)]));
  console.log('all fails :', await all([ok('a', 20), bad('x', 5)]).catch(e => 'rejected with ' + e.message));
  console.log('allSettled:', JSON.stringify(await allSettled([ok('a', 5), bad('x', 5)])));
  console.log('race      :', await race([ok('slow', 30), ok('fast', 5)]));
  console.log('any       :', await any([bad('x', 5), ok('first success', 20)]));
})();
```

Two details carry `all`: results are stored **by index**, so output order matches input order no matter which finishes first; and a counter, not `results.length`, decides when everything is done (an array with only index 2 filled already has length 3). `Promise.resolve(p)` lets plain values sit in the list.

## Build 4: async/await from a generator

```js run
function run(generatorFn) {
  return new Promise((resolve, reject) => {
    const gen = generatorFn();
    function step(method, input) {
      let result;
      try { result = gen[method](input); } catch (e) { return reject(e); }
      if (result.done) return resolve(result.value);
      Promise.resolve(result.value).then(v => step('next', v), e => step('throw', e));
    }
    step('next');
  });
}
const fetchUser = id => new Promise(r => setTimeout(() => r({ id, name: 'Asha' }), 10));
const fetchOrders = user => new Promise((_, rej) => setTimeout(() => rej(new Error('orders service down')), 10));

run(function* () {
  const user = yield fetchUser(7);
  console.log('got user:', user.name);
  try { yield fetchOrders(user); }
  catch (e) { console.log('caught like a normal error:', e.message); }
  return 'done';
}).then(console.log);
```

Replace `function*` with `async function` and `yield` with `await`, and this is ordinary async code. The runner does what the engine does: take the yielded promise, wait for it, then resume the function with the result (`gen.next(v)`) or throw the error into it (`gen.throw(e)`), which is why `try/catch` works around an `await` ([[js-iterators]]).

!!! key
- `call`: attach the function to the object under a Symbol, call it as a method, remove it.
- `bind`: a closure over the function, `this` and preset arguments, with `new` taking priority over the bound `this`.
- Emitter: a map of arrays; copy before iterating; `once` wraps and remembers the original.
- Promise: state plus value plus a queue of handlers; `then` returns a new promise; resolution adopts thenables; callbacks go through the microtask queue.
- `Promise.all`: index for order, counter for completion, first rejection wins.
- Say the rule first, then write the code that enforces it. Interviewers grade the reasoning.
!!!

!!! trap
- Calling `then` callbacks synchronously when the promise is already settled.
- Forgetting that `then` must return a new promise, or mutating and returning the same one.
- Using `results.push(value)` in `Promise.all`, which orders by completion time.
- Arrow functions for the polyfills on `Function.prototype`: an arrow has no own `this`, so it cannot see the function being called.
- Not handling a callback that throws.
!!!

!!! twist What changes if...
- **...the interviewer asks for `Promise.all` with a concurrency limit?** Workers pulling from a shared index, as in [[js-promises]].
- **...they ask for a cancellable promise?** Promises cannot be cancelled; expose a `cancel()` that sets a flag checked before resolving, or accept an `AbortSignal`.
- **...the emitter needs wildcard events or priorities?** Store listener objects (`{ fn, priority }`), sort on insert, and match names with a pattern.
- **...you must also implement `debounce`, `throttle`, `memoize`, `curry`, `deepClone`, `flatten`?** Those are built in [[js-functional]], [[js-closures]] and [[js-values]]. Together with this station they cover nearly every "implement X" JavaScript question.
!!!

!!! model
Every tool here is a small state machine held in a closure: remember something (a function and its `this`, a list of listeners, a state and a queue of handlers), and expose a few methods that read or change it by strict rules.
!!!

## Practice

?? Implement `Function.prototype.myCall` without using spread, `call`, `apply` or `bind`. What is the core trick?
Attach the function to the target object under a unique key and invoke it as a method, because a method call sets `this` to the object left of the dot. Then delete the key. (Without spread you would build the argument list with a loop and `eval`-free indexing via `arguments`; modern interviews accept rest and spread.)
??

?? Add `promisify(fn)`: convert a Node-style callback function into one that returns a promise.
```js run
const promisify = fn => (...args) => new Promise((resolve, reject) => fn(...args, (err, value) => err ? reject(err) : resolve(value)));

const readConfig = (name, cb) => setTimeout(() => name === 'app' ? cb(null, { port: 3000 }) : cb(new Error('no such config: ' + name)), 5);
const readConfigAsync = promisify(readConfig);
readConfigAsync('app').then(c => console.log(c));
readConfigAsync('missing').catch(e => console.log(e.message));
```
??

?? In the Promise implementation, why are handlers stored in an array?
`then` can be called many times on the same promise, before or after it settles. Every registered handler must run, in order, when it settles. One slot would lose all but the last.
??

?? Why must `then` callbacks be asynchronous even for an already-resolved promise?
So code behaves the same whether a promise happens to be settled or not. If callbacks sometimes ran immediately and sometimes later, the order of surrounding statements would depend on timing, which produces bugs that appear only occasionally.
??

?? Implement `sleep(ms)` and use it to print 1, 2, 3 with a delay between each.
```js run
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => { for (const n of [1, 2, 3]) { console.log(n); await sleep(20); } console.log('done'); })();
```
A `for` loop with `await` runs in sequence; `forEach` with an async callback would start all three at once.
??
