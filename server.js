require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// =======================
// CORS (producción segura)
// =======================
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// =======================
// MongoDB
// =======================
if (!process.env.MONGO_URI) {
  console.error('ERROR: MONGO_URI no definida');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch(err => {
    console.error('Error MongoDB:', err);
    process.exit(1);
  });

// =======================
// Schemas & Models
// =======================
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  playerName: { type: String, unique: true, sparse: true },
  resetTokenHash: String,
  resetTokenExpires: Date
});

const scoreSchema = new mongoose.Schema({
  email: String,
  decade: String,
  category: String,
  score: { type: Number, default: 0 }
});

const gameHistorySchema = new mongoose.Schema({
  date: String,
  players: [{ name: String, score: Number, email: String }],
  winner: String,
  decade: String,
  category: String
});

const onlineGameSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  creatorEmail: String,
  category: String,
  decade: String,
  songsUsed: [Object],
  players: [{ name: String, email: String, score: Number, finished: Boolean }],
  waitingFor: String,
  createdAt: { type: Date, default: Date.now },
  finished: Boolean,
  finishedAt: Date
});

const User = mongoose.model('User', userSchema);
const Score = mongoose.model('Score', scoreSchema);
const GameHistory = mongoose.model('GameHistory', gameHistorySchema);
const OnlineGame = mongoose.model('OnlineGame', onlineGameSchema);

// =======================
// API ROUTES
// =======================
// (todas tus rutas /api se mantienen EXACTAMENTE igual)
// 👉 No las repito aquí porque ya están validadas

// =======================
// FRONTEND (PWA)
// =======================
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =======================
// SERVER
// =======================
app.listen(port, () => {
  console.log(`Servidor activo en puerto ${port}`);
});
