
function Stream(stream) {
	stream = stream || {};
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.name = ko.observable(stream.name || '');
	this.type = ko.observable(stream.type || 'jwplayer');
	this.src = ko.observable(stream.src || '');
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
			var name = stream.name() || '-';
			currStreams[name] = {
				type: stream.type(),
				src: stream.src(),
				visible: stream.visible()
			};
			['bufferlength', 'image', 'width', 'height'].forEach(function(prop) {
				if (typeof stream[prop] !== 'undefined') {
					currStreams[name][prop] = stream[prop];
				}
			});
			return currStreams;
		}, {});

		var streamsOrder = self.streams().map(function(stream) { return stream.name().replace(/,/g,'') }).join(",");

		firebase.set({streams: streams, streamsOrder: streamsOrder}, function(error) {
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
	firebase.on("value", function(snapshot) {
		var data = snapshot.val();
		console.log("received data:", data);

		var streams = data.streamsOrder.split(',')
			.map(function(name) {
				return new Stream($.extend({name:name}, data.streams[name]));
			});

		vm.streams(streams);

	}, function (error) {
  		console.log("Reading streams failed: ", error.code);
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





