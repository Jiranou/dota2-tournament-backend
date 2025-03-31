
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;
const db = new sqlite3.Database('./database.db');

app.use(cors());
app.use(bodyParser.json());

const initDb = () => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    dota_id TEXT,
    mmr INTEGER,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_ids TEXT,
    team1 TEXT,
    team2 TEXT,
    captain1 TEXT,
    captain2 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
};

initDb();

app.post('/register', (req, res) => {
  const { username, password, dota_id, mmr } = req.body;
  db.run(
    `INSERT INTO users (username, password, dota_id, mmr) VALUES (?, ?, ?, ?)`,
    [username, password, dota_id, mmr],
    function (err) {
      if (err) return res.status(400).json({ error: '用户名重复或数据错误' });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err || !row) return res.status(401).json({ error: '登录失败' });
      res.json({ success: true, user: row });
    }
  );
});

app.post('/queue', (req, res) => {
  const { user_id } = req.body;
  db.run(`INSERT INTO queue (user_id) VALUES (?)`, [user_id], (err) => {
    if (err) return res.status(500).json({ error: '加入匹配失败' });

    db.all(
      `SELECT q.user_id, u.username, u.mmr FROM queue q JOIN users u ON q.user_id = u.id ORDER BY q.joined_at LIMIT 10`,
      [],
      (err, rows) => {
        if (rows.length === 10) {
          const sorted = [...rows].sort((a, b) => b.mmr - a.mmr);
          const captain1 = sorted[0].username;
          const captain2 = sorted[1].username;
          const player_ids = rows.map((r) => r.user_id).join(',');
          const team1 = JSON.stringify([captain1]);
          const team2 = JSON.stringify([captain2]);

          db.run(
            `INSERT INTO matches (player_ids, team1, team2, captain1, captain2) VALUES (?, ?, ?, ?, ?)`,
            [player_ids, team1, team2, captain1, captain2]
          );

          db.run(`DELETE FROM queue`);
        }
      }
    );

    res.json({ success: true });
  });
});

app.get('/players', (req, res) => {
  db.all(
    `SELECT username, dota_id, mmr, wins, losses, (wins - losses) as net FROM users ORDER BY net DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: '获取失败' });
      res.json(rows);
    }
  );
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
