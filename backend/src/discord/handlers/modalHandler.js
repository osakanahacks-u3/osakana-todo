const { EmbedBuilder, MessageFlags } = require('discord.js');
const { TaskModel, UserModel } = require('../../database/models');
const { createTaskDetailPanel } = require('../utils/panels');
const { formatDate } = require('../../utils/timezone');

const PRIORITY_LABELS = {
  low: '🟢 低',
  medium: '🟡 中',
  high: '🟠 高',
  urgent: '🔴 緊急'
};

module.exports = async function(interaction) {
  const customId = interaction.customId;
  const client = interaction.client;

  // タスク追加モーダル
  if (customId === 'modal_todo_add') {
    const title = interaction.fields.getTextInputValue('todo_title');
    const description = interaction.fields.getTextInputValue('todo_description') || null;
    let priority = interaction.fields.getTextInputValue('todo_priority') || 'medium';
    const dueDateStr = interaction.fields.getTextInputValue('todo_due_date') || null;

    // 優先度の検証
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      priority = 'medium';
    }

    // 期限の検証
    let dueDate = null;
    if (dueDateStr) {
      const parsed = new Date(dueDateStr);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString();
      }
    }

    // ユーザー登録/更新
    const creator = UserModel.upsert(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator,
      interaction.user.avatar
    );

    const task = TaskModel.create({
      title,
      description,
      priority,
      dueDate,
      createdBy: creator.id
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ タスクを作成しました')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'タイトル', value: task.title, inline: false },
        { name: '優先度', value: PRIORITY_LABELS[task.priority] || priority, inline: true },
      );

    if (description) {
      embed.addFields({ name: '説明', value: description, inline: false });
    }

    if (dueDate) {
      embed.addFields({ name: '期限', value: formatDate(dueDate), inline: true });
    }

    embed.setFooter({ text: `ID: ${String(task.id).slice(0, 8)}...` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    // 通知送信 & メインパネル更新
    if (client.notifyTaskCreated) {
      client.notifyTaskCreated(task, `<@${interaction.user.id}>`);
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }

  // タスク編集モーダル
  if (customId.startsWith('modal_task_edit:')) {
    const taskId = customId.replace('modal_task_edit:', '');
    
    const title = interaction.fields.getTextInputValue('todo_title');
    const description = interaction.fields.getTextInputValue('todo_description') || null;
    let priority = interaction.fields.getTextInputValue('todo_priority') || 'medium';
    const dueDateStr = interaction.fields.getTextInputValue('todo_due_date') || null;

    // 優先度の検証
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      priority = 'medium';
    }

    // 期限の検証・削除対応
    let dueDate = null;
    if (dueDateStr && dueDateStr.trim() !== '') {
      const parsed = new Date(dueDateStr);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString();
      }
    }
    // dueDateStr が空欄なら dueDate = null で期限を削除

    const task = TaskModel.update(taskId, {
      title,
      description,
      priority,
      dueDate: dueDate
    });

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    const updatedTask = TaskModel.findById(taskId);
    const panel = createTaskDetailPanel(updatedTask);
    
    await interaction.reply({ 
      content: '✅ タスクを更新しました',
      ...panel,
      flags: MessageFlags.Ephemeral 
    });

    // 通知送信 & メインパネル更新
    if (client.notifyTaskUpdated) {
      client.notifyTaskUpdated(updatedTask, `<@${interaction.user.id}>`, `タイトル・説明・優先度・期限を編集`);
    }
    if (client.updateMainPanel) {
      client.updateMainPanel();
    }
    return;
  }

  // コメント追加モーダル
  if (customId.startsWith('modal_task_comment:')) {
    const taskId = customId.replace('modal_task_comment:', '');
    const content = interaction.fields.getTextInputValue('comment_content');

    const task = TaskModel.findById(taskId);
    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    // ユーザー登録/更新
    const user = UserModel.upsert(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator,
      interaction.user.avatar
    );

    TaskModel.addComment(taskId, user.id, content);

    // 更新した詳細パネルを返す
    const updatedTask = TaskModel.findById(taskId);
    const panel = createTaskDetailPanel(updatedTask);

    await interaction.reply({
      content: '💬 コメントを追加しました',
      ...panel,
      flags: MessageFlags.Ephemeral
    });

    // コメント通知
    if (client.notifyCommentAdded) {
      client.notifyCommentAdded(updatedTask, `<@${interaction.user.id}>`, content);
    }
    return;
  }
};
