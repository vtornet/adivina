require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
// Módulos de Producción
const compression = require("compression");
const helmet = require("helmet");


if (!process.env.STRIPE_SECRET_KEY) {
  console.error("⚠️ CRÍTICO: STRIPE_SECRET_KEY no está definida en las variables de entorno.");
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_dummy_key_for_build');

const app = express();
app.use(compression());

// 2. Seguridad Helmet (Protege cabeceras HTTP y configura CSP para Stripe/Resend)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        // ESTA LÍNEA ES LA CLAVE QUE FALTABA PARA DESBLOQUEAR LOS BOTONES:
        scriptSrcAttr: ["'unsafe-inline'"], 
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://api.resend.com"],
        imgSrc: ["'self'", "data:", "https://*.stripe.com"],
        upgradeInsecureRequests: [], 
      },
    },
  })
);
const PORT = process.env.PORT || 3000;

const sendEmail = async ({ to, subject, html }) => {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                // CORRECTO: Usamos el nombre de la variable definida en Railway
                'Authorization': `Bearer ${process.env.EMAIL_PASS}`, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Adivina la Canción <contact@appstracta.app>',
                to: to,
                subject: subject,
                html: html
            })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error("Error API Resend:", data);
            return false;
        }
        console.log("✅ Email enviado con éxito a:", to);
        return true;
    } catch (err) {
        console.error("Fallo conexión API:", err);
        return false;
    }
};

// ==============================
// 0) Canonical host + HTTPS (CRÍTICO para persistencia de localStorage)
// ==============================
app.set("trust proxy", 1);

app.use((req, res, next) => {
  const host = req.get("host");
  if (!host) return next();

  // Forzar HTTPS en producción (Railway usa proxy)
  const xfProto = req.get("x-forwarded-proto");
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && xfProto && xfProto !== "https") {
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }

  // Host canónico: SIN www (evita split de localStorage)
  const CANONICAL_HOST = "adivinalacancion.app";

  if (host === `www.${CANONICAL_HOST}`) {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }

  return next();
});


// ==============================
// 1) CORS (seguro y compatible)
// ==============================
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

// Ruta Webhook: Stripe avisa a tu servidor (Requiere express.raw)
app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("Webhook Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = session.metadata.user_email;
        const categoryUnlocked = session.metadata.category_key;

        try {
            const User = mongoose.model('User'); 
            await User.findOneAndUpdate(
                { email: userEmail },
                { $addToSet: { unlocked_sections: categoryUnlocked } }
            );
            console.log(`✅ [STRIPE] ${categoryUnlocked} desbloqueado para ${userEmail}`);
        } catch (dbErr) {
            console.error("Error DB tras pago:", dbErr.message);
        }
    }

    res.json({ received: true });
});

app.use(express.json());

// ==============================
// 2) MongoDB
// ==============================
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL; 

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
  unlocked_sections: { type: [String], default: [] },
  // --- NUEVOS CAMPOS PARA VERIFICACIÓN ---
  isVerified: { type: Boolean, default: false }, // Por defecto false para nuevos
  verificationCode: { type: String, default: null }
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
  waitingFor: { type: String, default: null }, 
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

app.post("/api/create-checkout-session", async (req, res) => {
    const { email, categoryKey, priceId, returnUrl } = req.body;
    const baseUrl = returnUrl || 'https://adivinalacancion.app';

    try {
        const session = await stripe.checkout.sessions.create({
            customer_email: email,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'payment',
            metadata: {
                user_email: email,
                category_key: categoryKey
            },
            success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/`,
        });

        res.json({ id: session.id });
    } catch (err) {
        console.error("Error Stripe Session:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// --- REGISTRO CON VERIFICACIÓN ---
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
    
    // Generar código de 6 dígitos
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Guardar usuario como NO verificado
    await new User({ 
        email, 
        password: hashed, 
        isVerified: false, 
        verificationCode 
    }).save();

    // Enviar correo
    try {
        await sendEmail({
            to: email,
            subject: "Verifica tu cuenta - Adivina la Canción",
            html: `
                <h3>¡Bienvenido a Adivina la Canción! 🎵</h3>
                <p>Tu código de verificación es:</p>
                <h2 style="color: #6a0dad; letter-spacing: 5px;">${verificationCode}</h2>
                <p>Introdúcelo en la aplicación para activar tu cuenta.</p>
            `
        });
        console.log(`Código enviado a ${email}`);
    } catch (mailError) {
        console.error("Error enviando mail:", mailError);
        // Opcional: Podrías borrar el usuario si falla el mail, pero mejor dejar que reintente
        return res.status(500).json({ message: "Usuario creado pero falló el envío del email. Contacta soporte." });
    }

    // Devolvemos flag especial 'requireVerification'
    res.status(201).json({ 
        message: "Registro exitoso. Revisa tu email para el código.", 
        requireVerification: true,
        email: email 
    });

  } catch (err) {
    console.error("Error en registro:", err.message);
    res.status(500).json({ message: "Error del servidor." });
  }
});

// --- NUEVO: ENDPOINT DE VERIFICACIÓN ---
app.post("/api/verify-email", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Faltan datos." });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

        if (user.isVerified) {
            return res.status(200).json({ message: "La cuenta ya estaba verificada." });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ message: "Código incorrecto." });
        }

        // Éxito
        user.isVerified = true;
        user.verificationCode = null; // Limpiar código
        await user.save();

        res.status(200).json({ message: "¡Cuenta verificada! Ya puedes iniciar sesión." });
    } catch (err) {
        console.error("Error verificando:", err);
        res.status(500).json({ message: "Error del servidor." });
    }
});

// --- NUEVO: REENVIAR CÓDIGO ---
app.post("/api/resend-code", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Falta el email." });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
        if (user.isVerified) return res.status(400).json({ message: "Usuario ya verificado." });

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = verificationCode;
        await user.save();

        try {
            await sendEmail({
            to: email,
            subject: "Nuevo código - Adivina la Canción",
            html: `<h3>Tu nuevo código es: <b>${verificationCode}</b></h3>`
        });
            return res.status(200).json({ message: "Código reenviado." });
        } catch (mailErr) {
            console.error("Fallo envío mail reenviado:", mailErr);
            return res.status(503).json({ message: "Error de conexión con el servidor de correo. Intenta en unos minutos." });
        }
    } catch (err) {
        console.error("Error general resend-code:", err);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});

// Login (MODIFICADO con Bypass de Administrador y Regla de Oro)
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

    // --- REGLA DE ORO: BYPASS PARA ADMIN ---
    const isAdmin = (email.toLowerCase() === 'vtornet@gmail.com');

    // Solo bloqueamos si el campo es explícitamente FALSE y NO es el administrador.
    // Si es undefined (usuarios antiguos), el check (undefined === false) es falso y entran.
    if (user.isVerified === false && !isAdmin) {
        return res.status(403).json({ 
            message: "Debes verificar tu email antes de entrar.", 
            requireVerification: true,
            email: user.email 
        });
    }

    console.log("Login exitoso:", email);
    
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

// Password reset request
app.post("/api/password-reset/request", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Debes indicar un email válido." });

  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(200).json({ message: "Si el email existe, se ha enviado un código de recuperación." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); 
    await user.save();

    // Envío real por mail
    try {
        await sendEmail({
            to: email,
            subject: "Recuperar Contraseña",
            html: `<p>Tu token de recuperación es: <b>${token}</b></p>`
        });
        console.log(`Token enviado a ${email}`);
    } catch (e) {
        console.error("Fallo envío mail reset:", e);
    }

    res.status(200).json({
      message: "Si el email existe, se ha enviado un código de recuperación."
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

function escapeRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emailRegex(email = "") {
  const clean = String(email).trim();
  return new RegExp(`^${escapeRegex(clean)}$`, "i");
}

function normEmail(email = "") {
  return String(email).trim().toLowerCase();
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
    const playerEmailRaw = req.params.playerEmail;
    const r = emailRegex(playerEmailRaw);

    const games = await OnlineGame.find({
      $or: [
        { creatorEmail: r },
        { "players.email": r },
        { waitingFor: r, "players.email": { $not: r } },
      ],
    }).sort({ createdAt: -1 });

    console.log("Online games cargadas para:", playerEmailRaw, "total:", games.length);
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


// ==============================
// 5) Frontend (public + data)
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1d', 
  etag: false
}));

// 2. Audios con caché de 7 días y cabeceras correctas
app.use(
  "/audio",
  express.static(path.join(__dirname, "public", "audio"), {
    fallthrough: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp3")) {
        res.setHeader("Content-Type", "audio/mpeg");
      }
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=604800"); 
    },
  })
);

// 3. Archivos de datos (Songs)
app.use("/data", express.static(path.join(__dirname, "data")));
// Fallback: cualquier ruta que NO empiece por /api/, /audio/ o /data/ -> index.html
app.get(/^\/(?!api|audio|data).*/, (req, res) => {
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