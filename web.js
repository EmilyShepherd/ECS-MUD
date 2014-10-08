/**
 * web.js
 * 
 * Main entry point for ECS-MUD.
 *
 * Sets up a web-server using Express.js, a WebSocket Server 
 * using Einaros WebSockets, and connects to a database for
 * holding the game state using Sequelize.js.
 *
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
var http = require("http");
var express = require("express");
var ws = require("ws");
var controller = require("./scripts/Controller");
var db = require("./models");

//configure ports, automatically choosing between the Heroku port and development port
var httpPort = Number(process.env.PORT || 5000);

//Configure the database
db.sequelize.sync().complete(function(err) {
	if (err) {
		throw err[0];
	} else {
		//initialise our game controller
		controller.init();

		//Setup the express HTTP application
		var app = express();

		//Route the root path to the index page (uses jade templates)
		app.get("/", function(req, res) {
			res.render("index.jade", {});
		});

		//static files
		app.use('/static', express.static(__dirname + '/public'));

		//Create and start the HTTP server
		var server = http.createServer(app);
		server.listen(httpPort);

		//Setup the WebSockets server at /ws
		var wss = new ws.Server({server: server, path: "/ws"});

		//hook up websocket events:
		//on a new connection to the server:
		wss.on("connection", function(conn) {
			//tell the controller to display the splash-screen to the client
			controller.splashScreen(conn);

			//setup a timer to repeatedly ping the client every 10 seconds.
			//this is required to keep the Heroku connection from dropping.
			var id = setInterval(function() {
				try {
					conn.ping();
				} catch (e) {
					//stop pinging if there is a problem (i.e. connection has died!)
					clearInterval(id);
				}
			}, 10000);

			//on receipt of a message from the connection we
			//pass that message to the controller
			conn.on("message", function(message) {
				controller.handleMessage(conn, message);
			});

			//on close of the connection we tell the controller
			//the player has disconnected
			conn.on("close", function() {
				controller.deactivatePlayer(conn);
			});
		});
	}
});
