const sqlite3 = require('sqlite3').verbose();

// Connect to the database
const db = new sqlite3.Database('database.db');

db.serialize(() => {
  // Create a users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      score INTEGER DEFAULT 0,
      token TEXT,
      datetime DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});



  // Query the data
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      console.log(rows);
    }
  });




module.exports = {
  registerUser: function (username, password, score, callback) {
    // Insert the user into the database
    db.run('INSERT INTO users (username, password, score) VALUES (?, ?, ?)', [username, password, score], callback);
  },
  getUserByUsername: function (username, callback) {
    // Retrieve the user from the database by username
    db.get('SELECT * FROM users WHERE username = ?', [username], callback);
  },
  getUserByUserId: function (userid, callback) {
    // Retrieve the user from the database by username
    db.get('SELECT * FROM users WHERE id = ?', [userid], callback);
  },
  updateScore: function (userid, score, callback) {
    // Update the user's score in the database
    db.run('UPDATE users SET score = ? WHERE id = ?', [score, userid], callback);
  },
  getTopScores: function (limit, callback) {
  db.all('SELECT username, score, datetime FROM users ORDER BY score DESC LIMIT ?', [limit], callback);
  },
  // Additional database functions...
  close: function(){
      // Close the database connection
    db.close();
  },
  updateUserToken: function (username, token, callback) {
    // Update the user's token in the database
    db.run('UPDATE users SET token = ? WHERE username = ?', [token, username], callback);
  },
    updateUserTokenById: function (id, token, callback) {
    // Update the user's token in the database
    db.run('UPDATE users SET token = ? WHERE id = ?', [token, id], callback);
  },
  getLastScores: function (limit, callback) {
  db.all('SELECT username, score, datetime FROM users ORDER BY datetime DESC LIMIT ?', [limit], callback);
},
  updateScore2: function (userid, score) {
      return new Promise((resolve, reject) => {
        db.run('UPDATE users SET score = ? WHERE id = ?', [score, userid], function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
  },
 getTopScores2: function(limit) {
      return new Promise((resolve, reject) => {
        db.all('SELECT username, score, datetime FROM users ORDER BY score DESC LIMIT ?', [limit], function (err, rows) {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    },
    getLastScores2: function(limit) {
      return new Promise((resolve, reject) => {
        db.all('SELECT username, score, datetime FROM users ORDER BY datetime DESC LIMIT ?', [limit], function (err, rows) {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    },
};
