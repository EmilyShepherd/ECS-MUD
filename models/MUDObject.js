/**
 * models/MUDObject.js
 * 
 * Sequelize database table/object definition for a `MUDObject`.
 * Every thing in the game (players, rooms, exits and things)
 * is an instance of a MUDObject.
 * 
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
module.exports = function(sequelize, DataTypes) {
	var MUDObject = sequelize.define("MUDObject", {
		/* Name of the object */
		name: {
			type: DataTypes.STRING, 
			allowNull:false
		},
		/* Description text */
		description: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		/* what player sees if op fails */
		failureMessage: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		/* what player sees if op succeeds */
		successMessage: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		/* what others see if op fails */
		othersFailureMessage: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		/* what others see if op succeeds */
		othersSuccessMessage: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		/* type of MUDObject */
		type: {
			type: DataTypes.ENUM,
			values: ['ROOM', 'THING', 'EXIT', 'PLAYER'],
			allowNull: false
		},
		/* bit flags defining the attributes of the object */
		flags: DataTypes.INTEGER,
		/* Password (only used for people) */
		password: {
			type: DataTypes.STRING,
			allowNull: true
		}
	}, {
		classMethods: {
			associate: function(models) {
	  			/* the target of the object (this is where exits go and things dropped in rooms go) */
				MUDObject.belongsTo(MUDObject, {foreignKey: 'targetId', as: 'target'});

				/*the location of the object */
				MUDObject.belongsTo(MUDObject, {foreignKey: 'locationId', as: 'location'});

				/* owner who controls this object */
				MUDObject.belongsTo(MUDObject, {foreignKey: 'ownerId', as: 'owner'});

				/* key required to use this object */
				MUDObject.belongsTo(MUDObject, {foreignKey: 'keyId', as: 'key'});
			},
			/* Attribute flags */
			FLAGS: {
				/* Anyone can link to this room */
				link_ok: 1<<0,
				/* The meaning of the lock applied to the object is reversed */
				anti_lock: 1<<1,
				/* Anything dropped in this room will go to its home */
				temple: 1<<2
			},
		},
		instanceMethods: {
			/* Get a flag by name (corresponding to the property names in FLAGS) */
			getFlag: function(flag) {
				return this.flags & global.db.MUDObject.FLAGS[flag];
			},
			/* Can anyone can link to this room? */
			canLink: function() {
				return this.flags & global.db.MUDObject.FLAGS.link_ok;
			},
			/* Is the meaning of the key reversed on this object? */
			hasAntiLock: function() {
				return this.flags & global.db.MUDObject.FLAGS.anti_lock;
			},
			/* Is the room a temple, where dropped items return to their homes? */
			isTemple: function() {
				return this.flags & global.db.MUDObject.FLAGS.temple;
			},
			/* Get the things contained in this room. Returns a promise that you can call .success(callback) on. */
			getContents: function() {
				return global.db.MUDObject.findAll({ where : {locationId: this.id}});
			},
			/* Set a flag by value. Returns a promise that you can call .success(callback) on. */
			setFlag: function(flagbit) {
				this.flags |= flagbit;
				return this.save();
			},
			/* Reset a flag by value. Returns a promise that you can call .success(callback) on. */
			resetFlag: function(flagbit) {
				this.flags &= ~flagbit;

				return this.save();
			}
		}
	});

	return MUDObject;
};
