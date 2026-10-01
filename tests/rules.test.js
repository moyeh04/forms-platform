const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../shared/rules.js');

test('Arabic names: accepts four Arabic parts and strips diacritics', () => {
  const ok = R.validateArabicName('أحمد محمد محمود أحمد');
  assert.equal(ok.ok, true);
  assert.equal(R.validateArabicName('أَحْمَد  مُحَمَّد مَحمود أحمد').value, 'أحمد محمد محمود أحمد');
});

test('Arabic names: rejects English letters, digits and short names', () => {
  assert.equal(R.validateArabicName('Ahmed Mohamed Mahmoud Ahmed').error, 'arabic_only');
  assert.equal(R.validateArabicName('أحمد محمد 123 أحمد').error, 'arabic_only');
  assert.equal(R.validateArabicName('أحمد محمد محمود').error, 'arabic_parts');
  assert.equal(R.validateArabicName('أحمد محمد محمود', { minParts: 3 }).ok, true);
  assert.equal(R.validateArabicName('   ').error, 'required');
});

test('Arabic names: live cleaning keeps trailing space while typing', () => {
  const live = R.cleanArabicName('أحمد ABC محمد ', false);
  assert.equal(live.blocked, true);
  assert.equal(live.value, 'أحمد محمد ');
  assert.equal(R.cleanArabicName('أحمد ', true).value, 'أحمد');
});

test('English text: rejects Arabic letters', () => {
  assert.equal(R.validateEnglishText('Library System').ok, true);
  assert.equal(R.validateEnglishText('نظام المكتبة').error, 'english_only');
  assert.equal(R.validateEnglishText('A').error, 'too_short');
});

test('Phones: every Egyptian format maps to 01XXXXXXXXX', () => {
  ['01012345678', '+201012345678', '00201012345678', '201012345678', '1012345678', '+20 10 1234 5678', '٠١٠١٢٣٤٥٦٧٨']
    .forEach((p) => assert.equal(R.normalizePhone(p), '01012345678', p));
  assert.equal(R.normalizePhone('01312345678'), '');
  assert.equal(R.normalizePhone('12345'), '');
});

test('Phones: extracts numbers from pasted WhatsApp lines', () => {
  const found = R.extractPhones('Sara Ali +20 10 1234 5678');
  assert.equal(found.length, 1);
  assert.equal(found[0].phone, '01012345678');
  assert.equal(R.extractPhones('no number here').length, 0);
});

test('Codes: seven digits by default', () => {
  assert.equal(R.validateCode('4230999').ok, true);
  assert.equal(R.validateCode('٤٢٣٠٩٩٩').value, '4230999');
  assert.equal(R.validateCode('42309').error, 'invalid_code');
  assert.equal(R.validateCode('42A0999').error, 'invalid_code');
});

test('Drive links: recognises files, folders, slides and rejects other hosts', () => {
  const id = 'a'.repeat(33);
  assert.deepEqual(
    [R.parseDriveLink(`https://drive.google.com/file/d/${id}/view?usp=sharing`).kind,
      R.parseDriveLink(`https://drive.google.com/drive/u/0/folders/${id}`).kind,
      R.parseDriveLink(`https://docs.google.com/presentation/d/${id}/edit`).kind,
      R.parseDriveLink(`https://drive.google.com/open?id=${id}`).kind],
    ['file', 'folder', 'slides', 'file']
  );
  assert.equal(R.parseDriveLink(`https://example.com/file/d/${id}`).ok, false);
  assert.equal(R.validateDriveLink(`https://drive.google.com/file/d/${id}/view`, { kinds: ['folder'] }).error, 'link_kind');
  assert.equal(R.validateDriveLink('not a link').error, 'invalid_link');
});

test('Slots: generator reproduces the old seminar timetable style', () => {
  const slots = R.generateSlots({ start: '12:30', end: '15:30', length: 20, gap: 5 });
  assert.deepEqual(slots.slice(0, 3), ['12:30 - 12:50', '12:55 - 1:15', '1:20 - 1:40']);
  assert.equal(R.generateSlots({ start: '10:00', end: '09:00', length: 10 }).length, 0);
  assert.deepEqual(R.generateSlots({ start: '13:00', end: '13:40', length: 20, style: '24h' }), ['13:00 - 13:20', '13:20 - 13:40']);
});

const teamForm = {
  fields: [
    { id: 'email', type: 'email', role: 'email' },
    { id: 'leader_name', type: 'arabic_name', role: 'name' },
    { id: 'leader_code', type: 'code', role: 'code' },
    { id: 'phone', type: 'phone', role: 'phone' },
    { id: 'level', type: 'select', options: [{ value: 'a' }, { value: 'b' }] },
    { id: 'members', type: 'members', role: 'members', max: 2, fields: [
      { id: 'name', type: 'arabic_name', role: 'name' },
      { id: 'code', type: 'code', role: 'code' }
    ] },
    { id: 'title', type: 'english_text', role: 'title' }
  ]
};
const base = () => ({
  email: 'A@B.com', leader_name: 'أحمد محمد محمود أحمد', leader_code: '4230999', phone: '+201012345678',
  level: 'a', members: [{ name: 'سارة خالد حسن علي', code: '4230998' }], title: 'Library System'
});

test('Submission: valid data is cleaned', () => {
  const r = R.validateSubmission(teamForm, base());
  assert.equal(r.ok, true);
  assert.equal(r.data.email, 'a@b.com');
  assert.equal(r.data.phone, '01012345678');
});

test('Submission: reports field and nested member errors', () => {
  const d = base();
  d.leader_name = 'Ahmed';
  d.members = [{ name: 'سارة', code: '1' }];
  const r = R.validateSubmission(teamForm, d);
  assert.equal(r.ok, false);
  assert.equal(r.errors.leader_name.error, 'arabic_only');
  assert.equal(r.errors.members.nested['0.name'].error, 'arabic_parts');
  assert.equal(r.errors.members.nested['0.code'].error, 'invalid_code');
});

test('Submission: blocks the same code twice and too many members', () => {
  const d = base();
  d.members = [{ name: 'سارة خالد حسن علي', code: '4230999' }];
  assert.equal(R.validateSubmission(teamForm, d).errors.members.nested['0.code'].error, 'duplicate_code');
  d.members = [1, 2, 3].map((n) => ({ name: 'سارة خالد حسن علي', code: '423099' + n }));
  assert.equal(R.validateSubmission(teamForm, d).errors.members.error, 'too_many_members');
});

test('Helpers: members list, role lookup and form state', () => {
  const list = R.membersOf(teamForm, R.validateSubmission(teamForm, base()).data);
  assert.equal(list.length, 2);
  assert.equal(list[0].leader, true);
  assert.equal(R.fieldByRole(teamForm, 'title').id, 'title');
  const now = Date.parse('2027-09-01T00:00:00Z');
  assert.equal(R.formState({ status: 'open' }, now), 'open');
  assert.equal(R.formState({ status: 'open', opensAt: '2027-10-01T00:00:00Z' }, now), 'not_yet');
  assert.equal(R.formState({ status: 'open', closesAt: '2027-08-01T00:00:00Z' }, now), 'closed');
  assert.equal(R.formState({ status: 'draft' }, now), 'draft');
});

test('Slot validation: day and time must exist on the form', () => {
  const form = { slots: { days: [{ id: 'w1', times: ['1:00 - 1:10'] }] } };
  const f = { id: 'slot', type: 'slot' };
  assert.equal(R.validateField(f, { day: 'w1', time: '1:00 - 1:10' }, { form }).ok, true);
  assert.equal(R.validateField(f, { day: 'w1', time: '9:00 - 9:10' }, { form }).error, 'invalid_slot');
  assert.equal(R.validateField(f, null, { form }).error, 'required');
});

test('Submission: disabled fields are skipped, including inside members', () => {
  const form = {
    fields: [
      { id: 'a', type: 'text' },
      { id: 'link', type: 'drive_link', enabled: false },
      { id: 'members', type: 'members', max: 2, fields: [{ id: 'name', type: 'text' }, { id: 'extra', type: 'code', enabled: false }] }
    ]
  };
  const r = R.validateSubmission(form, { a: 'x', members: [{ name: 'y' }] });
  assert.equal(r.ok, true);
  assert.equal('link' in r.data, false);
});

test('Folder names: Team_Leader_Name_Project_Name_Subject, no spaces, ending with the subject', () => {
  assert.equal(R.checkFolderName('Ahmed_Library_System_CMPn323', { subject: 'CMPn323' }).ok, true);
  assert.equal(R.checkFolderName('ahmed_library_cmpn323', { subject: 'CMPn323' }).ok, true, 'case does not matter');
  assert.equal(R.checkFolderName('Ahmed Library_System_CMPn323', { subject: 'CMPn323' }).error, 'folder_name_spaces');
  assert.equal(R.checkFolderName('Ahmed_CMPn323', { subject: 'CMPn323' }).error, 'folder_name_format', 'needs name, project and subject');
  assert.equal(R.checkFolderName('Ahmed__Library_CMPn323', {}).error, 'folder_name_format', 'no empty parts');
  assert.equal(R.checkFolderName('Ahmed_Library_System_Database', { subject: 'CMPn323' }).error, 'folder_name_subject');
  assert.equal(R.checkFolderName('Ahmed_Library_System_Anything', {}).ok, true, 'without a subject any ending is fine');
  assert.equal(R.folderNameExample({ project: 'Library System', subject: 'CMPn323' }), 'Ahmed_Mohamed_Library_System_CMPn323');
  assert.equal(R.checkFolderName('My Folder', { subject: 'DB', example: { project: 'Smart Parking' } }).params.example, 'Ahmed_Mohamed_Smart_Parking_DB');
});
