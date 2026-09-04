## Context

See proposal.md — Why for the motivation and the trace evidence.

The structural facts that shape the approach:

```
  ResultsTable.svelte:345   <div class="table-scroll-wrapper">   overflow: auto   <-- outer scroller
    ResultsTable.svelte:453   <RowDetail>
      RowDetail.svelte:75       <div class="flattened-table-wrapper">   max-height:400px; overflow-y:auto
      RowDetail.svelte:113      <div class="json-code-wrapper">         max-height:400px; overflow:auto
```

Both tabs of `RowDetail` carry the same trap; a fix that touches only the Table View tab leaves the JSON View broken in exactly the same way.

`ResultsTable` is not virtualized — it renders `visibleHits` (capped at `MAX_RENDERED_ROWS = 500`) directly. There is no virtualizer measurement to reconcile when an expanded row becomes taller, which is what makes the straightforward fix viable here.

The codebase already bounds oversized content by counting content rather than by clipping pixels: `src/lib/utils/tableHelpers.js` exports `MAX_RENDERED_ROWS`, `CELL_MAX_CHARS` and `TITLE_MAX_CHARS`, all consumed by `ResultsTable`. This change follows that existing pattern rather than introducing a new one.

## Goals / Non-Goals

**Goals:**

- The results area contains exactly one scroller, so no gesture over it can be latched to a container that will run out of range mid-flick.
- An expanded row stays bounded for pathological documents (hundreds of fields, very large `_source`) without a scroll region.
- Both tabs of the detail panel are fixed together.

**Non-Goals:**

- Any change to the monitoring poller. The trace exonerates it and it is tracked separately, if at all.
- Any change to `VirtualTable`. Its `.scrollable` completed 20 of 20 gestures cleanly in the trace; the four fully-dead gestures recorded against it were the indices list at its genuine bottom, which reads as "end of list", not as a freeze.
- Restructuring the detail panel into a drawer or side panel (see Decisions).
- Auditing every other nested scroller in the app.

## Decisions

### Remove the inner scroller rather than trying to make it chain

`overscroll-behavior` is the obvious-looking lever and it does not work here. It governs whether a scroll *chains* to an ancestor, but Chrome's gesture latching binds a trackpad gesture to the scroller chosen at `GestureScrollBegin` for the gesture's whole lifetime, momentum included, and does not re-target on reaching a limit. The default is already `auto`; setting `contain` would make the behavior strictly worse. Wheel-event handlers that manually forward leftover deltas to the parent were also rejected: they fight the compositor, only work for the events that reach JS, and would put a listener on the hottest path in the app to work around a layout decision.

Removing `max-height` + `overflow` removes the second scroller entirely, which removes the possibility of a latch to the wrong target. This is the only option that fixes the cause rather than the symptom.

Alternative considered: moving the row detail out of the results scroll flow into a side drawer or bottom panel. That also eliminates the nesting and is arguably a better way to read a document, but it is a UX redesign rather than a bug fix, it changes how users compare rows, and it would make this change much harder to review against the trace evidence that motivated it. Worth proposing on its own merits later.

### Bound by content count, not by pixel height

Dropping `max-height` without a replacement lets a document with 300 fields produce an expanded row several screens tall, which is a real regression in navigability even though it is not a freeze. The replacement must not reintroduce a scroll region, so it has to cut the content rather than clip the box.

Counting is also more predictable than measuring: it does not depend on font size, zoom, theme, or how long individual values are, and it needs no layout read.

Suggested initial limits, to be defined in `src/lib/utils/tableHelpers.js` next to the existing caps: **50 fields** for the Table View and **100 lines** for the JSON View. Both are comfortably more than a typical document and small enough that the expanded row stays roughly a screen or two. These are starting values, cheap to tune once the change is in use.

### Truncate the display, never the copy

`Copy JSON` must keep copying the complete `_source`. Truncation is a rendering concern; a user who hits the button expects the document, not what happened to fit. `sourceJson` therefore stays the full formatted string and only the rendered slice is cut.

### Metadata fields survive truncation

`RowDetail` already puts `_id`, `_index` and `_score` at the head of its field list, deduped against `_source`. Slicing the first N fields therefore preserves them for free — but it is preserved deliberately, and specified, because reordering that list later would silently break it.

### Reveal state lives per row and per tab

`ResultsTable` already keeps per-row tab state in `rowTabs[id]`, keyed by `rowId(hit, position)`. Reveal state follows the same shape and the same key. Keeping it in the parent rather than inside `RowDetail` is not required by anything here — `RowDetail` is remounted when a row is collapsed and re-expanded, which is exactly the reset behavior the spec asks for — so local component state is the simpler choice unless the reveal needs to survive a collapse, which it should not.

## Risks / Trade-offs

- **A very tall expanded row makes the surrounding rows harder to navigate past.** → The content caps keep the default height to roughly a screen or two; the user opts into more. This is the same trade `MAX_RENDERED_ROWS` already makes for the results list itself.

- **Removing `max-height` changes the visual weight of an expanded row in both themes.** → The panel keeps its border, radius, background and padding; only the height constraint and overflow go. Worth a visual check in light and dark before merging, since `.flattened-table-wrapper` and `.json-code-wrapper` both carry `.inverted` variants.

- **The same trap may exist elsewhere in the search view.** → `ColumnsSidebar.svelte:252` has a `.column-list.scrollable`. It is a fixed-height side panel rather than a region in the results flick path, and no stalled gesture in the trace was latched to it, so it stays out of scope. It should be re-checked if users report the same symptom in the sidebar.

- **The fix is verified by absence, which is easy to get wrong.** → The verification step is a repeat trace, not a look-and-feel judgement: the per-gesture scroll-movement ratio should stay near 0.83 for gestures that start over an expanded row, where it is currently 0.02.

## Migration Plan

None required. The change is confined to one component's presentation and adds no persisted state, no API surface, and no dependency. It ships and reverts as an ordinary code change.
