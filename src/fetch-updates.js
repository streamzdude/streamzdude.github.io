var firebase = require('firebase');
var $ = require('jquery');

module.exports = function fetchUpdates(vm, analytics) {
	var db = firebase.database().ref();
	db.child("admin").on("value", function(snapshot) {
		var data = snapshot.val();

		vm.streams().forEach(function(vmStream) {
			var serverStream = data.streams[vmStream.name()];
			if (serverStream) {
				const srcChanged = vmStream.src() !== serverStream.src;
				vmStream.type(serverStream.type).src(serverStream.src).isServerStream(true);
				delete data.streams[vmStream.name()];
				if (srcChanged && vmStream.window()) {
					vm.reloadWindow( vmStream.window() );
				}
			}
		});

		var newStreams = data.streamsOrder.split(',')
			.filter(function(name) { return data.streams[name] })
			.map(function(name) {
				return vm.newStreamObj($.extend({name:name}, data.streams[name]));
			});

		if (newStreams.length > 0)
			vm.streams(vm.streams().concat(newStreams));

		vm.save(); // save updated streams to local storage

	}, function(error) {
		console.log("Reading streams failed: ", error.code);
	});


	db.child("news").limitToLast(10).on("value", function(snapshot) {
		var items = snapshot.val();
		if (!items) return;
		items = Object.keys(items).map(function(key) { return items[key]; });
		vm.newsItems(items).showNews(true);
		setTimeout(function() { vm.showNews(false) }, 20000);
	});


	db.child("shoutbox").limitToLast(100).on("value", function(snapshot) {	
		var items = snapshot.val();
		if (!items) return;
		items = Object.keys(items).map(function(key) { return items[key]; });
		vm.shoutbox.items(items);
	});


	db.child("admin/obsoleteStreams").once("value", function(snapshot) {
		var streams = (snapshot.val() || "").split(",");
		var removedStreams = [];
		streams.forEach(function(deadStreamName) {
			var stream = vm.streams().filter(function(vmStream) { return vmStream.name() === deadStreamName })[0];
			if (!stream) return;
			if (stream.window()) {
				vm.windows.remove(stream.window());
			}

			removedStreams.push(stream.name())
			vm.streams.remove(stream);
			console.log('removing obsolete stream: ', stream.name());
		});
		if (removedStreams.length > 0) {		
			vm.save();
			analytics.child('removeObsolete').transaction(function(val) { return (val||'')+removedStreams.join(', ') });
		}
	});

}
