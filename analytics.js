var $ = require('jquery');
var Firebase = require('firebase');

var noAnalytics = localStorage['no-analytics'] === 'true';

module.exports = function initAnalytics(firebase) {
	firebase.child('stats/hits').transaction(function(i){ return (i||0)+1 });
	if (noAnalytics) {
		var o = {child: f, transaction: f, update: f, push: f, set: f, key: function(){ return 'no-analytics' }};
		function f() { return o }
		return o;
	}
	else {
		var session = firebase.child('stats/sessions').push();
		session.update({
				browserDate: new Date().toString(),
				started: Firebase.ServerValue.TIMESTAMP
		});
		session.onDisconnect().update({ended: Firebase.ServerValue.TIMESTAMP});

		$.getJSON('http://ip-api.com/json').done(function(data) {
			ip = data.query;
			session.update({ipData:data, ip: ip});
		}).fail(function() {
			$.get('http://icanhazip.com').done(function(data) {
				ip = data.trim();
				session.update({ip: ip});
			});
		});

		return session;
	}
}
