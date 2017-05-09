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

  app.CELL_STYLE_LINK = 'custom-link-cell'
  app.CELL_STYLE_EMPTY = 'custom-empty-cell'

  app.cleanBoard = function (accessor) {
    for (var i = 0; i < 100; i++) {
      var cell = $('#' + accessor(i))
      cell.off('click')
      cell.removeClass(app.CELL_STYLE_EMPTY)
      cell.removeClass(app.CELL_STYLE_LINK)
      cell.removeClass(utils.cellStyle(utils.CellTypes.EMPTY))
      cell.removeClass(utils.cellStyle(utils.CellTypes.SHIP))
      cell.removeClass(utils.cellStyle(utils.CellTypes.MISS))
      cell.removeClass(utils.cellStyle(utils.CellTypes.HIT))
    }
  }

  app.attack = function(i) {
    app.socket.emit(utils.ClientRequests.ON_ATTACK, {
      cellId: i,
    })
  }

  app.renderBoard = function (accessor, board, isAttacking) {
    board.forEach(function (cellType, i) {
      var cell = $('#' + accessor(i))

      switch (cellType) {
      case utils.CellTypes.EMPTY:
        cell.addClass(app.CELL_STYLE_EMPTY)
        if (isAttacking) {
          cell.addClass(app.CELL_STYLE_LINK)
          cell.on('click', function() {
            app.attack(i)
          })
        }
        break
      case utils.CellTypes.SHIP:
        cell.addClass(app.CELL_STYLE_EMPTY)
        break
      case utils.CellTypes.MISS:
        cell.addClass(app.CELL_STYLE_EMPTY)
        break
      case utils.CellTypes.HIT:
        cell.addClass(app.CELL_STYLE_EMPTY)
        break
      }

      cell.addClass(utils.cellStyle(cellType))
    })
  }

  app.onAttackDefend = function (data, isAttacking) {
    app.cleanBoard(utils.localCellId)
    app.renderBoard(utils.localCellId, data.localBoard, false)

    app.cleanBoard(utils.remoteCellId)
    app.renderBoard(utils.remoteCellId, data.remoteBoard, isAttacking)

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

    app.cleanBoard(utils.localCellId)
    app.renderBoard(utils.localCellId, canvas, false)
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
