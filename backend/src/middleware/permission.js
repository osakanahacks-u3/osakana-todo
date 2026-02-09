/**
 * ロール権限チェックユーティリティ
 * 
 * PERMISSION_MODE:
 *   - disable: 制限なし（デフォルト）
 *   - white: PERMISSION_ROLE_ID を持つユーザーのみ許可
 *   - black: PERMISSION_ROLE_ID を持つユーザーは拒否
 */

/**
 * Discord GuildMember のロールをチェックして利用可否を返す
 * @param {import('discord.js').GuildMember} member - DiscordのGuildMemberオブジェクト
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkMemberPermission(member) {
  const mode = (process.env.PERMISSION_MODE || 'disable').toLowerCase();
  const roleId = process.env.PERMISSION_ROLE_ID;

  if (mode === 'disable' || !roleId) {
    return { allowed: true };
  }

  if (!member) {
    return { allowed: false, reason: 'メンバー情報を取得できませんでした' };
  }

  const hasRole = member.roles?.cache?.has(roleId) ?? false;

  if (mode === 'white') {
    return hasRole
      ? { allowed: true }
      : { allowed: false, reason: 'このツールを使用する権限がありません（必要なロールがありません）' };
  }

  if (mode === 'black') {
    return hasRole
      ? { allowed: false, reason: 'このツールを使用する権限がありません（ブラックリストに含まれています）' }
      : { allowed: true };
  }

  // 不明なモードの場合は許可
  return { allowed: true };
}

/**
 * Discord IDからGuildMemberを取得してロールチェック
 * @param {import('discord.js').Client} client - Discord Client
 * @param {string} discordUserId - ユーザーのDiscord ID
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
async function checkPermissionByDiscordId(client, discordUserId) {
  const mode = (process.env.PERMISSION_MODE || 'disable').toLowerCase();
  const roleId = process.env.PERMISSION_ROLE_ID;

  if (mode === 'disable' || !roleId) {
    return { allowed: true };
  }

  if (!discordUserId || discordUserId === 'system') {
    return { allowed: false, reason: '権限を確認できませんでした' };
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !client?.isReady()) {
    // Botが未接続の場合はフォールスルー（許可扱い）
    return { allowed: true };
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordUserId).catch(() => null);
    if (!member) {
      return { allowed: false, reason: 'サーバーメンバーではありません' };
    }
    return checkMemberPermission(member);
  } catch {
    // エラー時はフォールスルー
    return { allowed: true };
  }
}

module.exports = { checkMemberPermission, checkPermissionByDiscordId };
