/**
 * scripts/CommandHandler.js
 * 
 * Definition of the CommandHandler object which is used to implement
 * all commands. Sub-instances can be created using the #extend method.
 * 
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
var controller = require('./Controller');
var strings = require('./Strings');

module.exports = {
	/**
	 * This tells the controller how many arguments this command expects
	 */
	nargs: 0,
	/**
	 * This tells the the controller whether the command is available to 
	 * users BEFORE they log in to the game.
	 */
	preLogin: false,
	/**
	 * This tells the the controller whether the command is available to 
	 * users AFTER they log in to the game.
	 */
	postLogin: true,
	/**
	 * This method is called by the controller to ascertain whether the 
	 * arguments are valid, and if so, call the given callback. An error 
	 * should be sent to the user if there is a problem
	 * @param conn (ws.WebSocket) the connection of the user who sent the command
	 * @param argsArr [string] the arguments
	 * @param cb (function) the callback (takes conn and argsArr as 
	 * 				arguments); this will be set by the controller to
	 *				be the #perform method.
	 */
	validate: function(conn, argsArr, cb) {
		if (argsArr.length === 0)
			cb.apply(this, [conn, argsArr]);
		else
			controller.sendMessage(conn, strings.unknownCommand);
	},
	/**
	 * Perform the action represented by this command.
	 * @param conn (ws.WebSocket) the connection of the user who sent the command
	 * @param argsArr [string] the arguments
	 */
	perform: function(conn, argsArr) {
		console.log("This probably should be overridden!");
	},
	/**
	 * Create a copy of this CommandHandler and extend it with the properties 
	 * of the given extension object. Any properties in the extension object 
	 * with the same name as the CommandHandler will overwrite those in the 
	 * CommandHandler.
	 */
	extend: function(ext) {
		var clone = Object.create(this);

		for (var prop in ext) {
			if (ext.hasOwnProperty(prop)) {
				clone[prop] = ext[prop];
			}
		}

		return clone;
	}
};
