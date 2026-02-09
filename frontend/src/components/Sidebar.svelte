<script lang="ts">
  interface Props {
    stats: any;
    currentUser: any;
    activeView: 'tasks' | 'groups';
    taskFilter: { status?: string; assignedUserId?: string; priority?: string; assignedType?: string };
    isOpen?: boolean;
    onViewChange: (view: 'tasks' | 'groups') => void;
    onFilterChange: (filter: { status?: string; assignedUserId?: string; priority?: string; assignedType?: string }) => void;
    onLogout: () => void;
    onClose?: () => void;
  }

  let { stats, currentUser, activeView, taskFilter, isOpen = true, onViewChange, onFilterChange, onLogout, onClose }: Props = $props();

  const statusOptions = [
    { value: '', label: '全て', icon: '📋' },
    { value: 'pending', label: '未着手', icon: '⏳' },
    { value: 'in_progress', label: '進行中', icon: '🔄' },
    { value: 'on_hold', label: '保留中', icon: '⏸️' },
    { value: 'completed', label: '完了', icon: '✅' },
    { value: 'other', label: 'その他', icon: '📌' }
  ];

  const priorityOptions = [
    { value: '', label: 'すべて', icon: '📋' },
    { value: 'low', label: '低', icon: '🟢' },
    { value: 'medium', label: '中', icon: '🟡' },
    { value: 'high', label: '高', icon: '🔴' },
    { value: 'urgent', label: '緊急', icon: '🚨' }
  ];

  const assignedSourceOptions = [
    { value: '', label: 'すべて', icon: '📋' },
    { value: 'user', label: '個人', icon: '👤' },
    { value: 'group', label: 'グループ', icon: '📁' },
    { value: 'all', label: '全員', icon: '👥' }
  ];
</script>

<aside class="sidebar" class:open={isOpen}>
  <div class="sidebar-header">
    <div class="header-content">
      <span class="logo">📋</span>
      <h2>TODO管理</h2>
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

  <nav class="sidebar-nav scroll-container">
    <div class="nav-section">
      <span class="nav-title">メニュー</span>
      <button 
        class="nav-item" 
        class:active={activeView === 'tasks'}
        onclick={() => onViewChange('tasks')}
      >
        <span class="nav-icon">📋</span>
        タスク
      </button>
      <button 
        class="nav-item"
        class:active={activeView === 'groups'}
        onclick={() => onViewChange('groups')}
      >
        <span class="nav-icon">👥</span>
        グループ
      </button>
    </div>

    {#if activeView === 'tasks'}
      <div class="nav-section">
        <span class="nav-title">ステータス</span>
        {#each statusOptions as option}
          <button 
            class="nav-item filter-item"
            class:active={taskFilter.status === option.value || (!taskFilter.status && option.value === '')}
            onclick={() => onFilterChange({ ...taskFilter, status: option.value || undefined })}
          >
            <span class="nav-icon">{option.icon}</span>
            {option.label}
            {#if stats && option.value}
              <span class="badge">{stats[option.value] || 0}</span>
            {:else if stats && !option.value}
              <span class="badge">{stats.total || 0}</span>
            {/if}
          </button>
        {/each}
      </div>

      {#if currentUser}
        <div class="nav-section">
          <span class="nav-title">クイック</span>
          <button 
            class="nav-item"
            class:active={taskFilter.assignedUserId === 'me'}
            onclick={() => onFilterChange({ 
              ...taskFilter, 
              assignedUserId: taskFilter.assignedUserId === 'me' ? undefined : 'me' 
            })}
          >
            <span class="nav-icon">👤</span>
            自分のタスク
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-title">優先度</span>
          {#each priorityOptions as opt}
            <button
              class="nav-item filter-item"
              class:active={taskFilter.priority === opt.value || (!taskFilter.priority && opt.value === '')}
              onclick={() => onFilterChange({ ...taskFilter, priority: opt.value || undefined })}
            >
              <span class="nav-icon">{opt.icon}</span>
              {opt.label}
            </button>
          {/each}
        </div>

        <div class="nav-section">
          <span class="nav-title">対象</span>
          {#each assignedSourceOptions as opt}
            <button
              class="nav-item filter-item"
              class:active={taskFilter.assignedType === opt.value || (!taskFilter.assignedType && opt.value === '')}
              onclick={() => onFilterChange({ ...taskFilter, assignedType: opt.value || undefined })}
            >
              <span class="nav-icon">{opt.icon}</span>
              {opt.label}
            </button>
          {/each}
        </div>
      {/if}
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

  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .close-btn {
    display: none;
    padding: 8px;
    background: transparent;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    transition: var(--transition);
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .logo {
    font-size: 28px;
  }

  .sidebar-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .user-info {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .avatar-placeholder {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 18px;
    color: white;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .username {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-badge {
    font-size: 12px;
    color: var(--text-muted);
  }

  .sidebar-nav {
    flex: 1;
    padding: 16px 0;
    overflow-y: auto;
  }

  .nav-section {
    padding: 0 12px;
    margin-bottom: 20px;
  }

  .nav-title {
    display: block;
    padding: 8px 12px;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .nav-item {
    width: 100%;
    padding: 12px 14px;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: var(--transition);
    margin-bottom: 4px;
  }

  .nav-item:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--primary);
    color: white;
  }

  .nav-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .badge {
    margin-left: auto;
    background: var(--bg-tertiary);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .nav-item.active .badge {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);
  }

  .logout-btn {
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .logout-btn:hover {
    background: var(--danger);
    border-color: var(--danger);
    color: white;
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      box-shadow: var(--shadow-lg);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .close-btn {
      display: flex;
    }
  }
</style>
