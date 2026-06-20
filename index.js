const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jose = require('jose-cjs');

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

async function verifyToken(req, res, next) {
  try {
    const cookies = req.headers.cookie;

    if (!cookies) {
      return res.status(401).send({
        success: false,
        message: 'Unauthorized! No session cookie found.',
      });
    }

    const authResponse = await fetch(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/get-session`,
      {
        headers: {
          cookie: cookies,
        },
      },
    );

    if (!authResponse.ok) {
      return res
        .status(401)
        .send({ success: false, message: 'Unauthorized session.' });
    }

    const sessionData = await authResponse.json();

    if (sessionData && sessionData.user) {
      req.user = sessionData.user;
      return next();
    }

    return res.status(401).send({
      success: false,
      message: 'Unauthorized! Invalid or expired session.',
    });
  } catch (error) {
    return res
      .status(403)
      .send({ success: false, message: 'Forbidden! Verification failed.' });
  }
}

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

    app.get('/api/classes/:id', verifyToken, async (req, res) => {
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

    app.get('/api/forum/:id', verifyToken, async (req, res) => {
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

    // Payment
    app.post('/api/create-payment-intent', verifyToken, async (req, res) => {
      try {
        const { price, userEmail } = req.body;

        if (!userEmail) {
          return res.status(401).send({
            success: false,
            message: 'Unauthorized! Please login first.',
          });
        }

        const amount = parseInt(price * 100);
        if (!amount || amount < 1)
          return res.status(400).send({ message: 'Invalid amount' });

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.post('/api/bookings', async (req, res) => {
      try {
        const bookingData = req.body;

        if (!bookingData.userEmail) {
          return res.status(401).send({
            success: false,
            message: 'Unauthorized! Please login to book.',
          });
        }

        const newBooking = {
          ...bookingData,
          createdAt: new Date(),
        };
        const bookingResult = await bookingsCollection.insertOne(newBooking);
        const classFilter = { _id: new ObjectId(bookingData.classId) };
        const updateDoc = {
          $inc: { bookingCount: 1 },
        };
        await classesCollection.updateOne(classFilter, updateDoc);

        res.send({
          success: true,
          message: 'Booking confirmed successfully! 🎉',
          bookingResult,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/my-bookings', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, message: 'Email parameter is required' });
        }

        const query = { userEmail: email };
        const result = await bookingsCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.delete('/api/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const booking = await bookingsCollection.findOne(query);
        if (!booking) {
          return res
            .status(404)
            .send({ success: false, message: 'Booking not found' });
        }

        const deleteResult = await bookingsCollection.deleteOne(query);

        const classFilter = { _id: new ObjectId(booking.classId) };
        const updateDoc = {
          $inc: { bookingCount: -1 },
        };
        await classesCollection.updateOne(classFilter, updateDoc);

        res.send({
          success: true,
          message: 'Booking cancelled successfully!',
          deleteResult,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/favorites', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, message: 'Email required' });
        }
        const query = { userEmail: email };

        const result = await favoritesCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.delete('/api/favorites/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await favoritesCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: 'Favorite not found' });
        }
        res.send({
          success: true,
          message: 'Removed from favorites!',
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.post('/api/favorites', async (req, res) => {
      try {
        const favoriteData = req.body;

        if (!favoriteData.userEmail) {
          return res
            .status(401)
            .send({ success: false, message: 'Unauthorized! Login required.' });
        }

        const exists = await favoritesCollection.findOne({
          userEmail: favoriteData.userEmail,
          classId: favoriteData.classId,
        });

        if (exists) {
          return res
            .status(400)
            .send({ success: false, message: 'Already in your favorites!' });
        }

        const result = await favoritesCollection.insertOne(favoriteData);
        res.send({
          success: true,
          message: 'Added to favorites successfully!',
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // Trainer Recruitment
    app.post('/api/trainer-applications', async (req, res) => {
      try {
        const applicationData = req.body;

        const isExist = await database
          .collection('trainer_applications')
          .findOne({ email: applicationData.email });
        if (isExist) {
          return res.status(400).send({
            success: false,
            message: 'You have already submitted an application!',
          });
        }

        const result = await database
          .collection('trainer_applications')
          .insertOne(applicationData);
        res.send({
          success: true,
          message: 'Application submitted successfully!',
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.get('/api/trainer-applications', async (req, res) => {
      try {
        const query = { status: 'Pending' };
        const result = await database
          .collection('trainer_applications')
          .find(query)
          .sort({ _id: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.patch('/api/trainer-applications/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { action, userEmail } = req.body;

        const applicationFilter = { _id: new ObjectId(id) };

        if (action === 'Approved') {
          await database
            .collection('trainer_applications')
            .updateOne(applicationFilter, {
              $set: { status: 'Approved' },
            });

          const userFilter = { email: userEmail };
          const updateUserDoc = {
            $set: { role: 'trainer' },
          };
          const userUpdateResult = await usersCollection.updateOne(
            userFilter,
            updateUserDoc,
          );

          return res.send({
            success: true,
            message: 'Application approved! User is now an Elite Trainer.',
            userUpdateResult,
          });
        }

        if (action === 'Rejected') {
          await database
            .collection('trainer_applications')
            .updateOne(applicationFilter, {
              $set: { status: 'Rejected' },
            });
          return res.send({
            success: true,
            message: 'Application has been rejected.',
          });
        }
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
