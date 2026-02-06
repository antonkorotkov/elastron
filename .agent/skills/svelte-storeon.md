---
name: svelte-storeon-development
description: Guidelines for developing frontend features using Svelte 5 and Storeon in Elastron
---

# Svelte & Storeon Development

Elastron uses Svelte 5 and Storeon for the frontend.

## Svelte 5 Syntax
This project uses Svelte 5.
- Use `$derived` for derived state.
- Use `$state` for local reactive state (though Storeon handles global state).

## Storeon Usage
State is managed via `storeon`.

### 1. Structure
Store modules are located in `src/store/`.
Each module should export a function accepting the `store` object.

```javascript
// src/store/example.js
export const exampleModule = store => {
  store.on('@init', () => ({ count: 0 }))
  
  store.on('count/add', ({ count }, number) => {
    return { count: count + number }
  })
}
```

### 2. Registration
Register new modules in `src/store/index.js`.

### 3. Component Usage
Use `useStoreon` hook.

```javascript
import { useStoreon } from '@storeon/svelte'

const { dispatch, count } = useStoreon('count')

const increment = () => {
    dispatch('count/add', 1)
}
```

## Styles
Use SCSS in `<style>` blocks.
Global styles are in `src/index.css` (or similar, check file tree).
