---
summary: The value of this is not decided where a function is written. It is decided at the moment the function is called. Four rules cover every case.
time: 25
needs: js-execution-context, js-closures
videoSearch: JavaScript this keyword call apply bind explained
---
## The problem this solves

The same function can be shared by many objects, so it needs a way to refer to "the object I am working on right now". That is `this`. The confusion comes from one fact that differs from scope: variables are resolved by where code is **written** ([[js-closures]]), but `this` is resolved by how the function is **called**.

## Intuition

Look at the call site, not the function body. Ask one question: *what is to the left of the dot when the function is called?*

## Build it step by step

### Example 1: the four binding rules

```js run
'use strict';
function who() { return this === undefined ? 'undefined' : this.name; }

const user = { name: 'user', who };
console.log('1 implicit :', user.who());
console.log('2 explicit :', who.call({ name: 'explicit' }));
function Person(name) { this.name = name; }
console.log('3 new      :', new Person('fresh object').name);
console.log('4 default  :', who());
```

| Rule | Call site looks like | `this` is |
| --- | --- | --- |
| `new` binding | `new Fn()` | the newly created object |
| Explicit binding | `fn.call(obj)`, `fn.apply(obj)`, `fn.bind(obj)()` | `obj` |
| Implicit binding | `obj.fn()` | `obj` (whatever is left of the last dot) |
| Default binding | `fn()` | `undefined` in strict mode, the global object in sloppy mode |

When more than one applies, precedence runs top to bottom: `new` beats `bind`, which beats the dot, which beats the default.

### Example 2: losing `this`, the classic bug

```js run
'use strict';
const account = {
  owner: 'Asha',
  describe() { return 'owner is ' + this.owner; },
};
console.log(account.describe());

const detached = account.describe;
try { detached(); } catch (e) { console.log(e.name + ': ' + e.message); }

const fixed = account.describe.bind(account);
console.log(fixed());
```

`detached` is the same function, but the call site `detached()` has no dot, so the default rule applies. This happens whenever a method is **passed as a callback**: `setTimeout(account.describe, 0)`, `button.addEventListener('click', obj.handle)`, or an Express route `router.get('/', controller.list)`.

### Example 3: arrow functions have no `this` of their own

```js run
'use strict';
const timer = {
  label: 'timer',
  regular() { return [1].map(function () { return this === undefined ? 'undefined' : this.label; })[0]; },
  arrow() { return [1].map(() => this.label)[0]; },
};
console.log('regular callback:', timer.regular());
console.log('arrow callback  :', timer.arrow());

const broken = { label: 'obj', isMe: () => this === broken };
console.log('arrow as method, this is the object?', broken.isMe());
```

An arrow function does not get its own `this`. It reads `this` from the enclosing scope like any other variable, so it is fixed at the place the arrow was created. That makes arrows ideal for callbacks inside methods and wrong for methods themselves: in `broken.isMe` the enclosing scope is the module, so `this` is not `broken`.

### Example 4: call, apply, bind

```js run
function intro(greeting, punctuation) { return `${greeting}, I am ${this.name}${punctuation}`; }
const dev = { name: 'Ravi' };

console.log(intro.call(dev, 'Hi', '!'));
console.log(intro.apply(dev, ['Hello', '.']));
const later = intro.bind(dev, 'Hey');
console.log(later('?'));
console.log(Math.max.apply(null, [3, 9, 4]));
```

| Method | Calls now? | Arguments | Typical use |
| --- | --- | --- | --- |
| `call(thisArg, a, b)` | yes | listed one by one | borrow a method |
| `apply(thisArg, [a, b])` | yes | one array | arguments already in an array |
| `bind(thisArg, a)` | no, returns a new function | optionally pre-filled | callbacks, partial application |

## The rule, stated precisely

For a normal function, `this` is set when the call's execution context is created ([[js-execution-context]]), from the call site, using the four rules in precedence order. For an arrow function, `this` is not set at all; the name resolves through the scope chain. `bind` returns a wrapper whose `this` can never be changed again by `call`, `apply` or another `bind`; only `new` overrides it.

!!! key
- "How is it called?" decides `this`. Say this first in any answer.
- Arrow functions: lexical `this`, cannot be used with `new`, ignore `call`/`apply`/`bind` for `this`.
- Class bodies and ES modules are always strict, so a detached method gives `undefined`, not `window`.
- Be ready to implement `bind` yourself (below).
!!!

!!! trap
- Passing `obj.method` as a callback and expecting `this` to follow it.
- Using an arrow function as an object method or as a prototype method.
- Thinking `this` refers to the function itself or to its scope. It is neither.
- In a DOM event listener written as a normal function, `this` is the element. Written as an arrow, it is whatever `this` was outside.
!!!

!!! twist What changes if...
- **...the call is `a.b.c.fn()`?** Only the last object counts: `this` is `a.b.c`.
- **...you write `(obj.fn)()` vs `(0, obj.fn)()`?** The first keeps `this = obj`. The comma expression returns the bare function, so the second loses it.
- **...a constructor returns an object explicitly?** That object replaces the new one. Returning a primitive is ignored.
!!!

!!! model
Scope is where the function was born. `this` is who is holding it when it is called. Arrows have no holder and just look outward.
!!!

## Practice

?? Write your own `bind` (a polyfill).
Return a function that calls the original with the fixed `this` and both sets of arguments.

```js run
Function.prototype.myBind = function (thisArg, ...preset) {
  const original = this;
  return function (...later) { return original.apply(thisArg, [...preset, ...later]); };
};
function add(a, b) { return this.base + a + b; }
console.log(add.myBind({ base: 100 }, 1)(2));
```

Here `this` inside `myBind` is the function being bound, by the implicit rule (`add.myBind(...)`). A complete polyfill also handles being called with `new`.
??

?? What prints? `const o = { n: 1, f() { return () => this.n; } }; const g = o.f(); console.log(g.call({ n: 2 }));`
`1`. The arrow captured `this` from the call `o.f()`, where `this` was `o`. `call` cannot change an arrow's `this`.
??

?? What prints in strict mode? `const o = { n: 1, f() { return this.n; } }; const { f } = o; f();`
It throws a `TypeError`. Destructuring pulls the function off the object, so `f()` is a plain call and `this` is `undefined`.
??

?? Why do React class components bind handlers in the constructor, and why do function components not need to?
`onClick={this.handleClick}` passes the method detached, so `this` would be `undefined` when React calls it. `this.handleClick = this.handleClick.bind(this)` or an arrow class field fixes it. Function components have no `this`; handlers reach state through closures instead.
??

?? What are the four steps `new Fn()` performs?
1. Create an empty object. 2. Link its prototype to `Fn.prototype` (see [[js-prototypes]]). 3. Call `Fn` with `this` set to that object. 4. Return the object, unless `Fn` returned its own object.
??

?? `const bound = fn.bind(a).bind(b)`. Which object is `this`?
`a`. The first `bind` fixes `this` permanently; the second wraps a function that already ignores the `this` it is given.
??
