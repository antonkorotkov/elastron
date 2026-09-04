## 1. Content caps

- [x] 1.1 Add `DETAIL_MAX_FIELDS = 50` and `DETAIL_MAX_JSON_LINES = 100` to `src/lib/utils/tableHelpers.js`, alongside the existing `MAX_RENDERED_ROWS` / `CELL_MAX_CHARS` / `TITLE_MAX_CHARS`, and verify `yarn vitest run src/lib/utils` still passes

## 2. Remove the nested scrollers

- [x] 2.1 Delete `max-height: 400px` and `overflow-y: auto` from `.flattened-table-wrapper` in `src/lib/workspace/search/results-table/RowDetail.svelte`, keeping its border, radius and `.inverted` variant; verify by expanding a row in the search Table view and confirming the field table has no scrollbar of its own
- [x] 2.2 Delete `max-height: 400px` and `overflow: auto` from `.json-code-wrapper` in the same file, keeping its background, border, padding and `.inverted` variant; verify by opening the JSON View tab of an expanded row and confirming the code block has no scrollbar of its own
- [x] 2.3 Grep `src/lib/workspace/search/` for any remaining `overflow` paired with a height constraint inside the results flick path and confirm `.table-scroll-wrapper` is the only scroller left there (`ColumnsSidebar`'s `.column-list.scrollable` is deliberately out of scope — see design.md)

## 3. Bound the Table View by field count

- [x] 3.1 Add per-instance reveal state to `RowDetail.svelte` and render only the first `DETAIL_MAX_FIELDS` entries of the derived `fields` list while it is unrevealed; verify `_id`, `_index` and `_score` are still present for a document with more than 50 fields
- [x] 3.2 Render a reveal control below the field table when the document exceeds the cap, stating how many fields are hidden, and hide the control once revealed; verify against a document with 60+ fields that the count is correct and the control disappears after activation
- [x] 3.3 Confirm reveal state does not leak between rows: expand two oversized rows, reveal the first, and verify the second is still truncated

## 4. Bound the JSON View by line count

- [x] 4.1 Render only the first `DETAIL_MAX_JSON_LINES` lines of `sourceJson` in the JSON View tab while unrevealed, with its own reveal control indicating the output is truncated; verify against a document whose formatted `_source` exceeds 100 lines
- [x] 4.2 Verify `Copy JSON` still copies the complete `_source` while the JSON View is truncated — `onCopy(sourceJson)` must keep receiving the full string, not the rendered slice
- [x] 4.3 Verify the Table View and JSON View reveal states are independent for the same row

## 5. Tests

- [x] 5.1 Extend `src/lib/workspace/search/results-table/RowDetail.svelte.test.js` with cases for: field list truncated at the cap, hidden-field count rendered, all fields shown after reveal, no control below the cap, metadata fields survive truncation; verify with `yarn vitest run src/lib/workspace/search/results-table/RowDetail.svelte.test.js`
- [x] 5.2 Add cases for the JSON View: truncated at the line cap, full JSON after reveal, and `onCopy` called with the complete `sourceJson` while truncated
- [x] 5.3 Add a case asserting collapsing and re-expanding a row returns it to the truncated default
- [x] 5.4 Run `yarn test` and `yarn lint` and verify both pass clean

## 6. Verification against the original symptom

- [x] 6.1 Manual check: run a search in Table view, expand a row, park the pointer over the expanded detail and flick the trackpad; verify the results list scrolls for the full gesture including momentum, and repeat with the pointer over a normal row to confirm both behave identically. Verified via automated CDP scroll input (real browser input pipeline, not synthetic JS events) over the expanded panel in a live run of the app against real data: `.table-scroll-wrapper` scrollTop moved 0 → 304 for a single gesture with no delta lost to an inner scroller.
- [x] 6.2 Visual check of the expanded panel in both light and dark themes, confirming the borders and backgrounds still read correctly now that the wrappers no longer clip. Verified in a live run of the app: both Table View and JSON View tabs render correctly with borders/backgrounds intact in both the default and `.inverted` variants.
- [ ] 6.3 Record a fresh DevTools performance trace while scrolling the Table view with rows expanded, and verify the per-gesture scroll-movement ratio stays near 0.83 for gestures starting over an expanded row (it is 0.02 today) with no gesture stalling mid-flick. Dropped: requires a real physical trackpad feeding OS-level gesture events, which cannot be produced by browser automation. User decision: skip this check.
