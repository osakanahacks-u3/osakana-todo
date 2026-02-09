const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const TaskModel = require('../../database/models').TaskModel;

/**
 * 担当者表示文字列を生成（複数ユーザー対応）
 */
function getAssigneeDisplay(task) {
  if (!task) return '未割当';
  if (task.assigned_type === 'all') return '👥 全員';
  if (task.assigned_users && task.assigned_users.length > 0) {
    return task.assigned_users.map(u => `👤 ${u.username}`).join(', ');
  }
  if (task.assigned_user_name) return `👤 ${task.assigned_user_name}`;
  if (task.assigned_group_name) return `📁 ${task.assigned_group_name}`;
  return '未割当';
}

/**
 * メインパネルを作成
 */
async function createMainPanel() {
  const stats = TaskModel.getStats();
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 TODO管理パネル')
    .setDescription('ボタンをクリックして操作してください')
    .addFields(
      { name: '📊 統計', value: `全体: ${stats.total} | 完了: ${stats.completed} | 進行中: ${stats.inProgress}`, inline: false },
      { name: '🔗 Webアプリ', value: `[こちらをクリック](${process.env.BASE_URL})`, inline: true },
    )
    .setFooter({ text: 'TODO管理システム' })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_add_task')
        .setLabel('タスク追加')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('panel_my_tasks')
        .setLabel('マイタスク')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('panel_all_tasks')
        .setLabel('全タスク')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📁'),
      new ButtonBuilder()
        .setCustomId('panel_stats')
        .setLabel('統計')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('panel_quick_filter')
        .setPlaceholder('🔍 クイックフィルター')
        .addOptions([
          { label: '未着手のタスク', value: 'filter_pending', emoji: '⏳' },
          { label: '進行中のタスク', value: 'filter_in_progress', emoji: '🔄' },
          { label: '保留中のタスク', value: 'filter_on_hold', emoji: '⏸️' },
          { label: '完了したタスク', value: 'filter_completed', emoji: '✅' },
          { label: '優先度: 高', value: 'filter_high', emoji: '🔴' },
          { label: '期限切れ', value: 'filter_overdue', emoji: '⚠️' },
        ]),
    );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * タスク一覧パネルを作成
 */
function createTaskListPanel(tasks, title = 'タスク一覧', page = 1, totalPages = 1) {
  if (tasks.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle(title)
      .setDescription('タスクがありません')
      .setTimestamp();
    return { embeds: [embed], components: [] };
  }

  const statusEmojis = {
    pending: '⏳',
    in_progress: '🔄',
    on_hold: '⏸️',
    completed: '✅',
    other: '📌',
  };

  const priorityEmojis = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  const description = tasks.slice(0, 10).map((task, i) => {
    const status = statusEmojis[task.status] || '📌';
    const priority = priorityEmojis[task.priority] || '';
    const due = task.due_date ? ` | 期限: ${new Date(task.due_date).toLocaleDateString('ja-JP')}` : '';
    return `${status} ${priority} **${task.title}**${due}\n└ ID: \`${String(task.id).slice(0, 8)}\``;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `ページ ${page}/${totalPages} | 合計 ${tasks.length} 件` })
    .setTimestamp();

  const components = [];

  if (tasks.length > 0) {
    const selectRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('task_select_view')
          .setPlaceholder('📋 タスクを選択して詳細を表示')
          .addOptions(
            tasks.slice(0, 10).map(task => ({
              label: task.title.slice(0, 50),
              value: String(task.id),
              description: `${task.status} | ${task.priority}`,
              emoji: statusEmojis[task.status] || '📌',
            }))
          ),
      );
    components.push(selectRow);
  }

  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_back_main')
        .setLabel('メインに戻る')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠'),
      new ButtonBuilder()
        .setCustomId('panel_refresh')
        .setLabel('更新')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
    );
  components.push(buttonRow);

  return { embeds: [embed], components };
}

/**
 * タスク詳細パネルを作成
 */
function createTaskDetailPanel(task) {
  const statusLabels = {
    pending: '⏳ 未着手',
    in_progress: '🔄 進行中',
    on_hold: '⏸️ 保留中',
    completed: '✅ 完了',
    other: '📌 その他',
  };

  const priorityLabels = {
    high: '🔴 高',
    medium: '🟡 中',
    low: '🟢 低',
  };

  const embed = new EmbedBuilder()
    .setColor(task.status === 'completed' ? 0x2ecc71 : 0x5865F2)
    .setTitle(`📋 ${task.title}`)
    .setDescription(task.description || '*説明なし*')
    .addFields(
      { name: 'ステータス', value: statusLabels[task.status] || task.status, inline: true },
      { name: '優先度', value: priorityLabels[task.priority] || task.priority, inline: true },
      { name: '割り当て', value: getAssigneeDisplay(task), inline: true },
    )
    .setFooter({ text: `ID: ${task.id}` })
    .setTimestamp(new Date(task.created_at));

  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    const isOverdue = dueDate < new Date() && task.status !== 'completed';
    embed.addFields({
      name: '期限',
      value: `${isOverdue ? '⚠️ ' : ''}${dueDate.toLocaleDateString('ja-JP')}${isOverdue ? ' (期限切れ)' : ''}`,
      inline: true,
    });
  }

  const row1 = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`task_status_change:${task.id}`)
        .setPlaceholder('📝 ステータス変更')
        .addOptions([
          { label: '未着手', value: 'pending', emoji: '⏳' },
          { label: '進行中', value: 'in_progress', emoji: '🔄' },
          { label: '保留中', value: 'on_hold', emoji: '⏸️' },
          { label: '完了', value: 'completed', emoji: '✅' },
          { label: 'その他', value: 'other', emoji: '📌' },
        ]),
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`task_edit:${task.id}`)
        .setLabel('編集')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`task_delete:${task.id}`)
        .setLabel('削除')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('panel_back_list')
        .setLabel('一覧に戻る')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('panel_back_main')
        .setLabel('メインに戻る')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠'),
    );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * 統計パネルを作成
 */
function createStatsPanel(stats) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📊 タスク統計')
    .addFields(
      { name: '📋 総タスク数', value: `${stats.total}`, inline: true },
      { name: '✅ 完了', value: `${stats.completed}`, inline: true },
      { name: '🔄 進行中', value: `${stats.inProgress}`, inline: true },
      { name: '⏳ 未着手', value: `${stats.pending}`, inline: true },
      { name: '⏸️ 保留中', value: `${stats.onHold}`, inline: true },
      { name: '📌 その他', value: `${stats.other}`, inline: true },
    )
    .setTimestamp();

  if (stats.total > 0) {
    const completionRate = Math.round((stats.completed / stats.total) * 100);
    embed.addFields({
      name: '📈 完了率',
      value: `${'█'.repeat(Math.floor(completionRate / 10))}${'░'.repeat(10 - Math.floor(completionRate / 10))} ${completionRate}%`,
      inline: false,
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_back_main')
        .setLabel('メインに戻る')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠'),
      new ButtonBuilder()
        .setCustomId('panel_refresh_stats')
        .setLabel('更新')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
    );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  createMainPanel,
  createTaskListPanel,
  createTaskDetailPanel,
  createStatsPanel,
};
