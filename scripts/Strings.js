/**
 * scripts/strings.js
 * 
 * Strings for communicating with a player. 
 * 
 * Note that some strings may be parsed by the string library 
 * (http://stringjs.com/#methods/template-values-open-close) to 
 * perform templating, and hence the `{{...}}` constructs.
 *
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
module.exports = {
	loginPrompt:  
				"                                                                                \n" + 
				"Welcome to ECS-MUD!                                                             \n" + 
				"                                                                                \n" + 
				"================================================================================\n" +
				"                                                                                \n" +
				"           ███████╗ ██████╗███████╗      ███╗   ███╗██╗   ██╗██████╗            \n" +
				"           ██╔════╝██╔════╝██╔════╝      ████╗ ████║██║   ██║██╔══██╗           \n" +
				"           █████╗  ██║     ███████╗█████╗██╔████╔██║██║   ██║██║  ██║           \n" +
				"           ██╔══╝  ██║     ╚════██║╚════╝██║╚██╔╝██║██║   ██║██║  ██║           \n" +
				"           ███████╗╚██████╗███████║      ██║ ╚═╝ ██║╚██████╔╝██████╔╝           \n" +
				"           ╚══════╝ ╚═════╝╚══════╝      ╚═╝     ╚═╝ ╚═════╝ ╚═════╝            \n" +
				"                                                                                \n" +
				"================================================================================\n" +
				"Use create <name> <password> to create a character.                             \n" + 
				"Use connect <name> <password> to create a character.                            \n" + 
				"Use QUIT to logout.                                                             \n" + 
				"Use the WHO command to find out who is online currently.                        \n" + 
				"================================================================================\n" +
				"                                                                                \n",
	alreadyLoggedIn:	"You are aready logged in.",
	unknownCommand:		"Huh?",
	badUsername: 		"Bad username.",
	usernameInUse: 		"There is already a player with that name.",
	badPassword: 		"Bad password.",
	incorrectPassword: 	"That is not the correct password.", 
	playerNotFound:		"There is no player with that name.", 
	hasConnected: 		"{{name}} has connected.", 
	hasDisconnected: 	"{{name}} has disconnected.", 
	youSay: 			"You say \"{{message}}\"",
	says: 				"{{name}} says \"{{message}}\"", 
	invalidName: 		"Invalid name.", 
	roomCreated: 		"Room \"{{name}}\" created with ID: {{id}}.",
	youWhisper: 		"You whisper \"{{message}}\" to {{name}}.",
	toWhisper: 			"{{name}} whispers \"{{message}}\" to you.",
	whisper: 			"{{fromName}} whispers something to {{toName}}", 
	overheard: 			"You overheard {{fromName}} whisper \"{{message}}\" to {{toName}}", 
	notInRoom: 			"Whisper to whom?",
	dontSeeThat: 		"I don't see that here.",
	contents:  			"Contents:",
	enters: 			"{{name}} has arrived.",
	notConnected: 		"{{name}} is not connected.",
	noGo: 				"You can't go that way.",
	ambigGo: 			"I don't know which way you mean!",
	ambigSet: 			"I don't know which one you mean!", 
	nothingSpecial: 	"You see nothing special.",
	permissionDenied: 	"Permission denied.",
	unlinkUnknown: 		"Unlink what?",
	unlinked:			"Unlinked.",
	notARoom:			"That's not a room!", 
	homeSet: 			"Home set.", 
	linked:				"Linked.",
	exitBeingCarried: 	"That exit is being carried.",
	lockUnknown: 		"Lock what?",
	unlockUnknown: 		"Unlock what?",
	unlocked:			"Unlocked.",
	locked:				"Locked.",
	leaves: 			"{{name}} has left.",
	set: 				"{{property}} set.",
	reset: 				"{{property}} reset.",
	setUnknown:  		"Set what?",
	successMessage: 	"success message",
	othersSuccessMessage: "others success message",
	failureMessage:  	"failure message",
	othersFailureMessage: "others failure message",
	description:  		"description",
	name: 				"name",
	cantTakeThat: 		"You can't take that!",
	cantTakeLinkedExit:	"You can only take unlinked exits.",
	alreadyHaveThat: 	"You already have that.",
	taken: 				"Taken.",
	takeUnknown: 		"Take what?", 
	examineUnknown: 	"Examine what?",
	examineContentsName:"\t{{type}} {{name}}",
	examine: 			"{{name}} (#{{id}})\n" +
						"Description: {{description}}\n" + 
						"Failure message: {{failureMessage}}\n" + 
						"Success message: {{successMessage}}\n" + 
						"Others failure message: {{othersFailureMessage}}\n" +
						"Others success message: {{othersSuccessMessage}}\n" +
						"Type: {{type}}\n" +
						"Flags: {{flags}}\n" + 
						"Password: {{password}}\n" + 
						"Target: {{targetId}}\n" +
						"Location: {{locationId}}\n" +
						"Owner: {{ownerId}}\n" + 
						"Key: {{keyId}}\n",
	isNotAvailable: 	"I don't recognize that name.",
	page: 				"You sense that {{name}} is looking for you in {{location}}.", 
	pageOK: 			"Your message has been sent.",
	changePasswordFail: "Sorry.",
	changePasswordSuccess: "Password changed.",
	dontHave: 			"You don't have that.",
	dropped: 			"Dropped.", 
	noPlaceLikeHome: 	"There's no place like home...",
	goneHome: 			"You wake up back home, without your possessions.",
	goesHome: 			"{{name}} goes home.", 
	carrying: 			"Carrying:",
	carryingNothing: 	"You aren't carrying anything.",
	youAreCarrying: 	"You are carrying:",
	roomNameOwner: 		"{{name}} (#{{id}})",
	roomName: 			"{{name}}",
	opened: 			"Opened.", 
	created: 			"Created.",
	keyUnknown:  		"Lock with what?", 
};
