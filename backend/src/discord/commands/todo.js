const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { TaskModel, UserModel, GroupModel } = require('../../database/models');
const { createMainPanel, createStatsPanel } = require('../utils/panels');

const STATUS_LABELS = {
  pending: '⏳ 未処理',
  in_progress: '🔄 処理中',
  on_hold: '⏸️ 保留',
  completed: '✅ 完了',
  other: '📋 その他'
};

const PRIORITY_LABELS = {
  low: '🟢 低',
  medium: '🟡 中',
  high: '🟠 高',
  urgent: '🔴 緊急'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('todo')
    .setDescription('TODOタスクを管理します')
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('🐟 TODO管理パネルを表示します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('新しいタスクを追加します')
        .addStringOption(option =>
          option.setName('title').setDescription('タスクのタイトル').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('description').setDescription('タスクの説明')
        )
        .addStringOption(option =>
          option.setName('priority')
            .setDescription('優先度')
            .addChoices(
              { name: '低', value: 'low' },
              { name: '中', value: 'medium' },
              { name: '高', value: 'high' },
              { name: '緊急', value: 'urgent' }
            )
        )
        .addUserOption(option =>
          option.setName('assign_user').setDescription('担当ユーザー')
        )
        .addStringOption(option =>
          option.setName('assign_group').setDescription('担当グループID')
        )
        .addBooleanOption(option =>
          option.setName('assign_all').setDescription('全員に割り当て')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('タスク一覧を表示します')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('ステータスでフィルター')
            .addChoices(
              { name: '未処理', value: 'pending' },
              { name: '処理中', value: 'in_progress' },
              { name: '保留', value: 'on_hold' },
              { name: '完了', value: 'completed' },
              { name: 'その他', value: 'other' }
            )
        )
        .addUserOption(option =>
          option.setName('user').setDescription('ユーザーでフィルター')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('タスクの詳細を表示します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('タスクID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('タスクのステータスを変更します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('タスクID').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('status')
            .setDescription('新しいステータス')
            .setRequired(true)
            .addChoices(
              { name: '未処理', value: 'pending' },
              { name: '処理中', value: 'in_progress' },
              { name: '保留', value: 'on_hold' },
              { name: '完了', value: 'completed' },
              { name: 'その他', value: 'other' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('タスクを削除します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('タスクID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('タスクの統計を表示します')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'panel':
        await this.showPanel(interaction);
        break;
      case 'add':
        await this.addTask(interaction);
        break;
      case 'list':
        await this.listTasks(interaction);
        break;
      case 'view':
        await this.viewTask(interaction);
        break;
      case 'status':
        await this.changeStatus(interaction);
        break;
      case 'delete':
        await this.deleteTask(interaction);
        break;
      case 'stats':
        await this.showStats(interaction);
        break;
    }
  },

  async showPanel(interaction) {
    const panel = await createMainPanel();
    await interaction.reply(panel);
  },

  async addTask(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const priority = interaction.options.getString('priority') || 'medium';
    const assignUser = interaction.options.getUser('assign_user');
    const assignGroupId = interaction.options.getString('assign_group');
    const assignAll = interaction.options.getBoolean('assign_all');

    // ユーザー登録/更新
    const creator = UserModel.upsert(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator,
      interaction.user.avatar
    );

    let assignedType = null;
    let assignedUserIds = [];
    let assignedGroupId = null;

    if (assignAll) {
      assignedType = 'all';
    } else if (assignUser) {
      const assignedUser = UserModel.upsert(
        assignUser.id,
        assignUser.username,
        assignUser.discriminator,
        assignUser.avatar
      );
      assignedType = 'user';
      assignedUserIds = [assignedUser.id];
    } else if (assignGroupId) {
      const group = GroupModel.findById(parseInt(assignGroupId));
      if (group) {
        assignedType = 'group';
        assignedGroupId = group.id;
      }
    }

    const task = TaskModel.create({
      title,
      description,
      priority,
      assignedType,
      assignedUserIds,
      assignedGroupId,
      createdBy: creator.id
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ タスクを作成しました')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'ID', value: `#${task.id}`, inline: true },
        { name: 'タイトル', value: task.title, inline: true },
        { name: '優先度', value: PRIORITY_LABELS[task.priority] || task.priority || '中', inline: true },
        { name: 'ステータス', value: STATUS_LABELS[task.status] || task.status || '未処理', inline: true },
      );

    if (description) {
      embed.addFields({ name: '説明', value: description, inline: false });
    }

    await interaction.reply({ embeds: [embed] });

    // 通知送信 & メインパネル更新
    if (interaction.client.notifyTaskCreated) {
      interaction.client.notifyTaskCreated(task, `<@${interaction.user.id}>`);
    }
    if (interaction.client.updateMainPanel) {
      interaction.client.updateMainPanel();
    }
  },

  async listTasks(interaction) {
    const status = interaction.options.getString('status');
    const user = interaction.options.getUser('user');

    const filters = {};
    if (status) filters.status = status;
    if (user) {
      const dbUser = UserModel.findByDiscordId(user.id);
      if (dbUser) filters.assignedUserId = dbUser.id;
    }
    filters.limit = 15;

    const tasks = TaskModel.getAll(filters);

    if (tasks.length === 0) {
      await interaction.reply({ content: '📭 タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 タスク一覧')
      .setColor(0x3498db)
      .setDescription(
        tasks.map(t => 
          `**#${t.id}** ${STATUS_LABELS[t.status]} ${t.title}\n` +
          `　├ 優先度: ${PRIORITY_LABELS[t.priority] || t.priority}\n` +
          `　└ 担当: ${t.assigned_users?.length > 0 ? t.assigned_users.map(u => u.username).join(', ') : (t.assigned_user_name || t.assigned_group_name || (t.assigned_type === 'all' ? '全員' : '未割当'))}`
        ).join('\n\n')
      )
      .setFooter({ text: `${tasks.length}件のタスク` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  async viewTask(interaction) {
    const taskId = interaction.options.getInteger('id');
    const task = TaskModel.findById(taskId);

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 タスク #${task.id}: ${task.title}`)
      .setColor(task.status === 'completed' ? 0x2ecc71 : 0x3498db)
      .addFields(
        { name: 'ステータス', value: STATUS_LABELS[task.status], inline: true },
        { name: '優先度', value: PRIORITY_LABELS[task.priority], inline: true },
        { name: '作成者', value: task.creator_name || '不明', inline: true },
      );

    if (task.description) {
      embed.addFields({ name: '説明', value: task.description, inline: false });
    }

    let assignee = '未割当';
    if (task.assigned_type === 'all') assignee = '👥 全員';
    else if (task.assigned_users && task.assigned_users.length > 0) assignee = task.assigned_users.map(u => `👤 ${u.username}`).join(', ');
    else if (task.assigned_user_name) assignee = `👤 ${task.assigned_user_name}`;
    else if (task.assigned_group_name) assignee = `📁 ${task.assigned_group_name}`;

    embed.addFields(
      { name: '担当', value: assignee, inline: true },
      { name: '作成日', value: new Date(task.created_at).toLocaleString('ja-JP'), inline: true },
    );

    if (task.due_date) {
      embed.addFields({ name: '期限', value: new Date(task.due_date).toLocaleString('ja-JP'), inline: true });
    }

    if (task.completed_at) {
      embed.addFields({ name: '完了日', value: new Date(task.completed_at).toLocaleString('ja-JP'), inline: true });
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`todo_status_${task.id}`)
          .setLabel('ステータス変更')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`todo_delete_${task.id}`)
          .setLabel('削除')
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  async changeStatus(interaction) {
    const taskId = interaction.options.getInteger('id');
    const status = interaction.options.getString('status');

    const task = TaskModel.update(taskId, { status });

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      content: `✅ タスク #${taskId} のステータスを ${STATUS_LABELS[status]} に変更しました`,
    });

    // 通知送信 & メインパネル更新
    const updatedTask = TaskModel.findById(taskId);
    if (status === 'completed' && interaction.client.notifyTaskCompleted) {
      interaction.client.notifyTaskCompleted(updatedTask || task, `<@${interaction.user.id}>`);
    } else if (interaction.client.notifyTaskUpdated) {
      interaction.client.notifyTaskUpdated(updatedTask || task, `<@${interaction.user.id}>`, `ステータスを「${STATUS_LABELS[status]}」に変更`);
    }
    if (interaction.client.updateMainPanel) {
      interaction.client.updateMainPanel();
    }
  },

  async deleteTask(interaction) {
    const taskId = interaction.options.getInteger('id');
    const task = TaskModel.findById(taskId);

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    TaskModel.delete(taskId);

    await interaction.reply({
      content: `🗑️ タスク #${taskId} 「${task.title}」を削除しました`,
    });

    // 通知送信 & メインパネル更新
    if (interaction.client.notifyTaskDeleted) {
      interaction.client.notifyTaskDeleted(task, `<@${interaction.user.id}>`);
    }
    if (interaction.client.updateMainPanel) {
      interaction.client.updateMainPanel();
    }
  },

  async showStats(interaction) {
    const stats = TaskModel.getStats();

    const embed = new EmbedBuilder()
      .setTitle('📊 タスク統計')
      .setColor(0x9b59b6)
      .addFields(
        { name: '📋 総タスク', value: `${stats.total}件`, inline: false },
        { name: STATUS_LABELS.pending, value: `${stats.pending || 0}件`, inline: true },
        { name: STATUS_LABELS.in_progress, value: `${stats.in_progress || 0}件`, inline: true },
        { name: STATUS_LABELS.on_hold, value: `${stats.on_hold || 0}件`, inline: true },
        { name: STATUS_LABELS.completed, value: `${stats.completed || 0}件`, inline: true },
        { name: STATUS_LABELS.other, value: `${stats.other || 0}件`, inline: true },
      )
      .setTimestamp();

    const completionRate = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100) 
      : 0;

    embed.addFields({ name: '✨ 完了率', value: `${completionRate}%`, inline: false });

    await interaction.reply({ embeds: [embed] });
  }
};
