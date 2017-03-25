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

  app.setState = function (newState) {
    console.log('new state is ' + newState);
    app.state = newState;
  };

  $('#joinButton').click(function () {
    if (app.state !== app.PlayerStates.NOT_JOINED) {
      return;
    }

    var battleId = null;

    if (window.location.pathname.length > 1) {
      battleId = window.location.pathname.substring(1);
    }

    app.socket.emit(utils.ClientRequests.ON_JOIN, {
      battleId: battleId,
      fleetJson: null,
      fleetName: $('#fleetNameInput').val()
    });

    app.socket.on(utils.ServerResponses.ON_MESSAGE, function (data) {
      $('#serverMessage').text(data.msg);
    });

    app.socket.on(utils.ServerResponses.ON_JOIN, function (data) {
      $('#battleId').text(data.battleId);
      $('#battleId').attr('href', data.battleId);

      app.setState(app.PlayerStates.WAIT_PLAYERS);
    });

    app.socket.on(utils.ServerResponses.ON_YOUR_ATTACK, function (data) {
      app.setState(app.PlayerStates.YOUR_ATTACK);
    });

    app.socket.on(utils.ServerResponses.ON_THEY_ATTACK, function (data) {
      app.setState(app.PlayerStates.THEY_ATTACK);
    });
  });

  $('#fleetNameInput').keypress(function (e) {
    var code = e.which;
    if (code === 13) {
      $('#joinButton').click();
      e.preventDefault();
    }
  });
});
