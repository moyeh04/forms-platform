/**
 * The page that makes a new form: choose what it is for, name it, and see
 * what students will get.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var SIZE = A.ICON_SIZE;

  /** What every new form is told to do next, after its own steps. */
  var LAST_STEPS = [
    'Change, add or move any question and page.',
    'Set the status to Open when the form is ready.'
  ];

  /**
   * Draws what students will see: the icon, the title, the tags and the
   * pages of the form, and what to set up after making it.
   *
   * @param {!Object} v The page: `state`, `metadata`, `preview`, `nextBox`.
   */
  function paintSide(v) {
    var type = A.TYPES[v.state.type];
    var title = v.state.title.trim();
    App.ui.clear(v.preview);
    v.preview.append(
      h('span', { class: 'form-icon' }, icon(type.icon, SIZE.PREVIEW)),
      h(
        'p',
        { class: 'new-preview-title' + (title ? '' : ' empty') },
        title || 'Your title'
      ),
      h(
        'div',
        { class: 'card-tags' },
        A.termTags(
          Object.assign({ type: v.state.type }, v.metadata[v.state.type])
        )
      ),
      h(
        'ol',
        { class: 'new-pages' },
        type.pages.concat(['Review']).map(function (name) {
          return h('li', null, name);
        })
      )
    );
    App.ui.clear(v.nextBox);
    type.next.concat(LAST_STEPS).forEach(function (line) {
      v.nextBox.appendChild(h('li', null, line));
    });
  }

  /**
   * Draws the editor of what the chosen kind of form shows beside its
   * title.
   *
   * @param {!Object} v The page.
   */
  function paintMetadata(v) {
    var type = v.state.type;
    App.ui.clear(v.metadataHost);
    v.metadataHost.appendChild(
      A.metadataEditor(type, v.metadata[type], function (values) {
        Object.assign(v.metadata[type], values);
        paintSide(v);
      })
    );
  }

  /**
   * Draws the choice of a kind of form.
   *
   * @param {!Object} v The page.
   * @param {string} k The kind.
   * @return {!Element} The choice.
   */
  function typePick(v, k) {
    var type = A.TYPES[k];
    return h(
      'label',
      { class: 'type-opt' },
      h('input', {
        type: 'radio',
        name: 'type',
        value: k,
        checked: k === v.state.type,
        onchange: function () {
          v.state.type = k;
          paintMetadata(v);
          paintSide(v);
        }
      }),
      h(
        'div',
        null,
        h('span', { class: 'type-icon' }, icon(type.icon, SIZE.PICK)),
        h('div', null, h('strong', null, type.label), h('p', null, type.text))
      )
    );
  }

  /**
   * Marks the title as refused, or clears the mark. A refused title stays
   * in its field with the reason next to it.
   *
   * @param {!Object} v The page.
   * @param {boolean} on True to mark it.
   */
  function refuse(v, on) {
    v.titleError.hidden = !on;
    v.titleInput.setAttribute('aria-invalid', on ? 'true' : 'false');
    v.titleInput.classList.toggle('bad', !!on);
  }

  /**
   * Draws the number and the title of a step of the page.
   *
   * @param {number} n The number.
   * @param {string} title The title.
   * @param {string=} help What the step is for.
   * @return {!Element} The head.
   */
  function numbered(n, title, help) {
    return h(
      'div',
      { class: 'tt-step-head' },
      h('span', { class: 'tt-num' }, String(n)),
      h(
        'div',
        null,
        h('h3', null, title),
        help ? h('p', { class: 'help' }, help) : null
      )
    );
  }

  /**
   * Makes the form, or marks the title when it has none.
   *
   * @param {!Object} v The page.
   */
  function submit(v) {
    if (!v.state.title.trim()) {
      refuse(v, true);
      if (v.titleInput.focus) v.titleInput.focus();
      return;
    }
    A.busy(v.btn, async function () {
      var res = await A.call(
        'admin.forms.create',
        Object.assign(
          { type: v.state.type, title: v.state.title },
          v.metadata[v.state.type]
        )
      );
      App.ui.toast(
        'Form created as a draft. Check its settings, then open it.',
        'ok'
      );
      window.location.hash =
        '#/f/' + encodeURIComponent(res.form.slug) + '/settings';
    });
  }

  /**
   * Makes the title box and the line that refuses an empty title.
   *
   * @param {!Object} v The page; gets `titleInput` and `titleError`.
   */
  function makeTitle(v) {
    v.titleError = h(
      'p',
      { class: 'error', id: 'new-title-err', role: 'alert', hidden: true },
      'Give the form a title first.'
    );
    v.titleInput = A.text(
      '',
      function (value) {
        v.state.title = value;
        if (value.trim()) refuse(v, false);
        paintSide(v);
      },
      {
        name: 'title',
        placeholder: 'The heading students see',
        'aria-describedby': 'new-title-err',
        autocomplete: 'off'
      }
    );
  }

  /**
   * Draws the two steps: what the form is for, and its name.
   *
   * @param {!Object} v The page.
   * @return {!Element} The steps.
   */
  function mainColumn(v) {
    return h(
      'div',
      { class: 'l-main' },
      h(
        'section',
        { class: 'panel' },
        numbered(
          1,
          'What is the form for?',
          'This decides the pages and questions the form starts with. You' +
            ' can change them after.'
        ),
        h(
          'div',
          {
            class: 'type-pick l-grid',
            role: 'radiogroup',
            'aria-label': 'What the form is for'
          },
          Object.keys(A.TYPES).map(function (k) {
            return typePick(v, k);
          })
        )
      ),
      h(
        'section',
        { class: 'panel' },
        numbered(2, 'Name it'),
        h(
          'label',
          { class: 'field-row' },
          h('span', { class: 'label' }, 'Title'),
          v.titleInput,
          v.titleError
        ),
        v.metadataHost
      )
    );
  }

  /**
   * Draws the side: what students will see, and the button.
   *
   * @param {!Object} v The page.
   * @return {!Element} The side.
   */
  function sideColumn(v) {
    return h(
      'aside',
      { class: 'l-side new-side' },
      h(
        'section',
        { class: 'panel l-stack' },
        h('span', { class: 'tool-label' }, 'What students will see'),
        v.preview,
        h('span', { class: 'tool-label' }, 'After you create it'),
        v.nextBox,
        h(
          'p',
          { class: 'muted-note' },
          'The form starts as a draft. Students cannot open it until you set' +
            ' it to Open.'
        ),
        v.btn
      )
    );
  }

  /**
   * Draws the page that makes a new form.
   *
   * @param {!Element} mount Where the page is drawn.
   */
  A.views.create = async function (mount) {
    var v = {
      state: { type: FormType.TEAM_REGISTRATION, title: '' },
      metadata: {},
      preview: h('div', { class: 'new-preview', 'aria-live': 'polite' }),
      nextBox: h('ul', { class: 'plain-list new-next' }),
      metadataHost: h('div'),
      btn: h(
        'button',
        { type: 'submit', class: 'btn btn-primary', name: 'create' },
        'Create form'
      )
    };
    Object.keys(A.TYPES).forEach(function (type) {
      v.metadata[type] = FormMetadata.defaults(type);
    });
    App.ui.clear(mount);
    makeTitle(v);
    var form = h(
      'form',
      {
        class: 'new-form',
        novalidate: 'novalidate',
        onsubmit: function (e) {
          e.preventDefault();
          submit(v);
        }
      },
      h(
        'div',
        { class: 'page-head' },
        h('h2', null, 'New form'),
        h('a', { class: 'btn btn-quiet sm', href: '#/' }, 'Cancel')
      ),
      h('div', { class: 'l-split' }, mainColumn(v), sideColumn(v))
    );
    paintMetadata(v);
    paintSide(v);
    mount.appendChild(form);
  };
})(window.App);
