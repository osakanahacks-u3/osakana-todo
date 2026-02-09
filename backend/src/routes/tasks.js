const express = require('express');
const { TaskModel, UserModel, GroupModel } = require('../database/models');
const { authMiddleware } = require('../middleware/auth');
const discordClient = require('../discord/client');

const router = express.Router();

// 認証ミドルウェアを適用
router.use(authMiddleware);

// タスク一覧取得
router.get('/', (req, res) => {
  const { status, assignedUserId, assignedGroupId, assignedType, priority, limit, sort } = req.query;
  
  const filters = {};
  if (status) filters.status = status;
  if (assignedUserId) filters.assignedUserId = parseInt(assignedUserId);
  if (assignedGroupId) filters.assignedGroupId = parseInt(assignedGroupId);
  if (assignedType) filters.assignedType = assignedType;
  if (priority && ['low','medium','high','urgent'].includes(priority)) filters.priority = priority;
  if (sort && ['id','priority'].includes(sort)) filters.sort = sort;
  if (limit) filters.limit = parseInt(limit);

  const tasks = TaskModel.getAll(filters);
  res.json(tasks);
});

// 自分に関連するタスク取得
// クエリパラメータ: priority (low|medium|high|urgent), assignedType (user|group|all), status (pending|in_progress|on_hold|completed|other)
router.get('/my', (req, res) => {
  if (!req.user) {
    return res.json([]);
  }

  const filters = {};
  const { priority, assignedType, status, sort } = req.query;
  if (priority && ['low','medium','high','urgent'].includes(priority)) filters.priority = priority;
  if (assignedType && ['user','group','all'].includes(assignedType)) filters.assignedType = assignedType;
  if (status && ['pending','in_progress','on_hold','completed','other'].includes(status)) filters.status = status;
  if (sort && ['id','priority'].includes(sort)) filters.sort = sort;

  const tasks = TaskModel.getForUser(req.user.id, filters);
  res.json(tasks);
});

// 統計取得
router.get('/stats', (req, res) => {
  const stats = TaskModel.getStats();
  res.json(stats);
});

// タスク詳細取得
router.get('/:id', (req, res) => {
  const task = TaskModel.findById(parseInt(req.params.id));
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // コメントも取得
  const comments = TaskModel.getComments(task.id);
  
  res.json({ ...task, comments });
});

// タスク作成
router.post('/', (req, res) => {
  const { title, description, priority, dueDate, assignedType, assignedUserIds, assignedUserId, assignedGroupId, assignedGroupIds } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // 作成者IDを取得（Discord認証の場合はユーザーID、パスワード認証の場合はnull）
  let createdBy = null;
  if (req.user) {
    createdBy = req.user.id;
  } else if (req.body.creatorDiscordId) {
    const creator = UserModel.findByDiscordId(req.body.creatorDiscordId);
    if (creator) createdBy = creator.id;
  }

  if (!createdBy) {
    // パスワード認証でユーザーがない場合、システムユーザーとして扱う
    const systemUser = UserModel.upsert('system', 'System', null, null);
    createdBy = systemUser.id;
  }

  // 複数ユーザーIDの解決: assignedUserIds 配列を優先、なければassignedUserIdから配列化
  let resolvedUserIds = [];
  if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
    resolvedUserIds = assignedUserIds.map(id => parseInt(id)).filter(Boolean);
  } else if (assignedUserId) {
    resolvedUserIds = [parseInt(assignedUserId)];
  }

  // 複数グループIDの解決
  let resolvedGroupIds = [];
  if (Array.isArray(assignedGroupIds) && assignedGroupIds.length > 0) {
    resolvedGroupIds = assignedGroupIds.map(id => parseInt(id)).filter(Boolean);
  } else if (assignedGroupId) {
    resolvedGroupIds = [parseInt(assignedGroupId)];
  }

  const task = TaskModel.create({
    title,
    description,
    priority: priority || 'medium',
    dueDate,
    assignedType: assignedType || null,
    assignedUserIds: resolvedUserIds.length > 0 ? resolvedUserIds : undefined,
    assignedGroupId: resolvedGroupIds.length > 0 ? resolvedGroupIds[0] : (assignedGroupId ? parseInt(assignedGroupId) : null),
    assignedGroupIds: resolvedGroupIds.length > 0 ? resolvedGroupIds : undefined,
    createdBy
  });

  // Discord通知
  try {
    if (discordClient.isReady()) {
      if (discordClient.notifyTaskCreated) {
        const mention = req.user?.discord_id ? `<@${req.user.discord_id}>` : (req.user?.username || 'Web User');
        discordClient.notifyTaskCreated(task, mention);
      }
      if (discordClient.updateMainPanel) {
        discordClient.updateMainPanel();
      }
    }
  } catch (e) {
    console.error('Notification error:', e);
  }

  res.status(201).json(task);
});

// タスク更新
router.put('/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const existingTask = TaskModel.findById(taskId);

  if (!existingTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, description, status, priority, dueDate, assignedType, assignedUserIds, assignedUserId, assignedGroupId, assignedGroupIds } = req.body;

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (assignedType !== undefined) updateData.assignedType = assignedType;

  // 複数グループIDの解決
  if (assignedGroupIds !== undefined) {
    updateData.assignedGroupIds = Array.isArray(assignedGroupIds)
      ? assignedGroupIds.map(id => parseInt(id)).filter(Boolean)
      : [];
  } else if (assignedGroupId !== undefined) {
    updateData.assignedGroupId = assignedGroupId ? parseInt(assignedGroupId) : null;
  }

  // 複数ユーザーIDの解決
  if (assignedUserIds !== undefined) {
    updateData.assignedUserIds = Array.isArray(assignedUserIds)
      ? assignedUserIds.map(id => parseInt(id)).filter(Boolean)
      : [];
  } else if (assignedUserId !== undefined) {
    updateData.assignedUserIds = assignedUserId ? [parseInt(assignedUserId)] : [];
  }

  const task = TaskModel.update(taskId, updateData);

  // Discord通知
  try {
    if (discordClient.isReady()) {
      const updaterName = req.user?.discord_id ? `<@${req.user.discord_id}>` : (req.user?.username || 'Web User');
      // 担当変更の検出
      const assignmentChanged = (
        (assignedUserIds !== undefined || assignedUserId !== undefined) ||
        (assignedGroupId !== undefined && assignedGroupId != existingTask.assigned_group_id) ||
        (assignedType !== undefined && assignedType !== existingTask.assigned_type)
      );

      if (status === 'completed' && discordClient.notifyTaskCompleted) {
        discordClient.notifyTaskCompleted(task, updaterName);
      } else if (discordClient.notifyTaskUpdated) {
        const changesList = [];
        if (title !== undefined) changesList.push('タイトル');
        if (description !== undefined) changesList.push('説明');
        if (status !== undefined) changesList.push(`ステータス → ${status}`);
        if (priority !== undefined) changesList.push('優先度');
        if (assignmentChanged) changesList.push('担当');
        if (dueDate !== undefined) changesList.push('期限');
        discordClient.notifyTaskUpdated(task, updaterName, changesList.join('、') || '変更あり', { assignmentChanged });
      }
      if (discordClient.updateMainPanel) {
        discordClient.updateMainPanel();
      }
    }
  } catch (e) {
    console.error('Notification error:', e);
  }

  res.json(task);
});

// タスク削除
router.delete('/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const existingTask = TaskModel.findById(taskId);

  if (!existingTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  TaskModel.delete(taskId);

  // Discord通知
  try {
    if (discordClient.isReady()) {
      if (discordClient.notifyTaskDeleted) {
        const mention = req.user?.discord_id ? `<@${req.user.discord_id}>` : (req.user?.username || 'Web User');
        discordClient.notifyTaskDeleted(existingTask, mention);
      }
      if (discordClient.updateMainPanel) {
        discordClient.updateMainPanel();
      }
    }
  } catch (e) {
    console.error('Notification error:', e);
  }

  res.json({ success: true });
});

// タスクにコメント追加
router.post('/:id/comments', (req, res) => {
  const taskId = parseInt(req.params.id);
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const task = TaskModel.findById(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  let userId = null;
  if (req.user) {
    userId = req.user.id;
  }

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required to add comments' });
  }

  TaskModel.addComment(taskId, userId, content);
  const comments = TaskModel.getComments(taskId);

  // コメント追加をDiscord通知
  try {
    if (discordClient.isReady() && discordClient.notifyCommentAdded) {
      const mention = req.user?.discord_id ? `<@${req.user.discord_id}>` : (req.user?.username || '不明');
      discordClient.notifyCommentAdded(task, mention, content);
    }
  } catch (e) {
    console.error('Comment notification error:', e);
  }
  
  res.status(201).json(comments);
});

module.exports = router;
