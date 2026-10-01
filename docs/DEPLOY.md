# Putting it online, step by step

You need: a Google account, a free GitHub account, and about 20 minutes.
Nothing here needs a credit card.

You will use two files from this project:

- `dist/Code.gs`: the whole backend in one file
- `dist/appsscript.json`: its settings

(If `dist/` is missing, run `npm install` then `npm run build` in the project
folder and it appears.)

---

## Part 1: The backend (Google)

### 1. Create the registry sheet
1. Open **sheets.google.com** and click **Blank spreadsheet**.
2. Click the title at the top-left ("Untitled spreadsheet") and rename it **Forms Registry**.

### 2. Paste the backend
1. In that sheet click **Extensions**, then **Apps Script**. A new tab opens.
2. In the left panel click the file **Code.gs**. Select everything in the editor (Ctrl+A) and delete it.
3. Open `dist/Code.gs` from this project in any text editor, copy everything (Ctrl+A, Ctrl+C), and paste it into the Apps Script editor.
4. Click the **gear icon** (Project Settings) in the left panel. Tick **Show "appsscript.json" manifest file in editor**.
5. Click the **Editor** icon (`<>`) in the left panel. A new file **appsscript.json** now appears. Click it, select everything, delete it, and paste the content of `dist/appsscript.json`.
6. Press **Ctrl+S** to save. If asked for a project name, type **Forms Platform**.

### 3. First-time setup
1. Go back to the **Forms Registry** sheet tab and **reload the page** (F5). Wait about 5 seconds.
2. A new menu **Forms Platform** appears next to Help. Click it, then **1. First-time setup**.
3. Google asks for permission. Click **Continue**, choose your account, then:
   - If you see "Google hasn't verified this app", click **Advanced**, then **Go to Forms Platform (unsafe)**. This message appears because the script is yours and was never submitted to Google. It is safe: you are giving the script access to *your own* account.
   - Click **Allow**.
4. Click **Forms Platform > 1. First-time setup** again. A message says the setup finished. This creates the Forms, Lists, and Clients tabs and a Drive folder called **Forms Platform**.

### 4. Choose the admin PIN
1. Click **Forms Platform > 2. Set admin PIN...**
2. Type a PIN with at least 4 characters and press OK. Pick something not easy to guess: the admin page is public, and the PIN is the only lock.

### 5. Publish the backend as a web app
1. In the Apps Script tab click the blue **Deploy** button at the top-right, then **New deployment**.
2. Click the **gear icon** next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: `Forms Platform`
   - **Execute as: Me** (your account)
   - **Who has access: Anyone**
4. Click **Deploy**. Approve the permission screen again if it appears.
5. Copy the **Web app URL**. It ends with `/exec`. Keep it open; you need it in Part 2.

---

## Part 2: The website (GitHub Pages)

### 6. Tell the website where the backend is
1. Open `assets/js/config.js` in a text editor.
2. Replace `PASTE_YOUR_WEB_APP_URL_HERE` with the URL you copied. Keep the quotes:
   ```js
   window.APP_CONFIG = {
     API_URL: 'https://script.google.com/macros/s/AKfy.../exec'
   };
   ```
3. Save the file. This is the only code edit in the whole project.

### 7. Upload to GitHub
1. On **github.com** click **+**, then **New repository**. Name it, for example, `forms`. Choose **Public** (free Pages needs public) and click **Create repository**.
2. In the project folder run:
   ```
   git remote add origin https://github.com/YOUR-NAME/forms.git
   git push -u origin main
   ```
   (Or use GitHub's **Add file > Upload files** and drag the project folder contents in. Do not upload `node_modules`.)

### 8. Turn on GitHub Pages
1. In the repository click **Settings**, then **Pages** in the left list.
2. Under **Build and deployment** choose **Deploy from a branch**. Set Branch to **main** and the folder to **/ (root)**. Click **Save**.
3. Wait about a minute and refresh. The page shows your site address:
   `https://YOUR-NAME.github.io/forms/`

### 9. Tell the sheet your website address (for emails)
Back in the Forms Registry sheet: **Forms Platform > 3. Set website address...** and paste the address from step 8. Confirmation emails link to it.

---

## Part 3: Use it

1. Open `https://YOUR-NAME.github.io/forms/admin.html` and enter your PIN.
2. Click **New form**, choose a type, give it a title and a term, and click **Create form**.
3. On the settings page check:
   - **Team size**: minimum and maximum people per team (counting the leader).
   - **Days and time slots** for reservations.
   - **Status**: set to **Open** and click **Save settings**.
4. Click **Copy link** and send it to students. The link looks like `.../index.html?f=database-team-project-registration-form-fall-2027`.
5. Watch submissions under **Responses**. Each form's own Google Sheet is one click away (**Google Sheet**).
6. For instructors: **Clients > New private link**. Send them the link shown once. They need no account.

### First-run checklist (things only real Google can confirm)
Do these once with a test form:

- [ ] Register a team with a real Drive link shared to "Anyone with the link": accepted.
- [ ] Register another with a link set to private: refused with a clear message.
- [ ] Check that the confirmation email arrived with the key.
- [ ] Open the form's Google Sheet: teams show as tinted blocks with heavy borders.
- [ ] In the dashboard click **Print team list**: a print tab and a PDF appear.
- [ ] Open an instructor link on a phone.

---

## Part 4: Excel list with the real files (on your computer)

1. Install Python 3 once. In the project folder run `pip install -r scripts/requirements.txt`.
2. Run (replace the name with your form's link name, the part after `?f=`):
   ```
   python scripts/download_tasks.py --slug database-tasks-fall-2027
   ```
3. Type your admin PIN when asked.
4. Open `Tasks_Export/database-tasks-fall-2027/Tasks.xlsx` in desktop Excel. Click a task name to open its downloaded `.pptx`. Keep `Tasks.xlsx` and the `files` folder together. Anything that could not be downloaded is on the **Failed** sheet with the reason (usually a link that is not shared with "Anyone with the link").

---

## Updating later

**Backend changed** (new `dist/Code.gs`): in Apps Script paste the new code over the old, save, then **Deploy > Manage deployments**, click the pencil, set **Version: New version**, and **Deploy**. The web app address does not change.

**Website changed**: push to GitHub; Pages updates in a minute.

## If something goes wrong

| What you see | What to do |
|---|---|
| Form page says it is not connected to the backend | `assets/js/config.js` still has the placeholder, or the file was not pushed. |
| Page says it could not reach the server | The web app was not deployed with **Who has access: Anyone**. Redeploy (step 5). |
| "That PIN is not correct" | Wrong PIN, or too many tries: wait a few minutes. To reset, run **Forms Platform > 2. Set admin PIN...** again. |
| Changes to the backend have no effect | You saved the code but did not create a **New version** of the deployment. |
| The menu "Forms Platform" is missing | Reload the sheet and wait a few seconds. |
