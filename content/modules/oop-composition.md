---
summary: Inheritance says "is a". Composition says "has a". Most reuse is better done by giving an object the parts it needs than by making it a subclass. This station shows where inheritance breaks and how composition, interfaces and dependency injection replace it.
time: 35
needs: oop-pillars
---
## The problem this solves

Inheritance ([[oop-pillars]]) is the first reuse tool people learn, so they use it for everything. It works while the world is a tidy tree. Real requirements are not a tree.

```js run
class Bird { fly() { return 'flies'; } eat() { return 'eats'; } }
class Sparrow extends Bird {}
class Penguin extends Bird {
  fly() { throw new Error('penguins cannot fly'); }
}

function migrate(birds) { return birds.map(b => { try { return b.fly(); } catch (e) { return 'CRASH: ' + e.message; } }); }
console.log(migrate([new Sparrow(), new Penguin()]));
```

A penguin "is a" bird, so it inherited `fly`, which it cannot do. Code written for `Bird` now crashes on some birds. The hierarchy promised something that is not true for every subclass. (This is a violation of the Liskov substitution principle, named in [[oop-solid]].)

## Three ways inheritance goes wrong

### 1. The class explosion

Requirements vary along more than one axis. A game character can be a warrior or a mage, and can walk or fly, and can attack by sword or by spell.

```js run
const kinds = ['Warrior', 'Mage', 'Archer'], movement = ['Walking', 'Flying', 'Swimming'], attacks = ['Sword', 'Spell', 'Bow'];
console.log('classes needed with inheritance :', kinds.length * movement.length * attacks.length, '(FlyingSwordWarrior, SwimmingSpellMage, ...)');
console.log('classes needed with composition :', 1 + movement.length + attacks.length, '(one Character + 3 movements + 3 attacks)');
```

Each new option multiplies the subclasses under inheritance and adds one class under composition.

### 2. The fragile base class

```js run
class Collection {
  #items = [];
  add(item) { this.#items.push(item); }
  addAll(items) { for (const item of items) this.add(item); }
  get size() { return this.#items.length; }
}
class CountingCollection extends Collection {
  added = 0;
  add(item) { this.added++; super.add(item); }
  addAll(items) { this.added += items.length; super.addAll(items); }
}
const c = new CountingCollection();
c.addAll(['a', 'b', 'c']);
console.log('items stored:', c.size, '| counter says:', c.added);
```

Three items were added and the counter says six. The subclass counted in `addAll`, then the parent's `addAll` called `add`, which the subclass also overrides and counts again. The subclass can only be correct if it knows **how the parent is implemented inside**, and it breaks if the parent changes. Inheritance exposes a class's internals to its children; this is the tightest coupling there is.

### 3. You can only extend one class

A `Robot` should be `Movable` and `Chargeable` and `Loggable`. With single inheritance you get to pick one parent.

## Composition

**Build an object from other objects, and delegate work to them.**

```js run
const fly = { move: name => `${name} flies` };
const walk = { move: name => `${name} walks` };
const swim = { move: name => `${name} swims` };
const sword = { attack: name => `${name} slashes` };
const spell = { attack: name => `${name} casts fire` };

class Character {
  constructor(name, movement, weapon) { this.name = name; this.movement = movement; this.weapon = weapon; }
  move() { return this.movement.move(this.name); }
  attack() { return this.weapon.attack(this.name); }
  setMovement(movement) { this.movement = movement; }
}

const hero = new Character('Arjun', walk, sword);
console.log(hero.move(), '|', hero.attack());
hero.setMovement(fly);
console.log('after finding wings:', hero.move());
console.log(new Character('Meera', swim, spell).move(), '|', new Character('Meera', swim, spell).attack());
```

A character **has a** movement and **has a** weapon. Any combination works with no new class, and the behaviour can even be swapped **while the program runs**, which inheritance cannot do. This is the Strategy pattern ([[lld-behavioral]]).

### The counting collection, fixed

```js run
class Collection {
  #items = [];
  add(item) { this.#items.push(item); }
  addAll(items) { for (const item of items) this.add(item); }
  get size() { return this.#items.length; }
}
class CountingCollection {
  #inner = new Collection();
  added = 0;
  add(item) { this.added++; this.#inner.add(item); }
  addAll(items) { this.added += items.length; this.#inner.addAll(items); }
  get size() { return this.#inner.size; }
}
const c = new CountingCollection();
c.addAll(['a', 'b', 'c']);
console.log('items stored:', c.size, '| counter says:', c.added);
```

The wrapper **holds** a collection and **forwards** calls to it. It no longer matters how `Collection` implements `addAll` internally. This forwarding is called **delegation**, and it is the Decorator pattern ([[lld-structural]]).

### The birds, fixed

```js run
const canFly = { fly() { return `${this.name} flies`; } };
const canSwim = { swim() { return `${this.name} swims`; } };

class Bird { constructor(name) { this.name = name; } eat() { return `${this.name} eats`; } }
class Sparrow extends Bird {}
class Penguin extends Bird {}
Object.assign(Sparrow.prototype, canFly);
Object.assign(Penguin.prototype, canSwim);

const birds = [new Sparrow('sparrow'), new Penguin('penguin')];
console.log(birds.filter(b => typeof b.fly === 'function').map(b => b.fly()));
console.log(birds.filter(b => typeof b.swim === 'function').map(b => b.swim()));
console.log(birds.map(b => b.eat()));
```

`Bird` keeps only what is true of **every** bird. Flying and swimming are separate capabilities given to the classes that have them. In Java you would write `class Sparrow extends Bird implements Flyable`; in JavaScript a **mixin** copies methods onto a prototype ([[js-prototypes]]). Code that needs flyers asks for flyers, and a penguin is never handed to it.

## Interfaces: program to what something can do

```js run
class InMemoryStorage {
  #data = new Map();
  save(key, value) { this.#data.set(key, value); }
  load(key) { return this.#data.get(key) ?? null; }
}
class FileLikeStorage {
  #lines = [];
  save(key, value) { this.#lines = this.#lines.filter(l => l[0] !== key); this.#lines.push([key, JSON.stringify(value)]); }
  load(key) { const line = this.#lines.find(l => l[0] === key); return line ? JSON.parse(line[1]) : null; }
}

class SettingsService {
  constructor(storage) { this.storage = storage; }
  setTheme(user, theme) { this.storage.save(`theme:${user}`, { theme, updated: 'today' }); }
  getTheme(user) { return this.storage.load(`theme:${user}`)?.theme ?? 'light'; }
}

for (const storage of [new InMemoryStorage(), new FileLikeStorage()]) {
  const settings = new SettingsService(storage);
  settings.setTheme('asha', 'dark');
  console.log(storage.constructor.name.padEnd(16), settings.getTheme('asha'), settings.getTheme('ravi'));
}
```

`SettingsService` depends on an **interface**, "something with `save` and `load`", not on a particular class. Any object with those two methods works. In Java this contract is written down as `interface Storage`; in JavaScript it is implicit ("duck typing": if it has the methods, it qualifies), and TypeScript lets you declare it.

**"Program to an interface, not an implementation"** means exactly this: the service names the capability it needs and stays ignorant of who provides it.

## Dependency injection

Look at how `SettingsService` got its storage: it was **passed in** through the constructor. Compare:

```js run
class RealClock { now() { return new Date(); } }

class GreeterHardWired {
  greet() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : 'Good evening'; }
}
class Greeter {
  constructor(clock) { this.clock = clock; }
  greet() { return this.clock.now().getHours() < 12 ? 'Good morning' : 'Good evening'; }
}

const at = hour => ({ now: () => new Date(2026, 0, 15, hour) });
console.log('injected, 9:00  ->', new Greeter(at(9)).greet());
console.log('injected, 20:00 ->', new Greeter(at(20)).greet());
console.log('hard-wired      -> depends on when you run it:', typeof new GreeterHardWired().greet());
console.log('production wiring:', typeof new Greeter(new RealClock()).greet());
```

**Dependency injection** means an object receives the things it depends on from outside instead of creating them itself. The result:

- **Testable**: a test passes a fake clock, a fake database, a fake email sender ([[node-testing]]).
- **Flexible**: swap implementations without touching the class.
- **Honest**: the constructor lists everything the class needs.

The one place that creates the real objects and connects them is called the **composition root** (in an Express app, the file that builds the app). This is the practical form of the dependency inversion principle in [[oop-solid]].

## Inheritance or composition: how to choose

| Question | If yes |
| --- | --- |
| Is B truly a kind of A, in every situation, forever? | inheritance may fit |
| Can a B be used anywhere an A is expected with no surprises? | inheritance may fit |
| Do you only want some of A's code? | composition |
| Does the behaviour vary independently along several axes? | composition |
| Might the behaviour change at run time? | composition |
| Are A and B from different libraries or teams? | composition (do not inherit from code you do not control) |

| | Inheritance | Composition |
| --- | --- | --- |
| Relationship | is a | has a |
| Coupling | tight: child sees and depends on parent internals | loose: only the public interface |
| Decided | at compile time, fixed | at run time, swappable |
| Reuse | the whole parent, wanted or not | exactly the parts you choose |
| Reads as | a taxonomy | an assembly |

"**Favour composition over inheritance**" is the guideline. It does not say never inherit: a shallow hierarchy over a stable abstraction (`Shape` → `Circle`, an abstract `Payment` → `CardPayment`) is fine. In UML terms this station is the difference between the inheritance arrow and the association, aggregation and composition arrows ([[lld-uml]]).

!!! key
- Inheritance couples a subclass to its parent's implementation; composition couples only to an interface.
- The three failures: subclasses that cannot honour the parent's promise, class explosion, fragile base class.
- Composition = hold a reference + delegate.
- Program to an interface: depend on a capability, not a concrete class.
- Dependency injection: receive dependencies, do not construct them.
- Most design patterns are composition in a named arrangement ([[lld-structural]], [[lld-behavioral]]).
!!!

!!! trap
- `extends` to share a helper method. Extract the helper into its own object and hold it.
- Hierarchies more than two or three levels deep.
- Overriding a method to throw "not supported".
- A class that creates its own database connection, HTTP client or clock inside its methods.
- Over-abstracting: an interface with exactly one implementation and no test double adds indirection for nothing.
!!!

!!! twist What changes if...
- **...you need to add behaviour to an object without changing its class?** Wrap it: Decorator ([[lld-structural]]).
- **...a third-party class has the wrong interface?** Wrap it: Adapter ([[lld-structural]]).
- **...you have many dependencies to wire?** A dependency injection container (NestJS, Spring) builds the object graph for you; the principle is unchanged.
- **...you write React?** Components are composed, never inherited: `children`, props and hooks are composition and delegation ([[react-props-events]], [[react-custom-hooks]]).
!!!

!!! model
Inheritance is being born into a family: you get everything, and you cannot change your parents. Composition is hiring specialists: you choose who does what, and you can replace any of them.
!!!

## Practice

?? You have `class Stack extends ArrayList`. What is wrong with it and how would you fix it?
A stack is not an array list: by inheriting, it exposes `add(index, x)`, `remove(index)` and `get(index)`, letting callers break the last-in-first-out rule. Fix with composition: `Stack` holds a private list and exposes only `push`, `pop`, `peek` and `size` (as in the practice for [[oop-pillars]]).
??

?? Model a `Duck`, a `RubberDuck` and a `RobotDuck`. Real ducks fly and quack; rubber ducks squeak and do not fly; robot ducks fly with rockets and do not quack.
Give `Duck` a `flyBehavior` and a `soundBehavior` object. Real duck: wings + quack. Rubber duck: no-fly + squeak. Robot duck: rocket-fly + silent. Each behaviour is a small class implementing `fly()` or `makeSound()`. New kinds of duck are new combinations, not new subclasses.

```js run
const behaviours = { wings: () => 'flaps away', rocket: () => 'blasts off', none: () => 'stays put', quack: () => 'Quack', squeak: () => 'Squeak', silent: () => '...' };
const duck = (name, fly, sound) => ({ describe: () => `${name}: ${behaviours[sound]()}, ${behaviours[fly]()}` });
for (const d of [duck('Mallard', 'wings', 'quack'), duck('Rubber duck', 'none', 'squeak'), duck('Robot duck', 'rocket', 'silent')]) console.log(d.describe());
```
??

?? What is dependency injection and what problem does it solve?
A class receives its collaborators (through the constructor or parameters) instead of creating them. It decouples the class from concrete implementations, so they can be replaced: with fakes in tests, with different providers in different environments, or with decorated versions that add logging or caching.
??

?? Give a case where inheritance is the right choice.
A stable abstraction with a genuine "is a" relationship and shared behaviour: an abstract `Shape` with `Circle` and `Rectangle`; a framework's base class designed for extension, such as a custom `Error` subclass ([[js-errors]]). The hierarchy is shallow, and every subclass can stand in for the parent.
??

?? Why is "has a" more flexible than "is a"?
A "has a" reference can point to any object that fits the interface and can be reassigned at run time, and an object can have many parts. An "is a" relationship is fixed when the class is written, allows one parent, and drags in everything the parent has.
??
