## 1. Shared groundwork

- [x] 1.1 Redact request bodies from the error log in `handleElasticRequest`, logging status, path, and the cluster's reason only. Verify with a unit test that a rejected request carrying `{"password":"..."}` produces a log record not containing the password.
- [x] 1.2 Add the security error-cause mapper translating a cluster error into one of the causes in design.md's table. Verify with unit tests covering each row, using the literal strings recorded there for the no-handler, method-not-allowed, licence, privilege, reserved, and credential cases.
- [x] 1.3 Add a `security` API client section in `src/lib/api/elasticsearch.js` exposing the calls the surfaces need. Verify by unit test that each method posts to its route with the connection and window id attached.

## 2. Server routes

- [x] 2.1 Add `GET`-style list routes for users, roles, and API keys under `src/routes/api/elastic/security/`. Verify each returns the cluster payload for a reachable cluster and a mapped cause for a refusal.
- [x] 2.2 Add user mutation routes: create or update, delete, enable, disable, change password. Verify each against a throwaway cluster with security enabled.
- [x] 2.3 Add role mutation routes: create or update, delete. Verify a role with cluster privileges and an index block round-trips unchanged.
- [x] 2.4 Add API key routes: create and invalidate. Verify creation returns the secret once and invalidation marks the key invalidated.
- [x] 2.5 Add the builtin privileges route and the authenticate route. Verify the privilege route returns the cluster's own lists and that authenticate returns the connected account's username and roles.

## 3. Store modules

- [x] 3.1 Add a store module holding the connected account's identity from authenticate, populated on `connected` and cleared on `disconnected`. Verify with a store unit test that the identity is present after connect and gone after disconnect.
- [x] 3.2 Add users, roles, and API key store modules holding the cluster's full list and a loading flag, keeping previously loaded entries in place while a refresh is outstanding, with filter and sort state and mutation actions, each recording its own load failure cause independently. Verify with store unit tests that a failure on one surface leaves the others unaffected.
- [x] 3.3 Register the new modules in `src/lib/store/index.js`. Verify the app boots and the modules respond to `@init`.

## 4. Workspace shell

- [x] 4.1 Add the Security entry to `src/lib/header/Header.svelte`, always visible while connected. Verify the existing header component test still passes and a new case covers the entry being present.
- [x] 4.2 Add `src/routes/security/**` with a layout, a tab bar for Users, Roles, and API keys, and a redirect from the bare route, following the Monitoring pattern. Verify each tab is reachable and marks itself active.
- [x] 4.3 Add a shared list-state component covering in-progress, empty, and failed, so a list never shows an empty-list message while a retrieval is outstanding. Verify with component tests that the in-progress state renders during a pending load, the empty message only after one completes with no entries, and that a load resolving within the delay threshold never renders the indicator.
- [x] 4.4 Add the unavailable-state component that renders a mapped cause. Verify it renders the security-disabled, no-privilege, and licence causes distinctly, and never the raw cluster error.

## 5. Users surface

- [x] 5.1 Build the users table on `VirtualTable` with name, roles, enabled state, and a reserved badge, plus search and sort derived in the renderer, wired to the shared list-state component. Verify against a throwaway cluster holding both reserved and native accounts that both kinds appear and that search matches entries outside the rendered window.
- [x] 5.2 Build the create and edit dialog covering roles, full name, email, and metadata. Verify a created account appears in the list and an edited account keeps its other fields.
- [x] 5.3 Add the change-password action. Verify the new password authenticates against a throwaway cluster.
- [x] 5.4 Add enable, disable, and delete, with delete confirming by name. Verify cancelling the confirmation changes nothing.
- [x] 5.5 Suppress the operations the cluster forbids on reserved accounts, leaving only password change. Verify a reserved account offers no delete and no role edit.

## 6. Roles surface

- [x] 6.1 Build the roles table on `VirtualTable` with search leading, plus reserved and document-query badges, wired to the shared list-state component. Verify against a cluster seeded with several hundred roles that scrolling stays smooth and that sorting and search span the whole list, not just rendered rows.
- [x] 6.2 Build the structured role editor for cluster privileges, index privilege entries, and run-as, sourcing privilege options from the builtin privileges route. Verify the options match what the connected cluster reports.
- [x] 6.3 Hold the full role definition as the editor's source of truth so structured edits apply onto it. Verify with a test that opening and saving a role carrying application privileges and a document query preserves both byte-for-byte.
- [x] 6.4 Add the direct editing mode backed by JsonEditor. Verify a definition containing fields outside the structured form is sent to the cluster as given.
- [x] 6.5 Add delete with confirmation by name, and make reserved roles view-only. Verify a reserved role offers neither edit nor delete.
- [x] 6.6 Verify against a basic-licence cluster that saving a role with a document query surfaces the licence cause and not a permission cause.

## 11. Index block restrictions

- [x] 11.1 Model a block's query in both forms it can take, a query object and a template, reading the string the cluster returns and writing back the form the block holds. Verify with unit tests that each round-trips, including a role opened and saved untouched.
- [x] 11.2 Edit a block's query inline in the block, presented as structured JSON, with a control to add or clear it. Verify editing one block among several leaves the others alone, and that clearing omits the field rather than sending it empty.
- [x] 11.3 Edit a templated query's own source rather than the escaped string, marking which form the block holds. Verify a template round-trips and is sent back as a template.
- [x] 11.4 Edit a block's field restrictions as granted and excepted fields. Verify they round-trip, and that the cluster's refusal of `except` without `grant` is reported.
- [x] 11.5 Report a query the cluster rejects against the block it came from, since the cluster names the entry only by position. Verify with the literal messages the cluster returns for malformed JSON and for an unknown query type.
- [x] 11.6 Render a template before saving and refuse a role whose template does not render, which the cluster would otherwise accept. Verify against a cluster that the same source is accepted by the role API and rejected by the render API.
- [x] 11.7 Offer a count of the documents a block's query matches across its patterns. Verify it reports the count for an account that may read the indices, and is absent without error for one holding only manage_security.
- [ ] 11.8 Exercise the block editor manually against a trial-licence cluster: a plain query, a template, field restrictions, and a role with several blocks restricted differently.

## 7. API keys surface

- [x] 7.1 Build the keys table on `VirtualTable` with name, owner, creation, expiry, and invalidated state, wired to the shared list-state component. Verify it renders against a cluster holding both live and invalidated keys.
- [x] 7.2 Fall back to the account's own keys when the unscoped list is refused, and say which scope is shown. Verify using an account holding only the own-keys privilege.
- [x] 7.3 Build key creation with name, optional expiry, and optional role restrictions, presenting the secret once with a copy action and a statement that it cannot be retrieved again. Verify the secret is absent from the list after returning to it.
- [x] 7.4 Add invalidation with confirmation by name, worded and iconed as a revoke rather than a delete. Verify the key shows as invalidated afterwards.
- [x] 7.5 Hide invalidated keys by default with a toggle to include them, saying how many are hidden and why Elasticsearch cannot remove them. Verify against a cluster holding both live and invalidated keys.

## 8. Self-lockout guard

- [x] 8.1 Refuse, before sending, any delete of the account the connection authenticates as. Verify with a unit test and against a throwaway cluster that no request is sent.
- [x] 8.2 Refuse, before sending, any edit removing the connected account's own security-managing roles. Verify the same change is allowed when the target is a different account.

## 9. Assistant tools

- [x] 9.1 Add read-only user, role, and API key tools to the assistant's read tool set. Verify the existing tool tests still pass and new cases cover each tool running without approval.
- [x] 9.2 Filter credential fields from those tool results. Verify a test asserts no key secret or password field reaches the result.
- [x] 9.3 Refuse security writes through the generic request action. Verify a proposed write to a `_security` path is refused rather than presented for approval.

## 10. Verification

- [x] 10.1 Run `yarn test`, `yarn lint` and `yarn build` clean. The build is the only one of the three that enforces SvelteKit's server/browser import boundary, so it has to run before the change is considered done.
- [x] 10.2 Exercise all three surfaces manually against a throwaway basic-licence cluster on 8.x and on 9.x, confirming identical behaviour and that the only difference is the builtin privilege list. Include an 8.0.0 cluster to confirm no path depends on the security query endpoints, which do not exist there.
- [ ] 10.3 Exercise a slow load manually against a cluster seeded with a few thousand roles, reached over a throttled or tunnelled connection. Confirm the list shows the in-progress state rather than an empty-list message, and that a refresh keeps the existing rows on screen.
- [x] 10.4 Exercise the unavailable states manually: a cluster with security disabled, and an account holding no security privileges. Confirm each reports its own cause and never a raw cluster error.
