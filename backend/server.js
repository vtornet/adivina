require('dotenv').config(); // Esta línea DEBE ir al principio para cargar las variables de entorno

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors'); // Importa el módulo CORS
const path = require('path'); // Módulo para trabajar con rutas de archivos y directorios

const app = express();
const port = process.env.PORT || 3000;

// ** Configuración de CORS **
// Permite peticiones desde tus orígenes de frontend
const corsOptions = {
  origin: [
    'https://adivinala.netlify.app',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Esto es importante si manejas cookies o sesiones
  optionsSuccessStatus: 204 // Para pre-vuelos OPTIONS
};

app.use(cors(corsOptions)); // Aplica la configuración de CORS a la aplicación Express
app.use(express.json()); // Middleware para parsear cuerpos de peticiones JSON

// Conexión a MongoDB (usando la variable de entorno de Railway para la URI)
const dbUri = process.env.MONGO_URI;

// ** Importante: Añadir una verificación de la URI antes de intentar conectar **
if (!dbUri) {
  console.error('ERROR: La variable de entorno MONGO_URI no está definida. Por favor, configúrala en Railway.');
  process.exit(1); // Sale de la aplicación si no hay URI
}

mongoose.connect(dbUri)
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch(err => console.error('Error de conexión a MongoDB Atlas:', err));

// Esquemas y Modelos de Mongoose

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  playerName: { type: String, default: null }
});

// MODIFICACIÓN CRUCIAL: Añadido el campo 'decade'
const scoreSchema = new mongoose.Schema({
    email: { type: String, required: true }, // Referencia al usuario
    decade: { type: String, required: true }, // NUEVO CAMPO: década de la puntuación
    category: { type: String, required: true },
    score: { type: Number, default: 0 }
});

// MODIFICACIÓN CRUCIAL: Añadido el campo 'decade'
const gameHistorySchema = new mongoose.Schema({
    date: { type: String, required: true },
    players: [
        {
            name: { type: String, required: true },
            score: { type: Number, required: true },
            email: { type: String, default: null } // Email del jugador si está logueado
        }
    ],
    winner: { type: String, required: true },
    decade: { type: String, required: true }, // NUEVO CAMPO: década de la partida
    category: { type: String, required: true }
});


const User = mongoose.model('User', userSchema);
const Score = mongoose.model('Score', scoreSchema);
const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

// Rutas de la API

// Ruta de Registro
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'El usuario ya existe.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      email,
      password: hashedPassword
    });

    await user.save();
    res.status(201).json({ message: 'Usuario registrado exitosamente.' });
  } catch (err) {
    console.error('Error en el registro:', err.message);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});;

// Ruta de Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas.' });
    }

    // Devuelve el usuario (sin la contraseña)
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: { email: user.email, playerName: user.playerName }
    });
  } catch (err) {
    console.error('Error en el login:', err.message);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// Ruta para obtener el perfil de un usuario por email
app.get('/api/users/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select('-password'); // Excluir la contraseña
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        res.status(200).json({ user });
    } catch (err) {
        console.error('Error al obtener usuario:', err.message);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

// Ruta para actualizar el nombre de jugador de un usuario
app.put('/api/users/:email/playername', async (req, res) => {
  const { playerName } = req.body;
  const { email } = req.params;

  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { playerName } },
      { new: true } // Devuelve el documento actualizado
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    res.status(200).json({
      message: 'Nombre de jugador actualizado exitosamente.',
      user: { email: user.email, playerName: user.playerName }
    });
  } catch (err) {
    console.error('Error al actualizar nombre de jugador:', err.message);
    res.status(500).json({ message: 'Error del servidor.' });
  }
});

// MODIFICACIÓN: Ruta para obtener todas las puntuaciones de un usuario (filtradas por email)
// Ahora devuelve un array de objetos Score: [{ email, decade, category, score }, ...]
// NO UN OBJETO AGREGADO POR CATEGORIA COMO ANTES
app.get('/api/scores/:email', async (req, res) => {
    try {
        const scores = await Score.find({ email: req.params.email });
        // Se devuelve directamente el array de scores tal como está en la DB
        res.status(200).json(scores);
    } catch (err) {
        console.error('Error al obtener puntuaciones:', err.message);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

// MODIFICACIÓN: Ruta para guardar/actualizar una puntuación acumulada con década
app.post('/api/scores', async (req, res) => {
    const { email, decade, category, score } = req.body;

    if (!email || !decade || !category || typeof score === 'undefined') {
        return res.status(400).json({ message: 'Faltan datos para guardar la puntuación (email, decade, category, score).' });
    }

    try {
        // Encontrar y actualizar la puntuación existente o crear una nueva
        const result = await Score.findOneAndUpdate(
            { email: email, decade: decade, category: category }, // Clave compuesta por email, decade, category
            { $inc: { score: score } }, // $inc incrementa el valor existente
            { upsert: true, new: true } // upsert: si no existe, lo crea; new: devuelve el doc actualizado
        );
        res.status(200).json({ message: 'Puntuación acumulada guardada exitosamente.', score: result });
    } catch (err) {
        console.error('Error al guardar puntuación acumulada:', err.message);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

// MODIFICACIÓN: Ruta para obtener el historial de partidas de un usuario logueado
// Ahora busca por 'players.email' y devuelve el campo 'decade'
app.get('/api/gamehistory/:email', async (req, res) => {
    try {
        const history = await GameHistory.find({ 'players.email': req.params.email }).sort({ date: -1 });
        res.status(200).json(history);
    } catch (err) {
        console.error('Error al obtener historial de partidas:', err.message);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

// MODIFICACIÓN: Ruta para guardar un resultado de partida multijugador con década
app.post('/api/gamehistory', async (req, res) => {
    const { date, players, winner, decade, category } = req.body; // Recibe la década

    if (!date || !players || !winner || !decade || !category) {
        return res.status(400).json({ message: 'Faltan datos para guardar el historial de partida (date, players, winner, decade, category).' });
    }

    try {
        const newGame = new GameHistory({
            date,
            players,
            winner,
            decade, // Guardamos la década
            category
        });
        await newGame.save();
        res.status(201).json({ message: 'Historial de partida guardado exitosamente.', game: newGame });
    } catch (err) {
        console.error('Error al guardar historial de partida:', err.message);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

app.get('/', (req, res) => {
  res.send('Servidor de Adivina la Canción está funcionando.');
});

app.listen(port, () => {
  console.log(`Servidor de Adivina la Canción escuchando en el puerto ${port}`);
});