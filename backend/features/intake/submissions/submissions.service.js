/**
 * Submissions: checking the answers, saving a new one, changing and
 * cancelling one, and what the student sees of it.
 */

var SubmissionsService = (function () {
  /**
   * Gives what a student sees of a submission.
   *
   * @param {!Object} r The submission.
   * @return {!Object} Its ref, status, times and answers.
   */
  function publicSubmission_(r) {
    return {
      ref: r.ref,
      status: r.status,
      created: r.created,
      updated: r.updated,
      data: r.data
    };
  }

  /**
   * Says whether a task is locked. A task is handed in by its deadline: once
   * the form stops taking answers, a key still opens the task but can no
   * longer change or cancel it. Opening the form again lifts the lock.
   *
   * @param {!Object} form The form.
   * @return {boolean} True for a task form that is not open.
   */
  function taskLocked_(form) {
    return (
      form.type === FormType.TASK_SUBMISSION && Rules.formState(form) !== 'open'
    );
  }

  /**
   * Refuses a change to a locked task.
   *
   * @param {!Object} form The form.
   * @throws {ApiError} `deadline_passed`.
   */
  function assertTaskOpen_(form) {
    if (taskLocked_(form))
      ApiError.fail(
        'deadline_passed',
        'The deadline has passed, so this task can no longer be changed.'
      );
  }

  /**
   * Gives what a key may change. A booking that may be cancelled may also
   * move to another time, since cancelling and booking again does the same.
   * A booking made with a team's key holds that team's answers, so only its
   * slot ever changes.
   *
   * @param {!Object} form The form.
   * @return {string} `all`, `slot`, or an empty string for nothing.
   */
  function editScope_(form) {
    if (taskLocked_(form)) return '';
    var edit = !!form.editKey.allowEdit;
    if (form.type !== FormType.RESERVATION) return edit ? 'all' : '';
    var keyBooking = !!KeyBookingService.keyBookingSource(form);
    if (edit && !keyBooking) return 'all';
    return edit || form.editKey.allowDelete ? 'slot' : '';
  }

  /**
   * Validates answers and their Drive links.
   *
   * @param {!Object} vform The form as it validates.
   * @param {?Object} answers The answers as sent.
   * @return {!Object} The cleaned answers.
   * @throws {ApiError} `invalid` with the error of each answer.
   */
  function checkedAnswers_(vform, answers) {
    var v = Rules.validateSubmission(vform, answers || {});
    if (!v.ok) ApiError.fail('invalid', 'Some answers need fixing.', v.errors);
    DriveLinks.checkDriveFields(vform, v.data);
    return v.data;
  }

  /**
   * Makes the answers of a booking made with a registration key: they come
   * from the registration the key opens, and the student only picks the
   * slot.
   *
   * @param {!Object} vform The booking form as it validates.
   * @param {!Object} source The registration form the key belongs to.
   * @param {*} sourceKey The registration key.
   * @param {?Object} answers The answers as sent, for the slot.
   * @return {!Object} The answers, with `_source` naming the registration.
   */
  function keyBookingAnswers_(vform, source, sourceKey, answers) {
    var registration = KeyBookingService.registrationByKey(source, sourceKey);
    var slotField = Rules.fieldByRole(vform, 'slot');
    var data = KeyBookingService.bookingData(
      vform,
      source,
      registration,
      answers?.[slotField.id]
    );
    data._source = { form: source.id, ref: registration.ref };
    return data;
  }

  /**
   * Checks the limits of a new submission. A key booking that repeats a
   * team is told the team has a booking already.
   *
   * @param {!Object} vform The form as it validates.
   * @param {!Object} data The answers.
   * @param {!Array<!Object>} live The live submissions.
   * @param {boolean} keyBooking True for a booking made with a key.
   * @throws {ApiError} When a limit is broken.
   */
  function checkNewLimits_(vform, data, live, keyBooking) {
    try {
      ResponsesRules.checkLimits(vform, data, live, null);
    } catch (e) {
      if (keyBooking && e.code === 'duplicate')
        ApiError.fail(
          'already_booked',
          'Your team already has a booking. ' +
            'Open it with your key to change its time.'
        );
      throw e;
    }
  }

  /**
   * Makes a new submission with its key.
   *
   * @param {!Object} form The form.
   * @param {!Object} vform The form as it validates.
   * @param {!Object} data The answers.
   * @param {{key: string, hash: string}} k The key and its hash.
   * @return {!Object} The submission, not saved yet.
   */
  function newResponse_(form, vform, data, k) {
    var id = Crypto.uuid();
    return ResponsesRepository.applyDerived(vform, {
      id: id,
      ref: ResponsesRepository.nextRef(form),
      created: Time.nowIso(),
      status: 'new',
      review: ResponsesReview.defaultReview(form),
      data: data,
      keyHash: k.hash,
      keyExpires: KeysService.keyExpiry(form),
      deleted: false,
      keySeal: KeysService.sealKey(form, id, k.key)
    });
  }

  /**
   * Saves a new submission under the lock. Members that another team holds
   * are asked for, not saved with this team.
   *
   * @param {!Object} form The form.
   * @param {!Object} vform The form as it validates.
   * @param {!Object} data The answers.
   * @param {{source: ?Object, sourceKey: *, transfer: *}} how The form a
   *     key booking comes from, its key, and the members asked for.
   * @return {!Object} The id, ref, key, key end and asked transfers.
   */
  function addSubmission_(form, vform, data, how) {
    return Lock.withLock(function () {
      var rows = ResponsesRepository.readResponses(form, true);
      var live = rows.filter(function (r) {
        return !r.deleted;
      });
      var wants = how.source
        ? []
        : TransfersService.takeOutTransfers(vform, data, live, {
            selfId: null,
            asked: how.transfer
          });
      checkNewLimits_(vform, data, live, !!how.source);
      var k = how.source
        ? KeysService.bookingKey(vform, live, how.sourceKey)
        : KeysService.issueKey(vform, live);
      var r = newResponse_(form, vform, data, k);
      rows.push(r);
      TeamNumbers.keepTeamNumbers(form, rows);
      ResponsesRepository.saveResponse(form, r);
      return {
        id: r.id,
        ref: r.ref,
        key: form.editKey.enabled ? k.key : '',
        keyExpires: r.keyExpires,
        asked: TransfersService.recordTransfers(form, r, wants)
      };
    });
  }

  /**
   * Saves new answers to a submission a student opened with a key.
   *
   * @param {!Object} form The form.
   * @param {!Object} vform The form as it validates.
   * @param {string} id The id of the submission.
   * @param {{data: !Object, transfer: *}} change The new answers and the
   *     members asked for from other teams.
   * @return {!Array<!Object>} The transfers it asked for.
   * @throws {ApiError} `bad_key` when the submission is gone.
   */
  function editSubmission_(form, vform, id, change) {
    var data = change.data;
    return Lock.withLock(function () {
      var live = ResponsesRepository.readResponses(form);
      var current = live.filter(function (r) {
        return r.id === id;
      })[0];
      if (!current) ApiError.fail('bad_key', 'That key is not right.');
      var wants = TransfersService.takeOutTransfers(vform, data, live, {
        selfId: current.id,
        asked: change.transfer
      });
      ResponsesRules.checkLimits(vform, data, live, current.id);
      current.data = data;
      ResponsesRepository.applyDerived(vform, current);
      ResponsesRepository.saveResponse(form, current);
      return TransfersService.recordTransfers(form, current, wants);
    });
  }

  /**
   * Finishes a save that asked for members of other teams: emails their
   * leaders, and adds the saved answers, which no longer hold those members.
   *
   * @param {!Object} form The form.
   * @param {!Object} result The answer of the save, with `asked`.
   * @param {!Object} data The saved answers.
   * @return {!Object} The answer, without `asked`, with the transfers.
   */
  function transferResult_(form, result, data) {
    var asked = result.asked || [];
    delete result.asked;
    if (!asked.length) return result;
    asked.forEach(function (t) {
      TransfersMail.mailTransfer(form, t, 'asked');
    });
    var contact = TransfersView.leaderContacts(form);
    result.data = data;
    result.transfers = asked.map(function (t) {
      return Object.assign(
        { code: t.code, name: t.member.name || '', team: t.fromRef },
        contact(t.fromId)
      );
    });
    return result;
  }

  /**
   * Cancels a live registration: the row stays, marked deleted, without its
   * key, and its member requests are closed. A team keeps its number, so the
   * teams after it do not move up. Call it inside Lock.withLock.
   *
   * @param {!Object} form The form.
   * @param {string} id The id of the registration.
   * @return {?Object} The row, or null when there is no such live
   *     registration.
   */
  function cancelResponse_(form, id) {
    var rows = ResponsesRepository.readResponses(form, true);
    var r = rows.filter(function (x) {
      return x.id === id && !x.deleted;
    })[0];
    if (!r) return null;
    TeamNumbers.keepTeamNumbers(form, rows);
    r.deleted = true;
    r.keyHash = '';
    r.keySeal = '';
    ResponsesRepository.saveResponse(form, r);
    TransfersService.closeTransfersOf(form, r.id);
    return r;
  }

  /**
   * Cancels a live registration under the lock.
   *
   * @param {!Object} form The form.
   * @param {string} id The id of the registration.
   * @return {boolean} True when it cancelled one.
   */
  function cancelSubmission_(form, id) {
    return Lock.withLock(function () {
      return !!cancelResponse_(form, id);
    });
  }

  return {
    publicSubmission: publicSubmission_,
    taskLocked: taskLocked_,
    assertTaskOpen: assertTaskOpen_,
    editScope: editScope_,
    checkedAnswers: checkedAnswers_,
    keyBookingAnswers: keyBookingAnswers_,
    addSubmission: addSubmission_,
    editSubmission: editSubmission_,
    transferResult: transferResult_,
    cancelResponse: cancelResponse_,
    cancelSubmission: cancelSubmission_
  };
})();
