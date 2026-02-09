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
        .setDescription('TODO管理パネルを表示します')
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('assign')
        .setDescription('タスクの担当者を追加・削除します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('タスクID').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('action')
            .setDescription('操作')
            .setRequired(true)
            .addChoices(
              { name: '➕ 追加', value: 'add' },
              { name: '➖ 削除', value: 'remove' },
              { name: '👥 全員に設定', value: 'all' },
              { name: '❌ 未割当に設定', value: 'none' }
            )
        )
        .addUserOption(option =>
          option.setName('user').setDescription('対象ユーザー')
        )
        .addStringOption(option =>
          option.setName('group').setDescription('対象グループID')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('priority')
        .setDescription('タスクの優先度を変更します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('タスクID').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('level')
            .setDescription('新しい優先度')
            .setRequired(true)
            .addChoices(
              { name: '🟢 低', value: 'low' },
              { name: '🟡 中', value: 'medium' },
              { name: '🟠 高', value: 'high' },
              { name: '🔴 緊急', value: 'urgent' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('progress')
        .setDescription('タスクの進行度（ステータス）を変更します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('タスクID').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('status')
            .setDescription('新しいステータス')
            .setRequired(true)
            .addChoices(
              { name: '⏳ 未処理', value: 'pending' },
              { name: '🔄 処理中', value: 'in_progress' },
              { name: '⏸️ 保留', value: 'on_hold' },
              { name: '✅ 完了', value: 'completed' },
              { name: '📋 その他', value: 'other' }
            )
        )
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
      case 'assign':
        await this.assignTask(interaction);
        break;
      case 'priority':
        await this.changePriority(interaction);
        break;
      case 'progress':
        await this.changeProgress(interaction);
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

  async assignTask(interaction) {
    const taskId = interaction.options.getInteger('id');
    const action = interaction.options.getString('action');

    const task = TaskModel.findById(taskId);
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    // 全員 / 未割当 の場合
    if (action === 'all') {
      TaskModel.update(taskId, { assignedType: 'all', assignedUserIds: [], assignedGroupIds: [] });
      const updated = TaskModel.findById(taskId);
      const embed = new EmbedBuilder()
        .setTitle('✅ 担当者を変更しました')
        .setColor(0x3498db)
        .addFields(
          { name: 'タスク', value: `#${taskId} ${updated.title}`, inline: false },
          { name: '担当', value: '👥 全員', inline: false }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      if (interaction.client.notifyTaskUpdated) interaction.client.notifyTaskUpdated(updated, `<@${interaction.user.id}>`, '担当者を「👥 全員」に変更');
      if (interaction.client.updateMainPanel) interaction.client.updateMainPanel();
      return;
    }

    if (action === 'none') {
      TaskModel.update(taskId, { assignedType: null, assignedUserIds: [], assignedGroupIds: [] });
      const updated = TaskModel.findById(taskId);
      const embed = new EmbedBuilder()
        .setTitle('✅ 担当者を変更しました')
        .setColor(0x3498db)
        .addFields(
          { name: 'タスク', value: `#${taskId} ${updated.title}`, inline: false },
          { name: '担当', value: '未割当', inline: false }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      if (interaction.client.notifyTaskUpdated) interaction.client.notifyTaskUpdated(updated, `<@${interaction.user.id}>`, '担当者を「未割当」に変更');
      if (interaction.client.updateMainPanel) interaction.client.updateMainPanel();
      return;
    }

    // 追加 / 削除
    const targetUser = interaction.options.getUser('user');
    const targetGroupId = interaction.options.getString('group');

    if (!targetUser && !targetGroupId) {
      await interaction.reply({ content: '❌ user または group を指定してください', flags: MessageFlags.Ephemeral });
      return;
    }

    // 現在の担当ユーザー/グループを取得
    const currentUserIds = (task.assigned_users || []).map(u => String(u.id));
    const currentGroupIds = (task.assigned_groups || []).map(g => String(g.id));

    let actionLabel = '';
    let targetLabel = '';

    if (targetUser) {
      const dbUser = UserModel.upsert(targetUser.id, targetUser.username, targetUser.discriminator, targetUser.avatar);
      const uid = String(dbUser.id);
      targetLabel = `👤 ${targetUser.username}`;

      if (action === 'add') {
        if (!currentUserIds.includes(uid)) currentUserIds.push(uid);
        actionLabel = '追加';
      } else {
        const idx = currentUserIds.indexOf(uid);
        if (idx !== -1) currentUserIds.splice(idx, 1);
        actionLabel = '削除';
      }
    }

    if (targetGroupId) {
      const group = GroupModel.findById(parseInt(targetGroupId));
      if (!group) {
        await interaction.reply({ content: `❌ グループID ${targetGroupId} が見つかりません`, flags: MessageFlags.Ephemeral });
        return;
      }
      const gid = String(group.id);
      targetLabel = targetLabel ? `${targetLabel}, 📁 ${group.name}` : `📁 ${group.name}`;

      if (action === 'add') {
        if (!currentGroupIds.includes(gid)) currentGroupIds.push(gid);
        actionLabel = '追加';
      } else {
        const idx = currentGroupIds.indexOf(gid);
        if (idx !== -1) currentGroupIds.splice(idx, 1);
        actionLabel = '削除';
      }
    }

    // 担当タイプを決定
    const hasUsers = currentUserIds.length > 0;
    const hasGroups = currentGroupIds.length > 0;
    const assignedType = (hasUsers || hasGroups) ? 'user' : null;

    TaskModel.update(taskId, {
      assignedType,
      assignedUserIds: currentUserIds,
      assignedGroupIds: currentGroupIds
    });

    const fullTask = TaskModel.findById(taskId);

    // 現在の担当表示を構築
    const parts = [];
    if (fullTask.assigned_users && fullTask.assigned_users.length > 0) {
      parts.push(...fullTask.assigned_users.map(u => `👤 ${u.username}`));
    }
    if (fullTask.assigned_groups && fullTask.assigned_groups.length > 0) {
      parts.push(...fullTask.assigned_groups.map(g => `📁 ${g.name}`));
    }
    const assigneeDisplay = parts.length > 0 ? parts.join(', ') : '未割当';

    const embed = new EmbedBuilder()
      .setTitle(`✅ 担当者を${actionLabel}しました`)
      .setColor(action === 'add' ? 0x2ecc71 : 0xe74c3c)
      .addFields(
        { name: 'タスク', value: `#${taskId} ${fullTask.title}`, inline: false },
        { name: `${actionLabel}対象`, value: targetLabel, inline: false },
        { name: '現在の担当', value: assigneeDisplay, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    if (interaction.client.notifyTaskUpdated) {
      interaction.client.notifyTaskUpdated(fullTask, `<@${interaction.user.id}>`, `担当者に ${targetLabel} を${actionLabel}`);
    }
    if (interaction.client.updateMainPanel) {
      interaction.client.updateMainPanel();
    }
  },

  async changePriority(interaction) {
    const taskId = interaction.options.getInteger('id');
    const priority = interaction.options.getString('level');

    const task = TaskModel.findById(taskId);
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    const oldPriority = PRIORITY_LABELS[task.priority] || task.priority;
    TaskModel.update(taskId, { priority });
    const updated = TaskModel.findById(taskId);

    const embed = new EmbedBuilder()
      .setTitle('✅ 優先度を変更しました')
      .setColor(
        priority === 'urgent' ? 0xe74c3c :
        priority === 'high' ? 0xe67e22 :
        priority === 'medium' ? 0xf1c40f : 0x2ecc71
      )
      .addFields(
        { name: 'タスク', value: `#${taskId} ${updated.title}`, inline: false },
        { name: '変更', value: `${oldPriority} → ${PRIORITY_LABELS[priority]}`, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    if (interaction.client.notifyTaskUpdated) {
      interaction.client.notifyTaskUpdated(updated, `<@${interaction.user.id}>`, `優先度を「${PRIORITY_LABELS[priority]}」に変更`);
    }
    if (interaction.client.updateMainPanel) {
      interaction.client.updateMainPanel();
    }
  },

  async changeProgress(interaction) {
    const taskId = interaction.options.getInteger('id');
    const status = interaction.options.getString('status');

    const task = TaskModel.findById(taskId);
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    const oldStatus = STATUS_LABELS[task.status] || task.status;
    TaskModel.update(taskId, { status });
    const updated = TaskModel.findById(taskId);

    const embed = new EmbedBuilder()
      .setTitle('✅ ステータスを変更しました')
      .setColor(status === 'completed' ? 0x2ecc71 : 0x3498db)
      .addFields(
        { name: 'タスク', value: `#${taskId} ${updated.title}`, inline: false },
        { name: '変更', value: `${oldStatus} → ${STATUS_LABELS[status]}`, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    if (status === 'completed' && interaction.client.notifyTaskCompleted) {
      interaction.client.notifyTaskCompleted(updated, `<@${interaction.user.id}>`);
    } else if (interaction.client.notifyTaskUpdated) {
      interaction.client.notifyTaskUpdated(updated, `<@${interaction.user.id}>`, `ステータスを「${STATUS_LABELS[status]}」に変更`);
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
