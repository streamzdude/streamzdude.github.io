var $ = require('jquery');
var ko = require('knockout');
var Firebase = require('firebase');
var moment = require('moment');

function Stream(stream) {
	stream = stream || {};
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.name = ko.observable(stream.name || '');
	this.type = ko.observable(stream.type || 'jwplayer');
	this.src = ko.observable(stream.src || '');
}

function Session(data) {
	data = data || {};
	$.extend(this, data);
	
	this.ip = data.ip || (data.ipData && data.ipData.query) || 'n/a';
	this.ipData = data.ipData || null;
	this.location = data.ipData && (data.ipData.country + '/' + data.ipData.city) ||  '';
	this.timeStr = 'n/a';
	this.duration = 'n/a';
	this.streamsStr = data.openWindow && Object.keys(data.openWindow).map(function(key) { return data.openWindow[key] }).join(', ') || '';

	if (data.started) {
		this.timeStr = moment(data.started).format("D/M/Y HH:mm:ss");
		var h = 0, m = 0, s = Math.round(moment.duration((data.ended || Date.now()) - data.started).asSeconds());
		if (s >= 60) {
			m = Math.floor(s / 60);
			s = s % 60;
		}
		if (m >= 60) {
			h = Math.floor(m / 60);
			m = m % 60;
		}
		this.duration = (h ? h + ' hr' + (h>1?'s ':' ') : '') + (m ? m + ' min' + (m>1?'s ':' ') : '') + s + ' sec' + (s!==1?'s':'');
		if (!data.ended) {
			this.duration += '~';
		}
	}
}

function VM() {
	var self = this;

	this.initialized = ko.observable(false);
	this.authData = ko.observable(null);
	this.streams = ko.observableArray();
	this.sessions = ko.observableArray();

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
			visible: self.newStream.visible()
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
	firebase.child("admin").on("value", function(snapshot) {
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

	firebase.child("stats/sessions").limitToLast(50).on("value", function(snapshot) {
		var data = snapshot.val();
		var sessions = Object.keys(data).map(function(key) { return new Session(data[key]) }).reverse();
		console.log("sessions: ", sessions);
		vm.sessions(sessions);
	}, function (error) {
  		console.log("Reading sessions failed: ", error.code);
	});
}




var vm = new VM();
ko.applyBindings(vm);

var firebase = new Firebase("https://streamz.firebaseio.com/");
var auth = firebase.getAuth();
//var auth = {uid:'lol', provider:'hehe'};
if (auth) {
	vm.authData( auth );
	listenForStreams();

}
vm.initialized(true);





