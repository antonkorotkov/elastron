## 1. Corrections

- [x] 1.1 Count `all` only for privileges of its own kind, reading the kinds from `GET /_security/privilege/_builtin` and counting `all` only for itself when that read fails. Verified by `roleFilters.test.js` and the tool-level test that an index `all` is not `manage_security` and a cluster `all` is not `write`.
- [x] 1.2 Translate Lucene regular expressions instead of reusing them as JavaScript: literal escapes, literal `^` and `$`, quoted strings, per-alternative `~(…)`, and whole-branch groups. Verified by `roleFilters.test.js`, including `/logs-\d+/` not matching `logs-1` and `/~(a)|(b)/` matching `b` and `c` but not `a`.
- [x] 1.3 Add `source: whole_list` to the role listing, fall back automatically only on page 1 with a hint, and refuse a later role-query page on a cluster without it. Verified by `security.test.js`: an approved page 2 sends only the request on its card, and `source: whole_list` builds `GET /_security/role`.
- [x] 1.4 Answer role and key pages past the 10 000-entry window with a note and no request, and mention the window on searches matching more. Verified by `security.test.js` for page 201 and page 200.
- [x] 1.5 Reuse whole-list reads for two minutes per cluster, account, and window, dropping failed reads. Verified by `security.test.js`: one read across three pages, separate reads per cluster, and a retry after a failure.

## 2. Verification

- [x] 2.1 `yarn test` (1381 passed), `yarn lint`, and `yarn build` clean.
