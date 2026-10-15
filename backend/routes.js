/** Every action of the web app and the handler that answers it. */

var API = API || {};

API['admin.login'] = AuthService.admin(AuthController.login);
