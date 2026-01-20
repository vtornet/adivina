import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

