/**
 * scripts/Predicates.js
 * 
 * Predicates for checking whether something is a valid operation/value
 *
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
var db = require('../models');
 
module.exports = {
	/**
	 * Test if the given password is valid
	 * @param str the password
	 * @return true if valid; false otherwise
	 */
	isPasswordValid: function(str) {
		return /[!-~]+/.test(str);
	},
	/**
	 * Test if the given username is valid
	 * @param str the username
	 * @return true if valid; false otherwise
	 */
	isUsernameValid: function(str) {
		return /[!-~^=]+/.test(str) && str.indexOf('=') === -1;
	},
	/**
	 * Test if the given room/thing name is valid
	 * @param str the name
	 * @return true if valid; false otherwise
	 */
	isNameValid: function(str) {
		return /[!-~]+/.test(str);
	},
	/**
	 * Test if a player can `@link` a specific room
	 * @param room the room
	 * @param player the player
	 * @return true if valid; false otherwise
	 */
	isLinkable: function(room, player) {
		if (room.ownerId === player.id) return true;
		return room.canLink();
	},
	/**
	 * Test if a player can see a specific thing (used for `look`).
	 * @param player the player
	 * @param room the thing
	 * @return true if the player can see the thing; false otherwise
	 */
	canSee: function(player, thing) {
		if (thing.type === 'EXIT' || thing.id === player.id) 
			return false;
		return true;
	},
	/**
	 * Test if a player do a specific thing (`go` or `take` something or `look` at a room),
	 * calling a callback function with the result. The relevant success and failure 
	 * messages will be sent to the other players in the same room automatically.
	 * @param player the player
	 * @param room the thing
	 * @param callback the callback function to call; takes a single 
	 *			boolean argument, which is true if the player can do 
	 *			the thing and false otherwise.
	 * @param defaultFailureMessage the message to show on failure to do the thing.
	 */
	canDoIt: function(controller, player, thing, callback, defaultFailureMessage) {
		var playerConn = controller.findActiveConnectionByPlayer(player);
		
		if (!playerConn) {
			if (callback) callback(false);
			return;
		}

		couldDoIt(player, thing, function(doit) {
			if (!doit) {
				if (thing.failureMessage) {
					controller.sendMessage(playerConn, thing.failureMessage);
				} else if (defaultFailureMessage) {
					controller.sendMessage(playerConn, defaultFailureMessage);
				}

				if (thing.othersFailureMessage) {
					controller.sendMessageRoomExcept(playerConn, player.name + " " + thing.othersFailureMessage);
				}
			} else {
				if (thing.successMessage) {
					controller.sendMessage(playerConn, thing.successMessage);
				}

				if (thing.othersSuccessMessage) {
					controller.sendMessageRoomExcept(playerConn, player.name + " " + thing.othersSuccessMessage);
				}
			}

			if (callback)
				callback(doit);
		});
	},
	/**
	 * Test whether all of the given array of target `MUDObject`s have the same name.
	 * @param ftargets [db.MUDObject...] the array of objects to test
	 * @return true if all objects have the same name; false othewise.
	 */
	sameName: function(ftargets) {
		if (ftargets.length <= 1) return true;

		var name = ftargets[0].name;

		for (var i=1; i<ftargets.length; i++) {
			if (name !== ftargets[i].name) 
				return false;
		}

		return true;
	}
};


//private functions
/**
  * (Private) Test whether a player could potentially do something to a thing.
  * @param player the player
  * @param room the thing
  * @param callback the callback function to call; takes a single 
  *			boolean argument, which is true if the player can do 
  *			the thing and false otherwise.
  */
function couldDoIt(player, thing, callback) {
	if(thing.type !== 'ROOM' && !thing.locationId) {
		callback(false);
		return;
	}

	//can't use an unlinked exit
	if(thing.type === 'EXIT' && thing.targetId===null) {
		callback(false);
		return;
	}

	//no key, so can do it
	var keyId = thing.keyId;
    if(!keyId) {
    	callback(true);
    	return;
    }

    //player is the key... can do it
    if (player.id === keyId) {
		callback(!thing.hasAntiLock());
		return;
	}

	db.MUDObject.find({where: {locationId: player.id, id: keyId}}).success(function(obj) {
		if (obj) callback(!thing.hasAntiLock());
		else callback(thing.hasAntiLock());
	});
}
