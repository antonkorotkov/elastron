## Why

Scrolling the search results Table view feels like the whole app freezes for a few hundred milliseconds at a time. A 46-second DevTools trace shows the app is not busy during those freezes — the renderer main thread is 5.6% utilised (8.1% while scrolling), the single longest task is 35.7ms at trace startup, and only one task in the entire recording exceeds 16ms.

The freeze is caused by the expanded row detail (`RowDetail.svelte`), which puts a `max-height: 400px; overflow: auto` scroll box inside the results table's own scroll container. Chrome latches a trackpad gesture to one scroller for the gesture's entire duration, momentum included, and does not chain to an ancestor when that scroller reaches its limit. Every flick that starts over an expanded row therefore scrolls the small inner box for a fraction of the gesture and then has the rest of its deltas silently discarded. The compositor then emits `NeedsBeginFrameChanged {needsBeginFrame: 0}` and stops producing frames altogether, so nothing on screen moves — which is indistinguishable from a hang.

Trace evidence:

- 9.7 seconds of the 46-second recording were spent stalled with scroll input still arriving.
- 12 of the 14 gestures that stalled mid-flick were latched to `.flattened-table-wrapper`; 20 of 20 gestures on the virtualized indices list (`VirtualTable`'s `.scrollable`) completed normally.
- Scroll movement per gesture delta: **0.83** for healthy gestures, **0.02** for stalled ones — 262 scroll deltas produced 6 actual scrolls.
- Inside the stalls the renderer produced 258 frames in `STATE_NO_UPDATE_DESIRED` against 7 presented; elsewhere it presented 4587.

The same trace exonerates the monitoring poller, which was the original suspect: it transfers 12.8 KB per tick (`cluster/health` 435 B, `cluster/stats` 8.3 KB, `nodes/stats` 4.1 KB) and only 2 of the 81 dropped frames fall within 400ms of a poll.

## What Changes

- Remove the nested scroll container from the Table View tab of the expanded row detail (`.flattened-table-wrapper`: `max-height: 400px; overflow-y: auto`).
- Remove the identical nested scroll container from the JSON View tab (`.json-code-wrapper`: `max-height: 400px; overflow: auto`), which has the same trap.
- Replace the pixel-height cap with a content-level cap so an expanded row still cannot grow without bound: render a limited number of fields (Table View) and a limited number of JSON lines (JSON View), with an in-place control to reveal the rest. This follows the cap constants already established in `src/lib/utils/tableHelpers.js` (`MAX_RENDERED_ROWS`, `CELL_MAX_CHARS`, `TITLE_MAX_CHARS`).
- The results table's own scroller (`.table-scroll-wrapper`) becomes the only scroller in the results flick path, so every gesture over the results area scrolls the results.

## Capabilities

### New Capabilities

- `search-result-row-detail`: the behavior of the expanded row detail panel in the search results Table view — how a document's fields and raw JSON are presented, how oversized documents are bounded, and the guarantee that the panel introduces no scroll region of its own.

### Modified Capabilities

None. `openspec/specs/` is currently empty; this change introduces the project's first capability.

## Impact

- `src/lib/workspace/search/results-table/RowDetail.svelte` — styles for `.flattened-table-wrapper` and `.json-code-wrapper`, plus the truncation state and reveal control for both tabs.
- `src/lib/workspace/search/results-table/RowDetail.svelte.test.js` — coverage for the truncation and reveal behavior.
- `src/lib/utils/tableHelpers.js` — new cap constants alongside the existing ones.
- No change to `ResultsTable.svelte`'s scrolling or row rendering: it renders `visibleHits` directly and is not virtualized, so a taller expanded row has no virtualizer interaction to account for.
- Out of scope but worth verifying separately: `ColumnsSidebar.svelte`'s `.column-list.scrollable` is another nested scroller in the search view. It is a fixed-height side panel rather than a region inside the results flick path, and the trace recorded no stalled gesture latched to it.
