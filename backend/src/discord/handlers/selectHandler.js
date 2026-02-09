const { EmbedBuilder, MessageFlags } = require('discord.js');
const { TaskModel, UserModel } = require('../../database/models');
const { createTaskListPanel, createTaskDetailPanel, createMainPanel } = require('../utils/panels');

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
  const value = interaction.values[0];
  const client = interaction.client;

  // === パネルセレクト ===

  // クイックフィルター
  if (customId === 'panel_quick_filter') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    let tasks = [];
    let title = '';

    switch (value) {
      case 'filter_pending':
        tasks = TaskModel.getAll({ status: 'pending', limit: 25 });
        title = '⏳ 未着手のタスク';
        break;
      case 'filter_in_progress':
        tasks = TaskModel.getAll({ status: 'in_progress', limit: 25 });
        title = '🔄 進行中のタスク';
        break;
      case 'filter_on_hold':
        tasks = TaskModel.getAll({ status: 'on_hold', limit: 25 });
        title = '⏸️ 保留中のタスク';
        break;
      case 'filter_completed':
        tasks = TaskModel.getAll({ status: 'completed', limit: 25 });
        title = '✅ 完了したタスク';
        break;
      case 'filter_other':
        tasks = TaskModel.getAll({ status: 'other', limit: 25 });
        title = '📌 その他のタスク';
        break;
      case 'filter_urgent':
        tasks = TaskModel.getAll({ priority: 'urgent', limit: 25 });
        title = '🔴 優先度: 緊急のタスク';
        break;
      case 'filter_high':
        tasks = TaskModel.getAll({ priority: 'high', limit: 25 });
        title = '🟠 優先度: 高のタスク';
        break;
      case 'filter_medium':
        tasks = TaskModel.getAll({ priority: 'medium', limit: 25 });
        title = '🟡 優先度: 中のタスク';
        break;
      case 'filter_low':
        tasks = TaskModel.getAll({ priority: 'low', limit: 25 });
        title = '🟢 優先度: 低のタスク';
        break;
      case 'filter_overdue':
        const allTasks = TaskModel.getAll({ limit: 100 });
        const now = new Date();
        tasks = allTasks.filter(t => 
          t.due_date && 
          new Date(t.due_date) < now && 
          t.status !== 'completed'
        );
        title = '⚠️ 期限切れのタスク';
        break;
    }

    const panel = createTaskListPanel(tasks, title);
    await interaction.editReply(panel);
    return;
  }

  // タスク選択して詳細表示
  if (customId === 'task_select_view') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const taskId = value;
    const task = TaskModel.findById(taskId);
    
    if (!task) {
      await interaction.editReply({ content: '❌ タスクが見つかりません' });
      return;
    }

    const panel = createTaskDetailPanel(task);
    await interaction.editReply(panel);
    return;
  }

  // 優先度変更
  if (customId.startsWith('task_priority_change:')) {
    const taskId = customId.replace('task_priority_change:', '');
    const newPriority = value;

    const task = TaskModel.update(taskId, { priority: newPriority });

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    const updatedTask = TaskModel.findById(taskId);
    const panel = createTaskDetailPanel(updatedTask);
    await interaction.update(panel);

    if (client.notifyTaskUpdated) {
      client.notifyTaskUpdated(updatedTask, `<@${interaction.user.id}>`, `優先度を「${PRIORITY_LABELS[newPriority]}」に変更`);
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }

  // 担当者変更
  if (customId.startsWith('task_assign_change:')) {
    const taskId = customId.replace('task_assign_change:', '');
    const task = TaskModel.findById(taskId);

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    let updateData = {};
    let changeDescription = '';

    if (value === 'assign_none') {
      updateData = { assignedType: null, assignedUserIds: [], assignedGroupId: null };
      changeDescription = '担当者を「未割当」に変更';
    } else if (value === 'assign_all') {
      updateData = { assignedType: 'all', assignedUserIds: [], assignedGroupId: null };
      changeDescription = '担当者を「全員」に変更';
    } else if (value.startsWith('assign_user:')) {
      const userId = parseInt(value.replace('assign_user:', ''));
      updateData = { assignedType: 'user', assignedUserIds: [userId], assignedGroupId: null };
      const assignedUser = UserModel.findById(userId);
      changeDescription = `担当者を「${assignedUser?.username || '不明'}」に変更`;
    }

    TaskModel.update(taskId, updateData);
    const updatedTask = TaskModel.findById(taskId);
    const panel = createTaskDetailPanel(updatedTask);
    await interaction.update(panel);

    if (client.notifyTaskUpdated) {
      client.notifyTaskUpdated(updatedTask, `<@${interaction.user.id}>`, changeDescription, { assignmentChanged: true });
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }

  // ステータス変更
  if (customId.startsWith('task_status_change:')) {
    const taskId = customId.replace('task_status_change:', '');
    const newStatus = value;
    
    const task = TaskModel.update(taskId, { status: newStatus });
    
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    // 更新後のタスク詳細を表示
    const updatedTask = TaskModel.findById(taskId);
    const panel = createTaskDetailPanel(updatedTask);
    await interaction.update(panel);

    // 完了通知 or 更新通知
    if (newStatus === 'completed') {
      if (client.notifyTaskCompleted) {
        client.notifyTaskCompleted(updatedTask, `<@${interaction.user.id}>`);
      }
    } else {
      if (client.notifyTaskUpdated) {
        client.notifyTaskUpdated(updatedTask, `<@${interaction.user.id}>`, `ステータスを「${STATUS_LABELS[newStatus]}」に変更`);
      }
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }

  // === 旧セレクト（後方互換性） ===

  // ステータスフィルター
  if (customId === 'todo_filter_status') {
    const status = value;
    const tasks = TaskModel.getAll({ status, limit: 15 });

    if (tasks.length === 0) {
      await interaction.reply({ 
        content: `📭 ${STATUS_LABELS[status]} のタスクはありません`, 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${STATUS_LABELS[status]} のタスク`)
      .setColor(0x3498db)
      .setDescription(
        tasks.map(t => 
          `**${String(t.id).slice(0, 8)}** ${t.title}\n` +
          `　├ 優先度: ${PRIORITY_LABELS[t.priority] || t.priority}\n` +
          `　└ 担当: ${t.assigned_users?.length > 0 ? t.assigned_users.map(u => u.username).join(', ') : (t.assigned_user_name || t.assigned_group_name || (t.assigned_type === 'all' ? '全員' : '未割当'))}`
        ).join('\n\n')
      )
      .setFooter({ text: `${tasks.length}件のタスク` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // ステータス変更セレクト（旧形式）
  if (customId.startsWith('select_status_')) {
    const taskId = customId.replace('select_status_', '');
    const newStatus = value;

    const task = TaskModel.update(taskId, { status: newStatus });

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      content: `✅ タスクのステータスを ${STATUS_LABELS[newStatus]} に変更しました`,
      flags: MessageFlags.Ephemeral
    });

    // 通知送信 & メインパネル更新
    const updatedTask2 = TaskModel.findById(taskId);
    if (newStatus === 'completed') {
      if (client.notifyTaskCompleted) {
        client.notifyTaskCompleted(updatedTask2 || task, `<@${interaction.user.id}>`);
      }
    } else {
      if (client.notifyTaskUpdated) {
        client.notifyTaskUpdated(updatedTask2 || task, `<@${interaction.user.id}>`, `ステータスを「${STATUS_LABELS[newStatus]}」に変更`);
      }
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }
};
