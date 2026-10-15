# Constants

A number or a fixed string that means something gets a name. The name says
what the value is, and the one place that declares it is the only place to
change it.

## Rules

- **CONSTANT_CASE.** `const WAIT_MS = 5000;` A backend constant private to
  its file ends in `_`, as Apps Script private names do: `DL_BUDGET_MS_`.
- **The unit is in the name** when the value has one: `_MS`, `_SECONDS`,
  `_DAYS`, `_BYTES`, `_PX`.
- **Declared at the top of the file that owns it**, under the imports, never
  inside a function. A value two files need belongs to the lower layer they
  share: `backend/Config.js` for the backend, `domain/rules.js` for both
  sides.
- **Built from smaller names** when it is a product: `40 * 1024 * 1024`
  stays readable, so write it out instead of `41943040`.
- **A set of allowed values is one list**, declared once, and every check
  reads it: `FORM_STATUSES`, not `'draft'` compared by hand in five files.
- **Yes/no is a boolean in code.** Only a row codec, the code that turns a
  sheet row into an object and back, reads or writes the stored strings
  `'1'` and `'0'`. A codec file is listed under `flags.exclude` in
  `scripts/checks/config.json`.
- **No meaning-free names.** `FIVE = 5` names nothing; `MAX_TEAM_SIZE = 5`
  does.

Numbers need no name when the meaning is the number itself: 0, 1, 2, 10
(base ten), 24 and 60 (hours and minutes), and their negatives. Tests are
exempt: an expected value is data.

## How it is checked

| Where the number is | Check |
|---|---|
| an argument, an operand, an array element, a comparison | Biome `style/noMagicNumbers` |
| the initial value of a variable, a property or a default parameter, which Biome skips | `check-numbers.js`: it passes only under a CONSTANT_CASE variable, property, or constant object around it |

A number that must stay as written, such as a length fixed by a standard,
is silenced on its own line with the reason, and both checks honour it:

```js
// biome-ignore lint/style/noMagicNumbers: SHA-256 gives 32 bytes
```

## Where the constants live today

| Owner | Holds |
|---|---|
| `backend/Config.js` | Sheet tab names, the column lists of the Forms, Responses and Clients tabs, `FORM_TYPES`, `FORM_STATUSES` |
| `backend/Responses.js` | `SUBMISSION_STATUSES`, `REVIEW_STATUSES`, the reference prefix of each form type |
| `backend/Registry.js` | The list kinds, the built-in lists, the form fields a patch may change and the ones the public may read |
| `backend/Auth.js` | `ADMIN_MAX_FAILS`, `ADMIN_LOCK_SECONDS` |
| `backend/Clients.js` | `CLIENT_KEY_TRIES_` |
| `backend/Download.js` | The size, time and file limits of a download job |
| `backend/KeyExpiry.js`, `Questions.js`, `Views.js`, `Xlsx.js`, `SheetStyle.js` | The limits and sizes of their own feature |
| `domain/rules.js` | The Arabic letter and digit tables, `SIZE_ALERT_LEVELS`, week day and month names |
| `web/js/*.js` | Each page module's own labels, choices and browser storage keys (`fp_*`) at the top of its wrapper |
| `web/js/config.js` | The backend URL, written by the deploy workflow |

Known gaps, counted in the check baseline until they are fixed:

- Month names are declared in both `domain/rules.js` and
  `web/js/admin-timetable.js`.
- Yes/no values are stored in the sheet as the strings `'1'` and `'0'`
  (`deleted` as `'1'` or empty). The row readers and writers of
  `backend/Clients.js` and `backend/Responses.js` convert them inline, each
  in its own way, instead of through one codec; `check-flags.js` counts
  them.
- The ticket drawing in `web/js/ticket.js` places its shapes with unnamed
  numbers.
