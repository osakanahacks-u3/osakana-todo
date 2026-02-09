const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { UserModel, SessionModel, LoginAttemptModel } = require('../database/models');
const { checkPermissionByDiscordId } = require('../middleware/permission');

const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:4040';

// ブルートフォース対策: IPベースのレート制限
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// パスワード認証が有効かどうかを返すAPI
router.get('/config', (req, res) => {
  const enablePassword = (process.env.ENABLE_PASSWORD_LOGIN || 'false').toLowerCase() === 'true';
  res.json({ enablePasswordLogin: enablePassword });
});

// パスワード認証
router.post('/login/password', async (req, res) => {
  // パスワードログインが無効の場合
  const enablePassword = (process.env.ENABLE_PASSWORD_LOGIN || 'false').toLowerCase() === 'true';
  if (!enablePassword) {
    return res.status(403).json({ error: 'Password login is disabled' });
  }

  const ip = req.ip || req.connection.remoteAddress;
  
  // レート制限チェック
  const attempts = LoginAttemptModel.getRecentAttempts(ip, LOCKOUT_MINUTES);
  if (attempts.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ 
      error: 'Too many failed attempts. Please try again later.',
      retryAfter: LOCKOUT_MINUTES * 60
    });
  }

  const { password } = req.body;
  
  if (!password) {
    LoginAttemptModel.record(ip, false);
    return res.status(400).json({ error: 'Password is required' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    return res.status(500).json({ error: 'Server not configured for password auth' });
  }

  // パスワード比較
  const isValid = password === adminPassword;
  
  if (!isValid) {
    LoginAttemptModel.record(ip, false);
    return res.status(401).json({ error: 'Invalid password' });
  }

  LoginAttemptModel.record(ip, true);

  // セッション作成
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24時間
  SessionModel.create(token, null, null, expiresAt);

  res.json({ 
    token,
    expiresAt,
    authType: 'password'
  });
});

// Discord OAuth認証URL取得
router.get('/discord', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${BASE_URL}/auth/callback`);
  const scope = encodeURIComponent('identify guilds');
  
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  
  res.json({ url: authUrl });
});

// Discord OAuth コールバック
router.post('/discord/callback', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // トークン交換
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL}/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed:', errorData);
      return res.status(401).json({ error: 'Failed to exchange code for token' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // ユーザー情報取得
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Failed to get user info' });
    }

    const discordUser = await userResponse.json();

    // ギルド（サーバー）情報取得
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!guildsResponse.ok) {
      return res.status(401).json({ error: 'Failed to get guilds info' });
    }

    const guilds = await guildsResponse.json();
    
    // 対象サーバーに所属しているか確認
    const targetGuildId = process.env.DISCORD_GUILD_ID;
    const isMember = guilds.some(guild => guild.id === targetGuildId);

    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of the required server' });
    }

    // ロール権限チェック
    try {
      const discordClient = require('../discord/client');
      const permResult = await checkPermissionByDiscordId(discordClient, discordUser.id);
      if (!permResult.allowed) {
        return res.status(403).json({ error: permResult.reason || 'Permission denied' });
      }
    } catch {
      // エラー時はフォールスルー
    }

    // ユーザー登録/更新
    const user = UserModel.upsert(
      discordUser.id,
      discordUser.username,
      discordUser.discriminator,
      discordUser.avatar
    );

    // セッション作成
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7日
    SessionModel.create(token, user.id, discordUser.id, expiresAt);

    res.json({
      token,
      expiresAt,
      authType: 'discord',
      user: {
        id: user.id,
        discordId: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar
      }
    });
  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// セッション確認
router.get('/session', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const session = SessionModel.findByToken(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  let user = null;
  if (session.user_id) {
    user = UserModel.findById(session.user_id);
  }

  res.json({
    valid: true,
    user: user ? {
      id: user.id,
      discordId: user.discord_id,
      username: user.username,
      avatar: user.avatar
    } : null
  });
});

// ログアウト
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    SessionModel.delete(token);
  }

  res.json({ success: true });
});

module.exports = router;
