const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

const app = express();
const port = process.env.PORT || 5000;

app.set('trust proxy', 1);

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

const JWKS = createRemoteJWKSet(
  new URL(
    `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/jwks`,
  ),
);

let usersCollectionRef;

async function verifyToken(req, res, next) {
  try {
    const token = req.cookies?.token;

    console.log('Token:', token);

    if (!token) {
      return res.status(401).send({
        success: false,
        message: 'Unauthorized! No token found.',
      });
    }

    const { payload } = await jwtVerify(token, JWKS);

    console.log('Payload:', payload);

    const user = await usersCollectionRef.findOne({
      email: payload.email,
    });

    console.log('User:', user);

    req.user = user;

    next();
  } catch (error) {
    console.log(error);

    return res.status(401).send({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
}

const verifyUser = (req, res, next) => {
  if (req.user?.role !== 'user') {
    return res
      .status(403)
      .send({ success: false, message: 'Forbidden access' });
  }
  next();
};

const verifyTrainer = (req, res, next) => {
  if (req.user?.role !== 'trainer') {
    return res
      .status(403)
      .send({ success: false, message: 'Forbidden access' });
  }
  next();
};

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res
      .status(403)
      .send({ success: false, message: 'Forbidden access' });
  }
  next();
};

const checkNotBlocked = (req, res, next) => {
  if (req.user?.status === 'blocked') {
    return res.status(403).send({
      success: false,
      message: 'Action restricted by Admin',
    });
  }
  next();
};

// async function run() {
//   try {
//     await client.connect();
//     console.log('Connected successfully to Brawnix MongoDB!');
client
  .connect(() => {
    console.log('Connecting to MongoDB');
  })
  .catch(console.dir);
const database = client.db('brawnix_db');

const usersCollection = database.collection('users');
const classesCollection = database.collection('classes');
const bookingsCollection = database.collection('bookings');
const favoritesCollection = database.collection('favorites');
const forumCollection = database.collection('forum');
const commentsCollection = database.collection('comments');
usersCollectionRef = usersCollection;

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skipItems = (page - 1) * limit;

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

    const totalClasses = await classesCollection.countDocuments(query);

    const cursor = classesCollection.find(query).skip(skipItems).limit(limit);
    const classes = await cursor.toArray();

    res.send({
      total: totalClasses,
      page,
      limit,
      classes,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.get('/api/classes/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await classesCollection.find().sort({ _id: -1 }).toArray();
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

app.get('/api/forum/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await forumCollection.find().sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.patch(
  '/api/forum/like/:id',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const id = req.params.id;
      const email = req.user.email;

      const post = await forumCollection.findOne({ _id: new ObjectId(id) });
      if (!post) {
        return res
          .status(404)
          .send({ success: false, message: 'Post not found' });
      }

      const likes = post.likes || [];
      const dislikes = post.dislikes || [];

      let updateDoc;
      if (likes.includes(email)) {
        updateDoc = { $pull: { likes: email } };
      } else {
        updateDoc = {
          $addToSet: { likes: email },
          $pull: { dislikes: email },
        };
      }

      const result = await forumCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc,
      );
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.patch(
  '/api/forum/dislike/:id',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const id = req.params.id;
      const email = req.user.email;

      const post = await forumCollection.findOne({ _id: new ObjectId(id) });
      if (!post) {
        return res
          .status(404)
          .send({ success: false, message: 'Post not found' });
      }

      const dislikes = post.dislikes || [];

      let updateDoc;
      if (dislikes.includes(email)) {
        updateDoc = { $pull: { dislikes: email } };
      } else {
        updateDoc = {
          $addToSet: { dislikes: email },
          $pull: { likes: email },
        };
      }

      const result = await forumCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc,
      );
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

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

app.post('/api/forum', verifyToken, checkNotBlocked, async (req, res) => {
  try {
    if (req.user.role !== 'trainer' && req.user.role !== 'admin') {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access' });
    }

    const postData = req.body;

    if (postData.authorEmail !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Email mismatch' });
    }

    const newPost = {
      ...postData,
      authorName: req.user.name,
      authorImage: req.user.image,
      createdAt: new Date(),
    };

    const result = await forumCollection.insertOne(newPost);
    res.send({ success: true, message: 'Forum post published!', result });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

// Comments
app.get('/api/comments/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const result = await commentsCollection
      .find({ postId })
      .sort({ _id: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.post('/api/comments', verifyToken, checkNotBlocked, async (req, res) => {
  try {
    const commentData = req.body;

    if (commentData.authorEmail !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Email mismatch' });
    }

    const newComment = {
      ...commentData,
      authorName: req.user.name,
      authorImage: req.user.image,
      createdAt: new Date(),
    };

    const result = await commentsCollection.insertOne(newComment);
    res.send({ success: true, message: 'Comment posted!', result });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.patch(
  '/api/comments/:id',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { text } = req.body;

      const comment = await commentsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!comment) {
        return res
          .status(404)
          .send({ success: false, message: 'Comment not found' });
      }
      if (comment.authorEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const result = await commentsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { text } },
      );
      res.send({ success: true, message: 'Comment updated!', result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.delete(
  '/api/comments/:id',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const id = req.params.id;

      const comment = await commentsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!comment) {
        return res
          .status(404)
          .send({ success: false, message: 'Comment not found' });
      }
      if (comment.authorEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const result = await commentsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, message: 'Comment deleted!', result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Payment
app.post(
  '/api/create-payment-intent',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
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
  },
);

// Bookings
app.post('/api/bookings', verifyToken, checkNotBlocked, async (req, res) => {
  try {
    const bookingData = req.body;

    if (bookingData.userEmail !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Email mismatch' });
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
      message: 'Booking confirmed successfully!',
      bookingResult,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.get('/api/bookings/check', verifyToken, async (req, res) => {
  try {
    const { email, classId } = req.query;
    if (!email || !classId) {
      return res.status(400).send({
        success: false,
        message: 'Email and classId are required',
      });
    }

    if (email !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access' });
    }

    const existing = await bookingsCollection.findOne({
      userEmail: email,
      classId: classId,
    });

    res.send({ alreadyBooked: !!existing });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.get('/api/my-bookings', verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res
        .status(400)
        .send({ success: false, message: 'Email parameter is required' });
    }

    if (email !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access' });
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

app.delete(
  '/api/bookings/:id',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const booking = await bookingsCollection.findOne(query);
      if (!booking) {
        return res
          .status(404)
          .send({ success: false, message: 'Booking not found' });
      }

      if (booking.userEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
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
  },
);

// Favorites
app.get('/api/favorites', verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res
        .status(400)
        .send({ success: false, message: 'Email required' });
    }

    if (email !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access' });
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

app.delete(
  '/api/favorites/:id',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const favorite = await favoritesCollection.findOne(query);
      if (!favorite) {
        return res
          .status(404)
          .send({ success: false, message: 'Favorite not found' });
      }

      if (favorite.userEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const result = await favoritesCollection.deleteOne(query);

      res.send({
        success: true,
        message: 'Removed from favorites!',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.post('/api/favorites', verifyToken, checkNotBlocked, async (req, res) => {
  try {
    const favoriteData = req.body;

    if (favoriteData.userEmail !== req.user.email) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access' });
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

// Trainer Application
app.post(
  '/api/trainer-applications',
  verifyToken,
  checkNotBlocked,
  async (req, res) => {
    try {
      const applicationData = req.body;

      if (applicationData.email !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Email mismatch' });
      }

      const isExist = await database
        .collection('trainer_applications')
        .findOne({ email: applicationData.email, status: 'Pending' });

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
  },
);

app.get('/api/trainer-applications/me', verifyToken, async (req, res) => {
  try {
    const application = await database
      .collection('trainer_applications')
      .findOne({ email: req.user.email }, { sort: { _id: -1 } });

    if (!application) {
      return res.send(null);
    }

    res.send({
      status: application.status,
      feedback: application.feedback || '',
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.get(
  '/api/trainer-applications',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
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
  },
);

app.patch(
  '/api/trainer-applications/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { action, userEmail, feedback } = req.body;

      const applicationFilter = { _id: new ObjectId(id) };

      if (action === 'Approved') {
        await database
          .collection('trainer_applications')
          .updateOne(applicationFilter, {
            $set: { status: 'Approved', feedback: feedback || '' },
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
            $set: { status: 'Rejected', feedback: feedback || '' },
          });
        return res.send({
          success: true,
          message: 'Application has been rejected.',
        });
      }
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Classes (Trainer)
app.post(
  '/api/classes',
  verifyToken,
  checkNotBlocked,
  verifyTrainer,
  async (req, res) => {
    try {
      const classData = req.body;

      if (classData.trainerEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Email mismatch' });
      }

      const newClass = {
        ...classData,
        status: 'Pending',
        bookingCount: 0,
        createdAt: new Date(),
      };

      const result = await classesCollection.insertOne(newClass);
      res.send({
        success: true,
        message: 'Class submitted! Waiting for admin approval.',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.get(
  '/api/classes/trainer/:email',
  verifyToken,
  verifyTrainer,
  async (req, res) => {
    try {
      const email = req.params.email;

      if (email !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const query = { trainerEmail: email };
      const result = await classesCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.patch(
  '/api/classes/:id',
  verifyToken,
  checkNotBlocked,
  verifyTrainer,
  async (req, res) => {
    try {
      const id = req.params.id;
      const updatedData = req.body;

      const existingClass = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!existingClass) {
        return res
          .status(404)
          .send({ success: false, message: 'Class not found' });
      }
      if (existingClass.trainerEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const updateDoc = {
        $set: {
          className: updatedData.className,
          category: updatedData.category,
          difficultyLevel: updatedData.difficultyLevel,
          duration: updatedData.duration,
          schedule: updatedData.schedule,
          price: updatedData.price,
          description: updatedData.description,
          image: updatedData.image,
        },
      };

      const result = await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc,
      );
      res.send({
        success: true,
        message: 'Class updated successfully!',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.delete(
  '/api/classes/:id',
  verifyToken,
  checkNotBlocked,
  verifyTrainer,
  async (req, res) => {
    try {
      const id = req.params.id;

      const existingClass = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!existingClass) {
        return res
          .status(404)
          .send({ success: false, message: 'Class not found' });
      }
      if (existingClass.trainerEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const result = await classesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({
        success: true,
        message: 'Class deleted successfully!',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.get(
  '/api/classes/:id/students',
  verifyToken,
  verifyTrainer,
  async (req, res) => {
    try {
      const id = req.params.id;

      const targetClass = await classesCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!targetClass) {
        return res
          .status(404)
          .send({ success: false, message: 'Class not found' });
      }
      if (targetClass.trainerEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const students = await bookingsCollection.find({ classId: id }).toArray();
      res.send(students);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Forum (Trainer)
app.get(
  '/api/forum/trainer/:email',
  verifyToken,
  verifyTrainer,
  async (req, res) => {
    try {
      const email = req.params.email;

      if (email !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const result = await forumCollection
        .find({ authorEmail: email })
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.delete(
  '/api/forum/:id',
  verifyToken,
  checkNotBlocked,
  verifyTrainer,
  async (req, res) => {
    try {
      const id = req.params.id;

      const existingPost = await forumCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!existingPost) {
        return res
          .status(404)
          .send({ success: false, message: 'Post not found' });
      }
      if (existingPost.authorEmail !== req.user.email) {
        return res
          .status(403)
          .send({ success: false, message: 'Forbidden access' });
      }

      const result = await forumCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({
        success: true,
        message: 'Post deleted successfully!',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Users (Admin)
app.get('/api/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await usersCollection.find().sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.patch(
  '/api/users/block/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'blocked' } },
      );
      res.send({ success: true, message: 'User blocked.', result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.patch(
  '/api/users/unblock/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'active' } },
      );
      res.send({ success: true, message: 'User unblocked.', result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.patch(
  '/api/users/make-admin/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: 'admin' } },
      );
      res.send({
        success: true,
        message: 'User promoted to Admin.',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Trainers (Admin)
app.get('/api/trainers', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await usersCollection
      .find({ role: 'trainer' })
      .sort({ _id: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.patch(
  '/api/trainers/demote/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: 'user' } },
      );
      res.send({
        success: true,
        message: 'Trainer demoted to User.',
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Classes (Admin moderation)
app.patch(
  '/api/classes/status/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;

      if (!['Approved', 'Rejected'].includes(status)) {
        return res
          .status(400)
          .send({ success: false, message: 'Invalid status value' });
      }

      const result = await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } },
      );
      res.send({
        success: true,
        message: `Class ${status.toLowerCase()}!`,
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

app.delete(
  '/api/classes/admin/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await classesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, message: 'Class deleted.', result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Transactions (Admin, read-only)
app.get('/api/transactions', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await bookingsCollection.find().sort({ _id: -1 }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

// Forum moderation (Admin)
app.delete(
  '/api/forum/admin/:id',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await forumCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, message: 'Post removed.', result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  },
);

// Admin stats
app.get('/api/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();
    const totalClasses = await classesCollection.countDocuments();
    const totalBookings = await bookingsCollection.countDocuments();

    const userCount = await usersCollection.countDocuments({
      role: 'user',
    });
    const trainerCount = await usersCollection.countDocuments({
      role: 'trainer',
    });
    const adminCount = await usersCollection.countDocuments({
      role: 'admin',
    });

    const approvedCount = await classesCollection.countDocuments({
      status: 'Approved',
    });
    const pendingCount = await classesCollection.countDocuments({
      status: 'Pending',
    });
    const rejectedCount = await classesCollection.countDocuments({
      status: 'Rejected',
    });

    res.send({
      totalUsers,
      totalClasses,
      totalBookings,
      roleBreakdown: { userCount, trainerCount, adminCount },
      classStatusBreakdown: { approvedCount, pendingCount, rejectedCount },
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});
//   } finally {
//     // await client.close();
//   }
// }
// run().catch(console.dir);

app.listen(port, () => {
  console.log(`Brawnix Server is running on port ${port}`);
});

module.exports = app;
