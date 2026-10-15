const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSource,
  compile
} = require('../../../../scripts/checks/code/check-layers.js');

const RULES = compile(
  [
    {
      files: '^backend/platform/',
      mayNotUse: '^backend/features/',
      why: 'platform reads no feature'
    },
    {
      files: '\\.controller\\.js$',
      mayNotUse: '\\.repository\\.js$',
      why: 'ask the service'
    }
  ],
  [
    'backend/platform/sheets/table.js',
    'backend/features/catalog/forms/forms.repository.js',
    'backend/features/catalog/forms/forms.service.js',
    'backend/features/catalog/forms/forms.controller.js'
  ]
);

const problems = (file, source) =>
  checkSource(file, source, RULES).map((f) => `${f.line} ${f.message}`);

test('Layer check: a forbidden namespace read is found with its file', () => {
  const file = 'backend/features/catalog/forms/forms.controller.js';
  assert.deepEqual(problems(file, 'FormsRepository.readForms();\n'), [
    '1 FormsRepository is in backend/features/catalog/forms/' +
      'forms.repository.js; ask the service'
  ]);
  assert.deepEqual(
    problems('backend/platform/sheets/table.js', 'FormsService.save();\n'),
    [
      '1 FormsService is in backend/features/catalog/forms/' +
        'forms.service.js; platform reads no feature'
    ]
  );
});

test('Layer check: allowed reads and other files pass', () => {
  const controller = 'backend/features/catalog/forms/forms.controller.js';
  assert.deepEqual(problems(controller, 'FormsService.save(Table.x);\n'), []);
  assert.deepEqual(
    problems(
      'backend/features/catalog/forms/forms.service.js',
      'FormsRepository.readForms();\n'
    ),
    []
  );
  assert.deepEqual(
    problems('backend/platform/sheets/table.js', 'Lock.withLock();\n'),
    []
  );
});
