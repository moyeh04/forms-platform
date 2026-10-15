/** Every action of the web app and the handler that answers it. */

var API = API || {};

API['admin.login'] = AuthService.admin(AuthController.login);

API['admin.clients.list'] = AuthService.admin(ClientsController.list);
API['admin.clients.create'] = AuthService.admin(ClientsController.create);
API['admin.clients.update'] = AuthService.admin(ClientsController.update);
API['admin.clients.regenerate'] = AuthService.admin(
  ClientsController.regenerate
);
API['admin.clients.key'] = AuthService.admin(ClientsController.setKey);
API['admin.clients.showKey'] = AuthService.admin(ClientsController.showKey);
API['admin.clients.remove'] = AuthService.admin(ClientsController.remove);

API['viewer.me'] = ViewerController.me;
API['viewer.data'] = ViewerController.data;
API['viewer.review'] = ViewerController.review;

API['getForm'] = FormsController.getForm;
API['admin.forms.list'] = AuthService.admin(FormsController.list);
API['admin.forms.get'] = AuthService.admin(FormsController.get);
API['admin.forms.create'] = AuthService.admin(FormsController.create);
API['admin.forms.update'] = AuthService.admin(FormsController.update);
API['admin.forms.duplicate'] = AuthService.admin(FormsController.duplicate);
API['admin.forms.delete'] = AuthService.admin(FormsController.remove);

API['admin.lists.get'] = AuthService.admin(ListsController.get);
API['admin.lists.set'] = AuthService.admin(ListsController.set);
API['admin.lists.create'] = AuthService.admin(ListsController.create);
API['admin.lists.rename'] = AuthService.admin(ListsController.rename);
API['admin.lists.delete'] = AuthService.admin(ListsController.remove);

API['admin.keys.list'] = AuthService.admin(KeysController.list);
API['admin.keys.extend'] = AuthService.admin(KeysController.extend);

API['transfer.decide'] = TransfersController.transferDecide;
API['transfer.cancel'] = TransfersController.cancel;
API['admin.transfer.decide'] = AuthService.admin(
  TransfersController.adminTransferDecide
);
