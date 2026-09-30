## Why

A review of the archived `add-assistant-security-lookups` change found faults in
the assistant's security listings after they shipped. The role privilege filter
let an `all` of one kind stand for privileges of the other. Lucene
regular-expression role patterns were read with JavaScript's meaning. An
approved later page could send a different request from the one on its card.
Pages past Elasticsearch's result window came back as a raw cluster error.
Walking the pages of a filtered role list downloaded every role again for each
page. The code is already fixed; this change records the corrected behaviour
and the reasons for it, and brings the main spec in line.

## What Changes

- The role privilege filter counts `all` only for privileges of its own kind,
  cluster or index, using the privilege names the cluster reports.
- Regular-expression role patterns are read with Lucene's meaning: an escaped
  character is literal, `^` and `$` are literal, quoted text is literal, and
  `~(…)` complements only its own alternative.
- A later role page runs exactly the request its approval card showed. On a
  cluster without role search, the first page still falls back to the whole
  list; later pages ask for it explicitly with a new `source: whole_list`
  input, and a later page that asks for role search there is reported rather
  than silently replaced.
- Role and API key pages past the cluster's 10 000-entry result window are
  answered with a note instead of a refused request, and a page whose search
  matches more than that says so.
- The whole role list, the user list, and the privilege names are reused for
  two minutes per cluster, account, and window, so walking pages reads them
  once.
- A review claim that the role query omits built-in roles was checked against
  8.19.9 and 9.3.4 and found not to hold; no change follows from it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the security-listing requirement gains the privilege-kind
  rule and says how a cluster without role search is paged; the paged-listing
  requirement gains that an approved page runs the request it showed, and how
  pages past the cluster's result window are answered.

## Impact

- `src/lib/server/ai/tools/roleFilters.js`, `src/lib/server/ai/tools/read.js`,
  `src/lib/server/ai/tools/index.js`, and `src/lib/ai/catalog.js`, with tests.
  Already implemented.
- No UI, route, or IPC change.
