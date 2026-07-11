/**
 * Waypoint — Travel Itinerary Planner
 * Single-file backend (CommonJS): Express + MongoDB Atlas (via Mongoose).
 *
 * Setup:
 *   1. Copy .env.example to .env and paste in your MongoDB Atlas connection string.
 *   2. npm install
 *   3. npm start   → API runs on http://localhost:4000
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'waypoint-dev-secret-change-me';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('\n  ❌ Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB Atlas connection string.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Database (MongoDB Atlas)
// ---------------------------------------------------------------------------
mongoose.connect(MONGODB_URI)
  .then(() => console.log('  ✅ Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('  ❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

const toJSONOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => { delete ret._id; return ret; }
};

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
userSchema.virtual('id').get(function () { return this._id.toString(); });
userSchema.set('toJSON', toJSONOptions);

const activitySchema = new mongoose.Schema(
  { id: String, day: Number, time: String, title: String },
  { _id: false }
);
const expenseSchema = new mongoose.Schema(
  { id: String, category: String, label: String, amount: Number },
  { _id: false }
);

const tripSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  destination: { type: String, required: true },
  country: { type: String, default: '' },
  lat: { type: Number, default: null },
  lon: { type: Number, default: null },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  budget: { type: Number, default: 0 },
  image: { type: String, default: '' },
  itinerary: { type: [activitySchema], default: [] },
  expenses: { type: [expenseSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});
tripSchema.virtual('id').get(function () { return this._id.toString(); });
tripSchema.set('toJSON', toJSONOptions);

const User = mongoose.model('User', userSchema);
const Trip = mongoose.model('Trip', tripSchema);

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'You need to sign in to do that.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are all required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Use a password with at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: bcrypt.hashSync(password, 10)
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Could not log in. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Trip routes (all protected)
// ---------------------------------------------------------------------------
const tripsRouter = express.Router();
tripsRouter.use(requireAuth);

tripsRouter.get('/', async (req, res) => {
  const trips = await Trip.find({ userId: req.userId }).sort({ startDate: 1 });
  res.json(trips.map((t) => t.toJSON()));
});

tripsRouter.post('/', async (req, res) => {
  const { destination, country, lat, lon, startDate, endDate, budget, image } = req.body;
  if (!destination || !startDate || !endDate) {
    return res.status(400).json({ error: 'Destination, start date, and end date are required.' });
  }

  const trip = await Trip.create({
    userId: req.userId,
    destination,
    country: country || '',
    lat: lat ?? null,
    lon: lon ?? null,
    startDate,
    endDate,
    budget: Number(budget) || 0,
    image: image || ''
  });
  res.status(201).json(trip.toJSON());
});

tripsRouter.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    res.json(trip.toJSON());
  } catch {
    res.status(404).json({ error: 'Trip not found.' });
  }
});

tripsRouter.put('/:id', async (req, res) => {
  try {
    const allowed = ['destination', 'country', 'lat', 'lon', 'startDate', 'endDate', 'budget', 'image', 'itinerary', 'expenses'];
    const updates = {};
    allowed.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true }
    );
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    res.json(trip.toJSON());
  } catch {
    res.status(404).json({ error: 'Trip not found.' });
  }
});

tripsRouter.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    res.json({ deleted: true });
  } catch {
    res.status(404).json({ error: 'Trip not found.' });
  }
});

app.use('/api/trips', tripsRouter);

// ---------------------------------------------------------------------------
// In production, also serve the React build (client/build) if present
// ---------------------------------------------------------------------------
const clientBuildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(clientBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) res.status(200).send('Waypoint API is running. Start the React client separately with "npm start" inside /client during development.');
  });
});

app.listen(PORT, () => {
  console.log(`\n  Waypoint API running → http://localhost:${PORT}\n`);
});
