const { db } = require('./init');

// ユーザー関連
const UserModel = {
  findByDiscordId(discordId) {
    return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  getAll() {
    return db.prepare('SELECT * FROM users ORDER BY username').all();
  },

  create(discordId, username, discriminator, avatar) {
    const stmt = db.prepare(
      'INSERT INTO users (discord_id, username, discriminator, avatar) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(discordId, username, discriminator, avatar);
    return this.findById(result.lastInsertRowid);
  },

  upsert(discordId, username, discriminator, avatar) {
    const existing = this.findByDiscordId(discordId);
    if (existing) {
      db.prepare(
        'UPDATE users SET username = ?, discriminator = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_id = ?'
      ).run(username, discriminator, avatar, discordId);
      return this.findByDiscordId(discordId);
    }
    return this.create(discordId, username, discriminator, avatar);
  }
};

// グループ関連
const GroupModel = {
  findById(id) {
    return db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  },

  getAll() {
    return db.prepare('SELECT * FROM groups ORDER BY name').all();
  },

  create(name, description, color, createdBy) {
    const stmt = db.prepare(
      'INSERT INTO groups (name, description, color, created_by) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(name, description, color, createdBy);
    return this.findById(result.lastInsertRowid);
  },

  update(id, name, description, color) {
    db.prepare(
      'UPDATE groups SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, description, color, id);
    return this.findById(id);
  },

  setDiscordRoleId(id, roleId) {
    db.prepare('UPDATE groups SET discord_role_id = ? WHERE id = ?').run(roleId, id);
  },

  delete(id) {
    return db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  },

  getMembers(groupId) {
    return db.prepare(`
      SELECT u.* FROM users u
      INNER JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY u.username
    `).all(groupId);
  },

  addMember(groupId, userId) {
    try {
      db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);
      return true;
    } catch (e) {
      return false; // 既に存在
    }
  },

  removeMember(groupId, userId) {
    return db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
  },

  getUserGroups(userId) {
    return db.prepare(`
      SELECT g.* FROM groups g
      INNER JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.name
    `).all(userId);
  }
};

// タスク関連
const TaskModel = {
  /**
   * タスクに担当ユーザー情報を付与する
   */
  _attachAssignees(task) {
    if (!task) return task;
    const assignees = db.prepare(`
      SELECT u.id, u.username, u.discord_id
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
      ORDER BY u.username
    `).all(task.id);
    task.assigned_users = assignees;
    // 後方互換用
    if (assignees.length > 0) {
      task.assigned_user_name = assignees.map(u => u.username).join(', ');
      task.assigned_user_discord_id = assignees.map(u => u.discord_id).join(',');
    }
    // 複数グループ情報を付与
    const groups = db.prepare(`
      SELECT g.id, g.name, g.discord_role_id
      FROM task_assigned_groups tag
      JOIN groups g ON tag.group_id = g.id
      WHERE tag.task_id = ?
      ORDER BY g.name
    `).all(task.id);
    task.assigned_groups = groups;
    // 後方互換: assigned_group_name
    if (groups.length > 0) {
      task.assigned_group_name = groups.map(g => g.name).join(', ');
    }
    return task;
  },

  /**
   * 複数タスクに担当ユーザー情報を付与する
   */
  _attachAssigneesBatch(tasks) {
    if (!tasks || tasks.length === 0) return tasks;
    const taskIds = tasks.map(t => t.id);
    const placeholders = taskIds.map(() => '?').join(',');
    const allAssignees = db.prepare(`
      SELECT ta.task_id, u.id, u.username, u.discord_id
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id IN (${placeholders})
      ORDER BY u.username
    `).all(...taskIds);

    const assigneeMap = {};
    for (const a of allAssignees) {
      if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
      assigneeMap[a.task_id].push({ id: a.id, username: a.username, discord_id: a.discord_id });
    }

    // 複数グループ情報
    const allGroups = db.prepare(`
      SELECT tag.task_id, g.id, g.name, g.discord_role_id
      FROM task_assigned_groups tag
      JOIN groups g ON tag.group_id = g.id
      WHERE tag.task_id IN (${placeholders})
      ORDER BY g.name
    `).all(...taskIds);

    const groupMap = {};
    for (const g of allGroups) {
      if (!groupMap[g.task_id]) groupMap[g.task_id] = [];
      groupMap[g.task_id].push({ id: g.id, name: g.name, discord_role_id: g.discord_role_id });
    }

    for (const task of tasks) {
      const assignees = assigneeMap[task.id] || [];
      task.assigned_users = assignees;
      if (assignees.length > 0) {
        task.assigned_user_name = assignees.map(u => u.username).join(', ');
        task.assigned_user_discord_id = assignees.map(u => u.discord_id).join(',');
      }
      const groups = groupMap[task.id] || [];
      task.assigned_groups = groups;
      if (groups.length > 0) {
        task.assigned_group_name = groups.map(g => g.name).join(', ');
      }
    }
    return tasks;
  },

  findById(id) {
    const task = db.prepare(`
      SELECT t.*, 
        u.username as creator_name,
        u.discord_id as creator_discord_id,
        g.name as assigned_group_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN groups g ON t.assigned_group_id = g.id
      WHERE t.id = ?
    `).get(id);
    return this._attachAssignees(task);
  },

  getAll(filters = {}) {
    let query = `
      SELECT t.*, 
        u.username as creator_name,
        u.discord_id as creator_discord_id,
        g.name as assigned_group_name,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN groups g ON t.assigned_group_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    if (filters.assignedUserId) {
      query += ' AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)';
      params.push(filters.assignedUserId);
    }

    if (filters.assignedGroupId) {
      query += ' AND t.assigned_group_id = ?';
      params.push(filters.assignedGroupId);
    }

    if (filters.createdBy) {
      query += ' AND t.created_by = ?';
      params.push(filters.createdBy);
    }

    if (filters.assignedType) {
      query += ' AND t.assigned_type = ?';
      params.push(filters.assignedType);
    }

    if (filters.priority) {
      query += ' AND t.priority = ?';
      params.push(filters.priority);
    }

    // ソート: priority = 優先度順, それ以外 = ID順（デフォルト: ID降順）
    // 完了タスクは常に下に配置
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    if (filters.sort === 'priority') {
      const priorityDir = filters.sortOrder === 'asc' ? 'DESC' : 'ASC';
      query += ` ORDER BY CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC, CASE t.priority 
        WHEN 'urgent' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
        ELSE 4 END ${priorityDir}, t.id DESC`;
    } else {
      query += ` ORDER BY CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC, t.id ${sortOrder}`;
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const tasks = db.prepare(query).all(...params);
    return this._attachAssigneesBatch(tasks);
  },

  getForUser(userId, filters = {}) {
    // ユーザーに直接割り当てられたタスク、またはユーザーが所属するグループに割り当てられたタスク、または全体タスク
    // filters: { priority?: 'low'|'medium'|'high'|'urgent', assignedType?: 'user'|'group'|'all' }

    let query = `
      SELECT DISTINCT t.*, 
        u.username as creator_name,
        g.name as assigned_group_name,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN groups g ON t.assigned_group_id = g.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN group_members gm ON t.assigned_group_id = gm.group_id
      WHERE `;

    const params = [];

    if (filters.assignedType === 'user') {
      query += 'ta.user_id = ?';
      params.push(userId);
    } else if (filters.assignedType === 'group') {
      query += 'gm.user_id = ?';
      params.push(userId);
    } else if (filters.assignedType === 'all') {
      query += "t.assigned_type = 'all'";
    } else {
      query += '(ta.user_id = ? OR gm.user_id = ? OR t.assigned_type = \'all\')';
      params.push(userId, userId);
    }

    if (filters.priority) {
      query += ' AND t.priority = ?';
      params.push(filters.priority);
    }

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    // ソート
    // 完了タスクは常に下に配置
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    if (filters.sort === 'priority') {
      const priorityDir = filters.sortOrder === 'asc' ? 'DESC' : 'ASC';
      query += ` ORDER BY CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC, CASE t.priority 
        WHEN 'urgent' THEN 0 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
        ELSE 4 END ${priorityDir}, t.id DESC`;
    } else {
      query += ` ORDER BY CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC, t.id ${sortOrder}`;
    }

    const tasks = db.prepare(query).all(...params);
    return this._attachAssigneesBatch(tasks);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, due_date, assigned_type, assigned_user_id, assigned_group_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // assignedUserIds 配列があれば最初の1つを後方互換用に入れる
    const firstUserId = Array.isArray(data.assignedUserIds) && data.assignedUserIds.length > 0 
      ? data.assignedUserIds[0] 
      : (data.assignedUserId || null);
    const result = stmt.run(
      data.title,
      data.description || null,
      data.status || 'pending',
      data.priority || 'medium',
      data.dueDate || null,
      data.assignedType || null,
      firstUserId,
      data.assignedGroupId || null,
      data.createdBy
    );
    const taskId = result.lastInsertRowid;

    // task_assignees に複数ユーザーを登録
    if (data.assignedType === 'user' || (Array.isArray(data.assignedUserIds) && data.assignedUserIds.length > 0)) {
      const userIds = Array.isArray(data.assignedUserIds) ? data.assignedUserIds : (data.assignedUserId ? [data.assignedUserId] : []);
      const insertAssignee = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)');
      for (const uid of userIds) {
        if (uid) insertAssignee.run(taskId, uid);
      }
    }

    // task_assigned_groups に複数グループを登録
    if (Array.isArray(data.assignedGroupIds) && data.assignedGroupIds.length > 0) {
      const insertGroup = db.prepare('INSERT OR IGNORE INTO task_assigned_groups (task_id, group_id) VALUES (?, ?)');
      for (const gid of data.assignedGroupIds) {
        if (gid) insertGroup.run(taskId, gid);
      }
    } else if (data.assignedGroupId) {
      db.prepare('INSERT OR IGNORE INTO task_assigned_groups (task_id, group_id) VALUES (?, ?)').run(taskId, data.assignedGroupId);
    }

    return this.findById(taskId);
  },

  /**
   * タスクの担当ユーザーを設定（全置換）
   */
  setAssignees(taskId, userIds) {
    db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId);
    if (userIds && userIds.length > 0) {
      const insert = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)');
      for (const uid of userIds) {
        if (uid) insert.run(taskId, uid);
      }
      // 後方互換: assigned_user_id に最初の1つをセット
      db.prepare('UPDATE tasks SET assigned_user_id = ? WHERE id = ?').run(userIds[0], taskId);
    } else {
      db.prepare('UPDATE tasks SET assigned_user_id = NULL WHERE id = ?').run(taskId);
    }
  },

  /**
   * タスクの担当グループを設定（全置換）
   */
  setAssignedGroups(taskId, groupIds) {
    db.prepare('DELETE FROM task_assigned_groups WHERE task_id = ?').run(taskId);
    if (groupIds && groupIds.length > 0) {
      const insert = db.prepare('INSERT OR IGNORE INTO task_assigned_groups (task_id, group_id) VALUES (?, ?)');
      for (const gid of groupIds) {
        if (gid) insert.run(taskId, gid);
      }
      // 後方互換: assigned_group_id に最初の1つをセット
      db.prepare('UPDATE tasks SET assigned_group_id = ? WHERE id = ?').run(groupIds[0], taskId);
    } else {
      db.prepare('UPDATE tasks SET assigned_group_id = NULL WHERE id = ?').run(taskId);
    }
  },

  update(id, data) {
    const fields = [];
    const params = [];

    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.status !== undefined) { 
      fields.push('status = ?'); 
      params.push(data.status);
      if (data.status === 'completed') {
        fields.push('completed_at = CURRENT_TIMESTAMP');
        fields.push('priority = NULL');
      }
    }
    if (data.priority !== undefined) { fields.push('priority = ?'); params.push(data.priority); }
    if (data.dueDate !== undefined) { fields.push('due_date = ?'); params.push(data.dueDate); }
    if (data.assignedType !== undefined) { fields.push('assigned_type = ?'); params.push(data.assignedType); }
    if (data.assignedGroupId !== undefined) { fields.push('assigned_group_id = ?'); params.push(data.assignedGroupId); }

    // 複数ユーザー担当の更新
    if (data.assignedUserIds !== undefined) {
      const userIds = Array.isArray(data.assignedUserIds) ? data.assignedUserIds.filter(Boolean) : [];
      this.setAssignees(id, userIds);
    } else if (data.assignedUserId !== undefined) {
      // 後方互換: 単一ユーザー指定
      const uid = data.assignedUserId;
      this.setAssignees(id, uid ? [uid] : []);
    }

    // 複数グループ担当の更新
    if (data.assignedGroupIds !== undefined) {
      const groupIds = Array.isArray(data.assignedGroupIds) ? data.assignedGroupIds.filter(Boolean) : [];
      this.setAssignedGroups(id, groupIds);
      // 後方互換用: assigned_group_id
      if (groupIds.length > 0) {
        fields.push('assigned_group_id = ?');
        params.push(groupIds[0]);
      } else {
        fields.push('assigned_group_id = ?');
        params.push(null);
      }
    } else if (data.assignedGroupId !== undefined && data.assignedGroupIds === undefined) {
      // 単一グループ指定（後方互換）
      const gid = data.assignedGroupId;
      this.setAssignedGroups(id, gid ? [gid] : []);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  },

  getComments(taskId) {
    return db.prepare(`
      SELECT tc.*, u.username, u.discord_id
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `).all(taskId);
  },

  addComment(taskId, userId, content) {
    const stmt = db.prepare('INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)');
    return stmt.run(taskId, userId, content);
  },

  getStats() {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'other' THEN 1 ELSE 0 END) as other,
        SUM(CASE WHEN status != 'completed' AND priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN status != 'completed' AND priority = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN status != 'completed' AND priority = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN status != 'completed' AND priority = 'low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN status != 'completed' AND (priority IS NULL OR priority = '') THEN 1 ELSE 0 END) as no_priority
      FROM tasks
    `).get();
    return stats;
  }
};

// セッション関連
const SessionModel = {
  create(token, userId, discordId, expiresAt) {
    db.prepare('INSERT INTO sessions (token, user_id, discord_id, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, discordId, expiresAt);
  },

  findByToken(token) {
    return db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").get(token);
  },

  delete(token) {
    return db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  cleanup() {
    return db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  }
};

// ログイン試行記録（ブルートフォース対策）
const LoginAttemptModel = {
  record(ipAddress, success) {
    db.prepare('INSERT INTO login_attempts (ip_address, success) VALUES (?, ?)').run(ipAddress, success ? 1 : 0);
  },

  getRecentAttempts(ipAddress, minutes = 15) {
    return db.prepare(`
      SELECT COUNT(*) as count FROM login_attempts 
      WHERE ip_address = ? 
        AND success = 0 
        AND attempted_at > datetime('now', '-' || ? || ' minutes')
    `).get(ipAddress, minutes);
  },

  cleanup() {
    return db.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 day')").run();
  }
};

module.exports = {
  UserModel,
  GroupModel,
  TaskModel,
  SessionModel,
  LoginAttemptModel
};
