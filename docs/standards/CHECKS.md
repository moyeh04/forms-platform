# Checks

Every rule a script can check is checked by `scripts/checks/run-checks.js`.
The rules are written in the other pages of `docs/standards/`; this page says
which check enforces each one, what it refuses, and how to fix a refusal.

```
npm run check                                  # every tracked file
node scripts/checks/run-checks.js --staged     # the staged files
npm run check -- --update-baseline             # write down what was fixed
```

The git hook `.githooks/pre-commit` runs the staged form before every commit.

## How a run decides

1. Each check looks at the files of the run and reports findings: a file, a
   line, a rule and a message.
2. `exceptions.json` removes the findings it covers. An entry names a path, a
   rule and a reason of at least four words. A weak reason fails, and so does
   an entry that matches nothing in a full run.
3. `baseline.json` gives the number of findings of each rule that an old file
   may still have. More than that fails. A new file has no allowance, so new
   code meets every rule from its first commit.
4. A count that went down must be written down in the same commit
   (`--update-baseline`), so the baseline only shrinks. `--update-baseline`
   never raises a count; a higher count can only come from editing the file
   by hand, which a reviewer sees.

All paths, limits and lists of the checks are in `scripts/checks/config.json`,
not in the code.

## The checks

| Check | Refuses | Fix |
|---|---|---|
| `check-docs.js` | an action of the backend with no row in [API.md](../backend/API.md), or a row with no action; a total or a row of [TESTING.md](../process/TESTING.md) that does not match the tests in `tests/` and its sub-folders; a Markdown link to a file that does not exist | correct the document in the same commit as the code |
