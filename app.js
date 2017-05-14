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

const indexTemplate = fs.readFileSync(path.join(__dirname, 'public', 'index.html.mst'), 'utf8').toString()
const boardPartial = fs.readFileSync(path.join(__dirname, 'public', '_board.html.mst'), 'utf8').toString()

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

  var emptyCell = function () {
    return {
      emptyCell: {
      }
    }
  }

  var labelCell = function (label) {
    return { labelCell: label }
  }

  var boardCell = function (selector, cls) {
    return {
      boardCell: {
        htmlSelectors: selector,
        htmlClass: cls
      }
    }
  }

  var labelRow = function () {
    var row = [emptyCell()]
    for (var i = 1; i < 11; i++)
      row.push(labelCell(i))
    return row
  }

  var columnLabels = 'ABCDEFGHIJ'

  var localCells = labelRow()
  var remoteCells = labelRow()
  for (var j = 0; j < 10; j++) {
    var ch = labelCell(columnLabels.charAt(j))
    localCells.push(ch)
    remoteCells.push(ch)
    for (var i = 0; i < 10; i++) {
      var idx = j * 10 + i
      localCells.push(boardCell(utils.localCellSelectors(idx), utils.cellStyle(canvas[idx])))
      remoteCells.push(boardCell(utils.remoteCellSelectors(idx), utils.cellStyle(utils.CellTypes.EMPTY)))
    }
  }

  var templateData = {
    fleet: JSON.stringify(fleet),
    localBoardId: utils.LocalBoardId,
    localCells: localCells,
    remoteBoardId: utils.RemoteBoardId,
    remoteCells: remoteCells
  }
  res.end(mustache.render(indexTemplate, templateData, {
    board: boardPartial
  }))
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

const opposite = function(arr, item) {
  return arr[0] === item ? arr[1] : arr[0]
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

const findShip = function (fleet, cellId) {
  return fleet.find(function (ship) {
    var d = utils.pointFromDirection(ship.direction)

    for (var i = 0; i < ship.length; i++) {
      var p = utils.pointSum(ship, utils.pointScale(d, i))

      if (p.y * 10 + p.x === cellId) {
        return true
      }
    }

    return false
  })
}

const isShipSunken = function (ship, shots) {
  var d = utils.pointFromDirection(ship.direction)

  for (var i = 0; i < ship.length; i++) {
    var p = utils.pointSum(ship, utils.pointScale(d, i))

    if (shots.find(function (shot) { return p.y * 10 + p.x === shot }) === undefined) {
      return false
    }
  }

  return true
}

const sunkenShipShots = function (ship) {
  var shots = []
  var tail = utils.shipTail(ship)

  for (var y = ship.y - 1; y <= tail.y + 1; y++) {
    for (var x = ship.x - 1; x <= tail.x + 1; x++) {
      if (utils.isCorrectPointLocation({x: x, y: y})) {
        shots.push(y * 10 + x)
      }
    }
  }

  return shots
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
    conn.disconnect(true)
  }

  var sendRejectResponse = (msg) => sendRejectResponseToClient(client, msg)

  var playerBoardView = function (battle, player, isShowFleet) {
    var opponent = opposite(battle.players, player)
    var boardView = {
      localBoard: renderBoard(player.fleet, opponent.shots, true),
      remoteBoard: renderBoard(opponent.fleet, player.shots, isShowFleet)
    }
    return boardView
  }

  var sendAttackDefendResponses = function (battle) {
    battle.players[0].conn.emit(battle.battleState === BattleStates.P1_ATTACK ? utils.ServerResponses.ON_ATTACK : utils.ServerResponses.ON_DEFEND,
      playerBoardView(battle, battle.players[0], false))

    battle.players[1].conn.emit(battle.battleState === BattleStates.P2_ATTACK ? utils.ServerResponses.ON_ATTACK : utils.ServerResponses.ON_DEFEND,
      playerBoardView(battle, battle.players[1], false))
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
        sendRejectResponse('Oops! Something went wrong.')
        return
      }

      battle.players.push(player)

      var randomBinary = Math.floor(Math.random() * 2)
      battle.battleState = randomBinary ? BattleStates.P1_ATTACK : BattleStates.P2_ATTACK

      sendAttackDefendResponses(battle)
    }
  })

  client.on(utils.ClientRequests.ON_ATTACK, function (data) {
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
    if (attacker.shots.find(function (elem) { return elem === data.cellId }) !== undefined)
      return

    /* pew pew! */
    attacker.shots.push(data.cellId)

    /* check whether it is hit or miss */
    var victim = opposite(battle.players, attacker)
    var victimFleetCanvas = utils.renderFleet(victim.fleet)
    if (victimFleetCanvas[data.cellId] === utils.CellTypes.SHIP) {
      /* check whether the ship has sunk or not */
      ship = findShip(victim.fleet, data.cellId)
      if (isShipSunken(ship, attacker.shots)) {
        /* draw sunken ship (we want all shots be unique) */
        sunkenShipShots(ship).forEach(function (candidateShot) {
          if (attacker.shots.find(function (shot) { return shot === candidateShot}) === undefined) {
            attacker.shots.push(candidateShot)
          }
        })
      }

      /* check if the game is over */
      var canvas = renderBoard(victim.fleet, attacker.shots, true)
      if (canvas.find(function (elem) { return elem === utils.CellTypes.SHIP })) {
        sendAttackDefendResponses(battle)
      } else {
        battles.removeBattle(battle)

        attacker.conn.emit(utils.ServerResponses.ON_WIN, playerBoardView(battle, attacker, false))
        attacker.conn.disconnect(true)

        victim.conn.emit(utils.ServerResponses.ON_LOSE, playerBoardView(battle, victim, true))
        victim.conn.disconnect(true)
      }
    } else {
      battle.battleState = opposite([BattleStates.P1_ATTACK, BattleStates.P2_ATTACK], battle.battleState)
      sendAttackDefendResponses(battle)
    }
  })

  client.on('disconnect', function () {
    logger.debug('client disconnected')

    var battle = battles.findByConnection(client)
    if (battle) {
      player = battle.players.find(function (p) { return p.conn !== client })
      if (player) {
        sendRejectResponseToClient(player.conn, 'The remote player has left the battle!')
      }
      battles.removeBattle(battle)
    }
  })
})

logger.info('listening on port ' + port)

server.listen(port)
