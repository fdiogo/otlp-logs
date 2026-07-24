---
name:	component-prototype
description: Build a throwaway prototype to answer a design question. Use when the user wants to explore what a page should look like.
---

# UI Prototype

Generate **several radically different UI variations** on a single component, switchable from a single prop. The user flips between variants, picks one (or steals bits from each), then throws the rest away.

## When this is the right shape

- "What should this component look like?"
- "I want to see a few options for this component before committing."
- "Try a different layout for this component."
- Any time the user would otherwise spend a day picking between three vague mockups in their head.

## Process

### 1. State the question and pick N

Default to **3 variants**. More than 5 stops being radically different and starts being noise — cap there.

Write down the plan in one line, in the prototype's location or a top-of-file comment:

> "Three variants of the Transaction component, switchable via `_variant` prop."

This works whether the user is here to push back or not.

### 2. Generate radically different variants

Draft each variant. Hold each one to:

- The component's purpose and the data it has access to.
- The project's component library / styling system (TailwindCSS, shadcn, MUI, plain CSS, whatever).
- A clear exported component name, e.g. `VariantA`, `VariantB`, `VariantC`.

Variants must be **structurally different** — different layout, different information hierarchy, different primary affordance, not just different colours. Three slightly-tweaked card grids isn't a component prototype, it's wallpaper. If two drafts come out too similar, redo one with explicit "do not use a card grid" guidance.

### 3. Wire them together

Create a `_variant` prop, the underscode is to reduce potential clashes:

```tsx
<Component _variant="A" />
<Component _variant="B" />
<Component _variant="C" />
```


### 4. Add or update existing Storybook stories

Use the /storybook skill to know how this should be done.

Make sure you add controls to change between variants.

### 5. Hand it over

The user will flip through whenever they get to it. The interesting feedback is usually **"I want the header from B with the sidebar from C"** — that's the actual design they want.

### 6. Capture the answer and clean up

Once a variant has won, capture the answer — which variant and why — then capture the prototype the way the [SKILL](SKILL.md) describes. Fold the winner into the real code.

## Anti-patterns

- **Variants that differ only in colour or copy.** That's a tweak, not a prototype. Real variants disagree about structure.
- **Sharing too much code between variants.** A shared `<Header>` is fine; a shared `<Layout>` defeats the point. Each variant should be free to throw out the layout.
- **Promoting the prototype directly to production.** The variant code was written under prototype constraints (no tests, minimal error handling). Rewrite it properly when you fold it in.