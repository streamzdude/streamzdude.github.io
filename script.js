require('jquery');
require('jquery-ui');
var ko = require('knockout');
var Firebase = require('firebase');

require('./jquery-ui-extensions');
require('./timeago');
require('./windows');
var initAnalytics = require('./analytics');
var fetchUpdates = require('./fetch-updates');
var StreamzVM = require('./viewmodel');

var dataVersion = 1;
var database = new Firebase("https://streamz.firebaseio.com/");
var analytics = initAnalytics(database);
var vm = new StreamzVM(database, analytics, dataVersion);

var localData = JSON.parse(localStorage["streamzData"] || '{}');
if (localData.ver === dataVersion) {
	vm.load(localData);
}
else {
	localStorage.removeItem("streamzData");
}

ko.applyBindings(vm);

fetchUpdates(vm, database, analytics);
