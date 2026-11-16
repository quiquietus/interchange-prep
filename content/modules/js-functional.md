---
summary: Functions that take or return functions. Once closures click, map/filter/reduce, debounce, throttle and currying are small variations of one idea, and all four are standard interview coding questions.
time: 30
needs: js-closures, js-event-loop
videoSearch: debounce vs throttle JavaScript explained animation
---
## The problem this solves

Much code has the same skeleton with one varying step: loop over a list and *do something* to each item; wait for the user to stop typing and *then do something*. Rewriting the skeleton each time causes bugs. A **higher-order function** is a function that takes a function as an argument or returns one, so the skeleton is written once and the varying step is passed in.

This works because functions in JavaScript are ordinary values, and because a returned function keeps its environment ([[js-closures]]).

## Build it step by step

### Example 1: map, filter, reduce

```js run
const orders = [
  { id: 1, total: 400, status: 'paid' },
  { id: 2, total: 150, status: 'cancelled' },
  { id: 3, total: 900, status: 'paid' },
];

const paid = orders.filter(o => o.status === 'paid');
const totals = paid.map(o => o.total);
const revenue = totals.reduce((sum, t) => sum + t, 0);
const byStatus = orders.reduce((acc, o) => { (acc[o.status] ||= []).push(o.id); return acc; }, {});

console.log(totals, revenue, byStatus, orders.length);
```

| Method | Input to output | Callback returns |
| --- | --- | --- |
| `map` | n items to n items | the transformed item |
| `filter` | n items to at most n items | `true` to keep |
| `reduce` | n items to one value of any shape | the next accumulator |
| `forEach` | n items to nothing | ignored (use for side effects only) |

None of them mutate the original array (see [[js-values]]). `reduce` is the general one: `map` and `filter` can both be written with it.

### Example 2: debounce, run after the calls stop

The problem: a search box fires an event per keystroke. Calling the API on each one wastes requests and shows stale results. **Debounce** waits until calls stop for `delay` ms, then runs once with the latest arguments.

```js run
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const search = debounce(q => console.log('API call for:', q), 50);
['r', 're', 'rea', 'reac', 'react'].forEach((q, i) => setTimeout(() => search(q), i * 10));
```

Why each line exists:

- `timer` lives in the closure, so every call to the returned function sees the same timer.
- `clearTimeout(timer)` cancels the previous pending run. This is the whole trick: each new call resets the clock.
- `fn.apply(this, args)` forwards `this` and arguments so the wrapper behaves like the original ([[js-this]]).

### Example 3: throttle, run at most once per interval

The problem: scroll and mousemove fire continuously and never "stop", so debounce would never run. **Throttle** lets one call through, then ignores calls until `interval` has passed.

```js run
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) { last = now; fn.apply(this, args); }
  };
}

let ran = 0;
const onScroll = throttle(() => ran++, 40);
const timer = setInterval(onScroll, 5);
setTimeout(() => { clearInterval(timer); console.log('fired about 40 times, handler ran', ran, 'times'); }, 200);
```

| | Debounce | Throttle |
| --- | --- | --- |
| Runs when | activity has paused for `delay` | at most once every `interval` during activity |
| Burst of 100 calls | 1 run, at the end | several runs, evenly spaced |
| Use for | search-as-you-type, autosave, resize end | scroll position, drag, rate-limited buttons |
| State in closure | a timer id | the last run time |

The collab editor project debounces autosave and throttles cursor broadcasts for exactly these reasons.

### Example 4: currying and partial application

```js run
function curry(fn) {
  return function curried(...args) {
    return args.length >= fn.length ? fn.apply(this, args) : (...more) => curried.apply(this, [...args, ...more]);
  };
}
const volume = curry((l, w, h) => l * w * h);
console.log(volume(2)(3)(4), volume(2, 3)(4), volume(2)(3, 4));

const log = level => message => `[${level}] ${message}`;
const warn = log('WARN');
console.log(warn('disk at 90%'));
```

**Currying** turns `f(a, b, c)` into `f(a)(b)(c)`. Each call stores its argument in a closure and returns a function waiting for the rest. `fn.length` is the number of declared parameters, which is how `curry` knows when to finally call.

### Example 5: compose small functions into a pipeline

```js run
const pipe = (...fns) => input => fns.reduce((value, fn) => fn(value), input);

const slugify = pipe(
  s => s.trim(),
  s => s.toLowerCase(),
  s => s.replace(/[^a-z0-9]+/g, '-'),
);
console.log(slugify('  Scaling Node: Queues & Caching  '));
```

A chain where each function's output is the next one's input. Express runs requests through the same shape of pipeline, see [[express-middleware]].

## The rule, stated precisely

A higher-order function accepts a function parameter or returns a function. A **pure function** returns the same output for the same input and changes nothing outside itself; `map`/`filter`/`reduce` callbacks should be pure so results do not depend on execution order.

!!! key
- Be able to write `debounce`, `throttle`, `curry`, `once`, `memoize` and a `map`/`reduce` polyfill from memory. Each is under ten lines and each is a closure holding one or two variables.
- Say *why* `apply(this, args)` is there.
- Debounce vs throttle with one real use each.
- Chaining `filter().map()` makes two passes. That is fine for clarity; use one `reduce` or a loop only when the list is large and it matters.
!!!

!!! trap
- Creating the debounced function inside the handler or inside a React render: a new closure and a new timer every time, so nothing is ever debounced. Create it once (in React, with `useMemo` or `useRef`, see [[react-performance]]).
- `['1', '2', '3'].map(parseInt)` gives `[1, NaN, NaN]`, because `map` passes `(item, index)` and `parseInt` treats the index as the radix.
- `reduce` without an initial value throws on an empty array.
- Using `map` for side effects and ignoring the returned array. Use `forEach` or a loop.
!!!

!!! twist What changes if...
- **...debounce should fire on the first call instead of the last (leading edge)?** Run immediately when no timer is pending, then use the timer only to block further calls.
- **...throttle must not drop the final call (trailing edge)?** Remember the latest arguments and schedule one timer for the end of the interval.
- **...the debounced call must be cancellable?** Attach a `cancel` method to the returned function that calls `clearTimeout(timer)`. Needed when a component unmounts ([[react-effects]]).
- **...the server must enforce the limit?** Client throttling is only a courtesy. Rate limiting on the server is in [[node-scaling]].
!!!

!!! model
Write the skeleton once, pass the varying step as a function, keep the skeleton's memory in a closure.
!!!

## Practice

?? Implement `Array.prototype.myMap` and `myReduce`.
```js run
Array.prototype.myMap = function (cb) {
  const out = [];
  for (let i = 0; i < this.length; i++) if (i in this) out[i] = cb(this[i], i, this);
  return out;
};
Array.prototype.myReduce = function (cb, init) {
  let i = 0, acc = init;
  if (arguments.length < 2) { if (this.length === 0) throw new TypeError('Reduce of empty array with no initial value'); acc = this[i++]; }
  for (; i < this.length; i++) acc = cb(acc, this[i], i, this);
  return acc;
};
console.log([1, 2, 3].myMap(n => n * 2), [1, 2, 3].myReduce((a, b) => a + b));
```
??

?? Implement debounce with a leading-edge option and a `cancel` method.
```js run
function debounce(fn, delay, { leading = false } = {}) {
  let timer = null;
  function debounced(...args) {
    const callNow = leading && timer === null;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (!leading) fn.apply(this, args); }, delay);
    if (callNow) fn.apply(this, args);
  }
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}
const save = debounce(v => console.log('saved', v), 30, { leading: true });
save(1); save(2); save(3);
setTimeout(() => save(4), 80);
```

The first call runs at once; calls 2 and 3 arrive inside the quiet window and are dropped; call 4 arrives after the window closed, so it runs.
??

?? Implement `flatten(arr, depth)` without `Array.prototype.flat`.
```js run
const flatten = (arr, depth = 1) => depth < 1 ? arr.slice()
  : arr.reduce((out, x) => out.concat(Array.isArray(x) ? flatten(x, depth - 1) : [x]), []);
console.log(JSON.stringify(flatten([1, [2, [3, [4]]]], 1)), JSON.stringify(flatten([1, [2, [3, [4]]]], Infinity)));
```
??

?? Implement infinite currying: `sum(1)(2)(3)()` returns 6.
Each call returns a function that remembers the running total; an empty call ends the chain.

```js run
const sum = a => b => b === undefined ? a : sum(a + b);
console.log(sum(1)(2)(3)(), sum(5)());
```
??

?? Which would you use for a "Buy now" button that must not double-submit, and why is that not enough?
A leading-edge debounce or simply disabling the button while the request is pending stops accidental double clicks. It is not enough because a retry, a second tab or a network replay can still send the request twice. The server must make the operation idempotent, see [[rest-api]].
??
