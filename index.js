const fs = require('fs')
const express = require('express')
const mustache = require('mustache')
const port = 3000

const template = fs.readFileSync(__dirname + '/index.mst', 'utf8').toString()

const app = express()

app.get('/', function(req, rsp) {
	templateData = {
		test: req.query.test
	}
	rsp.end(mustache.to_html(template, templateData))
})

const server = app.listen(3000, function() {
	var host = server.address().address
	var port = server.address().port

	console.log("Example app listening at http://%s:%s", host, port)
})
