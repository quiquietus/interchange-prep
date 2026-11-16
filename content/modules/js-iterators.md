---
summary: for...of, spread and destructuring all work through one small protocol. Generators are functions that can pause, which makes that protocol easy to implement and lets you produce values one at a time, even an endless number of them.
time: 30
needs: js-objects-arrays, js-promises
---
## The problem this solves

`for (const x of thing)` works on arrays, strings, Maps and Sets. How does one loop understand four different structures? And how could it work on *your* structure, such as a linked list, a paginated API or the lines of a 5 GB file, without first loading everything into an array?

The answer is a contract. Anything that follows it can be looped over, spread and destructured. Producing values **one at a time, on demand** is called being **lazy**, and it is what lets you handle data that is huge or never ends.

## Step 1: the iteration protocol

```js run
const letters = ['a', 'b'];
const iterator = letters[Symbol.iterator]();

console.log(iterator.next());
console.log(iterator.next());
console.log(iterator.next());
```

**What happened.** An **iterable** is any object with a method at the special key `Symbol.iterator`. Calling it returns an **iterator**: an object with a `next()` method. Each `next()` returns `{ value, done }`. When `done` is `true`, it is finished. `for...of` is nothing more than a loop that calls `next()` until `done`.

**Twist: make your own object iterable.**

```js run
const countdown = {
  from: 3,
  [Symbol.iterator]() {
    let current = this.from;
    return { next: () => current > 0 ? { value: current--, done: false } : { value: undefined, done: true } };
  },
};

for (const n of countdown) console.log(n);
console.log([...countdown], Math.max(...countdown));
const [first, second] = countdown;
console.log(first, second);
```

Because `countdown` follows the protocol, `for...of`, spread and destructuring all work on it. `current` lives in a closure ([[js-closures]]), so each loop gets a fresh counter.

| Built-in | Iterable? | Yields |
| --- | --- | --- |
| Array, String, Set | yes | items, characters, values |
| Map | yes | `[key, value]` pairs |
| Plain object `{}` | **no** | use `Object.entries(obj)` |

## Step 2: generators, functions that pause

Writing `next()` by hand is tedious. A **generator function** (`function*`) writes the iterator for you.

```js run
function* steps() {
  console.log('  started');
  yield 'one';
  console.log('  resumed after first yield');
  yield 'two';
  console.log('  resumed after second yield');
  return 'finished';
}

const gen = steps();
console.log('nothing has run yet');
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
```

**Read the output carefully.** Calling `steps()` runs **none** of the body. It returns a generator object. Each `next()` runs the body until the next `yield`, hands out that value and **freezes the function in place**, local variables and all. The following `next()` continues from exactly there. This is the only kind of function in JavaScript that can stop in the middle and continue later.

**Twist: the countdown, rewritten.**

```js run
function* countdown(from) {
  while (from > 0) yield from--;
}
console.log([...countdown(3)]);
```

Three lines instead of nine. A generator object is both an iterator and an iterable.

## Step 3: laziness and infinite sequences

```js run
function* naturals() { let n = 1; while (true) yield n++; }

function* take(iterable, count) { if (count <= 0) return; for (const x of iterable) { yield x; if (--count === 0) return; } }
function* filter(iterable, test) { for (const x of iterable) if (test(x)) yield x; }
function* map(iterable, fn) { for (const x of iterable) yield fn(x); }

let examined = 0;
const firstThree = take(map(filter(naturals(), n => { examined++; return n % 7 === 0; }), n => n * n), 3);
console.log([...firstThree], '| numbers examined:', examined);
```

`naturals()` never ends, yet the program finishes. Nothing is computed until the final spread asks for a value; each request pulls one item through the whole chain. It examined 21 numbers, exactly as many as needed, and stopped.

Compare with arrays, which do all the work up front:

| | Array methods (`filter().map()`) | Generators |
| --- | --- | --- |
| When work happens | immediately, for every item | only when a value is requested |
| Memory | a new full array at each step | one item at a time |
| Infinite or unknown-length sources | impossible | fine |
| Random access (`arr[5]`), `length` | yes | no, forward only |

This pull-one-at-a-time model is the same idea as Node streams ([[node-runtime]]) and database cursors.

## Step 4: talking to a generator

```js run
function* conversation() {
  const name = yield 'What is your name?';
  const city = yield `Hello ${name}. Where are you from?`;
  return `${name} from ${city}, noted.`;
}
const chat = conversation();
console.log(chat.next().value);
console.log(chat.next('Asha').value);
console.log(chat.next('Jaipur').value);
```

`yield` is two-way: the value passed to `next(value)` becomes the result of the paused `yield` expression. The first `next()` takes no value because nothing is paused yet. This two-way pausing is the mechanism `async/await` was built on: an async function is, in effect, a generator that yields promises and is resumed with their results ([[js-promises]]).

## Step 5: async iteration

When each value arrives *later* (pages from an API, chunks from a stream), `next()` returns a promise and the loop becomes `for await`.

```js run
const fakeApi = page => new Promise(res => setTimeout(() =>
  res({ items: [`item ${page * 2 - 1}`, `item ${page * 2}`], nextPage: page < 3 ? page + 1 : null }), 10));

async function* allItems() {
  let page = 1;
  while (page) {
    const res = await fakeApi(page);
    console.log(`  (fetched page ${page})`);
    yield* res.items;
    page = res.nextPage;
  }
}

(async () => {
  for await (const item of allItems()) {
    console.log(item);
    if (item === 'item 3') break;
  }
  console.log('stopped early: page 3 was never requested');
})();
```

The caller writes a plain loop and never sees pagination. Because it is lazy, `break` after `item 3` means the third page is never fetched. `yield*` delegates to another iterable, yielding each of its values in turn.

Cursor pagination in [[rest-api]] and reading a large file line by line both fit this shape.

!!! key
- Iterable: has `[Symbol.iterator]()`. Iterator: has `next()` returning `{ value, done }`.
- `for...of`, spread, destructuring, `Array.from`, `Promise.all`, `new Map(...)` all consume iterables.
- `function*` returns a generator object; the body runs only on `next()`; `yield` pauses and resumes.
- Generators are lazy: ideal for large, expensive or infinite sequences.
- `async function*` plus `for await...of` for values that arrive over time.
- `for...in` loops over **keys** of an object; `for...of` loops over **values** of an iterable. Different things.
!!!

!!! trap
- A generator can be consumed only once. A second `for...of` over the same generator object yields nothing; call the generator function again.
- The value given to `return` in a generator is **not** seen by `for...of` or spread (`done` is already true).
- Spreading an infinite generator (`[...naturals()]`) hangs the program.
- Arrow functions cannot be generators.
- Plain objects are not iterable: `for (const x of {})` throws a `TypeError`.
!!!

!!! twist What changes if...
- **...you need unique ids?** A generator is a neat id source: `function* ids() { let i = 1; while (true) yield i++; }`.
- **...you want to flatten a tree?** A recursive generator with `yield*` walks it depth-first without building arrays (practice below).
- **...the consumer stops early?** `break` calls the generator's `return()`, which runs any `finally` block inside it, so resources can be released.
!!!

!!! model
An iterator is a vending machine: press `next`, get one item, until it says empty. A generator is a function with a bookmark: it runs to the next `yield`, hands you the value and waits there.
!!!

## Practice

?? Write a `range(start, end, step)` generator and use it to sum the even numbers from 2 to 20.
```js run
function* range(start, end, step = 1) { for (let n = start; n <= end; n += step) yield n; }
let total = 0;
for (const n of range(2, 20, 2)) total += n;
console.log([...range(1, 5)], total);
```
??

?? Write a generator that walks a nested folder tree and yields every file path.
```js run
const tree = { name: 'src', children: [{ name: 'app.js' }, { name: 'lib', children: [{ name: 'util.js' }, { name: 'db.js' }] }] };
function* files(node, path = '') {
  const full = path + node.name;
  if (!node.children) { yield full; return; }
  for (const child of node.children) yield* files(child, full + '/');
}
console.log([...files(tree)]);
```
??

?? What does this print? `function* g() { yield 1; return 2; } console.log([...g()]);`
`[1]`. Spread and `for...of` stop when `done` becomes true, and the returned value arrives together with `done: true`, so it is discarded.
??

?? Make a class `Playlist` whose instances can be used in `for...of`.
Define `*[Symbol.iterator]()` as a generator method.

```js run
class Playlist {
  #songs = [];
  add(song) { this.#songs.push(song); return this; }
  *[Symbol.iterator]() { yield* this.#songs; }
}
const list = new Playlist().add('Kesariya').add('Tum Hi Ho');
for (const song of list) console.log(song);
```
??

?? How do generators relate to async/await?
Both are functions that can suspend and resume. Before `async/await` existed, libraries implemented it with generators: the generator yielded a promise, a small runner waited for the promise and called `next(result)` to resume. `await` is that pattern built into the language.
??
