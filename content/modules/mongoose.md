---
summary: MongoDB accepts any shape of document. Mongoose puts a schema in your application so every document is validated, has defaults and comes with methods. This station covers schemas, models, validation, middleware, populate and the mistakes that make Mongoose slow.
time: 40
needs: mongo-queries, mongo-modeling, node-validation-security
---
## The problem this solves

With the raw driver ([[mongo-crud]]), nothing stops `insertOne({ emial: 'asha@...', age: 'twenty' })`. A typo in a field name or a string where a number belongs is stored without complaint, and surfaces months later as a bug somewhere else. You also repeat the same chores everywhere: set `createdAt`, lowercase the email, hash the password before saving.

**Mongoose** is an ODM (object-document mapper) for Node. You declare, once, what a document of each kind looks like. Mongoose then validates every write, applies defaults and conversions, and gives documents methods.

Results on this page are **expected results**, not executed output.

## Step 1: schema and model

```js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
  age:   { type: Number, min: 13, max: 120 },
  role:  { type: String, enum: ['member', 'admin'], default: 'member' },
  skills: [String],
  address: { city: String, pin: String },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

await mongoose.connect(process.env.MONGODB_URI);
```

| Piece | Is |
| --- | --- |
| **Schema** | the description: fields, types, rules, defaults |
| **Model** (`User`) | a class built from the schema, tied to a collection (`users`: lowercased and pluralized) |
| **Document** | an instance of the model: one record, with methods like `save()` |

`timestamps: true` adds `createdAt` and `updatedAt` and maintains them for you.

## Step 2: validation and casting

```js
const asha = await User.create({ name: '  Asha  ', email: 'ASHA@Example.com', age: '22' });

await User.create({ name: 'A', email: 'not-an-email', age: 7, role: 'superuser', nickname: 'ash' });
```

```output
first create ->
{ _id: ObjectId('...'), name: 'Asha', email: 'asha@example.com', age: 22, role: 'member', skills: [],
  createdAt: 2026-..., updatedAt: 2026-..., __v: 0 }

second create -> ValidationError: User validation failed:
  name: Path `name` (`A`) is shorter than the minimum allowed length (2).
  email: Path `email` is invalid (not-an-email).
  age: Path `age` (7) is less than minimum allowed value (13).
  role: `superuser` is not a valid enum value for path `role`.
```

Read the first result closely:

- `trim` removed the spaces, `lowercase` normalized the email.
- `'22'` (a string) was **cast** to the number `22`, because the schema says `Number`.
- `role` and `skills` received defaults.

In the second, every rule that failed is reported, and nothing was written. Note `nickname`: it is not in the schema, so Mongoose **silently drops it** (strict mode). That is a built-in defence against mass assignment ([[node-validation-security]]).

**Mongoose validation is your last line, not your only one.** Validate the request at the API boundary too, so users get a clean 422 with field messages instead of a database error.

### Twist: `unique` is not a validator

```js
await User.create({ name: 'Asha', email: 'asha@example.com' });
await User.create({ name: 'Other', email: 'asha@example.com' });
```

```output
second create -> MongoServerError: E11000 duplicate key error ... index: email_1 dup key: { email: "asha@example.com" }
```

`unique: true` tells Mongoose to create a **unique index** ([[mongo-indexes]]). The database enforces it, and a duplicate arrives as error code 11000, not as a `ValidationError`. Catch that code and respond 409 Conflict ([[rest-api]]).

## Step 3: queries

```js
const admins = await User.find({ role: 'admin' }).select('name email').sort('-createdAt').limit(10);
const user   = await User.findById(req.params.id);
const byMail = await User.findOne({ email: 'asha@example.com' });
const count  = await User.countDocuments({ age: { $gte: 18 } });
```

Filters are exactly the MongoDB filters from [[mongo-queries]]. Mongoose adds chainable helpers (`select`, `sort`, `limit`) and casts values: `findById('665f...')` accepts the string from the URL and converts it to an `ObjectId`. A string that cannot be an id throws a `CastError`, which your error middleware should turn into a 400.

### `lean()`: plain objects for reads

```js
const doc   = await User.findById(id);
const plain = await User.findById(id).lean();
```

```output
doc   -> a Mongoose document: has .save(), getters, change tracking. Heavier.
plain -> a plain JavaScript object with the same fields. Several times faster and lighter to create.
```

For read-only responses (most GET endpoints), add `.lean()`. Use full documents when you will modify and `save()` them or need their methods.

## Step 4: updating, two ways

```js
const user = await User.findById(id);
user.age = 23;
await user.save();

await User.findByIdAndUpdate(id, { $set: { age: 23 } }, { new: true, runValidators: true });
```

| | Load, change, `save()` | `findByIdAndUpdate` / `updateOne` |
| --- | --- | --- |
| Round trips | two | one |
| Validation | full, always | only with `runValidators: true` |
| `save` middleware (step 5) | runs | **does not run** |
| Atomic | no (another request can change it in between) | yes |
| Use for | changes involving business logic or hooks | simple field changes, counters (`$inc`) |

The validation gap is a classic bug: `updateOne({ ... }, { age: -5 })` writes the invalid value unless you pass `runValidators: true`.

## Step 5: middleware, methods and virtuals

```js
userSchema.add({ passwordHash: { type: String, select: false } });

userSchema.virtual('password').set(function (plain) { this._plainPassword = plain; });

userSchema.pre('save', async function () {
  if (this._plainPassword) this.passwordHash = await bcrypt.hash(this._plainPassword, 12);
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.set('toJSON', { transform: (doc, json) => { delete json.passwordHash; delete json.__v; return json; } });
```

```js
const user = await User.create({ name: 'Asha', email: 'asha@example.com', password: 'correct horse' });
const found = await User.findByEmail('ASHA@example.com').select('+passwordHash');
await found.checkPassword('correct horse');
JSON.stringify(user);
```

```output
create         -> stored document has passwordHash: '$2b$12$...'  and NO plain password anywhere
checkPassword  -> true
JSON.stringify -> {"_id":"...","name":"Asha","email":"asha@example.com","role":"member",...}   no passwordHash
```

| Feature | What it is | Used here for |
| --- | --- | --- |
| **Virtual** | a property that is not stored | accept `password`, never persist it |
| **`pre('save')` middleware** (a hook) | code that runs before saving | hash the password ([[auth-jwt]]) |
| **Instance method** | a function on each document | `user.checkPassword()` |
| **Static** | a function on the model | `User.findByEmail()` |
| **`select: false`** | field excluded from queries unless asked with `+field` | never load the hash by accident |
| **`toJSON` transform** | controls what `res.json(doc)` sends | strip private fields |

These use `function`, not arrow functions, because Mongoose sets `this` to the document ([[js-this]]).

## Step 6: references and populate

```js
const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tags: [String],
}, { timestamps: true });
const Post = mongoose.model('Post', postSchema);

const posts = await Post.find().sort('-createdAt').limit(20).populate('author', 'name').lean();
```

```output
without populate -> { title: 'Event loop notes', author: ObjectId('665f...c001'), ... }
with populate    -> { title: 'Event loop notes', author: { _id: ObjectId('665f...c001'), name: 'Asha' }, ... }
```

`ref: 'User'` records which model the id points to. `populate('author', 'name')` replaces each id with the referenced document, limited to the `name` field.

**How it works, which you must be able to explain:** it is **not a join**. Mongoose runs the posts query, collects the author ids, runs **one more query** (`User.find({ _id: { $in: [...] } })`), and stitches the results together in memory. Two queries for the page, however many posts.

### The N+1 problem

```js
const posts = await Post.find().limit(20).lean();
for (const post of posts) {
  post.author = await User.findById(post.author).lean();
}
```

```output
queries sent: 1 (posts) + 20 (one per post) = 21
with populate, or one User.find({ _id: { $in: ids } }): 2
```

A query inside a loop is the most common performance bug in database code. Fetch related data in **one batched query**. When to reference and populate versus embed is the modeling decision from [[mongo-modeling]].

## Step 7: where the model sits in the app

```js
// services/user.service.js
export async function registerUser({ name, email, password }) {
  try {
    return await User.create({ name, email, password });
  } catch (err) {
    if (err.code === 11000) throw new ConflictError('email already registered');
    if (err.name === 'ValidationError') throw new ValidationError(Object.values(err.errors).map(e => e.message));
    throw err;
  }
}
```

Routes call controllers, controllers call services, services use models ([[express-middleware]]). The service translates database errors into the application's own error types ([[js-errors]]), so the HTTP layer never needs to know Mongoose exists.

| Mongoose or driver error | Becomes |
| --- | --- |
| `ValidationError` | 422 with field messages |
| `CastError` (bad id) | 400 |
| code `11000` (duplicate) | 409 |
| document is `null` | 404 |

!!! key
- Schema describes, model queries, document is one record.
- Mongoose validates and casts on `create`/`save`; update operators skip validation unless `runValidators: true`.
- Unknown fields are dropped (strict mode).
- `unique` creates an index; a duplicate is error 11000, not a validation error.
- `.lean()` for read-only queries.
- `pre('save')` hooks do not run for `updateOne`/`findByIdAndUpdate`.
- `populate` is an extra query, not a join. Avoid queries in loops.
- Connect once at startup; Mongoose buffers and pools for you.
!!!

!!! trap
- Arrow functions in methods and hooks: `this` is not the document.
- Changing a password with `updateOne`, bypassing the hashing hook.
- Returning documents with `passwordHash` because nobody set `select: false` or a `toJSON` transform.
- Deep or repeated `populate` chains on large lists.
- Mutating a nested object or `Mixed` field and wondering why `save()` did nothing: Mongoose did not detect the change (`markModified`).
- Defining indexes only in the schema and assuming they exist in production; verify they were built.
!!!

!!! twist What changes if...
- **...two requests edit the same document?** Mongoose increments `__v` for array changes; for full optimistic locking enable `optimisticConcurrency` or use a conditional update on a version field ([[mongo-transactions]]).
- **...you need the same query logic in many places?** Put it in a static or a query helper so the filter lives in one place.
- **...several writes must succeed together?** Pass a session to each call inside `session.withTransaction` ([[mongo-transactions]]).
- **...you want types?** Mongoose has TypeScript support; some teams choose Prisma or the typed native driver instead.
!!!

!!! model
The schema is a contract enforced at the door of your application: data is checked and tidied on the way in, and related documents are fetched by id on the way out.
!!!

## Practice

?? Write a `Product` schema: name (required, 2 to 80 chars), price in paise (integer, at least 0), category (one of three), stock (default 0, never negative), tags, and timestamps.
```js
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  price: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: 'price must be whole paise' } },
  category: { type: String, required: true, enum: ['keyboards', 'mice', 'monitors'], index: true },
  stock: { type: Number, default: 0, min: 0 },
  tags: [String],
}, { timestamps: true });
```
??

?? `User.updateOne({ _id }, { age: -5 })` succeeds although the schema says `min: 13`. Why?
Update operations go straight to MongoDB and skip schema validators by default. Pass `{ runValidators: true }`, or load the document, change it and call `save()`.
??

?? What does `populate` do under the hood, and when does it become a problem?
It issues an additional `find` with `$in` for the referenced ids and merges results in application memory. It becomes a problem when nested several levels deep, used on large result sets, or when you need to filter or sort parents by a field of the child, which it cannot do; use `$lookup` in an aggregation or denormalize ([[mongo-aggregation]], [[mongo-modeling]]).
??

?? A password-change endpoint uses `User.findByIdAndUpdate(id, { password: newPassword })`. List two bugs.
The `pre('save')` hook that hashes the password does not run for update queries, so no hash is produced. And `password` is a virtual, not a stored path, so with strict mode nothing is written at all; if the field were real, the plain text would be stored. Load the user, set `user.password`, and `save()`.
??

?? When should you use `.lean()`?
On queries whose results are only read and sent as JSON. It skips creating full Mongoose documents, which saves CPU and memory. Do not use it when you need `save()`, virtuals, getters or instance methods on the result.
??
