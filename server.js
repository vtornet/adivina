throw new Error("🚨 SERVER.JS NUEVO NO ESTÁ SIENDO USADO");
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Servir frontend
app.use(express.static(path.join(__dirname, "public")));

// API (solo endpoints específicos)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Fallback SPA / PWA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});


