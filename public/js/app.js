$(function () {
  window.app = {}

  var app = window.app
  var utils = window.utils

  app.PlayerStates = {
    EMPTY: 1,
    WAIT: 2,
    ATTACK: 3,
    DEFEND: 4,
    FINISH: 5
  }

  app.state = app.PlayerStates.EMPTY

  app.socket = io('/', {
    reconnection: false
  })

  app.setState = function (newState) {
    app.state = newState
  }

  app.showAlert = function (alertId) {
    $('.custom-alert').each(function () {
      if (!$(this).hasClass('hidden')) {
        $(this).addClass('hidden')
      }
    })
    $(alertId).removeClass('hidden')
  }

  /* Handle UI controls */
  $('#join-button').click(function () {
    if (app.state !== app.PlayerStates.EMPTY) {
      return
    }

    var battleId = null

    if (window.location.pathname.length > 1) {
      battleId = window.location.pathname.substring(1)
    }

    app.socket.emit(utils.ClientRequests.ON_JOIN, {
      battleId: battleId,
      fleet: window.tmp.fleet,
    })
  })

  $('#shuffle-button').click(function () {
    window.tmp.fleet = utils.createFleet()
    var canvas = utils.renderFleet(window.tmp.fleet)
    canvas.forEach(function (p, i) {
      var cell = $('#' + utils.localCellId(i))
      cell.removeClass(utils.cellStyle(utils.CellTypes.EMPTY))
      cell.removeClass(utils.cellStyle(utils.CellTypes.SHIP))
      cell.addClass(utils.cellStyle(p))
    })
  })

  $('#fleet-name-input').keypress(function (e) {
    var code = e.which
    if (code === 13) {
      $('#join-button').click()
      e.preventDefault()
    }
  })

  /* Handle server reponses */
  app.socket.on(utils.ServerResponses.ON_ACCEPT, function (data) {
    $('#battle-input').val(window.location.href + data.battleId)
    app.showAlert('#link-alert')
    app.setState(app.PlayerStates.WAIT)
  })

  app.socket.on(utils.ServerResponses.ON_REJECT, function (data) {
    $('#error-span').text(data.msg)
    app.showAlert('#error-alert')
  })

  app.socket.on(utils.ServerResponses.ON_ATTACK, function (data) {
    app.setState(app.PlayerStates.ATTACK)
  })

  app.socket.on(utils.ServerResponses.ON_DEFEND, function (data) {
    app.setState(app.PlayerStates.DEFEND)
  })
})
