/**
 * models/index.js
 * 
 * Entry point for sequelize database definition
 *
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */
if (!global.hasOwnProperty('db')) {
  var Sequelize = require('sequelize');
  var sequelize = null;

  //edit to suit your heroku database
  var dbUrl = process.env.HEROKU_POSTGRESQL_GREEN_URL;
  
  if (dbUrl) {
    //if the heroku database is set, it will be used

    //parse the url
    var match = dbUrl.match(/postgres:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)/);

    // construct the sequelize object
    sequelize = new Sequelize(match[5], match[1], match[2], {
      dialect:  'postgres',
      protocol: 'postgres',
      port:     match[4],
      host:     match[3],
      logging:  console.log
    });
  } else {
    //otherwise we'll just use SQLite (which doesn't require any setup :))
    sequelize = new Sequelize('database', 'username', 'password', {
      dialect: 'sqlite',
      storage: './dev-database.sqlite'
    });
  }
  
  //define the database
  global.db = {
    Sequelize:  Sequelize,
    sequelize:  sequelize,
    MUDObject:  sequelize.import(__dirname + '/MUDObject')
  };

  //add relations/assocations by calling the `associate` method defined in the model
  Object.keys(global.db).forEach(function(modelName) {
    if ('associate' in global.db[modelName]) {
      global.db[modelName].associate(global.db);
    }
  });
}

module.exports = global.db;
