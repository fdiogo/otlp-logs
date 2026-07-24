---
paths:
  - "src/**/*.tsx"
---

# Avoid hoisted variables and helper functions

Don't hoist JSX, other values, or one-off render functions into intermediate
variables/functions before returning/rendering. Inline them directly, especially in JSX.

```tsx
// Bad
const fieldSelect = <Select ... />;
const operatorSelect = <Select ... />;
return (
  <div className="flex flex-row items-start gap-2">
    {fieldSelect}
    {operatorSelect}
  </div>
);

// Good
return (
  <div className="flex flex-row items-start gap-2">
    <Select ... />
    <Select ... />
  </div>
);
```

```tsx
// Bad
function renderAction(action: Action) {
  return <ActionRow action={action} />;
}
return <div>{actions.map(renderAction)}</div>;

// Good
return (
  <div>
    {actions.map((action) => (
      <ActionRow key={action.id} action={action} />
    ))}
  </div>
);
```

If a "render function" is used in a single place, inline it fully at its call site (no
intermediate function at all). If it's genuinely reused across multiple call sites (e.g. once
for top-level conditions and once for grouped conditions), don't keep it as a closure defined
inside the parent component's render body either — extract it into a proper component (e.g.
`ConditionRow`) instead. Closures re-declared on every render of the parent are worse than a
real component: they can't be memoized, break devtools/profiling, and remount their subtree's
state on every parent render.

# Inline prop types for small, co-located components

For very small/simple components, especially when declared alongside other components in the
same file, inline the prop types into the component declaration instead of hoisting a separate
`interface`/`type`.

```tsx
// Bad
interface CountsProps {
  matching: number;
  affected: number;
  total: number;
}
function Counts({ matching, affected, total }: CountsProps) { ... }

// Good
function Counts(props: { matching: number; affected: number; total: number }) {
  const { matching, affected, total } = props;
  ...
}
```

Destructure props inside the function body, not in the header — destructuring in the header
next to the inline type gets visually noisy. Take the whole `props` object as the parameter and
destructure it as the first line of the body.
