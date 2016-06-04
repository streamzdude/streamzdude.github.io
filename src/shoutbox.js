var $ = require('jquery');
var ko = require('knockout');
var firebase = require('firebase');

module.exports = createShoutbox;

var shoutboxName;
if (localStorage["streamzShoutboxName"])
	shoutboxName = localStorage["streamzShoutboxName"];
else {
	localStorage["streamzShoutboxName"] = shoutboxName = ('anon' + Math.floor(Math.random()*1000));
}

function createShoutbox(analytics) {
	var db = firebase.database().ref();

	var shoutbox = {
		items: ko.observableArray([]),
		message: ko.observable(''),
		name: ko.observable(shoutboxName)
			    .extend({rateLimit: {method: "notifyWhenChangesStop", timeout: 300}}),
		onKeyPress: function(data, event) {
			if (event.which !== 13) return true;
			if (shoutbox.message().trim().length === 0 || 
				shoutbox.name().trim().length === 0) return true;

			db.child("shoutbox").push({
				msg: shoutbox.message(),
				name: shoutbox.name(),
				time: firebase.database.ServerValue.TIMESTAMP,
				sessionId: analytics.key
			});

			shoutbox.message('');
		}
	};

	// scroll shoutbox to bottom when items are updated:
	shoutbox.items.subscribe(function() {
		var container = $('.shoutbox-items-container')[0];
		if (!container) return;

		var isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 1;
		setTimeout(function() {
			if (isScrolledToBottom) 
	    		container.scrollTop = container.scrollHeight - container.clientHeight;
		}, 0);
	});

	shoutbox.name.subscribe(function(name) {		
		localStorage["streamzShoutboxName"] = shoutboxName = name;
	});

	return shoutbox;
}


