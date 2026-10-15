const test = require('node:test');
const assert = require('node:assert/strict');
const { settle } = require('../harness/dom.js');
const { boot, openAdmin } = require('../harness/admin-page.js');

test(
  'Clients: create a private link, see it once, and it opens the ' +
    'instructor view',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, '#/clients');
    p.click('[name="newClient"]');
    await settle(2);
    p.type('[name="clientName"]', 'Dr. Ahmed');
    const all = p
      .$$('.dialog .check')
      .find((l) => l.textContent.includes('All forms'))
      .querySelector('input');
    all.checked = true;
    p.fire(all, 'change');
    const phone = p
      .$$('.dialog .check')
      .find((l) => l.textContent === 'Phone')
      .querySelector('input');
    phone.checked = true;
    p.fire(phone, 'change');
    assert.equal(
      p.$('[name="withKey"]').checked,
      true,
      'a new link asks for a key unless unticked'
    );
    const key = p.$('[name="withKey"]');
    key.checked = false;
    p.fire(key, 'change');
    assert.equal(
      p.$('[name="showSizeAlerts"]').checked,
      true,
      'a new link shows the warnings about small teams unless unticked'
    );
    const alerts = p.$('[name="showSizeAlerts"]');
    alerts.checked = false;
    p.fire(alerts, 'change');
    p.clickText('Create link', p.$('.dialog'));
    await settle(10);
    const link = p.$('.link-box code').textContent;
    assert.equal(p.$('[name="access-key"]'), null, 'no key was made');
    assert.ok(link.includes('viewer.html?t='));
    const token = new URL(link).searchParams.get('t');
    const me = w.api({ action: 'viewer.me', token });
    assert.equal(me.client.name, 'Dr. Ahmed');
    assert.deepEqual(
      me.forms.map((x) => x.slug),
      [f.slug]
    );
    assert.deepEqual(
      w.admin({ action: 'admin.clients.list' }).clients[0].hiddenColumns,
      ['phone']
    );
    assert.equal(
      w.admin({ action: 'admin.clients.list' }).clients[0].showSizeAlerts,
      false
    );
  }
);

test(
  'Clients: a link with an access key shows the link once and the key ' +
    'apart, and the key can be changed or removed',
  async () => {
    const w = boot();
    w.make('reservation', 'Seminar');
    const p = await openAdmin(w, '#/clients');
    p.click('[name="newClient"]');
    await settle(2);
    p.type('[name="clientName"]', 'Dr. Ahmed');
    const all = p
      .$$('.dialog .check')
      .find((l) => l.textContent.includes('All forms'))
      .querySelector('input');
    all.checked = true;
    p.fire(all, 'change');
    p.clickText('Create link', p.$('.dialog'));
    await settle(10);
    const key = p.$('[name="access-key"]').textContent;
    assert.match(key, /^\d{6}$/);
    const token = new URL(p.$('.link-box code').textContent).searchParams.get(
      't'
    );
    assert.equal(
      w.api({ action: 'viewer.me', token }).error.code,
      'key_needed',
      'the link alone opens nothing'
    );
    assert.equal(
      w.api({ action: 'viewer.me', token, accessKey: key }).client.name,
      'Dr. Ahmed'
    );
    p.clickText('Done', p.$('.dialog'));
    await settle(8);
    assert.ok(
      p
        .$('[data-client] [data-label="Access key"]')
        .textContent.includes('Asked')
    );

    p.click('[name="new-key"]');
    await settle(2);
    p.clickText('Make new key', p.$('.overlay'));
    await settle(10);
    const fresh = p.$('[name="access-key"]').textContent;
    assert.equal(
      p.$('.dialog .link-box'),
      null,
      'a new key leaves the link as it is'
    );
    assert.equal(
      w.api({ action: 'viewer.me', token, accessKey: key }).error.code,
      'bad_access_key',
      'the old key stops working'
    );
    assert.equal(
      w.api({ action: 'viewer.me', token, accessKey: fresh }).ok,
      true
    );
    p.clickText('Done', p.$('.dialog'));
    await settle(8);
    p.click('[name="remove-key"]');
    await settle(2);
    p.clickText('Remove key', p.$('.overlay'));
    await settle(10);
    assert.equal(
      w.api({ action: 'viewer.me', token }).ok,
      true,
      'without a key the link opens alone'
    );
    assert.ok(
      p
        .$('[data-client] [data-label="Access key"]')
        .textContent.includes('Not asked')
    );
  }
);

test(
  'Clients: the admin sees a lost key again, and a link ends on its ' +
    'date until it is moved',
  async () => {
    const w = boot();
    const f = w.make('reservation', 'Seminar');
    const p = await openAdmin(w, '#/clients');
    p.click('[name="newClient"]');
    await settle(2);
    p.type('[name="clientName"]', 'Dr. Ahmed');
    const box = p
      .$$('.dialog .check')
      .find((l) => l.textContent.includes('Seminar'))
      .querySelector('input');
    box.checked = true;
    p.fire(box, 'change');
    assert.equal(
      p.$('[name="link-end-none"]').getAttribute('aria-pressed'),
      'true',
      'a new link has no end unless one is picked'
    );
    p.click('[name="link-end-date"]');
    await settle(1);
    p.clickText('Create link', p.$('.dialog'));
    await settle(6);
    assert.equal(
      w.admin({ action: 'admin.clients.list' }).clients.length,
      0,
      'no link is made while the date is not picked'
    );
    assert.ok(
      p.$('.dialog .extend-preview').textContent.includes('Pick the date'),
      'the reason is next to the picker'
    );
    p.click('[name="link-end-30"]');
    await settle(1);
    p.clickText('Create link', p.$('.dialog'));
    await settle(10);
    const key = p.$('[name="access-key"]').textContent;
    const token = new URL(p.$('.link-box code').textContent).searchParams.get(
      't'
    );
    p.clickText('Done', p.$('.dialog'));
    await settle(8);
    const made = w.admin({ action: 'admin.clients.list' }).clients[0];
    assert.equal(
      Math.round((Date.parse(made.expires) - Date.now()) / 86400000),
      30
    );
    assert.ok(
      p.$('[data-client] [data-label="Link"]').textContent.includes('Until')
    );

    p.click('[name="show-key"]');
    await settle(8);
    assert.equal(
      p.$('[name="access-key"]').textContent,
      key,
      'the same key, not a new one'
    );
    assert.equal(
      p.$('.dialog .link-box'),
      null,
      'the link itself cannot be shown again'
    );
    p.clickText('Done', p.$('.dialog'));
    await settle(2);

    w.setNow(Date.parse(made.expires) + 86400000);
    p.win.App.admin.render();
    await settle(10);
    assert.equal(
      w.api({ action: 'viewer.me', token, accessKey: key }).error.code,
      'link_expired'
    );
    assert.ok(
      p.$('[data-client] [data-label="Link"]').textContent.includes('Ended')
    );
    p.click('[name="change-end"]');
    await settle(2);
    p.click('[name="link-end-none"]');
    await settle(1);
    p.clickText('Save', p.$('.dialog'));
    await settle(10);
    assert.equal(
      w.api({ action: 'viewer.me', token, accessKey: key }).ok,
      true,
      'moving the end opens the link again'
    );
    assert.ok(
      p
        .$('[data-client] [data-label="Link"]')
        .textContent.includes('No end date')
    );
    assert.ok(f);
  }
);
