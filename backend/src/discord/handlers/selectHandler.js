const { EmbedBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
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

// ヘルプカテゴリ定義
const HELP_PAGES = {
  help_task_basic: {
    title: '📋 タスク基本操作',
    color: 0x3498db,
    fields: [
      { name: '`/todo panel`', value: 'TODO管理パネルを表示します。\nボタンやセレクトメニューで操作できるインタラクティブなパネルです。', inline: false },
      { name: '`/todo add title: description: priority: assign_user: assign_group: assign_all:`', value: 'タスクを新規作成します。\n- `title`（必須）: タスクのタイトル\n- `description`: 説明文\n- `priority`: 優先度（低/中/高/緊急）\n- `assign_user`: 担当ユーザー\n- `assign_group`: 担当グループID\n- `assign_all`: 全員に割り当て', inline: false },
      { name: '`/todo list status: user:`', value: 'タスク一覧を表示します。\n- `status`: ステータスでフィルター（未処理/処理中/保留/完了/その他）\n- `user`: 特定ユーザーのタスクのみ表示', inline: false },
      { name: '`/todo view id:`', value: 'タスクの詳細を表示します。\n- `id`（必須）: タスクのID番号', inline: false },
      { name: '`/todo delete id:`', value: 'タスクを削除します。\n- `id`（必須）: 削除するタスクのID', inline: false },
      { name: '`/todo stats`', value: 'タスクの統計情報を表示します。\nステータス別・優先度別の件数や完了率が確認できます。', inline: false },
    ]
  },
  help_task_edit: {
    title: '✏️ タスク編集',
    color: 0xe67e22,
    fields: [
      { name: '`/todo status id: status:`', value: 'タスクのステータスを変更します。\n- `id`（必須）: タスクID\n- `status`（必須）: 未処理 / 処理中 / 保留 / 完了 / その他', inline: false },
      { name: '`/todo progress id: status:`', value: '`/todo status` と同じ機能です。\nステータス名に絵文字が付いて見やすくなっています。', inline: false },
      { name: '`/todo priority id: level:`', value: 'タスクの優先度を変更します。\n- `id`（必須）: タスクID\n- `level`（必須）: 🟢低 / 🟡中 / 🟠高 / 🔴緊急\n\n※ 完了時に優先度は自動クリアされます。', inline: false },
      { name: '`/todo assign id: action: user: group:`', value: '担当者を追加・削除します。\n- `id`（必須）: タスクID\n- `action`（必須）:\n　➕ 追加 / ➖ 削除 / 👥 全員 / ❌ 未割当\n- `user`: 対象ユーザー\n- `group`: 対象グループID\n\n1回の操作で1人/1グループずつ追加・削除します。', inline: false },
    ]
  },
  help_data: {
    title: '📥 エクスポート / インポート',
    color: 0x2ecc71,
    fields: [
      { name: '`/todo export type:`', value: 'タスクデータをファイルとしてダウンロードします。\n- `type`（必須）: TXT / CSV / JSON\n\nCSVはExcel等で開けます。\nJSONはインポートに使用できます。', inline: false },
      { name: '`/todo import file:`', value: '⚠️ **サーバー管理者のみ実行可能**\n\nJSON形式のファイルからタスクデータをインポートします。\n- `file`（必須）: インポートするJSONファイル\n\n**注意:** 既存のすべてのタスクが削除され、\nインポートデータで上書きされます。\n確認メッセージが表示されるので、\n「はい」を押すまでは実行されません。', inline: false },
    ]
  },
  help_group: {
    title: '👥 グループ管理',
    color: 0x9b59b6,
    fields: [
      { name: '`/group create name: description: color:`', value: 'グループを新規作成します。\n- `name`（必須）: グループ名\n- `description`: 説明\n- `color`: 色コード（例: #3498db）', inline: false },
      { name: '`/group list`', value: '全グループの一覧を表示します。', inline: false },
      { name: '`/group view id:`', value: 'グループの詳細（メンバー一覧含む）を表示します。', inline: false },
      { name: '`/group add-member group_id: user:`', value: 'グループにメンバーを追加します。', inline: false },
      { name: '`/group remove-member group_id: user:`', value: 'グループからメンバーを削除します。', inline: false },
      { name: '`/group delete id:`', value: 'グループを削除します。', inline: false },
    ]
  },
  help_panel: {
    title: '🖥️ パネルの使い方',
    color: 0x5865F2,
    fields: [
      { name: '📌 メインパネル（`/todo panel`）', value: '統計情報とボタン・セレクトメニューが表示されます。', inline: false },
      { name: '➕ タスク追加ボタン', value: 'モーダル（入力フォーム）が開き、\nタイトル・説明・優先度・期限を入力できます。', inline: false },
      { name: '📋 マイタスクボタン', value: '自分に割り当てられたタスクの一覧を表示します。', inline: false },
      { name: '📁 全タスクボタン', value: '全てのタスクを一覧表示します。\n一覧パネル上でソート（並び替え）も可能です。', inline: false },
      { name: '📊 統計ボタン', value: 'ステータス別・優先度別の詳細統計を表示します。', inline: false },
      { name: '🔍 クイックフィルター', value: 'セレクトメニューからステータスや優先度で\n絞り込んだタスク一覧を素早く表示できます。\n選択後にメニューはリセットされ、何度でも使えます。', inline: false },
      { name: '🔀 並び替え（タスク一覧）', value: 'タスク一覧パネルでは、\nID順 / 優先度順 / 作成日順に並び替え可能です。\nフィルター条件を維持したままソートできます。', inline: false },
      { name: '📋 タスク詳細パネル', value: 'タスク一覧から選択すると詳細が表示されます。\n詳細パネルからステータス変更・優先度変更・\n担当者変更・タスク削除が直接行えます。', inline: false },
    ]
  },
  help_web: {
    title: '🌐 Webアプリについて',
    color: 0x1abc9c,
    fields: [
      { name: '🔑 ログイン方法', value: 'Discord認証またはパスワード認証で\nWebアプリにログインできます。', inline: false },
      { name: '📋 タスク管理', value: '- カード形式でタスク一覧を表示\n- ステータス・優先度・担当者でフィルター\n- ID順 / 優先度順の並び替え\n- タスクの作成・編集・削除\n- コメント機能', inline: false },
      { name: '👥 グループ管理', value: '- グループの作成・編集・削除\n- メンバーの追加・削除', inline: false },
      { name: '📥 エクスポート / インポート', value: '- TXT / CSV / JSON 形式でエクスポート\n- JSON形式でインポート（管理者のみ）\n- インポート時は確認ダイアログが表示されます', inline: false },
      { name: '📱 スマートフォン対応', value: 'レスポンシブデザインで\nPC・スマートフォン両方に対応しています。', inline: false },
    ]
  },
};

module.exports = async function(interaction) {
  const customId = interaction.customId;
  const value = interaction.values[0];
  const client = interaction.client;

  // === ヘルプカテゴリ選択 ===
  if (customId === 'help_category') {
    const page = HELP_PAGES[value];
    if (!page) return;

    const embed = new EmbedBuilder()
      .setColor(page.color)
      .setTitle(page.title)
      .addFields(page.fields)
      .setFooter({ text: '別のカテゴリを選んで切り替えられます' })
      .setTimestamp();

    // セレクトメニューを再構築してリセット
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('help_category')
          .setPlaceholder('📂 カテゴリを選択')
          .addOptions([
            { label: 'タスク基本操作', value: 'help_task_basic', emoji: '📋', description: '追加・表示・一覧・削除' },
            { label: 'タスク編集', value: 'help_task_edit', emoji: '✏️', description: 'ステータス・優先度・担当者の変更' },
            { label: 'エクスポート / インポート', value: 'help_data', emoji: '📥', description: 'データの出力・取り込み' },
            { label: 'グループ管理', value: 'help_group', emoji: '👥', description: 'グループの作成・メンバー管理' },
            { label: 'パネルの使い方', value: 'help_panel', emoji: '🖥️', description: 'パネルの各機能の説明' },
            { label: 'Webアプリについて', value: 'help_web', emoji: '🌐', description: 'Webアプリの機能紹介' },
          ]),
      );

    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  // === パネルセレクト ===

  // ソート切り替え（タスク一覧パネル上）
  if (customId === 'panel_sort' || customId.startsWith('panel_sort:')) {
    let sort = undefined;
    let sortLabel = '作成日順';
    if (value === 'sort_id') { sort = 'id'; sortLabel = 'ID順'; }
    else if (value === 'sort_priority') { sort = 'priority'; sortLabel = '優先度順'; }

    // フィルター条件をcustomIdからパース
    let filterContext = null;
    let filters = { limit: 25, sort };
    let titlePrefix = '📁 全タスク';
    if (customId.startsWith('panel_sort:')) {
      try {
        filterContext = JSON.parse(customId.replace('panel_sort:', ''));
        if (filterContext.status) filters.status = filterContext.status;
        if (filterContext.priority) filters.priority = filterContext.priority;
        titlePrefix = filterContext.title || titlePrefix;
      } catch (e) { /* ignore parse error */ }
    }

    if (filterContext && filterContext.overdue) {
      // 期限切れフィルターは特殊処理
      const allTasks = TaskModel.getAll({ limit: 100, sort });
      const now = new Date();
      const overdueTasks = allTasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'completed');
      const panel = createTaskListPanel(overdueTasks, `${titlePrefix}（${sortLabel}）`, 1, 1, filterContext);
      await interaction.update(panel);
    } else {
      const tasks = TaskModel.getAll(filters);
      const panel = createTaskListPanel(tasks, `${titlePrefix}（${sortLabel}）`, 1, 1, filterContext);
      await interaction.update(panel);
    }
    return;
  }

  // クイックフィルター
  if (customId === 'panel_quick_filter') {
    // 元のメインパネルをリセット（セレクトの選択状態をクリア）
    const mainPanel = await createMainPanel();
    await interaction.update(mainPanel);

    let tasks = [];
    let title = '';
    let filterCtx = null;

    switch (value) {
      case 'filter_pending':
        tasks = TaskModel.getAll({ status: 'pending', limit: 25 });
        title = '⏳ 未着手のタスク';
        filterCtx = { status: 'pending', title };
        break;
      case 'filter_in_progress':
        tasks = TaskModel.getAll({ status: 'in_progress', limit: 25 });
        title = '🔄 進行中のタスク';
        filterCtx = { status: 'in_progress', title };
        break;
      case 'filter_on_hold':
        tasks = TaskModel.getAll({ status: 'on_hold', limit: 25 });
        title = '⏸️ 保留中のタスク';
        filterCtx = { status: 'on_hold', title };
        break;
      case 'filter_completed':
        tasks = TaskModel.getAll({ status: 'completed', limit: 25 });
        title = '✅ 完了したタスク';
        filterCtx = { status: 'completed', title };
        break;
      case 'filter_other':
        tasks = TaskModel.getAll({ status: 'other', limit: 25 });
        title = '📌 その他のタスク';
        filterCtx = { status: 'other', title };
        break;
      case 'filter_urgent':
        tasks = TaskModel.getAll({ priority: 'urgent', limit: 25 });
        title = '🔴 優先度: 緊急のタスク';
        filterCtx = { priority: 'urgent', title };
        break;
      case 'filter_high':
        tasks = TaskModel.getAll({ priority: 'high', limit: 25 });
        title = '🟠 優先度: 高のタスク';
        filterCtx = { priority: 'high', title };
        break;
      case 'filter_medium':
        tasks = TaskModel.getAll({ priority: 'medium', limit: 25 });
        title = '🟡 優先度: 中のタスク';
        filterCtx = { priority: 'medium', title };
        break;
      case 'filter_low':
        tasks = TaskModel.getAll({ priority: 'low', limit: 25 });
        title = '🟢 優先度: 低のタスク';
        filterCtx = { priority: 'low', title };
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
        filterCtx = { overdue: true, title };
        break;
    }

    const panel = createTaskListPanel(tasks, title, 1, 1, filterCtx);
    await interaction.followUp({ ...panel, flags: MessageFlags.Ephemeral });
    return;
  }

  // タスク選択して詳細表示
  if (customId === 'task_select_view') {
    // 元のタスク一覧パネルのセレクトをリセット（同じembedのまま、componentsだけ再構築）
    const originalEmbeds = interaction.message.embeds;
    const originalComponents = interaction.message.components;
    // componentsを再構築してセレクト選択状態をクリア
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const freshComponents = originalComponents.map(row => {
      const newRow = ActionRowBuilder.from(row);
      newRow.components = row.components.map(comp => {
        if (comp.type === 3) { // StringSelectMenu
          const rebuilt = StringSelectMenuBuilder.from(comp);
          return rebuilt;
        }
        return comp;
      });
      return newRow;
    });
    await interaction.update({ embeds: originalEmbeds, components: freshComponents });

    const taskId = value;
    const task = TaskModel.findById(taskId);
    
    if (!task) {
      await interaction.followUp({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    const panel = createTaskDetailPanel(task);
    await interaction.followUp({ ...panel, flags: MessageFlags.Ephemeral });
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

  // 担当者変更（複数選択対応）
  if (customId.startsWith('task_assign_change:')) {
    const taskId = customId.replace('task_assign_change:', '');
    const task = TaskModel.findById(taskId);

    if (!task) {
      await interaction.reply({ content: '❌ タスクが見つかりません', flags: MessageFlags.Ephemeral });
      return;
    }

    const values = interaction.values; // 複数選択
    let updateData = {};
    let changeDescription = '';

    // 「未割当」「全員」が選ばれている場合はそれを優先
    if (values.includes('assign_none')) {
      updateData = { assignedType: null, assignedUserIds: [], assignedGroupIds: [] };
      changeDescription = '担当者を「未割当」に変更';
    } else if (values.includes('assign_all')) {
      updateData = { assignedType: 'all', assignedUserIds: [], assignedGroupIds: [] };
      changeDescription = '担当者を「全員」に変更';
    } else {
      // ユーザーとグループを分離
      const userIds = [];
      const groupIds = [];
      for (const v of values) {
        if (v.startsWith('assign_user:')) {
          userIds.push(parseInt(v.replace('assign_user:', '')));
        } else if (v.startsWith('assign_group:')) {
          groupIds.push(parseInt(v.replace('assign_group:', '')));
        }
      }

      // タイプを決定
      let assignedType = null;
      if (userIds.length > 0 && groupIds.length > 0) {
        assignedType = 'user'; // 混合の場合もuser扱い（後方互換）
      } else if (userIds.length > 0) {
        assignedType = 'user';
      } else if (groupIds.length > 0) {
        assignedType = 'group';
      }

      updateData = { assignedType, assignedUserIds: userIds, assignedGroupIds: groupIds };

      // 変更説明を構築
      const parts = [];
      if (userIds.length > 0) {
        const names = userIds.map(id => {
          const u = UserModel.findById(id);
          return u?.username || '不明';
        });
        parts.push(names.join(', '));
      }
      if (groupIds.length > 0) {
        const { GroupModel } = require('../../database/models');
        const names = groupIds.map(id => {
          const g = GroupModel.findById(id);
          return g?.name || '不明';
        });
        parts.push(names.join(', '));
      }
      changeDescription = `担当者を「${parts.join(', ')}」に変更`;
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
