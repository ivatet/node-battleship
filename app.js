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
      htmlId: utils.localCellId(i),
      htmlClass: utils.cellStyle(canvas[i])
    }
  })
  var remoteCells = utils.emptyFleet().map(function (p, i) {
    return {
      htmlId: utils.remoteCellId(i),
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

const battles = []

const validateFleet = function (fleet) {
  var validateSchema = function () {
    return Array.isArray(fleet)
  }

  var validateLengths = function () {
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

  var validateArrangement = function () {
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

  if (!validateSchema()) {
    return false
  }

  if (!validateLengths()) {
    return false
  }

  if (!validateArrangement()) {
    return false
  }

  return true
}

io.on('connection', function (client) {
  logger.debug('new client connected')

  var sendAcceptResponse = function (battle) {
    client.emit(utils.ServerResponses.ON_ACCEPT, {
      battleId: battle.battleId
    })
  }

  var sendRejectResponse = function (msg) {
    client.emit(utils.ServerResponses.ON_REJECT, {
      msg: msg
    })
  }

  var sendAttackDefendResponses = function (battle) {
    var attackIdx = BattleStates.P1_ATTACK ? 0 : 1

    for (var i = 0; i < 2; i++) {
      var client = battle.connections[i].connection
      var event = utils.ServerResponses.ON_DEFEND
      if (i === attackIdx) {
        event = utils.ServerResponses.ON_ATTACK
      }
      client.emit(event, {})
    }
  }

  client.on(utils.ClientRequests.ON_JOIN, function (data) {
    logger.debug('client join request with data: ' + JSON.stringify(data))

    if (!validateFleet(data.fleet)) {
      sendRejectResponse('Oops! Something went wrong.')
      return
    }

    var connection = {
      connection: client,
      fleet: data.fleet
    }

    /* either create new battle or join existing battle */
    var battle
    if (!data.battleId) {
      battle = {
        battleId: generateId(),
        battleState: BattleStates.WAIT,
        connections: [connection]
      }
      battles.push(battle)
      sendAcceptResponse(battle)
    } else {
      battle = battles.find(function (battle) {
        return battle.battleId === data.battleId
      })

      if (!battle) {
        sendRejectResponse('Battle not found!')
        return
      }

      if (battle.battleState !== BattleStates.WAIT) {
        sendRejectResponse('It is not your business!')
        return
      }

      battle.connections.push(connection)

      var randomBinary = Math.floor(Math.random() * 2)
      battle.battleState = randomBinary ? BattleStates.P1_ATTACK : BattleStates.P2_ATTACK

      sendAttackDefendResponses(battle)
    }
  })

  client.on('disconnect', function (client) {
    logger.debug('client disconnected')
  })
})

logger.info('listening on port ' + port)

server.listen(port)
