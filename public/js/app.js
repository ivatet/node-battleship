$(function () {
  window.app = {}

  var app = window.app
  var utils = window.utils

  app.socket = io('/', {
    reconnection: false
  })

  app.showAlert = function (alertId) {
    $('.custom-alert').each(function () {
      if (!$(this).hasClass('hidden')) {
        $(this).addClass('hidden')
      }
    })
    $(alertId).removeClass('hidden')
  }

  app.cleanLocalBoard = function () {
    for (var i = 0; i < 100; i++) {
      var cell = $('#' + utils.localCellId(i))
      cell.removeClass(utils.cellStyle(utils.CellTypes.EMPTY))
      cell.removeClass(utils.cellStyle(utils.CellTypes.SHIP))
    }
  }

  app.renderLocalBoard = function (board) {
    board.forEach(function (p, i) {
      var cell = $('#' + utils.localCellId(i))
      cell.addClass(utils.cellStyle(p.cellType))
    })
  }

  app.cleanRemoteBoard = function () {
  }

  app.renderRemoteBoard = function (board, isAttacking) {
  }

  app.onAttackDefend = function (data, isAttacking) {
    app.cleanLocalBoard()
    app.renderLocalBoard(data.localBoard)

    app.cleanRemoteBoard()
    app.renderRemoteBoard(data.remoteBoard, isAttacking)

    app.showAlert(isAttacking ? '#attack-alert' : '#defend-alert')
  }

  /* Handle UI controls */
  new Clipboard('#copy-button')

  $('#join-button').click(function () {
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

    app.cleanLocalBoard()
    app.renderLocalBoard(canvas.map(function (cellType) {
      return {
        cellType: cellType,
        isAttacked: false
      }
    }))
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
  })

  app.socket.on(utils.ServerResponses.ON_REJECT, function (data) {
    $('#error-span').text(data.msg)
    app.showAlert('#error-alert')
    app.socket.disconnect()
  })

  app.socket.on(utils.ServerResponses.ON_ATTACK, function (data) {
    app.onAttackDefend(data, true)
  })

  app.socket.on(utils.ServerResponses.ON_DEFEND, function (data) {
    app.onAttackDefend(data, false)
  })
})
