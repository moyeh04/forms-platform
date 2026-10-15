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
