## 1. Cluster behaviour to confirm first

- [x] 1.1 Against throwaway 8.0.0, 8.19.9, and 9.3.4 clusters, confirm what design.md relies on and record the answers in design.md: `GET /_security/user/a,b` and `/_security/role/a,b` with one missing name and with none; `GET /_security/api_key` with `name` wildcards, `username`, and both together; `POST /_security/_query/api_key` with a case-insensitive wildcard on `name`, a `term` on `username`, a filter on `invalidated`, `from`/`size`, and a sort on `creation` then `name`. Verify each answer is written down, and revise the design wherever one differs.

## 2. Lookup tools

- [x] 2.1 Add `get-security-user` and `get-security-role` to the catalog as automatic reads, building one comma-joined request from 1 to 20 segment-encoded names. Verify with catalog unit tests that the request lines are exact and that a name containing `/` or `,` cannot change the path.
- [x] 2.2 Implement both tools' results as `{ found, missing }`, with the credential filter on every record, full role definitions including each index entry's `query` string and `field_security`, and a 404 turned into an empty `found`. Verify with tool unit tests covering a mix of existing and missing names, all missing, and a role carrying a document query and field restrictions.
- [x] 2.3 Add `get-security-api-key` taking any of `id`, `name`, and `username` (at least one) and `include_invalidated`, sent as a key query with an `ids` filter, a case-insensitive `name` wildcard, a `username` term, and an `invalidated` filter unless asked. Verify with unit tests that each input combination builds the expected request body, that no identifier is refused, that invalidated keys are left out by default, and that no secret field survives.

## 3. Searchable, paged listings

- [x] 3.1 Add the three security listings to `PAGED_TOOLS` and give each a `page`. Verify with catalog tests that page 1 runs without approval, page 2 requires it, and the approval card names the entries.
- [x] 3.2 Page `list-security-users` over the whole list, sorted by username, with `search` matching username, full name, email, or a role name. Verify with unit tests that a search by email finds the account, reserved users are included, and the total counts only matches.
- [x] 3.3 Page `list-security-roles` through `_query/role` for search-only calls, reusing `buildRoleQuery`, falling back to the whole list on `no handler found`, and using the whole list whenever `index` or `privilege` is given. Verify with unit tests covering both paths, the fallback, and that both paths return the same names for the same search.
- [x] 3.4 Implement the `index` filter (exact, wildcard, and anchored regular-expression patterns, skipping patterns JavaScript cannot parse) and the `privilege` filter (exact names, `all` counting for everything, same-entry when combined with `index`). Verify with unit tests for `logs-*` matching `logs-2026.09`, a builtin-style regex role, an unparsable regex, and a role that reads logs-* but writes elsewhere not matching "write on logs-2026.09".
- [x] 3.5 Page `list-security-api-keys` through `_query/api_key`, sorted newest first, with `search` on name or owner and invalidated keys excluded unless asked for. Verify with unit tests of the request body and of the row shape.
- [x] 3.6 Update the three listing descriptions to say rows are summaries and point to the lookup tools for full records. Verify the tool description tests still pass and cover the new wording.

## 4. Assistant guidance

- [x] 4.1 Add instructions on chaining the lookups and on narrowing listings before paging. Verify with the instructions unit test that the new lines are present.

## 5. Verification

- [x] 5.1 Run `yarn test`, `yarn lint`, and `yarn build` clean.
- [x] 5.2 Exercise the tools against a throwaway 9.x cluster seeded with a few thousand roles, users, and API keys, through the route integration test or a scripted conversation: fetch a user then their roles in one call, fetch a role far past the first page, find a key by name, list roles granting write on a concrete index, and walk to a second page with approval. Repeat the role search on 8.0.0 to confirm the fallback. Verify each case returns what the spec scenarios describe.
