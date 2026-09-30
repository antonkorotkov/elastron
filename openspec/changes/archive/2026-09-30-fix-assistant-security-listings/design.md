## Context

See proposal.md for motivation and `specs/ai-assistant/spec.md` for the
corrected requirements. The shipped design is in
`archive/2026-09-30-add-assistant-security-lookups/design.md`; this document
records only where it was wrong and what replaced it. The fixes are already in
the code.

## Goals / Non-Goals

**Goals:**

- Record each correction next to its reason, so the archived design is not the
  last word on these points.

**Non-Goals:**

- Privilege implication beyond `all`, which the original design already
  excluded for want of a published hierarchy.

## Decisions

### `all` implies only its own kind

The original filter treated `all` as granting every privilege, whichever list
it came from. Cluster and index privileges are separate namespaces, and some
names, such as `manage` and `monitor`, exist in both. So an index `all` on one
sandbox index was matched as `manage_security`, and a cluster `all` as index
`write`.

A cluster `all` now counts only for cluster privilege names, and an index `all`
only for index privilege names. Which names belong to which kind comes from
`GET /_security/privilege/_builtin`, as the role editor already reads them,
rather than from a list compiled into the app. If that read fails, `all` counts
only for the literal privilege `all`: missing a role is preferred to listing one
that does not grant the privilege.

The privilege-name read is not shown on the approval card of a filtered page.
It fetches privilege names, not cluster data, and nothing from it is sent to
the AI provider.

### Lucene regular expressions are translated, not reused

The original matcher placed the pattern body straight into a JavaScript
regular expression. The two dialects disagree on details that matter here:

| Lucene | Meaning in Lucene | Read by JavaScript as |
| --- | --- | --- |
| `\d`, `\w`, `\.` | The escaped character itself | A character class, or an escape |
| `^`, `$` | Literal characters | Anchors |
| `"a.b"` | The literal string `a.b` | Quote characters and a wildcard dot |
| `~(a)\|(b)` | Not `a`, or `b` | Greedy match took `a)\|(b` as the complement |

A small translator now rewrites each alternative: an escaped letter or digit
becomes that character, other escaped characters stay escaped, quoted text is
escaped whole, `^` and `$` are escaped, and character classes are copied with
the same escape rule. Top-level alternatives are split while skipping escapes,
quotes, classes, and nested groups. A `~(…)` spanning a whole alternative is
evaluated as the negation of its contents, and a group spanning a whole
alternative is looked inside. Anything else Lucene-only (`~` elsewhere, `&`,
`<>` intervals, `@`, `#`) makes that alternative unreadable. The pattern matches
when any alternative matches; if none does and one was unreadable, the pattern
is skipped rather than guessed at.

### An approved page runs the request its card showed

The original design let the role listing fall back from the role query to the
whole list on any page, admitting the card would then show a request that did
not run. That broke the promise the catalog exists to keep: the approval card
renders the request built from the input, and that request is what runs.

The catalog cannot know whether a cluster has the role query, so the choice is
carried in the input. `source: whole_list` makes the listing build
`GET /_security/role`, and the card shows it. The fallback happens only on page
1, which has no card, and its result tells the model to pass `source:
whole_list` for later pages. A later page that still asks for the role query on
such a cluster is refused with that instruction instead of being answered with a
different request; the user then approves the whole-list read explicitly.

Alternative considered: choosing by cluster version on both the server and the
card. Rejected because the version where the role query appeared was not
confirmed against a cluster, and a guessed threshold would make the card wrong
on exactly the clusters in question.

### Pages past the result window are answered, not sent

A cluster search refuses `from` plus `size` above 10 000, so with 50 per page
the last reachable page is 200. For the role query and the key query, a page
past that returns a note without contacting the cluster. When a search matches
more than 10 000, its pages say only the first 10 000 can be paged that way and
suggest a narrower search, or, for roles, the whole list, which the app pages
itself without that limit.

### Whole lists are reused briefly

Walking the pages of a filtered role list, or of the user list, read the same
whole list for every page: about 26 s per page for 7 000 roles over a slow link.
Whole-list reads, including the privilege names, are now reused for two minutes
per cluster host, port, account, and window. The key never includes a
credential. A failed read is dropped at once so the next page retries. The tool
set is created per chat request, so the reuse lives at module level rather than
in the tool set.

### A review claim that did not hold

The review stated that `POST /_security/_query/role` omits built-in roles. On
8.19.9 and 9.3.4 it returned them: the Roles screen's descending sort opened on
the reserved `watcher_user`, the assistant's live run counted the 31 built-in
roles alongside 3 000 seeded ones, and a search for `WATCH` found
`watcher_admin`. The omission the documentation describes is the user query's,
which is why the user listing reads the whole list.

## Risks / Trade-offs

- **A listing can be up to two minutes stale after an edit in the Security
  screen.** → Accepted for page walks; a single lookup by name always reads
  fresh.
- **Without the privilege names, `all` matches only itself.** → A missed role
  rather than a wrong one, and the read needs only the privilege the listing
  itself already uses.
- **The model must follow the `source: whole_list` hint.** → When it does not,
  the refusal repeats the instruction, and nothing is sent that the user did not
  approve.
