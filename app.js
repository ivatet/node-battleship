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

console.log(path.join(__dirname, 'public', 'js'))

app.use('/js', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'js')))
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist')))
app.use('/js', express.static(path.join(__dirname, 'public', 'js')))
app.use('/js', express.static(path.join(__dirname, 'shared', 'js')))

app.use('/css', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'css')))
app.use('/css', express.static(path.join(__dirname, 'public', 'css')))

const handleIndex = function (req, res) {
  var rows = []
  for (var j = 0; j < 10; j++) {
    var cells = []
    for (var i = 0; i < 10; i++) {
      cells.push({
        id: j * 10 + i
      })
    }
    rows.push({
      cells: cells
    })
  }

  var templateData = {
    rows: rows
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

  var validateFleetName = function (fleetName) {
    if (typeof fleetName !== 'string') {
      return [false, "Don't forget to specify your fleet name!"]
    }

    var lengthRange = {
      min: 3,
      max: 16
    }

    if (!validator.isLength(fleetName, lengthRange)) {
      return [false, 'Between 3 and 16 characters!']
    }

    return [true, null]
  }

  client.on(utils.ClientRequests.ON_JOIN, function (data) {
    logger.debug('client join request with data: ' + JSON.stringify(data))

    /* validate user input */
    var tuple = validateFleetName(data.fleetName)
    if (!tuple[0]) {
      sendRejectResponse(tuple[1])
      return
    }

    var connection = {
      connection: client,
      fleetName: validator.escape(data.fleetName),
      fleetJson: data.fleetJson
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
