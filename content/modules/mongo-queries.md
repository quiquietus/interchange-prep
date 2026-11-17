---
summary: Finding exactly the documents you need. Comparison and logical operators, querying arrays and nested fields, choosing which fields come back, sorting and paging through results.
time: 35
needs: mongo-crud
---
## The problem this solves

`find({ name: 'Mouse' })` only handles "equals". Real questions are richer: products between two prices, in any of three categories, with at least one of these tags, newest first, twenty at a time, returning only the name and price. MongoDB expresses all of this in the same filter-document style, using **operators** that start with `$`.

Examples use this collection. Results are **expected results**, not executed output (see [[mongo-crud]]).

```js
db.products.insertMany([
  { _id: 1, name: 'Keyboard', price: 2499, stock: 12, category: 'input',   tags: ['usb', 'rgb'], rating: 4.5, specs: { weightG: 900, wireless: false } },
  { _id: 2, name: 'Mouse',    price: 699,  stock: 40, category: 'input',   tags: ['usb'],        rating: 4.1, specs: { weightG: 85,  wireless: true } },
  { _id: 3, name: 'Monitor',  price: 8999, stock: 5,  category: 'display', tags: ['hdmi', '4k'], rating: 4.7, specs: { weightG: 4200, wireless: false } },
  { _id: 4, name: 'Webcam',   price: 1999, stock: 0,  category: 'video',   tags: [],             specs: { weightG: 150, wireless: false } },
  { _id: 5, name: 'Headset',  price: 3499, stock: 8,  category: 'audio',   tags: ['usb', 'mic'], rating: 3.9, specs: { weightG: 320, wireless: true } }
])
```

## Step 1: comparison operators

```js
db.products.find({ price: { $gt: 2000 } })
db.products.find({ price: { $gte: 700, $lte: 3500 } })
db.products.find({ category: { $in: ['input', 'audio'] } })
db.products.find({ category: { $ne: 'input' } })
```

```output
price > 2000                -> Keyboard, Monitor, Headset
700 <= price <= 3500        -> Keyboard, Webcam, Headset
category in [input, audio]  -> Keyboard, Mouse, Headset
category != input           -> Monitor, Webcam, Headset
```

The shape is always `{ field: { $operator: value } }`. Two operators on the same field are combined with "and", which is how a range is written.

| Operator | Meaning |
| --- | --- |
| `$eq`, `$ne` | equal, not equal (`{ a: 5 }` is short for `{ a: { $eq: 5 } }`) |
| `$gt`, `$gte`, `$lt`, `$lte` | greater / less than (or equal) |
| `$in`, `$nin` | equals any / none of the values in an array |

## Step 2: combining conditions

```js
db.products.find({ category: 'input', price: { $lt: 1000 } })
db.products.find({ $or: [{ stock: 0 }, { price: { $gt: 8000 } }] })
db.products.find({ category: 'input', $or: [{ price: { $lt: 1000 } }, { rating: { $gte: 4.5 } }] })
db.products.find({ price: { $not: { $gt: 2000 } } })
```

```output
input AND price < 1000                         -> Mouse
stock 0 OR price > 8000                        -> Monitor, Webcam
input AND (price < 1000 OR rating >= 4.5)      -> Keyboard, Mouse
NOT price > 2000                               -> Mouse, Webcam
```

- Several fields in one filter document are joined with **and** automatically.
- `$or` takes an **array of filter documents**; a document matches if any one does.
- Mixing them, as in the third line, reads: "category is input, and one of these".

**Twist: when you need an explicit `$and`.** A JavaScript object cannot have the same key twice, so `{ $or: [...], $or: [...] }` silently keeps only the second. Write `{ $and: [{ $or: [...] }, { $or: [...] }] }`.

## Step 3: missing fields, null and types

```js
db.products.find({ rating: { $exists: false } })
db.products.find({ rating: null })
db.products.find({ rating: { $gte: 0 } })
```

```output
rating does not exist   -> Webcam
rating: null            -> Webcam   (matches a missing field AND a field set to null)
rating >= 0             -> the four products that have a rating. Webcam is NOT matched.
```

A comparison never matches a document where the field is missing. So "products rated below 4" silently excludes unrated products. Decide what missing means, and query for it explicitly when it matters.

## Step 4: arrays

```js
db.products.find({ tags: 'usb' })
db.products.find({ tags: { $all: ['usb', 'rgb'] } })
db.products.find({ tags: { $in: ['4k', 'mic'] } })
db.products.find({ tags: { $size: 0 } })
db.products.find({ tags: ['usb', 'rgb'] })
```

```output
contains 'usb'              -> Keyboard, Mouse, Headset
contains BOTH usb and rgb   -> Keyboard
contains ANY of 4k, mic     -> Monitor, Headset
array is empty              -> Webcam
EXACTLY ['usb','rgb'] in that order -> Keyboard
```

The last form (an array as the value) demands an exact match of the whole array, order included. It is rarely what you want; use `$all`.

### Arrays of objects: `$elemMatch`

```js
db.orders.insertOne({ _id: 1, items: [{ sku: 'kb', qty: 1, price: 2499 }, { sku: 'ms', qty: 5, price: 699 }] })

db.orders.find({ 'items.qty': { $gte: 5 }, 'items.price': { $gte: 2000 } })
db.orders.find({ items: { $elemMatch: { qty: { $gte: 5 }, price: { $gte: 2000 } } } })
```

```output
without $elemMatch -> order 1 MATCHES  (qty >= 5 is true for the mouse, price >= 2000 is true for the keyboard)
with $elemMatch    -> no match         (no SINGLE item has both qty >= 5 and price >= 2000)
```

This is the classic array bug. Separate conditions on an array field may each be satisfied by a **different element**. `$elemMatch` requires **one element** to satisfy all of them.

## Step 5: nested fields and text

```js
db.products.find({ 'specs.wireless': true })
db.products.find({ 'specs.weightG': { $lt: 200 } })
db.products.find({ name: /^mo/i })
db.products.find({ name: { $regex: 'board', $options: 'i' } })
```

```output
specs.wireless = true    -> Mouse, Headset
specs.weightG < 200      -> Mouse, Webcam
name starts with "mo"    -> Mouse, Monitor
name contains "board"    -> Keyboard
```

Dot notation reaches into nested documents. A regular expression matches text patterns. A pattern anchored at the start (`^mo`, case-sensitive) can use an index; a "contains" search cannot and scans every document ([[mongo-indexes]]). For real search, use a text index or a search engine.

## Step 6: projection, choosing the fields

```js
db.products.find({ category: 'input' }, { name: 1, price: 1 })
db.products.find({ category: 'input' }, { name: 1, price: 1, _id: 0 })
db.products.find({ category: 'input' }, { specs: 0, tags: 0 })
```

```output
{ name: 1, price: 1 }          -> [ { _id: 1, name: 'Keyboard', price: 2499 }, { _id: 2, name: 'Mouse', price: 699 } ]
... with _id: 0                -> [ { name: 'Keyboard', price: 2499 }, { name: 'Mouse', price: 699 } ]
{ specs: 0, tags: 0 }          -> everything EXCEPT specs and tags
```

The second argument is a **projection**. `1` includes, `0` excludes. You cannot mix the two styles, except for `_id`, which is included unless you say `_id: 0`.

Why bother: less data over the network, and you never accidentally send a field such as `passwordHash` to a client. An API should project (or map) to exactly the fields it promises.

## Step 7: sort, limit, skip

```js
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: -1 }).limit(2)
db.products.find({}, { name: 1, _id: 0 }).sort({ category: 1, price: -1 })
db.products.find({}, { name: 1, _id: 0 }).sort({ price: 1 }).skip(2).limit(2)
```

```output
two most expensive         -> Monitor (8999), Headset (3499)
by category, then price    -> Headset, Monitor, Keyboard, Mouse, Webcam
page 2 (size 2) by price   -> Keyboard, Headset
```

`1` is ascending, `-1` descending. With several sort fields, later ones break ties in earlier ones. MongoDB always applies **sort, then skip, then limit**, whatever order you chain them in.

### Paging two ways

```js
const page = 3, size = 20;
db.posts.find().sort({ createdAt: -1 }).skip((page - 1) * size).limit(size)

db.posts.find({ createdAt: { $lt: lastSeenCreatedAt } }).sort({ createdAt: -1 }).limit(size)
```

| | Offset: `skip` | Cursor: "after the last one I saw" |
| --- | --- | --- |
| Deep pages | slow: the server walks all skipped documents | fast with an index |
| New items inserted while paging | duplicates or gaps | stable |
| Jump to page N | yes | no |

This is the same trade-off as in [[rest-api]], seen from the database side. Use a unique tiebreaker (`_id`) in the sort so the order is fully determined.

## Step 8: from an HTTP query string to a filter

```js
function buildFilter(query) {
  const filter = {};
  if (typeof query.category === 'string') filter.category = query.category;
  const min = Number(query.minPrice), max = Number(query.maxPrice);
  if (query.minPrice !== undefined && !Number.isNaN(min)) filter.price = { ...filter.price, $gte: min };
  if (query.maxPrice !== undefined && !Number.isNaN(max)) filter.price = { ...filter.price, $lte: max };
  if (query.inStock === 'true') filter.stock = { $gt: 0 };
  return filter;
}
```

```output
buildFilter({ category: 'input', maxPrice: '1000', inStock: 'true' })
  -> { category: 'input', price: { $lte: 1000 }, stock: { $gt: 0 } }
buildFilter({ category: { $ne: null } })
  -> {}     the object was ignored, because only strings are accepted
```

Build the filter **field by field from validated values**. Never pass `req.query` or `req.body` to `find` directly: a client can send `category[$ne]=x`, which arrives as an object containing an operator. That is NoSQL injection ([[node-validation-security]]).

!!! key
- `{ field: { $op: value } }`; several fields mean "and"; `$or` takes an array.
- A comparison does not match a missing field. `$exists` and `null` handle absence.
- Arrays: a plain value means "contains"; `$all`, `$in`, `$size`; `$elemMatch` when several conditions must hold for the same element.
- Dot notation for nested fields.
- Projection: include or exclude, never both (except `_id`).
- Sort, then skip, then limit. Prefer cursor paging for large data.
- Build filters from validated input only.
!!!

!!! trap
- Two conditions on an array of objects without `$elemMatch`.
- Duplicate keys in a filter object (two `$or`s): the first is lost.
- `find({ price: '700' })` when the field is a number: types must match. Query-string values are strings; convert them.
- Unanchored or case-insensitive regex on a big collection.
- `skip(100000)`.
- Forgetting that an unsorted `find` has no guaranteed order.
!!!

!!! twist What changes if...
- **...you need the distinct categories?** `db.products.distinct('category')`.
- **...you need counts or averages per category?** That is grouping, done with the aggregation pipeline ([[mongo-aggregation]]).
- **...the query is slow?** Run it with `.explain('executionStats')` and design an index for it ([[mongo-indexes]]).
- **...you need data from another collection in the same query?** `$lookup` in a pipeline, or model the data so you do not need it ([[mongo-modeling]]).
!!!

!!! model
A filter is a template document: "show me documents that look like this". Operators loosen "equals" into ranges, sets and patterns; projection and sort shape what comes back.
!!!

## Practice

?? Write a query: in-stock products in category `input` or `audio`, priced under 3000, cheapest first, returning only name and price.
```js
db.products.find(
  { stock: { $gt: 0 }, category: { $in: ['input', 'audio'] }, price: { $lt: 3000 } },
  { name: 1, price: 1, _id: 0 }
).sort({ price: 1 })
```
Expected: Mouse (699), Keyboard (2499).
??

?? `students` have `scores: [{ subject, marks }]`. Find students who scored above 90 in maths.
```js
db.students.find({ scores: { $elemMatch: { subject: 'maths', marks: { $gt: 90 } } } })
```
Without `$elemMatch`, a student with maths 40 and physics 95 would match.
??

?? What is the difference between `{ tags: { $in: ['a', 'b'] } }` and `{ tags: { $all: ['a', 'b'] } }`?
`$in` matches documents whose `tags` contain at least one of the values. `$all` matches only documents whose `tags` contain every one of them.
??

?? Why does `find({ rating: { $lt: 4 } })` not return products that have no rating?
A comparison operator only matches documents where the field exists with a comparable value. To include unrated products, add them explicitly: `{ $or: [{ rating: { $lt: 4 } }, { rating: { $exists: false } }] }`.
??

?? A list endpoint uses `skip((page - 1) * 20).limit(20)` sorted by `createdAt`. Users report seeing the same post on page 1 and page 2. Why, and how do you fix it?
A new post was inserted between the two requests, shifting every post down one position, so the last item of page 1 became the first of page 2. Use cursor paging: request the items with `createdAt` (and `_id` as a tiebreaker) less than the last one received.
??
