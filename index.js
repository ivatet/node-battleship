const fs = require('fs')
const http = require('http')
const mustache = require('mustache')
const port = 3000

var template = fs.readFileSync(__dirname + '/index.mst', 'utf8').toString()

const requestHandler = (request, response) => {
	templateData = {
		url: request.url
	}
	response.end(mustache.to_html(template, templateData))
}

const server = http.createServer(requestHandler)

server.listen(port, (err) => {  
	if (err) {
		return console.log('something bad happened', err)
	}

	console.log(`server is listening on ${port}`)
})
