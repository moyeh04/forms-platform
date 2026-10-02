# How the project is organised

## The repository at a glance

Each folder goes somewhere different. Only one of them needs a build step.

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
    repo["Repository"]
    repo --> web["Website<br/>index.html, admin.html, viewer.html<br/>assets/css, assets/js"]
    repo --> shared["shared/rules.js<br/>validation rules"]
    repo --> be["backend/<br/>16 .gs files + appsscript.json"]
    repo --> sc["scripts/<br/>bundle-backend.js, download_tasks.py"]
    repo --> ts["tests/<br/>JavaScript and Python"]
    repo --> dc["docs/"]

    web -- "git push" --> gh["GitHub Pages<br/>serves the files as they are"]
    shared -- "script tag" --> gh
    shared -- "bundled in" --> dist["dist/Code.gs<br/>git-ignored, rebuilt on demand"]
    be -- "bundled in" --> dist
    sc -- "npm run build" --> dist
    dist -- "you paste it" --> gas["Apps Script<br/>the backend"]
    sc -- "python script" --> xl["Tasks.xlsx on your laptop"]
    ts -. "run the real bundle in memory" .-> dist
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
```

## Which scripts each page loads

The pages share a few small files. Each file adds itself to one `App` object.

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
    subgraph common["Loaded by all three pages"]
        cfg["config.js"]
        th["theme.js"]
        api["api.js"]
        ui["ui.js"]
    end
    subgraph index["index.html: the student form"]
        r1["shared/rules.js"]
        i18n["i18n.js"]
        tk["ticket.js"]
        fm["form.js"]
    end
    subgraph admin["admin.html: the dashboard"]
        r2["shared/rules.js"]
        a1["admin.js"]
        a2["admin-settings.js"]
        a3["admin-data.js"]
        a4["admin-people.js"]
    end
    subgraph viewer["viewer.html: instructor page"]
        v1["viewer.js"]
    end
    common --> index
    common --> admin
    common --> viewer
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
```

The instructor page does not load `rules.js`: it only reads data, so it needs
no validation.

## Website (static files, no build step)

| File | What it is |
|---|---|
| `index.html` | The page students use. Shows any form from its saved definition (`?f=name`). |
| `admin.html` | The admin dashboard (PIN). |
| `viewer.html` | The read-only instructor and client page (`?t=private-token`). |
| `assets/css/theme.css` | Colors, fonts, and the type scale as variables. Change the look here; the contrast standard is in its header and enforced by `tests/contrast.test.js`. |
| `assets/css/app.css` | Components of the student page. |
| `assets/css/admin.css` | Dashboard and instructor layout, including the team cards (a coloured band per team, header strip, leader tag). |
| `assets/img/` | The tab icon (`favicon.svg`), PNG sizes for phones and older browsers, and `site.webmanifest`. |
| `assets/js/config.js` | Source placeholder; `scripts/build-site.js` generates its published copy from the Actions `API_URL` variable. |
| `assets/js/api.js` | Sends requests to the backend as plain-text JSON (avoids browser CORS checks). |
| `assets/js/form.js`, `ticket.js`, `i18n.js` | The student page, the success ticket, English and Arabic text. |
| `assets/js/admin*.js` | Dashboard: core and forms list, settings, responses and matching, clients and lists. |
| `assets/js/viewer.js` | The instructor page. |
| `shared/rules.js` | Validation and normalization rules (Arabic names, phones, codes, Drive links, team size, slots). Used by the browser, the backend, and the tests, so all three always agree. |

## Backend (`backend/`, becomes one `Code.gs`)

| File | What it does |
|---|---|
| `Code.gs` | Entry point. Routes each request to its handler. |
| `Config.gs` | Constants and small helpers. |
| `Auth.gs` | Admin PIN (salted hash, lockout). |
| `Registry.gs` | The registry sheet: forms, lists, clients; setup. |
| `Templates.gs` | The four form types and the default lists, all as data. |
| `FormsApi.gs` | Create, update, and duplicate forms; the public form definition. |
| `Responses.gs` | Reading and writing rows, edit keys, limits, Drive checks, emails. |
| `Submissions.gs` | Student submit, lookup, update, cancel; admin edits and key reset. |
| `Slots.gs` | Reservation timetable checks and availability. |
| `Views.gs` | Tinted block views inside each form's Google Sheet. |
| `Print.gs` | Print tabs and PDF export. |
| `Menu.gs` | The "Forms Platform" menu in the registry sheet. |
| `Matching.gs` | WhatsApp request matching. |
| `Clients.gs`, `Viewer.gs` | Private instructor links and what they can see. |
| `Export.gs` | Team data for the Excel export script. |

`npm run build` joins `shared/rules.js` and every backend file into `dist/Code.gs`.

## Tools and tests

| Path | What it is |
|---|---|
| `scripts/bundle-backend.js` | The bundler. |
| `scripts/dev-server.js` | `npm run dev`: serves the site and answers its API calls from the in-memory Google, with sample forms, so pages can be opened in a real browser. |
| `scripts/download_tasks.py` | Downloads task files and builds `Tasks.xlsx`. |
| `tests/harness/appsscript-mock.js` | An in-memory Sheets, Drive, Mail, Cache, and clock, so the real backend code runs in tests. |
| `tests/harness/dom.js` | Opens the real pages in jsdom wired to that backend. |
| `tests/*.test.js` | 172 tests. |
| `tests/test_download_tasks.py` | 20 tests for the export, with a local server in place of Google. |

## Data model in one paragraph

The **Forms Registry** sheet has one row per form (its whole definition as JSON),
the shared lists, and the instructor links (only a hash of each link's secret is
stored). Each form owns a **separate spreadsheet** with a Responses tab (the raw
data), and the tinted views built from it. A form definition is plain data:
questions, steps, rules (including the team size range), slots, review steps. The
engine never hard-codes a question, which is why new forms need no code.

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
    reg[("Forms Registry sheet")] --> forms["Forms tab<br/>one row per form,<br/>definition as JSON"]
    reg --> lists["Lists tab"]
    reg --> clients["Clients tab<br/>hashed private links"]
    forms -- "sheetId" --> fs[("One sheet per form")]
    fs --> resp["Responses<br/>raw data, plain text"]
    fs --> views["Team Members List, Bookings,<br/>Registrations, Print tabs"]
    resp -- "rebuilds" --> views
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class reg,fs cDb
```

## Going deeper

| Question | Read |
|---|---|
| How does a request travel, and what runs where? | [ARCHITECTURE.md](architecture/ARCHITECTURE.md) |
| Why was it built this way? | [WORKAROUNDS.md](architecture/WORKAROUNDS.md) |
| What produces `dist/`? | [BUILD-PIPELINE.md](architecture/BUILD-PIPELINE.md) |
| What do GitHub and Google each do? | [HOSTING.md](architecture/HOSTING.md) |
| Every sheet and column | [DATA-MODEL.md](reference/DATA-MODEL.md) |
| Secrets and weak spots | [SECURITY.md](reference/SECURITY.md) |
| How the tests work | [TESTING.md](reference/TESTING.md) |
| Click-by-click setup | [DEPLOY.md](DEPLOY.md) |
