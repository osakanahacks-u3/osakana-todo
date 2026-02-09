const express = require('express');
const { UserModel, GroupModel } = require('../database/models');
const { authMiddleware } = require('../middleware/auth');
const discordClient = require('../discord/client');

const router = express.Router();

// 認証ミドルウェアを適用
router.use(authMiddleware);

// ユーザー一覧取得（Discordサーバーメンバー + DB登録済みユーザー統合）
router.get('/', async (req, res) => {
  try {
    // Discordサーバーメンバーを取得
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId && discordClient.isReady()) {
      const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const members = await guild.members.fetch().catch(() => null);
        if (members) {
          // Bot以外のメンバーをDBにupsert
          for (const [, member] of members) {
            if (member.user.bot) continue;
            UserModel.upsert(
              member.user.id,
              member.displayName || member.user.username,
              member.user.discriminator,
              member.user.avatar
            );
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to sync Discord members:', e.message);
  }

  const users = UserModel.getAll();
  res.json(users);
});

// ユーザー詳細取得
router.get('/:id', (req, res) => {
  const user = UserModel.findById(parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // ユーザーが所属するグループも取得
  const groups = GroupModel.getUserGroups(user.id);
  
  res.json({ ...user, groups });
});

// Discord IDでユーザー取得
router.get('/discord/:discordId', (req, res) => {
  const user = UserModel.findByDiscordId(req.params.discordId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const groups = GroupModel.getUserGroups(user.id);
  
  res.json({ ...user, groups });
});

module.exports = router;
