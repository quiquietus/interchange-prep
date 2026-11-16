---
summary: React is fast by default. When it is not, the cause is almost always too many renders, renders that are too expensive, or too much JavaScript shipped. Each has a specific tool.
time: 25
needs: react-rendering, react-effects
videoSearch: React memo useMemo useCallback explained when to use
---
## The problem this solves

From [[react-rendering]]: when state changes, the component and its entire subtree re-render. Usually that is cheap. It becomes a problem when a keystroke in a search box re-renders a 2,000-row table, or a chart recomputes on every unrelated update. The goal is not "fewer renders" as such; it is removing the specific wasted work a profiler shows you.

## Intuition

Three levers, in the order you should reach for them:

| Lever | Idea | Tools |
| --- | --- | --- |
| 1. Structure | keep state close to where it is used so less of the tree re-renders | move state down, pass `children`, split components |
| 2. Skip work | reuse the previous result when inputs are unchanged | `React.memo`, `useMemo`, `useCallback` |
| 3. Do less at once | load and render only what is needed now | code splitting, list virtualization, debouncing |

All of lever 2 is **memoization**, the same cache-by-input idea as the `memoize` function in [[js-closures]], and all of it depends on comparing inputs **by reference** ([[js-values]]).

## Build it step by step

### Example 1: fix it with structure first

```jsx
function Page() {
  const [text, setText] = useState('');
  return (
    <>
      <input value={text} onChange={e => setText(e.target.value)} />
      <ExpensiveChart />
    </>
  );
}
```

```output
every keystroke: render Page, render ExpensiveChart
```

```jsx
function Page() {
  return (
    <>
      <SearchInput />
      <ExpensiveChart />
    </>
  );
}
function SearchInput() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}
```

```output
every keystroke: render SearchInput only
```

The state moved down into the only component that uses it, so `Page` no longer re-renders. No memoization API was needed.

### Example 2: React.memo, and how it silently breaks

```jsx
const Row = React.memo(function Row({ item, onSelect }) {
  console.log('render row', item.id);
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;
});

function List({ items }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const handleSelect = id => setSelected(id);
  return items.map(item => <Row key={item.id} item={item} onSelect={handleSelect} />);
}
```

```output
typing in the filter: every Row still re-renders
```

`React.memo` skips a re-render when all props are shallow-equal to last time. But `handleSelect` is created anew on every render of `List`. A new function is a new reference, so `onSelect` "changed" for every row and `memo` never skips.

```jsx
const handleSelect = useCallback(id => setSelected(id), []);
```

```output
typing in the filter: no Row re-renders
```

`useCallback(fn, deps)` returns the **same function object** between renders until a dependency changes. It is only useful when the function is passed to a memoized child or used as an effect dependency ([[react-effects]]).

### Example 3: useMemo for expensive values and stable references

```jsx
function ProductList({ products, query, theme }) {
  const visible = useMemo(
    () => products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).sort(byPrice),
    [products, query]
  );
  const chartOptions = useMemo(() => ({ color: theme.accent, animate: false }), [theme.accent]);
  return <><Chart options={chartOptions} /><Grid items={visible} /></>;
}
```

```output
theme changes:  filter + sort is NOT recomputed (products and query unchanged)
query changes:  filter + sort recomputed; chartOptions keeps its reference, so a memoized Chart skips
```

`useMemo(compute, deps)` caches a **value**. Two reasons to use it: the computation is measurably slow, or the result is an object or array whose identity must stay stable for a memoized child or a dependency array.

| | Caches | Returns | Equivalent to |
| --- | --- | --- | --- |
| `React.memo(Component)` | a component's render output | a component | skip render if props are shallow-equal |
| `useMemo(() => value, deps)` | a computed value | the value | |
| `useCallback(fn, deps)` | a function identity | the function | `useMemo(() => fn, deps)` |

### Example 4: ship and render less

```jsx
const AdminPanel = React.lazy(() => import('./AdminPanel'));

<Suspense fallback={<Spinner />}>
  {isAdmin && <AdminPanel />}
</Suspense>
```

**Code splitting**: `import()` makes the bundler put `AdminPanel` in a separate file that is downloaded only when first rendered. Split by route first, since that gives the largest saving.

**Virtualization** (windowing): for a list of 10,000 rows, render only the 20 or so that are visible plus a small buffer, and reuse them while scrolling (libraries: `react-window`, TanStack Virtual). The DOM stays small no matter how long the list is.

**Debouncing** input that triggers heavy work, with the hook from [[react-effects]] built on [[js-functional]].

## The rule, stated precisely

`React.memo` re-renders only when `Object.is` differs for some prop. `useMemo` and `useCallback` return the cached result while every dependency is `Object.is`-equal to the previous render's. All three are performance hints; correct code must still work without them.

!!! key
- Measure first with the React DevTools Profiler ("why did this render?"). Do not guess.
- Order of fixes: structure, then memoization, then splitting and virtualization.
- Memoization has a cost: memory for the cached value and a comparison on every render. Wrapping everything makes code slower to read and not faster to run.
- `memo` + unstable props (inline objects, arrays, arrow functions) does nothing.
- The React Compiler (React 19 era) can insert this memoization automatically; knowing what it does and why is still what interviewers test.
!!!

!!! trap
- `useCallback` on a function that is only passed to a plain DOM element or a non-memoized child. No benefit.
- `useMemo` around trivial arithmetic.
- Missing dependencies, giving stale values ([[react-effects]]).
- One giant context holding everything: any change re-renders every consumer ([[react-app-state]]).
- Creating a debounced function during render; it must be created once.
!!!

!!! twist What changes if...
- **...a child is slow but its props never change?** Pass it as `children`. Elements created by the parent's parent keep the same reference, so React skips them without `memo`.
- **...typing lags because a huge list filters on each key?** `useDeferredValue(query)` or `startTransition` lets React keep the input responsive and render the list at lower priority.
- **...the first load is slow, not interactions?** That is bundle size and network: split code, compress, cache with a CDN ([[hld-caching]]), lazy-load images.
!!!

!!! model
First make less of the tree depend on the changing state. Then, where a profiler points, let React reuse yesterday's answer when today's inputs are identical.
!!!

## Practice

?? `useMemo` vs `useCallback` vs `React.memo` in one breath.
`React.memo` wraps a component and skips its render when props are unchanged. `useMemo` caches a computed value between renders. `useCallback` caches a function's identity between renders, mainly so that memoized children and effect dependency arrays see it as unchanged.
??

?? A memoized child still re-renders on every parent render. List the possible causes.
A prop is a new reference each time: an inline object or array, an inline arrow function, or `children` JSX created by the re-rendering parent. Or the child reads a context that changed. Or its own state changed. Check with the Profiler which prop differs.
??

?? When should you not use `useMemo`?
When the calculation is cheap and the value is not a dependency or a prop of a memoized component. The hook adds a dependency comparison and retains memory; for simple work that costs more than it saves.
??

?? How would you render a feed of 50,000 items smoothly?
Paginate or infinite-scroll with cursor pagination from the API ([[rest-api]]), virtualize the list so only visible rows are in the DOM, give rows stable keys, memoize row components, and lazy-load images.
??

?? What is code splitting and where do you split first?
Breaking the JavaScript bundle into chunks loaded on demand with dynamic `import()` and `React.lazy`. Split at route boundaries first, then heavy rarely used components such as editors, charts and admin screens.
??
