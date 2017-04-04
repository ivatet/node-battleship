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

/* the descending order is retained for the relaxing arrangement */
const shipLengths = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

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
app.use('/js', express.static(path.join(__dirname, 'public', 'js')))
app.use('/js', express.static(path.join(__dirname, 'shared', 'js')))

app.use('/css', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'css')))
app.use('/css', express.static(path.join(__dirname, 'public', 'css')))

app.use('/favicon.ico', express.static(path.join(__dirname, 'public', 'favicon.ico')))

const pointFromDirection = function (direction) {
  return {
    x: direction === utils.Directions.HOR ? 1 : 0,
    y: direction === utils.Directions.VER ? 1 : 0
  }
}

const pointSum = function (p, d) {
  return {
    x: p.x + d.x,
    y: p.y + d.y
  }
}

const pointScale = function (p, k) {
  return {
    x: p.x * k,
    y: p.y * k
  }
}

const isCorrectPointLocation = function (p) {
  return p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10
}

const isCorrectShipLocation = function (ship) {
  var d = pointFromDirection(ship.direction)
  var tail = pointSum(ship, pointScale(d, ship.length))
  return isCorrectPointLocation(ship) && isCorrectPointLocation(tail)
}

const isPointColliding = function (p, canvas) {
  var dArray = [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
                { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 },
                { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
  ]

  for (var i = 0; i < dArray.length; i++) {
    var d = dArray[i]
    var tmpP = pointSum(p, d)
    if (!isCorrectPointLocation(tmpP)) {
      continue
    }

    if (canvas[tmpP.y * 10 + tmpP.x] !== utils.CellTypes.EMPTY) {
      return true
    }
  }

  return false
}

const isShipColliding = function (ship, fleet) {
  var canvas = renderFleet(fleet)
  var d = pointFromDirection(ship.direction)

  for (var i = 0; i < ship.length; i++) {
    var p = pointSum(ship, pointScale(d, i))
    if (isPointColliding(p, canvas)) {
      return true
    }
  }

  return false
}

const createFleet = function () {
  var fleet = []

  shipLengths.forEach(function (length) {
    var positions = []
    for (var i = 0; i < 100; i++) {
      positions.push(i)
    }

    var ship = null

    while (!ship) {
      var idx = Math.floor(Math.random() * positions.length)
      var position = positions[idx]
      positions.splice(idx, 1)

      var direction = Math.random() > 0.5 ? utils.Directions.VER : utils.Directions.HOR
      var y = Math.floor(position / 10)
      var x = position - y * 10

      var tmpShip = {
        x: x,
        y: y,
        length: length,
        direction: direction
      }

      if (!isCorrectShipLocation(tmpShip)) {
        continue
      }

      if (isShipColliding(tmpShip, fleet)) {
        continue
      }

      ship = tmpShip
    }

    fleet.push(ship)
  })

  return fleet
}

const renderFleet = function (fleet) {
  var canvas = Array(100).fill(utils.CellTypes.EMPTY)

  fleet.forEach(function (ship) {
    var d = pointFromDirection(ship.direction)

    for (var i = 0; i < ship.length; i++) {
      var x = ship.x + d.x * i
      var y = ship.y + d.y * i
      canvas[y * 10 + x] = utils.CellTypes.SHIP
    }
  })

  return canvas
}

const renderCanvas = function (canvas) {
  var rows = []
  for (var j = 0; j < 10; j++) {
    var cells = []
    for (var i = 0; i < 10; i++) {
      var idx = j * 10 + i
      cells.push({
        idx: idx,
        style: utils.cellStyle(canvas[idx])
      })
    }
    rows.push({
      cells: cells
    })
  }

  return rows
}

const handleIndex = function (req, res) {
  var fleet = createFleet()
  var canvas = renderFleet(fleet)
  var templateData = {
    fleet: JSON.stringify(fleet),
    rows: renderCanvas(canvas)
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

  var validateFleetJson = function (fleetJson) {
    var validateFleetJsonSchema = function () {
      return Array.isArray(fleetJson)
    }

    var validateFleetJsonLengths = function () {
      var fleetShipLengths = fleetJson.map(function (ship) {
        return ship.length
      })

      var orderedFleetShipLengths = fleetShipLengths.sort(function (left, right) {
        return right - left
      })

      for (var i = 0; i < shipLengths.length; i++) {
        if (orderedFleetShipLengths[i] !== shipLengths[i]) {
          return false
        }
      }

      return true
    }

    var msg = "Internal error! Please reload the page"
    if (!validateFleetJsonSchema()) {
      return [false,  msg]
    }

    if (!validateFleetJsonLengths()) {
      return [false, msg]
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

    tuple = validateFleetJson(data.fleetJson)
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
