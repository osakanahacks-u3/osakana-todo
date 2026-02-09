const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const { TaskModel, UserModel } = require('../../database/models');
const { createMainPanel, createTaskListPanel, createTaskDetailPanel, createStatsPanel } = require('../utils/panels');

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

module.exports = async function(interaction) {
  const customId = interaction.customId;
  const client = interaction.client;

  // === パネルボタン ===
  
  // タスク追加（パネル用）
  if (customId === 'panel_add_task' || customId === 'todo_add') {
    const modal = new ModalBuilder()
      .setCustomId('modal_todo_add')
      .setTitle('新しいタスクを追加');

    const titleInput = new TextInputBuilder()
      .setCustomId('todo_title')
      .setLabel('タイトル')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('todo_description')
      .setLabel('説明（任意）')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    const priorityInput = new TextInputBuilder()
      .setCustomId('todo_priority')
      .setLabel('優先度（low/medium/high）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('medium');

    const dueDateInput = new TextInputBuilder()
      .setCustomId('todo_due_date')
      .setLabel('期限（YYYY-MM-DD形式、任意）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('2024-12-31');

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(priorityInput),
      new ActionRowBuilder().addComponents(dueDateInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // マイタスク（パネル用）
  if (customId === 'panel_my_tasks' || customId === 'todo_my_tasks') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const user = UserModel.findByDiscordId(interaction.user.id);
    let tasks = [];
    
    if (user) {
      tasks = TaskModel.getForUser(user.id);
    } else {
      // Discord IDで直接検索（Webログインしていないユーザー用）
      tasks = TaskModel.getAll({ assigned_to: interaction.user.id, limit: 25 });
    }
    
    const panel = createTaskListPanel(tasks, `📋 ${interaction.user.username}のタスク`);
    await interaction.editReply(panel);
    return;
  }

  // 全タスク（パネル用）
  if (customId === 'panel_all_tasks' || customId === 'todo_list_all') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const tasks = TaskModel.getAll({ limit: 25 });
    const panel = createTaskListPanel(tasks, '📁 全タスク');
    await interaction.editReply(panel);
    return;
  }

  // 統計（パネル用）
  if (customId === 'panel_stats' || customId === 'panel_refresh_stats') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const stats = TaskModel.getStats();
    const panel = createStatsPanel(stats);
    await interaction.editReply(panel);
    return;
  }

  // メインパネルに戻る
  if (customId === 'panel_back_main') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const panel = await createMainPanel();
    await interaction.editReply(panel);
    return;
  }

  // 一覧に戻る
  if (customId === 'panel_back_list') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const tasks = TaskModel.getAll({ limit: 25 });
    const panel = createTaskListPanel(tasks, '📁 全タスク');
    await interaction.editReply(panel);
    return;
  }

  // 更新
  if (customId === 'panel_refresh') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const tasks = TaskModel.getAll({ limit: 25 });
    const panel = createTaskListPanel(tasks, '📁 全タスク');
    await interaction.editReply(panel);
    return;
  }

  // タスク編集
  if (customId.startsWith('task_edit:')) {
    const taskId = customId.replace('task_edit:', '');
    const task = TaskModel.findById(taskId);
    
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_task_edit:${taskId}`)
      .setTitle('タスクを編集');

    const titleInput = new TextInputBuilder()
      .setCustomId('todo_title')
      .setLabel('タイトル')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(task.title)
      .setMaxLength(200);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('todo_description')
      .setLabel('説明')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setValue(task.description || '')
      .setMaxLength(1000);

    const priorityInput = new TextInputBuilder()
      .setCustomId('todo_priority')
      .setLabel('優先度（low/medium/high）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(task.priority || 'medium');

    const dueDateInput = new TextInputBuilder()
      .setCustomId('todo_due_date')
      .setLabel('期限（YYYY-MM-DD形式）')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(task.due_date ? task.due_date.split('T')[0] : '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(priorityInput),
      new ActionRowBuilder().addComponents(dueDateInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // タスク削除
  if (customId.startsWith('task_delete:')) {
    const taskId = customId.replace('task_delete:', '');
    const task = TaskModel.findById(taskId);
    
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    TaskModel.delete(taskId);
    await interaction.reply({ content: `🗑️ タスク「${task.title}」を削除しました`, flags: MessageFlags.Ephemeral });

    // 通知送信 & メインパネル更新
    if (client.notifyTaskDeleted) {
      client.notifyTaskDeleted(task, `<@${interaction.user.id}>`);
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }

  // === 旧ボタン（後方互換性） ===
  
  // ステータス変更ボタン
  if (customId.startsWith('todo_status_')) {
    const taskId = customId.replace('todo_status_', '');
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`select_status_${taskId}`)
          .setPlaceholder('新しいステータスを選択')
          .addOptions([
            { label: '未処理', value: 'pending', emoji: '⏳' },
            { label: '処理中', value: 'in_progress', emoji: '🔄' },
            { label: '保留', value: 'on_hold', emoji: '⏸️' },
            { label: '完了', value: 'completed', emoji: '✅' },
            { label: 'その他', value: 'other', emoji: '📋' },
          ])
      );

    await interaction.reply({ 
      content: 'ステータスを選択してください', 
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }

  // 削除ボタン（旧形式）
  if (customId.startsWith('todo_delete_')) {
    const taskId = customId.replace('todo_delete_', '');
    const task = TaskModel.findById(taskId);
    
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    TaskModel.delete(taskId);
    await interaction.reply({ content: `🗑️ タスク「${task.title}」を削除しました` });

    // 通知送信 & メインパネル更新
    if (client.notifyTaskDeleted) {
      client.notifyTaskDeleted(task, `<@${interaction.user.id}>`);
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }
};
