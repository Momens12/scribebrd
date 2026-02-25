import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const db = new Database("brds.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS brds (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    transcription TEXT,
    extra_notes TEXT,
    final_doc_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Add language column if it doesn't exist
  BEGIN;
  SELECT CASE WHEN count(*) = 0 THEN 
    'ALTER TABLE brds ADD COLUMN language TEXT DEFAULT "en"' 
  ELSE 
    'SELECT 1' 
  END
  FROM pragma_table_info('brds') WHERE name = 'language';
  COMMIT;
`);

// Better way to handle migrations in SQLite with better-sqlite3
try {
  db.prepare("ALTER TABLE brds ADD COLUMN language TEXT DEFAULT 'en'").run();
} catch (e) {
  // Column already exists or other error
}

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    brd_id TEXT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(brd_id) REFERENCES brds(id)
  );
`);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/brds", (req, res) => {
    const brds = db.prepare("SELECT * FROM brds ORDER BY created_at DESC").all();
    res.json(brds);
  });

  app.get("/api/brds/:id", (req, res) => {
    const brd = db.prepare("SELECT * FROM brds WHERE id = ?").get(req.params.id);
    if (!brd) return res.status(404).json({ error: "BRD not found" });
    res.json(brd);
  });

  app.post("/api/brds", (req, res) => {
    const { title, content, transcription, extraNotes, language } = req.body;
    const id = uuidv4();
    db.prepare(
      "INSERT INTO brds (id, title, content, transcription, extra_notes, language) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, title, content, transcription, extraNotes, language || 'en');
    res.json({ id });
  });

  app.post("/api/brds/:id/final", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    db.prepare("UPDATE brds SET final_doc_path = ? WHERE id = ?").run(
      req.file.path,
      req.params.id
    );
    res.json({ path: req.file.path });
  });

  app.get("/api/brds/:id/chat", (req, res) => {
    const messages = db
      .prepare("SELECT * FROM chat_messages WHERE brd_id = ? ORDER BY created_at ASC")
      .all(req.params.id);
    res.json(messages);
  });

  app.post("/api/brds/:id/chat", (req, res) => {
    const { role, content } = req.body;
    const id = uuidv4();
    db.prepare(
      "INSERT INTO chat_messages (id, brd_id, role, content) VALUES (?, ?, ?, ?)"
    ).run(id, req.params.id, role, content);
    res.json({ id });
  });

  // Serve uploaded files
  app.use("/uploads", express.static("uploads"));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
