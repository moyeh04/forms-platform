/** What a private link may see: the forms, the kind of view and the columns. */

var ViewerRules = (function () {
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

  function viewKind_(form) {
    return form.type === FormType.RESERVATION
      ? 'reservation'
      : form.type === FormType.WHATSAPP_REGISTRATION
        ? 'whatsapp'
        : 'team';
  }

  function viewFormMetadata_(form) {
    var metadata = { slug: form.slug, title: form.title, type: form.type };
    Object.assign(metadata, FormMetadata.public(form));
    return metadata;
  }

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

  function viewerForms_(client) {
    return FormsRepository.readForms().filter(function (f) {
      return (
        f.status !== FormStatus.DRAFT &&
        f.status !== FormStatus.ARCHIVED &&
        ClientsAccess.clientAllows(client, f)
      );
    });
  }

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
