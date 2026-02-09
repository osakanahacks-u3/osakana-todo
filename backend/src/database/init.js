const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/todo.db');
const db = new Database(dbPath);

// WALモードを有効化（パフォーマンス向上）
db.pragma('journal_mode = WAL');

function initDatabase() {
  // ユーザーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      discriminator TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // グループテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3498db',
      discord_role_id TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // discord_role_idカラムが既存テーブルにない場合追加
  try {
    db.exec('ALTER TABLE groups ADD COLUMN discord_role_id TEXT');
  } catch (e) {
    // カラムが既に存在する場合は無視
  }

  // グループメンバーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    )
  `);

  // タスクテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'on_hold', 'completed', 'other')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      due_date DATETIME,
      assigned_type TEXT CHECK(assigned_type IN ('user', 'group', 'all')),
      assigned_user_id INTEGER,
      assigned_group_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_group_id) REFERENCES groups(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // タスク担当者テーブル（複数ユーザー割り当て対応）
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_assignees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(task_id, user_id)
    )
  `);

  // 既存の assigned_user_id データを task_assignees に移行
  try {
    const tasksWithUser = db.prepare(
      "SELECT id, assigned_user_id FROM tasks WHERE assigned_user_id IS NOT NULL AND assigned_type = 'user'"
    ).all();
    const insertAssignee = db.prepare(
      'INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)'
    );
    for (const t of tasksWithUser) {
      insertAssignee.run(t.id, t.assigned_user_id);
    }
  } catch (e) {
    // 移行済みまたはエラー時は無視
  }

  // タスクコメントテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // セッションテーブル（Web認証用）
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      discord_id TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ログインレート制限テーブル（ブルートフォース対策）
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 0
    )
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_group ON tasks(assigned_group_id);
    CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
  `);

  console.log('Database initialized successfully');
}

module.exports = { db, initDatabase };
