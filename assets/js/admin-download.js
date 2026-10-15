/**
 * Admin: download everything a team or task form collected, as zip parts with Teams.xlsx.
 * The backend (Download.js) does the work one team at a time; this window drives it, shows how
 * far it is, and saves each part from pieces it reads through the API.
 */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast, A = App.admin;

  function mb(bytes) { return bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'; }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /** Reads a packed part piece by piece and hands it to the browser as a file. */
  async function savePart(form, job, part, onProgress) {
    var pieces = [], offset = 0, size = part.size;
    while (offset !== null) {
      var c = await A.call('admin.download.chunk', { slug: form.slug, job: job, file: part.file, offset: offset });
      var bin = atob(c.data), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      pieces.push(bytes);
      size = c.size;
      offset = c.next;
      onProgress(offset === null ? size : offset, size);
    }
    var url = URL.createObjectURL(new Blob(pieces, { type: 'application/zip' }));
    var a = h('a', { href: url, download: part.name, hidden: true });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 60000);
  }

  A.downloadAll = function (form) {
    var tasks = form.type === 'task_submission';
    var what = tasks ? 'task' : 'project';
    var body = h('div', { class: 'l-stack download' });
    var dialog = A.modal(tasks ? 'Download all tasks' : 'Download all projects', body, [{ text: 'Close', kind: 'quiet' }]);
    var open = function () { return !!dialog.el.parentNode; };

    function intro() {
      ui.clear(body);
      body.appendChild(h('p', null, tasks
        ? 'Every team\'s task file is saved, and Teams.xlsx lists the teams with a link from each task to its file. Google Slides come as PowerPoint.'
        : 'Every team\'s project folder is saved with its subfolders, and Teams.xlsx lists the teams with a link from each project to its folder. Google Docs, Sheets and Slides come as Office files.'));
      body.appendChild(h('p', { class: 'help' }, 'The files are read in your Google Drive, one team at a time, so it can take a few minutes. Keep this window open. Anything that cannot be saved is listed with the reason and its Drive link.'));
      body.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', name: 'download-start', onclick: run }, icon('download', 18), 'Start')));
    }

    async function run() {
      ui.clear(body);
      var bar = h('progress', { class: 'download-bar', max: '1', value: '0', 'aria-label': 'Progress' });
      var line = h('p', { class: 'download-line', role: 'status' }, 'Getting ready…');
      body.appendChild(bar);
      body.appendChild(line);
      try {
        var start = await A.call('admin.download.start', { slug: form.slug });
        var files = 0, n = start.teams.length;
        bar.max = String(n + 1);
        for (var i = 0; i < n; i++) {
          var t = start.teams[i];
          line.textContent = 'Team ' + t.number + ' of ' + n + ': ' + (t.title || t.ref) + (files ? ' · ' + plural(files, 'file', 'files') + ' saved' : '');
          for (var done = false; !done;) {
            if (!open()) return;
            var r = await A.call('admin.download.team', { slug: form.slug, job: start.job, ref: t.ref });
            files += r.saved;
            done = r.done;
          }
          bar.value = String(i + 1);
        }
        line.textContent = 'Writing Teams.xlsx…';
        var fin = await A.call('admin.download.finish', { slug: form.slug, job: start.job });
        var parts = [];
        for (var p = 0; p < fin.parts; p++) {
          if (!open()) return;
          line.textContent = fin.parts > 1 ? 'Packing part ' + (p + 1) + ' of ' + fin.parts + '…' : 'Packing the zip…';
          parts.push(await A.call('admin.download.pack', { slug: form.slug, job: start.job, part: p }));
        }
        bar.value = bar.max;
        finished(start, fin, parts);
      } catch (e) {
        ui.clear(body);
        body.appendChild(h('p', { class: 'error', role: 'alert' }, (e && e.message) || 'The download stopped.'));
        body.appendChild(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn-primary', name: 'download-start', onclick: run }, 'Start again')));
      }
    }

    function finished(start, fin, parts) {
      ui.clear(body);
      body.appendChild(h('p', null, h('strong', null, plural(fin.files, 'file', 'files') + ' packed'),
        fin.parts > 1 ? ' in ' + fin.parts + ' zip parts. Save every part into the same folder and unzip them there: Teams.xlsx in part 1 links to the files in all of them.' : '.'));
      body.appendChild(h('div', { class: 'download-parts' }, parts.map(function (part, i) {
        var label = (parts.length > 1 ? 'Save part ' + (i + 1) + ' of ' + parts.length : 'Save the zip') + ' (' + mb(part.size) + ')';
        var btn = h('button', { type: 'button', class: 'btn btn-primary', name: 'save-part-' + i }, icon('download', 18), label);
        btn.onclick = function () {
          A.busy(btn, async function () {
            await savePart(form, start.job, part, function (got, all) { btn.lastChild.textContent = 'Saving ' + Math.round(got / Math.max(all, 1) * 100) + '%'; });
            btn.lastChild.textContent = label.replace(/^Save/, 'Saved');
            toast(part.name + ' saved', 'ok');
          });
        };
        return btn;
      })));
      if (fin.failed.length) {
        body.appendChild(h('div', { class: 'download-missed' },
          h('h3', null, plural(fin.failed.length, 'item was', 'items were') + ' not downloaded'),
          h('p', { class: 'help' }, 'They are also listed in Teams.xlsx, on the sheet "Not downloaded", each with its Drive link.'),
          h('ul', { class: 'plain-list' }, fin.failed.map(function (f) {
            // "Projects/03 - Library/Diagrams/erd.png" names the file inside the team's folder.
            var inner = f.path.split('/').slice(2).join('/');
            return h('li', null, h('strong', null, 'Team ' + f.number), ' · ', f.title || '', inner ? ' · ' + inner : '', ': ', h('span', { class: 'muted-note' }, f.reason),
              f.url ? [' ', h('a', { href: f.url, target: '_blank', rel: 'noopener' }, 'Open')] : null);
          }))));
      }
      body.appendChild(h('p', { class: 'help' }, 'The zips also stay in your Google Drive, in Forms Platform / Exports / Downloads, until the next download of this form. ',
        h('a', { href: start.folderUrl, target: '_blank', rel: 'noopener' }, 'Open the folder')));
    }

    intro();
    return dialog;
  };
})(window.App = window.App || {});
