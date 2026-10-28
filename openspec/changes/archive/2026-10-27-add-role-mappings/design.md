## Context

See proposal.md — Why. Requirements are in the two delta specs.

The Security workspace already has three surfaces built from the same parts:
a `createSecurityList` store module, routes going through
`handleSecurityRequest` so refusals carry a classified cause, a `SecurityList`
table with a name cell holding `cell-action` buttons, and dialogs following the
conventions pinned by `conventions.svelte.test.js`. The role editor established
two patterns this change reuses: the editor holds the cluster's full
definition and applies structured edits onto it (`roleModel.js`), and a part
the form cannot model is shown as unchangeable in place and edited through the
direct mode.

Things about the role mapping API that shape the design:

- `GET _security/role_mapping` returns every mapping, keyed by name. There is
  no query or paging endpoint, and clusters hold tens of mappings, not
  thousands. `PUT` replaces the whole mapping; `DELETE` removes it.
- A mapping carries `enabled`, `metadata`, `rules`, and exactly one of `roles`
  or `role_templates`. Rules are a recursive tree of `any`, `all`, `field`, and
  `except` nodes. A `field` node maps one of `username`, `dn`, `groups`,
  `realm.name`, or `metadata.<key>` to a value or an array of values; a value
  is a literal, a wildcard, or a `/regex/` in Lucene syntax. `dn` and `groups`
  are compared as distinguished names.
- `except` is only accepted inside an `all` group; the cluster rejects it under
  `any` or at the top level. A `field` node holds exactly one key, and field
  names are not validated. A mapping must carry `enabled` and `rules`, and
  either a non-empty `roles` or `role_templates`, never both. Underscore
  metadata keys are refused on write.
- `role_templates[].template` comes back as a JSON string even when it was
  written as an object, and a string is accepted back unchanged.
- `DELETE` of a name that does not exist answers 404 with `{"found":false}`.
  A name containing `/` cannot be routed at all.
- Mappings defined through operator file-based settings are returned by the
  API but refused on write. Mappings in `role_mapping.yml` are not returned at
  all.
- Elasticsearch offers no dry run: it cannot say which users a mapping
  matches.
- `_authenticate` reports `authentication_type`, `authentication_realm`,
  `lookup_realm`, and the account's `metadata`. Today `securityIdentity` keeps
  only the username, roles, and reserved flag.

## Goals / Non-Goals

**Goals:**

- Make the common LDAP case — this group in this realm gets these roles — a
  form, not JSON.
- Never lose part of a mapping the form does not model.
- Stop the operator removing their own access through a mapping, without
  blocking edits the app cannot judge.

**Non-Goals:**

- A recursive rule-tree builder. Nested rules are rare in directory-group
  mappings and the direct mode handles them.
- Evaluating Lucene regular expressions exactly. The guard treats them as
  undecidable.
- Listing the cluster's realms for the realm field. That needs `monitor` and
  node settings; the field is free text pre-filled from the connected account.

## Decisions

### The list is fetched whole, like users

One route returns `GET _security/role_mapping` as entries
(`toRoleMappingEntries`, beside `toUserEntries`). Search and sort run in the
renderer over the whole list. Each row carries a one-line rendering of its
rules (for example `realm.name = ldap1 AND groups = cn=ops,…`), and search
matches against it, so searching for part of a group DN finds the mapping.
Templates show as `template` in the roles column, with the template source in
the tooltip. The full rendered text stays in the row so search matches what a
`CappedList` cell does not display.

### The form models one group of conditions plus one exception

A mapping's rules are form-editable when they have this shape:

```
field                              -- a single condition
any: [ field, ... ]                -- one group, any must hold
all: [ field, ..., except? ]       -- one group, all must hold, optional exception
except: field                      -- only inside an all group (cluster rule)
```

Anything else — a group inside a group, an `except` holding a group, more than
one `except`, an empty group — is not form-editable. Switching a group with an
exception to `any` is refused in the form with the reason, since the cluster
would reject it. The form then shows the rules read-only,
the way a templated role query is shown, and points at the direct mode. Roles,
enabled state, and metadata stay editable in the form. A single top-level
`field` opens as a one-condition `all` group but is saved back as a bare
`field` unless the user adds a second condition, so opening and saving changes
nothing.

`mappingModel.js` mirrors `roleModel.js`: `toWritableMapping` strips what the
cluster refuses (underscore metadata keys and the flags the list adds),
`parseRules` turns the rules into the form state or returns `null` when it
cannot, and `applyRules` writes the form state back onto the full definition.
Rules are only rebuilt when the user touched them; otherwise the original
object is sent back as it came.

A condition holds a field selector (realm name, groups, username, DN, or
metadata with a key input) and a multi-value input, with no type selector:
wildcard and regex are inferred from the value, as Elasticsearch infers them.
A value like `true` or `42` under `metadata.*` is sent as a boolean or number
only if it was one when loaded; typed values are strings.

Alternative considered: a full recursive tree builder like Kibana's. It is the
largest piece of UI in the feature, and the shape it adds over this form
hardly ever appears in group mappings. It can come later without changing the
specs.

### Roles or templates, never both

When `roles` is present, the existing `AdvancedDropdown` role picker from
`UserDialog` edits it, searching the cluster through `querySecurityRoles`. When
`role_templates` is present, the form shows the templates read-only and points
at the direct mode. A new mapping starts with `roles`. Switching kinds happens
only in the direct mode, where the user owns the whole definition.

### Read-only mappings are detected from what the cluster returns

An entry is read-only when its metadata carries the cluster's read-only marker
(`_read_only`) or its name carries the operator suffix
(`-read-only-operator-mapping`). Both 8.19.9 and 9.3.4 emit both for a mapping
defined in `config/operator/settings.json`; either one is enough. A write to
the suffixed name is refused with a 400, and a `DELETE` of it answers
`found: false`, which the delete route reports as a failure rather than a
success. A read-only entry gets
the same treatment as a reserved role: a view action, a `read-only` badge, and
no edit, toggle, or delete actions. If the cluster refuses a write anyway, the
existing cause classification reports it.

The surface's toolbar carries a `ui grey text` note, with a `title`, saying
that mappings from the role mapping file are not shown. It is not a banner:
it is permanent context, not an error.

### Identity keeps the realm and the account's metadata

`securityIdentity` keeps `authenticationType`, the realm whose roles apply
(`lookup_realm` when present, else `authentication_realm`, as name and type),
and `metadata`. These come from the `_authenticate` call it already makes. No
new request.

Mappings decide the account's roles only when `authenticationType` is `realm`
and the applying realm's type is not `native`, `file`, or `reserved`. An API
key's roles are fixed when the key is created, and tokens and anonymous access
are not managed here, so for every other case the guard allows all changes.

### The guard evaluates rules with three answers

`evaluateRules(rules, subject)` returns `true`, `false`, or `unknown`. The
subject is built from the identity: `username`, `realm.name`, and, where the
account's metadata reports them, `dn` and `groups`, plus `metadata.*`.
`LdapRealm`, which serves both the `ldap` and `active_directory` realm types,
always puts `ldap_dn` and `ldap_groups` into the user's metadata (read from the
8.19.9 classes), and `_authenticate` returns that metadata, so LDAP and AD
accounts have both. Other realms leave them out, and their `dn` and `groups`
conditions evaluate as `unknown`.

```
field     -> unknown if the subject lacks the field
             unknown if any value is a /regex/ and none of the others match
             else true if any value matches (DN-normalised for dn/groups,
             glob for * and ?), false otherwise
all       -> false if any child is false, else unknown if any is, else true
any       -> true if any child is true, else unknown if any is, else false
except    -> negation; unknown stays unknown
```

Whether a mapping grants a managing role uses the existing
`roleManagesSecurity` over definitions fetched by name. A role with no
definition counts as managing for the mapping being removed and as not managing
for any mapping kept, the same caution `refuseUserRoleChange` applies. A
template mapping's roles are unknown.

`refuseMappingChange(before, after, others, identity, catalogue)` returns
`allow`, `confirm`, or `refuse`:

```
not mapped realm                                   -> allow
before grants no managing role (known)             -> allow
before's rules evaluate false for the account      -> allow
after is enabled, evaluates true, grants managing  -> allow
another enabled mapping evaluates true and
  is known to grant a managing role                -> allow
before evaluated true and its roles are known      -> refuse
otherwise                                          -> confirm
```

Deleting means `after` is `null`; disabling means `after.enabled` is `false`.

The guard runs in the store handler for put, delete, and enable/disable, with
a fresh read of all mappings and the role definitions involved, just as
`security/users/put` re-checks with fresh definitions. A `confirm` result from
the store is only honoured when the dispatch carries the user's
acknowledgement. The dialog and the row actions run the same check against the
loaded list to show the warning in advance: a `warning message` and a disabled
Save for `refuse`, and a warning plus an explicit acknowledgement for
`confirm`. Row toggles and deletes use `window.confirm` with the warning
included, as user deletion does now.

Alternative considered: warn whenever the connection's realm is external,
with no rule evaluation. It is simpler but warns on every mapping edit, which
trains the user to click through. Evaluating the rules is cheap, and for a
group mapping the answer is almost always definite.

### Assistant tool

`list-security-role-mappings` in `tools/read.js` reads the whole mapping list,
filters by `role` (exact name in `roles`; template mappings are kept and
flagged as not matchable) and by `search` (name and the rules serialised as
text), and pages through `RESULT_ROW_LIMIT` like the other listings. Rows carry
the rules in full: they are small and are what the question is about. The
generic request refusal already covers every non-GET under `_security`, so the
only changes are the refusal wording and the instructions text, which names
the new tool.

## Risks / Trade-offs

- [A non-LDAP realm does not report the account's groups] → `groups`
  conditions evaluate as `unknown`, and the guard asks for confirmation
  instead of refusing. It is never less cautious than today.
- [DN normalisation differs from Elasticsearch's] → only lower-casing and
  trimming spaces around `,` and `=` are applied, and a match after that counts
  as a match. Anything this misses makes a real match look like `false`, the
  unsafe direction, so a DN miss is only trusted when both DNs are plain (no
  `\`, `+`, `#`, or `"`); otherwise it is `unknown`.
- [Read-only marker differs between versions] → both the metadata marker and
  the name suffix are checked, and a refused write still gets a plain cause.
- [Regex values make the guard ask more often] → accepted. Group mappings
  rarely use regex, and a confirmation is an inconvenience, not a lockout.
- [A mapping changes on the cluster between load and save] → `PUT` is whole
  replacement, so the last writer wins, as with roles and users today. Not
  addressed in this change.

## Migration Plan

None. The feature is additive; there is no stored state to migrate.
