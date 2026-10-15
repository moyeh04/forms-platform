const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const {
  ID,
  boot,
  openAdmin,
  person,
  member,
  submit
} = require('../harness/admin-page.js');

test(
  'Responses: each team is its own tinted block with a leader star and ' +
    'a linked task',
  async () => {
    const w = boot();
    const f = w.make('task_submission', 'Tasks');
    const link = (c) => `https://docs.google.com/presentation/d/${ID(c)}/edit`;
    submit(
      w,
      f,
      person({
        title: 'Alpha',
        link: link('a'),
        members: [member('سارة خالد حسن علي', '4230002')]
      })
    );
    submit(
      w,
      f,
      person({
        leader_code: '4230010',
        leader_name: 'عمر يوسف إبراهيم سعيد',
        title: 'Beta',
        link: link('b'),
        members: [
          member('منى أشرف كمال فؤاد', '4230011'),
          member('كريم هشام عادل نصر', '4230012')
        ]
      })
    );
    submit(
      w,
      f,
      person({
        leader_code: '4230020',
        leader_name: 'ياسر محمود عادل سمير',
        title: 'Gamma',
        link: link('c'),
        members: []
      })
    );
    const p = await openAdmin(w, `#/f/${f.slug}`);
    const blocks = p.$$('.block');
    assert.equal(blocks.length, 3);
    assert.deepEqual(
      blocks.map((b) => (b.classList.contains('tint-a') ? 'a' : 'b')),
      ['a', 'b', 'a'],
      'neighbouring teams alternate tints'
    );
    assert.deepEqual(
      blocks.map((b) => b.querySelectorAll('.mini tbody tr').length),
      [2, 3, 1]
    );
    assert.ok(blocks[0].querySelector('tr.leader .icon-star'));
    assert.equal(
      blocks[0].querySelector('.block-side a').getAttribute('href'),
      link('a')
    );
    assert.ok(
      blocks[0]
        .querySelectorAll('.mini thead th')[2]
        .textContent.includes('Section')
    );
    assert.ok(p.text().includes('3Total') || p.text().includes('Total'));
    assert.equal(
      p.$('[data-stat="people"]').textContent,
      '6People',
      'three teams of 2, 3 and 1'
    );
  }
);

test(
  'Responses: small teams are listed by ' + 'level and marked on their card',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const team = (code, title, codes) => {
      w.advanceDays(0.01);
      submit(
        w,
        f,
        person({
          leader_code: code,
          title,
          members: codes.map((c) => member('سارة خالد حسن علي', c))
        })
      );
    };
    team('4230001', 'Alpha', []);
    team('4230002', 'Beta', ['4230011', '4230012']);
    team('4230003', 'Gamma', ['4230013', '4230014', '4230015', '4230016']);
    let p = await openAdmin(w, `#/f/${f.slug}`);
    assert.equal(
      p.$('.size-alerts'),
      null,
      'nothing until a warning is switched on'
    );
    assert.equal(p.$('[name="size-tag"]'), null);

    w.admin({
      action: 'admin.forms.update',
      id: f.id,
      patch: {
        rules: {
          sizeAlerts: {
            critical: { on: true, below: 3 },
            warning: { on: true, below: 5 }
          }
        }
      }
    });
    p = await openAdmin(w, `#/f/${f.slug}`);
    assert.equal(
      p.$('.requests [name="size-alert-critical"]').textContent,
      'Critical: one team has fewer than 3 people: Team 1.'
    );
    assert.equal(
      p.$('.requests [name="size-alert-warning"]').textContent,
      'Warning: one team has fewer than 5 people: Team 2.'
    );
    assert.deepEqual(
      p.$$('.team-card').map((c) => {
        const t = c.querySelector('[name="size-tag"]');
        return t ? t.textContent : '';
      }),
      ['Critical', 'Warning', '']
    );
  }
);

test(
  'Responses: People counts a student ' + 'once however many tasks name them',
  async () => {
    const w = boot();
    const tasks = w.make('task_submission', 'Tasks', {
      rules: {
        uniqueBy: '',
        uniqueAcrossForm: false,
        driveCheck: 'off',
        maxSubmissions: null,
        teamSize: { min: 1, max: 5 }
      }
    });
    const link = `https://docs.google.com/presentation/d/${ID('a')}/edit`;
    assert.equal(
      submit(
        w,
        tasks,
        person({
          title: 'Task 1',
          link,
          members: [member('سارة خالد حسن علي', '4230002')]
        })
      ).ok,
      true
    );
    assert.equal(
      submit(
        w,
        tasks,
        person({
          title: 'Task 2',
          link,
          members: [
            member('سارة خالد حسن علي', '4230002'),
            member('منى أشرف كمال فؤاد', '4230003')
          ]
        })
      ).ok,
      true
    );
    const p = await openAdmin(w, `#/f/${tasks.slug}`);
    assert.equal(p.$$('.block').length, 2);
    assert.equal(
      p.$('[data-stat="people"]').textContent,
      '3People',
      'the same three students handed in two tasks'
    );
    p.type('[name="search"]', 'Task 2');
    await settle(2);
    assert.equal(
      p.$('[data-stat="people"]').textContent,
      '3People',
      'the count is of the form, not of the search'
    );
  }
);

test(
  'Responses: a team card shows the number the team was given, also ' +
    'after a cancel and in a search',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects', {
      rules: { teamSize: { min: 1, max: 3 } }
    });
    ['Alpha', 'Beta', 'Gamma'].forEach((title, i) => {
      w.advanceDays(0.01);
      submit(w, f, person({ leader_code: '423000' + (i + 1), title }));
    });
    const beta = w.admin({ action: 'admin.submissions', slug: f.slug })
      .submissions[1];
    w.admin({
      action: 'admin.submission.delete',
      slug: f.slug,
      submissionId: beta.id
    });
    const p = await openAdmin(w, '#/f/' + f.slug);
    assert.deepEqual(
      p.$$('.team-no').map((n) => n.textContent),
      ['Team 1', 'Team 3']
    );
    p.type('[name="search"]', 'gamma');
    await settle(2);
    assert.deepEqual(
      p.$$('.team-no').map((n) => n.textContent),
      ['Team 3'],
      'a search does not renumber'
    );
  }
);

test(
  'Responses: search narrows the list ' + 'and a status change is saved',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    submit(w, f, person({ title: 'Alpha', members: [] }));
    submit(
      w,
      f,
      person({ leader_code: '4230020', title: 'Beta', members: [] })
    );
    const p = await openAdmin(w, `#/f/${f.slug}`);
    p.type('[name="search"]', 'beta');
    assert.equal(p.$$('.block').length, 1);
    assert.ok(p.$('.block').textContent.includes('Beta'));
    const sel = p.$('.block select');
    sel.value = 'approved';
    p.fire(sel, 'change');
    await settle(8);
    const row = w
      .admin({ action: 'admin.submissions', slug: f.slug })
      .submissions.find((s) => s.title === 'Beta');
    assert.equal(row.status, 'approved');
  }
);

test(
  'Responses: details open, and resetting a key gives a new one and ' +
    'kills the old one',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const first = submit(w, f, person({ title: 'Alpha', members: [] }));
    const p = await openAdmin(w, `#/f/${f.slug}`);
    p.click('[name="details"]');
    await settle(2);
    assert.ok(p.$('.dialog').textContent.includes('TR-2027-0001'));
    p.clickText('Reset key', p.$('.dialog'));
    await settle(8);
    const fresh = p.$('.key-reveal').textContent;
    assert.match(fresh, /^\d{5}$/);
    assert.equal(
      w.api({ action: 'lookup', slug: f.slug, key: first.key }).error.code,
      'bad_key'
    );
    assert.equal(
      w.api({ action: 'lookup', slug: f.slug, key: fresh }).ok,
      true
    );
  }
);

test(
  'WhatsApp: paste requests, see matches beside the registration, and ' +
    'approve',
  async () => {
    const w = boot();
    const f = w.make('whatsapp_registration', 'Groups');
    w.api({
      action: 'submit',
      slug: f.slug,
      data: {
        email: 'a@b.com',
        name: 'أحمد محمد محمود أحمد',
        phone: '01012345678',
        code: '4230999',
        level: 'صفر / الأولى',
        major: 'حاسبات',
        group: 'A',
        section: '21',
        schedule: `https://drive.google.com/file/d/${ID('s')}/view`
      }
    });
    const p = await openAdmin(w, `#/f/${f.slug}`);
    assert.ok(p.$('.split'), 'split screen is the default');
    p.type(
      '[name="paste"]',
      'Sara Ali +20 10 1234 5678\nStranger 01155555555\nno number here'
    );
    p.click('[name="import"]');
    await settle(12);
    const reqs = p.$$('.req');
    assert.equal(reqs.length, 2);
    assert.ok(reqs[0].textContent.includes('Matched'));
    assert.ok(reqs[1].textContent.includes('No match'));
    p.click(reqs[0]);
    await settle(2);
    assert.ok(p.$('.detail').textContent.includes('4230999'));
    assert.ok(p.$('iframe.preview').getAttribute('src').includes(ID('s')));
    p.click('[name="approve"]');
    await settle(12);
    assert.ok(
      p.text().includes('Finish "Timetable check" first'),
      'step 2 waits for step 1'
    );
    assert.equal(
      w.admin({ action: 'admin.submissions', slug: f.slug }).submissions[0]
        .review.group,
      'pending'
    );

    const step1 = p.$('.detail select[aria-label^="Timetable check"]');
    step1.value = 'approved';
    p.fire(step1, 'change');
    await settle(10);
    p.click('[name="approve"]');
    await settle(12);
    const sub = w.admin({ action: 'admin.submissions', slug: f.slug })
      .submissions[0];
    assert.deepEqual(sub.review, { schedule: 'approved', group: 'approved' });
    p.click('[data-filter="approved"]');
    await settle(2);
    assert.equal(p.$$('.req').length, 1);
  }
);

test(
  'Details: the admin can show a student key and the email switch is ' +
    'saved',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const r = submit(w, f, person({ title: 'Library System', members: [] }));
    const p = await openAdmin(w, `#/f/${f.slug}`);
    p.click('[name="details"]');
    await settle(2);
    p.click('[name="show-key"]');
    await settle(6);
    assert.equal(p.$('.key-inline').textContent, r.key);
    const q = await openAdmin(w, `#/f/${f.slug}/settings`);
    const box = q.$('[name="confirmEmail"]');
    box.checked = false;
    q.fire(box, 'change');
    q.click('[name="save"]');
    await settle(12);
    assert.equal(
      w.admin({ action: 'admin.forms.get', id: f.id }).form.notifications
        .confirmEmail,
      false
    );
  }
);

test(
  'Responses and clients: list rows carry their column names, and the ' +
    'day sheet controls are one group',
  async () => {
    const w = boot();
    const groups = w.admin({
      action: 'admin.forms.create',
      type: 'whatsapp_registration',
      title: 'Groups',
      batchYear: '2028/2029'
    }).form;
    w.admin({
      action: 'admin.forms.update',
      id: groups.id,
      patch: { status: 'open' }
    });
    w.api({
      action: 'submit',
      slug: groups.slug,
      data: {
        email: 'a@b.com',
        name: 'أحمد محمد محمود أحمد',
        phone: '01012345678',
        code: '4230001',
        level: 'صفر / الأولى',
        major: 'حاسبات',
        group: 'A',
        section: '21',
        schedule: 'https://drive.google.com/file/d/' + 't'.repeat(33) + '/view'
      }
    });
    const list = await openAdmin(w, `#/f/${groups.slug}`);
    list.clickText('All registrations');
    await settle(6);
    const labels = list
      .$$('.data-table.cards tbody tr:first-child td[data-label]')
      .map((c) => c.dataset.label);
    assert.deepEqual(labels.slice(0, 5), [
      'Code',
      'Phone',
      'Group',
      'Section',
      'Timetable'
    ]);
    assert.equal(labels[labels.length - 1], 'Status');

    w.admin({
      action: 'admin.clients.create',
      name: 'Dr. Ahmed',
      forms: [groups.slug],
      withKey: false
    });
    const clients = await openAdmin(w, '#/clients');
    assert.deepEqual(
      clients
        .$$('.data-table.cards tbody td[data-label]')
        .map((c) => c.dataset.label),
      [
        'Can see',
        'Hidden columns',
        'Can review',
        'Small teams',
        'Progress',
        'Link',
        'Access key'
      ]
    );

    const seminar = w.admin({
      action: 'admin.forms.create',
      type: 'reservation',
      title: 'Seminar',
      term: 'Fall 2027'
    }).form;
    assert.equal(
      (await openAdmin(w, `#/f/${seminar.slug}`)).$('.tool-group'),
      null,
      'no day sheet to print while the form has no days'
    );
    w.admin({
      action: 'admin.forms.update',
      id: seminar.id,
      patch: {
        slots: {
          days: [{ label: 'Sunday', times: ['12:30 - 12:50'] }],
          capacity: 1
        }
      }
    });
    const res = await openAdmin(w, `#/f/${seminar.slug}`);
    const group = res.$('.tool-group');
    assert.equal(group.getAttribute('aria-label'), 'Print a day sheet');
    assert.ok(
      group.querySelector('select') &&
        group.querySelector('[name="printDay"]') &&
        group.querySelector('input[type="checkbox"]')
    );
  }
);

test(
  'Responses: a registration shows when its key ends and extends it ' + 'alone',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    submit(w, f, person({ leader_code: '4230001', title: 'Old', members: [] }));
    submit(
      w,
      f,
      person({ leader_code: '4230002', title: 'Library', members: [] })
    );
    const before = w.admin({ action: 'admin.keys.list', slug: f.slug }).keys;
    const p = await openAdmin(w, '#/f/' + f.slug + '/responses');
    p.clickText('Details', p.$('[data-ref="' + before[0].ref + '"]'));
    await settle(4);
    assert.ok(p.$('.detail').textContent.includes('Key works'));
    p.click('[name="extend-key"]');
    await settle(8);
    assert.equal(p.$('[name="which-all"]'), null, 'only this registration');
    p.click('[name="extend-3"]');
    await settle(1);
    p.click('[name="extend-go"]');
    await settle(10);
    const after = w.admin({ action: 'admin.keys.list', slug: f.slug }).keys;
    assert.equal(
      Date.parse(after[0].keyExpires) - Date.parse(before[0].keyExpires),
      3 * 86400000
    );
    assert.equal(after[1].keyExpires, before[1].keyExpires);
    assert.ok(
      p.$('.detail').textContent.includes(
        new Date(after[0].keyExpires).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      ),
      'the details show the new end'
    );
  }
);

test(
  'Responses: Download all saves every task, shows what was not ' +
    'downloaded, and saves the zip',
  async () => {
    const w = boot();
    const f = w.make('task_submission', 'Tasks', {
      rules: { driveCheck: 'off' }
    });
    w.drive.addFile({
      id: ID('a'),
      name: 'clean.pdf',
      mime: 'application/pdf',
      bytes: '%PDF'
    });
    submit(
      w,
      f,
      person({
        leader_code: '4230001',
        title: 'Task 1',
        link: `https://drive.google.com/file/d/${ID('a')}/view`,
        members: []
      })
    );
    submit(
      w,
      f,
      person({
        leader_code: '4230002',
        title: 'Forms',
        link: `https://drive.google.com/file/d/${ID('b')}/view`,
        members: []
      })
    );
    w.drive.addFile({
      id: ID('b'),
      name: 'Quiz',
      mime: 'application/vnd.google-apps.form'
    });
    w.fetch = (url, opts) => {
      const [, from, to] = /bytes=(\d+)-(\d+)/
        .exec(opts.headers.Range)
        .map(Number);
      const buf = w.drive.files
        .get(/files\/([\w-]+)\?/.exec(url)[1])
        .buf.slice(from, to + 1);
      return { getResponseCode: () => 206, getContent: () => Array.from(buf) };
    };
    const p = await openAdmin(w, '#/f/' + f.slug + '/responses');
    const saved = [];
    p.win.URL.createObjectURL = (blob) => {
      saved.push(blob);
      return 'blob:zip';
    };
    p.win.URL.revokeObjectURL = () => {};
    p.win.HTMLAnchorElement.prototype.click = function () {};
    p.click('[name="download-all"]');
    await settle(2);
    p.click('[name="download-start"]');
    await settle(30);
    assert.ok(p.$('.dialog').textContent.includes('1 file packed'));
    assert.ok(
      p.$('.download-missed').textContent.includes('cannot be downloaded'),
      'the reason is shown with the item'
    );
    p.click('[name="save-part-0"]');
    await settle(12);
    assert.equal(saved.length, 1);
    assert.ok(saved[0].size > 100, 'the whole zip is handed to the browser');
  }
);

test(
  'Responses: Download all is ' + 'not offered before anyone registers',
  async () => {
    const w = boot();
    const f = w.make('team_registration', 'Projects');
    const p = await openAdmin(w, '#/f/' + f.slug + '/responses');
    assert.equal(p.$('[name="download-all"]'), null);
  }
);
