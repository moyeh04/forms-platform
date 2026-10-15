/**
 * The header and the tab bar every tab of a form shows: what the form is,
 * its status, its link, and what is done to it less often.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var toast = App.ui.toast;
  var SIZE = A.ICON_SIZE;

  /** The label of each tab of a form. */
  var TAB_LABEL = {
    responses: 'Responses',
    questions: 'Questions',
    timetable: 'Timetable',
    settings: 'Setup'
  };

  /**
   * Draws the tab bar of a form. A tab is a link, so it also opens in a new
   * window.
   *
   * @param {!Object} form The form; only a reservation has a timetable.
   * @param {string} active The tab shown.
   * @param {?function(string): boolean} pick May switch to a tab in place
   *     and answer true; then the link is not followed.
   * @param {?Array<string>} alerts The tabs that need the admin, such as a
   *     timetable with no days.
   * @return {!Element} The tab bar.
   */
  A.formTabs = function (form, active, pick, alerts) {
    var ids = A.FORM_TABS.filter(function (id) {
      return id !== 'timetable' || form.type === FormType.RESERVATION;
    });
    return h(
      'nav',
      { class: 'form-tabs', 'aria-label': 'Parts of this form' },
      ids.map(function (id) {
        var href =
          '#/f/' +
          encodeURIComponent(form.slug) +
          (id === 'responses' ? '' : '/' + id);
        return h(
          'a',
          {
            href: href,
            name: 'tab-' + id,
            'aria-current': id === active ? 'page' : null,
            onclick: function (e) {
              if (pick?.(id)) e.preventDefault();
            }
          },
          TAB_LABEL[id],
          alerts && alerts.indexOf(id) !== -1
            ? h(
                'span',
                { class: 'tab-alert', title: 'Needs your attention' },
                '!'
              )
            : null
        );
      })
    );
  };

  /**
   * Saves a new status of a form. A refused change puts the saved status
   * back and says why.
   *
   * @param {!Object} form The form.
   * @param {string} v The new status.
   * @param {!HTMLSelectElement} statusSel The status dropdown.
   * @param {!Element} refused The line that says why a change was refused.
   */
  function saveStatus(form, v, statusSel, refused) {
    var was = form.status;
    refused.hidden = true;
    statusSel.disabled = true;
    A.call('admin.forms.update', {
      id: form.id,
      base: form.updatedAt,
      patch: { status: v }
    })
      .then(
        function (out) {
          form.status = out.form.status;
          form.updatedAt = out.form.updatedAt;
          toast('Status saved: ' + A.STATUS_LABEL[form.status], 'ok');
        },
        function (e) {
          statusSel.value = was;
          refused.textContent =
            'The status is still ' + A.STATUS_LABEL[was] + '. ' + A.message(e);
          refused.hidden = false;
        }
      )
      .then(function () {
        statusSel.disabled = false;
        statusSel.dataset.status = form.status;
      });
  }

  /**
   * Draws the status dropdown of a form. The status is saved the moment it
   * is changed, on every tab, so the header never shows a status that is
   * not the saved one.
   *
   * @param {!Object} form The form.
   * @param {!Element} refused The line that says why a change was refused.
   * @return {!Element} The dropdown with its label.
   */
  function statusPicker(form, refused) {
    var statusSel = A.select(
      form.status,
      A.STATUSES.map(function (st) {
        return [
          st,
          st === FormStatus.DRAFT ? 'Draft (hidden)' : A.STATUS_LABEL[st]
        ];
      }),
      function (v) {
        saveStatus(form, v, statusSel, refused);
      }
    );
    statusSel.name = 'status';
    statusSel.dataset.status = form.status;
    return h(
      'label',
      { class: 'status-pick' },
      h('span', { class: 'tool-label' }, 'Status'),
      statusSel
    );
  }

  /**
   * Draws the header of a form.
   *
   * @param {!Object} form The form.
   * @return {!Element} The header.
   */
  A.formHead = function (form) {
    var type = A.TYPES[form.type] || { label: form.type };
    var link = A.formLink(form.slug);
    var refused = h('p', {
      class: 'error head-note',
      role: 'alert',
      hidden: true
    });
    return h(
      'div',
      { class: 'page-head' },
      h('h2', null, form.title),
      A.termTags(form),
      h('span', { class: 'muted-note' }, type.label),
      statusPicker(form, refused),
      h(
        'a',
        {
          class: 'btn btn-quiet sm',
          href: link,
          target: '_blank',
          rel: 'noopener'
        },
        'Open form'
      ),
      A.copyLinkButton(form, link),
      A.formMore(form, function () {
        A.unsaved = false;
        window.location.hash = '#/';
      }),
      refused
    );
  };

  /**
   * Draws the button that copies the link of a form.
   *
   * @param {!Object} form The form.
   * @param {string} link Its link.
   * @return {!Element} The button.
   */
  A.copyLinkButton = function (form, link) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet sm',
        name: 'copy-link',
        'aria-label': 'Copy the link of ' + form.title,
        onclick: async function () {
          var copied = await App.ui.copyText(link);
          toast(copied ? 'Form link copied' : 'Could not copy', 'ok');
        }
      },
      icon('link', SIZE.LINE),
      'Copy link'
    );
  };

  /**
   * Makes an item of the More menu.
   *
   * @param {!Object} attrs Its attributes, with its `onclick`.
   * @param {string} iconName Its icon.
   * @param {string} label Its words.
   * @return {!Element} The item.
   */
  function menuItem(attrs, iconName, label) {
    return h(
      'button',
      Object.assign({ type: 'button', role: 'menuitem' }, attrs),
      icon(iconName, SIZE.MENU),
      label
    );
  }

  /**
   * Lists the items of the More menu of a form.
   *
   * @param {!Object} f The form.
   * @param {!Element} more The menu, closed by each item.
   * @param {function()=} afterDelete Called once the form is deleted.
   * @return {!Array<?Element>} The items.
   */
  function moreItems(f, more, afterDelete) {
    var sheet = f.sheetUrl
      ? h(
          'a',
          {
            role: 'menuitem',
            href: f.sheetUrl,
            target: '_blank',
            rel: 'noopener'
          },
          icon('task', SIZE.MENU),
          'Open Google Sheet'
        )
      : null;
    var rebuild = menuItem(
      {
        name: 'rebuild',
        title:
          'Write the tabs of the Google Sheet again from the saved answers.' +
          ' Use it when the sheet looks out of date.',
        onclick: function (e) {
          A.busy(e.currentTarget, async function () {
            await A.call('admin.views.rebuild', { slug: f.slug });
            more.open = false;
            toast('Google Sheet views rebuilt', 'ok');
          });
        }
      },
      'refresh',
      'Rebuild sheet'
    );
    var duplicate = menuItem(
      {
        onclick: function () {
          more.open = false;
          A.duplicateForm(f);
        }
      },
      'copy',
      'Duplicate for a new term'
    );
    var remove = menuItem(
      {
        class: 'danger',
        name: 'delete-form',
        'aria-label': 'Delete ' + f.title,
        onclick: function () {
          more.open = false;
          A.deleteForm(f, afterDelete);
        }
      },
      'trash',
      'Delete form'
    );
    return [sheet, rebuild, duplicate, remove];
  }

  /**
   * Draws what is done to a form less often, the same on its card and in
   * its header.
   *
   * @param {!Object} f The form.
   * @param {function()=} afterDelete Called once the form is deleted; the
   *     page is drawn again when absent.
   * @return {!Element} The menu.
   */
  A.formMore = function (f, afterDelete) {
    var menu = h('div', { class: 'more-menu', role: 'menu' });
    var more = h(
      'details',
      { class: 'more' },
      h(
        'summary',
        {
          class: 'btn btn-quiet sm',
          'aria-label': 'More actions for ' + f.title
        },
        icon('menu', SIZE.MENU),
        'More'
      ),
      menu
    );
    moreItems(f, more, afterDelete).forEach(function (item) {
      if (item) menu.appendChild(item);
    });
    return more;
  };
})(window.App);
