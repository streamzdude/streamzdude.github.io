
function Stream(stream) {
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.window = ko.observable();
	this.name = ko.observable(stream.name);
	this.type = ko.observable(stream.type);
	this.src = ko.observable(stream.src);
}

function VM() {
	var self = this;

	this.initialized = ko.observable(false);
	this.authData = ko.observable(null);
	this.streams = ko.observableArray();

	this.login = function () {
		firebase.authWithOAuthPopup("google", function(error, authData) {
		  if (error) {
		    console.log("Login Failed!", error);
		  } else {
		    console.log("Authenticated successfully with payload:", authData);
		    self.authData(authData);
		    listenForStreams();
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

var firebase = new Firebase("https://streamz.firebaseio.com/admin");
var auth = firebase.getAuth();
if (auth) {
	vm.authData( auth );
	listenForStreams();
}
vm.initialized(true);

function listenForStreams() {
	firebase.child("streams").on("value", function(snapshot) {
		var fbStreams = snapshot.val();
		console.log("fbStreams");
	});
}
