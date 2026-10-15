/**
 * The Limits and checks panel of a form: the most submissions, the Drive
 * link check, one team per student with requests for a student in another
 * team, and the rule for Drive folder names. Each switch belongs to the one
 * above it and hides with it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  var DRIVE_CHECKS = [
    ['strict', 'Must open and be shared with anyone who has the link'],
    ['off', 'Do not check']
  ];

  /**
   * Draws a switch of a rule that is true only when set to true.
   *
   * @param {!Object} rules The rules, changed in place.
   * @param {string} name The rule.
   * @param {string} label The label.
   * @param {function(boolean)=} after Called with the new value.
   * @return {!Element} The switch.
   */
  function ruleSwitch(rules, name, label, after) {
    return A.check(
      label,
      rules[name] === true,
      function (v) {
        rules[name] = v;
        if (after) after(v);
      },
      { name: name }
    );
  }

  /**
   * Draws what a transfer request does: the emails, and the phone number
   * of the other leader with its WhatsApp switch.
   *
   * @param {!Object} rules The rules.
   * @return {!Element} The settings.
   */
  function transferOptions(rules) {
    var whatsapp = h(
      'div',
      { class: 'sub-setting', hidden: rules.transferPhones !== true },
      ruleSwitch(rules, 'transferWhatsapp', 'Open the number in WhatsApp')
    );
    return h(
      'div',
      { class: 'sub-setting', hidden: !rules.transfers },
      ruleSwitch(
        rules,
        'transferEmails',
        'Also email both leaders about each request and its answer'
      ),
      ruleSwitch(
        rules,
        'transferPhones',
        'Show each leader the phone number of the other leader',
        function (v) {
          whatsapp.hidden = !v;
        }
      ),
      h(
        'p',
        { class: 'help' },
        'So the two leaders can talk. The number shows next to a request' +
          ' while it waits, with a button that copies it. A leader sees it' +
          ' only after their team has asked or been asked.'
      ),
      whatsapp
    );
  }

  /**
   * Draws whether a leader may ask for a student who is in another team.
   * It has a meaning only while a student may be in one team.
   *
   * @param {!Object} rules The rules.
   * @return {!Element} The setting.
   */
  function transferRow(rules) {
    var options = transferOptions(rules);
    return h(
      'div',
      { class: 'sub-setting', hidden: !rules.uniqueAcrossForm },
      A.check(
        'A leader may ask for a student who is in another team',
        !!rules.transfers,
        function (v) {
          rules.transfers = v;
          options.hidden = !v;
        },
        { name: 'transfers' }
      ),
      h(
        'p',
        { class: 'help' },
        'The team registers without that student. The leader of the other' +
          ' team sees the request when opening the form with the edit key,' +
          ' and the student moves on approval. You can approve under' +
          ' Responses as well.'
      ),
      options
    );
  }

  /**
   * Draws the rule for Drive folder names.
   *
   * @param {!Object} rules The rules; rules.folderName is changed in place.
   * @return {!Element} The box.
   */
  function folderBox(rules) {
    var folder = rules.folderName;
    return h(
      'div',
      { class: 'subpanel' },
      h('h3', null, 'Drive folder name'),
      h(
        'p',
        { class: 'help' },
        'When the Drive check is on, the folder name is read and must look' +
          ' like Team_Leader_Name_Project_Name_Subject_Name, for example' +
          ' Ahmed_Mohamed_Library_System_Software_Engineering: no spaces,' +
          ' parts joined by underscores, ending with the subject name.' +
          ' Students see the rule with an example.'
      ),
      A.check(
        'Folder names must follow Team_Leader_Name_Project_Name_Subject_Name',
        folder.enabled,
        function (v) {
          folder.enabled = v;
        }
      ),
      A.field(
        'Subject name at the end',
        A.text(
          folder.subject || '',
          function (v) {
            folder.subject = Rules.folderPart(v);
          },
          {
            name: 'folderSubject',
            dir: 'ltr',
            placeholder: 'Software_Engineering'
          }
        ),
        'The subject name, not the code. Spaces become underscores. Leave' +
          ' empty to accept any subject name.'
      )
    );
  }

  /**
   * Tells whether the form asks for a Drive link that can be a folder.
   *
   * @param {!Object} f The form.
   * @return {boolean} True when it does.
   */
  function hasFolder(f) {
    return (f.fields || []).some(function (x) {
      return (
        x.type === 'drive_link' &&
        (!x.kinds || x.kinds.indexOf('folder') !== -1)
      );
    });
  }

  /**
   * Draws the most submissions and the Drive link check.
   *
   * @param {!Object} s The settings page.
   * @return {!Element} The row.
   */
  function countsRow(s) {
    var rules = s.f.rules;
    return h(
      'div',
      { class: 'row' },
      A.field(
        'Maximum submissions',
        A.number(
          rules.maxSubmissions == null ? '' : rules.maxSubmissions,
          function (v) {
            rules.maxSubmissions = v === '' ? null : parseInt(v, 10);
          },
          { name: 'maxSubmissions', min: '1' }
        ),
        'Leave empty for no limit.'
      ),
      s.hasDrive
        ? A.field(
            'Google Drive links',
            A.select(rules.driveCheck || 'strict', DRIVE_CHECKS, function (v) {
              rules.driveCheck = v;
            })
          )
        : null
    );
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} s The settings page.
   * @return {string} The limit and the team rule.
   */
  function summary(s) {
    var rules = s.f.rules;
    return [
      rules.maxSubmissions ? 'At most ' + rules.maxSubmissions : 'No limit',
      s.isTeam && rules.uniqueAcrossForm
        ? 'one team per student' +
          (rules.transfers ? ', leaders may ask for a student' : '')
        : ''
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /**
   * Draws the Limits and checks panel. f.rules.folderName is filled in.
   *
   * @param {!Object} s The settings page: `f`, `isTeam`, `hasDrive`.
   * @return {!Element} The panel.
   */
  A.limitsPanel = function (s) {
    var rules = s.f.rules;
    rules.folderName = rules.folderName || { enabled: false, subject: '' };
    var transfers = s.isTeam ? transferRow(rules) : null;
    var panel = A.panel(
      'Limits and checks',
      null,
      countsRow(s),
      s.isTeam
        ? A.check(
            'A student may appear in only one team of this form',
            rules.uniqueAcrossForm,
            function (v) {
              rules.uniqueAcrossForm = v;
              transfers.hidden = !v;
            },
            { name: 'uniqueAcrossForm' }
          )
        : null,
      transfers,
      hasFolder(s.f) ? folderBox(rules) : null
    );
    panel.summary = summary.bind(null, s);
    return panel;
  };
})(window.App);
