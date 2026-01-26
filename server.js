require("dotenv").config(); // Debe ser la primera línea

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================
// 1) CORS (seguro y compatible)
// ==============================
// Si sirves el frontend desde el mismo dominio, CORS no es necesario,
// pero lo dejamos bien configurado para pruebas en local.
const allowedOrigins = new Set([
  "https://adivinalacancion.app",
  "https://www.adivinalacancion.app",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // Permitir requests sin origin (curl, postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ==============================
// 6) WEBHOOK LEMON SQUEEZY
// ==============================
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const rawBody = req.body;
    const hmac = crypto.createHmac("sha256", process.env.LEMONSQUEEZY_SIGNING_SECRET);
    const digest = hmac.update(rawBody).digest("hex");
    const signature = req.headers["x-signature"];

    if (digest !== signature) {
      console.error("Firma de webhook inválida.");
      return res.status(401).send("Invalid signature.");
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta.event_name;
    
    // Solo nos interesa cuando se crea una orden exitosa
    if (eventName === "order_created") {
      const attributes = payload.data.attributes;
      const customData = payload.meta.custom_data || {};
      
      // 1. Identificar al usuario (preferiblemente por el email pasado en custom_data)
      const userEmail = customData.user_email || attributes.user_email;
      
      // 2. Identificar qué compró (category_key pasado desde el frontend)
      // Si es el pack completo, main.js enviará 'premium_all' o 'full_pack'
      const categoryUnlocked = customData.category_key; 

      if (userEmail && categoryUnlocked) {
        console.log(`Procesando compra de ${categoryUnlocked} para ${userEmail}`);
        
        // Actualizar MongoDB
        // Usamos $addToSet para no duplicar si ya lo tiene
        let updateData = { $addToSet: { unlocked_sections: categoryUnlocked } };
        
        // Si compró el pack total, nos aseguramos de dar permisos 'premium_all'
        if (categoryUnlocked === 'full_pack') {
             updateData = { $addToSet: { unlocked_sections: 'premium_all' } };
        }

        await User.findOneAndUpdate({ email: userEmail }, updateData);
        console.log("Base de datos actualizada correctamente.");
      }
    }

    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Error en webhook:", err.message);
    res.status(500).send("Server Error");
  }
});

app.use(express.json());

// ==============================
// 2) MongoDB
// ==============================
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL; // por si Railway/otros usan otro nombre

if (!MONGO_URI) {
  console.error(
    "ERROR: Falta la variable de entorno MONGO_URI (o MONGODB_URI/MONGO_URL)."
  );
  process.exit(1);
}

mongoose.set("strictQuery", true);

// ==============================
// 3) Modelos (Mongoose)
// ==============================
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  playerName: { type: String, unique: true, sparse: true },
  resetTokenHash: { type: String, default: null },
  resetTokenExpires: { type: Date, default: null },
  // NUEVO CAMPO:
  unlocked_sections: { type: [String], default: [] } 
});

const scoreSchema = new mongoose.Schema({
  email: { type: String, required: true },
  decade: { type: String, required: true },
  category: { type: String, required: true },
  score: { type: Number, default: 0 },
});

const gameHistorySchema = new mongoose.Schema({
  date: { type: String, required: true },
  players: [
    {
      name: { type: String, required: true },
      score: { type: Number, required: true },
      email: { type: String, default: null },
    },
  ],
  winner: { type: String, required: true },
  decade: { type: String, required: true },
  category: { type: String, required: true },
});

const onlineGameSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  creatorEmail: String,
  category: String,
  decade: String,
  songsUsed: [Object],
  players: [
    {
      name: String,
      email: String,
      score: Number,
      finished: Boolean,
    },
  ],
  waitingFor: { type: String, default: null }, // email del invitado
  createdAt: { type: Date, default: Date.now },
  finished: { type: Boolean, default: false },
  finishedAt: { type: Date, default: null },
});

const User = mongoose.model("User", userSchema);
const Score = mongoose.model("Score", scoreSchema);
const GameHistory = mongoose.model("GameHistory", gameHistorySchema);
const OnlineGame = mongoose.model("OnlineGame", onlineGameSchema);

async function connectToMongo() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("Conectado a MongoDB");

    await Promise.all([
      User.createCollection(),
      Score.createCollection(),
      GameHistory.createCollection(),
      OnlineGame.createCollection(),
    ]);
    await Promise.all([User.init(), Score.init(), GameHistory.init(), OnlineGame.init()]);
    console.log("Colecciones e índices verificados.");
  } catch (err) {
    console.error("Error conectando a MongoDB:", err.message);
    throw err;
  }
}

// ==============================
// 4) API
// ==============================
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Registro
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Faltan email o password." });
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "El usuario ya existe." });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    await new User({ email, password: hashed }).save();
    console.log("Usuario registrado:", email);
    res.status(201).json({ message: "Usuario registrado exitosamente." });
  } catch (err) {
    console.error("Error en registro:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Login
// server.js - CORRECCIÓN BLOQUE LOGIN

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Faltan email o password." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Credenciales inválidas." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Credenciales inválidas." });

    console.log("Login exitoso:", email);
    
    // AQUÍ ENVIAMOS LOS PERMISOS AL FRONTEND
    res.status(200).json({
      message: "Inicio de sesión exitoso.",
      user: { 
          email: user.email, 
          playerName: user.playerName || null,
          unlocked_sections: user.unlocked_sections || [] 
      },
    });
  } catch (err) {
    console.error("Error en login:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Password reset request (devuelve token; en producción lo ideal es email)
app.post("/api/password-reset/request", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Debes indicar un email válido." });

  // ... dentro de app.post("/api/password-reset/request") ...

  try {
    const user = await User.findOne({ email });
    
    // IMPORTANTE: Nunca reveles si el usuario existe o no por seguridad (User Enumeration)
    if (!user) {
      // Retardo artificial para evitar ataques de tiempo (opcional, pero buena práctica)
      return res.status(200).json({ message: "Si el email existe, se ha enviado un código de recuperación." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
    await user.save();

    // --- BLOQUE DE SEGURIDAD ---
    // EN PRODUCCIÓN: Aquí enviarías el email usando nodemailer.
    // EN DESARROLLO (TU CASO): Lo mostramos en la consola del servidor (la terminal negra donde corre node).
    console.log("========================================");
    console.log(`🔐 TOKEN DE RECUPERACIÓN PARA ${email}:`);
    console.log(token); 
    console.log("========================================");

    res.status(200).json({
      message: "Si el email existe, se ha enviado un código de recuperación.",
      // token: token <--- ELIMINAMOS ESTA LÍNEA. ¡JAMÁS DEVUELVAS EL TOKEN AQUÍ!
    });

  } catch (err) {
    console.error("Error password-reset request:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

app.post("/api/password-reset/confirm", async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: "Faltan datos para cambiar la contraseña." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !user.resetTokenHash || !user.resetTokenExpires) {
      return res.status(400).json({ message: "Token inválido o expirado." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (tokenHash !== user.resetTokenHash || user.resetTokenExpires < new Date()) {
      return res.status(400).json({ message: "Token inválido o expirado." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    await user.save();

    res.status(200).json({ message: "Contraseña actualizada correctamente." });
  } catch (err) {
    console.error("Error password-reset confirm:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Perfil usuario
app.get("/api/users/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).select("-password");
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    res.status(200).json({ user });
  } catch (err) {
    console.error("Error get user:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Actualizar nombre jugador
app.put("/api/users/:email/playername", async (req, res) => {
  const { playerName } = req.body || {};
  const { email } = req.params;

  if (!playerName) return res.status(400).json({ message: "Falta playerName." });

  try {
    const existing = await User.findOne({ playerName });
    if (existing && existing.email !== email) {
      return res.status(400).json({ message: "Ese nombre de jugador ya está en uso." });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { playerName } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

    res.status(200).json({
      message: "Nombre de jugador actualizado exitosamente.",
      user: { email: user.email, playerName: user.playerName },
    });
  } catch (err) {
    console.error("Error update playerName:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Scores
app.get("/api/scores/:email", async (req, res) => {
  try {
    const scores = await Score.find({ email: req.params.email });
    res.status(200).json(scores);
  } catch (err) {
    console.error("Error get scores:", err.message);
    res.status(200).json([]);
  }
});

app.post("/api/scores", async (req, res) => {
  const { email, decade, category, score } = req.body || {};
  if (!email || !decade || !category || typeof score === "undefined") {
    return res.status(400).json({ message: "Faltan datos (email, decade, category, score)." });
  }

  try {
    const result = await Score.findOneAndUpdate(
      { email, decade, category },
      { $inc: { score } },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: "Puntuación guardada.", score: result });
  } catch (err) {
    console.error("Error save score:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

app.delete("/api/scores/:email", async (req, res) => {
  try {
    await Score.deleteMany({ email: req.params.email });
    res.status(200).json({ message: "Estadísticas borradas correctamente." });
  } catch (err) {
    console.error("Error delete scores:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Game history
app.get("/api/gamehistory/:email", async (req, res) => {
  try {
    const history = await GameHistory.find({ "players.email": req.params.email }).sort({ date: -1 });
    res.status(200).json(history);
  } catch (err) {
    console.error("Error get gamehistory:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

app.post("/api/gamehistory", async (req, res) => {
  const { date, players, winner, decade, category } = req.body || {};
  if (!date || !players || !winner || !decade || !category) {
    return res.status(400).json({ message: "Faltan datos (date, players, winner, decade, category)." });
  }

  try {
    const newGame = await new GameHistory({ date, players, winner, decade, category }).save();
    res.status(201).json({ message: "Historial guardado.", game: newGame });
  } catch (err) {
    console.error("Error save gamehistory:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Online games helpers
function generateCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// Crear partida online (código aleatorio)
app.post("/api/online-games", async (req, res) => {
  const { creatorEmail, category, decade, songsUsed, playerName } = req.body || {};
  if (!creatorEmail || !category || !decade || !songsUsed || !playerName) {
    return res.status(400).json({ message: "Faltan datos para crear la partida." });
  }

  try {
    const code = generateCode();
    const game = await new OnlineGame({
      code,
      creatorEmail,
      category,
      decade,
      songsUsed,
      players: [{ name: playerName, email: creatorEmail, score: 0, finished: false }],
      createdAt: new Date(),
      finished: false,
    }).save();

    res.status(201).json({ code: game.code });
  } catch (err) {
    console.error("Error create online game:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Invitar por nombre (guarda email del rival en waitingFor)
app.post("/api/online-games/by-username", async (req, res) => {
  const { creatorEmail, rivalPlayerName, category, decade, songsUsed, playerName } = req.body || {};
  if (!creatorEmail || !rivalPlayerName || !category || !decade || !songsUsed || !playerName) {
    return res.status(400).json({ message: "Faltan datos para crear la partida." });
  }

  try {
    const rival = await User.findOne({ playerName: rivalPlayerName });
    if (!rival) return res.status(404).json({ message: "El rival no existe." });

    const code = generateCode();
    const game = await new OnlineGame({
      creatorEmail,
      category,
      decade,
      songsUsed,
      code,
      players: [{ name: playerName, email: creatorEmail, score: 0, finished: false }],
      waitingFor: rival.email,
      createdAt: new Date(),
      finished: false,
    }).save();

    res.status(201).json({ message: "Invitación enviada con éxito.", code: game.code });
  } catch (err) {
    console.error("Error invite by username:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Unirse
app.post("/api/online-games/join", async (req, res) => {
  const { code, playerName, email } = req.body || {};
  try {
    const game = await OnlineGame.findOne({ code });
    if (!game || game.finished) return res.status(404).json({ message: "Partida no disponible" });
    if (game.players.length >= 2) return res.status(403).json({ message: "Partida llena" });

    game.players.push({ name: playerName, email, score: 0, finished: false });
    // Ya no está pendiente de nadie
    game.waitingFor = null;

    await game.save();
    res.json({ game });
  } catch (err) {
    console.error("Error join game:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Enviar resultado
app.post("/api/online-games/submit", async (req, res) => {
  const { code, email, score } = req.body || {};
  try {
    const game = await OnlineGame.findOne({ code });
    if (!game) return res.status(404).json({ message: "Partida no encontrada" });

    const player = game.players.find((p) => p.email === email);
    if (!player) return res.status(404).json({ message: "Jugador no encontrado" });

    player.score = score;
    player.finished = true;

    const hasBothPlayers = game.players.length === 2;
    game.finished = hasBothPlayers && game.players.every((p) => p.finished);

    if (game.finished && !game.finishedAt) game.finishedAt = new Date();

    await game.save();
    res.json({ finished: game.finished, game });
  } catch (err) {
    console.error("Error submit game:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Estado por código
app.get("/api/online-games/:code", async (req, res) => {
  try {
    const game = await OnlineGame.findOne({ code: req.params.code });
    if (!game) return res.status(404).json({ message: "Partida no encontrada." });

    res.status(200).json({
      finished: game.players.length === 2 && game.finished,
      players: game.players,
      decade: game.decade,
      category: game.category,
      songsUsed: game.songsUsed,
    });
  } catch (err) {
    console.error("Error get game by code:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Listar partidas de un jugador
app.get("/api/online-games/player/:playerEmail", async (req, res) => {
  try {
    const playerEmail = req.params.playerEmail;

    const games = await OnlineGame.find({
      $or: [
        { creatorEmail: playerEmail },
        { "players.email": playerEmail },
        { waitingFor: playerEmail, "players.email": { $ne: playerEmail } },
      ],
    }).sort({ createdAt: -1 });

    console.log("Online games cargadas para:", playerEmail, "total:", games.length);
    res.status(200).json(Array.isArray(games) ? games : []);
  } catch (err) {
    console.error("Error get player games:", err.message);
    res.status(200).json([]);
  }
});

// Declinar invitación
app.post("/api/online-games/decline", async (req, res) => {
  const { code, email } = req.body || {};
  if (!code || !email) return res.status(400).json({ message: "Faltan datos." });

  try {
    const game = await OnlineGame.findOne({ code });
    if (!game) return res.status(404).json({ message: "Partida no encontrada." });
    if (game.finished) return res.status(400).json({ message: "La partida ya ha finalizado." });

    const isCreator = game.creatorEmail === email;
    const isInvitee = game.waitingFor === email;

    if (game.players.length >= 2 || (!isCreator && !isInvitee)) {
      return res.status(403).json({ message: "No puedes declinar esta partida." });
    }

    await OnlineGame.deleteOne({ _id: game._id });
    res.status(200).json({ message: "Partida declinada correctamente." });
  } catch (err) {
    console.error("Error decline:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// Limpiar historial online
app.delete("/api/online-games/clear-history/:playerEmail", async (req, res) => {
  try {
    const playerEmail = req.params.playerEmail;
    const result = await OnlineGame.deleteMany({
      $or: [{ creatorEmail: playerEmail }, { "players.email": playerEmail }],
    });

    res.status(200).json({
      message:
        result.deletedCount > 0
          ? `Se eliminaron ${result.deletedCount} partidas de tu historial online.`
          : "No se encontraron partidas online para eliminar.",
    });
  } catch (err) {
    console.error("Error clear history:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// ==========================================
// NUEVA SECCIÓN: PAGOS CON STRIPE
// ==========================================

// A. Endpoint para generar la pasarela de pago
app.post("/api/create-checkout-session", async (req, res) => {
    const { email, categoryKey, priceId } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            customer_email: email,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId, // Este ID lo obtienes de tu Dashboard de Stripe
                quantity: 1,
            }],
            mode: 'payment',
            metadata: {
                user_email: email,
                category_key: categoryKey
            },
            // Al terminar, Stripe vuelve aquí. {CHECKOUT_SESSION_ID} es automático.
            success_url: `https://adivinalacancion.app/?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://adivinalacancion.app/`,
        });

        res.json({ id: session.id });
    } catch (err) {
        console.error("Error Stripe Session:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// B. Webhook: Stripe avisa a tu servidor que el pago fue exitoso
// IMPORTANTE: Esta ruta requiere 'express.raw' para validar la firma de seguridad
app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = session.metadata.user_email;
        const categoryUnlocked = session.metadata.category_key;

        // Aquí es donde vinculamos la compra con tu base de datos de MongoDB
        try {
            const User = mongoose.model('User'); // Asegúrate de que el modelo esté cargado
            await User.findOneAndUpdate(
                { email: userEmail },
                { $addToSet: { unlocked_sections: categoryUnlocked } }
            );
            console.log(`✅ [STRIPE] ${categoryUnlocked} desbloqueado para ${userEmail}`);
        } catch (dbErr) {
            console.error("Error actualizando usuario tras pago:", dbErr.message);
        }
    }

    res.json({ received: true });
});

// ==============================
// 5) Frontend (public + data)
// ==============================
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/audio",
  express.static(path.join(__dirname, "public", "audio"), {
    fallthrough: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp3")) {
        res.setHeader("Content-Type", "audio/mpeg");
      }
      res.setHeader("Accept-Ranges", "bytes");
    },
  })
);
app.use("/data", express.static(path.join(__dirname, "data")));

// Fallback: cualquier ruta que NO empiece por /api/ -> index.html
app.get(/^\/(?!api|audio).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function startServer() {
  try {
    await connectToMongo();
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  } catch (err) {
    console.error("No se pudo iniciar el servidor:", err.message);
    process.exit(1);
  }
}

startServer();
