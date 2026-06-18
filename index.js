const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
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

    app.get('/api/classes/featured', async (req, res) => {
      try {
        const query = { status: 'Approved' };
        const cursor = classesCollection
          .find(query)
          .sort({ bookingCount: -1 })
          .limit(6);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/forum/latest', async (req, res) => {
      try {
        const cursor = forumCollection.find({}).sort({ _id: -1 }).limit(4);
        const result = await cursor.toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/classes', async (req, res) => {
      try {
        let query = { status: 'Approved' };

        if (req.query.search) {
          query.className = {
            $regex: req.query.search,
            $options: 'i',
          };
        }

        if (req.query.category) {
          const categoriesArray = req.query.category.split(',');
          query.category = { $in: categoriesArray };
        }

        const cursor = classesCollection.find(query);
        const result = await cursor.toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/classes/:id', async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await classesCollection.findOne(query);

        if (!result) {
          return res
            .status(404)
            .send({ success: false, message: 'Class not found.' });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/forum', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const skipItems = (page - 1) * limit;
        const totalPosts = await forumCollection.countDocuments({});
        const cursor = forumCollection
          .find({})
          .sort({ _id: -1 })
          .skip(skipItems)
          .limit(limit);
        const posts = await cursor.toArray();

        res.send({
          total: totalPosts,
          page,
          limit,
          posts,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/forum/:id', async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await forumCollection.findOne(query);

        if (!result) {
          return res
            .status(404)
            .send({ success: false, message: 'Article not found.' });
        }

        res.send(result);
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
