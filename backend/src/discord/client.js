const { Client, GatewayIntentBits, Collection, ActivityType, MessageFlags, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// パネルメッセージIDを記憶
client.panelMessageId = null;

// コマンドファイルを読み込み
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

/**
 * 担当者のメンション文字列を生成（複数ユーザー対応）
 */
function getAssigneeMention(task) {
  if (!task) return '未割当';
  if (task.assigned_type === 'all') return '👥 全員';
  const parts = [];
  if (task.assigned_type === 'user' && task.assigned_users && task.assigned_users.length > 0) {
    for (const u of task.assigned_users) {
      if (u.discord_id && u.discord_id !== 'system') parts.push(`<@${u.discord_id}>`);
      else parts.push(`👤 ${u.username || '不明'}`);
    }
  }
  // 後方互換: assigned_user_discord_id
  if (parts.length === 0 && task.assigned_user_discord_id) {
    const ids = String(task.assigned_user_discord_id).split(',').filter(id => id && id !== 'system');
    if (ids.length > 0) parts.push(...ids.map(id => `<@${id}>`));
    else if (task.assigned_user_name) parts.push(`👤 ${task.assigned_user_name}`);
  }
  // 複数グループ対応
  if (task.assigned_groups && task.assigned_groups.length > 0) {
    for (const g of task.assigned_groups) {
      if (g.discord_role_id) parts.push(`<@&${g.discord_role_id}>`);
      else parts.push(`📁 ${g.name || '不明'}`);
    }
  } else if (parts.length === 0 && task.assigned_group_id) {
    const { GroupModel } = require('../database/models');
    const group = GroupModel.findById(task.assigned_group_id);
    if (group && group.discord_role_id) parts.push(`<@&${group.discord_role_id}>`);
    else parts.push(`📁 ${task.assigned_group_name || group?.name || '不明'}`);
  }
  return parts.length > 0 ? parts.join(', ') : '未割当';
}

/**
 * 通知チャンネルにメッセージを送信
 * @param {EmbedBuilder} embed
 * @param {Object} options - { mentionContent?: string }
 */
async function sendNotification(embed, options = {}) {
  const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
  if (!notifyChannelId) return;

  try {
    const channel = await client.channels.fetch(notifyChannelId);
    if (channel && channel.isTextBased()) {
      const payload = { embeds: [embed] };
      if (options.mentionContent) {
        payload.content = options.mentionContent;
      }
      await channel.send(payload);
    }
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

/**
 * タスク作成通知
 */
function notifyTaskCreated(task, creatorName) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('📝 新しいタスクが作成されました')
    .addFields(
      { name: 'タイトル', value: task.title, inline: false },
      { name: '優先度', value: task.priority || 'medium', inline: true },
      { name: '作成者', value: creatorName || '不明', inline: true },
      { name: '担当', value: getAssigneeMention(task), inline: true },
    )
    .setFooter({ text: `ID: ${String(task.id).slice(0, 8)}` })
    .setTimestamp();

  if (task.description) {
    embed.setDescription(task.description.slice(0, 200));
  }
  if (task.due_date) {
    embed.addFields({ name: '期限', value: new Date(task.due_date).toLocaleDateString('ja-JP'), inline: true });
  }

  // 担当者がいる場合はメンション（全員タスクはメンションしない）
  let mentionContent = null;
  if (task.assigned_type !== 'all') {
    const mention = buildMentionForAssignee(task);
    if (mention) {
      mentionContent = `${mention}`;
    }
  }

  sendNotification(embed, { mentionContent });
}

/**
 * タスク更新通知
 * @param {Object} options - { oldTask?: Object, assignmentChanged?: boolean }
 */
function notifyTaskUpdated(task, updaterName, changes, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('✏️ タスクが更新されました')
    .addFields(
      { name: 'タイトル', value: task.title, inline: false },
      { name: '更新者', value: updaterName || '不明', inline: true },
      { name: '担当', value: getAssigneeMention(task), inline: true },
    )
    .setFooter({ text: `ID: ${String(task.id).slice(0, 8)}` })
    .setTimestamp();

  if (changes) {
    embed.addFields({ name: '変更内容', value: changes, inline: false });
  }

  // 担当が新規に変更された場合のみメンション（全員タスクはメンションしない）
  let mentionContent = null;
  if (options.assignmentChanged && task.assigned_type !== 'all') {
    const mention = buildMentionForAssignee(task);
    if (mention) {
      mentionContent = `${mention}`;
    }
  }

  sendNotification(embed, { mentionContent });
}

/**
 * タスク完了通知
 */
function notifyTaskCompleted(task, completedByName) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ タスクが完了しました！')
    .addFields(
      { name: 'タイトル', value: task.title, inline: false },
      { name: '完了者', value: completedByName || '不明', inline: true },
      { name: '担当', value: getAssigneeMention(task), inline: true },
    )
    .setFooter({ text: `ID: ${String(task.id).slice(0, 8)}` })
    .setTimestamp();

  sendNotification(embed);
}

/**
 * タスク削除通知
 */
function notifyTaskDeleted(task, deletedByName) {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('🗑️ タスクが削除されました')
    .addFields(
      { name: 'タイトル', value: task.title, inline: false },
      { name: '削除者', value: deletedByName || '不明', inline: true },
      { name: '担当', value: getAssigneeMention(task), inline: true },
    )
    .setFooter({ text: `ID: ${String(task.id).slice(0, 8)}` })
    .setTimestamp();

  sendNotification(embed);
}

/**
 * 担当者のメンション文字列をembed外用に生成（複数ユーザー対応）
 */
function buildMentionForAssignee(task) {
  if (!task) return null;
  const mentions = [];
  // ユーザーメンション
  if (task.assigned_users && task.assigned_users.length > 0) {
    for (const u of task.assigned_users) {
      if (u.discord_id && u.discord_id !== 'system') {
        mentions.push(`<@${u.discord_id}>`);
      }
    }
  }
  // 後方互換
  if (mentions.length === 0 && task.assigned_user_discord_id) {
    const ids = String(task.assigned_user_discord_id).split(',').filter(id => id && id !== 'system');
    if (ids.length > 0) mentions.push(...ids.map(id => `<@${id}>`));
  }
  // グループメンション（複数対応）
  if (task.assigned_groups && task.assigned_groups.length > 0) {
    for (const g of task.assigned_groups) {
      if (g.discord_role_id) mentions.push(`<@&${g.discord_role_id}>`);
    }
  } else if (task.assigned_group_id) {
    const { GroupModel } = require('../database/models');
    const group = GroupModel.findById(task.assigned_group_id);
    if (group && group.discord_role_id) mentions.push(`<@&${group.discord_role_id}>`);
  }
  return mentions.length > 0 ? mentions.join(' ') : null;
}

/**
 * コメント追加通知
 */
function notifyCommentAdded(task, commenterName, commentContent) {
  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle('💬 コメントが追加されました')
    .addFields(
      { name: 'タスク', value: `#${task.id} ${task.title}`, inline: false },
      { name: '投稿者', value: commenterName || '不明', inline: true },
      { name: '担当', value: getAssigneeMention(task), inline: true },
    )
    .setDescription(commentContent.slice(0, 500))
    .setFooter({ text: `タスクID: ${String(task.id).slice(0, 8)}` })
    .setTimestamp();

  sendNotification(embed);
}

/**
 * グループに対応するDiscordロールを作成
 */
async function createGroupRole(groupName, color) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !client.isReady()) return null;

  try {
    const guild = await client.guilds.fetch(guildId);
    // 色を数値に変換（#3498db -> 0x3498db）
    let roleColor = 0x3498db;
    if (color && color.startsWith('#')) {
      roleColor = parseInt(color.slice(1), 16);
    }
    const role = await guild.roles.create({
      name: `TODO: ${groupName}`,
      color: roleColor,
      mentionable: true,
      reason: 'TODO管理グループ作成',
    });
    return role.id;
  } catch (error) {
    console.error('Failed to create Discord role:', error.message);
    return null;
  }
}

/**
 * グループのDiscordロールを削除
 */
async function deleteGroupRole(roleId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !client.isReady() || !roleId) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (role) {
      await role.delete('TODO管理グループ削除');
    }
  } catch (error) {
    console.error('Failed to delete Discord role:', error.message);
  }
}

/**
 * メンバーにグループのDiscordロールを付与
 */
async function addRoleToMember(discordUserId, roleId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !client.isReady() || !roleId || !discordUserId || discordUserId === 'system') return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordUserId).catch(() => null);
    if (member) {
      await member.roles.add(roleId, 'TODO管理グループメンバー追加');
    }
  } catch (error) {
    console.error('Failed to add role to member:', error.message);
  }
}

/**
 * メンバーからグループのDiscordロールを剥奪
 */
async function removeRoleFromMember(discordUserId, roleId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !client.isReady() || !roleId || !discordUserId || discordUserId === 'system') return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordUserId).catch(() => null);
    if (member) {
      await member.roles.remove(roleId, 'TODO管理グループメンバー削除');
    }
  } catch (error) {
    console.error('Failed to remove role from member:', error.message);
  }
}

/**
 * メインパネルを更新（既存パネルがあれば編集、なければ新規送信）
 */
async function updateMainPanel() {
  const panelChannelId = process.env.PANEL_CHANNEL_ID;
  if (!panelChannelId) return;

  try {
    const channel = await client.channels.fetch(panelChannelId);
    if (!channel || !channel.isTextBased()) return;

    const { createMainPanel } = require('./utils/panels');
    const panel = await createMainPanel();

    // 記憶したメッセージIDがあればそれを編集
    if (client.panelMessageId) {
      try {
        const msg = await channel.messages.fetch(client.panelMessageId);
        await msg.edit(panel);
        return;
      } catch {
        // メッセージが見つからない場合はフォールバック
        client.panelMessageId = null;
      }
    }

    // チャンネル内の既存パネルを検索
    const messages = await channel.messages.fetch({ limit: 50 });
    const existingPanel = messages.find(m => 
      m.author.id === client.user.id && 
      m.embeds.length > 0 && 
      m.embeds[0].title === '📋 TODO管理パネル'
    );

    if (existingPanel) {
      await existingPanel.edit(panel);
      client.panelMessageId = existingPanel.id;
    } else {
      const sent = await channel.send(panel);
      client.panelMessageId = sent.id;
      console.log(`Panel sent to channel ${panelChannelId}`);
    }
  } catch (error) {
    console.error('Failed to update panel:', error.message);
  }
}

client.once('clientReady', async () => {
  console.log(`Discord Bot logged in as ${client.user.tag}`);
  
  // ステータス設定
  client.user.setActivity('TODO管理中', { type: ActivityType.Watching });
  
  // パネル設置チャンネルがあれば初期パネルを送信/更新
  await updateMainPanel();

  // 期限日当日通知スケジューラーを開始
  startDueDateNotifier();
});

client.on('interactionCreate', async (interaction) => {
  try {
    // ロール権限チェック
    const permCheck = (() => {
      try {
        const mod = require('../middleware/permission');
        return mod.checkMemberPermission;
      } catch {
        return null;
      }
    })();
    if (permCheck && interaction.member) {
      const result = permCheck(interaction.member);
      if (!result.allowed) {
        const reply = { content: `🚫 ${result.reason}`, flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
        return;
      }
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isButton()) {
      const buttonHandler = require('./handlers/buttonHandler');
      await buttonHandler(interaction);
    } else if (interaction.isStringSelectMenu()) {
      const selectHandler = require('./handlers/selectHandler');
      await selectHandler(interaction);
    } else if (interaction.isModalSubmit()) {
      const modalHandler = require('./handlers/modalHandler');
      await modalHandler(interaction);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const reply = { content: '❌ エラーが発生しました。', flags: MessageFlags.Ephemeral };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (e) {
      console.error('Failed to send error reply:', e);
    }
  }
});

/**
 * 期限日当日の通知を送信（日本時間0時に実行）
 */
async function sendDueDateNotifications() {
  const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
  if (!notifyChannelId || !client.isReady()) return;

  try {
    const { TaskModel } = require('../database/models');
    const allTasks = TaskModel.getAll({ limit: 500 });

    // 日本時間で「今日」の日付を取得
    const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJST.toISOString().split('T')[0]; // YYYY-MM-DD

    const dueTodayTasks = allTasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      const taskDateStr = new Date(t.due_date).toISOString().split('T')[0];
      return taskDateStr === todayStr;
    });

    if (dueTodayTasks.length === 0) return;

    const channel = await client.channels.fetch(notifyChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('⏰ 本日が期限のタスク')
      .setDescription(
        dueTodayTasks.map(t => {
          const assignee = getAssigneeMention(t);
          const priority = t.priority === 'urgent' ? '🔴緊急' : t.priority === 'high' ? '🟠高' : t.priority === 'medium' ? '🟡中' : '🟢低';
          return `• **${t.title}** (${priority}) - 担当: ${assignee}`;
        }).join('\n')
      )
      .setFooter({ text: `${dueTodayTasks.length}件のタスクが本日期限です` })
      .setTimestamp();

    // 担当者のメンションを収集
    const mentions = new Set();
    for (const t of dueTodayTasks) {
      const mention = buildMentionForAssignee(t);
      if (mention) mentions.add(mention);
    }

    const payload = { embeds: [embed] };
    if (mentions.size > 0) {
      payload.content = [...mentions].join(' ');
    }

    await channel.send(payload);
    console.log(`Due date notification sent for ${dueTodayTasks.length} tasks`);
  } catch (error) {
    console.error('Failed to send due date notifications:', error.message);
  }
}

/**
 * 期限日通知スケジューラーを開始
 * 日本時間0:00に毎日通知を送信
 */
function startDueDateNotifier() {
  function scheduleNext() {
    const now = new Date();
    // 次の日本時間0:00を計算 (JST = UTC+9)
    const nowJST = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const tomorrowJST = new Date(nowJST);
    tomorrowJST.setUTCHours(0, 0, 0, 0);
    tomorrowJST.setUTCDate(tomorrowJST.getUTCDate() + 1);
    // UTC に戻す
    const nextMidnightUTC = new Date(tomorrowJST.getTime() - 9 * 60 * 60 * 1000);
    const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();

    console.log(`Next due date notification scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

    setTimeout(async () => {
      await sendDueDateNotifications();
      scheduleNext();
    }, msUntilMidnight);
  }

  scheduleNext();
  console.log('Due date notifier started (JST midnight)');
}

// 通知関数をエクスポート
client.notifyTaskCreated = notifyTaskCreated;
client.notifyTaskUpdated = notifyTaskUpdated;
client.notifyTaskCompleted = notifyTaskCompleted;
client.notifyTaskDeleted = notifyTaskDeleted;
client.notifyCommentAdded = notifyCommentAdded;
client.updateMainPanel = updateMainPanel;

// ロール管理関数をエクスポート
client.createGroupRole = createGroupRole;
client.deleteGroupRole = deleteGroupRole;
client.addRoleToMember = addRoleToMember;
client.removeRoleFromMember = removeRoleFromMember;

module.exports = client;
