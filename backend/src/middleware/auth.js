const { SessionModel, UserModel } = require('../database/models');
const { checkPermissionByDiscordId } = require('./permission');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = SessionModel.findByToken(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // ユーザー情報をリクエストに追加
  if (session.user_id) {
    req.user = UserModel.findById(session.user_id);
  } else {
    req.user = null; // パスワード認証の場合
  }

  // ロール権限チェック（Discord認証ユーザーのみ）
  if (req.user?.discord_id) {
    try {
      const discordClient = require('../discord/client');
      const result = await checkPermissionByDiscordId(discordClient, req.user.discord_id);
      if (!result.allowed) {
        return res.status(403).json({ error: result.reason || 'Permission denied' });
      }
    } catch {
      // エラー時はフォールスルー
    }
  }

  req.session = session;
  next();
}

// オプショナル認証（認証なしでもアクセス可能だが、認証されていればユーザー情報を取得）
function optionalAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    const session = SessionModel.findByToken(token);
    if (session && session.user_id) {
      req.user = UserModel.findById(session.user_id);
      req.session = session;
    }
  }

  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
