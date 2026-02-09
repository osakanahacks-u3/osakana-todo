require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./database/init');
const discordClient = require('./discord/client');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const groupRoutes = require('./routes/groups');
const userRoutes = require('./routes/users');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 4040;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Nginx等のリバースプロキシ対応
app.set('trust proxy', 1);

// データディレクトリ作成
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// データベース初期化
initDatabase();

// ミドルウェア設定
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// 全体レート制限
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 200, // 1分間に200リクエストまで
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// 認証エンドポイント用のより厳しいレート制限
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 20, // 15分間に20リクエストまで
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// APIルート設定
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    discord: discordClient.isReady() ? 'connected' : 'disconnected'
  });
});

// 静的ファイルのホスティング（フロントエンド）
const staticDir = path.join(__dirname, '../public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, {
    maxAge: '1d',
    etag: true
  }));

  // SPAフォールバック - すべてのGETリクエストでindex.htmlを返す
  app.use((req, res, next) => {
    // APIリクエストはスキップ
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // GETリクエストのみ処理
    if (req.method !== 'GET') {
      return next();
    }
    
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  // staticDir が存在しない場合は何もしない（next は未定義なので呼ばない）
}

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
});

// Discord Bot起動
if (process.env.DISCORD_TOKEN) {
  discordClient.login(process.env.DISCORD_TOKEN)
    .then(() => {
      console.log('Discord bot starting...');
    })
    .catch(err => {
      console.error('Failed to login to Discord:', err);
    });
} else {
  console.warn('DISCORD_TOKEN not set, Discord bot will not start');
}

// セッションクリーンアップ（1時間ごと）
const { SessionModel, LoginAttemptModel } = require('./database/models');
setInterval(() => {
  SessionModel.cleanup();
  LoginAttemptModel.cleanup();
}, 60 * 60 * 1000);

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  discordClient.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  discordClient.destroy();
  process.exit(0);
});
