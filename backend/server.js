// backend/server.js

require('dotenv').config(); // Carga las variables de entorno del archivo .env
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // Importa ObjectId
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

let db; // Variable para almacenar la conexión a la base de datos

// Middleware
app.use(cors()); // Habilita CORS para permitir peticiones desde tu frontend
app.use(express.json()); // Permite a Express parsear JSON en las peticiones

// Conexión a la base de datos
async function connectToDb() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db('adivinaLaCancionDB'); // Nombre de tu base de datos
        console.log('Conectado a MongoDB Atlas');
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        process.exit(1); // Sale de la aplicación si no puede conectar
    }
}

// Rutas de la API

// Endpoint de prueba
app.get('/', (req, res) => {
    res.send('API del juego Adivina la Canción funcionando!');
});
// ... (código anterior: inicialización y conexión a DB)

// =====================================================================
// RUTAS DE AUTENTICACIÓN Y PERFIL DE USUARIO
// =====================================================================

// POST /api/register
// Registra un nuevo usuario.
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
    }

    try {
        const usersCollection = db.collection('users');
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: 'Este email ya está registrado.' });
        }

        // En un entorno de producción, hashearías la contraseña aquí (ej. con bcrypt)
        const newUser = {
            email,
            password, // Considera hashear esto en producción
            playerName: null // Nombre de jugador inicial nulo
        };

        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
    }
});

// POST /api/login
// Inicia sesión un usuario.
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
    }

    try {
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ email });

        if (!user || user.password !== password) { // Compara la contraseña (sin hashear en este ejemplo)
            return res.status(401).json({ message: 'Email o contraseña incorrectos.' });
        }

        // Login exitoso, devuelve datos del usuario (sin la contraseña)
        res.status(200).json({
            message: 'Login exitoso.',
            user: {
                email: user.email,
                playerName: user.playerName
            }
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
    }
});

// PUT /api/users/:email/playername
// Actualiza el nombre de jugador de un usuario.
app.put('/api/users/:email/playername', async (req, res) => {
    const { email } = req.params;
    const { playerName } = req.body;

    if (!playerName) {
        return res.status(400).json({ message: 'El nombre de jugador es requerido.' });
    }

    try {
        const usersCollection = db.collection('users');
        const result = await usersCollection.updateOne(
            { email },
            { $set: { playerName } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({ message: 'Nombre de jugador actualizado exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar nombre de jugador:', error);
        res.status(500).json({ message: 'Error interno del servidor al actualizar nombre de jugador.' });
    }
});
// ... (código anterior: inicialización, conexión a DB, rutas de autenticación)

// =====================================================================
// RUTAS DE PUNTUACIONES ACUMULADAS (PARA UN SOLO JUGADOR)
// =====================================================================

// GET /api/scores/:email
// Obtiene las puntuaciones acumuladas de un usuario por categoría.
app.get('/api/scores/:email', async (req, res) => {
    const { email } = req.params;

    try {
        const scoresCollection = db.collection('userScores');
        const userScores = await scoresCollection.findOne({ email });

        if (!userScores) {
            // Si el usuario no tiene puntuaciones, devuelve un objeto vacío
            return res.status(200).json({});
        }

        // Excluye el _id de la respuesta si no es necesario en el frontend
        const { _id, ...scores } = userScores;
        res.status(200).json(scores);
    } catch (error) {
        console.error('Error al obtener puntuaciones acumuladas:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener puntuaciones.' });
    }
});

// POST /api/scores
// Actualiza/guarda la puntuación acumulada de un usuario para una categoría.
app.post('/api/scores', async (req, res) => {
    const { email, category, score } = req.body;

    if (!email || !category || typeof score !== 'number') {
        return res.status(400).json({ message: 'Email, categoría y puntuación son requeridos.' });
    }

    try {
        const scoresCollection = db.collection('userScores');
        // Usamos $inc para sumar a la puntuación existente o crearla si no existe
        const result = await scoresCollection.updateOne(
            { email },
            { $inc: { [category]: score } }, // Suma 'score' a la categoría especificada
            { upsert: true } // Crea el documento si no existe
        );

        if (result.matchedCount === 0 && result.upsertedCount === 0) {
             return res.status(500).json({ message: 'No se pudo actualizar o crear la puntuación.' });
        }

        res.status(200).json({ message: 'Puntuación acumulada actualizada exitosamente.' });
    } catch (error) {
        console.error('Error al guardar puntuación acumulada:', error);
        res.status(500).json({ message: 'Error interno del servidor al guardar puntuación.' });
    }
});

// =====================================================================
// RUTAS DE HISTORIAL DE PARTIDAS (PARA MULTIJUGADOR)
// =====================================================================

// GET /api/gamehistory/:email
// Obtiene el historial de partidas donde participó un usuario.
app.get('/api/gamehistory/:email', async (req, res) => {
    const { email } = req.params;

    try {
        const historyCollection = db.collection('gameHistory');
        // Busca partidas donde el email del usuario logueado esté en el array de jugadores
        // Nota: Se asume que en el frontend, al guardar la partida, incluyes el email en el array 'players'
        const userGames = await historyCollection.find({ 'players.email': email }).toArray();

        res.status(200).json(userGames);
    } catch (error) {
        console.error('Error al obtener historial de partidas:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener historial.' });
    }
});

// POST /api/gamehistory
// Guarda un nuevo resultado de partida multijugador.
app.post('/api/gamehistory', async (req, res) => {
    const { date, players, winner, category } = req.body;

    if (!date || !Array.isArray(players) || players.length === 0 || !winner || !category) {
        return res.status(400).json({ message: 'Datos de partida incompletos.' });
    }

    try {
        const historyCollection = db.collection('gameHistory');
        const newGame = {
            date,
            players, // Array de objetos { name, score, email (opcional) }
            winner,
            category
        };
        await historyCollection.insertOne(newGame);
        res.status(201).json({ message: 'Resultado de partida guardado exitosamente.' });
    } catch (error) {
        console.error('Error al guardar resultado de partida:', error);
        res.status(500).json({ message: 'Error interno del servidor al guardar resultado.' });
    }
});
// ... (código anterior: todas las rutas de la API)

// Inicia el servidor
connectToDb().then(() => {
    app.listen(port, () => {
        console.log(`Servidor backend escuchando en http://localhost:${port}`);
    });
});