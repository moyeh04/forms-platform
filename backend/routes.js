/**
 * Every action of the web app: who may call it and the handler that answers
 * it. The router refuses a row without a valid access, so no action is open
 * by accident.
 */

var Routes = Router.create(
  [
    {
      action: 'admin.login',
      access: Access.ADMIN,
      handler: AuthController.login
    },
    {
      action: 'admin.clients.list',
      access: Access.ADMIN,
      handler: ClientsController.list
    },
    {
      action: 'admin.clients.create',
      access: Access.ADMIN,
      handler: ClientsController.create
    },
    {
      action: 'admin.clients.update',
      access: Access.ADMIN,
      handler: ClientsController.update
    },
    {
      action: 'admin.clients.regenerate',
      access: Access.ADMIN,
      handler: ClientsController.regenerate
    },
    {
      action: 'admin.clients.key',
      access: Access.ADMIN,
      handler: ClientsController.setKey
    },
    {
      action: 'admin.clients.showKey',
      access: Access.ADMIN,
      handler: ClientsController.showKey
    },
    {
      action: 'admin.clients.remove',
      access: Access.ADMIN,
      handler: ClientsController.remove
    },
    {
      action: 'viewer.me',
      access: Access.CLIENT,
      handler: ViewerController.me
    },
    {
      action: 'viewer.data',
      access: Access.CLIENT,
      handler: ViewerController.data
    },
    {
      action: 'viewer.review',
      access: Access.CLIENT,
      handler: ViewerController.review
    },
    {
      action: 'viewer.progress.mark',
      access: Access.CLIENT,
      handler: ProgressController.viewerMark
    },
    {
      action: 'getForm',
      access: Access.PUBLIC,
      handler: FormsController.getForm
    },
    {
      action: 'admin.forms.list',
      access: Access.ADMIN,
      handler: FormsController.list
    },
    {
      action: 'admin.forms.get',
      access: Access.ADMIN,
      handler: FormsController.get
    },
    {
      action: 'admin.forms.create',
      access: Access.ADMIN,
      handler: FormsController.create
    },
    {
      action: 'admin.forms.update',
      access: Access.ADMIN,
      handler: FormsController.update
    },
    {
      action: 'admin.forms.duplicate',
      access: Access.ADMIN,
      handler: FormsController.duplicate
    },
    {
      action: 'admin.forms.delete',
      access: Access.ADMIN,
      handler: FormsController.remove
    },
    {
      action: 'admin.lists.get',
      access: Access.ADMIN,
      handler: ListsController.get
    },
    {
      action: 'admin.lists.set',
      access: Access.ADMIN,
      handler: ListsController.set
    },
    {
      action: 'admin.lists.create',
      access: Access.ADMIN,
      handler: ListsController.create
    },
    {
      action: 'admin.lists.rename',
      access: Access.ADMIN,
      handler: ListsController.rename
    },
    {
      action: 'admin.lists.delete',
      access: Access.ADMIN,
      handler: ListsController.remove
    },
    {
      action: 'admin.keys.list',
      access: Access.ADMIN,
      handler: KeysController.list
    },
    {
      action: 'admin.keys.extend',
      access: Access.ADMIN,
      handler: KeysController.extend
    },
    {
      action: 'transfer.decide',
      access: Access.KEY,
      handler: TransfersController.transferDecide
    },
    {
      action: 'transfer.cancel',
      access: Access.KEY,
      handler: TransfersController.cancel
    },
    {
      action: 'admin.transfer.decide',
      access: Access.ADMIN,
      handler: TransfersController.adminTransferDecide
    },
    {
      action: 'bookingTeam',
      access: Access.KEY,
      handler: KeyBookingController.bookingTeam
    },
    {
      action: 'admin.bookings.next',
      access: Access.ADMIN,
      handler: KeyBookingController.next
    },
    {
      action: 'admin.submissions',
      access: Access.ADMIN,
      handler: AdminSubmissionsController.submissions
    },
    {
      action: 'admin.submission.update',
      access: Access.ADMIN,
      handler: AdminSubmissionsController.update
    },
    {
      action: 'admin.submission.delete',
      access: Access.ADMIN,
      handler: AdminSubmissionsController.remove
    },
    {
      action: 'admin.submission.resetKey',
      access: Access.ADMIN,
      handler: AdminSubmissionsController.resetKey
    },
    {
      action: 'admin.submission.key',
      access: Access.ADMIN,
      handler: AdminSubmissionsController.submissionKey
    },
    {
      action: 'admin.progress.mark',
      access: Access.ADMIN,
      handler: ProgressController.adminMark
    },
    {
      action: 'submit',
      access: Access.PUBLIC,
      handler: SubmissionsController.submit
    },
    {
      action: 'lookup',
      access: Access.KEY,
      handler: SubmissionsController.lookup
    },
    {
      action: 'progress.mine',
      access: Access.KEY,
      handler: ProgressController.mine
    },
    {
      action: 'update',
      access: Access.KEY,
      handler: SubmissionsController.update
    },
    {
      action: 'remove',
      access: Access.KEY,
      handler: SubmissionsController.remove
    },
    {
      action: 'admin.matching.import',
      access: Access.ADMIN,
      handler: MatchingController.importNumbers
    },
    {
      action: 'admin.matching.list',
      access: Access.ADMIN,
      handler: MatchingController.list
    },
    {
      action: 'admin.matching.decide',
      access: Access.ADMIN,
      handler: MatchingController.decide
    },
    {
      action: 'admin.matching.remove',
      access: Access.ADMIN,
      handler: MatchingController.remove
    },
    {
      action: 'admin.views.rebuild',
      access: Access.ADMIN,
      handler: SheetViewsController.rebuild
    },
    {
      action: 'admin.download.start',
      access: Access.ADMIN,
      handler: DownloadsController.start
    },
    {
      action: 'admin.download.team',
      access: Access.ADMIN,
      handler: DownloadsController.downloadTeam
    },
    {
      action: 'admin.download.finish',
      access: Access.ADMIN,
      handler: DownloadsController.finish
    },
    {
      action: 'admin.download.pack',
      access: Access.ADMIN,
      handler: DownloadsController.pack
    },
    {
      action: 'admin.download.chunk',
      access: Access.ADMIN,
      handler: DownloadsController.chunk
    },
    {
      action: 'admin.print.reservations',
      access: Access.ADMIN,
      handler: PrintController.reservations
    },
    {
      action: 'admin.print.teamList',
      access: Access.ADMIN,
      handler: PrintController.teamList
    }
  ],
  {
    requireAdmin: AuthService.requireAdmin,
    requireClient: ClientsAccess.requireClient
  }
);
