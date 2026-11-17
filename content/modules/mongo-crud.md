---
summary: A database keeps data safe after the program stops. MongoDB stores it as documents that look like JavaScript objects. This station covers what a document is and the four basic operations on it, create, read, update and delete.
time: 35
needs: js-objects-arrays, node-essentials
---
## The problem this solves

In [[express-first-app]] the tasks lived in a JavaScript array. Restart the server and they are gone. Run two servers and each has a different list. Storing them in a JSON file ([[node-essentials]]) survives a restart but breaks when two requests write at once and gets slow as it grows.

A **database** is a separate program whose whole job is to store data safely, find it fast, and handle many readers and writers at the same time. Your server talks to it over a network connection.

**About the examples.** The site's build has no database server, so results on the MongoDB line are shown as **expected result** panels, not executed output. Every command is standard MongoDB syntax you can paste into `mongosh` (the MongoDB shell) or run through the Node driver. To follow along, create a free cluster on MongoDB Atlas or install MongoDB Community locally.

## Step 1: the vocabulary

| Term | Meaning | Like |
| --- | --- | --- |
| **Document** | one record: a set of `field: value` pairs | a JavaScript object |
| **Collection** | a group of documents | an array of objects (a table in SQL) |
| **Database** | a group of collections | a folder |
| **`_id`** | a unique identifier every document has | a primary key |

```js
{
  _id: ObjectId('665f1c2e9b1e8a0012a4c001'),
  name: 'Asha',
  email: 'asha@example.com',
  age: 22,
  skills: ['node', 'react'],
  address: { city: 'Jaipur', pin: '302001' },
  joinedAt: ISODate('2026-01-15T10:00:00Z')
}
```

A document is JSON with extra types (the stored format is called **BSON**): dates, 64-bit integers, decimals and `ObjectId`. It can hold arrays and nested documents, so one document can be a complete thing (a user with their address) instead of rows spread over several tables.

**No fixed schema.** Two documents in one collection may have different fields. That is flexible while a product is changing, and dangerous if nothing checks the shape; [[mongoose]] adds that check.

## Step 2: create

```js
use shop

db.products.insertOne({ name: 'Keyboard', price: 2499, stock: 12, tags: ['usb', 'rgb'] })

db.products.insertMany([
  { name: 'Mouse', price: 699, stock: 40, tags: ['usb'] },
  { name: 'Monitor', price: 8999, stock: 5, tags: ['hdmi', '4k'] },
  { name: 'Webcam', price: 1999, stock: 0 }
])
```

```output
insertOne  -> { acknowledged: true, insertedId: ObjectId('665f1c2e9b1e8a0012a4c010') }
insertMany -> { acknowledged: true, insertedIds: { '0': ObjectId('...c011'), '1': ObjectId('...c012'), '2': ObjectId('...c013') } }
```

**What happened.** `use shop` selects a database; `db.products` names a collection. Neither had to be created first: MongoDB creates them on the first insert. Each document received an `_id` automatically because none was given. The webcam has no `tags` field at all, and that is allowed.

**Twist: insert the same `_id` twice.**

```js
db.products.insertOne({ _id: 'kb-1', name: 'Keyboard' })
db.products.insertOne({ _id: 'kb-1', name: 'Another keyboard' })
```

```output
first  -> { acknowledged: true, insertedId: 'kb-1' }
second -> MongoServerError: E11000 duplicate key error collection: shop.products index: _id_ dup key: { _id: "kb-1" }
```

`_id` must be unique in a collection. Error code **11000** means "duplicate key"; you will meet it again with unique indexes on emails ([[mongo-indexes]]).

## Step 3: read

```js
db.products.find()
db.products.find({ name: 'Mouse' })
db.products.findOne({ name: 'Mouse' })
db.products.findOne({ name: 'Laptop' })
db.products.countDocuments({ stock: 0 })
```

```output
find()                  -> all 4 documents
find({ name: 'Mouse' }) -> [ { _id: ObjectId('...c011'), name: 'Mouse', price: 699, stock: 40, tags: [ 'usb' ] } ]
findOne({ name: 'Mouse' })  -> { _id: ObjectId('...c011'), name: 'Mouse', price: 699, stock: 40, tags: [ 'usb' ] }
findOne({ name: 'Laptop' }) -> null
countDocuments          -> 1
```

The argument to `find` is a **filter**: a document describing what to match. `{ name: 'Mouse' }` means "documents whose `name` equals `'Mouse'`". An empty filter matches everything.

| | `find(filter)` | `findOne(filter)` |
| --- | --- | --- |
| Returns | a **cursor** over all matches (the shell prints the first batch as an array) | the first matching document, or `null` |
| No match | an empty result | `null` |

Always handle the `null`. It is the source of "Cannot read properties of null" in API code, and in a route it should become a 404 ([[express-first-app]]).

**Twist: matching inside arrays and nested documents.**

```js
db.products.find({ tags: 'usb' })
db.users.find({ 'address.city': 'Jaipur' })
```

```output
find({ tags: 'usb' })             -> Keyboard and Mouse (the array CONTAINS 'usb')
find({ 'address.city': 'Jaipur' }) -> every user whose nested address has city Jaipur
```

A filter on an array field matches if **any element** equals the value. A nested field is reached with **dot notation** in quotes. More operators are in [[mongo-queries]].

## Step 4: update

```js
db.products.updateOne({ name: 'Mouse' }, { $set: { price: 649 } })
db.products.updateOne({ name: 'Mouse' }, { $inc: { stock: -1 } })
db.products.updateOne({ name: 'Mouse' }, { $push: { tags: 'wireless' } })
db.products.findOne({ name: 'Mouse' })
```

```output
each updateOne -> { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
findOne        -> { _id: ..., name: 'Mouse', price: 649, stock: 39, tags: [ 'usb', 'wireless' ] }
```

An update takes two arguments: a **filter** (which document) and an **update document** (what to change), built from **update operators** that start with `$`.

| Operator | Does | Example |
| --- | --- | --- |
| `$set` | set a field (creates it if missing) | `{ $set: { price: 649, 'address.city': 'Pune' } }` |
| `$unset` | remove a field | `{ $unset: { discount: '' } }` |
| `$inc` | add to a number (negative subtracts) | `{ $inc: { stock: -1, views: 1 } }` |
| `$push` | append to an array | `{ $push: { tags: 'new' } }` |
| `$addToSet` | append only if not already present | `{ $addToSet: { tags: 'usb' } }` |
| `$pull` | remove matching elements from an array | `{ $pull: { tags: 'old' } }` |

Operators change **only the fields named**, inside the database, in one step. That matters: `$inc` is atomic, so two simultaneous purchases both decrement correctly, where "read stock, subtract in JavaScript, write back" would lose one ([[mongo-transactions]]).

**Twist: forget the operator.**

```js
db.products.updateOne({ name: 'Mouse' }, { price: 649 })
db.products.replaceOne({ name: 'Mouse' }, { price: 649 })
```

```output
updateOne  -> MongoInvalidArgumentError: Update document requires atomic operators
replaceOne -> the whole document is now { _id: ..., price: 649 }. name, stock and tags are gone.
```

`updateOne` refuses a document without operators, which protects you. `replaceOne` does exactly what it says: it swaps the entire document. Use `$set` unless you truly mean to replace.

**Twist: how many matched, and creating if absent.**

```js
db.products.updateOne({ name: 'Laptop' }, { $set: { price: 55000 } })
db.products.updateMany({ stock: 0 }, { $set: { available: false } })
db.products.updateOne({ name: 'Laptop' }, { $set: { price: 55000 } }, { upsert: true })
```

```output
updateOne (no such doc) -> { matchedCount: 0, modifiedCount: 0 }      nothing happened, and no error
updateMany              -> { matchedCount: 1, modifiedCount: 1 }
upsert                  -> { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: ObjectId('...') }
```

An update that matches nothing is **not an error**; check `matchedCount`. `updateOne` changes at most one document, `updateMany` all matches. `upsert: true` means "update, or insert if nothing matched".

To get the document back in the same step, use `findOneAndUpdate(filter, update, { returnDocument: 'after' })`.

## Step 5: delete

```js
db.products.deleteOne({ name: 'Webcam' })
db.products.deleteMany({ stock: 0 })
db.products.deleteMany({})
```

```output
deleteOne      -> { acknowledged: true, deletedCount: 1 }
deleteMany     -> { acknowledged: true, deletedCount: 0 }
deleteMany({}) -> deletes EVERY document in the collection
```

There is no undo. An empty filter matches everything, so `deleteMany({})` empties the collection. Many applications never truly delete: they set a `deletedAt` date (a **soft delete**) and filter those documents out, so data can be restored and history is kept.

## Step 6: from Node

```js
import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const products = client.db('shop').collection('products');

const { insertedId } = await products.insertOne({ name: 'Keyboard', price: 2499, stock: 12 });
const keyboard = await products.findOne({ _id: insertedId });
const cheap = await products.find({ price: { $lt: 1000 } }).toArray();
await products.updateOne({ _id: insertedId }, { $inc: { stock: -1 } });
const byIdFromUrl = await products.findOne({ _id: new ObjectId('665f1c2e9b1e8a0012a4c010') });

await client.close();
```

The same methods, each returning a promise ([[js-promises]]). Three things differ from the shell:

- `find` returns a cursor; `.toArray()` loads the results, or loop with `for await` for large sets ([[js-iterators]]).
- The connection string comes from an environment variable, never from code ([[node-essentials]]).
- An id arriving from a URL is a **string**. `_id` is an `ObjectId`. `{ _id: '665f...' }` matches nothing; convert with `new ObjectId(str)`, and validate first, because an invalid string throws ([[node-validation-security]]).

Connect **once** at startup and reuse the client. It keeps a pool of connections; connecting per request is slow and exhausts the server ([[node-scaling]]).

## Step 7: the Express task API with a real database

```js
app.get('/tasks', async (req, res) => {
  res.json(await tasks.find().sort({ createdAt: -1 }).limit(50).toArray());
});
app.post('/tasks', async (req, res) => {
  const title = req.body?.title?.trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const task = { title, done: false, createdAt: new Date() };
  const { insertedId } = await tasks.insertOne(task);
  res.status(201).json({ _id: insertedId, ...task });
});
app.patch('/tasks/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const task = await tasks.findOneAndUpdate(
    { _id: new ObjectId(req.params.id) }, { $set: { done: Boolean(req.body.done) } }, { returnDocument: 'after' });
  task ? res.json(task) : res.status(404).json({ error: 'task not found' });
});
app.delete('/tasks/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const { deletedCount } = await tasks.deleteOne({ _id: new ObjectId(req.params.id) });
  deletedCount ? res.status(204).end() : res.status(404).json({ error: 'task not found' });
});
```

Compare with the in-memory version in [[express-first-app]]: the array methods became database calls, `id` became `_id`, and "not found" is detected from `null` or `deletedCount`. Now the data survives restarts and is shared by every server process.

!!! key
- Database → collections → documents; every document has a unique `_id`.
- Documents are flexible JSON-like objects with arrays and nesting.
- `insertOne/Many`, `find/findOne`, `updateOne/Many`, `deleteOne/Many`.
- Filters describe what to match; update operators (`$set`, `$inc`, `$push`...) describe what to change.
- `findOne` returns `null`; an update that matches nothing is not an error.
- From a URL the id is a string: validate, then `new ObjectId(...)`.
- One client, connected once, reused.
!!!

!!! trap
- An update without `$set`, or `replaceOne` by accident.
- `deleteMany({})` or `updateMany({}, ...)` with a filter that turned out empty (for example `{ userId: undefined }` becomes `{}` after JSON conversion). Validate filters.
- Comparing an `ObjectId` to a string with `===`. Use `.equals()` or `.toString()`.
- Passing `req.body` straight in as a filter or update ([[node-validation-security]]).
- Forgetting `await`, so the "result" is a pending promise.
!!!

!!! twist What changes if...
- **...you want only some fields back, sorted, a page at a time?** Projection, `sort`, `limit` and `skip`: [[mongo-queries]].
- **...two documents are related (a task belongs to a user)?** Embed or reference: [[mongo-modeling]].
- **...the collection grows to millions?** Every `find` on an un-indexed field scans all of it: [[mongo-indexes]].
- **...you would rather use SQL?** The same four operations are `INSERT`, `SELECT`, `UPDATE`, `DELETE` on tables with fixed columns ([[dbms-sql]]).
!!!

!!! model
A collection is a persistent array of objects kept by another program. You do not loop over it yourself; you send a description of which documents you want and what to do to them.
!!!

## Practice

?? Write the commands: add a user; find them by email; add `'mongodb'` to their skills without duplicates; increase their age by one; delete them.
```js
db.users.insertOne({ name: 'Ravi', email: 'ravi@example.com', age: 24, skills: ['node'] })
db.users.findOne({ email: 'ravi@example.com' })
db.users.updateOne({ email: 'ravi@example.com' }, { $addToSet: { skills: 'mongodb' } })
db.users.updateOne({ email: 'ravi@example.com' }, { $inc: { age: 1 } })
db.users.deleteOne({ email: 'ravi@example.com' })
```
The two updates could be combined: `{ $addToSet: { skills: 'mongodb' }, $inc: { age: 1 } }`.
??

?? `GET /products/abc` crashes the server with "input must be a 24 character hex string". Why and what is the fix?
`new ObjectId('abc')` throws for a string that is not a valid id. Check `ObjectId.isValid(id)` first and return 400. Without the check, in Express 4 the unhandled error could crash the request; in any version the client deserves a 400, not a 500.
??

?? What is the difference between `updateOne(filter, { $set: { a: 1 } })` and `replaceOne(filter, { a: 1 })`?
`updateOne` with `$set` changes only field `a` and leaves all other fields. `replaceOne` replaces the entire document (keeping only `_id`), so every other field is lost.
??

?? Why is `{ $inc: { stock: -1 } }` safer than reading the document, subtracting in JavaScript and writing it back?
The read-modify-write takes three steps, and two requests can both read the same value before either writes, so one decrement is lost. `$inc` is applied inside the database as a single atomic operation, so concurrent updates are applied one after another.
??

?? What does `find({ tags: 'usb' })` match when `tags` is an array? And when it is a string?
For an array field, it matches documents where at least one element equals `'usb'`. For a string field, it matches documents where the field is exactly `'usb'`. The same filter handles both.
??
