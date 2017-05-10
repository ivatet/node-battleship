const fs = require('fs')
const path = require('path')
const winston = require('winston')
const express = require('express')
const mustache = require('mustache')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const validator = require('validator')
const utils = require(path.join(__dirname, 'shared', 'js', 'utils.js'))

const port = 3000

const template = fs.readFileSync(path.join(__dirname, 'public', 'index.html.mst'), 'utf8').toString()

const idRange = {
  min: 1000,
  max: 1000000
}

const generateId = () => 'id' + Math.floor(Math.random() * (idRange.max - idRange.min + 1) + idRange.min)

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      timestamp: true,
      colorize: true
    })
  ]
})

logger.level = 'debug'

app.use('/js', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'js')))
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist')))
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'clipboard', 'dist')))
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'snapsvg', 'dist')))
app.use('/js', express.static(path.join(__dirname, 'public', 'js')))
app.use('/js', express.static(path.join(__dirname, 'shared', 'js')))

app.use('/css', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'css')))
app.use('/css', express.static(path.join(__dirname, 'public', 'css')))

app.use('/fonts/', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'fonts')))

app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')))

const handleIndex = function (req, res) {
  var fleet = utils.createFleet()
  var canvas = utils.renderFleet(fleet)
  var localCells = canvas.map(function (p, i) {
    return {
      htmlSelectors: utils.localCellSelectors(i),
      htmlClass: utils.cellStyle(canvas[i])
    }
  })
  var remoteCells = utils.emptyFleet().map(function (p, i) {
    return {
      htmlSelectors: utils.remoteCellSelectors(i),
      htmlClass: utils.cellStyle(utils.CellTypes.EMPTY)
    }
  })

  var templateData = {
    fleet: JSON.stringify(fleet),
    localBoardId: utils.LocalBoardId,
    localCells: localCells,
    remoteBoardId: utils.RemoteBoardId,
    remoteCells: remoteCells
  }
  res.end(mustache.to_html(template, templateData))
}

app.get('/', handleIndex)
app.get('/id*', handleIndex)

const BattleStates = {
  WAIT: 1,
  P1_ATTACK: 2,
  P2_ATTACK: 3
}

const battles = {
  battles: [],

  createBattle: function (player) {
    var battle = {
      battleId: generateId(),
      battleState: BattleStates.WAIT,
      players: [player]
    }
    this.battles.push(battle)
    logger.debug('battle added, count=' + this.battles.length)
    return battle
  },

  removeBattle: function (battle) {
    this.battles.splice(this.battles.indexOf(battle), 1)
    logger.debug('battle removed, count=' + this.battles.length)
  },

  findByConnection: function (conn) {
    return this.battles.find(function (b) {
      return b.players.find(function (p) {
        return p.conn === conn
      })
    })
  },

  findById: function (battleId) {
    return this.battles.find(function (b) {
      return b.battleId === battleId
    })
  }
}

const isCorrectFleet = function (fleet) {
  var isCorrectSchema = function () {
    return Array.isArray(fleet)
  }

  var isCorrectLengthSet = function () {
    var lengths = fleet.map(function (ship) {
      return ship.length
    })

    var orderedLengths = lengths.sort(function (left, right) {
      return right - left
    })

    for (var i = 0; i < utils.shipLengths.length; i++) {
      if (orderedLengths[i] !== utils.shipLengths[i]) {
        return false
      }
    }

    return true
  }

  var isCorrectArrangement = function () {
    var tmpFleet = []

    for (var i = 0; i < fleet.length; i++) {
      var tmpShip = fleet[i]

      if (!utils.isCorrectShipLocation(tmpShip)) {
        return false
      }

      if (utils.isShipColliding(tmpShip, tmpFleet)) {
        return false
      }

      tmpFleet.push(tmpShip)
    }

    return true
  }

  /* FIXME Do not rely on short-circuit evaluation too much! */
  return isCorrectSchema() && isCorrectLengthSet() && isCorrectArrangement()
}

const renderBoard = function (fleet, shots, isShowFleet) {
  var fleetCanvas = utils.renderFleet(fleet)
  var canvas = isShowFleet ? fleetCanvas : utils.emptyFleet()

  shots.forEach(function (shot) {
    canvas[shot] = (fleetCanvas[shot] === utils.CellTypes.SHIP ? utils.CellTypes.HIT : utils.CellTypes.MISS)
  })

  return canvas
}

io.on('connection', function (client) {
  logger.debug('new client connected')

  var sendAcceptResponse = function (battle) {
    client.emit(utils.ServerResponses.ON_ACCEPT, {
      battleId: battle.battleId
    })
  }

  var sendRejectResponseToClient = function (conn, msg) {
    conn.emit(utils.ServerResponses.ON_REJECT, {
      msg: msg
    })
  }

  var sendRejectResponse = (msg) => sendRejectResponseToClient(client, msg)

  var sendAttackDefendResponses = function (battle) {
    var attackIdx = (battle.battleState === BattleStates.P1_ATTACK ? 0 : 1)

    for (var i = 0; i < 2; i++) {
      var event = (i === attackIdx ? utils.ServerResponses.ON_ATTACK : utils.ServerResponses.ON_DEFEND)
      var localBoard = renderBoard(battle.players[i].fleet,
                                   battle.players[1 - i].shots,
                                   true)
      var remoteBoard = renderBoard(battle.players[1 - i].fleet,
                                   battle.players[i].shots,
                                   false)
      battle.players[i].conn.emit(event, {
        localBoard: localBoard,
        remoteBoard: remoteBoard
      })
    }
  }

  client.on(utils.ClientRequests.ON_JOIN, function (data) {
    logger.debug('client join request with data: ' + JSON.stringify(data))

    /* TODO Validate the whole object */
    if (!isCorrectFleet(data.fleet)) {
      sendRejectResponse('Oops! Something went wrong.')
      return
    }

    var player = {
      conn: client,
      fleet: data.fleet,
      shots: []
    }

    /* Either create new battle or join existing battle */
    if (!data.battleId) {
      sendAcceptResponse(battles.createBattle(player))
    } else {
      var battle = battles.findById(data.battleId)

      if (!battle) {
        sendRejectResponse('Battle not found!')
        return
      }

      if (battle.battleState !== BattleStates.WAIT) {
        sendRejectResponse('It is not your business!')
        return
      }

      battle.players.push(player)

      var randomBinary = Math.floor(Math.random() * 2)
      battle.battleState = randomBinary ? BattleStates.P1_ATTACK : BattleStates.P2_ATTACK

      sendAttackDefendResponses(battle)
    }
  })

  client.on(utils.ClientRequests.ON_ATTACK, function (data) {
    var opposite = function(arr, item) {
      return arr[0] === item ? arr[1] : arr[0]
    }

    /* check if the battle exists */
    var battle = battles.findByConnection(client)
    if (!battle)
      return

    /* check if the battle is ongoing */
    if (battle.battleState !== BattleStates.P1_ATTACK && battle.battleState !== BattleStates.P2_ATTACK)
      return

    /* check if the player is capable of doing an attack */
    var attacker = battle.players[battle.battleState === BattleStates.P1_ATTACK ? 0 : 1]
    if (attacker.conn !== client)
      return

    /* check if the cell has not been attacked before */
    if (attacker.shots.find(function (elem) { return elem === data.cellId }))
      return

    attacker.shots.push(data.cellId)

    /* check whether it is hit or miss */
    var victim = opposite(battle.players, attacker)
    var victimFleet = utils.renderFleet(victim.fleet)
    if (victimFleet[data.cellId] === utils.CellTypes.SHIP) {
      sendAttackDefendResponses(battle)
    } else {
      battle.battleState = opposite([BattleStates.P1_ATTACK, BattleStates.P2_ATTACK], battle.battleState)
      sendAttackDefendResponses(battle)
    }
  })

  client.on('disconnect', function () {
    logger.debug('client disconnected')

    var battle = battles.findByConnection(client)
    if (battle) {
      player = battle.players.find(function (p) {
        return p.conn !== client
      })
      if (player) {
        sendRejectResponseToClient(player.conn, 'The remote player has been disconnected!')
      }
      battles.removeBattle(battle)
    }
  })
})

logger.info('listening on port ' + port)

server.listen(port)
