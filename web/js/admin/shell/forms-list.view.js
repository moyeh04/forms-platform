/**
 * The forms list: each form as a card, grouped by status, with the
 * bookings opened with its keys listed under it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var SIZE = A.ICON_SIZE;

  /**
   * Draws the card of a form.
   *
   * @param {!Object} f The form.
   * @param {!Array<!Object>} kids The bookings opened with its keys.
   * @return {!Element} The card.
   */
  function formCard(f, kids) {
    var type = A.TYPES[f.type] || { label: f.type, icon: 'task' };
    var link = A.formLink(f.slug);
    var page = '#/f/' + encodeURIComponent(f.slug);
    return h(
      'article',
      {
        class: 'card' + (kids.length ? ' has-series' : ''),
        dataset: { slug: f.slug }
      },
      h(
        'div',
        { class: 'card-top' },
        h('span', { class: 'card-icon' }, icon(type.icon, SIZE.CARD)),
        h(
          'div',
          null,
          h('h4', null, f.title),
          h('div', { class: 'card-tags' }, A.termTags(f))
        )
      ),
      h(
        'div',
        { class: 'actions' },
        A.badge(A.STATUS_LABEL[f.status] || f.status, f.status),
        h('span', { class: 'muted-note' }, type.label),
        f.type === FormType.RESERVATION ? A.daysNote(f) : null
      ),
      h(
        'div',
        { class: 'actions card-actions' },
        h('a', { class: 'btn btn-primary sm', href: page }, 'Responses'),
        h(
          'a',
          { class: 'btn btn-quiet sm', href: page + '/settings' },
          'Setup'
        ),
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
        A.copyLinkButton(f, link),
        A.formMore(f)
      ),
      A.series(f, kids)
    );
  }

  /**
   * Draws the head of the list, with the button to make a form.
   *
   * @return {!Element} The head.
   */
  function listHead() {
    return h(
      'div',
      { class: 'page-head' },
      h('h2', null, 'Forms'),
      h(
        'a',
        { class: 'btn btn-primary', href: '#/new' },
        icon('plus', SIZE.BUTTON),
        'New form'
      )
    );
  }

  /**
   * Draws the forms of one status.
   *
   * @param {string} st The status.
   * @param {!Array<!Object>} group Its forms.
   * @param {function(!Object): !Array<!Object>} kidsOf Gives the bookings
   *     under a form.
   * @return {!Element} The group.
   */
  function statusGroup(st, group, kidsOf) {
    return h(
      'section',
      { class: 'form-group', dataset: { status: st } },
      h(
        'h3',
        { class: 'group-title' },
        A.STATUS_LABEL[st],
        h('span', { class: 'group-count' }, String(group.length))
      ),
      h(
        'div',
        { class: 'cards' },
        group.map(function (f) {
          return formCard(f, kidsOf(f));
        })
      )
    );
  }

  /**
   * Draws the forms list: grouped by status, and inside a status the
   * newest form first. A booking opened with the keys of a form is listed
   * under that form, not as a card of its own.
   *
   * @param {!Element} mount Where the page is drawn.
   */
  A.views.forms = async function (mount) {
    var res = await A.call('admin.forms.list');
    var forms = res.forms.slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    App.ui.clear(mount);
    mount.appendChild(listHead());
    if (!forms.length) {
      mount.appendChild(
        h(
          'div',
          { class: 'empty' },
          'No forms yet. Create the first one and choose what it collects.'
        )
      );
      return;
    }
    var ids = forms.map(function (f) {
      return f.id;
    });

    /**
     * Gives the form a booking is listed under.
     *
     * @param {!Object} f The form.
     * @return {string} The id of that form, or '' for a card of its own.
     */
    function under(f) {
      var src = A.bookedBy(f);
      return src && ids.indexOf(src) !== -1 ? src : '';
    }

    var cards = forms.filter(function (f) {
      return !under(f);
    });
    A.STATUSES.forEach(function (st) {
      var group = cards.filter(function (f) {
        var known = A.STATUSES.indexOf(f.status) !== -1;
        return (known ? f.status : FormStatus.DRAFT) === st;
      });
      if (!group.length) return;
      mount.appendChild(
        statusGroup(st, group, function (f) {
          return forms.filter(function (k) {
            return under(k) === f.id;
          });
        })
      );
    });
  };
})(window.App);
