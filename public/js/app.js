var socket = io.connect('/');

socket.on('ping', function(data) {
	document.getElementById("ping").innerHTML = data.msg;
});
