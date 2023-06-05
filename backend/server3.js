const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');

// Import the database module
const db = require('./users/database');

// Middleware to parse JSON data
app.use(express.json());
// Middleware to parse JSON data
app.use(bodyParser.json());
// Enable CORS
app.use(cors());

const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// Set up session middleware
app.use(session({
    secret: 'your-secret-key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({
      db: './users/database.db', // Replace with the path to your SQLite database file
      table: 'sessions',
      ttl: 604800, // Session expiration time (in seconds), e.g., 7 days
    }),
  })
);

const jwt = require('jsonwebtoken');

function generateAuthToken(userId) {
  const secretKey = 'your-secret-key'; // Replace with your own secret key
  const token = jwt.sign({ id: userId }, secretKey);
  return token;
}

const verifyToken = (req, res, next) => {
  const token =
    req.body.token || req.query.token || req.headers['authorization'];

  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }

  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    req.user = decoded;

    db.getUserByUserId(decoded.id, (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!user) {
        return res.status(401).json({ error: 'User id not found' });
      }
      if (user.token !== token) {
        return res.status(401).json({ error: 'Token expired' });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    return res.status(401).send("Invalid Token");
  }
};


app.use('/submitscore', verifyToken);
app.use('/logout', verifyToken);

app.post("/login", async (req, res) => {

  // Our login logic starts here
  try {
    // Get user input
    const { username, password } = req.body;

    // Validate user input
    if (!(username && password)) {
      res.status(400).send("All input is required");
    }
     db.getUserByUsername(username, (err, user) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Username not found' });
        }

        // Check if the password matches using bcrypt
        bcrypt.compare(password, user.password, (bcryptErr, result) => {
          if (bcryptErr) {
            console.error(bcryptErr);
            return res.status(500).json({ error: 'Internal server error' });
          }

          if (!result) {
            // Password does not match
            return res.status(401).json({ error: 'Incorrect password' });
          }

          const authToken = generateAuthToken(user.id); // Generate the authentication token
          user.token = authToken;

          db.updateUserToken(username, authToken, (err, user) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Internal server error' });
            }
          });

          return res.json({ message: 'Login successful', authToken });
        });
    })
  } catch (err) {
    console.log(err);
  }
});

// Define the registration route
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Perform validation checks on the input data
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check if the username already exists in the database
  db.getUserByUsername(username, (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (user) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Encrypt the password
    bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
      if (hashErr) {
        console.error(hashErr);
        return res.status(500).json({ error: 'Internal server error' });
      }

      // Register the user in the database with the hashed password
      db.registerUser(username, hashedPassword, 0, (registerErr) => {
        if (registerErr) {
          console.error(registerErr);
          return res.status(500).json({ error: 'Internal server error' });
        }

        return res.json({ message: 'User registered successfully' });
      });
    });
  });
});

// Server-side code
let topScores = []; // In-memory variable to store the top 10 scores
let latestScoresTable = [];  // In-memory variable to store the last 10 scores

// Function to update the topScores table
function updateTopScoresTable() {
  db.getTopScores(10, (err, scores) => {
    if (err) {
      console.error(err);
      return;
    }
    topScores = scores;
    //console.log('topScores: ' + JSON.stringify(topScores));
  });
}

function updateLastScoresTable() {
  db.getLastScores(10, (err, scores) => {
    if (err) {
      console.error(err);
      return;
    }
    latestScoresTable = scores;
    //console.log('latestScoresTable: ' + JSON.stringify(latestScoresTable));
  });
}

// Endpoint to retrieve both tables
app.get('/scores', (req, res) => {
    return res.json({ topScores: topScores, latestScores: latestScoresTable });
});

// Endpoint to handle score submission
app.post('/submitscore2', (req, res) => {
  // Process the submitted score and store it in the database
  const { score } = req.body;
  const username = req.user.username;
console.log('/submitscore: ' + score +' ' + req.user.id);
  db.updateScore(req.user.id, score, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Update the topScores table
    updateTopScoresTable(()=>{return res.json({ message: 'updateTopScoresTable updated successfully' });});

    updateLastScoresTable(()=>{return res.json({ message: 'updateLastScoresTable updated successfully' });});

    // Send a Server-Sent Event to connected clients to update their tables
    //const eventData = JSON.stringify({ latestScores: latestScoresTable, topScores: topScores });
console.log('before sendSSEToAllClients: ' + JSON.stringify(topScores));
  //  sendSSEToAllClients(eventData);
sendEventsToAll();

    return res.json({ message: 'Score submitted successfully' });
  });
});

app.post('/submitscore', async (req, res) => {
  const { score } = req.body;
  const username = req.user.username;
console.log('/submitscore: ' + score +' ' + req.user.id);
  try {
    // Update the score
    await db.updateScore2(req.user.id, score);

    // Fetch the updated top scores
    const updatedTopScores = await db.getTopScores2(10);

    const updatedLastScores = await db.getLastScores2(10);

    // Update the topScores variable
    topScores = updatedTopScores;
    latestScoresTable = updatedLastScores;
console.log('topScores: ' + JSON.stringify(topScores));
    sendEventsToAll();
    return res.json({ message: 'Score submitted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/logout', (req, res) => {
          db.updateUserTokenById(req.user.id, '', (err, user) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Internal server error' });
            }
          });
  //console.log('req.session: ' + JSON.stringify(req.session));
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.json({ message: 'Logged out successfully' });
  });
});

// SSE
let connectedClients = [];

// SSE endpoint
app.get('/updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
console.log("/updates");

  // Send the latest scores data as an initial message
  const initialEventData = JSON.stringify({ latestScores: latestScoresTable, topScores: topScores });
  res.write(`data: ${initialEventData}\n\n`);

  // Add the client to the connected clients list
  connectedClients.push(res);

  // Remove the client from the connected clients list when the connection is closed
  req.on('close', () => {
    const clientIndex = connectedClients.indexOf(res);
    connectedClients.splice(clientIndex, 1);
    console.log("close");
  });
});

// Function to send SSE to all connected clients
function sendSSEToAllClients(eventData) {
  connectedClients.forEach((client) => {
    client.write(`event: update\n`);
    client.write(`data: ${eventData}\n\n`);
    console.log('eventData: '+eventData);
  });
}

function init(){
    updateTopScoresTable();
    updateLastScoresTable();
}


init();

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});


function eventsHandler(request, response, next) {
console.log('eventsHandler');
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  response.writeHead(200, headers);

  const data = `data: ${JSON.stringify({ latestScores: latestScoresTable, topScores: topScores })}\n\n`;

  response.write(data);

  const clientId = Date.now();

  const newClient = {
    id: clientId,
    response
  };

  connectedClients.push(newClient);

  request.on('close', () => {
    console.log(`${clientId} Connection closed`);
    connectedClients = connectedClients.filter(client => client.id !== clientId);
  });
}

app.get('/events', eventsHandler);

function sendEventsToAll() {
console.log('sendEventsToAll');
  connectedClients.forEach(client => client.response.write(`data: ${JSON.stringify({ latestScores: latestScoresTable, topScores: topScores })}\n\n`))
}



