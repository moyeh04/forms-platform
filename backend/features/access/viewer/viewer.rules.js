/** What a private link may see: the forms, the kind of view and the columns. */

var ViewerRules = (function () {
  /** The columns of each kind of view, as `[id, label]`, in page order. */
  var VIEW_COLUMNS_ = {
    reservation: [
      ['time', 'Time'],
      ['name', 'Team leader'],
      ['code', 'Code'],
      ['phone', 'Phone'],
      ['email', 'Email'],
      ['title', 'Project'],
      ['level', 'Level'],
      ['section', 'Section'],
      ['members', 'Teammates']
    ],
    team: [
      ['name', 'Name'],
      ['section', 'Section'],
      ['code', 'Code'],
      ['phone', 'Phone'],
      ['title', 'Project or task'],
      ['link', 'Link']
    ],
    whatsapp: [
      ['name', 'Name'],
      ['code', 'Code'],
      ['phone', 'Phone'],
      ['level', 'Level'],
      ['group', 'Group'],
      ['section', 'Section'],
      ['link', 'Timetable'],
      ['review', 'Review']
    ]
  };

  /**
   * Names the kind of view a form gets on the instructor page.
   *
   * @param {!Object} form The form.
   * @return {string} `reservation`, `whatsapp` or `team`.
   */
  function viewKind_(form) {
    return form.type === FormType.RESERVATION
      ? 'reservation'
      : form.type === FormType.WHATSAPP_REGISTRATION
        ? 'whatsapp'
        : 'team';
  }

  /**
   * Makes what the instructor page shows about a form.
   *
   * @param {!Object} form The form.
   * @return {!Object} Its slug, title, type and public details.
   */
  function viewFormMetadata_(form) {
    var metadata = { slug: form.slug, title: form.title, type: form.type };
    Object.assign(metadata, FormMetadata.public(form));
    return metadata;
  }

  /**
   * Lists the columns of a form's view that a link may see.
   *
   * @param {!Object} client The private link.
   * @param {!Object} form The form.
   * @return {!Array<{id: string, label: string}>} The columns.
   */
  function visibleColumns_(client, form) {
    return VIEW_COLUMNS_[viewKind_(form)]
      .filter(function (c) {
        var members =
          c[0] === 'members' ? Rules.fieldByRole(form, 'members') : null;
        if (members && members.enabled === false) return false;
        return client.hiddenColumns.indexOf(c[0]) === -1;
      })
      .map(function (c) {
        return { id: c[0], label: c[1] };
      });
  }

  /**
   * Lists the forms a link may see: its own, neither draft nor archived.
   *
   * @param {!Object} client The private link.
   * @return {!Array<!Object>} The forms.
   */
  function viewerForms_(client) {
    return FormsRepository.readForms().filter(function (f) {
      return (
        f.status !== FormStatus.DRAFT &&
        f.status !== FormStatus.ARCHIVED &&
        ClientsAccess.clientAllows(client, f)
      );
    });
  }

  /**
   * Deletes the hidden keys of a row.
   *
   * @param {!Object} obj The row, changed in place.
   * @param {!Array<string>} hidden The keys to delete.
   * @return {!Object} The same row.
   */
  function stripHidden_(obj, hidden) {
    hidden.forEach(function (k) {
      delete obj[k];
    });
    return obj;
  }

  return {
    viewerForms: viewerForms_,
    viewFormMetadata: viewFormMetadata_,
    viewKind: viewKind_,
    visibleColumns: visibleColumns_,
    stripHidden: stripHidden_
  };
})();
