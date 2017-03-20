$(function() {
	window.app = {};

	var app = window.app;
	var utils = window.utils;

	app.PlayerStates = {
		NOT_JOINED: 1,
		WAIT_PLAYERS: 2,
		YOUR_ATTACK: 3,
		THEY_ATTACK: 4,
		FINISH: 5
	},

	app.state = app.PlayerStates.NOT_JOINED;

	app.socket = io();

	$('#join_button').click(function() {
		if (app.state !== app.PlayerStates.NOT_JOINED)
			return;

		app.socket.emit(utils.ClientRequests.ON_JOIN, {
			battle_id: null,
			fleet_json: null,
			fleet_name: $('#fleet_name').val()
		});

		app.socket.on(utils.ServerResponses.ON_MESSAGE, function(data) {
			$('#server_message').text(data.msg);
		});

		app.socket.on(utils.ServerResponses.ON_JOIN, function(data) {
			$('#battle_id').text(data.battle_id);

			app.state = app.PlayerStates.WAIT_PLAYERS;
		});
	});
});
