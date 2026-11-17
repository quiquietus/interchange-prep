---
summary: When two components need the same stateful logic, you extract it into a custom hook. Refs give a component a value that survives renders without causing one. Together they are how real React codebases stay small.
time: 40
needs: react-effects, js-closures
---
## The problem this solves

Three components each need "remember this value in localStorage". Two need "is the window narrower than 600 pixels". Five fetch data with loading and error states. Copying the same `useState` and `useEffect` lines into each one means every bug must be fixed in every copy.

Ordinary functions cannot hold this logic, because the logic uses hooks, and hooks only work inside components... or inside other hooks. A **custom hook** is a function whose name starts with `use` and which calls other hooks. That is the entire definition.

## Step 1: extract a hook

```jsx run
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(value => !value), []);
  return [on, toggle];
}

function Menu() {
  const [open, toggleOpen] = useToggle();
  return <div><button onClick={toggleOpen}>Menu</button>{open && <nav>Home | Cart | Profile</nav>}</div>;
}
function DarkMode() {
  const [dark, toggleDark] = useToggle(true);
  return <button onClick={toggleDark}>Theme: {dark ? 'dark' : 'light'}</button>;
}

render(<div><Menu /><DarkMode /></div>);
console.log(text());
click('text=Menu');
console.log(text());
```

`Menu` and `DarkMode` both use `useToggle`, and clicking the menu did not change the theme.

**The rule that surprises people: a custom hook shares logic, not state.** Each component that calls the hook gets its own independent `useState` inside it, exactly as if you had pasted the lines in. To *share* a value between components you lift state up or use context ([[react-app-state]]).

A hook may return anything: a value, an array (when callers will rename, like `useState`), or an object (when there are several named things).

## Step 2: a hook with an effect

```jsx run
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved === null ? initialValue : JSON.parse(saved); }
    catch { return initialValue; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [key, value]);
  return [value, setValue];
}

function FontSize() {
  const [size, setSize] = useLocalStorage('font-size', 14);
  return <button onClick={() => setSize(size + 2)}>Font size: {size}</button>;
}

render(<FontSize />);
click('button'); click('button');
console.log(text(), '| stored:', localStorage.getItem('font-size'));
unmount();
render(<FontSize />);
console.log('after a "page reload":', text());
```

Used exactly like `useState`, but the value survives a reload. Three details:

- `useState(() => ...)` with a **function** runs the read only on the first render, not on every one ([[react-state]]).
- The effect writes whenever `key` or `value` changes ([[react-effects]]).
- Storage can throw (private mode, quota), so both sides are wrapped in `try/catch` ([[js-errors]]).

## Step 3: a data-fetching hook

```jsx run
const fakeApi = { '/users/1': { name: 'Asha' }, '/users/2': { name: 'Ravi' } };
globalThis.fetch = (url, { signal } = {}) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => url in fakeApi ? resolve({ ok: true, json: async () => fakeApi[url] }) : resolve({ ok: false, status: 404 }), url.endsWith('1') ? 40 : 10);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
});

function useFetch(url) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    fetch(url, { signal: controller.signal })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
      .then(data => setState({ status: 'success', data, error: null }))
      .catch(error => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }); });
    return () => controller.abort();
  }, [url]);
  return state;
}

function UserName({ id }) {
  const { status, data, error } = useFetch('/users/' + id);
  if (status === 'loading') return <p>Loading user {id}...</p>;
  if (status === 'error') return <p>Could not load: {error}</p>;
  return <p>User {id} is {data.name}</p>;
}

(async () => {
  render(<UserName id={1} />);  console.log(text());
  await wait(60);               console.log(text());
  render(<UserName id={1} />);
  render(<UserName id={2} />);  await wait(60); console.log('quick switch 1 -> 2:', text());
  render(<UserName id={9} />);  await wait(30); console.log(text());
})();
```

The whole loading, success, error and cancellation pattern from [[react-effects]] lives in one place, and a component using it is three lines. The "quick switch" line shows the race being handled: the slow request for user 1 was aborted when the id changed, so it could not overwrite user 2.

In a production app you would use TanStack Query or SWR instead, which add caching, de-duplication and refetching ([[react-app-state]]). Building this once shows what those libraries do.

## Step 4: refs, a value that does not trigger a render

`useRef(initial)` returns an object `{ current: initial }` that React keeps for the life of the component. Changing `.current` does **not** re-render.

```jsx run
function Tracker() {
  const [count, setCount] = useState(0);
  const renders = useRef(0);
  const clicksNotShown = useRef(0);
  renders.current++;
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>state +1</button>
      <button onClick={() => { clicksNotShown.current++; }}>ref +1</button>
      <p>state = {count}, ref = {clicksNotShown.current}, renders = {renders.current}</p>
    </div>
  );
}
render(<Tracker />);
click('text=ref +1'); click('text=ref +1'); click('text=ref +1');
console.log('after 3 ref clicks  :', text().split('+1 ').pop());
click('text=state +1');
console.log('after 1 state click :', text().split('+1 ').pop());
```

Three clicks on the ref button changed the value but the screen still showed the old numbers, because nothing asked React to render. The state click triggered a render, and only then did the ref's current value appear.

| | `useState` | `useRef` | plain `let` in the component |
| --- | --- | --- | --- |
| Survives re-renders | yes | yes | no, reset every render |
| Changing it re-renders | yes | no | no |
| Use for | anything displayed | timer ids, DOM nodes, previous values, flags | values computed fresh each render |

### Refs to DOM elements

```jsx run
function SearchBox() {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current.focus(); }, []);
  return (
    <div>
      <input ref={inputRef} placeholder="Search" />
      <button onClick={() => { inputRef.current.value = ''; inputRef.current.focus(); }}>Clear</button>
    </div>
  );
}
render(<SearchBox />);
console.log('focused element after mount:', document.activeElement.tagName, document.activeElement.placeholder);
```

Passing a ref to the `ref` attribute makes React put the real DOM element in `.current` after rendering. Use it for the things React's declarative model does not cover: focus, scrolling, measuring size, playing media, integrating a non-React library. Do **not** use it to change content that React renders; that is state's job.

### Refs fix stale closures

```jsx run
function useInterval(callback, delay) {
  const latest = useRef(callback);
  useEffect(() => { latest.current = callback; });
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => latest.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function Stopwatch() {
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);
  useInterval(() => setTicks(ticks + 1), running ? 20 : null);
  return <button onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Resume'} (ticks: {ticks})</button>;
}

(async () => {
  render(<Stopwatch />);
  await wait(110);
  const afterRun = Number(text().match(/\d+/)[0]);
  click('button');
  await wait(80);
  const afterPause = Number(text().match(/\d+/)[0]);
  console.log('counted past 1 while running:', afterRun > 1, '| stopped while paused:', afterPause === afterRun || afterPause === afterRun + 1);
})();
```

The callback `() => setTicks(ticks + 1)` reads `ticks` from its own render, the stale-closure trap from [[react-effects]]. `useInterval` stores the **latest** callback in a ref on every render, and the interval calls `latest.current()`. The interval is created once, yet always runs the newest function. This "latest ref" pattern is the standard way to give a long-lived callback access to current values.

## Step 5: more hooks worth writing once

```jsx run
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const id = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return debounced;
}
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

let searches = 0;
function Search() {
  const [text, setText] = useState('');
  const query = useDebouncedValue(text, 40);
  const previous = usePrevious(query);
  useEffect(() => { if (query) searches++; }, [query]);
  return <div><input value={text} onChange={e => setText(e.target.value)} /><p>searching for "{query}" (before: "{previous ?? ''}")</p></div>;
}
(async () => {
  render(<Search />);
  for (const partial of ['r', 're', 'rea', 'reac', 'react']) { type('input', partial); await wait(5); }
  await wait(80);
  console.log(text(), '| API calls made:', searches);
})();
```

Five keystrokes, one search: each keystroke's effect cleanup cancelled the previous timer, which is debounce from [[js-functional]] written with hooks.

| Hook | Does |
| --- | --- |
| `useToggle`, `useCounter` | tiny state helpers |
| `useLocalStorage` | state that persists |
| `useFetch` / `useQuery` | server data with status |
| `useDebouncedValue` | a value that settles after a pause |
| `usePrevious` | the value from the previous render |
| `useInterval`, `useTimeout` | timers that are cleaned up and never stale |
| `useMediaQuery`, `useOnlineStatus` | subscribe to a browser API |
| `useClickOutside` | close a menu or modal |

## The rule, stated precisely

A custom hook is a function named `use...` that may call hooks. It follows the same rules of hooks as components (top level only, same order each render, [[react-state]]). Each call site has its own isolated state. A ref is a mutable container whose identity is stable across renders and whose mutation does not schedule a render.

!!! key
- Custom hooks reuse **stateful logic**; each caller gets separate state.
- The `use` prefix is required so React and the linter can check the rules of hooks.
- `useRef`: persistent, mutable, no re-render. `useState`: persistent, triggers a render.
- DOM refs are for focus, scroll, measurement and third-party libraries.
- The "latest ref" pattern gives long-lived callbacks fresh values.
- Read and write `ref.current` in effects and handlers, not during rendering (the render counter above is a deliberate exception for demonstration).
!!!

!!! trap
- Expecting two components using the same hook to share its state.
- Calling a hook conditionally or inside a loop, even a custom one.
- Using a ref for something that should appear on screen: it changes, nothing updates.
- Reading `ref.current` during render and expecting it to be the DOM node on the first render; it is `null` until after mount.
- Returning a new object or function from a hook on every render, which breaks consumers' dependency arrays. Memoize what you return ([[react-performance]]).
!!!

!!! twist What changes if...
- **...a parent needs to call a method on a child (focus its input)?** Pass a ref to the child; in React 19 `ref` is a normal prop, and `useImperativeHandle` limits what the parent can do with it.
- **...the hook subscribes to an external store (browser online status, a WebSocket)?** `useSyncExternalStore` is the hook designed for that; it handles concurrent rendering correctly.
- **...you want to test a hook?** Render a tiny component that uses it, or use `renderHook` from React Testing Library ([[node-testing]] ideas apply).
!!!

!!! model
A custom hook is a recipe a component follows; every component cooks its own dish. A ref is a pocket: you can keep something in it across renders, and React does not look inside.
!!!

## Practice

?? Write `useCounter(initial, step)` returning the count and `increment`, `decrement`, `reset`.
```jsx run
function useCounter(initial = 0, step = 1) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount(c => c + step), [step]);
  const decrement = useCallback(() => setCount(c => c - step), [step]);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, increment, decrement, reset };
}
function Demo() {
  const { count, increment, decrement, reset } = useCounter(10, 5);
  return <div><b>{count}</b><button onClick={increment}>up</button><button onClick={decrement}>down</button><button onClick={reset}>reset</button></div>;
}
render(<Demo />);
click('text=up'); click('text=up'); click('text=down'); console.log(text().split(' ')[0]);
click('text=reset'); console.log(text().split(' ')[0]);
```
??

?? Two components call `useLocalStorage('theme', 'light')`. One changes the theme. Does the other update?
No. They wrote to the same storage key, but each has its own React state, and nothing told the second to re-read. To keep them in sync, lift the state into a context provider, or subscribe to the `storage` event (which fires in *other* tabs) plus a custom event for the same tab.
??

?? When should a value be in a ref instead of state?
When it must persist between renders but changing it should not update the screen: an interval id to clear later, an `AbortController`, whether the component has mounted, the previous value of a prop, a DOM node.
??

?? Write `useClickOutside(ref, handler)`.
```jsx run
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = event => { if (ref.current && !ref.current.contains(event.target)) handler(event); };
    document.addEventListener('click', listener);
    return () => document.removeEventListener('click', listener);
  }, [ref, handler]);
}
function Dropdown() {
  const [open, setOpen] = useState(true);
  const boxRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(boxRef, close);
  return <div><p id="outside">outside area</p><div ref={boxRef}>{open ? <button>menu item</button> : 'closed'}</div></div>;
}
render(<Dropdown />);
click('text=menu item'); console.log('click inside :', text());
click('#outside');       console.log('click outside:', text());
```
The cleanup removes the listener, so nothing leaks when the component unmounts ([[js-memory]]).
??

?? Why must custom hook names start with `use`?
It is how React's lint rules recognize a function that may call hooks and therefore must obey the rules of hooks. It also tells readers that the function may hold state or effects and so cannot be called conditionally.
??
