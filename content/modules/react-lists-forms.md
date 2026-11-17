---
summary: Most screens are a list of things and a form to change them. This station covers rendering arrays, why keys exist, controlled inputs, and assembles them into a complete small app.
time: 45
needs: react-props-events
---
## The problem this solves

Data arrives as arrays: products, messages, search results. You cannot write one JSX line per item because you do not know how many there will be. And to create or edit data, the user types into inputs whose values your code must read, validate and submit. Lists and forms are where a beginner's app becomes a real one.

## Part 1: lists

### Step 1: an array of data becomes an array of elements

```jsx run
function ProductList({ products }) {
  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>{product.name}: Rs {product.price}</li>
      ))}
    </ul>
  );
}
const products = [{ id: 'p1', name: 'Keyboard', price: 2499 }, { id: 'p2', name: 'Mouse', price: 699 }, { id: 'p3', name: 'Monitor', price: 8999 }];
render(<ProductList products={products} />);
console.log(html());
```

React can render an array of elements ([[react-first-components]]). `map` turns each data item into one element ([[js-functional]]). That is the whole technique.

**Filter and sort before mapping.**

```jsx run
function ProductList({ products, maxPrice }) {
  const visible = products.filter(p => p.price <= maxPrice).toSorted((a, b) => a.price - b.price);
  if (visible.length === 0) return <p>No products under Rs {maxPrice}</p>;
  return <ul>{visible.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
const products = [{ id: 'p1', name: 'Keyboard', price: 2499 }, { id: 'p2', name: 'Mouse', price: 699 }, { id: 'p3', name: 'Monitor', price: 8999 }];
render(<ProductList products={products} maxPrice={3000} />); console.log(text());
render(<ProductList products={products} maxPrice={100} />);  console.log(text());
```

The filtered list is **computed during render** from the props. It is not stored anywhere. Always handle the empty case; an empty `<ul>` tells the user nothing.

### Step 2: why every item needs a `key`

```jsx run
const originalError = console.error;
console.error = (msg, ...rest) => console.log('React warning:', String(msg).replace(/%s/g, () => rest.shift()).split('\n')[0].slice(0, 62));
render(<ul>{['a', 'b'].map(x => <li>{x}</li>)}</ul>);
console.error = originalError;
```

React warns when list items have no `key`. A key tells React **which item is which** between one render and the next. Watch what goes wrong without a stable one.

```jsx run
function Row({ name }) {
  const [checked, setChecked] = useState(false);
  return <li><input type="checkbox" checked={checked} onChange={() => setChecked(!checked)} /> {name}{checked ? ' [ticked]' : ''}</li>;
}
function List({ useIndexAsKey }) {
  const [items, setItems] = useState([{ id: 'a', name: 'Buy milk' }, { id: 'b', name: 'Write notes' }]);
  return (
    <div>
      <button onClick={() => setItems([{ id: 'c', name: 'Call mom' }, ...items])}>Add at top</button>
      <ul>{items.map((item, index) => <Row key={useIndexAsKey ? index : item.id} name={item.name} />)}</ul>
    </div>
  );
}
for (const useIndexAsKey of [true, false]) {
  render(<List key={String(useIndexAsKey)} useIndexAsKey={useIndexAsKey} />);
  click('input');
  click('button');
  console.log(useIndexAsKey ? 'key = index:' : 'key = id   :', [...document.querySelectorAll('li')].map(li => li.textContent.trim()).join(' | '));
}
```

The user ticked "Buy milk", then a new item was added at the top.

- With **index keys**, the tick jumped to "Call mom". React saw "the item with key 0" before and after and assumed it was the same row, so it kept that row's state.
- With **id keys**, the tick stayed on "Buy milk". React recognized the row by its id even though it moved.

| Key choice | Verdict |
| --- | --- |
| A stable unique id from the data (`item.id`) | correct |
| Array index | only if the list never reorders, inserts or deletes, and rows hold no state |
| `Math.random()` or a new id on each render | wrong: every row is destroyed and rebuilt every time |

Keys must be unique among siblings, not across the whole app. Why React matches elements this way is explained in [[react-rendering]].

## Part 2: forms

### Step 3: a controlled input

```jsx run
function NameField() {
  const [name, setName] = useState('');
  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
      <p>{name ? `Hello, ${name.trim()}!` : 'Type your name'} ({name.length}/20)</p>
    </div>
  );
}
render(<NameField />);
console.log(text());
type('input', 'Asha');
console.log(text());
```

Two lines make an input **controlled**:

- `value={name}`: the input always displays what is in state.
- `onChange={e => setName(e.target.value)}`: every keystroke updates state.

State is the single source of truth. Because your code holds the value at every moment, it can show a character count, validate as the user types, or transform the text.

**Twist: `value` without `onChange` freezes the input.**

```jsx run
console.error = () => {};
function Frozen() { return <input value="cannot change" />; }
render(<Frozen />);
type('input', 'new text');
console.log('input shows:', JSON.stringify(document.querySelector('input').value));
```

You said the value is always that string, so React puts it back after every keystroke.

**Twist: transform while typing.**

```jsx run
function PhoneField() {
  const [phone, setPhone] = useState('');
  return <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />;
}
render(<PhoneField />);
type('input', '98abc765-43210999');
console.log('input shows:', document.querySelector('input').value);
```

Letters and symbols are removed and the length capped, because the state setter decides what is stored.

### Step 4: other input types

```jsx run
function Preferences() {
  const [plan, setPlan] = useState('free');
  const [newsletter, setNewsletter] = useState(false);
  const [bio, setBio] = useState('');
  return (
    <form>
      <select value={plan} onChange={e => setPlan(e.target.value)}>
        <option value="free">Free</option><option value="pro">Pro</option>
      </select>
      <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} />
      <textarea value={bio} onChange={e => setBio(e.target.value)} />
      <output>{JSON.stringify({ plan, newsletter, bio })}</output>
    </form>
  );
}
render(<Preferences />);
click('input');
type('textarea', 'Learning React');
console.log(document.querySelector('output').textContent);
```

| Element | Value prop | Read from the event |
| --- | --- | --- |
| text input, textarea, select | `value` | `e.target.value` |
| checkbox, radio | `checked` | `e.target.checked` |

In React `textarea` and `select` take a `value` prop, unlike plain HTML.

### Step 5: many fields, one state object

```jsx run
function SignupForm({ onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const update = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  function validate(values) {
    const problems = {};
    if (values.name.trim().length < 2) problems.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(values.email)) problems.email = 'Enter a valid email';
    if (values.password.length < 8) problems.password = 'Password must be at least 8 characters';
    return problems;
  }
  function handleSubmit(e) {
    e.preventDefault();
    const problems = validate(form);
    setErrors(problems);
    if (Object.keys(problems).length === 0) onSubmit(form);
  }
  return (
    <form onSubmit={handleSubmit} noValidate>
      {['name', 'email', 'password'].map(field => (
        <label key={field}>
          {field}
          <input name={field} type={field === 'password' ? 'password' : 'text'} value={form[field]} onChange={update} aria-invalid={Boolean(errors[field])} />
          {errors[field] && <small role="alert">{errors[field]}</small>}
        </label>
      ))}
      <button type="submit">Create account</button>
    </form>
  );
}
render(<SignupForm onSubmit={data => console.log('submitted:', { ...data, password: '***' })} />);
type('[name=name]', 'A'); type('[name=email]', 'not-an-email');
submit('form');
console.log([...document.querySelectorAll('[role=alert]')].map(e => e.textContent));
type('[name=name]', 'Asha'); type('[name=email]', 'asha@example.com'); type('[name=password]', 'correct horse');
submit('form');
console.log('errors left:', document.querySelectorAll('[role=alert]').length);
```

**Line by line.**

- One state object holds all fields. Each input has a `name` matching its key.
- `update` handles every field: `[e.target.name]` is a **computed property name**, and `{ ...prev, ... }` copies the object instead of mutating it ([[js-objects-arrays]], and the reason is in [[react-state]]).
- `handleSubmit` calls `e.preventDefault()` so the browser does not reload ([[react-props-events]]), validates, stores the errors in state, and submits only if there are none.
- Errors are just state, shown with conditional rendering.

Client-side validation is for a fast, friendly experience. The server must validate again, because requests can be sent without your form ([[node-validation-security]]).

### Controlled vs uncontrolled

| | Controlled | Uncontrolled |
| --- | --- | --- |
| Value lives in | React state | the DOM element |
| Read it | from state, any time | when needed, through a ref or `new FormData(form)` |
| Re-renders per keystroke | yes | no |
| Use for | live validation, formatting, dependent fields | simple forms, file inputs (always uncontrolled) |

For large forms, a library such as React Hook Form manages this for you.

## Part 3: putting it together, a todo app

```jsx run
function TodoApp() {
  const [todos, setTodos] = useState([{ id: 1, text: 'Learn lists', done: true }]);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('all');

  function addTodo(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTodos(prev => [...prev, { id: Date.now() + prev.length, text, done: false }]);
    setDraft('');
  }
  const toggle = id => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = id => setTodos(prev => prev.filter(t => t.id !== id));

  const visible = todos.filter(t => filter === 'all' || (filter === 'done') === t.done);
  const remaining = todos.filter(t => !t.done).length;

  return (
    <div>
      <form onSubmit={addTodo}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="What needs doing?" />
        <button type="submit" disabled={!draft.trim()}>Add</button>
      </form>
      {['all', 'active', 'done'].map(f => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}>{f}</button>)}
      {visible.length === 0 ? <p>Nothing here</p> : (
        <ul>{visible.map(t => (
          <li key={t.id}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
            <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
            <button onClick={() => remove(t.id)}>Delete</button>
          </li>
        ))}</ul>
      )}
      <p id="summary">{remaining} left of {todos.length}</p>
    </div>
  );
}
const items = () => [...document.querySelectorAll('li span')].map(s => s.textContent).join(', ') || '(none)';
render(<TodoApp />);
type('input', 'Learn forms'); submit('form');
type('input', 'Build an app'); submit('form');
console.log('after adding   :', items(), '|', document.querySelector('#summary').textContent);
click('li:nth-child(2) input');
click('text=active');
console.log('filter active  :', items(), '|', document.querySelector('#summary').textContent);
click('text=done');
console.log('filter done    :', items());
click('text=all'); click('li:first-child button');
console.log('after a delete :', items(), '|', document.querySelector('#summary').textContent);
```

Everything from the three beginner stations is here. Study what is **state** and what is **computed**:

| Value | State or computed? | Why |
| --- | --- | --- |
| `todos`, `draft`, `filter` | state | they change over time and cannot be worked out from anything else |
| `visible`, `remaining` | computed in render | they follow from state; storing them too would let them fall out of sync |

Add, toggle and delete each produce a **new array** (`[...prev, x]`, `map`, `filter`) and never change the old one. That rule and its reason open [[react-state]].

!!! key
- Render lists with `map`; give each item a stable, unique `key` from the data.
- Index keys break state when items are inserted, removed or reordered.
- Controlled input = `value` from state + `onChange` setting state.
- `e.preventDefault()` in every form submit handler.
- One state object with `[e.target.name]` for multi-field forms; copy, never mutate.
- Store the minimum in state and compute the rest during render.
!!!

!!! trap
- Missing or unstable keys; putting the key on the wrong element (it goes on the outermost element returned inside `map`).
- `value` without `onChange`.
- Mutating: `todos.push(x); setTodos(todos)` does not re-render ([[react-state]]).
- Storing a filtered copy of a list in state and then having two lists to keep in sync.
- Forgetting `e.target.checked` for checkboxes.
- Validating only in the browser.
!!!

!!! twist What changes if...
- **...the list has 10,000 rows?** Render only the visible ones (virtualization) and paginate from the API ([[react-performance]], [[rest-api]]).
- **...the form submits to a server?** Add `submitting` and `error` state, disable the button while sending, and show the server's validation errors next to the fields ([[react-effects]], [[react-app-state]]).
- **...you want to reset a form completely?** Set state back to the initial object, or change the form component's `key` to remount it fresh ([[react-rendering]]).
- **...typing triggers a search request?** Debounce it so you do not send one request per keystroke ([[js-functional]], [[react-custom-hooks]]).
!!!

!!! model
A list is `data.map(item => <Row key={item.id} />)`. A form field is a loop: state shows in the input, typing updates state. Everything else on screen is calculated from that state.
!!!

## Practice

?? Why is `key={index}` dangerous for a list where items can be deleted?
After deleting the first item, every remaining item shifts to a lower index. React matches by key, so it believes the first row is still the first row with new props, and keeps that row's internal state (input text, checked boxes, focus) attached to what is now a different item.
??

?? Build a search box that filters a list of names as the user types, case-insensitively.
```jsx run
function Search({ names }) {
  const [query, setQuery] = useState('');
  const matches = names.filter(n => n.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ul>{matches.map(n => <li key={n}>{n}</li>)}</ul>
      {matches.length === 0 && <p>No match for "{query}"</p>}
    </div>
  );
}
render(<Search names={['Asha', 'Ravi', 'Meera', 'Aarav']} />);
type('input', 'RA'); console.log(text());
type('input', 'zz'); console.log(text());
```
The filtered list is computed from the query on each render; only the query is state.
??

?? In the todo app, why is `remaining` not stored with `useState`?
It can always be calculated from `todos`. A second piece of state would have to be updated in every add, toggle and delete; forgetting one would show a wrong number. Derived values are computed, not stored.
??

?? What is the difference between a controlled and an uncontrolled input, and when would you choose uncontrolled?
Controlled: React state holds the value and the input displays it. Uncontrolled: the DOM holds the value and you read it on submit with a ref or `FormData`. Choose uncontrolled for simple forms where you only need values at submit, for file inputs, or to avoid re-rendering a very large form on each keystroke.
??

?? Write the immutable update for: marking the todo with `id === 3` as done, in an array of todo objects.
`setTodos(prev => prev.map(t => t.id === 3 ? { ...t, done: true } : t))`. `map` returns a new array; the changed item is a new object; every other item is reused as is.
??
