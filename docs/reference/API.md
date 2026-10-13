# API reference

The backend has one address. Every request is a `POST` whose body is JSON sent
as plain text, with the action in `action`. Every answer is JSON with `ok`:

```
{ "action": "lookup", "slug": "database-projects", "key": "12345" }

{ "ok": true, ... }
{ "ok": false, "error": { "code": "bad_key", "message": "That key is not right." } }
```

An unknown action answers `unknown_action`. An error the code did not expect
answers `server_error` and is written to the Apps Script log.

This page lists every action: who may call it, whether it takes the script
lock, and what it writes. A git hook (`.githooks/pre-commit`) refuses a commit
while the tables do not name exactly the actions the code has, so an action
cannot be added or removed without this page.

## How to read the tables

| Column | Means |
|---|---|
| **Lock** | **yes**: the action reads and writes inside the one script lock (`withLock_`), so two requests cannot change the same rows at once. **no**: it only reads, or writes something no other request changes |
| **Writes** | What is different afterwards. "Marks the views" means the form's tinted tabs are repainted by the booked run a minute later |

Who may call an action is decided by the secret the request carries:

| Secret | Field in the request | Checked by | Wrong tries |
|---|---|---|---|
| None | | | |
| Edit key (5 digits) | `key` | `findByKey_` | 10 a minute for each form |
| Private link | `token`, and `accessKey` when the link has one | `requireClient_` | 30 wrong tokens a minute; 5 wrong access keys lock that link for 10 minutes |
| Admin PIN | `admin.pin` | `requireAdmin` | 8 wrong PINs lock the dashboard for 10 minutes |

## Anyone (no secret)

| Action | Lock | Writes |
|---|---|---|
| `getForm` | no | Nothing. Returns the form as students see it, its state, and for a reservation the slots already taken. A draft or archived form returns its title and messages only |
| `submit` | yes | One new row in the form's Responses tab, with its reference, key hash and team number; one row in Transfers for each member asked from another team. Marks the views. Sends the confirmation email and the admin's alert. The Drive link is checked before the lock. A booking made with a team's key sends `sourceKey` |

## Edit key

| Action | Lock | Writes |
|---|---|---|
| `lookup` | no | Nothing. Returns the registration, its member requests (each waiting one with the `phone` of the other team's leader when the form shows it, and `whatsapp` when the number opens in WhatsApp), and what the key may do: `canEdit`, `slotOnly` (only the time of a booking can change) and `canDelete` |
| `update` | yes | The registration's row; a Transfers row for each member newly asked for. Marks the views. When only the time may change (`slotOnly`), the slot is taken from the request and every other answer is kept as saved |
| `remove` | yes | Marks the row deleted and clears its key; closes its member requests. The row and its team number stay. Marks the views |
| `bookingTeam` | no | Nothing. Takes a key of the registration form that a reservation books with (an expired key too) and returns the team to confirm: leader, code, project, size and the names of the teammates. A team that has booked also gets its `slot`, and `canMove` when its booking may move to another time |
| `transfer.decide` | yes | The request's row in Transfers; on approval the rows of both teams. Marks the views. Emails both leaders when the form switches that on. Approving a request for the leader of the team needs `handover`: `{ leader, email }`, the code of the member who leads next and their email; that member's answers become the leader's and the team keeps its reference and key |
| `transfer.cancel` | yes | The request's row in Transfers |

## Private link (instructor)

| Action | Lock | Writes |
|---|---|---|
| `viewer.me` | no | Nothing. Returns the name of the link and the forms it may read |
| `viewer.data` | no | Nothing. Returns the teams, bookings or registrations of one form, without the columns hidden from the link |
| `viewer.review` | yes | One review step of one registration, only for a link that was given review rights. Marks the views |

## Admin PIN

Every action below is refused without the PIN, and a wrong PIN counts toward
the lock.

### Sign in

| Action | Lock | Writes |
|---|---|---|
| `admin.login` | no | Nothing. Says whether the PIN is right |

### Forms

| Action | Lock | Writes |
|---|---|---|
| `admin.forms.list` | no | Nothing |
| `admin.forms.get` | no | Nothing. Returns one form with the lists; for a reservation, the bookings in each slot; for a form with a team size, how many saved teams have each size (`teamSizes`); for a reservation that asks for teammates, how many saved bookings have each number of teammates (`teammateCounts`) |
| `admin.forms.create` | yes | A new spreadsheet in the platform's Drive folder (before the lock) and a row in the Forms tab |
| `admin.forms.update` | yes | The form's row in the Forms tab. Refuses `stale` when `base` is older than the saved copy. Rewrites Clients rows that still hold link names before a link name changes |
| `admin.forms.duplicate` | yes | A new spreadsheet and a row in the Forms tab |
| `admin.forms.delete` | yes | Removes the form's row, moves its spreadsheet to the Drive trash, and takes the form out of every private link |
| `admin.bookings.next` | yes | The next booking of a form: a new reservation form (spreadsheet and Forms row), a week later than the newest one |

### Lists

| Action | Lock | Writes |
|---|---|---|
| `admin.lists.get` | no | Nothing |
| `admin.lists.set` | yes | The values of one list, in the Lists tab |
| `admin.lists.create` | yes | A new list and its name and kind in the `_info` row |
| `admin.lists.rename` | yes | The name of a list in the `_info` row |
| `admin.lists.delete` | yes | Removes a list no form asks for, and its entry in the `_info` row |

### Registrations

| Action | Lock | Writes |
|---|---|---|
| `admin.submissions` | no | Nothing. Returns the registrations with their team numbers, and the member requests that wait |
| `admin.submission.update` | yes | The status, the review steps or the answers of one registration. Marks the views |
| `admin.submission.delete` | yes | Marks the row deleted and clears its key; closes its member requests. Marks the views |
| `admin.submission.key` | no | Nothing. Opens the sealed copy of a student's key |
| `admin.submission.resetKey` | yes | A new key hash, sealed copy and end date on one row |
| `admin.keys.list` | no | Nothing. Returns when each key ends |
| `admin.keys.extend` | yes | The end date of the keys of all, the expired, or the chosen registrations |
| `admin.transfer.decide` | yes | The same as `transfer.decide`, answered by the admin, with the same `handover` for a leader |

### Private links

| Action | Lock | Writes |
|---|---|---|
| `admin.clients.list` | no | Nothing |
| `admin.clients.create` | yes | A new row in the Clients tab. The token and the access key are returned once; only their hashes and a sealed copy of the key are stored |
| `admin.clients.update` | yes | The name, forms, hidden columns, review rights, end date or on/off state of a link |
| `admin.clients.regenerate` | yes | A new token for a link; the old address stops working |
| `admin.clients.key` | yes | A new access key for a link, or none |
| `admin.clients.showKey` | no | Nothing. Opens the sealed copy of a link's access key |
| `admin.clients.remove` | yes | Removes the link's row |

### WhatsApp matching

| Action | Lock | Writes |
|---|---|---|
| `admin.matching.import` | yes | One row in the Requests tab for each pasted line with a new phone number |
| `admin.matching.list` | no | Nothing. Returns the requests with the registration each one matches |
| `admin.matching.decide` | yes | The decision on a request, and the group step of the one registration it matches. Marks the views |
| `admin.matching.remove` | yes | Removes a request's row |

### Sheet views and printing

| Action | Lock | Writes |
|---|---|---|
| `admin.views.rebuild` | no | Repaints the form's tinted tabs now. It reads the responses and writes only its own tabs |
| `admin.print.reservations` | no | A print tab for one day in the form's spreadsheet, and its PDF in Drive |
| `admin.print.teamList` | no | A print tab with the team list, and its PDF in Drive |

### Download all

A download is a job: its state is kept in the cache for six hours and its files
in `Forms Platform / Exports / Downloads` in the owner's Drive.

| Action | Lock | Writes |
|---|---|---|
| `admin.download.start` | no | A work folder for the form, the job in the cache; moves an older download of the same form to the trash |
| `admin.download.team` | no | Copies of one team's file, or part of its folder, in the work folder; what could not be saved, in the job |
| `admin.download.finish` | no | `Teams.xlsx` in the work folder; the list of zip parts in the job |
| `admin.download.pack` | no | One zip part in the work folder |
| `admin.download.chunk` | no | Nothing. Returns a piece of a zip of this download |
