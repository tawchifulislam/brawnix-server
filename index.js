const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('Brawnix Elite Fitness Server is Running...');
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log('Connected successfully to Brawnix MongoDB!');

    const database = client.db('brawnix_db');

    const usersCollection = database.collection('users');
    const classesCollection = database.collection('classes');
    const bookingsCollection = database.collection('bookings');
    const favoritesCollection = database.collection('favorites');
    const forumCollection = database.collection('forum');
    const sessionCollection = database.collection('sessions');

    app.post('/api/auth/register', async (req, res) => {
      try {
        const { name, email, image, password } = req.body;

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
        if (!passwordRegex.test(password)) {
          return res.status(400).send({
            success: false,
            message:
              'Password must be at least 6 characters, include one uppercase and one lowercase letter.',
          });
        }

        const query = { email: email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
          return res
            .status(400)
            .send({ success: false, message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
          name,
          email,
          image,
          password: hashedPassword,
          role: 'user',
          status: 'active',
          trainerStatus: null,
          adminFeedback: '',
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);
        res.send({
          success: true,
          message: 'Registration successful!',
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Brawnix Server is running on port ${port}`);
});
