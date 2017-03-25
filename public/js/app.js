$(function () {
  window.app = {};

  var app = window.app;
  var utils = window.utils;

  app.PlayerStates = {
    NOT_JOINED: 1,
    WAIT_PLAYERS: 2,
    YOUR_ATTACK: 3,
    THEY_ATTACK: 4,
    FINISH: 5
  }

  app.state = app.PlayerStates.NOT_JOINED;

  app.socket = io('/', {
    reconnection: false
  });

  $('#join_button').click(function () {
    if (app.state !== app.PlayerStates.NOT_JOINED) {
      return;
    }

    var battleId = null
    if (window.location.pathname.length > 1) {
      battleId = window.location.pathname.substring(1);
    }

    app.socket.emit(utils.ClientRequests.ON_JOIN, {
      battleId: battleId,
      fleetJson: null,
      fleetName: $('#fleet_name').val()
    });

    app.socket.on(utils.ServerResponses.ON_MESSAGE, function (data) {
      $('#server_message').text(data.msg);
    });

    app.socket.on(utils.ServerResponses.ON_JOIN, function (data) {
      $('#battle_id').text(data.battleId);
      $('#battle_id').attr('href', data.battleId);

      app.state = app.PlayerStates.WAIT_PLAYERS;
    });

    app.socket.on(utils.ServerResponses.ON_YOUR_ATTACK, function (data) {
      app.state = app.PlayerStates.YOUR_ATTACK;
      console.log('Your attack!')
    });

    app.socket.on(utils.ServerResponses.ON_THEY_ATTACK, function (data) {
      app.state = app.PlayerStates.THEY_ATTACK;
      console.log('Defend yourself!')
    });
  });
});
