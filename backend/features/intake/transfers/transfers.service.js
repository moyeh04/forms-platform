/**
 * Moving a student from one team to another team of the same form.
 *
 * A form that allows a student in only one team refuses a team that names a member of another
 * team. With `rules.transfers` on, the leader can ask for that member instead: the team is
 * saved without the member and a request is recorded. The leader of the team that holds the
 * member, or the admin, approves or rejects it. An approval moves the member. The leaders see
 * requests when they open the form with their key; emails go out only with `rules.transferEmails`.
 *
 * The leader of a team can be asked for as well. An approval then names the member who leads
 * the team next, so the team is never left without a leader. A leader who is alone in a team
 * has nobody to hand it to and cannot be asked for.
 *
 * With `rules.transferPhones` the two leaders of a waiting request see each other's phone, so
 * they can talk before one of them answers.
 *
 * Requests are rows of the tab "Transfers" in the sheet of the form. The tab is made with the
 * first request, so a form that never has one keeps its sheet as it is.
 */

function memberCodeId_(form) {
  var mf = Rules.fieldByRole(form, 'members');
  var sub = ((mf && mf.fields) || []).filter(function (sf) {
    return sf.role === 'code';
  })[0];
  return sub ? sub.id : 'code';
}

/** The team size answer follows the members, so the two never disagree. */
function setTeamSize_(form, data) {
  var mf = Rules.fieldByRole(form, 'members');
  var sf = Rules.fieldByRole(form, 'team_size');
  if (mf && sf && data[sf.id] != null)
    data[sf.id] = String((data[mf.id] || []).length + 1);
}

/**
 * Returns a function from a team id to what a leader may see of that team's leader while a
 * request waits: { phone }, with whatsapp: true when the form opens the number in WhatsApp.
 * Nothing unless the form shows the phones. The teams are read once, on the first call.
 */
function leaderContacts_(form) {
  var rules = form.rules || {},
    rows = null;
  return function (teamId) {
    if (rules.transferPhones !== true) return {};
    rows = rows || readResponses(form);
    var team = rows.filter(function (r) {
      return r.id === teamId;
    })[0];
    var phone = team
      ? String(Rules.valueByRole(form, team.data, 'phone') || '')
      : '';
    if (!phone) return {};
    return rules.transferWhatsapp === true
      ? { phone: phone, whatsapp: true }
      : { phone: phone };
  };
}

/**
 * For a request that asks for the leader of `team`: the members who can lead it next. Empty for
 * a request that asks for a member.
 */
function leaderAsked_(form, team, code) {
  var people = team ? Rules.membersOf(form, team.data) : [];
  if (
    !people.some(function (m) {
      return m.leader && String(m.code) === String(code);
    })
  )
    return {};
  return {
    leader: true,
    heirs: people
      .filter(function (m) {
        return !m.leader && m.code;
      })
      .map(function (m) {
        return { code: String(m.code), name: m.name };
      })
  };
}

/**
 * The leader leaves `data` and the member with the code `next.leader` leads instead. That
 * member's answers go to the leader's questions of the same role or id, and `next.email` to the
 * email question, which members do not have. What only a leader answers, like the major, stays.
 */
function handOver_(form, data, next) {
  next = next || {};
  var mf = Rules.fieldByRole(form, 'members');
  var codeId = memberCodeId_(form);
  var list = Array.isArray(data[mf.id]) ? data[mf.id] : [];
  if (!list.length)
    fail(
      'transfer_leader',
      'This student leads a team alone and cannot be moved.'
    );
  var heir = list.filter(function (m) {
    return String(m[codeId]) === String(next.leader || '');
  })[0];
  if (!heir)
    fail('transfer_heir', 'Choose who leads the team after this student.');
  var emailField = Rules.fieldByRole(form, 'email');
  if (emailField && emailField.enabled !== false) {
    var email = Rules.validateField(emailField, next.email, { form: form });
    if (!email.ok)
      fail('transfer_email', 'Write the email of the new leader.', {
        error: email.error
      });
    data[emailField.id] = email.value;
  }
  (mf.fields || []).forEach(function (sf) {
    var top = (form.fields || []).filter(function (f) {
      return (
        f.type === sf.type && (sf.role ? f.role === sf.role : f.id === sf.id)
      );
    })[0];
    if (top && heir[sf.id] != null && heir[sf.id] !== '')
      data[top.id] = heir[sf.id];
  });
  data[mf.id] = list.filter(function (m) {
    return m !== heir;
  });
}

/**
 * Takes the members that other teams hold out of `data` and returns the requests to record.
 * Until the leader asks for every one of them (`asked` lists the codes), it fails with
 * duplicate_member and names the ones that can be asked for. A leader who is alone in a team
 * cannot be: nobody would be left to lead it.
 */
function takeOutTransfers_(form, data, rows, selfId, asked) {
  if (!transfersOn_(form)) return [];
  var mf = Rules.fieldByRole(form, 'members');
  var codeId = memberCodeId_(form);
  var list = Array.isArray(data[mf.id]) ? data[mf.id] : [];
  var holders = {};
  rows.forEach(function (r) {
    if (r.id === selfId) return;
    var people = Rules.membersOf(form, r.data);
    people.forEach(function (m) {
      if (m.code)
        holders[m.code] = {
          id: r.id,
          ref: r.ref,
          leader: m.leader,
          alone: people.length === 1
        };
    });
  });
  var clash = list.filter(function (m) {
    return holders[m[codeId]];
  });
  if (!clash.length) return [];
  var movable = clash.filter(function (m) {
    return !holders[m[codeId]].alone;
  });
  asked = (asked || []).map(String);
  var askedAll =
    movable.length === clash.length &&
    movable.every(function (m) {
      return asked.indexOf(String(m[codeId])) !== -1;
    });
  if (!askedAll) {
    fail(
      'duplicate_member',
      'Someone on this team is already registered in another team.',
      {
        codes: clash.map(function (m) {
          return m[codeId];
        }),
        transfer: movable.map(function (m) {
          var held = holders[m[codeId]];
          return held.leader
            ? { code: m[codeId], team: held.ref, leader: true }
            : { code: m[codeId], team: held.ref };
        })
      }
    );
  }
  data[mf.id] = list.filter(function (m) {
    return !holders[m[codeId]];
  });
  setTeamSize_(form, data);
  return movable.map(function (m) {
    return {
      code: String(m[codeId]),
      member: m,
      fromId: holders[m[codeId]].id,
      fromRef: holders[m[codeId]].ref
    };
  });
}

/** Records one request for each wanted member, unless the same one is already waiting. */
function recordTransfers_(form, team, wants) {
  if (!wants.length) return [];
  var waiting = readTransfers_(form).filter(function (t) {
    return t.status === 'pending' && t.toId === team.id;
  });
  return wants
    .filter(function (w) {
      return !waiting.some(function (t) {
        return t.code === w.code;
      });
    })
    .map(function (w) {
      return saveTransfer_(form, {
        id: uuid(),
        created: nowIso(),
        status: 'pending',
        code: w.code,
        member: w.member,
        fromId: w.fromId,
        fromRef: w.fromRef,
        toId: team.id,
        toRef: team.ref,
        decidedBy: ''
      });
    });
}

/** Closes the waiting requests of a team that no longer exists. */
function closeTransfersOf_(form, teamId) {
  readTransfers_(form).forEach(function (t) {
    if (t.status === 'pending' && (t.toId === teamId || t.fromId === teamId)) {
      t.status = 'closed';
      saveTransfer_(form, t);
    }
  });
}

/**
 * Answers a request. `by` is 'leader' or 'admin'; a leader may answer only a request for a
 * member of the team `fromId`. `next` is { leader, email }: who leads the team after a leader
 * that moves. Returns { transfer, underMin, handed }; `handed` is true when a leader moved.
 */
function decideTransfer_(form, id, approve, by, fromId, next) {
  var all = readTransfers_(form);
  var t = all.filter(function (x) {
    return x.id === String(id) && x.status === 'pending';
  })[0];
  if (!t || (fromId && t.fromId !== fromId))
    fail('transfer_gone', 'This request was already answered.');
  if (!approve) {
    t.status = 'rejected';
    t.decidedBy = by;
    return { transfer: saveTransfer_(form, t), underMin: false, handed: false };
  }
  var rows = readResponses(form);
  var mf = Rules.fieldByRole(form, 'members');
  var codeId = memberCodeId_(form);
  var range = Rules.teamSizeRange(form);
  var to = rows.filter(function (r) {
    return r.id === t.toId;
  })[0];
  if (!to) {
    t.status = 'closed';
    saveTransfer_(form, t);
    fail('transfer_gone', 'The team that asked no longer exists.');
  }
  var toList = Array.isArray(to.data[mf.id]) ? to.data[mf.id] : [];
  var most = mf.max == null ? range.max - 1 : mf.max;
  var has = function (list) {
    return list.some(function (m) {
      return String(m[codeId]) === t.code;
    });
  };
  if (!has(toList) && toList.length >= most)
    fail('transfer_full', 'The team that asked is full now.');

  var underMin = false,
    handed = false;
  rows.forEach(function (r) {
    if (r.id === to.id) return;
    var mine = Rules.membersOf(form, r.data).filter(function (m) {
      return m.code === t.code;
    })[0];
    if (!mine) return;
    if (mine.leader) {
      handOver_(form, r.data, next);
      handed = true;
    } else
      r.data[mf.id] = (r.data[mf.id] || []).filter(function (m) {
        return String(m[codeId]) !== t.code;
      });
    setTeamSize_(form, r.data);
    underMin = underMin || r.data[mf.id].length + 1 < range.min;
    applyDerived_(form, r);
    saveResponse_(form, r);
  });
  if (!has(toList)) {
    to.data[mf.id] = toList.concat([t.member]);
    setTeamSize_(form, to.data);
    applyDerived_(form, to);
    saveResponse_(form, to);
  }
  t.status = 'approved';
  t.decidedBy = by;
  saveTransfer_(form, t);
  // The student moved, so nobody else can be given the same student.
  all.forEach(function (x) {
    if (x.id !== t.id && x.status === 'pending' && x.code === t.code) {
      x.status = 'closed';
      saveTransfer_(form, x);
    }
  });
  return { transfer: t, underMin: underMin, handed: handed };
}

/** What a team sees about transfers: requests for its members, and its own requests. */
function teamTransfers_(form, team) {
  var all = readTransfers_(form);
  if (!all.length) return { incoming: [], outgoing: [] };
  var range = Rules.teamSizeRange(form);
  var people = Rules.membersOf(form, team.data);
  var contact = leaderContacts_(form);
  return {
    incoming: all
      .filter(function (t) {
        return t.status === 'pending' && t.fromId === team.id;
      })
      .map(function (t) {
        var m =
          people.filter(function (x) {
            return String(x.code) === t.code;
          })[0] || {};
        return Object.assign(
          {
            id: t.id,
            code: t.code,
            name: m.name || '',
            team: t.toRef,
            sizeAfter: Math.max(people.length - 1, 0),
            min: range.min
          },
          leaderAsked_(form, team, t.code),
          contact(t.toId)
        );
      }),
    outgoing: all
      .filter(function (t) {
        return t.toId === team.id && t.status !== 'cancelled';
      })
      .map(function (t) {
        return Object.assign(
          {
            id: t.id,
            code: t.code,
            name: t.member.name || '',
            team: t.fromRef,
            status: t.status
          },
          t.status === 'pending' ? contact(t.fromId) : {}
        );
      })
  };
}
