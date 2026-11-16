---
summary: A program makes decisions, repeats work and packages steps so they can be reused. Conditions, loops and functions are the three tools, and functions are the one the rest of JavaScript is built around.
time: 35
needs: js-basics
---
## The problem this solves

With only variables ([[js-basics]]) a program runs top to bottom once and does the same thing every time. Real programs need three more abilities:

1. **Decide**: do this *or* that, depending on a value.
2. **Repeat**: do something for every item, or until something is true.
3. **Reuse**: name a set of steps and run them whenever needed, with different inputs.

## Step 1: decide with `if`

```js run
const marks = 72;

if (marks >= 90) {
  console.log('Grade A');
} else if (marks >= 60) {
  console.log('Grade B');
} else {
  console.log('Grade C');
}
```

**What happened.** JavaScript checks each condition from the top and runs the first block whose condition is truthy, then skips the rest. `72 >= 90` is false, `72 >= 60` is true, so it prints Grade B and never looks at the `else`.

**Twist: order matters.**

```js run
const marks = 95;
if (marks >= 60) console.log('Grade B');
else if (marks >= 90) console.log('Grade A');
```

95 gets a B, because the first true condition wins. Always put the most specific condition first.

For a short either-or, the **ternary** operator fits on one line: `condition ? valueIfTrue : valueIfFalse`.

```js run
const age = 16;
const ticket = age >= 18 ? 'adult' : 'child';
console.log(ticket);
```

## Step 2: repeat with loops

```js run
for (let i = 1; i <= 3; i++) {
  console.log('lap', i);
}

const fruits = ['mango', 'kiwi', 'plum'];
for (const fruit of fruits) {
  console.log(fruit.toUpperCase());
}

let n = 20, steps = 0;
while (n > 1) { n = n / 2; steps++; }
console.log('halved', steps, 'times');
```

| Loop | Use when | Reads as |
| --- | --- | --- |
| `for (let i = 0; i < n; i++)` | you need the counter | start; keep going while; after each lap |
| `for (const item of list)` | you want each item of an array or string | "for each item of the list" |
| `while (condition)` | you do not know the number of laps in advance | "as long as this is true" |

**Twist: `break` and `continue`.**

```js run
for (const n of [3, 8, -1, 5, 12]) {
  if (n < 0) continue;
  if (n > 10) break;
  console.log(n);
}
```

`continue` skips to the next lap (so `-1` is not printed). `break` leaves the loop entirely (so the loop stops at `12`).

## Step 3: functions

A function is a named recipe. You **define** it once and **call** it as many times as you want.

```js run
function area(width, height) {
  return width * height;
}

console.log(area(3, 4));
console.log(area(10, 2));
const total = area(3, 4) + area(10, 2);
console.log(total);
```

**The vocabulary.** `width` and `height` are **parameters**: placeholders in the recipe. `3` and `4` are **arguments**: the real values for one call. `return` hands a result back to the caller and ends the function. The call `area(3, 4)` *becomes* the value `12`, which is why it can be used inside a bigger expression.

**Twist: forget the `return`.**

```js run
function areaBroken(width, height) {
  width * height;
}
console.log(areaBroken(3, 4));
```

A function with no `return` gives back `undefined`. This is the single most common beginner bug: the calculation happened, and the result was thrown away.

### Three ways to write a function

```js run
function double(n) { return n * 2; }

const triple = function (n) { return n * 3; };

const square = n => n * n;
const add = (a, b) => a + b;
const greet = name => {
  const message = `Hi, ${name}`;
  return message;
};

console.log(double(4), triple(4), square(4), add(4, 1), greet('Ravi'));
```

| Form | Looks like | Note |
| --- | --- | --- |
| Declaration | `function name() {}` | can be called before the line it is written on ([[js-execution-context]]) |
| Expression | `const name = function () {}` | a function stored in a variable |
| Arrow | `const name = (a, b) => a + b` | shortest; with one expression and no braces, the result is returned automatically |

An arrow function with braces needs an explicit `return`, like `greet` above. Arrows also treat `this` differently, which matters later ([[js-this]]).

**The idea to hold on to:** a function is a **value**, like a number or a string. It can be stored in a variable, put in an array, passed to another function, and returned from one. Half of JavaScript's power comes from that one fact ([[js-closures]], [[js-functional]]).

### Parameters: defaults, missing and extra

```js run
function order(item, quantity = 1, ...notes) {
  return `${quantity} x ${item}` + (notes.length ? ` (${notes.join(', ')})` : '');
}
console.log(order('tea'));
console.log(order('tea', 3));
console.log(order('tea', 2, 'no sugar', 'extra hot'));

function show(a, b) { return `${a} and ${b}`; }
console.log(show('only one'));
```

- `quantity = 1` is a **default**: used when the argument is missing.
- `...notes` is a **rest parameter**: it collects all remaining arguments into an array.
- JavaScript does not complain about missing arguments. The parameter is simply `undefined`.

## Step 4: scope, where a name can be seen

```js run
const site = 'Interchange';

function welcome() {
  const greeting = 'Welcome to';
  if (true) {
    const mark = '!';
    console.log(greeting, site + mark);
  }
  try { console.log(mark); } catch (e) { console.log('outside the block:', e.message); }
}
welcome();
try { console.log(greeting); } catch (e) { console.log('outside the function:', e.message); }
```

A name declared with `const` or `let` exists only inside the nearest pair of braces `{ }`. Code inside can see names from outside (`welcome` can read `site`). Code outside cannot see in. This keeps names in one function from colliding with names in another. How the engine implements this is the subject of [[js-execution-context]].

## Step 5: writing functions well

**Early return** removes nesting. Compare:

```js run
function shippingNested(order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.total >= 50000) { return 0; } else { return 4000; }
    } else { return null; }
  } else { return null; }
}
function shipping(order) {
  if (!order || order.items.length === 0) return null;
  if (order.total >= 50000) return 0;
  return 4000;
}
const sample = { items: ['kb'], total: 62000 };
console.log(shippingNested(sample), shipping(sample), shipping(null), shipping({ items: ['ms'], total: 9000 }));
```

Both give the same answers. The second handles the unusual cases first and leaves, so the main logic is not buried.

**Pure functions.** A function is *pure* if its result depends only on its arguments and it changes nothing outside itself.

```js run
let taxRate = 0.18;
const impure = price => price + price * taxRate;
const pure = (price, rate) => price + price * rate;

console.log(impure(100));
taxRate = 0.05;
console.log(impure(100), '<- same input, different answer');
console.log(pure(100, 0.18), pure(100, 0.18));
```

A pure function can be tested with one line and can never surprise you. Prefer them. React components and Redux reducers are required to be pure ([[react-rendering]]).

!!! key
- `if / else if / else`: first true branch wins. Ternary for a simple either-or.
- `for...of` for items, classic `for` when you need the index, `while` when the count is unknown.
- Parameters vs arguments. No `return` means `undefined`.
- Declaration vs expression vs arrow.
- Functions are values. Keep saying this to yourself.
- Block scope for `let`/`const`: inside can see out, outside cannot see in.
!!!

!!! trap
- `=> { value }` returns `undefined`; braces need `return`. To return an object from a one-line arrow, wrap it: `() => ({ id: 1 })`.
- An endless `while` loop because nothing inside changes the condition.
- `for...in` on an array gives the **indexes as strings**, not the items. Use `for...of`.
- A missing `break` in a `switch` makes execution "fall through" into the next case.
- Calling a function vs referring to it: `save` is the function, `save()` runs it. `button.onclick = save()` runs it immediately and stores the result.
!!!

!!! twist What changes if...
- **...a function calls itself?** That is recursion: it needs a case that stops (the base case), or the call stack overflows ([[js-execution-context]]).
- **...you pass a function to a function?** You get callbacks, and with them `map`, `filter` and event handlers ([[js-functional]]).
- **...a function returns a function?** The returned one remembers the variables around it. That is a closure ([[js-closures]]).
!!!

!!! model
`if` picks a path, a loop walks a path many times, and a function is a path with a name, inputs and one output.
!!!

## Practice

?? Write `fizzBuzz(n)`: print numbers 1 to n, but "Fizz" for multiples of 3, "Buzz" for 5, "FizzBuzz" for both.
Check the most specific case (both) first.

```js run
function fizzBuzz(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) out.push('FizzBuzz');
    else if (i % 3 === 0) out.push('Fizz');
    else if (i % 5 === 0) out.push('Buzz');
    else out.push(i);
  }
  return out.join(' ');
}
console.log(fizzBuzz(15));
```
??

?? Write `isPrime(n)`.
A prime has no divisor between 2 and its square root. Return early as soon as one is found.

```js run
function isPrime(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}
console.log([1, 2, 9, 17, 91, 97].map(n => `${n}:${isPrime(n)}`).join('  '));
```
??

?? What does this print and why? `const f = () => { a: 1 }; console.log(f());`
`undefined`. The braces are read as a function body, not an object, and `a: 1` is treated as a label followed by the expression `1`. There is no `return`. Write `() => ({ a: 1 })`.
??

?? Write `sum(...numbers)` that works for any number of arguments, and `factorial(n)` using recursion.
```js run
const sum = (...numbers) => { let total = 0; for (const n of numbers) total += n; return total; };
const factorial = n => n <= 1 ? 1 : n * factorial(n - 1);
console.log(sum(), sum(1, 2, 3, 4), factorial(5));
```
??

?? What is the difference between a parameter and an argument?
A parameter is the name in the function definition (`width` in `function area(width, height)`). An argument is the actual value supplied in a call (`3` in `area(3, 4)`).
??
