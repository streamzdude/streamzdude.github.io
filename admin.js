
function Stream(stream) {
	stream = stream || {};
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.name = ko.observable(stream.name);
	this.type = ko.observable(stream.type);
	this.src = ko.observable(stream.src);
}

function VM() {
	var self = this;

	this.initialized = ko.observable(false);
	this.authData = ko.observable(null);
	this.streams = ko.observableArray();

	this.newStream = new Stream();
	this.newStream.hasFocus = ko.observable(true);

	this.removeStream = function(stream) {
		self.streams.remove(stream);
	};

	this.save = function() {
		if (!confirm('Sure you wanna overwrite all streams data?'))
			return;

		var streams = self.streams().reduce(function(currStreams, stream) {
			currStreams[stream.name()] = {
				type: stream.type(),
				src: stream.src()
			};
			['bufferlength', 'image', 'width', 'height'].forEach(function(prop) {
				if (typeof stream[prop] !== 'undefined') {
					currStreams[stream.name()][prop] = stream[prop];
				}
			});
			return currStreams;
		}, {});

		var streamsOrder = self.streams().map(function(stream) { return stream.name().replace(/,/g,'') }).join(",");

		firebase.child("streamsOrder").set(streamsOrder);

		firebase.child("streams").set(streams, function(error) {
			if (error) {
				console.log("failed saving streams:", error);
				alert(error.message);
			}
		});
	};

	this.addStream = function() {
		var stream = {
			name: self.newStream.name(),
			type: self.newStream.type(),
			src: self.newStream.src(),
			visible: true
		};
		self.streams.push(new Stream(stream));
		self.newStream.name('').type('jwplayer').src('').hasFocus(true);
	};

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



function listenForStreams() {
	firebase.child("streams").on("value", function(snapshot) {
		var fbStreams = snapshot.val();
		console.log("received streams:", fbStreams);

		var vmStreams = Object.keys(fbStreams).map(function(name) {
			return new Stream($.extend({name:name}, fbStreams[name]));
		});

		vm.streams(vmStreams);

	}, function (errorObject) {
  		console.log("Reading streams failed: ", errorObject.code);
	});
}




var vm = new VM();
ko.applyBindings(vm);

var firebase = new Firebase("https://streamz.firebaseio.com/admin");
var auth = firebase.getAuth();
//var auth = {uid:'lol', provider:'hehe'};
if (auth) {
	vm.authData( auth );
	listenForStreams();

}
vm.initialized(true);




