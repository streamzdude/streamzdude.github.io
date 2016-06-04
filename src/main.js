require('jquery');
require('jquery-ui');
var ko = require('knockout');
var firebase = require('firebase');

require('./jquery-ui-extensions');
require('./timeago');
require('./windows');
var initAnalytics = require('./analytics');
var fetchUpdates = require('./fetch-updates');
var StreamzVM = require('./viewmodel');

var dataVersion = 1;

var firebaseConfig = {
    apiKey: "AIzaSyB9h7b57i824rNibGYMN-s-4EuIJyXbqvk",
    authDomain: "streamz.firebaseapp.com",
    databaseURL: "https://streamz.firebaseio.com",
    storageBucket: "project-2755015809000717199.appspot.com",
};
firebase.initializeApp(firebaseConfig);

var analytics = initAnalytics();
var vm = new StreamzVM(analytics, dataVersion);

var localData = JSON.parse(localStorage["streamzData"] || '{}');
if (localData.ver === dataVersion) {
	vm.load(localData);
}
else {
	localStorage.removeItem("streamzData");
}

ko.applyBindings(vm);

fetchUpdates(vm, analytics);
