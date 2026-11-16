---
summary: Real data comes in groups. An object groups values by name, an array groups them by position. Reading, changing, looping over and unpacking these two shapes is most of everyday JavaScript.
time: 40
needs: js-functions-flow
---
## The problem this solves

One variable holds one value. A user has a name, an email and an age; a cart has many items. Keeping `userName`, `userEmail`, `userAge`, `item1`, `item2`... as separate variables falls apart immediately. We need to **group related values into one thing** that can be stored, passed to a function and returned.

| | Object | Array |
| --- | --- | --- |
| Groups values by | **name** (a key) | **position** (an index starting at 0) |
| Written with | `{ key: value }` | `[value, value]` |
| Use for | one thing with named properties | an ordered list of similar things |

Nearly all API data you will ever handle is these two shapes nested inside each other: an array of objects, an object containing arrays.

## Step 1: objects

```js run
const user = {
  name: 'Asha',
  age: 22,
  address: { city: 'Jaipur', pin: '302001' },
};

console.log(user.name, user.address.city);
console.log(user['age']);

user.age = 23;
user.email = 'asha@example.com';
delete user.address.pin;
console.log(user);
console.log(user.phone);
```

**What happened.** Dot notation reads a property. Objects can be nested. You can change a property, add a new one just by assigning, and remove one with `delete`. Reading a property that does not exist gives `undefined`; it does not crash.

**Twist: when do you need square brackets?**

```js run
const scores = { maths: 91, 'computer science': 88 };
const subject = 'maths';

console.log(scores[subject]);
console.log(scores['computer science']);
console.log(scores.subject);
```

Use brackets when the key is **in a variable** or is not a valid name (it has a space or starts with a digit). `scores.subject` looks for a key literally called `subject`, which does not exist.

**Twist: reading deep into something that might be missing.**

```js run
const guest = { name: 'Ravi' };
try { console.log(guest.address.city); } catch (e) { console.log(e.name + ': ' + e.message); }
console.log(guest.address?.city);
console.log(guest.address?.city ?? 'city unknown');
```

`guest.address` is `undefined`, and reading `.city` of `undefined` throws the most common error in JavaScript. **Optional chaining** `?.` stops and returns `undefined` if the part before it is missing. Combine it with `??` ([[js-basics]]) for a default.

### Methods and shorthand

```js run
const name = 'Meera', level = 3;
const player = {
  name,
  level,
  describe() { return `${this.name} is level ${this.level}`; },
};
console.log(player.describe());
console.log(Object.keys(player), Object.values(player).length, Object.entries({ a: 1, b: 2 }));
```

`{ name, level }` is shorthand for `{ name: name, level: level }`. A function stored in an object is called a **method**; inside it, `this` is the object it was called on (the full rules are [[js-this]]). `Object.keys`, `Object.values` and `Object.entries` turn an object into arrays so it can be looped over.

## Step 2: arrays

```js run
const queue = ['asha', 'ravi'];

console.log(queue[0], queue.length, queue[5], queue.at(-1));
queue.push('meera');
const removed = queue.shift();
console.log(queue, 'removed:', removed);
console.log(queue.includes('ravi'), queue.indexOf('meera'), queue.join(' | '));
```

| Method | Does | Changes the original? |
| --- | --- | --- |
| `push(x)` / `pop()` | add / remove at the **end** | yes |
| `unshift(x)` / `shift()` | add / remove at the **start** | yes |
| `splice(i, n)` | remove `n` items at index `i` | yes |
| `sort()`, `reverse()` | reorder | yes |
| `slice(a, b)` | copy from `a` up to (not including) `b` | no |
| `concat(other)`, `[...a, ...b]` | join into a new array | no |
| `includes`, `indexOf`, `find`, `some`, `every` | search or test | no |
| `map`, `filter`, `reduce` | transform ([[js-functional]]) | no |
| `toSorted()`, `toReversed()` | sorted or reversed **copy** | no |

The last column matters more than it looks. Methods that change the original are called **mutating**. React will not notice a mutated array ([[react-state]]), so modern code prefers the non-mutating ones.

**Twist: the sort trap.**

```js run
console.log([10, 9, 1, 100].sort());
console.log([10, 9, 1, 100].sort((a, b) => a - b));
console.log(['pear', 'Apple', 'fig'].sort((a, b) => a.localeCompare(b)));
```

With no argument, `sort` converts items to strings and compares them as text, so `'10'` comes before `'9'`. Pass a **compare function**: it returns a negative number if `a` should come first, positive if `b` should. `a - b` sorts numbers ascending.

### Finding and testing

```js run
const products = [
  { id: 1, name: 'keyboard', price: 2500, inStock: true },
  { id: 2, name: 'mouse', price: 700, inStock: false },
  { id: 3, name: 'monitor', price: 9000, inStock: true },
];

console.log(products.find(p => p.id === 2).name);
console.log(products.find(p => p.id === 99));
console.log(products.findIndex(p => p.name === 'monitor'));
console.log(products.some(p => p.price > 5000), products.every(p => p.inStock));
console.log(products.filter(p => p.inStock).map(p => p.name));
```

Each of these takes a function and calls it once per item. `find` returns the first item for which the function returns true, or `undefined`. `some` asks "is it true for at least one?", `every` asks "for all?". An array of objects searched this way is the bread and butter of frontend and backend code alike.

## Step 3: destructuring, unpacking in one line

```js run
const user = { name: 'Asha', age: 22, address: { city: 'Jaipur' } };

const { name, age, role = 'member', address: { city } } = user;
console.log(name, age, role, city);

const { name: userName, ...rest } = user;
console.log(userName, rest);

const [first, second = 'none', ...others] = ['gold', 'silver', 'bronze', 'iron'];
console.log(first, second, others);

let a = 1, b = 2;
[a, b] = [b, a];
console.log(a, b);
```

**Read it slowly.** `const { name, age } = user` means "make variables `name` and `age` from the properties with those names". `role = 'member'` gives a default when the property is missing. `name: userName` renames. `...rest` collects everything not already taken. Arrays destructure by **position** instead of by name.

**Where you will see it most: function parameters.**

```js run
function createUser({ name, email, role = 'member' }) {
  return `${name} <${email}> as ${role}`;
}
console.log(createUser({ email: 'ravi@example.com', name: 'Ravi' }));
```

Passing one object instead of many arguments means the caller names each value, the order does not matter, and optional settings get defaults. React components receive their props exactly this way.

## Step 4: spread, copying and combining

```js run
const base = { theme: 'light', fontSize: 14 };
const custom = { ...base, fontSize: 18, sidebar: true };
console.log(custom, base);

const morning = ['tea'], evening = ['coffee', 'juice'];
const all = [...morning, 'water', ...evening];
console.log(all, Math.max(...[4, 9, 2]));
```

`...` inside `{}` or `[]` **spreads** the contents of one object or array into a new one. Later keys overwrite earlier ones, so `{ ...base, fontSize: 18 }` reads as "a copy of base, but with this change". The original is untouched.

The same three dots mean two opposite things depending on position: in a parameter list or the left side of `=` they **collect** (rest); everywhere else they **expand** (spread).

**Twist: the copy is only one level deep.**

```js run
const original = { name: 'cart', items: ['kb'] };
const copy = { ...original };
copy.name = 'changed';
copy.items.push('mouse');
console.log(original.name, original.items);
```

`name` was copied, but `items` is still the **same array** in both. This is a shallow copy, and why it happens is the whole subject of [[js-values]].

## Step 5: JSON, objects as text

```js run
const order = { id: 7, items: ['kb', 'mouse'], paid: true, note: undefined };

const text = JSON.stringify(order);
console.log(typeof text, text);
const back = JSON.parse(text);
console.log(back.items[1], back === order);

try { JSON.parse('{ name: "Asha" }'); } catch (e) { console.log(e.name); }
```

Networks and files carry text, not objects. **JSON** is a text format that looks like JavaScript object syntax, with stricter rules: keys in double quotes, no functions, no `undefined` (it was dropped above). `JSON.stringify` turns a value into text; `JSON.parse` turns it back into a **new** object. Every API request and response body in [[rest-api]] is JSON.

## Step 6: Map and Set

```js run
const seen = new Set(['a', 'b', 'a', 'c', 'b']);
console.log(seen.size, seen.has('a'), [...seen]);
console.log([...new Set([3, 1, 3, 2, 1])]);

const visits = new Map();
for (const page of ['home', 'cart', 'home']) visits.set(page, (visits.get(page) ?? 0) + 1);
console.log(visits.get('home'), [...visits.entries()]);
```

| | Plain object | `Map` | `Set` |
| --- | --- | --- | --- |
| Holds | string keys to values | **any** key to values, in insertion order | unique values |
| Size | `Object.keys(o).length` | `.size` | `.size` |
| Use for | a record with known fields | a lookup table or counter | "have I seen this?", removing duplicates |

`[...new Set(array)]` is the standard one-liner to remove duplicates.

!!! key
- Dot for known keys, brackets for keys in a variable. Missing property is `undefined`.
- `?.` before reading into something that may be absent.
- Know which array methods mutate.
- `sort` needs a compare function for numbers.
- Destructuring with defaults and renaming; rest vs spread.
- Spread makes a **shallow** copy.
- JSON is text. `stringify` out, `parse` in.
!!!

!!! trap
- `Cannot read properties of undefined`: you read a property of something that was not there. Find which part of the chain is missing.
- `array.length = 0`, `arr[10] = x` and `delete arr[1]` all do surprising things. Use `push`, `splice` and `filter`.
- `const copy = original` does not copy anything. Both names point to the same object.
- Checking for an empty array with `if (arr)`. An empty array is truthy; check `arr.length === 0`.
- `typeof []` is `'object'`. Use `Array.isArray`.
!!!

!!! twist What changes if...
- **...the key order matters or keys are not strings?** Use a `Map`.
- **...you need to loop over an object?** `for (const [key, value] of Object.entries(obj))`.
- **...you need a real independent copy of nested data?** `structuredClone(obj)`, explained in [[js-values]].
- **...the list has 100,000 items and you search it often?** An array `find` checks items one by one. Build a `Map` from id to item once and look up instantly, the same idea as a database index ([[mongo-indexes]]).
!!!

!!! model
An object is a labelled drawer unit; an array is a numbered shelf. Destructuring takes things out by label or position; spread tips the contents into a new container.
!!!

## Practice

?? Count how many times each word appears in `'the cat and the hat and the bat'`.
Split into an array, then build up an object (or Map) of counts.

```js run
const counts = {};
for (const word of 'the cat and the hat and the bat'.split(' ')) counts[word] = (counts[word] ?? 0) + 1;
console.log(counts);
```
??

?? Given an array of users, return the names of adults sorted by age, oldest first, without changing the original array.
```js run
const users = [{ name: 'Asha', age: 22 }, { name: 'Kabir', age: 15 }, { name: 'Meera', age: 31 }];
const result = users.filter(u => u.age >= 18).toSorted((a, b) => b.age - a.age).map(u => u.name);
console.log(result, users.map(u => u.name));
```
??

?? What does this print? `const { a, b = 5, ...c } = { a: 1, x: 2, y: 3 }; console.log(a, b, c);`
`1 5 { x: 2, y: 3 }`. `a` is taken from the object, `b` is missing so its default is used, and `c` collects the remaining properties.
??

?? Group these products by category into an object of arrays.
```js run
const items = [{ n: 'kb', cat: 'input' }, { n: 'mouse', cat: 'input' }, { n: 'monitor', cat: 'display' }];
const byCategory = {};
for (const item of items) (byCategory[item.cat] ??= []).push(item.n);
console.log(byCategory);
```
`??=` assigns only if the left side is `null` or `undefined`, so the array is created the first time a category is seen.
??

?? Merge two settings objects so that the user's settings win, without changing either.
`const merged = { ...defaults, ...userSettings };` The later spread overwrites matching keys. Remember that nested objects are replaced as a whole, not merged, because the copy is shallow.
??

?? Remove duplicates from `[3, 1, 3, 2, 1]` and return them sorted ascending.
`[...new Set([3, 1, 3, 2, 1])].sort((a, b) => a - b)` gives `[1, 2, 3]`.
??
