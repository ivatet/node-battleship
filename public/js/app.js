$(function () {
  window.app = {};

  var app = window.app;
  var utils = window.utils;

  app.PlayerStates = {
    EMPTY: 1,
    WAIT: 2,
    ATTACK: 3,
    DEFEND: 4,
    FINISH: 5
  }

  app.state = app.PlayerStates.EMPTY;

  app.socket = io('/', {
    reconnection: false
  });

  app.setState = function (newState) {
    console.log('new state is ' + newState);
    app.state = newState;
  };

  /* Handle UI controls */
  $('#joinButton').click(function () {
    if (app.state !== app.PlayerStates.EMPTY) {
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
  });

  $('#fleetNameInput').keypress(function (e) {
    var code = e.which;
    if (code === 13) {
      $('#joinButton').click();
      e.preventDefault();
    }
  });

  /* Handle server reponses */
  app.socket.on(utils.ServerResponses.ON_REJECT, function (data) {
    $('#serverMessage').text(data.msg);
  });

  app.socket.on(utils.ServerResponses.ON_ACCEPT, function (data) {
    $('#battleId').text(data.battleId);
    $('#battleId').attr('href', data.battleId);

    app.setState(app.PlayerStates.WAIT);
  });

  app.socket.on(utils.ServerResponses.ON_ATTACK, function (data) {
    app.setState(app.PlayerStates.ATTACK);
  });

  app.socket.on(utils.ServerResponses.ON_DEFEND, function (data) {
    app.setState(app.PlayerStates.DEFEND);
  });
});
