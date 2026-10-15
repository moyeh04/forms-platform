/**
 * Download everything a team or task form collected: each team's task file or project folder,
 * with a Teams.xlsx that lists the teams and links each one to its files, packed in zip parts.
 *
 * The files are read inside Google as the owner (DriveApp, and the export address with the
 * owner's token for Google Slides, Docs and Sheets), not through public download links, so the
 * limits Google puts on anonymous downloads do not apply. What is left is Apps Script's own:
 * six minutes a request and about 50 MB a file. So the page asks for one team at a time, a
 * big folder is fetched over several requests, and each zip part stays under 40 MB.
 *
 * The work happens in a folder of the owner's Drive (Forms Platform / Exports / Downloads). Only
 * the zips stay there; the page then reads them in pieces through the API, so nothing is shared.
 */

var API = API || {};

var DL_PART_BYTES_ = 40 * 1024 * 1024;
var DL_FILE_MAX_ = 45 * 1024 * 1024;
var DL_BUDGET_MS_ = 25000;
var DL_FILES_PER_CALL_ = 40;
var DL_CHUNK_BYTES_ = 3 * 1024 * 1024;
var DL_JOB_SECONDS_ = 6 * 3600;

/** Google files are saved in the matching Office format. */
var DL_EXPORTS_ = {
  'application/vnd.google-apps.presentation': [
    'pptx',
    'https://docs.google.com/presentation/d/{id}/export/pptx'
  ],
  'application/vnd.google-apps.document': [
    'docx',
    'https://docs.google.com/document/d/{id}/export?format=docx'
  ],
  'application/vnd.google-apps.spreadsheet': [
    'xlsx',
    'https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx'
  ],
  'application/vnd.google-apps.drawing': [
    'png',
    'https://docs.google.com/drawings/d/{id}/export/png'
  ]
};

/** A name that is safe in a zip on any computer. */
function dlName_(text, fallback) {
  var s = String(text || '')
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return (s || fallback || 'file').slice(0, 80).trim();
}

function dlPad_(n) {
  return n < 10 ? '0' + n : String(n);
}

/** Where a team's things go inside the zip: "Tasks/03 - Task 3" or "Projects/03 - Library System". */
function dlBase_(form, team) {
  return (
    (form.type === 'task_submission' ? 'Tasks/' : 'Projects/') +
    dlPad_(team.number) +
    ' - ' +
    dlName_(team.title, team.ref)
  );
}

function dlDownloadsFolder_() {
  var exp = exportsFolder_();
  var it = exp.getFoldersByName('Downloads');
  return it.hasNext() ? it.next() : exp.createFolder('Downloads');
}

/* ── The job: which form, which folder, and what went wrong ──────── */

function dlJob_(req) {
  var form = requireForm(req.slug || req.id);
  var raw = CacheService.getScriptCache().get('dl_job:' + req.job);
  var job = raw ? parseJson(raw, null) : null;
  if (!job || job.form !== form.id)
    fail('download_gone', 'This download has expired. Start it again.');
  job.id = req.job;
  job.folder = DriveApp.getFolderById(job.folderId);
  return { form: form, job: job };
}

function dlSave_(job) {
  var keep = {
    form: job.form,
    folderId: job.folderId,
    failed: job.failed || [],
    zips: job.zips || [],
    parts: job.parts || []
  };
  CacheService.getScriptCache().put(
    'dl_job:' + job.id,
    JSON.stringify(keep),
    DL_JOB_SECONDS_
  );
}

/** Names of the files already saved in the job folder, so a repeated request skips them. */
function dlSaved_(folder) {
  var names = {};
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    names[f.getName()] = f;
  }
  return names;
}

/* ── Reading one Drive file ──────────────────────────────────────── */

function dlRetry_(fn) {
  var wait = 1000;
  for (var i = 0; ; i++) {
    try {
      return fn();
    } catch (e) {
      var busy = /rate|too many|quota|429|503|try again|backend error/i.test(
        String(e.message)
      );
      if (!busy || i >= 3) throw e;
      Utilities.sleep(wait);
      wait *= 2;
    }
  }
}

/** The file's bytes and the extension to save it with, or a reason it cannot be saved. */
function dlBlob_(file) {
  var mime = String(file.getMimeType());
  var ex = DL_EXPORTS_[mime];
  if (ex) {
    var resp = dlRetry_(function () {
      var r = UrlFetchApp.fetch(ex[1].replace('{id}', file.getId()), {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      var code = r.getResponseCode();
      if (code === 429 || code >= 500) throw new Error('429 try again');
      return r;
    });
    if (resp.getResponseCode() !== 200)
      return {
        reason: 'Google would not export it (' + resp.getResponseCode() + ')'
      };
    return { blob: resp.getBlob(), ext: ex[0] };
  }
  if (mime.indexOf('application/vnd.google-apps.') === 0)
    return { reason: 'This kind of Google file cannot be downloaded' };
  var size = file.getSize();
  if (size > DL_FILE_MAX_)
    return {
      reason:
        'Too big to pack (' +
        Math.round(size / 1048576) +
        ' MB): open it in Drive'
    };
  return {
    blob: dlRetry_(function () {
      return file.getBlob();
    }),
    ext: ''
  };
}

/** "Slides.pptx" stays, "Slides" exported as pptx becomes "Slides.pptx". */
function dlFileName_(name, ext) {
  var n = dlName_(name);
  return ext && !new RegExp('\\.' + ext + '$', 'i').test(n) ? n + '.' + ext : n;
}

/* ── API ─────────────────────────────────────────────────────────── */

/** Starts a download: a fresh work folder (the form's older ones go to the trash) and the list of teams. */
API['admin.download.start'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (!isTeamForm_(form))
    fail('wrong_type', 'Only team and task forms can be downloaded.');
  var teams = teamBlocks_(form);
  if (!teams.length) fail('nothing_to_download', 'Nobody has registered yet.');
  var downloads = dlDownloadsFolder_();
  var old = downloads.getFolders();
  while (old.hasNext()) {
    var f = old.next();
    if (String(f.getName()).indexOf(form.slug + ' ') === 0) f.setTrashed(true);
  }
  var folder = downloads.createFolder(
    form.slug + ' ' + nowIso().slice(0, 16).replace('T', ' ')
  );
  var job = {
    id: folder.getId(),
    form: form.id,
    folderId: folder.getId(),
    failed: []
  };
  dlSave_(job);
  return {
    job: job.id,
    folderUrl: folder.getUrl(),
    teams: teams.map(function (t) {
      var p = t.link ? Rules.parseDriveLink(t.link) : { ok: false };
      return {
        ref: t.ref,
        number: t.number,
        title: t.title,
        kind: p.ok ? p.kind : ''
      };
    })
  };
});

/**
 * Saves one team's file, or its folder with every subfolder. A big folder is saved over several
 * requests: `done` is false until every file is in, and a repeated request skips what is saved.
 */
API['admin.download.team'] = admin(function (req) {
  var x = dlJob_(req),
    form = x.form,
    job = x.job;
  var team = teamBlocks_(form).filter(function (t) {
    return t.ref === req.ref;
  })[0];
  if (!team) fail('submission_not_found', 'That team no longer exists.');
  var base = dlBase_(form, team);
  var miss = function (path, reason, url) {
    job.failed.push({
      number: team.number,
      title: team.title,
      path: path,
      reason: reason,
      url: url || team.link
    });
  };
  var failedPaths = {};
  job.failed.forEach(function (f) {
    failedPaths[f.path] = true;
  });
  var link = team.link ? Rules.parseDriveLink(team.link) : { ok: false };
  if (!link.ok) {
    if (!failedPaths[base])
      miss(
        base,
        team.link ? 'The link is not a Google Drive link' : 'No link was given',
        ''
      );
    dlSave_(job);
    return { done: true, saved: 0 };
  }

  var saved = dlSaved_(job.folder);
  var started = Date.now(),
    count = 0,
    savedNow = 0;
  var put = function (file, path) {
    if (saved[path] || failedPaths[path]) return true;
    if (count >= DL_FILES_PER_CALL_ || Date.now() - started > DL_BUDGET_MS_)
      return false;
    count++;
    var got;
    try {
      got = dlBlob_(file);
    } catch (e) {
      got = { reason: 'Could not be read: ' + e.message };
    }
    if (got.reason) {
      miss(path, got.reason, file.getUrl ? file.getUrl() : team.link);
      failedPaths[path] = true;
      return true;
    }
    job.folder.createFile(got.blob.setName(path));
    saved[path] = true;
    savedNow++;
    return true;
  };

  var done = true;
  try {
    if (link.kind !== 'folder') {
      var file = DriveApp.getFileById(link.id);
      var export_ = DL_EXPORTS_[String(file.getMimeType())];
      var own = String(file.getName()).match(/\.([A-Za-z0-9]{1,5})$/);
      var ext = export_ ? export_[0] : own ? own[1].toLowerCase() : '';
      done = put(file, base + (ext ? '.' + ext : ''));
    } else {
      var queue = [{ folder: DriveApp.getFolderById(link.id), rel: '' }];
      while (queue.length && done) {
        var at = queue.shift();
        var files = at.folder.getFiles();
        while (files.hasNext() && done) {
          var f = files.next();
          var ex = DL_EXPORTS_[String(f.getMimeType())];
          done = put(
            f,
            base + '/' + at.rel + dlFileName_(f.getName(), ex ? ex[0] : '')
          );
        }
        var subs = at.folder.getFolders();
        while (subs.hasNext()) {
          var s = subs.next();
          queue.push({
            folder: s,
            rel: at.rel + dlName_(s.getName(), 'folder') + '/'
          });
        }
      }
    }
  } catch (e) {
    if (!failedPaths[base])
      miss(base, 'The link could not be opened: ' + e.message);
    done = true;
  }
  dlSave_(job);
  return { done: done, saved: savedNow };
});

/** The workbook: every team with its members, and its task or project linked to the saved copy. */
function dlWorkbook_(form, job, saved) {
  var thing = teamThing_(form);
  var styles = [
    {
      fill: VIEW_STYLE_.ink,
      color: VIEW_STYLE_.onInk,
      bold: true,
      align: 'center'
    }
  ];
  VIEW_STYLE_.groups.forEach(function (g) {
    styles.push(
      { fill: g.shades[0], bold: true, align: 'right', rtl: true },
      { fill: g.shades[1], bold: true, align: 'right', rtl: true },
      { fill: g.shades[0], bold: true, align: 'center' },
      { fill: g.shades[1], bold: true, align: 'center' },
      {
        fill: g.solid,
        color: '#FFFFFF',
        bold: true,
        underline: true,
        align: 'center',
        wrap: true
      }
    );
  });
  styles.push({ wrap: true });
  var ST = { head: 1, wrap: 2 + VIEW_STYLE_.groups.length * 5 };
  var group = function (g, k) {
    return 2 + (g % VIEW_STYLE_.groups.length) * 5 + k;
  };
  var paths = Object.keys(saved);
  var localLink = function (base) {
    var hit = paths.filter(function (p) {
      return (
        p === base || p.indexOf(base + '.') === 0 || p.indexOf(base + '/') === 0
      );
    })[0];
    if (!hit) return '';
    var target = hit.indexOf(base + '/') === 0 ? base + '/' : hit;
    return target.split('/').map(encodeURIComponent).join('/');
  };

  var rows = [
    [
      { v: '#', style: ST.head },
      { v: 'Team member', style: ST.head },
      { v: 'Code', style: ST.head },
      { v: 'Section', style: ST.head },
      { v: thing, style: ST.head }
    ]
  ];
  var merges = [];
  teamBlocks_(form).forEach(function (t, g) {
    var start = rows.length + 1;
    var link = localLink(dlBase_(form, t)) || t.link || '';
    t.members.forEach(function (m, i) {
      rows.push([
        i === 0
          ? { v: t.number, style: group(g, 2) }
          : { v: '', style: group(g, 2) },
        {
          v: i + 1 + '. ' + m.name + (m.leader ? ' ★' : ''),
          style: group(g, i % 2)
        },
        // A code that starts with 0 stays text, or Excel would drop the zero.
        {
          v: /^[1-9]\d*$/.test(String(m.code)) ? Number(m.code) : m.code,
          style: group(g, 2 + (i % 2))
        },
        { v: m.section || '', style: group(g, 2 + (i % 2)) },
        i === 0
          ? { v: t.title || t.ref, style: group(g, 4), link: link }
          : { v: '', style: group(g, 4) }
      ]);
    });
    if (t.members.length > 1) {
      merges.push('A' + start + ':A' + (start + t.members.length - 1));
      merges.push('E' + start + ':E' + (start + t.members.length - 1));
    }
  });
  var sheets = [{ name: 'Teams', rows: rows, merges: merges, heights: 24 }];
  if (job.failed.length) {
    sheets.push({
      name: 'Not downloaded',
      rows: [
        [
          { v: '#', style: ST.head },
          { v: thing, style: ST.head },
          { v: 'File', style: ST.head },
          { v: 'Why', style: ST.head },
          { v: 'Open in Drive', style: ST.head }
        ]
      ].concat(
        job.failed.map(function (f) {
          return [
            f.number,
            { v: f.title || '', style: ST.wrap },
            { v: f.path, style: ST.wrap },
            { v: f.reason, style: ST.wrap },
            f.url ? { v: 'Open', link: f.url } : ''
          ];
        })
      )
    });
  }
  return xlsxBlob_('Teams.xlsx', sheets, styles);
}

/** Writes the workbook and splits the saved files into zip parts. Returns how many parts there are. */
API['admin.download.finish'] = admin(function (req) {
  var x = dlJob_(req),
    form = x.form,
    job = x.job;
  var saved = dlSaved_(job.folder);
  Object.keys(saved).forEach(function (n) {
    if (/\.zip$/.test(n) && !/\//.test(n)) delete saved[n];
  });
  delete saved['Teams.xlsx'];
  var book = job.folder.createFile(
    dlWorkbook_(form, job, saved).setName('Teams.xlsx')
  );
  var parts = [[book.getId()]],
    size = book.getSize();
  Object.keys(saved)
    .sort()
    .forEach(function (name) {
      var f = saved[name],
        s = f.getSize();
      if (size + s > DL_PART_BYTES_ && parts[parts.length - 1].length) {
        parts.push([]);
        size = 0;
      }
      parts[parts.length - 1].push(f.getId());
      size += s;
    });
  job.parts = parts;
  job.zips = [];
  dlSave_(job);
  return {
    parts: parts.length,
    files: Object.keys(saved).length,
    failed: job.failed
  };
});

/** Packs one zip part, keeps it in the work folder, and moves its loose files to the trash. */
API['admin.download.pack'] = admin(function (req) {
  var x = dlJob_(req),
    form = x.form,
    job = x.job;
  var i = parseInt(req.part, 10);
  if (!(i >= 0 && i < job.parts.length))
    fail('bad_part', 'That part does not exist.');
  var root = dlName_(form.title, form.slug);
  var files = job.parts[i].map(function (id) {
    return DriveApp.getFileById(id);
  });
  var blobs = files.map(function (f) {
    return f.getBlob().setName(root + '/' + f.getName());
  });
  var name =
    root +
    (job.parts.length > 1
      ? ' - part ' + (i + 1) + ' of ' + job.parts.length
      : '') +
    '.zip';
  var zip = job.folder.createFile(Utilities.zip(blobs, name));
  files.forEach(function (f) {
    f.setTrashed(true);
  });
  job.zips[i] = zip.getId();
  dlSave_(job);
  return { file: zip.getId(), name: name, size: zip.getSize() };
});

/**
 * A piece of a packed zip, as base64, so the page can save it without sharing anything. Only
 * the piece is read from Drive (a ranged request), not the whole zip each time.
 */
API['admin.download.chunk'] = admin(function (req) {
  var job = dlJob_(req).job;
  if (job.zips.indexOf(req.file) === -1)
    fail('bad_part', 'That part does not exist.');
  var size = DriveApp.getFileById(req.file).getSize();
  var from = Math.max(0, parseInt(req.offset, 10) || 0);
  var to = Math.min(size, from + DL_CHUNK_BYTES_);
  var resp = dlRetry_(function () {
    var r = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + req.file + '?alt=media',
      {
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
          Range: 'bytes=' + from + '-' + (to - 1)
        },
        muteHttpExceptions: true
      }
    );
    var code = r.getResponseCode();
    if (code === 429 || code >= 500) throw new Error('429 try again');
    if (code !== 206 && code !== 200)
      fail(
        'download_failed',
        'Drive would not give the file (' + code + '). Try again.'
      );
    return r;
  });
  return {
    data: Utilities.base64Encode(resp.getContent()),
    size: size,
    next: to < size ? to : null
  };
});
