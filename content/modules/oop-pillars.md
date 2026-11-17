---
summary: Object-oriented programming bundles data with the code that works on it. This station starts from loose variables and functions, arrives at classes, and builds the four pillars one at a time. Encapsulation, abstraction, inheritance and polymorphism.
time: 45
needs: js-objects-arrays, js-prototypes
---
## The problem this solves

A program models things: accounts, orders, users. Without structure, the data for a thing lives in some variables and the rules about it live in functions scattered elsewhere.

```js run
const account = { owner: 'Asha', balance: 1000 };

function withdraw(acc, amount) {
  if (amount > acc.balance) return 'insufficient funds';
  acc.balance -= amount;
  return 'ok';
}

console.log(withdraw(account, 300), account.balance);
account.balance = -50000;
console.log('any code anywhere can do this:', account.balance);
```

The rule "the balance never goes below zero" exists only inside `withdraw`. Nothing stops other code from skipping it. As the program grows, nobody can be sure which code touches the balance or whether the rule still holds.

**Object-oriented programming (OOP)** fixes this by putting the data and the functions that are allowed to change it **together in one unit**, and hiding the data from everything else.

Examples run in JavaScript so the output is real. The ideas are the same in Java and C++; where the syntax differs, the tables show it. How JavaScript implements classes underneath is in [[js-prototypes]].

## Class and object

```js run
class BankAccount {
  constructor(owner, openingBalance) {
    this.owner = owner;
    this.balance = openingBalance;
  }
  deposit(amount) { this.balance += amount; }
  describe() { return `${this.owner} has Rs ${this.balance}`; }
}

const a = new BankAccount('Asha', 1000);
const b = new BankAccount('Ravi', 250);
a.deposit(500);

console.log(a.describe());
console.log(b.describe());
console.log(a instanceof BankAccount, typeof a);
```

| Term | Meaning | Here |
| --- | --- | --- |
| **Class** | a blueprint: what data each thing has and what it can do | `BankAccount` |
| **Object** (instance) | one concrete thing made from the blueprint | `a`, `b` |
| **Field** (attribute, state) | data stored in an object | `owner`, `balance` |
| **Method** (behaviour) | a function that belongs to the class | `deposit`, `describe` |
| **Constructor** | runs once when an object is created, to set it up | `constructor(owner, openingBalance)` |
| **`this`** | the particular object the method was called on | `a` inside `a.deposit(500)` ([[js-this]]) |

One class, many objects. Each object has its **own** data (`a` and `b` have different balances) and **shares** the methods.

## Pillar 1: encapsulation

**Keep an object's data private and allow changes only through methods that enforce the rules.**

```js run
class BankAccount {
  #balance = 0;
  #history = [];
  constructor(owner, openingBalance = 0) { this.owner = owner; this.deposit(openingBalance); }

  deposit(amount) {
    if (!Number.isInteger(amount) || amount <= 0) throw new RangeError('deposit must be a positive whole amount');
    this.#balance += amount;
    this.#history.push({ type: 'deposit', amount });
  }
  withdraw(amount) {
    if (amount > this.#balance) throw new Error('insufficient funds');
    this.#balance -= amount;
    this.#history.push({ type: 'withdraw', amount });
  }
  get balance() { return this.#balance; }
  get history() { return [...this.#history]; }
}

const acc = new BankAccount('Asha', 1000);
acc.withdraw(300);
console.log('balance:', acc.balance);

try { acc.withdraw(5000); } catch (e) { console.log('rule enforced:', e.message); }
acc.balance = -50000;
console.log('assigning to balance does nothing:', acc.balance);
acc.history.push({ type: 'fake' });
console.log('history cannot be tampered with:', acc.history.length, 'entries');
console.log('acc.#balance from outside is a syntax error; the field is invisible:', Object.keys(acc));
```

`#balance` is a **private field**: only code inside the class can touch it. The outside world gets a read-only view (`get balance()`) and two methods that check the rules. Now the invariant "balance is never negative" is guaranteed by the class itself; there is exactly one place where it could be broken, and that place checks.

Note `get history()` returns a **copy**. Returning the real array would hand outsiders a reference to private data ([[js-values]]).

| | JavaScript | Java / C++ |
| --- | --- | --- |
| Private | `#field` | `private` |
| Visible to subclasses | (convention: `_field`) | `protected` |
| Public | default | `public` |

**Why it matters.** You can change how the class works inside (store paise instead of rupees, add an audit log) and no other code breaks, because nobody depended on the internals.

## Pillar 2: abstraction

**Show what an object does; hide how it does it.**

```js run
class EmailService {
  send(to, subject, body) {
    this.#connect();
    const message = this.#format(to, subject, body);
    const id = this.#transmit(message);
    this.#disconnect();
    return id;
  }
  #connect() { /* open a connection, authenticate */ }
  #format(to, subject, body) { return `To: ${to}\nSubject: ${subject}\n\n${body}`; }
  #transmit(message) { return 'msg_' + message.length; }
  #disconnect() {}
}

const mailer = new EmailService();
console.log(mailer.send('asha@example.com', 'Welcome', 'Thanks for joining'));
```

The caller knows one thing: `send(to, subject, body)`. Connecting, formatting and transmitting are hidden. You drive a car with a wheel and pedals without knowing how the engine works; the wheel and pedals are the abstraction.

| | Encapsulation | Abstraction |
| --- | --- | --- |
| About | **protecting** data | **simplifying** use |
| Question | who may change this state? | what does the user of this object need to know? |
| Achieved with | private fields, methods that validate | a small public interface; abstract classes and interfaces |

They work together and are often confused: encapsulation is the mechanism, abstraction is the design goal.

### Abstract classes and interfaces

```js run
class Shape {
  constructor(name) {
    if (new.target === Shape) throw new TypeError('Shape is abstract: create a Circle or Rectangle');
    this.name = name;
  }
  area() { throw new Error(`${this.constructor.name} must implement area()`); }
  describe() { return `${this.name} with area ${this.area().toFixed(1)}`; }
}
class Circle extends Shape {
  constructor(radius) { super('circle'); this.radius = radius; }
  area() { return Math.PI * this.radius ** 2; }
}
class Blob extends Shape { constructor() { super('blob'); } }

console.log(new Circle(2).describe());
try { new Shape('?'); } catch (e) { console.log(e.message); }
try { new Blob().describe(); } catch (e) { console.log(e.message); }
```

An **abstract class** is an incomplete blueprint: it defines what every shape has (`describe`) and declares what each kind must supply (`area`), but cannot be instantiated itself. An **interface** is a pure contract with no implementation at all: "anything that has `area()`".

| | Abstract class | Interface |
| --- | --- | --- |
| Can hold fields and implemented methods | yes | no (only signatures; modern Java allows default methods) |
| A class can use how many | one (single inheritance) | many |
| Says | "is a kind of" | "can do" |
| Java | `abstract class Shape` | `interface Drawable` |
| C++ | a class with at least one pure virtual function (`= 0`) | a class with only pure virtual functions |

JavaScript has neither keyword, so the check is done at run time as above; TypeScript adds both.

## Pillar 3: inheritance

**A new class can be built from an existing one, reusing its fields and methods and adding or changing some.**

```js run
class Employee {
  constructor(name, baseSalary) { this.name = name; this.baseSalary = baseSalary; }
  pay() { return this.baseSalary; }
  describe() { return `${this.name} (${this.constructor.name}) earns ${this.pay()}`; }
}
class Manager extends Employee {
  constructor(name, baseSalary, teamSize) {
    super(name, baseSalary);
    this.teamSize = teamSize;
  }
  pay() { return super.pay() + this.teamSize * 5000; }
}
class Intern extends Employee {
  pay() { return Math.round(this.baseSalary * 0.4); }
}

for (const person of [new Employee('Asha', 80000), new Manager('Ravi', 120000, 6), new Intern('Meera', 50000)])
  console.log(person.describe());
console.log(new Manager('x', 1, 1) instanceof Employee);
```

`Manager` and `Intern` are **subclasses** (children) of `Employee`, the **superclass** (parent). They inherit `describe` without rewriting it.

- `extends` creates the "is a" relationship: a manager **is an** employee.
- `super(...)` calls the parent's constructor, and must come before using `this`.
- Defining `pay` again in a subclass is **overriding**. `super.pay()` calls the parent's version.

**When inheritance is right.** Only for a true "is a" relationship where the child can be used anywhere the parent is expected. Using it just to reuse code leads to rigid hierarchies; the alternative is composition, the subject of [[oop-composition]].

| Type | Meaning | Supported |
| --- | --- | --- |
| Single | one parent | all OOP languages |
| Multilevel | A → B → C | all |
| Hierarchical | several children of one parent | all |
| Multiple | a class with two parent classes | C++ yes (with the "diamond problem"); Java and JavaScript no, they use interfaces or mixins instead |

## Pillar 4: polymorphism

**The same call does the right thing for each kind of object.**

Look again at the loop above: `person.describe()` and, inside it, `this.pay()` ran three different `pay` methods. The loop does not check which kind of employee it has. That is polymorphism ("many forms").

```js run
class Notifier { send(message) { throw new Error('not implemented'); } }
class EmailNotifier extends Notifier { send(m) { return `email: ${m}`; } }
class SmsNotifier extends Notifier { send(m) { return `sms: ${m.slice(0, 20)}`; } }
class PushNotifier extends Notifier { send(m) { return `push: ${m}`; } }

function notifyAll(notifiers, message) {
  return notifiers.map(n => n.send(message));
}
console.log(notifyAll([new EmailNotifier(), new SmsNotifier(), new PushNotifier()], 'Your order has shipped and will arrive on Friday'));

class WhatsAppNotifier extends Notifier { send(m) { return `whatsapp: ${m}`; } }
console.log(notifyAll([new WhatsAppNotifier()], 'added later; notifyAll was not edited'));
```

`notifyAll` is written against the general type `Notifier`. Adding WhatsApp required a new class and **zero changes** to existing code. Compare with the alternative:

```js
function notifyAllWithoutPolymorphism(channels, message) {
  for (const c of channels) {
    if (c.type === 'email') { /* ... */ }
    else if (c.type === 'sms') { /* ... */ }
    else if (c.type === 'push') { /* ... */ }
    // every new channel means editing this function, and every other function like it
  }
}
```

Polymorphism replaces `if/else` on a type with a method call. This is the foundation of almost every design pattern ([[lld-behavioral]], [[lld-creational]]).

| Kind | Decided | How | Example |
| --- | --- | --- | --- |
| **Runtime** (dynamic, overriding) | while the program runs, from the object's actual class | a subclass redefines a parent method | `person.pay()` above |
| **Compile-time** (static, overloading) | by the compiler, from the argument types | several methods with the same name and different parameters | `print(int)` and `print(String)` in Java or C++ |

JavaScript has no overloading: a second function with the same name replaces the first. You get the effect with default or rest parameters ([[js-functions-flow]]). How C++ and Java find the right overridden method at run time (the vtable) is [[oop-cpp-internals]].

## Static members

```js run
class Order {
  static #count = 0;
  static TAX_RATE = 0.18;
  constructor(amount) { this.amount = amount; this.id = ++Order.#count; }
  total() { return Math.round(this.amount * (1 + Order.TAX_RATE)); }
  static created() { return Order.#count; }
}
const first = new Order(1000), second = new Order(2000);
console.log(first.id, second.id, second.total(), '| orders created:', Order.created());
```

A **static** field or method belongs to the class itself, not to any object. There is one copy, shared. Use it for constants, counters and helper functions that do not need a particular instance.

## The four pillars together

| Pillar | One line | Buys you |
| --- | --- | --- |
| Encapsulation | hide the data, expose methods that guard it | invariants that cannot be broken from outside |
| Abstraction | expose what, hide how | simple use; freedom to change internals |
| Inheritance | build a class from another | reuse and "is a" hierarchies |
| Polymorphism | one call, many behaviours | new types without editing existing code |

!!! key
- Class is the blueprint, object is the instance, each with its own state.
- Encapsulation protects state; abstraction simplifies the interface. Be able to distinguish them.
- Inheritance is for "is a". `super` reaches the parent.
- Overriding (runtime polymorphism) vs overloading (compile-time).
- Abstract class vs interface, and when to use each.
- Access modifiers: private, protected, public.
- Polymorphism is what removes `if (type === ...)` chains.
!!!

!!! trap
- Making every field public with a getter and setter for each. That is not encapsulation; the rules are still outside the class.
- Inheritance for code reuse between things that are not in an "is a" relationship (`Stack extends ArrayList`).
- Deep hierarchies: a change in a base class ripples through every descendant.
- Confusing overloading with overriding.
- Forgetting `super()` in a subclass constructor.
- Returning a reference to a private collection.
!!!

!!! twist What changes if...
- **...two unrelated classes need the same ability (both `Bird` and `Plane` can fly)?** An interface, or composition with a shared helper object ([[oop-composition]]).
- **...you are asked for the diamond problem?** `D` inherits from `B` and `C`, which both inherit from `A` and override a method. Which version does `D` get? C++ needs virtual inheritance to resolve it; Java avoids it by allowing only one parent class.
- **...an object must be copied?** Shallow vs deep copy, and copy constructors in C++ ([[js-values]], [[lld-creational]] Prototype).
- **...you are asked whether JavaScript is object-oriented?** Yes, through prototypes: objects inherit directly from other objects, and `class` is syntax over that ([[js-prototypes]]).
!!!

!!! model
An object is a small machine with a casing: buttons on the outside (public methods), wiring on the inside (private state). Related machines share a design (inheritance), and anything with the same buttons can be swapped in (polymorphism).
!!!

## Practice

?? Explain the four pillars using a single example of your choice.
A `Payment` system. Encapsulation: a `Wallet` keeps `#balance` private and only `debit()` and `credit()` change it, each validating the amount. Abstraction: callers use `payment.pay(amount)` and never see the gateway calls, retries or encryption. Inheritance: `CardPayment` and `UpiPayment` extend an abstract `Payment` that holds shared logic such as logging. Polymorphism: `checkout(payment)` calls `payment.pay()` and works for any current or future payment type.
??

?? What is the difference between encapsulation and abstraction?
Encapsulation bundles data with methods and restricts direct access, protecting the object's state. Abstraction exposes only the essential operations and hides implementation detail, reducing what a user must understand. Encapsulation is how you hide; abstraction is what you choose to show.
??

?? Overloading vs overriding, with one example each.
Overloading: several methods in the same class with the same name and different parameter lists, chosen at compile time, such as `add(int, int)` and `add(double, double)`. Overriding: a subclass provides its own version of a method inherited from its parent with the same signature, chosen at run time by the object's actual type, such as `Dog.speak()` replacing `Animal.speak()`.
??

?? When would you choose an abstract class over an interface?
An abstract class when subclasses share state or implemented behaviour and form a real "is a" family (`Shape` with a common `describe`). An interface when unrelated classes must offer the same capability (`Comparable`, `Serializable`), or when a class needs several such contracts.
??

?? Write a `Stack` class with `push`, `pop`, `peek`, `size` that hides its storage and throws on popping when empty.
```js run
class Stack {
  #items = [];
  push(value) { this.#items.push(value); return this; }
  pop() { if (this.#items.length === 0) throw new Error('stack is empty'); return this.#items.pop(); }
  peek() { return this.#items.at(-1); }
  get size() { return this.#items.length; }
}
const s = new Stack().push(1).push(2).push(3);
console.log(s.pop(), s.peek(), s.size);
s.pop(); s.pop();
try { s.pop(); } catch (e) { console.log(e.message); }
```
Because the array is private, nobody can reach in and remove from the middle; the stack discipline is guaranteed.
??
