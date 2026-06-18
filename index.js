const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('Brawnix Database Connected Successfully!'))
  .catch(err => console.error('Database Connection Error:', err));

app.get('/', (req, res) => {
  res.send('Brawnix Server is Running...');
});

app.listen(PORT, () => {
  console.log(` Server is running on port ${PORT}`);
});
