/**
 * scripts/Commands.js
 * 
 * This file provides the main game logic; unfortunately it's 
 * not complete so you'll need to finish it!
 *
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 * @author ...
 */
var db = require('../models');
var controller = require('./Controller');
var predicates = require('./Predicates');
var strings = require('./Strings');
var CommandHandler = require('./CommandHandler');
var PropertyHandler = require('./PropertyHandler');

/**
 * The commands object is like a map of control strings (the commands detailed 
 * in the ECS-MUD guide) to command handlers (objects extending from the 
 * CommandHandler object) which perform the actions of the required command.
 * 
 * The controller (see Controller.js) parses the statements entered by the user,
 * and passes the information to the matching property in the commands object.
 */
var commands = {
	//handle user creation
	create: CommandHandler.extend({
		nargs: 2,
		preLogin: true,
		postLogin: false,
		validate: function(conn, argsArr, cb) {
			if (!predicates.isUsernameValid(argsArr[0])) {
				controller.sendMessage(conn, strings.badUsername);
				return;
			}

			if (!predicates.isPasswordValid(argsArr[1])) {
				controller.sendMessage(conn, strings.badPassword);
				return;
			}

			controller.loadMUDObject(conn, {name: argsArr[0], type: 'PLAYER'}, function(player) {
				if (!player) {
					cb(conn, argsArr);
				} else {
					controller.sendMessage(conn, strings.usernameInUse);
				}
			});
		},
		perform: function(conn, argsArr) {
			//create a new player
			controller.createMUDObject(conn,
				{
					name: argsArr[0],
					password: argsArr[1],
					type:'PLAYER',
					locationId: controller.defaultRoom.id,
					targetId: controller.defaultRoom.id
				}, function(player) {
				if (player) {
					player.setOwner(player).success(function() {
						controller.activatePlayer(conn, player);
						controller.broadcastExcept(conn, strings.hasConnected, player);

						controller.clearScreen(conn);
						commands.look.perform(conn, []);
					});
				}
			});
		}
	}),
	//handle connection of an existing user
	connect: CommandHandler.extend({
		nargs: 2,
		preLogin: true,
		postLogin: false,
		validate: function(conn, argsArr, cb) {
			controller.loadMUDObject(conn, {name: argsArr[0], type:'PLAYER'}, function(player) {
				if (!player) {
					controller.sendMessage(conn, strings.playerNotFound);
					return;
				}

				if (player.password !== argsArr[1]) {
					controller.sendMessage(conn, strings.incorrectPassword);
					return;
				}

				cb(conn, argsArr);
			});
		},
		perform: function(conn, argsArr) {
			//load player if possible:
			controller.loadMUDObject(conn, {name: argsArr[0], password: argsArr[1], type:'PLAYER'}, function(player) {
				if (player) {
					controller.applyToActivePlayers(function(apconn, ap) {
						if (ap.name === argsArr[0]) {
							//player is already connected... kick them off then rejoin them
							controller.deactivatePlayer(apconn);
							return false;
						}
					});

					controller.activatePlayer(conn, player);
					controller.broadcastExcept(conn, strings.hasConnected, player);

					controller.clearScreen(conn);
					commands.look.perform(conn, []);
				}
			});
		}
	}),
	//Disconnect the player
	QUIT: CommandHandler.extend({
		preLogin: true,
		perform: function(conn, argsArr) {
			conn.terminate();
		}
	}),
	//List active players
	WHO: CommandHandler.extend({
		preLogin: true,
		perform: function(conn, argsArr) {
			controller.applyToActivePlayers(function(otherconn, other) {
				if (otherconn !== conn) {
					controller.sendMessage(conn, other.name);
				}
			});
		}
	}),
	//Pick up an object
	get: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player   = controller.findActivePlayerByConnection(conn);
			controller.findPotentialMUDObject
			(
				conn, argsArr[0],
				function(obj)
				{
					if (obj.locationId == player.id)
					{
						controller.sendMessage(conn, strings.alreadyHaveThat);
					}
					else
					{
						predicates.canDoIt(controller, player, obj, function(canDoIt)
						{
							if (canDoIt)
							{
								obj.locationId = player.id;
								obj.save().success(function()
								{
									controller.sendMessage(conn, strings.taken);
								});
							}
						},
						strings.cantTakeThat);
					}
				},
				false, false, 'THING', strings.ambigSet, strings.takeUnknown
			);
		}
	}),
	//Drops an item
	drop: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player   = controller.findActivePlayerByConnection(conn);
			controller.findPotentialMUDObject
			(
				conn,  argsArr[0],
				function (obj)
				{
					if (obj.locationId != player.id)
					{
						controller.sendMessage(conn, strings.dontHave);
						return;
					}

					controller.loadMUDObject(conn, {id: player.locationId}, function(loc)
					{
						if (loc.isTemple())
						{
							obj.locationId = obj.targetId;
						}
						else if (loc.targetId)
						{
							obj.locationId = loc.targetId;
						}
						else
						{
							obj.locationId = player.locationId;
						}

						obj.save().success(function()
						{
							controller.sendMessage(conn, strings.dropped);
						});
					});
				},
				false, false, 'THING', strings.ambigSet, strings.dontHave
			);
		}
	}),
	//Whisper to another player
	page: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player   = controller.findActivePlayerByConnection(conn);
			var toPlayer = controller.findActivePlayerByName(argsArr[0]);

			if (!toPlayer || toPlayer.id == player.id)
			{
				controller.sendMessage(conn, strings.playerNotFound);
				return;
			}

			controller.loadMUDObject(conn, {id: player.locationId}, function(location) {
				var otherconn = controller.findActiveConnectionByPlayer(toPlayer);

				controller.sendMessage(otherconn, strings.page, {name: player.name, location: location.name});
				controller.sendMessage(conn, strings.pageOK);
			});
		}
	}),
	//Speak to other players
	say: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			cb(conn, argsArr);
		},
		perform: function(conn, argsArr) {
			var message = argsArr.length===0 ? "" : argsArr[0];
			var player = controller.findActivePlayerByConnection(conn);

			controller.sendMessage(conn, strings.youSay, {message: message});
			controller.sendMessageRoomExcept(conn, strings.says, {name: player.name, message: message});
		}
	}),
	//Whisper to another player
	whisper: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);

			var index = argsArr[0].indexOf("=");
			index = (index === -1) ? argsArr[0].length : index;
			var targetName = argsArr[0].substring(0, index).trim();
			var toPlayer   = controller.findActivePlayerByName(targetName);
			var message    = argsArr[0].substring(index + 1).trim();

			if (!message)
			{
				controller.sendMessage(conn, strings.unknownCommand);
				return;
			}
			if (!toPlayer)
			{
				controller.sendMessage(conn, strings.playerNotFound);
				return;
			}
			if (player.locationId != toPlayer.locationId)
			{
				controller.sendMessage(conn, strings.notInRoom);
				return;
			}
			if (player.id == toPlayer.id)
			{
				controller.sendMessage(conn, strings.notInRoom);
				return;
			}

			controller.sendMessage(conn, strings.youWhisper, {name: toPlayer.name, message: message});
			controller.sendMessage(controller.findActiveConnectionByPlayer(toPlayer), strings.toWhisper, {name: player.name, message: message});

			controller.applyToActivePlayers(function(otherconn, other) {
				if (other.locationId === player.locationId && player !== other && other !== toPlayer) {
					if (Math.random() <= 0.1)
					{
						controller.sendMessage(otherconn, strings.overheard, {fromName: player.name, toName: toPlayer.name, message: message});
					}
					else
					{
						controller.sendMessage(otherconn, strings.whisper, {fromName: player.name, toName: toPlayer.name});
					}
				}
			});

			
		}
	}),
	//move the player somewhere
	go: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length === 1) {
				cb(conn, argsArr);
			} else {
				controller.sendMessage(conn, strings.unknownCommand);
			}
		},
		perform: function(conn, argsArr, errMsg) {
			var player = controller.findActivePlayerByConnection(conn);
			var exitName = argsArr[0];

			if (exitName === 'home') {
				player.getTarget().success(function(loc) {
					controller.applyToActivePlayers(function(otherconn, other) {
						if (other.locationId === loc.id && player !== other) {
							controller.sendMessage(otherconn, strings.goesHome, {name: player.name});
						}
					});

					player.getContents().success(function(contents){
						if (contents) {
							var chainer = new db.Sequelize.Utils.QueryChainer();
							for (var i=0; i<contents.length; i++) {
								var ci = contents[i];
								ci.locationId = ci.targetId;
								chainer.add(ci.save());
							}
							chainer.run().success(function(){
								//don't need to do anything
							});
						}

						for (var i=0; i<3; i++)
							controller.sendMessage(conn, strings.noPlaceLikeHome);
						
						player.setLocation(loc).success(function() {
							controller.sendMessage(conn, strings.goneHome);
							commands.look.lookRoom(conn, loc);
						});
					});
				});
			} else {
				controller.findPotentialMUDObject(conn, exitName, function(exit) {
					//found a matching exit... can we use it?
					predicates.canDoIt(controller, player, exit, function(canDoIt) {
						if (canDoIt && exit.targetId) {
							exit.getTarget().success(function(loc) {
								if (loc.id !== player.locationId) {
									//only inform everyone else if its a different room
									controller.applyToActivePlayers(function(otherconn, other) {
										if (other.locationId === player.locationId && player !== other) {
											controller.sendMessage(otherconn, strings.leaves, {name: player.name});
										}
										if (other.locationId === loc.id && player !== other) {
											controller.sendMessage(otherconn, strings.enters, {name: player.name});
										}
									});
								
									player.setLocation(loc).success(function() {
										commands.look.lookRoom(conn, loc);
									});
								} else {
									commands.look.lookRoom(conn, loc);
								}
							});
						}
					}, strings.noGo);
				}, false, false, 'EXIT', strings.ambigGo, errMsg ? errMsg : strings.noGo);
			}
		}
	}),
	//look at something
	look: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length <= 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);

			if (argsArr.length === 0 || argsArr[0].length===0) {
				player.getLocation().success(function(room) {
					commands.look.look(conn, room);
				});
			} else {
				controller.findPotentialMUDObject(conn, argsArr[0], function(obj) {
					commands.look.look(conn, obj);
				}, true, true, undefined, undefined, undefined, true);
			}
		},
		look: function(conn, obj) {
			switch (obj.type) {
				case 'ROOM':
					commands.look.lookRoom(conn, obj);
					break;
				case 'PLAYER':
					commands.look.lookSimple(conn, obj);
					commands.look.lookContents(conn, obj, strings.carrying);
					break;
				default:
					commands.look.lookSimple(conn, obj);
			}
		},
		lookRoom: function(conn, room) {
			var player = controller.findActivePlayerByConnection(conn);

			if (predicates.isLinkable(room, player)) {
				controller.sendMessage(conn, strings.roomNameOwner, room);
			} else {
				controller.sendMessage(conn, strings.roomName, room);
			}
			if (room.description) controller.sendMessage(conn, room.description);

			predicates.canDoIt(controller, player, room, function() {
				commands.look.lookContents(conn, room, strings.contents);
			});
		},
		lookSimple: function(conn, obj) {
			controller.sendMessage(conn, obj.description ? obj.description : strings.nothingSpecial);
		},
		lookContents: function(conn, obj, name, fail) {
			obj.getContents().success(function(contents) {
				if (contents) {
					var player = controller.findActivePlayerByConnection(conn);

					contents = contents.filter(function(o) {
						return predicates.canSee(player, o);
					});

					if (contents.length>0) {
						controller.sendMessage(conn, name);
						for (var i=0; i<contents.length; i++) {
							controller.sendMessage(conn, contents[i].name);
						}
					} else {
						if (fail)
							controller.sendMessage(conn, fail);
					}
				} 
			});
		}
	}),
	//Examines an object... kind of like looking at it, but better
	examine: CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);
			controller.findPotentialMUDObject
			(
				conn, argsArr[0],
				function(obj)
				{
					// Check if it exists, and is in the same room / inventory as the player
					if (obj.ownerId != player.id)
					{
						controller.sendMessage(conn, strings.permissionDenied);
					}
					else
					{
						controller.sendMessage(conn, strings.examine, obj);
					}
				},
				true, true, undefined, strings.ambigSet, strings.examineUnknown
			);
		}
	}),
	//Checkout player inventory
	"inventory": CommandHandler.extend({
		nargs: 0,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 0)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);
			player.getContents().success(function(contents) {
				if (contents) {
					if (contents.length>0) {
						controller.sendMessage(conn, strings.youAreCarrying);
						for (var i=0; i<contents.length; i++) {
							controller.sendMessage(conn, contents[i].name);
						}
					} else {
						controller.sendMessage(conn, strings.carryingNothing);
					}
				} 
			});
		}
	}),
	//Create an object
	"@create": PropertyHandler.extend({
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);

			if (!predicates.isNameValid(argsArr[0]))
			{
				controller.sendMessage(conn, strings.invalidName);
				return;
			}

			//create the actual object
			controller.createMUDObject
			(
				conn,
				{
					name: argsArr[0],
					type:'THING',
					locationId: player.id,
					targetId: player.targetId,
					ownerId: player.id
				}, 
				function(obj) {
					if (obj) {
						controller.sendMessage(conn, strings.created);
					}
				}
			);
		}
	}),	
	// Digs a new room
	"@dig" : PropertyHandler.extend({
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);

			if (!predicates.isNameValid(argsArr[0]))
			{
				controller.sendMessage(conn, strings.invalidName);
				return;
			}

			controller.createMUDObject
			(
				conn,
				{
					name: argsArr[0],
					ownerId: player.id,
					type: 'ROOM'
				},
				function(room)
				{
					if (room)
					{
						controller.sendMessage(conn, strings.roomCreated, room);
					}
				}
			);
		}
	}),
	//Opens a new entrance
	"@open" : PropertyHandler.extend({
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);
			controller.loadMUDObject(conn, {id: player.locationId}, function(loc)
			{
				if (!loc)
				{
					// We'd be having internal issues if this occurs, as the player would
					// be in a room that doesn't exist! :/
				}
				else if (loc.ownerId != player.id)
				{
					controller.sendMessage(conn, strings.permissionDenied);
				}
				else
				{
					controller.createMUDObject
					(
						conn,
						{
							type: 'EXIT',
							locationId: loc.id,
							name: argsArr[0]
						},
						function()
						{
							controller.sendMessage(conn, strings.opened);
						}
					);
				}
			});
		}
	}),

	"@link" : PropertyHandler.extend({
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);
			
			var index = argsArr[0].indexOf("=");
			index = (index === -1) ? argsArr[0].length : index;
			var objName    = argsArr[0].substring(0, index).trim();
			var roomNumber = argsArr[0].substring(index + 1).trim();

			if (!objName || !roomNumber)
			{
				controller.sendMessage(conn, strings.unknownCommand);
				return;
			}

			controller.findPotentialMUDObject
			(
				conn, objName,
				function(obj)
				{
					// If this is an exit, it must be unlinked
					if (obj.type == 'EXIT' && obj.targetId)
					{
						controller.sendMessage(conn, strings.permissionDenied);
						return;
					}

					// Pretty sure we can't modify things we don't own
					if (obj.type != 'EXIT' && obj.ownerId != player.id)
					{
						controller.sendMessage(conn, strings.permissionDenied);
						return;
					}

					// "home" can be used as a special case
					if (roomNumber === 'home')
					{
						// If this is a room, set the temple flag instead, as that's easier
						if (obj.type == 'ROOM')
						{
							this["@set"].perform(conn, [objName + "=temple"]);
							return;
						}
						// Set this as your home
						else
						{
							roomNumber = player.targetId;
						}
					}
					// Make here work
					else if (roomNumber == "here")
					{
						roomNumber = player.locationId;
					}

					controller.loadMUDObject(conn, {id: roomNumber, type: 'ROOM'}, function(room)
					{
						if (!room)
						{
							controller.sendMessage(conn, strings.notARoom);
						}
						else if (obj.type == 'EXIT' && !predicates.isLinkable(obj, player))
						{
							controller.sendMessage(conn, strings.permissionDenied);
						}
						else
						{
							obj.targetId = roomNumber;

							if (obj.type == 'EXIT') obj.ownerId = player.id;

							obj.save().success(function()
							{
								controller.sendMessage(conn, strings.linked);
							});
						}
					})
				},
				true, true, undefined, strings.ambigSet, strings.unknownCommand
			);
		}
	}),

	// Unlinks an exit
	"@unlink" : CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);

			controller.findPotentialMUDObject
			(
				conn, argsArr[0],
				function(exit)
				{
					if (exit.ownerId != player.id)
					{
						controller.sendMessage(conn, strings.permissionDenied);
						return;
					}

					exit.targetId = null;
					exit.save().success(function()
					{
						controller.sendMessage(conn, strings.unlinked);
					});
				},
				false, false, 'EXIT', strings.ambigSet, strings.unlinkUnknown
			);
		}
	}),

	//set the description of something
	"@describe": PropertyHandler.extend({
		prop: 'description'
	}),
	//Sets the object's name
	"@name": PropertyHandler.extend({
		prop: 'name'
	}),
	"@ofail":PropertyHandler.extend({
		prop: 'othersFailureMessage'
	}),
	"@failure":PropertyHandler.extend({
		prop: 'failureMessage'
	}),
	"@success":PropertyHandler.extend({
		prop: 'successMessage'
	}),
	"@osuccess":PropertyHandler.extend({
		prop: 'othersSuccessMessage'
	}),

	// Tries to find the given thing
	"@find" : CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);
			var name   = db.sequelize.getQueryInterface().escape('%' + argsArr[0].toLowerCase() +'%');
			controller.loadMUDObjects
			(
				conn,
				db.Sequelize.and
				(
					"lower(name) LIKE " + name,
					{ownerId: player.id}
				),
				function (matches)
				{
					for (var i = matches.length - 1; i >= 0; i--)
					{
						controller.sendMessage(conn, "{{name}} (#{{id}})", matches[i]);
					};
				}
			);
		}
	}),

	"@set" : PropertyHandler.extend({
		perform : function(conn, argsArr)
		{
			var player = controller.findActivePlayerByConnection(conn);
			var index = argsArr[0].indexOf("=");
			index = (index === -1) ? argsArr[0].length : index;
			var object = argsArr[0].substring(0, index).trim();
			var flag   = argsArr[0].substring(index + 1).trim();
			var flags  =
			{
				"link_ok"   : global.db.MUDObject.FLAGS.link_ok,
				"temple"    : global.db.MUDObject.FLAGS.temple,
				"anti_lock" : global.db.MUDObject.FLAGS.anti_lock
			};
			

			if (!object || !flag)
			{
				controller.sendMessage(conn, strings.unknownCommand);
				return;
			}

			controller.findPotentialMUDObject(conn, object, function(obj)
			{
				if (obj.ownerId != player.id)
				{
					controller.sendMessage(conn, strings.permissionDenied);
				}
				else if (flag.substring(0, 1) == "!")
				{
					flag = flag.substring(1);
					obj.resetFlag(flags[flag]).success(function()
					{
						controller.sendMessage(conn, strings.reset, {property: flag});
					});
				}
				else
				{
					obj.setFlag(flags[flag]).success(function()
					{
						controller.sendMessage(conn, strings.set, {property: flag});
					});
				}
			}, true, true, undefined, strings.ambigSet, strings.setUnknown);
			
		}
	}),

	// Locks the object
	"@lock" : CommandHandler.extend({
		nargs: 1,
		validate: function(conn, argsArr, cb) {
			if (argsArr.length == 1)
				cb(conn, argsArr);
			else
				controller.sendMessage(conn, strings.unknownCommand);
		},
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);
			var index = argsArr[0].indexOf("=");
			index = (index === -1) ? argsArr[0].length : index;
			var objName = argsArr[0].substring(0, index).trim();
			var keyName = argsArr[0].substring(index + 1).trim();

			controller.findPotentialMUDObject
			(
				conn, objName,
				function(obj)
				{
					if (obj.ownerId != player.id)
					{
						controller.sendMessage(conn, strings.permissionDenied);
						return;
					}

					controller.findPotentialMUDObject
					(
						conn, keyName, function(key)
						{
							obj.keyId = key.id;
							obj.save().success(function()
							{
								controller.sendMessage(conn, strings.locked);
							});
						},
						true, true, undefined, strings.ambigSet, strings.keyUnknown
					);
				},
				true, true, undefined, strings.ambigSet, strings.lockUnknown
			);
		}
	}),

	"@unlock" : PropertyHandler.extend({
		perform : function(conn, argsArr)
		{
			controller.findPotentialMUDObject
			(
				conn, argsArr[0],
				function(obj)
				{
					var player = controller.findActivePlayerByConnection(conn);
					if (obj.ownerId != player.id)
					{
						controller.sendMessage(conn, strings.permissionDenied);
					}
					else
					{
						obj.keyId = null;
						obj.save().success(function()
						{
							controller.sendMessage(conn, strings.unlocked);
						});
					}
				},
				true, true, undefined, strings.unlockUnknown, strings.unlockUnknown
			);
		}
	}),

	// This changes your password
	"@password" : PropertyHandler.extend({
		perform: function(conn, argsArr) {
			var player = controller.findActivePlayerByConnection(conn);

			var index = argsArr[0].indexOf("=");
			index = (index === -1) ? argsArr[0].length : index;
			var oldPass = argsArr[0].substring(0, index).trim();
			var newPass = argsArr[0].substring(index + 1).trim();

			if (!oldPass || !newPass)
			{
				controller.sendMessage(conn, strings.unknownCommand);
				return;
			}
			if (oldPass != player.password)
			{
				controller.sendMessage(conn, strings.incorrectPassword);
				return;
			}
			if (!predicates.isPasswordValid(newPass))
			{
				controller.sendMessage(conn, strings.badPassword);
			}

			player.password = newPass;
			player.save().success(function()
			{
				controller.sendMessage(conn, strings.changePasswordSuccess);
			});
		}
	})
};

//command aliases
commands.goto  = commands.go;
commands.move  = commands.go;
commands.cr    = commands.create;
commands.co    = commands.connect;
commands.read  = commands.look;
commands.take  = commands.get;
commands.throw = commands.drop;
commands["@ofailure"] = commands["@ofail"];
commands["@fail"]     = commands["@failure"];

//The commands object is exported publicly by the module
module.exports = commands;
