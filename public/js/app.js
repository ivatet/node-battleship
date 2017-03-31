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

    var stateMapping = {}
    stateMapping[app.PlayerStates.EMPTY] = 'joining-row'
    stateMapping[app.PlayerStates.WAIT] = 'joining-row'
    stateMapping[app.PlayerStates.ATTACK] = 'attacking-row'
    stateMapping[app.PlayerStates.DEFEND] = 'defending-row'
    stateMapping[app.PlayerStates.FINISH] = 'celebrating-row'

    var activeCssClass = 'active'
    var rowStateCssClass = 'state-row'

    $('.' + rowStateCssClass).removeClass(activeCssClass)
    $('#' + stateMapping[app.state]).addClass(activeCssClass)
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
      fleetJson: null,
      fleetName: $('#fleet-name-input').val()
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
    $('#battle-id').text(data.battleId)
    $('#battle-id').attr('href', data.battleId)

    app.setState(app.PlayerStates.WAIT)
  })

  app.socket.on(utils.ServerResponses.ON_REJECT, function (data) {
    $('#server-message').text(data.msg)
  })

  app.socket.on(utils.ServerResponses.ON_ATTACK, function (data) {
    app.setState(app.PlayerStates.ATTACK)
  })

  app.socket.on(utils.ServerResponses.ON_DEFEND, function (data) {
    app.setState(app.PlayerStates.DEFEND)
  })
})
