/**
 * The rules of Google Drive and Docs links, and of the Drive folder names
 * a team gives its work: Team_Leader_Name_Project_Name_Subject_Name.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var textRules = node ? require('./text.js') : root.RulesText;

  /** The hosts of a Drive or Docs link. */
  var DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];

  /**
   * The ways a link names its file or folder, the first match winning: the
   * id it holds and the kind of thing it opens.
   */
  var LINK_KINDS = [
    { pattern: /\/folders\/([-\w]{20,})/, kind: 'folder' },
    { pattern: /\/presentation\/d\/([-\w]{20,})/, kind: 'slides' },
    { pattern: /\/document\/d\/([-\w]{20,})/, kind: 'doc' },
    { pattern: /\/spreadsheets\/d\/([-\w]{20,})/, kind: 'sheet' },
    { pattern: /\/file\/d\/([-\w]{20,})/, kind: 'file' },
    { pattern: /[?&]id=([-\w]{20,})/, kind: 'file' }
  ];

  /** The parts a folder name needs: leader name, project and subject. */
  var MIN_FOLDER_PARTS = 3;

  /** The parts before the subject: the leader's name and the project. */
  var MIN_HEAD_PARTS = 2;

  /**
   * Reads a Drive or Docs link.
   *
   * @param {*} url The link.
   * @return {!Object} `{ok: true, id, kind, url}`, or `{ok: false}` when it
   *     is not a Drive or Docs link to a file or folder.
   */
  function parseDriveLink(url) {
    var u = String(url == null ? '' : url).trim();
    if (!/^https?:\/\//i.test(u)) return { ok: false };
    var host = (u.match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '';
    if (DRIVE_HOSTS.indexOf(host.toLowerCase()) === -1) return { ok: false };
    var found = { ok: false };
    LINK_KINDS.some(function (k) {
      var m = u.match(k.pattern);
      if (m) found = { ok: true, id: m[1], kind: k.kind, url: u };
      return !!m;
    });
    return found;
  }

  /**
   * Checks a link field, and the kind of thing it opens when the field
   * names the kinds it takes.
   *
   * @param {*} raw The typed link.
   * @param {{kinds: (!Array<string>|undefined)}=} opts The kinds it takes.
   * @return {!Object} `{ok: true, value, meta: {id, kind}}` or
   *     `{ok: false, error, params}`.
   */
  function validateDriveLink(raw, opts) {
    var o = opts || {};
    var kinds = o.kinds || [];
    if (textRules.isEmpty(raw)) return { ok: false, error: 'required' };
    var p = parseDriveLink(raw);
    if (!p.ok) return { ok: false, error: 'invalid_link' };
    if (kinds.length && kinds.indexOf(p.kind) === -1) {
      return {
        ok: false,
        error: 'link_kind',
        params: { kinds: kinds.join(', ') }
      };
    }
    return { ok: true, value: p.url, meta: { id: p.id, kind: p.kind } };
  }

  /**
   * Turns free text into an underscore part: "Library System" becomes
   * "Library_System".
   *
   * @param {*} s The text.
   * @return {string} The part.
   */
  function folderPart(s) {
    return String(s == null ? '' : s)
      .trim()
      .replace(/[^A-Za-z0-9؀-ۿ-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Builds an example of a correct folder name from what the student typed.
   *
   * @param {{name: *, project: *, subject: *}=} o The leader's name, the
   *     project and the subject; a missing one is shown by a placeholder.
   * @return {string} The example.
   */
  function folderNameExample(o) {
    var given = o || {};
    return [
      folderPart(given.name) || 'Ahmed_Mohamed',
      folderPart(given.project) || 'Project_Name',
      folderPart(given.subject) || 'Subject_Name'
    ].join('_');
  }

  /**
   * Finds what is wrong with a folder name, in the order a student fixes it.
   *
   * @param {string} n The trimmed folder name.
   * @param {string} subject The subject name as a part, or ''.
   * @return {string} The error, or '' when the name is right.
   */
  function folderNameError(n, subject) {
    if (/\s/.test(n)) return 'folder_name_spaces';
    var parts = n.split('_');
    var empty = parts.some(function (p) {
      return !p;
    });
    if (parts.length < MIN_FOLDER_PARTS || empty) return 'folder_name_format';
    if (!subject) return '';
    var tail = '_' + subject.toLowerCase();
    if (n.toLowerCase().slice(-tail.length) !== tail) {
      return 'folder_name_subject';
    }
    // The leader's name and the project come before the subject name.
    var head = n.slice(0, -tail.length).split('_');
    return head.length < MIN_HEAD_PARTS ? 'folder_name_format' : '';
  }

  /**
   * Checks a Drive folder name against
   * Team_Leader_Name_Project_Name_Subject_Name: no spaces, at least three
   * parts joined by single underscores, and, when a subject name is given,
   * ending with it in any case. The subject name may itself hold
   * underscores, like Software_Engineering.
   *
   * @param {*} name The folder name.
   * @param {{subject: *, example: (!Object|undefined)}=} opts The subject
   *     name, and the leader's name and project for the example.
   * @return {!Object} `{ok: true}`, or `{ok: false, error, params}` with an
   *     example of a right name.
   */
  function checkFolderName(name, opts) {
    var o = opts || {};
    var example = o.example || {};
    var n = String(name == null ? '' : name).trim();
    var subject = folderPart(o.subject);
    var error = folderNameError(n, subject);
    if (!error) return { ok: true };
    return {
      ok: false,
      error: error,
      params: {
        example: folderNameExample({
          name: example.name,
          project: example.project,
          subject: subject
        }),
        subject: subject,
        name: n
      }
    };
  }

  var api = {
    parseDriveLink: parseDriveLink,
    validateDriveLink: validateDriveLink,
    folderPart: folderPart,
    folderNameExample: folderNameExample,
    checkFolderName: checkFolderName
  };
  if (node) module.exports = api;
  root.RulesDriveLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
