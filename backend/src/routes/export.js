const express = require('express');
const { TaskModel, UserModel } = require('../database/models');
const { authMiddleware } = require('../middleware/auth');
const { checkPermissionByDiscordId } = require('../middleware/permission');
const { db } = require('../database/init');
const { formatDateTime } = require('../utils/timezone');

const router = express.Router();

// 認証ミドルウェアを適用
router.use(authMiddleware);

const STATUS_LABELS = {
  pending: '未処理',
  in_progress: '処理中',
  on_hold: '保留',
  completed: '完了',
  other: 'その他'
};

const PRIORITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急'
};

// TXT形式でエクスポート
router.get('/txt', (req, res) => {
  const { status, assignedUserId, assignedGroupId } = req.query;
  
  const filters = {};
  if (status) filters.status = status;
  if (assignedUserId) filters.assignedUserId = parseInt(assignedUserId);
  if (assignedGroupId) filters.assignedGroupId = parseInt(assignedGroupId);

  const tasks = TaskModel.getAll(filters);

  let content = 'TODOタスク一覧\n';
  content += '='.repeat(50) + '\n\n';

  tasks.forEach(task => {
    content += `[#${task.id}] ${task.title}\n`;
    content += `  ステータス: ${STATUS_LABELS[task.status]}\n`;
    content += `  優先度: ${PRIORITY_LABELS[task.priority]}\n`;
    if (task.description) {
      content += `  説明: ${task.description}\n`;
    }
    if (task.assigned_users && task.assigned_users.length > 0) {
      content += `  担当者: ${task.assigned_users.map(u => u.username).join(', ')}\n`;
    } else if (task.assigned_user_name) {
      content += `  担当者: ${task.assigned_user_name}\n`;
    } else if (task.assigned_group_name) {
      content += `  担当グループ: ${task.assigned_group_name}\n`;
    } else if (task.assigned_type === 'all') {
      content += `  担当: 全員\n`;
    }
    content += `  作成者: ${task.creator_name || '不明'}\n`;
    content += `  作成日: ${task.created_at}\n`;
    if (task.due_date) {
      content += `  期限: ${task.due_date}\n`;
    }
    if (task.completed_at) {
      content += `  完了日: ${task.completed_at}\n`;
    }
    content += '\n';
  });

  content += '='.repeat(50) + '\n';
  content += `総タスク数: ${tasks.length}\n`;
  content += `エクスポート日時: ${formatDateTime(new Date())}\n`;

  // UTF-8 BOM付きで送信（iPhone Safari文字化け対策）
  const bom = '\uFEFF';
  const buf = Buffer.from(bom + content, 'utf-8');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks.txt"');
  res.send(buf);
});

// CSV形式でエクスポート
router.get('/csv', (req, res) => {
  const { status, assignedUserId, assignedGroupId } = req.query;
  
  const filters = {};
  if (status) filters.status = status;
  if (assignedUserId) filters.assignedUserId = parseInt(assignedUserId);
  if (assignedGroupId) filters.assignedGroupId = parseInt(assignedGroupId);

  const tasks = TaskModel.getAll(filters);

  // BOM付きUTF-8
  let content = '\uFEFF';
  content += 'ID,タイトル,説明,ステータス,優先度,担当タイプ,担当者,担当グループ,作成者,作成日,期限,完了日\n';

  tasks.forEach(task => {
    const row = [
      task.id,
      `"${(task.title || '').replace(/"/g, '""')}"`,
      `"${(task.description || '').replace(/"/g, '""')}"`,
      STATUS_LABELS[task.status],
      PRIORITY_LABELS[task.priority],
      task.assigned_type || '',
      task.assigned_users && task.assigned_users.length > 0 ? task.assigned_users.map(u => u.username).join('; ') : (task.assigned_user_name || ''),
      task.assigned_group_name || '',
      task.creator_name || '',
      task.created_at || '',
      task.due_date || '',
      task.completed_at || ''
    ];
    content += row.join(',') + '\n';
  });

  // Buffer化して確実にUTF-8 BOM付きで送信（iPhone Safari文字化け対策）
  const csvBuf = Buffer.from(content, 'utf-8');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
  res.send(csvBuf);
});

// JSON形式でエクスポート
router.get('/json', (req, res) => {
  const { status, assignedUserId, assignedGroupId } = req.query;
  
  const filters = {};
  if (status) filters.status = status;
  if (assignedUserId) filters.assignedUserId = parseInt(assignedUserId);
  if (assignedGroupId) filters.assignedGroupId = parseInt(assignedGroupId);

  const tasks = TaskModel.getAll(filters);

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalTasks: tasks.length,
    tasks: tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      statusLabel: STATUS_LABELS[task.status],
      priority: task.priority,
      priorityLabel: PRIORITY_LABELS[task.priority],
      assignedType: task.assigned_type,
      assignedUser: task.assigned_user_name,
      assignedGroup: task.assigned_group_name,
      createdBy: task.creator_name,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      dueDate: task.due_date,
      completedAt: task.completed_at
    }))
  };

  // UTF-8 BOM付きで送信（iPhone Safari文字化け対策）
  const jsonBom = '\uFEFF';
  const jsonBuf = Buffer.from(jsonBom + JSON.stringify(exportData, null, 2), 'utf-8');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks.json"');
  res.send(jsonBuf);
});

// JSON形式でインポート（管理者のみ）
router.post('/import', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    // 管理者チェック: Discord認証ユーザーはAdministrator権限チェック
    // パスワード認証ユーザー（req.user === null）は管理者扱い
    if (req.user?.discord_id) {
      const discordClient = require('../discord/client');
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId && discordClient?.isReady()) {
        try {
          const guild = await discordClient.guilds.fetch(guildId);
          const member = await guild.members.fetch(req.user.discord_id).catch(() => null);
          if (member && !member.permissions.has('Administrator')) {
            return res.status(403).json({ error: 'インポートはサーバー管理者のみ実行できます' });
          }
        } catch (e) {
          // エラー時はフォールスルー
        }
      }
    }

    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: '無効なファイル形式です。tasks 配列が必要です' });
    }

    // インポート実行（トランザクション内）
    const importTransaction = db.transaction(() => {
      // 既存タスクと関連データを削除
      db.prepare('DELETE FROM task_comments').run();
      db.prepare('DELETE FROM task_assignees').run();
      db.prepare('DELETE FROM task_assigned_groups').run();
      db.prepare('DELETE FROM tasks').run();

      // created_by: ログインユーザーまたはシステム（ID=1のダミー）
      const creatorId = req.user?.id || 1;

      let imported = 0;
      for (const task of tasks) {
        const validStatuses = ['pending', 'in_progress', 'on_hold', 'completed', 'other'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const status = validStatuses.includes(task.status) ? task.status : 'pending';
        const priority = validPriorities.includes(task.priority) ? task.priority : 'medium';

        TaskModel.create({
          title: task.title || '無題',
          description: task.description || null,
          status,
          priority,
          dueDate: task.dueDate || null,
          assignedType: task.assignedType || null,
          createdBy: creatorId
        });
        imported++;
      }
      return imported;
    });

    const importedCount = importTransaction();

    // メインパネル更新
    try {
      const discordClient = require('../discord/client');
      if (discordClient?.updateMainPanel) {
        discordClient.updateMainPanel();
      }
    } catch (e) { /* ignore */ }

    res.json({ success: true, imported: importedCount });
  } catch (e) {
    console.error('Import error:', e);
    res.status(500).json({ error: 'インポート処理中にエラーが発生しました' });
  }
});

module.exports = router;
