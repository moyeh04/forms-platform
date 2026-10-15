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
  share: `backend/platform/config/constants.js` for the backend, `domain/rules.js` for both
  sides.
- **Built from smaller names** when it is a product: `40 * 1024 * 1024`
  stays readable, so write it out instead of `41943040`.
- **A vocabulary is one enum.** The words the pages and the backend share
  (`FormType`, `FormStatus`, `ReviewStatus`, `ListKind`) are frozen enums in
  `domain/enums.js`. Code compares with the member, `FormStatus.DRAFT`, never
  with `'draft'`, and checks a value against `Object.values(FormStatus)`.
  `check-enums.js` refuses a word of a mapped enum written by hand. A
  vocabulary only the backend uses is a frozen object in
  `backend/platform/config/`, such as `Access`.
- **Yes/no is a boolean in code.** Only `backend/platform/sheets/cell.js`
  reads or writes the stored strings `'1'` and `'0'`: a row mapper calls
  `Cell.readFlag(cell, whenAbsent)` and `Cell.writeFlag(value, falseCell)`.
  `cell.js` is the one file under `flags.exclude` in
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
| `domain/enums.js` | `FormType`, `FormStatus`, `ReviewStatus`, `ListKind` |
| `backend/platform/config/constants.js` | The app name, the registry tab names, the script property names (`PROPS`) and the cache keys (`CACHE`) |
| `backend/platform/config/access.js` | `Access`, who may call an action |
| each `*.repository.js` | The column list of its tab (`FORM_COLS`, `RESPONSE_COLS`, `CLIENT_COLS_`, `TRANSFER_COLS`, `REQUEST_COLS_`) |
| `responses.repository.js` | `SUBMISSION_STATUSES`, the reference prefix of each form type |
| `lists.repository.js`, `forms.service.js`, `forms.public.js` | The kind and name of each built-in list, the form fields a patch may change, the ones the public may read |
| `auth.service.js` | `ADMIN_MAX_FAILS`, `ADMIN_LOCK_SECONDS` |
| `clients.access.js` | `CLIENT_KEY_TRIES_` |
| `downloads.jobs.js` | The size, time and file limits of a download job |
| `keys.controller.js`, `forms.questions.js`, `sheet-views.*.js`, `workbook.js`, `sheet-style.js` | The limits and sizes of their own feature |
| `domain/rules.js` | The Arabic letter and digit tables, `SIZE_ALERT_LEVELS`, week day and month names |
| `web/js/*.js` | Each page module's own labels, choices and browser storage keys (`fp_*`) at the top of its wrapper |
| `web/js/config.js` | The backend URL, written by the deploy workflow |

Known gaps, counted in the check baseline until they are fixed:

- Month names are declared in both `domain/rules.js` and
  `web/js/admin-timetable.js`.
- The ticket drawing in `web/js/ticket.js` places its shapes with unnamed
  numbers.
