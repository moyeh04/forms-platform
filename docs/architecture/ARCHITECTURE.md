# Architecture

This is the map of the whole platform: what runs where, how a request travels,
and why each piece exists. Other documents go deeper on one topic each; the
index is at the bottom.

## The idea in one paragraph

A student opens a web page. The page is a plain static file hosted for free on
GitHub Pages. When the student presses Send, the page posts a small piece of
JSON to a Google Apps Script web app. That script checks the answers with the
same rules the page used, writes a row into a Google Sheet, and answers with a
reference number and an edit key. There is no server to rent, no database to
run, no login for students, and no build step for the website. Everything an
admin changes (forms, questions, team sizes, time slots) is data stored in a
sheet, not code.

## Design principles

| Principle | What it means here |
|---|---|
| **No server, no bill** | GitHub Pages serves files; Apps Script runs the logic; Sheets and Drive store the data. All free for classroom scale. |
| **Visitors never log in** | The script runs as the owner. Students get an edit key; instructors get a private link; the admin gets a PIN. Each is its own small, hashed secret. |
| **One source of truth for rules** | `shared/rules.js` is used by the browser, the backend, and the tests. They cannot disagree. |
| **Forms are data** | A form is a JSON definition in one cell. New questions and new form types need no code. |
| **Boring technology** | Plain JavaScript, no framework, no bundler for the website, one concatenation script for the backend. Easy to read, easy to fix later. |
| **Testable without Google** | An in-memory copy of Google's services runs the real backend code, so 145 tests cover it without touching a real account. |

## System context

Who talks to what. Three static pages share one backend.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart LR
    student(["Student<br/>phone or laptop"])
    admin(["Admin<br/>you"])
    teacher(["Instructor or client"])

    subgraph gh["GitHub Pages - static files, free HTTPS"]
        idx["index.html<br/>the student form"]
        adm["admin.html<br/>the dashboard"]
        vwr["viewer.html<br/>read-only page"]
        rules["shared/rules.js"]
    end

    subgraph google["Google - runs as the owner"]
        gas["Apps Script web app<br/>doPost routes every request"]
        reg[("Forms Registry sheet<br/>forms, lists, clients")]
        fs[("One sheet per form<br/>responses and tinted views")]
        drive[("Drive<br/>Forms Platform folder, PDFs")]
        mail["MailApp<br/>confirmation emails"]
    end

    pyscript["scripts/download_tasks.py<br/>runs on the admin laptop"]
    sheetui["Google Sheets UI<br/>menu and print"]

    student --> idx
    admin --> adm
    teacher --> vwr
    idx -- "POST JSON" --> gas
    adm -- "POST JSON + PIN" --> gas
    vwr -- "POST JSON + token" --> gas
    gas --> reg
    gas --> fs
    gas --> drive
    gas --> mail
    pyscript -- "POST JSON + PIN" --> gas
    pyscript -. "downloads shared files" .-> drive
    admin --> sheetui
    sheetui --- reg
    rules -. "same file loaded by" .-> idx
    rules -. "same file bundled into" .-> gas
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class reg,fs,drive cDb
    class student,admin,teacher cActor
```

## What runs where

| Place | What runs there | Who pays | What it must never do |
|---|---|---|---|
| Visitor's browser | The page, live input filtering, draft saving, ticket image/PDF | Nobody | Be trusted. Every rule is checked again on the server. |
| GitHub Pages | Serves static files over HTTPS | Free | Run code or keep secrets. |
| Apps Script | All logic: validation, limits, keys, locking, emails, views | Free quotas | Hold state in memory. Every request starts fresh. |
| Google Sheets | The only database | Free | Be edited by hand in the Responses tab (the platform owns it). |
| Drive | Print PDFs, form sheets, student-shared files | Free | Be written by students. They only share links. |
| Admin laptop | Builds `dist/`, runs the Excel export | Nobody | Be required for students to use the forms. |

## Request lifecycle

Every action, from every page, takes the same path. This is the whole backend
entry point.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
sequenceDiagram
    autonumber
    participant B as Browser page
    participant G as Apps Script doPost
    participant T as API table
    participant H as Handler

    B->>G: POST text/plain with JSON body (action, slug, data...)
    G->>G: JSON.parse the body
    alt body is not JSON
        G-->>B: ok false, bad_json
    end
    G->>T: look up API[action]
    alt unknown action
        G-->>B: ok false, unknown_action
    end
    T->>H: run handler(req)
    Note over H: Admin handlers are wrapped by admin(fn).<br/>The wrapper checks the PIN first.
    alt handler calls fail(code, message)
        H-->>G: throws ApiError
        G-->>B: ok false, error code and message
    else unexpected error
        G->>G: Logger.log the stack trace
        G-->>B: ok false, server_error
    else success
        H-->>G: result object
        G-->>B: ok true plus result fields
    end
```

The response envelope is always `{ ok: true, ...fields }` or
`{ ok: false, error: { code, message, details } }`. The browser turns the
`code` into a friendly sentence in English or Arabic (`assets/js/i18n.js`).

## A student submits a registration

The most important flow. Validation happens twice on purpose: in the browser
for instant feedback, and on the server because the browser cannot be trusted.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
sequenceDiagram
    autonumber
    actor S as Student
    participant P as index.html
    participant G as Apps Script
    participant R as Rules (shared)
    participant D as Drive
    participant SH as Form sheet
    participant M as MailApp

    S->>P: opens index.html?f=slug
    P->>G: getForm(slug)
    G-->>P: public form definition, state, taken slots
    S->>P: fills steps, picks team size, reviews
    P->>R: validateSubmission (live)
    S->>P: presses Send
    P->>G: submit(slug, data)
    G->>G: assertAcceptingSubmissions (state, dates)
    G->>R: validateSubmission (again, on the server)
    G->>D: check Drive link opens and is shared with anyone
    G->>G: take the script lock (waits up to 20 s)
    G->>SH: read all live rows
    G->>G: checkLimits (duplicate code, slot taken, form full)
    G->>G: issue unique 5-digit key, store only its hash
    G->>SH: append the row
    G->>G: release the lock
    G->>G: refresh views (inline or mark dirty)
    G->>M: confirmation email (failure is only logged)
    G-->>P: ref, key, expiry
    P-->>S: ticket with key, save image, save PDF
```

Two details worth knowing:

- The Drive check happens **before** the lock, because it is slow and does not
  touch the sheet. The lock is held only for the read-check-write sequence, so
  students are not queued behind network calls.
- The key is returned **once**. Only a salted hash is stored. Nobody, including
  the admin, can read a key back; the admin can only issue a new one.

## Editing or cancelling with a key

The key alone identifies the registration. That is a deliberate trade for
"no accounts", and the reason the key is salted per form, throttled, and
expiring. See [SECURITY.md](../reference/SECURITY.md).

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
sequenceDiagram
    autonumber
    actor S as Student
    participant P as index.html
    participant G as Apps Script
    participant C as CacheService
    participant SH as Form sheet

    S->>P: types the 5-digit key
    P->>G: lookup(slug, key)
    G->>C: read badkey counter for this form
    alt 10 or more wrong keys in the last minute
        G-->>P: too_many_attempts
    end
    G->>G: hash = sha256(pepper + form id + key)
    G->>SH: find the row with this hash
    alt no row found
        G->>C: add one to the counter (60 s)
        G-->>P: bad_key
    else key expired
        G-->>P: key_expired
    else found
        G-->>P: the registration, canEdit, canDelete
    end
    S->>P: changes answers and saves
    P->>G: update(slug, key, data)
    G->>G: validate again, re-check limits ignoring this row
    G->>SH: write the row under the lock
    S->>P: or presses Cancel registration
    P->>G: remove(slug, key)
    G->>SH: set deleted flag and clear the key hash
    Note over G,SH: The row stays for the audit trail,<br/>but its code and slot are free again.
```

## Life of a form

A form has a stored status and optional dates. The state students actually see
is computed by `Rules.formState`, so the same function decides in the browser,
the backend, and the tests.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
stateDiagram-v2
    [*] --> draft: Create form
    draft --> open: Admin sets Open
    open --> closed: Admin sets Closed
    closed --> open: Admin sets Open
    open --> archived: Admin archives
    closed --> archived: Admin archives
    archived --> [*]
```

On top of the stored status, the optional dates are applied while it is
`open`:

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart LR
    s{"Stored status"} -- "draft, archived, closed" --> same["Computed state is the same"]
    s -- "open" --> d1{"opensAt in the future?"}
    d1 -- "yes" --> nyet["not_yet"]
    d1 -- "no" --> d2{"closesAt in the past?"}
    d2 -- "yes" --> cl["closed"]
    d2 -- "no" --> op["open"]
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class s,d1,d2 cDec
    class op cOk
```

| Computed state | Students see |
|---|---|
| `draft` | "This form is not available yet." (its questions are not sent to the browser) |
| `not_yet` | "This form has not opened yet." |
| `open` | The form |
| `closed` | "This form is closed." (a message you can customise per form) |
| `archived` | Treated like closed for students; hidden from instructors |

## Team size: how "members are not optional" works

The admin sets a range. The student chooses a number. That number decides
exactly how many member forms exist, in the browser and on the server.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart TD
    A["Admin settings page<br/>minimum and maximum team size"] -->|"admin.forms.update"| B{"normalizeRules_<br/>min >= 1, max >= min, max <= 20"}
    B -- "invalid" --> X["bad_team_size error"]
    B -- "valid" --> C[("Form config JSON<br/>rules.teamSize")]
    C -->|"getForm exposes the range"| D["Student page<br/>team size chips: min to max"]
    D -->|"student picks N"| E["syncMembers keeps exactly N-1 member cards<br/>typed data is preserved"]
    E -->|"submit"| F{"Rules.validateSubmission"}
    F --> G["validate team_size is a whole number in range"]
    G --> H["memberCount = size - 1"]
    H --> I{"members.length equals memberCount?"}
    I -- "no" --> Y["members_count error"]
    I -- "yes" --> J["validate every member's name, phone, code..."]
    J --> K[("Saved")]
    A -. "range changed later" .-> L["teamSizeConflicts: how many saved teams<br/>now fall outside the new range"]
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class C,K cDb
    class B,F,I cDec
    class X,Y cErr
```

If a form hides the team size question, the member limits fall back to the
range (`min - 1` to `max - 1`), so older form definitions keep working.

## Reviews and WhatsApp matching

WhatsApp does not let a website read pending join requests. So the reviewer
pastes them and the platform matches by normalised phone number.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart LR
    paste["Reviewer pastes<br/>WhatsApp requests"] --> extract["Rules.extractPhones<br/>finds every phone in each line"]
    extract --> norm["normalizePhone<br/>+20 10 1234 5678 becomes 01012345678"]
    norm --> store[("Requests tab<br/>one row per phone, duplicates skipped")]
    store --> match["matching.list joins requests to registrations by phone"]
    reg[("Registrations")] --> match
    match --> st{"How many registrations<br/>share the phone?"}
    st -- "0" --> none["No match"]
    st -- "1" --> one["Matched"]
    st -- "2 or more" --> dup["Duplicate"]
    one --> screen["Split screen<br/>details and Drive preview"]
    screen --> dec["approve / reject / pending"]
    dec --> step["setReviewStep_ on the matched registration"]
    step --> rule{"Sequential steps?"}
    rule -- "approving step 2 before step 1" --> err["review_order: Finish step 1 first"]
    rule -- "ok" --> derive["status derived:<br/>any rejected = rejected<br/>all approved = approved<br/>some approved = in_review"]
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class store,reg cDb
    class st,rule cDec
    class dec,derive cErr
    class one cOk
```

## Backend modules

Sixteen small files that the bundler joins with `shared/rules.js`. They do not
import each other; they share one global scope (this is how Apps Script
works), and each file only declares functions or registers handlers.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart TD
    subgraph entry["Entry"]
        Code["Code.gs<br/>doGet, doPost, routing"]
        Menu["Menu.gs<br/>onOpen sheet menu"]
    end
    subgraph core["Core"]
        Config["Config.gs<br/>helpers, hashes, sheet tables, API table"]
        Auth["Auth.gs<br/>PIN, lockout, admin wrapper"]
        Registry["Registry.gs<br/>setup, forms, lists, triggers"]
        Templates["Templates.gs<br/>four form types as data"]
    end
    subgraph public["Student facing"]
        FormsApi["FormsApi.gs<br/>getForm, admin forms CRUD"]
        Submissions["Submissions.gs<br/>submit, lookup, update, remove"]
        Responses["Responses.gs<br/>rows, keys, limits, Drive checks, emails"]
        Slots["Slots.gs<br/>timetable and availability"]
    end
    subgraph admin["Admin and reviewers"]
        Views["Views.gs<br/>tinted sheet blocks"]
        Print["Print.gs<br/>print tabs and PDF"]
        Matching["Matching.gs<br/>WhatsApp matching"]
        Clients["Clients.gs<br/>private links"]
        Viewer["Viewer.gs<br/>read-only data"]
        Export["Export.gs<br/>team data for Excel"]
    end
    Rules["shared/rules.js<br/>pure validation"]

    Code --> Config
    Auth --> Config
    Registry --> Config
    FormsApi --> Registry
    Submissions --> Responses
    Submissions --> Rules
    Responses --> Rules
    Responses --> Config
    Slots --> Rules
    Views --> Responses
    Print --> Views
    Matching --> Responses
    Viewer --> Clients
    Viewer --> Responses
    Export --> Responses
    Templates --> Registry
    Menu --> Print
    Registry --> Views
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
```

## Frontend modules

No framework. Each file is a small self-contained script that adds itself to a
single `App` object. Loading order is set by the script tags in each HTML file.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart LR
    subgraph shared["Shared"]
        cfg["config.js<br/>API address - the only edit"]
        rl["shared/rules.js"]
        th["theme.js<br/>light, dark, device"]
        api["api.js<br/>POST text/plain JSON"]
        ui["ui.js<br/>h(), icons, dialogs, toast"]
    end
    subgraph student["index.html"]
        i18n["i18n.js<br/>English and Arabic"]
        tk["ticket.js<br/>key, image, PDF"]
        fm["form.js<br/>steps, members, slots, review"]
    end
    subgraph adminp["admin.html"]
        a1["admin.js<br/>shell, login, forms list"]
        a2["admin-settings.js"]
        a3["admin-data.js<br/>blocks, matching, print"]
        a4["admin-people.js<br/>clients, lists"]
    end
    subgraph viewerp["viewer.html"]
        v1["viewer.js"]
    end
    cfg --> api
    api --> fm
    api --> a1
    api --> v1
    rl --> fm
    rl --> a2
    rl --> a3
    ui --> fm
    ui --> a1
    ui --> v1
    th --> fm
    i18n --> fm
    tk --> fm
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
```

## How sheet views stay fast

Colouring a sheet is slow in Apps Script. The platform formats immediately for
small forms and defers for big ones, so a student never waits for formatting.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart TD
    A["Any change: submit, edit, cancel, status, review"] --> B["afterChange_(form)"]
    B --> C["refreshViews(form)"]
    C --> D{"Rows in Responses<br/>60 or fewer?"}
    D -- "yes" --> E["rebuildViews now<br/>under the script lock"]
    D -- "no" --> F["set script property dirty:formId"]
    F --> G["Time trigger every 5 minutes<br/>processDirtyViews"]
    G --> H["for each dirty flag: delete flag, rebuild views"]
    E --> I[("Team Members List / Bookings / Registrations tabs<br/>tinted blocks, heavy borders, merged project cell")]
    H --> I
    J["Admin presses Rebuild sheet"] --> E
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class I cDb
    class D cDec
```

The trigger is installed by **First-time setup**. If it is ever missing, run
the setup again; it only creates it when absent.

## Excel export

Apps Script is a poor place to download dozens of files and zip them, so that
part runs on the admin's own computer.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    'fontSize': '15px',
    'primaryColor': '#DCE9E2', 'primaryBorderColor': '#3F6B66', 'primaryTextColor': '#2F2418',
    'secondaryColor': '#F0E4C8', 'secondaryBorderColor': '#C9A24A', 'secondaryTextColor': '#2F2418',
    'tertiaryColor': '#F6EFDC', 'tertiaryBorderColor': '#CDBB94', 'tertiaryTextColor': '#2F2418',
    'lineColor': '#3F6B66', 'textColor': '#2F2418', 'mainBkg': '#DCE9E2', 'nodeBorder': '#3F6B66',
    'clusterBkg': '#F6EFDC', 'clusterBorder': '#CDBB94', 'titleColor': '#2F2418',
    'edgeLabelBackground': '#F8F1DD',
    'actorBkg': '#DCE9E2', 'actorBorder': '#3F6B66', 'actorTextColor': '#2F2418', 'actorLineColor': '#8FB3AB',
    'signalColor': '#477A73', 'signalTextColor': '#477A73',
    'labelBoxBkgColor': '#F0E4C8', 'labelBoxBorderColor': '#C9A24A', 'labelTextColor': '#2F2418', 'loopTextColor': '#6A5A44',
    'noteBkgColor': '#FBEFC9', 'noteBorderColor': '#C9A24A', 'noteTextColor': '#2F2418',
    'activationBkgColor': '#DCE9E2', 'activationBorderColor': '#3F6B66', 'sequenceNumberColor': '#F8F1DD',
    'transitionColor': '#3F6B66', 'stateLabelColor': '#2F2418', 'stateBkg': '#DCE9E2', 'altBackground': '#F6EFDC',
    'attributeBackgroundColorOdd': '#F8F1DD', 'attributeBackgroundColorEven': '#F0E4C8'
  },
  'flowchart': {'curve': 'basis', 'padding': 14, 'nodeSpacing': 40, 'rankSpacing': 46},
  'sequence': {'mirrorActors': false, 'messageMargin': 34, 'boxMargin': 8}
}}%%
flowchart LR
    A["python scripts/download_tasks.py --slug name"] --> B["read API address from assets/js/config.js"]
    B --> C["POST admin.export.tasks with the PIN"]
    C --> D["teams, members, leader, link<br/>no phone numbers, no key data"]
    D --> E{"For each team link"}
    E -- "Slides" --> F["export as pptx"]
    E -- "Drive file" --> G["download, keep its own type"]
    E -- "private, deleted, folder" --> H["record the reason"]
    F --> I["files/001_Name.pptx"]
    G --> I
    D --> J["openpyxl builds Tasks.xlsx<br/>tinted blocks, merged task cell,<br/>relative hyperlink to files/"]
    I --> J
    H --> K["Failed sheet in Tasks.xlsx"]
    J --> K
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class E cDec
```

## Scale and honest limits

The design is right for a class, a department, or a few hundred registrations
per form. It is not meant for tens of thousands.

| Limit | Why | What to do if you hit it |
|---|---|---|
| Every request re-reads the rows it needs | Sheets is the database; there is no index | Fine up to low thousands of rows per form. Beyond that, move the heavy reads to a cache or a real database. Not implemented. |
| One script lock for all writes | Guarantees no two students take one slot | Writes queue briefly. A 20 second wait fails with "busy, try again". |
| Apps Script daily quotas (mail, runtime, URL fetch) | Google applies quotas to free accounts and Workspace differently | Check Google's current quota page. Confirmation emails are the quota most likely to matter. |
| A 5-digit key has 100,000 values | Chosen so students can type it | Safe because it is salted per form, throttled to 10 wrong tries a minute, and expires. |
| Real Google behaviour is untested locally | Tests use a faithful copy, not Google | Run the first-run checklist in [DEPLOY.md](../DEPLOY.md) once. |

## Where to change what

| I want to... | Edit |
|---|---|
| Change a colour, font, or size | `assets/css/theme.css` (variables only) |
| Reword a message or translate | `assets/js/i18n.js` |
| Add a question to a form | Admin dashboard, or `backend/Templates.gs` for new forms by default |
| Add a new form type | A new function in `backend/Templates.gs`, a label in `assets/js/admin.js` |
| Change a validation rule | `shared/rules.js` (browser, server, and tests all follow) |
| Add a backend action | A file in `backend/` that sets `API['name'] = ...` (wrap with `admin()` if private) |
| Change sheet colours | `backend/Views.gs` |
| Change the Excel layout | `scripts/download_tasks.py` |

## Documents

| File | Read it for |
|---|---|
| [WORKAROUNDS.md](WORKAROUNDS.md) | The clever solutions to each hosting constraint, and why |
| [BUILD-PIPELINE.md](BUILD-PIPELINE.md) | What produces `dist/`, step by step |
| [HOSTING.md](HOSTING.md) | What GitHub does, what Google does, and how they fit |
| [DATA-MODEL.md](../reference/DATA-MODEL.md) | Every sheet, column, and stored property |
| [SECURITY.md](../reference/SECURITY.md) | The secrets, who holds them, and what a leak would mean |
| [TESTING.md](../reference/TESTING.md) | How 165 tests run without Google |
| [DEPLOY.md](../DEPLOY.md) | Click-by-click setup |
| [MODULES.md](../MODULES.md) | File-by-file reference |
