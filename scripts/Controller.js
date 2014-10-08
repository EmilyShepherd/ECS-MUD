/**
 * scripts/controller.js
 * 
 * Main game controller: handles messages to/from players and 
 * provides a number of general utility functions.
 *
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
var S = require('string');
var strings = require('./Strings');
var db = require('../models');
var sequelize_fixtures = require('sequelize-fixtures');

//will be set up on call to #init()
var commands;

/**
 * (private)
 * The list of active players [ {player: db.MUDObject, conn: ws.WebSocket} ]
 */
var activePlayers = [];

//The controller class (will be exported)
var controller = {
	/**
	 * The default room for new players (set by #init()) [db.MUDObject].
	 */
	defaultRoom: undefined,
	/**
	 * Initialise the controller object and database state
	 */
	init: function() {
		//setup the default location
		controller.loadMUDObject(undefined, {id: 1}, function(room) {
			if (room) {
				controller.defaultRoom = room;
			} else {
				sequelize_fixtures.loadFile('data/small.json', {MUDObject: db.MUDObject}, function() {
					if (db.sequelize.options.dialect === 'postgres') {
						//postgres seems to get itself in a mess with sequelize_fixtures and lose track of the auto-incrementing object ids, so we reset it manually here:
						db.sequelize.query('SELECT setval(pg_get_serial_sequence(\'"MUDObjects"\', \'id\'), (SELECT MAX(id) FROM "MUDObjects")+1);').success(
							function() {
								controller.init();
							}
						);
					} else {
						controller.init();
					}
				});
			}
		});

		//initialise the command handler
		commands = require('./Commands');
	},
	/**
	 * Handle a message from a user at a given connection. Basically this looks for a valid
	 * matching command in the commands object (which contains keyed CommandHandler instances) 
	 * and calls the CommandHandler#validate method on that (which should then call the 
	 * perform method if validation is successful). 
	 *
	 * Additionally this deals with validation of pre and post login commands (see 
	 * CommandHandler#preLogin and CommandHandler#postLogin), and also the fallback 
	 * of unknown commands to the `go` command.
	 *
	 * @param conn [ws.WebSocket] the connection
	 * @param message [string] the message typed by the user
	 */
	handleMessage: function(conn, message) {
		var d = require('domain').create();
		d.on('error', function(err) {
			console.log(err.name + " " + err.message);
		});
		d.run(function() {
			var firstSpace = message.indexOf(' ');
			var commandStr = firstSpace === -1 ? message.trim() : message.substring(0, firstSpace).trim();
			var argsStr = firstSpace === -1 ? "" : message.substring(firstSpace + 1).trim();
			var command = commands[commandStr];
			var isLoggedIn = controller.findActivePlayerByConnection(conn) !== undefined;

			if (commandStr.length === 0)
				return;

			if (command) {
				var argsArr = getArgs(argsStr, command.nargs);
				
				if (!isLoggedIn && command.postLogin && !command.preLogin) {
					//cant use a post-login only command if not logged in
					controller.splashScreen(conn);
				} else if (isLoggedIn && command.preLogin && !command.postLogin) {
					//cant use a pre-login only command if logged in
					controller.sendMessage(conn, strings.alreadyLoggedIn);
				} else {
					if (command.validate) {
						command.validate(conn, argsArr, command.perform);
					} else {
						command.perform(conn, argsArr);
					}
				}
			} else {
				if (isLoggedIn) {
					//delegate to the go command
					commands.go.perform(conn, [message], strings.unknownCommand);
				}
				else
					controller.splashScreen(conn);
			}
		});
	},
	/**
	 * Activate a player by adding them to the list of active players and connections
	 * @param conn the connection
	 * @param player the player
	 */
	activatePlayer: function(conn, player) {
		activePlayers.push({ player: player, conn: conn });
	},
	/**
	 * Deactivate a player by removing them from the list of active players and connections. 
	 * Also sends a message to the other players saying they've left and terminates the
	 * connection.
	 * @param conn the connection of the player who is disconnecting
	 */
	deactivatePlayer: function(conn) {
		var player = controller.findActivePlayerByConnection(conn);
		controller.broadcastExcept(conn, strings.hasDisconnected, player);

		for (var i=0; i<activePlayers.length; i++) {
			if (activePlayers[i].conn === conn) {
				activePlayers.splice(i, 1);
				break;
			}
		}

		conn.terminate();
	},
	/**
	 * Apply the given function to all the active players.
	 * @param operation the function to apply; takes two 
	 * 		  parameters: (ws.WebSocket) connection and (db.MUDObject) player.
	 *		  If the function returns false, then iteration through the players stops
	 *		  at that point.
	 */
	applyToActivePlayers: function(operation) {
		for (var i=0; i<activePlayers.length; i++) {
			if (operation(activePlayers[i].conn, activePlayers[i].player) === false) {
				break;
			}
		}
	},
	/*
	 * Broadcast sends to all logged in users.
	 */
	broadcast: function(message, values) {
		controller.applyToActivePlayers(function(conn) {
			controller.sendMessage(conn, message, values);
		});
	},
	/*
	 * Broadcast sends to all logged in users, except the conn user
	 */
	broadcastExcept: function(conn, message, values) {
		controller.applyToActivePlayers(
			function(apconn) {
				if (apconn !== conn)
					controller.sendMessage(apconn, message, values);
			}
		);
	},
	/**
 	 * Send a message to all active players in the same room as the player represented by `conn` (excluding that player).
 	 * @param conn (ws.WebSocket) the connection belonging to the player whose location we're interested in
	 * @param message (String) (optional) the message to send (sends a newline if undefined). 
	 *				  The message can contain Mustache compatible `{{...}}` templates.
	 * @param values (Object) (optional) the replacement strings to insert into the template
 	 */
	sendMessageRoomExcept: function(conn, message, values) {
		var player = controller.findActivePlayerByConnection(conn);
		
		controller.applyToActivePlayers(function(otherconn, other) {
			if (other.locationId === player.locationId && player !== other) {
				controller.sendMessage(otherconn, message, values);
			}
		});
	},
	/**
	 * Sends a message to a connection (note that a newline is automatically added)
	 * @param conn (ws.WebSocket) the connection 
	 * @param message (String) (optional) the message to send (sends a newline if undefined). 
	 *				  The message can contain Mustache compatible `{{...}}` templates.
	 * @param values (Object) (optional) the replacement strings to insert into the template
	 */
	sendMessage: function(conn, message, values) {
		message = message === undefined ? '' : message;
		if (values === undefined) {
			conn.send(message);
		} else {
			conn.send(S(message).template(values).s);
		}
	},
	/**
	 * Clear the screen of the player represented by the connection
	 * @param conn (ws.WebSocket) the connection 
	 */
	clearScreen: function(conn) {
		for (var i=0; i<24; i++) {
			controller.sendMessage(conn);
		}
	},
	/**
	 * Display the splash screen and connection prompt
	 * @param conn (ws.WebSocket) the connection 
	 */
	splashScreen: function(conn) {
		controller.sendMessage(conn, strings.loginPrompt);
	},
	/**
	 * Find the active player with the given name
	 * @param name the player name
	 * @return (db.MUDObject) the player or undefined if not found
	 */
	findActivePlayerByName: function(name) {
		for (var i=0; i<activePlayers.length; i++) {
			if (activePlayers[i].player.name === name) {
				return activePlayers[i].player;
			}
		}
		return undefined;
	},
	/**
	 * Find the active player with the given connection
	 * @param conn (ws.WebSocket) the connection 
	 * @return (db.MUDObject) the player or undefined if not found
	 */
	findActivePlayerByConnection: function(conn) {
		for (var i=0; i<activePlayers.length; i++) {
			if (activePlayers[i].conn === conn) {
				return activePlayers[i].player;
			}
		}
		return undefined;
	},
	/**
	 * Find the connection for the given player
	 * @param player (db.MUDObject) the player
	 * @return (ws.WebSocket) the connection or undefined if the player is not connected
	 */
	findActiveConnectionByPlayer: function(player) {
		for (var i=0; i<activePlayers.length; i++) {
			if (activePlayers[i].player === player) {
				return activePlayers[i].conn;
			}
		}
		return undefined;
	},
	/**
	 * Create a new database object from the given parameters. Handles errors automatically.
	 * @param conn (ws.WebSocket) the player's connection (can be `undefined`).
	 * @param obj (object) Object with properties mirroring the new database object
	 * @param cb (function) Callback function to call on completion of the database write. 
	 *				Takes a single parameter of the (db.MUDObject) that was created.
	 */
	createMUDObject: function(conn, obj, cb) {
		db.MUDObject.build(obj).save().complete(function(err, nobj) {
			if (!!err) {
				fatalError(err, conn);
			} else {
				cb(nobj);
			}
		});
	},
	/**
	 * Load a database object from the given parameters. Handles errors automatically.
	 * @param conn (ws.WebSocket) the player's connection (can be `undefined`).
	 * @param obj (object) Object with properties mirroring the database object you want to find.
	 * @param cb (function) Callback function to call on completion of the database read. 
	 *				Takes a single parameter of the (db.MUDObject) that was read.
	 */
	loadMUDObject: function(conn, obj, cb) {
		db.MUDObject.find({ where : obj }).complete(function(err, dbo) {
			if (!!err) {
				fatalError(err, conn);
			} else {
				cb(dbo);
			}
		});
	},
	/**
	 * Load database objects from the given parameters. Handles errors automatically.
	 * @param conn (ws.WebSocket) the player's connection (can be `undefined`).
	 * @param obj (object) Object with properties mirroring the database object(s) you want to find.
	 * @param cb (function) Callback function to call on completion of the database read. 
	 *				Takes a single parameter of the array of [db.MUDObject]s that was read.
	 */
	loadMUDObjects: function(conn, obj, cb) {
		db.MUDObject.findAll({ where : obj }).complete(function(err, dbo) {
			if (!!err) {
				fatalError(err, conn);
			} else {
				cb(dbo);
			}
		});
	},
	/**
	 * Find database objects from the given name that are likely to be relevant 
	 * to the player (specified by the connection). Handles errors automatically.
	 *
	 * Specifically looks for partial matches of the given name in objects that the player
	 * is carrying or that are in the room the player is in. The name can optionally be "me" 
	 * or "here" to refer to the player or their location. Additionally, the type of object
	 * being searched can be restricted.
	 * 
	 * @param conn (ws.WebSocket) the player's connection.
	 * @param name (string) the (partial) name of the object(s) in question
	 * @param cb (function) Callback function to call on completion of the database read. 
	 *				Takes a single parameter of the array of [db.MUDObject]s that was found.
	 * @param allowMe (boolean) whether to handle "me" as a name
	 * @param allowHere (boolean) whether to handle "here" as a name
	 * @param type (db.MUDObject.type) type of objects to find
	 */
	findPotentialMUDObjects: function(conn, name, cb, allowMe, allowHere, type) {
		var player = controller.findActivePlayerByConnection(conn);

		if (allowMe && name === 'me') {
			cb([player]);
			return;
		}

		if (allowHere && name === 'here') {
			player.getLocation().success(function(obj) {
				cb([obj]);
			});
			return;
		}

		var escName = db.sequelize.getQueryInterface().escape('%' + name.toLowerCase() +'%');

		if (type) {
			controller.loadMUDObjects(conn, 
				db.Sequelize.and(
					//{name: {like: '%' + name + '%'}},
					"lower(name) LIKE " + escName,
					{'type': type},
					db.Sequelize.or(
						{locationId: player.locationId},
						{locationId: player.id}
					)
				), function(objs){ cb(filterPossible(objs, name)); }
			);
		} else {
			controller.loadMUDObjects(conn, 
				db.Sequelize.and(
					//{name: {like: '%' + name + '%'}},
					"lower(name) LIKE " + escName,
					db.Sequelize.or(
						{locationId: player.locationId},
						{locationId: player.id}
					)
				), function(objs){ cb(filterPossible(objs, name)); }
			);
		}
	},
	/**
	 * Find a database object from the given name that is likely to be relevant 
	 * to the player (specified by the connection). Handles errors automatically.
	 *
	 * Specifically looks for partial matches of the given name in objects that the player
	 * is carrying or that are in the room the player is in. The name can optionally be "me" 
	 * or "here" to refer to the player or their location. Additionally, the type of object
	 * being searched can be restricted.
	 *
	 * If more than one object matches the name, then the player can be alerted that the query 
	 * was ambiguous and the callback will not be called.
	 *
	 * If more than zero objects match the name, then the player can be alerted that the query 
	 * failed and the callback will not be called.
	 * 
	 * @param conn (ws.WebSocket) the player's connection.
	 * @param name (string) the (partial) name of the object(s) in question
	 * @param cb (function) Callback function to call on completion of the database read. 
	 *				Takes a single parameter of the array of [db.MUDObject]s that was found.
	 * @param allowMe (boolean) whether to handle "me" as a name
	 * @param allowHere (boolean) whether to handle "here" as a name
	 * @param type (db.MUDObject.type) type of objects to find (can be `undefined`)
	 * @param ambigMsg message to show to the player if the query was ambiguous
	 * @param failMsg message to show to the player if the query fails to find anything
	 * @param requireDescription if more than one object is found, but only one has 
 	 *	 		a non-null description then call the callback with that object
	 */
	findPotentialMUDObject: function(conn, name, cb, allowMe, allowHere, type, ambigMsg, failMsg, requireDescription) {
		if (!ambigMsg) ambigMsg = strings.ambigSet;
		if (!failMsg) failMsg = strings.dontSeeThat;

		controller.findPotentialMUDObjects(conn, name, function(obj) {
			if (obj && obj.length > 0) {
				if (requireDescription===true && obj.length > 1) {
					var nobj = obj.filter(function(o) {
						return o.description !== null;
					});
					if (nobj.length === 1)
						obj = nobj;
				}

				if (obj.length === 1) {
					cb(obj[0]);
				} else {
					controller.sendMessage(conn, ambigMsg);
				}
			} else {
				controller.sendMessage(conn, failMsg);
			}
		}, allowMe, allowHere, type);
	}
};

//Export the controller
module.exports = controller;

//Private helper functions below this point

/**
 * Parse the arguments string, trying to extract `nargs` arguments.
 * Arguments are space separated, however the last output argument 
 * could contain spaces depending on the number of spaces and `nargs`.
 * Leading and trailing whitespace is trimmed from all arguments.
 *
 * @param argsStr (string) the arguments string
 * @param nargs (number) number of expected arguments
 * @return the arguments array
 */
function getArgs(argsStr, nargs) {
	var argsArr = [];
	var first, rest;
	var i, index;

	argsStr = argsStr.trim();

	if (argsStr.length === 0)
		return argsArr;

	if (nargs <= 1) {
		argsArr.push(argsStr);
	} else {
		rest = argsStr;
		for (i=0; i<nargs; i++) {
			index = rest.indexOf(' ');
			if (index === -1) {
				break;
			}

			first = rest.substring(0, index).trim();
			rest = rest.substring(index + 1).trim();

			argsArr.push(first);
		}
		argsArr.push(rest);
	}
	return argsArr;
}

/**
 * Function for handling fatal errors. The player is told there was a 
 * problem and they are disconnected before an exception is thrown.
 */
function fatalError(err, conn) {
	if (conn) {
		conn.send("A fatal error occurred: " + err + "\n");
		conn.send("You will be disconnected immediately!\n");
		conn.terminate();
 	}
	throw {name: "FatalError", description: err};
}

/**
 * Helper function for filtering objects matching a name beyond what is
 * (easily) accomplishable with Sequelize queries. Specifically requires
 * whole word matches, rather than just sub-sequences of characters.
 */
function filterPossible(obj, name) {
	if (obj && obj.length > 0) {
		var farr = obj.filter(function(o) {
			if (o.name.toLowerCase() === name.toLowerCase()) return true;
			
			var strs = o.name.toLowerCase().split(/[ ;]+/g);
			var nstrs = name.toLowerCase().split(/[ ;]+/g);
			var index = 0;

			for (var i=0; i<nstrs.length; i++) {
				var newIndex = strs.indexOf(nstrs[i], index);
				if (newIndex<index)
					return false;

				index = newIndex;
			}

			return true;
		});

		return farr;
	}
	return obj;
}
