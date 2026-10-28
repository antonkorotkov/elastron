## 1. Cluster facts

- [x] 1.1 On the throwaway cluster on 9250, create an operator-defined mapping through file-based settings and record how `GET _security/role_mapping` marks it (metadata `_read_only`, name suffix, or both) on the bundled 8.x and 9.x versions. Verify by recording the observed payloads in design.md's Open Questions and removing that question.
- [x] 1.2 Check what `_authenticate` reports for an LDAP-realm account (`authentication_type`, `lookup_realm`, `metadata.ldap_dn`, `metadata.ldap_groups`), using a test LDAP realm if one can be configured and the Elasticsearch documentation otherwise. Verify by recording the result in design.md and adjusting the Risks entry on groups if they are not reported.

## 2. Routes and client

- [x] 2.1 Add `src/routes/api/elastic/security/role-mappings/+server.js` (`GET _security/role_mapping`), `role-mapping/put/+server.js`, and `role-mapping/delete/+server.js`, all through `handleSecurityRequest` with names URL-encoded. Verify with cases in `routes.integration.test.js` that each sends the expected method and path and that a refusal comes back with a classified cause.
- [x] 2.2 Add `getSecurityRoleMappings`, `putSecurityRoleMapping`, and `deleteSecurityRoleMapping` to `src/lib/api/elasticsearch.js`. Verify with cases in `src/lib/api/security.test.js` that each posts to its route with the connection and window id.

## 3. Mapping model

- [x] 3.1 Add `toRoleMappingEntries` to `securityList.js`, producing name, enabled, roles or templates, a read-only flag from either marker, and a one-line rules text. Verify with unit tests covering a roles mapping, a template mapping, both read-only markers, and a nested rule's rendering.
- [x] 3.2 Add `workspace/security/role-mappings/mappingModel.js` with `toWritableMapping`, `parseRules` (form state or `null`), and `applyRules`. Verify with unit tests that a bare `field`, an `all` group with an `except`, and an `any` group round-trip unchanged when untouched; that nested groups and a group `except` parse to `null`; that a bare `field` with a second condition added saves as an `all` group; and that underscore metadata keys are stripped.

## 4. Lockout guard

- [x] 4.1 Extend `securityIdentity.js` to keep `authenticationType`, the applying realm (lookup realm, else authentication realm) as name and type, and `metadata`, cleared on reset as today. Verify with cases in `security.test.js` for a native account, an LDAP account with a lookup realm, and an API-key connection.
- [x] 4.2 Add `evaluateRules` to `guards.js` with three-valued `all`/`any`/`except`, DN normalisation for `dn` and `groups`, glob matching, and `unknown` for missing subject fields, regex values, and misses on DNs that are not plain. Verify with unit tests over each combinator's truth table including `unknown`, a DN that differs only in spacing, a wildcard group DN, and a regex value.
- [x] 4.3 Add `refuseMappingChange(before, after, others, identity, catalogue)` returning `allow`, `confirm`, or `refuse`, with refusal and warning texts beside the existing ones. Verify with unit tests for every scenario under "Role mapping changes cannot lock the connected account out" in the delta spec, plus a template mapping and an undefined role.

## 5. Store module

- [x] 5.1 Add `store/elasticsearch/securityRoleMappings.js` on `createSecurityList` with `put`, `delete`, and `setEnabled` handlers that re-run `refuseMappingChange` against a fresh mapping list and fresh role definitions, refuse on `refuse`, and proceed on `confirm` only when the dispatch carries `acknowledged: true`. Register it in `src/lib/store/index.js`. Verify with a store test that a refused delete sends no request, an unacknowledged `confirm` sends none, an acknowledged one does, and a load failure here leaves the users list unaffected.

## 6. Surface

- [x] 6.1 Add the **Role mappings** tab to `SecurityTabs.svelte` between Roles and API keys, and `src/routes/security/role-mappings/+page.svelte`. Verify the tab is reachable and marks itself active.
- [x] 6.2 Build `RoleMappings.svelte` and `RoleMappingCell.svelte` on `SecurityList`: name, roles (`CappedList`), rules text, enabled; edit, enable/disable, and delete as `cell-action`s, hidden for read-only entries, with a view action and a `read-only` badge instead; toggle and delete through `window.confirm` naming the mapping and including any guard warning; the role mapping file note as `ui grey text` in the toolbar. Verify with `RoleMappings.svelte.test.js`: searching part of a group DN finds its mapping, read-only rows offer only view, cancelling the delete confirmation dispatches nothing, and a refused self-lockout hides delete.
- [x] 6.3 Build `RoleMappingDialog.svelte` (load by name, like `RoleDialog`) and `RoleMappingEditor.svelte`: name on create, enabled, `all`/`any` choice, condition rows with field selector, metadata key, and multi-value input, one optional exception, the role picker from `UserDialog`, read-only rules or templates with a pointer to the direct mode, and a `JsonEditor` direct mode over the full definition. Show the guard result as a warning message: Save disabled for `refuse`, an acknowledgement checkbox for `confirm`; no condition means Save is disabled with a reason. Verify with `RoleMappingEditor.svelte.test.js` that creating a group mapping dispatches the expected body, a nested mapping's rules are sent back unchanged after a role edit, a template mapping shows no role picker, and the direct mode's definition is sent as given (assert through the store, per the JsonEditor mock note).
- [x] 6.4 Run the existing `conventions.svelte.test.js` and `darkMode.test.js` over the new files, extending their file lists if they enumerate them. Verify both pass.

## 7. Assistant

- [x] 7.1 Add `list-security-role-mappings` to `src/lib/server/ai/tools/read.js` with `role` and `search` filters, template mappings kept and flagged when filtering by role, and paging by `RESULT_ROW_LIMIT`. Verify with cases in `tools/security.test.js` for the role filter, a group DN search, a template mapping, and that the tool is not classified as a security write.
- [x] 7.2 Update the refusal text in `tools/index.js` and the security line in `instructions.js` to name role mappings and the new tool. Verify with cases in `security.test.js` that a `PUT _security/role_mapping/x` through the generic request is refused with the new wording, and the existing instruction tests pass with the updated text.

## 8. Integration check

- [x] 8.1 Run `yarn test` and `yarn lint`. Verify both pass.
- [x] 8.2 Against the throwaway cluster on 9250, in the vite-only browser setup: create a group mapping, disable and re-enable it, edit its roles, open a nested mapping and save it after a role change, view a read-only mapping, and delete a mapping. Verify each change shows in `GET _security/role_mapping` as expected and the nested rules are byte-for-byte unchanged.

## Workflow follow-up

- Sync the delta specs and archive the change once implementation is reviewed.
