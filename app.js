const winston = require('winston')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const validator = require('validator')
const utils = require('./shared/js/utils.js')

const port = 3000

const idRange = {
	min: 1000,
	max: 1000000
}

generateId = () => "id" + Math.floor(Math.random() * (idRange.max - idRange.min + 1) + idRange.min)

const logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			timestamp: true,
			colorize: true,
		})
	]
})

logger.level = 'debug'

app.use(express.static('public'))
app.use(express.static('shared'))

app.get('/id*', function(req, res) {
	res.sendFile(__dirname + '/public/index.html')
})

const BattleStates = {
	WAIT_PLAYERS: 1,
	P1_ATTACK: 2,
	P2_ATTACK: 3
}

const battles = []

io.on('connection', function(client) {
	logger.debug('new client connected')

	message = function(msg) {
		client.emit(utils.ServerResponses.ON_MESSAGE, {
			msg: msg
		})
		return
	}

	validateFleetName = function(fleet_name) {
		if (typeof fleet_name !== 'string' )
			return [false, "Don't forget to specify fleet name!"]

		var lengthRange = {
			min: 3,
			max: 16
		}

		if (!validator.isLength(fleet_name, lengthRange))
			return [false, "Fleet name must be not too short and not too long!"]

		if (!validator.isAlphanumeric(fleet_name))
			return [false, "Fleet name looks suspicious :-. Try again!"]

		return [true, null]
	}

	updateClients = function(battle) {
		var attackIdx = BattleStates.P1_ATTACK ? 0 : 1

		for (var i = 0; i < 2; i++) {
			var client = battle.connections[i].connection
			var event = utils.ServerResponses.ON_THEY_ATTACK
			if (i === attackIdx)
				event = utils.ServerResponses.ON_YOUR_ATTACK
			client.emit(event, {})
		}
	}

	client.on(utils.ClientRequests.ON_JOIN, function(data) {
		logger.debug('client join request with data: ' + JSON.stringify(data))

		var tuple = validateFleetName(data.fleet_name)
		if (!tuple[0]) {
			message(tuple[1])
			return
		}

		var connection = {
			connection: client,
			fleet_name: data.fleet_name,
			fleet_json: data.fleet_json
		}

		if (!data.battle_id) {
			var battle = {
				battle_id: generateId(),
				battle_state: BattleStates.WAIT_PLAYERS,
				connections: [connection]
			}

			battles.push(battle)

			client.emit(utils.ServerResponses.ON_JOIN, {
				battle_id: battle.battle_id
			})

		} else {
			var battle = battles.find(function(battle) {
				return battle.battle_id === data.battle_id;
			})

			if (!battle) {
				message("Battle not found!")
				return
			}

			if (battle.battle_state !== BattleStates.WAIT_PLAYERS) {
				message("It is not your business!")
				return
			}

			battle.connections.push(connection)

			var random_binary = Math.floor(Math.random() * 2)
			battle.battle_state = random_binary ? BattleStates.P1_ATTACK : BattleStates.P2_ATTACK

			updateClients(battle)
		}
	})

	client.on('disconnect', function(client) {
		logger.debug('client disconnected')
	})
})

logger.info('listening on port ' + port)

server.listen(port)
