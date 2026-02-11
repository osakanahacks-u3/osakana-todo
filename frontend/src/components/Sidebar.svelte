<script lang="ts">
  interface Props {
    currentUser: any;
    activeView: 'tasks' | 'groups';
    isOpen?: boolean;
    taskFilter?: { status?: string; priority?: string; assignedUserId?: string; [key: string]: any };
    stats?: any;
    onViewChange: (view: 'tasks' | 'groups') => void;
    onFilterChange?: (key: string, value: string | undefined) => void;
    onLogout: () => void;
    onClose?: () => void;
  }

  let { currentUser, activeView, isOpen = true, taskFilter = {}, stats, onViewChange, onFilterChange, onLogout, onClose }: Props = $props();

  function getStatusCount(value: string): number {
    if (!stats) return 0;
    return stats[value] ?? 0;
  }

  function getPriorityCount(value: string): number {
    if (!stats) return 0;
    return stats[value] ?? 0;
  }

  const STATUS_OPTIONS = [
    { value: 'pending', label: '未着手', icon: '⏳' },
    { value: 'in_progress', label: '進行中', icon: '🔄' },
    { value: 'on_hold', label: '保留中', icon: '⏸️' },
    { value: 'completed', label: '完了', icon: '✅' },
    { value: 'other', label: 'その他', icon: '📌' },
  ];

  const PRIORITY_OPTIONS = [
    { value: 'urgent', label: '緊急', icon: '🚨' },
    { value: 'high', label: '高', icon: '🔴' },
    { value: 'medium', label: '中', icon: '🟡' },
    { value: 'low', label: '低', icon: '🟢' },
  ];

  function toggleFilter(key: string, value: string) {
    if (!onFilterChange) return;
    if ((taskFilter as any)[key] === value) {
      onFilterChange(key, undefined);
    } else {
      onFilterChange(key, value);
    }
  }
</script>

<aside class="sidebar" class:open={isOpen}>
  <div class="sidebar-header">
    <div class="header-content">
      <span class="logo">📋</span>
      <h2>🐟 TODO管理</h2>
    </div>
    {#if onClose}
      <button class="close-btn" onclick={onClose} aria-label="閉じる">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>

  {#if currentUser}
    <div class="user-info">
      {#if currentUser.avatar}
        <img 
          src="https://cdn.discordapp.com/avatars/{currentUser.discordId}/{currentUser.avatar}.png" 
          alt={currentUser.username}
          class="avatar"
        />
      {:else}
        <div class="avatar avatar-placeholder">
          {currentUser.username?.[0]?.toUpperCase() || '?'}
        </div>
      {/if}
      <div class="user-details">
        <span class="username">{currentUser.username || 'ユーザー'}</span>
        <span class="user-badge">Discord認証</span>
      </div>
    </div>
  {:else}
    <div class="user-info">
      <div class="avatar avatar-placeholder">🔑</div>
      <div class="user-details">
        <span class="username">管理者</span>
        <span class="user-badge">パスワード認証</span>
      </div>
    </div>
  {/if}

  <nav class="sidebar-nav">
    <div class="nav-section">
      <button 
        class="nav-item" 
        class:active={activeView === 'tasks'}
        onclick={() => { onViewChange('tasks'); onClose?.(); }}
      >
        <span class="nav-icon">📋</span>
        タスク
      </button>
      <button 
        class="nav-item"
        class:active={activeView === 'groups'}
        onclick={() => { onViewChange('groups'); onClose?.(); }}
      >
        <span class="nav-icon">👥</span>
        グループ
      </button>
    </div>

    {#if activeView === 'tasks' && onFilterChange}
      <div class="filter-section">
        <span class="filter-section-label">進行度</span>
        <div class="filter-chips">
          {#each STATUS_OPTIONS as opt}
            <button
              class="filter-chip"
              class:active={taskFilter.status === opt.value}
              onclick={() => toggleFilter('status', opt.value)}
            >
              <span class="chip-icon">{opt.icon}</span>
              <span class="chip-text">{opt.label}</span>
              <span class="chip-count">{getStatusCount(opt.value)}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="filter-section">
        <span class="filter-section-label">優先度</span>
        <div class="filter-chips">
          {#each PRIORITY_OPTIONS as opt}
            <button
              class="filter-chip"
              class:active={taskFilter.priority === opt.value}
              onclick={() => toggleFilter('priority', opt.value)}
            >
              <span class="chip-icon">{opt.icon}</span>
              <span class="chip-text">{opt.label}</span>
              <span class="chip-count">{getPriorityCount(opt.value)}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="filter-section">
        <button
          class="filter-chip my-task-chip"
          class:active={taskFilter.assignedUserId === 'me'}
          onclick={() => toggleFilter('assignedUserId', 'me')}
        >
          <span class="chip-icon">👤</span>
          <span class="chip-text">自分のタスク</span>
        </button>
      </div>
    {/if}
  </nav>

  <div class="sidebar-footer safe-area-bottom">
    <button class="logout-btn" onclick={onLogout}>
      <span>🚪</span>
      <span>ログアウト</span>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100vh;
    height: 100dvh;
    position: sticky;
    top: 0;
  }

  .sidebar-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-color);
    min-height: var(--header-height);
  }

  .header-content { display: flex; align-items: center; gap: 12px; }

  .close-btn {
    display: none;
    padding: 8px;
    background: transparent;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    transition: var(--transition);
  }
  .close-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }

  .logo { font-size: 28px; }
  .sidebar-header h2 { font-size: 1.125rem; font-weight: 600; }

  .user-info {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .avatar-placeholder {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    display: flex; align-items: center; justify-content: center;
    font-weight: 600; font-size: 16px; color: white;
  }

  .user-details { display: flex; flex-direction: column; min-width: 0; }
  .username { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .user-badge { font-size: 12px; color: var(--text-muted); }

  .sidebar-nav { flex: 1; padding: 16px 12px; overflow-y: auto; }
  .nav-section { display: flex; flex-direction: column; gap: 4px; }

  .nav-item {
    width: 100%; padding: 12px 14px; background: transparent; border: none;
    border-radius: var(--radius-md); color: var(--text-secondary); font-size: 14px;
    display: flex; align-items: center; gap: 12px; cursor: pointer; transition: var(--transition);
  }
  .nav-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .nav-item.active { background: var(--primary); color: white; }
  .nav-icon { font-size: 18px; flex-shrink: 0; }

  .sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); }

  .filter-section {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .filter-section-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    padding: 0 4px;
  }

  .filter-chips {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .filter-chip {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: var(--transition);
  }

  .filter-chip:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .filter-chip.active {
    background: rgba(88, 101, 242, 0.15);
    color: var(--primary);
    font-weight: 500;
  }

  .chip-icon { font-size: 14px; flex-shrink: 0; }
  .chip-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: left; }

  .chip-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .filter-chip.active .chip-count {
    background: rgba(88, 101, 242, 0.25);
    color: var(--primary);
  }

  .my-task-chip {
    margin-top: 4px;
  }
  .logout-btn {
    width: 100%; padding: 12px 16px; background: transparent;
    border: 1px solid var(--border-color); border-radius: var(--radius-md);
    color: var(--text-secondary); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: var(--transition);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .logout-btn:hover { background: var(--danger); border-color: var(--danger); color: white; }

  @media (max-width: 768px) {
    .sidebar {
      position: fixed; left: 0; top: 0; z-index: 100;
      transform: translateX(-100%); transition: transform 0.3s ease;
      box-shadow: var(--shadow-lg);
    }
    .sidebar.open { transform: translateX(0); }
    .close-btn { display: flex; }
  }
</style>
