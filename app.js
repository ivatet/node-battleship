const fs = require('fs')
const os = require('os')
const path = require('path')
const favicon = require('serve-favicon')

const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

app.use(express.static('public'))

io.on('connection', function(client) {
	console.log("connect")
	client.emit('ping', { 'msg': 'Welcome to ' + os.hostname() + '!' })

	client.on('disconnect', function(client) {
		console.log("disconnect")
	})
})

server.listen(3000)
