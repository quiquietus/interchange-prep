---
summary: Start here if you are new. A program stores values in named boxes and combines them. This station covers the boxes (variables), what can go in them (types) and how to combine them (operators).
time: 30
---
## The problem this solves

A program has to remember things: a user's name, a price, whether someone is logged in. It needs a way to **store a value, give it a name, and use it later**. That is all a variable is. Everything else in JavaScript is built on this.

You can run every example here yourself: save it as `test.js` and run `node test.js`, or paste it in the browser console (F12).

## Step 1: a variable is a named box

```js run
let score = 10;
console.log(score);

score = 25;
console.log(score);

const playerName = 'Asha';
console.log(playerName, 'has', score, 'points');
```

**What happened.** `let score = 10` creates a box called `score` and puts `10` in it. `score = 25` replaces what is in the box. `console.log` prints values to the screen. `const` also creates a box, but one that can never be given a new value.

**Twist: try to change a const.**

```js run
const pi = 3.14;
try {
  pi = 3;
} catch (error) {
  console.log(error.name + ': ' + error.message);
}
```

**Why JavaScript has both.** If a value should never change, `const` lets the language catch your mistake for you. So the rule used by almost every team is:

| Keyword | Can be reassigned? | Use it |
| --- | --- | --- |
| `const` | no | by default, for everything |
| `let` | yes | only when the value really must change (a counter, a running total) |
| `var` | yes | never in new code. It is the old way and has confusing scope rules, explained in [[js-execution-context]] |

## Step 2: types, the kinds of values

Every value has a **type**. JavaScript has seven simple types (called **primitives**) and one type for everything else (objects).

```js run
console.log(typeof 42);
console.log(typeof 3.14);
console.log(typeof 'hello');
console.log(typeof true);
console.log(typeof undefined);
console.log(typeof null);
console.log(typeof { name: 'Asha' });
console.log(typeof [1, 2, 3]);
console.log(typeof function () {});
```

| Type | Examples | Meaning |
| --- | --- | --- |
| `number` | `42`, `3.14`, `-7`, `NaN` | all numbers, whole or decimal |
| `string` | `'hi'`, `"hi"`, `` `hi` `` | text |
| `boolean` | `true`, `false` | yes or no |
| `undefined` | `undefined` | "no value has been given yet" |
| `null` | `null` | "deliberately empty" |
| `bigint`, `symbol` | `10n`, `Symbol('id')` | rare; huge integers and unique keys |
| `object` | `{}`, `[]`, functions, dates | a collection of values, covered in [[js-objects-arrays]] |

**Two surprises in that output.** `typeof null` says `'object'`. That is a bug from 1995 that can never be fixed without breaking old websites. And an array says `'object'` too, because arrays *are* objects; use `Array.isArray(x)` to check for one.

**Twist: where does `undefined` come from?**

```js run
let notSetYet;
const user = { name: 'Asha' };
function noReturn() {}

console.log(notSetYet);
console.log(user.age);
console.log(noReturn());
```

Three sources: a variable declared without a value, a property that does not exist, and a function that returns nothing. When you see `undefined` in a bug, it is almost always one of these three.

## Step 3: strings

```js run
const first = 'Asha', city = 'Jaipur';

console.log('Hello, ' + first + ' from ' + city);
console.log(`Hello, ${first} from ${city}`);
console.log(`2 + 3 = ${2 + 3}`);

console.log(first.length, first.toUpperCase(), first[0], first.includes('sh'));
console.log(first);
```

**What happened.** `+` joins strings. Backticks make a **template literal**: anything inside `${ }` is calculated and inserted. Strings have built-in tools (`length`, `toUpperCase`, `includes`, `slice`, `split`, `trim`).

**The important line is the last one.** `first.toUpperCase()` printed `ASHA`, but `first` is still `Asha`. String methods **return a new string**; they never change the original. Primitives cannot be changed, only replaced. This idea, called immutability, returns in a big way in [[js-values]] and in React.

## Step 4: numbers and operators

```js run
console.log(7 + 2, 7 - 2, 7 * 2, 7 / 2);
console.log(7 % 2, 2 ** 10);
console.log(0.1 + 0.2);
console.log(10 / 0, 'abc' * 2);

let count = 5;
count += 3;
count++;
console.log(count);
```

| Operator | Meaning | Note |
| --- | --- | --- |
| `%` | remainder after division | `n % 2 === 0` tests for an even number |
| `**` | power | |
| `+=`, `-=`, `++`, `--` | change a variable in place | only work on `let` |

**Two surprises.** `0.1 + 0.2` is not exactly `0.3`, because computers store decimals in binary and 0.1 has no exact binary form. This is why money is stored as whole paise or cents. And `'abc' * 2` gives `NaN`, "not a number", the result of maths that makes no sense. It does not crash; it quietly produces `NaN`, so check with `Number.isNaN(x)`.

## Step 5: comparing, and the `==` trap

```js run
console.log(5 > 3, 5 >= 5, 5 < 3);
console.log(5 === 5, 5 === '5');
console.log(5 == '5', 0 == '', null == undefined);
console.log(5 !== '5');
```

`===` asks: same type **and** same value? `==` first converts the two sides to the same type and then compares, which gives results like `0 == ''` being `true`.

**Rule: always use `===` and `!==`.** There is nothing to remember and nothing to be surprised by.

## Step 6: turning one type into another

```js run
console.log(Number('42') + 1, Number('42px'), parseInt('42px'), Number(''));
console.log(String(42) + 1, (42).toFixed(2));
console.log('5' + 1, '5' - 1, '5' * '2');
console.log(Boolean(0), Boolean(''), Boolean('0'), Boolean([]), Boolean(null));
```

**What happened in line 3.** With `+`, if either side is a string, JavaScript joins text: `'5' + 1` is `'51'`. Every other maths operator converts to numbers: `'5' - 1` is `4`. This automatic conversion is called **coercion**. The fix is to convert on purpose with `Number(...)` before doing maths with user input, which always arrives as text.

**Truthy and falsy.** In an `if`, any value is treated as true or false. Exactly eight values are **falsy**: `false`, `0`, `-0`, `0n`, `''`, `null`, `undefined`, `NaN`. Everything else is **truthy**, including `'0'`, `[]` and `{}`.

## Step 7: combining conditions

```js run
const age = 20, hasTicket = false;

console.log(age >= 18 && hasTicket);
console.log(age >= 18 || hasTicket);
console.log(!hasTicket);

const nickname = '';
const stock = 0;
console.log(nickname || 'Anonymous');
console.log(stock || 10, stock ?? 10);
```

`&&` is "and", `||` is "or", `!` is "not". The last two lines show a common pattern: `a || b` means "use `a`, unless it is falsy, then use `b`". That is wrong for `stock`, because `0` is a real value. `a ?? b` falls back only when `a` is `null` or `undefined`, so `0 ?? 10` correctly stays `0`.

!!! key
- `const` by default, `let` when it must change, never `var`.
- Seven primitives plus object. `typeof null` is `'object'`; arrays need `Array.isArray`.
- Always `===`.
- `+` with a string joins; convert input with `Number()` first.
- The eight falsy values. `||` vs `??`.
- `undefined` means "nothing was assigned"; `null` means "empty on purpose".
!!!

!!! trap
- `const` does not freeze an object. `const list = []; list.push(1)` works. `const` stops you pointing the name at a different thing; it does not stop the thing changing ([[js-values]]).
- `if (x = 5)` assigns instead of comparing. It is always true.
- Reading a number from an input field and adding: `'5' + 5` is `'55'`.
- Checking `if (count)` when `0` is a valid count.
!!!

!!! twist What changes if...
- **...you need to check for "no value" of either kind?** `value == null` is the one accepted use of `==`: it is true for both `null` and `undefined` and nothing else.
- **...numbers get very large?** Above `Number.MAX_SAFE_INTEGER` (about 9 quadrillion) whole numbers lose precision. Use `BigInt` (`123n`).
- **...you compare two objects?** `{} === {}` is `false`. Objects are compared by identity, not content. That is the first topic of [[js-values]].
!!!

!!! model
A variable is a labelled box. A type is the kind of thing in the box. `const` glues the label on; `let` lets you move it.
!!!

## Practice

?? What does each line print? `console.log(1 + '2'); console.log('3' - 1); console.log(1 + 2 + '3'); console.log('1' + 2 + 3);`
`'12'`, `2`, `'33'`, `'123'`. Evaluation goes left to right. `1 + 2` is `3` and then `3 + '3'` joins to `'33'`. In the last one the string comes first, so every `+` after it joins.

```js run
console.log(1 + '2'); console.log('3' - 1); console.log(1 + 2 + '3'); console.log('1' + 2 + 3);
```
??

?? Which of these are falsy: `'false'`, `0`, `[]`, `' '`, `NaN`, `-1`, `null`?
Only `0`, `NaN` and `null`. `'false'` and `' '` are non-empty strings, `[]` is an object, and `-1` is a non-zero number, so all four are truthy.
??

?? Why is `const` preferred over `let` if both work?
It tells the reader this name will always mean the same thing, and it turns accidental reassignment into an error at that exact line. Fewer things that can change means fewer things to keep in your head.
??

?? Write an expression that is true only if `n` is a whole number between 1 and 100 and even.
`Number.isInteger(n) && n >= 1 && n <= 100 && n % 2 === 0`

```js run
const check = n => Number.isInteger(n) && n >= 1 && n <= 100 && n % 2 === 0;
console.log(check(42), check(7), check(102), check(4.5), check('8'));
```
??

?? What is the difference between `null` and `undefined`, with one example of each?
`undefined` is what JavaScript gives you when nothing was assigned: `let x;` or a missing property. `null` is a value a programmer assigns to say "there is intentionally nothing here": `let selectedUser = null;` before anyone is selected.
??
