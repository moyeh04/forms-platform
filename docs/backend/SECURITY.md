# Security

A free, account-less platform has to be careful about who can do what. This
page lists the secrets, where each lives, what protects it, and where the
honest weak spots are.

## The model in one picture

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
    subgraph untrusted["Untrusted: anything in a browser"]
        page["Pages, scripts, form checks"]
    end
    subgraph boundary["The only trust boundary: Apps Script doPost"]
        direction TB
        v["1. parse JSON, find the action"]
        a{"2. does the action need a secret?"}
        s["3. verify the secret, throttle failures"]
        r["4. validate the data again with shared rules"]
        w["5. act with the owner's permissions,<br/>data rows written under one lock"]
        v --> a --> s --> r --> w
    end
    subgraph trusted["Trusted: the owner's Google account"]
        data[("Sheets, Drive, Mail")]
    end
    page -- "every request" --> v
    w --> data
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
    class data cDb
    class a cDec
```

Rule of the whole design: **the browser is a convenience, never a guard.** The
page's checks give instant feedback; the server repeats every one of them.

## Secrets inventory

| Secret | Who holds it | Stored as | Protected by | If it leaks |
|---|---|---|---|---|
| Admin PIN | The admin | `sha256(pepper:admin:pin)` in script properties | Lockout after 8 wrong tries for 10 minutes | Full admin access. Run **Set admin PIN** from the sheet menu to replace it. |
| Edit key (5 digits) | One student, and the admin on request (who can also move its end date) | `sha256(pepper:key:formId:key)` plus a sealed copy (`keySeal`, digits shifted by `sha256(pepper:seal:formId:responseId)`) in the Responses row | Per-form throttle of 10 wrong tries a minute, expiry; only the backend can unseal, only for the PIN | One registration can be edited or cancelled. Admin: **Details, Reset key**. |
| Viewer token (24 characters) | One instructor or client | `sha256(pepper:client:token)` in the Clients tab | Random, throttled at 30 wrong tries a minute, revocable, optional end date | Read access to the forms and columns of that link, unless the link also asks for an access key. Turn it off or make **New link**. |
| Access key (6 digits) | One instructor or client, sent apart from the link; the admin on request | `sha256(pepper:clientkey:clientId:key)` plus a sealed copy (`keySeal`, digits shifted by `sha256(pepper:clientseal:clientId)`) in the Clients tab | Asked only together with the right token; 5 wrong keys lock that link for 10 minutes; only the backend can unseal, only for the PIN | Nothing on its own. With the link, read access as above. **Clients, New key**. |
| Pepper | Apps Script only | Script property `PEPPER`, created once | Never leaves Google | Hashes could be attacked offline. Not exposed by any action. |
| Web app address | Everyone | Actions `API_URL` variable; generated published `assets/js/config.js` | Not secret by design | Nothing: it is only an entry point. |

The pepper is a long random value mixed into every hash. A leaked spreadsheet
alone therefore reveals no PIN, key, or token that could be tested offline.

## What each audience can do

| Audience | Can | Cannot |
|---|---|---|
| Anyone with a form link | Read the public form definition, submit if the form is open | See any other registration, or the admin pages' data |
| Student with a key | Read, change, or cancel **their own** registration | Open anyone else's; the key identifies exactly one row |
| Instructor with a link | Read chosen forms through chosen columns, until the link's end date and with its access key when it has one; review steps only if allowed | Edit data, delete, or see hidden columns |
| Admin with the PIN | Everything through the dashboard, including reading a student's current key | Read a key without the PIN, or a key for a cancelled registration |
| Sheet owner | Everything, directly in Google | n/a |

## Defences, layer by layer

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
    subgraph L1["Input"]
        i1["Server re-validates every answer"]
        i2["Arabic-only, English-only, phone, code, team size rules"]
        i3["Drive link must open and be shared"]
    end
    subgraph L2["Identity"]
        a1["PIN hash with lockout"]
        a2["Key hash, per form, unique, expiring"]
        a3["Token hash, revocable"]
    end
    subgraph L3["Abuse"]
        b1["Throttles in CacheService"]
        b2["Form limits: max submissions, one code per team"]
        b3["Script lock: no double booking"]
    end
    subgraph L4["Exposure"]
        e1["Hidden columns removed on the server"]
        e2["Export omits phones and key data"]
        e3["Pages are noindex, secrets never in git"]
    end
    L1 --> L2 --> L3 --> L4
    classDef cDb fill:#F3E2B3,stroke:#B8892D,stroke-width:1.5px,color:#2F2418
    classDef cActor fill:#F4D9D3,stroke:#9A3328,stroke-width:1.5px,color:#2F2418
    classDef cDec fill:#FBEFC9,stroke:#C9A24A,stroke-width:1.5px,color:#2F2418
    classDef cEnd fill:#2F2418,stroke:#2F2418,color:#F8F1DD
    classDef cErr fill:#F6D5CF,stroke:#A12B1F,stroke-width:1.5px,color:#5A140C
    classDef cOk fill:#BFD9CF,stroke:#2E5A55,stroke-width:1.5px,color:#17302D
```

### Details worth knowing

- **Key throttling is per form.** After ten wrong keys in a minute on one form,
  every key lookup on that form answers `too_many_attempts` until the minute
  ends, also for a student with the right key.
- **Per-form key salt.** The form id is part of the key hash, so the same five
  digits in two forms hash to different values, and a hash from one form is
  useless in another.
- **Unique keys.** `issueKey_` refuses to issue a key whose hash already exists
  in the form, so a key always identifies exactly one registration.
- **Deleting a form** needs the PIN and the form's link name sent back as a
  second key (`confirm`), so a stray or replayed call cannot delete one. Its
  sheet goes to the Drive trash rather than being destroyed.
- **Sealed keys.** The admin can read a key back because the row also holds a
  sealed copy. It is useless without the pepper, which never leaves Apps Script,
  and each registration has its own pad, so two sealed keys cannot be compared.
  Cancelling clears it along with the hash.
- **Cleaning up.** Cancelling clears the key hash, so a cancelled registration's
  key stops working at once.
- **No cookies, no sessions.** Every request carries its own secret, so there is
  nothing for a third-party site to ride on (no cross-site request forgery
  surface), and nothing to hijack.
- **Rendering.** The pages build elements with `textContent` and text nodes, not
  by pasting student text into HTML. The only `innerHTML` use in the pages is for the
  app's own fixed icon shapes. A student cannot inject script through a name or
  title. The print dialog of the sheet menu (`Menu.js`) is the one exception: it
  builds its list of days as HTML from the day names the admin typed, in a
  dialog only the sheet owner opens.
- **Admin PIN in the browser.** Kept in `sessionStorage` for the current tab only
  and sent with each admin request. Closing the tab forgets it.

## Honest weak spots

| Weak spot | Why it exists | Mitigation |
|---|---|---|
| `admin.html` is public | Free static hosting has no private area | It holds no data; every action needs the PIN; lockout; `noindex` |
| Anyone who opens the admin page can lock the dashboard for 10 minutes with 8 wrong PINs, and can do it again | Wrong tries are counted in one place for all visitors: there are no accounts to count by | **Unlock the admin page** in the sheet menu lifts the lock at once and keeps the PIN. A dashboard that is already open keeps its PIN and works again when the lock ends. The owner can always work directly in the sheets |
| A 5-digit key is short, and a guess is tried against every live key of the form | Students must type it on a phone | 10 wrong tries a minute per form, expiry, shown once. This slows guessing and does not stop it: on a form with 200 live keys about 500 guesses reach one of them, which the limit spreads over about an hour. What a key opens is one team's registration. Accepted for a course form |
| Ten wrong keys in a minute stop key lookups on that form for the rest of the minute, for everyone | The same counter is the limit above | It ends by itself within a minute; the admin can edit or cancel any registration from Responses meanwhile |
| A registration key also books a slot | Teams should not retype their details | The lookup shares the same 10 tries a minute; the preview shows the leader's name, code, project and team size only, never phone or email; one booking per team; typed answers are ignored when the slot is booked and when it is changed later, so a key cannot book under another name |
| A viewer link is a bearer secret | No accounts for instructors | Revocable; hidden columns; send it privately; make a new link if shared widely |
| The script holds broad Google permissions | It must read students' linked files and manage the platform folder | The manifest lists scopes explicitly; the script is yours; only the owner can change it. The Drive scope is full because checking sharing on arbitrary student links needs it. |
| Student data lives in the owner's Google Drive | That is the database | Share each form's sheet only with people who need it |
| Email goes through the owner's mail quota | Apps Script MailApp | Mail is best effort and never blocks a submission |
| Real Google behaviour is not covered by local tests | Tests use a faithful copy | First-run checklist in [DEPLOY.md](../operations/DEPLOY.md) |

## If the pepper or properties are lost

Script properties hold the pepper and the PIN hash. If they are deleted:

| Item | Effect | Recovery |
|---|---|---|
| Admin PIN | Stops working | Menu: **Forms Platform, 2. Set admin PIN...** |
| Edit keys | Old keys no longer match | **Details, Reset key** per registration |
| Viewer links | Old links stop working | **Clients, New link** |
| Registrations and forms | Unaffected: they are plain data in the sheets | None needed |

## Privacy

| Data | Where | Who can see it |
|---|---|---|
| Names, codes, phones, emails | The form's own Google Sheet | The sheet owner, anyone the owner shares it with, the admin dashboard, and instructors through links with those columns shown |
| A team leader's phone | A waiting request between two teams, only when the form ticks *Show each leader the phone number of the other leader* (off by default) | The leader of the other team of that request, with the edit key, from the moment the request is made until it is answered or cancelled. A team must register and ask before it sees a number, so a code typed into the form shows none |
| Task files and project folders | The student's Drive | Whoever the student shared the link with. **Download all** reads them as the owner |
| Download all | The owner's Drive, in `Forms Platform / Exports / Downloads`, and wherever the admin saves the zips | The owner, and anyone the saved zips are given to. They hold the students' files and `Teams.xlsx` with names, codes and sections, but no phone numbers or emails. A new download of the same form moves the older folder to the trash |

## Operational checklist

- [ ] Choose a PIN that is not a birthday or a repeated digit
- [ ] Share each form's Google Sheet with the minimum number of people
- [ ] Give instructors links with phone and email hidden unless they need them
- [ ] Turn off a viewer link when its term ends
- [ ] Keep saved zips and `Teams.xlsx` out of git and out of shared folders, and empty `Exports / Downloads` when a term ends
- [ ] After changing the backend, check that the **Test and deploy site** run succeeded; a manual recovery must publish a **New version** of the same deployment
- [ ] Revisit the quota page in Google if you expect hundreds of confirmation emails a day
