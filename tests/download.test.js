const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

const ID = (c) => c.repeat(33);
const SLIDES = 'application/vnd.google-apps.presentation';
const DOC = 'application/vnd.google-apps.document';

/** Reads the entries of a stored zip: { name: Buffer }. */
function unzip(buf) {
  const out = {};
  for (let at = 0; buf.readUInt32LE(at) === 0x04034b50; ) {
    const size = buf.readUInt32LE(at + 18),
      len = buf.readUInt16LE(at + 26),
      extra = buf.readUInt16LE(at + 28);
    const name = buf.slice(at + 30, at + 30 + len).toString('utf8');
    out[name] = buf.slice(at + 30 + len + extra, at + 30 + len + extra + size);
    at += 30 + len + extra + size;
  }
  return out;
}

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (b) => w.api({ ...b, admin: { pin: '4321' } });
  w.make = (type, title) => {
    const f = w.admin({
      action: 'admin.forms.create',
      type,
      title,
      term: 'Fall 2027'
    }).form;
    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: { status: 'open', rules: { driveCheck: 'off' } }
    });
    return f;
  };
  // Google files are exported through the export address; a zip piece is read with a range.
  w.exports = [];
  w.fetch = (url, opts) => {
    assert.equal(
      opts.headers.Authorization,
      'Bearer test-token',
      'files are read as the owner, never anonymously'
    );
    const media = /files\/([\w-]+)\?alt=media/.exec(url);
    if (media) {
      const [, from, to] = /bytes=(\d+)-(\d+)/
        .exec(opts.headers.Range)
        .map(Number);
      const buf = w.drive.files.get(media[1]).buf.slice(from, to + 1);
      return {
        getResponseCode: () => 206,
        getContent: () => Array.from(buf, (b) => (b > 127 ? b - 256 : b))
      };
    }
    w.exports.push(url);
    return {
      getResponseCode: () => 200,
      getBlob: () =>
        new w.MockBlob('EXPORTED ' + url, 'application/octet-stream', 'x')
    };
  };
  return w;
}

const person = (code, o = {}) => ({
  email: 'a@b.com',
  leader_name: 'أحمد محمد محمود أحمد',
  leader_code: code,
  phone: '01012345678',
  major: 'حاسبات',
  level: 'صفر / الأولى',
  section: '4C-TH1',
  curriculum: '2020',
  team_size: String((o.members || []).length + 1),
  members: [],
  ...o
});
const mate = (name, code) => ({
  name,
  phone: '01112345678',
  code,
  level: 'صفر / الأولى',
  curriculum: '2020',
  section: '4C-TH2'
});

/** Runs the whole download the way the page does, and returns the zip entries of every part. */
function download(w, slug) {
  const start = w.admin({ action: 'admin.download.start', slug });
  assert.equal(start.ok, true, JSON.stringify(start.error));
  let calls = 0;
  start.teams.forEach((t) => {
    for (
      let r;
      !(r = w.admin({
        action: 'admin.download.team',
        slug,
        job: start.job,
        ref: t.ref
      })).done;
    ) {
      calls++;
      assert.equal(r.ok, true);
    }
  });
  const fin = w.admin({
    action: 'admin.download.finish',
    slug,
    job: start.job
  });
  const entries = {};
  for (let i = 0; i < fin.parts; i++) {
    const part = w.admin({
      action: 'admin.download.pack',
      slug,
      job: start.job,
      part: i
    });
    const pieces = [];
    for (let offset = 0; offset !== null; ) {
      const c = w.admin({
        action: 'admin.download.chunk',
        slug,
        job: start.job,
        file: part.file,
        offset
      });
      pieces.push(Buffer.from(c.data, 'base64'));
      offset = c.next;
    }
    const zip = Buffer.concat(pieces);
    assert.equal(zip.length, part.size, 'the pieces add up to the whole zip');
    Object.assign(entries, unzip(zip));
  }
  return { start, fin, entries, calls };
}

test('Download: every task is saved under its team number, with a workbook that links to it', () => {
  const w = boot();
  const f = w.make('task_submission', 'Software Engineering Tasks');
  w.drive.addFile({ id: ID('a'), name: 'Task 1', mime: SLIDES });
  w.drive.addFile({
    id: ID('b'),
    name: 'report.pdf',
    mime: 'application/pdf',
    bytes: '%PDF report'
  });
  w.drive.addFile({
    id: ID('c'),
    name: 'huge.mp4',
    mime: 'video/mp4',
    bytes: Buffer.alloc(46 * 1024 * 1024)
  });
  const submit = (code, title, id, o) =>
    assert.equal(
      w.api({
        action: 'submit',
        slug: f.slug,
        data: person(code, {
          title,
          link: `https://docs.google.com/presentation/d/${id}/edit`,
          ...o
        })
      }).ok,
      true
    );
  submit('4230001', 'Task 1', ID('a'), {
    members: [mate('سارة خالد حسن علي', '4230002')]
  });
  submit('0230003', 'Task 2', ID('b'));
  submit('4230004', 'Demo: video/clip', ID('c'));

  const { entries, fin } = download(w, f.slug);
  const root = 'Software Engineering Tasks/';
  assert.deepEqual(Object.keys(entries).sort(), [
    root + 'Tasks/01 - Task 1.pptx',
    root + 'Tasks/02 - Task 2.pdf',
    root + 'Teams.xlsx'
  ]);
  assert.equal(
    entries[root + 'Tasks/02 - Task 2.pdf'].toString(),
    '%PDF report'
  );
  assert.match(
    w.exports[0],
    /presentation\/d\/a+\/export\/pptx/,
    'Google Slides are exported as PowerPoint'
  );
  assert.equal(fin.failed.length, 1);
  assert.match(fin.failed[0].reason, /Too big/);
  assert.equal(
    fin.failed[0].path,
    'Tasks/03 - Demo video clip.mp4',
    'names are safe on any computer'
  );

  const book = unzip(entries[root + 'Teams.xlsx']);
  const sheet = book['xl/worksheets/sheet1.xml'].toString();
  assert.ok(
    sheet.includes('1. أحمد محمد محمود أحمد ★') &&
      sheet.includes('2. سارة خالد حسن علي'),
    'members in order, leader starred'
  );
  assert.ok(
    sheet.includes('<mergeCell ref="E2:E3"/>'),
    'one task cell per team'
  );
  assert.ok(sheet.includes('<v>4230001</v>'), 'a code is a number in Excel');
  assert.ok(
    sheet.includes('>0230003</t>') && !sheet.includes('<v>230003</v>'),
    'unless it starts with 0, which only text keeps'
  );
  const rels = book['xl/worksheets/_rels/sheet1.xml.rels'].toString();
  assert.ok(
    rels.includes('Target="Tasks/01%20-%20Task%201.pptx"'),
    'the task opens the saved copy'
  );
  assert.ok(
    rels.includes(
      `Target="https://docs.google.com/presentation/d/${ID('c')}/edit"`
    ),
    'a task that was not saved opens in Drive'
  );
  assert.ok(
    book['xl/worksheets/sheet2.xml'].toString().includes('Too big'),
    'a second sheet says what was not downloaded and why'
  );
});

test('Download: a project folder comes with its subfolders, over as many requests as it needs', () => {
  const w = boot();
  const f = w.make('team_registration', 'Database Projects');
  const top = w.drive.addFolder({ id: ID('f'), name: 'Library_System' });
  const sub = w.drive.addFolder({ name: 'Diagrams', parent: top });
  w.drive.addFile({ name: 'Report', mime: DOC, parent: top });
  w.drive.addFile({
    name: 'erd.png',
    mime: 'image/png',
    bytes: 'PNG',
    parent: sub
  });
  for (let i = 0; i < 45; i++)
    w.drive.addFile({
      name: `scan ${i}.jpg`,
      mime: 'image/jpeg',
      bytes: 'JPG' + i,
      parent: top
    });
  w.drive.addFile({
    name: 'Form',
    mime: 'application/vnd.google-apps.form',
    parent: top
  });
  assert.equal(
    w.api({
      action: 'submit',
      slug: f.slug,
      data: person('4230001', {
        title: 'Library System',
        link: `https://drive.google.com/drive/folders/${ID('f')}`
      })
    }).ok,
    true
  );
  assert.equal(
    w.api({
      action: 'submit',
      slug: f.slug,
      data: person('4230005', { title: 'Clinic' })
    }).ok,
    true
  );

  const { entries, fin, calls } = download(w, f.slug);
  const base = 'Database Projects/Projects/01 - Library System/';
  assert.ok(calls >= 1, 'a big folder takes more than one request');
  assert.ok(entries[base + 'Report.docx'], 'a Google Doc is exported as Word');
  assert.equal(entries[base + 'Diagrams/erd.png'].toString(), 'PNG');
  assert.equal(
    Object.keys(entries).filter((n) => n.startsWith(base + 'scan')).length,
    45,
    'every file once, none twice'
  );
  assert.deepEqual(fin.failed.map((x) => x.reason).sort(), [
    'No link was given',
    'This kind of Google file cannot be downloaded'
  ]);
  const rels = unzip(entries['Database Projects/Teams.xlsx'])[
    'xl/worksheets/_rels/sheet1.xml.rels'
  ].toString();
  assert.ok(
    rels.includes('Target="Projects/01%20-%20Library%20System/"'),
    'the project opens its folder'
  );
});

test('Download: big downloads are split into parts and the work folder keeps only the zips', () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  for (let i = 0; i < 3; i++) {
    const id = ID(String.fromCharCode(103 + i));
    w.drive.addFile({
      id,
      name: `t${i}.pdf`,
      mime: 'application/pdf',
      bytes: Buffer.alloc(18 * 1024 * 1024, i)
    });
    w.api({
      action: 'submit',
      slug: f.slug,
      data: person('423000' + i, {
        title: 'Task ' + i,
        link: `https://drive.google.com/file/d/${id}/view`
      })
    });
  }
  const { fin, entries, start } = download(w, f.slug);
  assert.equal(fin.parts, 2);
  assert.equal(
    Object.keys(entries).filter((n) => n.endsWith('.pdf')).length,
    3
  );
  const kept = [...w.drive.files.entries()]
    .filter(([id, x]) => x.parent === start.job && !w.drive.trashed.has(id))
    .map(([, x]) => x.name);
  assert.deepEqual(kept.sort(), [
    'Tasks - part 1 of 2.zip',
    'Tasks - part 2 of 2.zip'
  ]);
});

test('Download: only the admin, only team forms, and only a download that is still there', () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  const res = w.make('reservation', 'Seminar');
  assert.equal(
    w.admin({ action: 'admin.download.start', slug: f.slug }).error.code,
    'nothing_to_download'
  );
  assert.equal(
    w.admin({ action: 'admin.download.start', slug: res.slug }).error.code,
    'wrong_type'
  );
  w.api({
    action: 'submit',
    slug: f.slug,
    data: person('4230001', {
      title: 'One',
      link: `https://drive.google.com/file/d/${ID('z')}/view`
    })
  });
  assert.equal(
    w.api({ action: 'admin.download.start', slug: f.slug }).error.code,
    'bad_pin'
  );
  const start = w.admin({ action: 'admin.download.start', slug: f.slug });
  assert.equal(
    w.admin({
      action: 'admin.download.chunk',
      slug: f.slug,
      job: start.job,
      file: ID('z')
    }).error.code,
    'bad_part',
    'only the zips of this download can be read'
  );
  const again = w.admin({ action: 'admin.download.start', slug: f.slug });
  assert.ok(
    w.drive.trashed.has(start.job),
    'a new download replaces the older one'
  );
  w.setNow(w.nowMs + 7 * 3600 * 1000);
  assert.equal(
    w.admin({
      action: 'admin.download.team',
      slug: f.slug,
      job: again.job,
      ref: start.teams[0].ref
    }).error.code,
    'download_gone'
  );
});

test('Deadline: a task cannot be changed or cancelled after the form closes, until it opens again', () => {
  const w = boot();
  const f = w.make('task_submission', 'Tasks');
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: { closesAt: '2027-09-02T10:00:00Z' }
  });
  const data = person('4230001', {
    title: 'Normalization',
    link: `https://drive.google.com/file/d/${ID('a')}/view`
  });
  const r = w.api({ action: 'submit', slug: f.slug, data });
  w.setNow('2027-09-03T10:00:00Z');
  const seen = w.api({ action: 'lookup', slug: f.slug, key: r.key });
  assert.equal(seen.ok, true, 'the key still opens the task');
  assert.deepEqual(
    [seen.locked, seen.canEdit, seen.canDelete],
    [true, false, false]
  );
  assert.equal(
    w.api({
      action: 'update',
      slug: f.slug,
      key: r.key,
      data: { ...data, title: 'Late swap' }
    }).error.code,
    'deadline_passed'
  );
  assert.equal(
    w.api({ action: 'remove', slug: f.slug, key: r.key }).error.code,
    'deadline_passed'
  );
  w.admin({
    action: 'admin.forms.update',
    id: f.id,
    patch: { closesAt: '2027-09-10T10:00:00Z' }
  });
  assert.equal(
    w.api({
      action: 'update',
      slug: f.slug,
      key: r.key,
      data: { ...data, title: 'Fixed in time' }
    }).ok,
    true,
    'opening it again lifts the lock'
  );

  const team = w.make('team_registration', 'Projects');
  w.admin({
    action: 'admin.forms.update',
    id: team.id,
    patch: { closesAt: '2027-09-04T10:00:00Z' }
  });
  const t = w.api({
    action: 'submit',
    slug: team.slug,
    data: person('4230009', { title: 'Library' })
  });
  w.setNow('2027-09-05T10:00:00Z');
  assert.equal(
    w.api({ action: 'lookup', slug: team.slug, key: t.key }).locked,
    false,
    'only task forms lock at the deadline'
  );
});
