const winston = require('winston')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const utils = require('./shared/js/utils.js')

const port = 3000

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

const BattleStates = {
	WAIT_PLAYERS: 1,
	P1_ATTACK: 2,
	P2_ATTACK: 3
}

const battles = []

io.on('connection', function(client) {
	logger.debug('new client connected')

	client.on(utils.ClientRequests.ON_JOIN, function(data) {
		logger.debug('client join request')
		client.emit(utils.ServerResponses.ON_JOIN, { "battle_id" : 42 })
	})

	client.on('disconnect', function(client) {
		logger.debug('client disconnected')
	})
})

logger.info('listening on port ' + port)

server.listen(port)
