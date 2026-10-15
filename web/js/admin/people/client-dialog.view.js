/**
 * The dialog that makes a private link or edits one: its name, the forms
 * it shows, the columns it hides, whether it may review and sees the
 * warnings about small teams, and what it may do with the progress of
 * teams. A new link also chooses its key and its end.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  var COLUMNS = [
    ['time', 'Time'],
    ['name', 'Name'],
    ['code', 'Code'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['title', 'Project or task'],
    ['level', 'Level'],
    ['section', 'Section'],
    ['group', 'Group'],
    ['link', 'Link'],
    ['review', 'Review']
  ];

  /**
   * Reads the settings of a link into the state of the dialog.
   *
   * @param {?Object} client The link, or null for a new one.
   * @return {!Object} The state.
   */
  function stateOf(client) {
    if (!client) {
      return {
        name: '',
        all: false,
        forms: [],
        hidden: [],
        canReview: false,
        showSizeAlerts: true,
        progress: ProgressAccess.SEE,
        withKey: true,
        end: { none: true }
      };
    }
    return {
      name: client.name,
      all: client.forms.indexOf('*') !== -1,
      forms: client.forms.filter(function (s) {
        return s !== '*';
      }),
      hidden: client.hiddenColumns.slice(),
      canReview: client.canReview,
      showSizeAlerts: client.showSizeAlerts,
      progress: client.progress || ProgressAccess.SEE,
      withKey: true,
      end: { none: true }
    };
  }

  /**
   * Adds a value to a list, or takes it out.
   *
   * @param {!Array<string>} list The list.
   * @param {string} value The value.
   * @param {boolean} on True to add it.
   * @return {!Array<string>} The new list.
   */
  function toggled(list, value, on) {
    var out = list.filter(function (x) {
      return x !== value;
    });
    if (on) out.push(value);
    return out;
  }

  /**
   * Draws the forms a link can show.
   *
   * @param {!Object} st The state.
   * @param {!Array<!Object>} forms Every form.
   * @return {!Element} The field.
   */
  function formsField(st, forms) {
    return h(
      'div',
      { class: 'field-row' },
      h('span', { class: 'label' }, 'Forms they can see'),
      A.check('All forms, including ones I create later', st.all, function (v) {
        st.all = v;
      }),
      h(
        'div',
        null,
        forms.map(function (f) {
          var caption = FormMetadata.caption(f);
          return A.check(
            f.title + (caption ? ' (' + caption + ')' : ''),
            st.forms.indexOf(f.id) !== -1,
            function (v) {
              st.forms = toggled(st.forms, f.id, v);
            }
          );
        })
      )
    );
  }

  /**
   * Draws the columns a link hides.
   *
   * @param {!Object} st The state.
   * @return {!Element} The field.
   */
  function columnsField(st) {
    return h(
      'div',
      { class: 'field-row' },
      h('span', { class: 'label' }, 'Hide these columns'),
      h(
        'div',
        { class: 'row' },
        COLUMNS.map(function (c) {
          return A.check(c[1], st.hidden.indexOf(c[0]) !== -1, function (v) {
            st.hidden = toggled(st.hidden, c[0], v);
          });
        })
      )
    );
  }

  /**
   * Draws what only a new link chooses: whether it asks for a key, and its
   * end. Later the key is added, changed or removed from the list, and the
   * end is moved there, where it is shown.
   *
   * @param {!Object} st The state.
   * @return {!Array<!Element>} The fields.
   */
  function newLinkFields(st) {
    return [
      A.check(
        'Also ask for a six-digit access key (recommended)',
        st.withKey,
        function (v) {
          st.withKey = v;
        },
        { name: 'withKey' }
      ),
      h(
        'div',
        { class: 'field-row' },
        h('span', { class: 'label' }, 'The link works'),
        A.linkEndPicker(st.end, function (v) {
          st.end = v;
        })
      )
    ];
  }

  /**
   * Draws the body of the dialog.
   *
   * @param {!Object} st The state.
   * @param {?Object} client The link, or null for a new one.
   * @param {!Array<!Object>} forms Every form.
   * @return {!Element} The body.
   */
  function dialogBody(st, client, forms) {
    return h(
      'div',
      null,
      A.field(
        'Name',
        A.text(
          st.name,
          function (v) {
            st.name = v;
          },
          { name: 'clientName', placeholder: 'Dr. Ahmed - Database seminar' }
        ),
        'Only you see this.'
      ),
      formsField(st, forms),
      columnsField(st),
      A.check(
        'Allow them to mark review steps as approved or rejected',
        st.canReview,
        function (v) {
          st.canReview = v;
        }
      ),
      A.check(
        'Show them the warnings about small teams',
        st.showSizeAlerts,
        function (v) {
          st.showSizeAlerts = v;
        },
        { name: 'showSizeAlerts' }
      ),
      h(
        'p',
        { class: 'help' },
        'Only on forms where you switched the warnings on, in the Small teams' +
          ' section of the form settings.'
      ),
      A.progressField(st),
      client ? null : newLinkFields(st)
    );
  }

  /**
   * Says why the dialog cannot be saved.
   *
   * @param {!Object} st The state.
   * @param {?Object} client The link, or null for a new one.
   * @return {string} The reason, or ''.
   */
  function problemOf(st, client) {
    if (!st.name.trim()) return 'Give this person or group a name.';
    if (!st.all && !st.forms.length) return 'Choose at least one form.';
    if (!client && !st.end) return 'Pick the date the link ends.';
    return '';
  }

  /**
   * Saves the link: the changes of one that exists, or a new one, whose
   * link and key are shown once.
   *
   * @param {!Object} st The state.
   * @param {?Object} client The link, or null for a new one.
   * @return {!Promise<boolean|undefined>} False to keep the dialog open.
   */
  async function save(st, client) {
    var problem = problemOf(st, client);
    if (problem) {
      toast(problem, 'err');
      return false;
    }
    var settings = {
      name: st.name,
      forms: st.all ? ['*'] : st.forms,
      hiddenColumns: st.hidden,
      canReview: st.canReview,
      showSizeAlerts: st.showSizeAlerts,
      progress: st.progress
    };
    var r;
    if (client) {
      await A.call('admin.clients.update', { id: client.id, patch: settings });
      toast('Saved', 'ok');
    } else {
      r = await A.call(
        'admin.clients.create',
        Object.assign(settings, {
          withKey: st.withKey,
          expires: A.linkEnd(st.end)
        })
      );
      A.revealAccess('Link for ' + r.client.name, r.token, r.accessKey);
    }
    A.render();
  }

  /**
   * Opens the dialog of a private link.
   *
   * @param {?Object} client The link to edit, or null to make one.
   * @param {!Array<!Object>} forms Every form.
   */
  A.clientDialog = function (client, forms) {
    var st = stateOf(client);
    A.modal(
      client ? 'Edit ' + client.name : 'New private link',
      dialogBody(st, client, forms),
      [
        { text: 'Cancel', kind: 'quiet' },
        {
          text: client ? 'Save' : 'Create link',
          kind: 'primary',
          onclick: save.bind(null, st, client)
        }
      ]
    );
  };
})(window.App);
