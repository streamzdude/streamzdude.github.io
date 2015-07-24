var firebase = new Firebase("https://streamz.firebaseio.com/");

$('#loginBut').click(login);

function login() {
	firebase.authWithOAuthPopup("google", function(error, authData) {
	  if (error) {
	    console.log("Login Failed!", error);
	  } else {
	    console.log("Authenticated successfully with payload:", authData);
	  }
	});
}