
function VM() {
	var self = this;

	this.initialized = ko.observable(false);
	this.authData = ko.observable(null);

	this.login = function () {
		firebase.authWithOAuthPopup("google", function(error, authData) {
		  if (error) {
		    console.log("Login Failed!", error);
		  } else {
		    console.log("Authenticated successfully with payload:", authData);
		    self.authData(authData);
		  }
		});
	};

	this.logout = function() {
		firebase.unauth();
		self.authData(null);
	}
}

var vm = new VM();
ko.applyBindings(vm);

var firebase = new Firebase("https://streamz.firebaseio.com/");
var authdata = firebase.getAuth();
if (authdata) {
	console.log("Logged in: " + authdata.uid + " (" + authdata.provider + ")");
	vm.authData(authdata);
}
vm.initialized(true);