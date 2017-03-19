const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

const utils = require('./shared/js/utils.js')

app.use(express.static('public'))
app.use(express.static('shared'))

const BattleStates = {
	WAIT_PLAYERS: 1,
	P1_ATTACK: 2,
	P2_ATTACK: 3
}

const battles = []

io.on('connection', function(client) {
	client.on(utils.ClientRequests.ON_JOIN, function(data) {
		client.emit(utils.ServerResponses.ON_JOIN, { "battle_id" : 42 })
	})

	client.on('disconnect', function(client) {
	})
})

server.listen(3000)
