## Why

The assistant can list users, roles, and API keys, but each list fetches the
whole set and hands the AI provider only the first 50, with no way to search it
or to see page 2. On a cluster holding thousands of roles the assistant cannot
find a role it was told the name of, cannot see what a role actually restricts,
and cannot answer "which roles grant write on logs-*", a question the
`ai-assistant` spec already promises it can answer.

## What Changes

- Add read tools that fetch security records by what the assistant knows about
  them:
  - users by one or more usernames, returning the full record;
  - roles by one or more names, returning the full definition, including each
    index block's document query and field restrictions;
  - API keys by id, by name (wildcards allowed), or by owning username,
    optionally including invalidated keys.
  Names that do not exist are reported as missing rather than as a failure.
- Make the three security listings searchable and paged, the way the index
  listing is: one page of 50 at a time, with the total and page count, where
  the first page runs at once and each later page needs the user's approval.
  - Users are searched by username, full name, email, and role name.
  - Roles are searched by name and description, and can be filtered to those
    granting privileges on a given index or holding a given privilege.
  - API keys are searched by name and owner, and invalidated keys are left out
    unless asked for.
- Tell the assistant how to chain these: from a user to their roles, and from a
  role name to its definition.
- Credential material stays out of every result, as today. None of the new
  tools writes, and security remains unwritable by the assistant.

Not in scope: role mappings, and the effective privileges of an arbitrary user,
which Elasticsearch reports only for the account making the request.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-assistant`: the paged-listing requirement widens from the index listing to
  the security listings; new requirements cover fetching security records by
  identifier and searching the security listings.

## Impact

- `src/lib/ai/catalog.js`: new tool policies and request builders, and the
  security listings join the paged tools whose later pages need approval.
- `src/lib/server/ai/tools/read.js`: the three new tools, and search, filters,
  and paging on the three listings, keeping the credential filter.
- `src/lib/server/ai/instructions.js`: guidance on chaining the lookups.
- `src/lib/security/roleSearch.js` is reused for role search so the assistant
  and the Roles screen match roles the same way.
- No new routes, IPC, or UI. No change to the Security workspace.
