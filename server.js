require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Servir frontend
app.use(express.static(path.join(__dirname, "public")));

// 2. API (ejemplo)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 3. Fallback SPA (cualquier otra ruta)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

