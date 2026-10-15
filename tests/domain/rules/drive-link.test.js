const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Drive links: files, folders and slides; other hosts refused', () => {
  const id = 'a'.repeat(33);
  assert.deepEqual(
    [
      R.parseDriveLink(`https://drive.google.com/file/d/${id}/view?usp=sharing`)
        .kind,
      R.parseDriveLink(`https://drive.google.com/drive/u/0/folders/${id}`).kind,
      R.parseDriveLink(`https://docs.google.com/presentation/d/${id}/edit`)
        .kind,
      R.parseDriveLink(`https://drive.google.com/open?id=${id}`).kind
    ],
    ['file', 'folder', 'slides', 'file']
  );
  assert.equal(R.parseDriveLink(`https://example.com/file/d/${id}`).ok, false);
  assert.equal(
    R.validateDriveLink(`https://drive.google.com/file/d/${id}/view`, {
      kinds: ['folder']
    }).error,
    'link_kind'
  );
  assert.equal(R.validateDriveLink('not a link').error, 'invalid_link');
});

test('Folder names: no spaces, three parts, ending with the subject', () => {
  const SE = { subject: 'Software Engineering' };
  assert.equal(
    R.checkFolderName('Ahmed_Mohamed_Library_System_Software_Engineering', SE)
      .ok,
    true
  );
  assert.equal(
    R.checkFolderName('ahmed_library_software_engineering', SE).ok,
    true,
    'case does not matter'
  );
  assert.equal(
    R.checkFolderName('Ahmed Library_System_Software_Engineering', SE).error,
    'folder_name_spaces'
  );
  assert.equal(
    R.checkFolderName('Ahmed_Software_Engineering', SE).error,
    'folder_name_format',
    'needs the leader name and project before the subject name'
  );
  assert.equal(
    R.checkFolderName('Ahmed__Library_Software_Engineering', {}).error,
    'folder_name_format',
    'no empty parts'
  );
  assert.equal(
    R.checkFolderName('Ahmed_Library_System_CMPn323', SE).error,
    'folder_name_subject',
    'the code is not the subject name'
  );
  assert.equal(
    R.checkFolderName('Ahmed_Library_System_Anything', {}).ok,
    true,
    'without a subject name any ending is fine'
  );
  assert.equal(
    R.folderNameExample({
      project: 'Library System',
      subject: 'Software Engineering'
    }),
    'Ahmed_Mohamed_Library_System_Software_Engineering'
  );
  assert.equal(
    R.folderNameExample({ project: 'Library System' }),
    'Ahmed_Mohamed_Library_System_Subject_Name'
  );
  assert.equal(
    R.checkFolderName('My Folder', {
      subject: 'Databases',
      example: { project: 'Smart Parking' }
    }).params.example,
    'Ahmed_Mohamed_Smart_Parking_Databases'
  );
});
