$(function() {
	window.app = {};

	var app = window.app;
	var utils = window.utils;

	app.PlayerStates = {
		NOT_CONNECTED: 1,
		NOT_JOINED: 2,
		WAIT_PLAYERS: 3,
		YOUR_ATTACK: 4,
		THEY_ATTACK: 5,
		FINISH: 6
	},

	app.state = app.PlayerStates.NOT_CONNECTED;

	app.socket = null;

	$('#join_button').click(function() {
		if (app.state !== app.PlayerStates.NOT_CONNECTED)
			return;

		app.socket = io();

		app.socket.emit(utils.ClientRequests.ON_JOIN, {});

		app.state = app.PlayerStates.NOT_JOINED;

		app.socket.on(utils.ServerResponses.ON_JOIN, function(data) {
			$('#battle_id').text(data.battle_id);

			app.state = app.PlayerStates.WAIT_PLAYERS;
		});
	});
});
