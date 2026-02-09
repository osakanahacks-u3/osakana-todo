<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, tasks, groups, users, exportTasks } from '../lib/api';
  import TaskList from './TaskList.svelte';
  import TaskForm from './TaskForm.svelte';
  import TaskDetail from './TaskDetail.svelte';
  import GroupManager from './GroupManager.svelte';
  import Sidebar from './Sidebar.svelte';

  let currentUser = $state<any>(null);
  let loading = $state(true);
  let activeView = $state<'tasks' | 'groups'>('tasks');
  let taskFilter = $state<{ status?: string; assignedUserId?: string; priority?: string; assignedType?: string; sort?: string; sortOrder?: string }>({});
  let showTaskForm = $state(false);
  let selectedTaskId = $state<string | null>(null);
  let stats = $state<any>(null);
  let allUsers = $state<any[]>([]);
  let allGroups = $state<any[]>([]);
  let sidebarOpen = $state(false);
  let showExportMenu = $state(false);
  let filterBarOpen = $state(false);
  let showImportConfirm = $state(false);
  let importData = $state<any>(null);
  let importLoading = $state(false);
  let importFileInput = $state<HTMLInputElement | null>(null);

  onMount(async () => {
    if (!auth.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }

    try {
      const session = await auth.checkSession();
      if (!session?.valid) {
        window.location.href = '/login';
        return;
      }
      currentUser = session.user;
      await loadData();
    } catch (e) {
      window.location.href = '/login';
    } finally {
      loading = false;
    }
  });

  async function loadData() {
    const [statsData, usersData, groupsData] = await Promise.all([
      tasks.getStats(),
      users.getAll().catch(() => []),
      groups.getAll().catch(() => [])
    ]);
    stats = statsData;
    allUsers = usersData;
    allGroups = groupsData;
  }

  async function handleLogout() {
    await auth.logout();
    window.location.href = '/login';
  }

  let taskListVersion = $state(0);

  function handleTaskCreated() {
    showTaskForm = false;
    taskListVersion++;
    refreshStats();
  }

  function handleTaskUpdated() {
    taskListVersion++;
    refreshStats();
  }

  function handleTaskClosed() {
    selectedTaskId = null;
  }

  async function refreshStats() {
    try {
      stats = await tasks.getStats();
    } catch (e) {
      console.error('Failed to refresh stats:', e);
    }
  }

  async function handleExport(format: 'txt' | 'csv' | 'json') {
    showExportMenu = false;
    try {
      const data = format === 'txt' 
        ? await exportTasks.asTxt(taskFilter)
        : format === 'csv'
        ? await exportTasks.asCsv(taskFilter)
        : await exportTasks.asJson(taskFilter);
      
      const mimeType = format === 'json' 
        ? 'application/json' 
        : format === 'csv' 
        ? 'text/csv' 
        : 'text/plain';
      
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      exportTasks.downloadFile(content, `tasks.${format}`, mimeType);
    } catch (e) {
      console.error('Export failed:', e);
    }
  }

  function handleImportClick() {
    showExportMenu = false;
    importFileInput?.click();
  }

  async function handleImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('JSONファイルのみインポートできます');
      input.value = '';
      return;
    }

    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const data = JSON.parse(text);
      if (!data.tasks || !Array.isArray(data.tasks)) {
        alert('無効なファイル形式です。tasks 配列が必要です');
        input.value = '';
        return;
      }
      importData = data;
      showImportConfirm = true;
    } catch (e) {
      alert('JSONの解析に失敗しました');
    }
    input.value = '';
  }

  async function executeImport() {
    if (!importData) return;
    importLoading = true;
    try {
      const result = await exportTasks.importJson(importData);
      showImportConfirm = false;
      importData = null;
      taskListVersion++;
      await refreshStats();
      alert(`✅ ${result.imported}件のタスクをインポートしました`);
    } catch (e: any) {
      alert(`インポートエラー: ${e.message}`);
    } finally {
      importLoading = false;
    }
  }

  function cancelImport() {
    showImportConfirm = false;
    importData = null;
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function closeSidebar() {
    sidebarOpen = false;
  }

  function setSort(sort: string) {
    if (taskFilter.sort === sort) {
      // 同じソートを再度押したら解除
      const { sort: _, sortOrder: __, ...rest } = taskFilter;
      taskFilter = rest;
    } else {
      taskFilter = { ...taskFilter, sort, sortOrder: taskFilter.sortOrder || 'desc' };
    }
  }

  function setSortOrder(order: string) {
    taskFilter = { ...taskFilter, sortOrder: order };
  }

  function setStatus(status: string) {
    if (taskFilter.status === status) {
      const { status: _, ...rest } = taskFilter;
      taskFilter = rest;
    } else {
      taskFilter = { ...taskFilter, status };
    }
  }

  function setPriority(priority: string) {
    if (taskFilter.priority === priority) {
      const { priority: _, ...rest } = taskFilter;
      taskFilter = rest;
    } else {
      taskFilter = { ...taskFilter, priority };
    }
  }

  function toggleMyTasks() {
    if (taskFilter.assignedUserId === 'me') {
      const { assignedUserId: _, ...rest } = taskFilter;
      taskFilter = rest;
    } else {
      taskFilter = { ...taskFilter, assignedUserId: 'me' };
    }
  }

  function clearFilters() {
    taskFilter = {};
  }

  // アクティブフィルターの数
  let activeFilterCount = $derived(
    (taskFilter.status ? 1 : 0) +
    (taskFilter.priority ? 1 : 0) +
    (taskFilter.assignedUserId ? 1 : 0) +
    (taskFilter.sort ? 1 : 0)
  );

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
</script>

{#if loading}
  <div class="loading-screen">
    <div class="spinner"></div>
    <p>読み込み中...</p>
  </div>
{:else}
  <div class="dashboard" class:sidebar-open={sidebarOpen}>
    {#if sidebarOpen}
      <div class="sidebar-overlay" onclick={closeSidebar} onkeydown={(e) => e.key === 'Escape' && closeSidebar()} role="button" tabindex="-1" aria-label="サイドバーを閉じる"></div>
    {/if}

    <Sidebar
      {currentUser}
      {activeView}
      isOpen={sidebarOpen}
      onViewChange={(view) => { activeView = view; closeSidebar(); }}
      onLogout={handleLogout}
      onClose={closeSidebar}
    />

    <main class="main-content">
      <header class="main-header">
        <div class="header-left">
          <button class="menu-toggle" onclick={toggleSidebar} aria-label="メニュー">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1>
            {#if activeView === 'tasks'}
              📋 タスク
            {:else}
              👥 グループ
            {/if}
          </h1>
          {#if activeView === 'tasks' && stats}
            <span class="stats-badge">{stats.total ?? 0}</span>
          {/if}
        </div>
        <div class="header-actions">
          {#if activeView === 'tasks'}
            <button class="btn btn-primary" onclick={() => showTaskForm = true}>
              <span class="btn-icon">➕</span>
              <span class="btn-text">新規</span>
            </button>
            <div class="export-dropdown">
              <button class="btn btn-secondary" onclick={() => showExportMenu = !showExportMenu}>
                <span class="btn-icon">📥</span>
                <span class="btn-text">出力</span>
              </button>
              {#if showExportMenu}
                <div class="dropdown-menu">
                  <button onclick={() => handleExport('txt')}>📄 TXT形式</button>
                  <button onclick={() => handleExport('csv')}>📊 CSV形式</button>
                  <button onclick={() => handleExport('json')}>📋 JSON形式</button>
                  <div class="dropdown-divider"></div>
                  <button onclick={handleImportClick}>📤 インポート</button>
                </div>
              {/if}
            </div>
            <input 
              type="file" 
              accept=".json" 
              class="hidden-input" 
              bind:this={importFileInput}
              onchange={handleImportFile}
            />
          {/if}
        </div>
      </header>

      {#if activeView === 'tasks'}
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <div class="filter-row-main">
            <!-- Sort Toggle -->
            <div class="sort-group">
              <button 
                class="sort-btn" 
                class:active={!taskFilter.sort || taskFilter.sort === 'id'} 
                onclick={() => setSort('id')}
                title="ID順"
              >
                🔢 ID順
              </button>
              <button 
                class="sort-btn" 
                class:active={taskFilter.sort === 'priority'} 
                onclick={() => setSort('priority')}
                title="優先度順"
              >
                🔥 優先度順
              </button>
              <button 
                class="sort-order-btn" 
                class:active={taskFilter.sortOrder === 'asc'}
                onclick={() => setSortOrder(taskFilter.sortOrder === 'asc' ? 'desc' : 'asc')}
                title={taskFilter.sortOrder === 'asc' ? '昇順（クリックで降順に）' : '降順（クリックで昇順に）'}
              >
                {taskFilter.sortOrder === 'asc' ? '⬆️ 昇順' : '⬇️ 降順'}
              </button>
            </div>

            <div class="filter-right">
              <!-- My Tasks Toggle -->
              <button 
                class="chip-btn my-tasks-btn" 
                class:active={taskFilter.assignedUserId === 'me'}
                onclick={toggleMyTasks}
              >
                👤 自分のタスク
              </button>

              <!-- Filter Toggle Button -->
              <button 
                class="filter-toggle-btn" 
                class:active={filterBarOpen}
                onclick={() => filterBarOpen = !filterBarOpen}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                <span>フィルター</span>
                {#if activeFilterCount > (taskFilter.sort ? 1 : 0) + (taskFilter.assignedUserId ? 1 : 0)}
                  <span class="filter-count">{activeFilterCount - (taskFilter.sort ? 1 : 0) - (taskFilter.assignedUserId ? 1 : 0)}</span>
                {/if}
              </button>

              {#if activeFilterCount > 0}
                <button class="clear-btn" onclick={clearFilters} title="フィルター解除">
                  ✕
                </button>
              {/if}
            </div>
          </div>

          {#if filterBarOpen}
            <div class="filter-row-detail">
              <div class="filter-section">
                <span class="filter-label">ステータス</span>
                <div class="chip-group">
                  {#each STATUS_OPTIONS as opt}
                    <button 
                      class="chip-btn" 
                      class:active={taskFilter.status === opt.value}
                      onclick={() => setStatus(opt.value)}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  {/each}
                </div>
              </div>
              <div class="filter-section">
                <span class="filter-label">優先度</span>
                <div class="chip-group">
                  {#each PRIORITY_OPTIONS as opt}
                    <button 
                      class="chip-btn" 
                      class:active={taskFilter.priority === opt.value}
                      onclick={() => setPriority(opt.value)}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="content-area scroll-container">
        {#if activeView === 'tasks'}
          <TaskList 
            filter={taskFilter}
            version={taskListVersion}
            onSelect={(id) => selectedTaskId = id}
            onRefresh={refreshStats}
          />
        {:else}
          <GroupManager 
            {allUsers}
            onRefresh={loadData}
          />
        {/if}
      </div>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-nav safe-area-bottom">
        <button 
          class="mobile-nav-item" 
          class:active={activeView === 'tasks'}
          onclick={() => activeView = 'tasks'}
        >
          <span class="nav-icon">📋</span>
          <span class="nav-label">タスク</span>
        </button>
        <button 
          class="mobile-nav-fab"
          onclick={() => showTaskForm = true}
          aria-label="新規タスク"
        >
          <span>➕</span>
        </button>
        <button 
          class="mobile-nav-item"
          class:active={activeView === 'groups'}
          onclick={() => activeView = 'groups'}
        >
          <span class="nav-icon">👥</span>
          <span class="nav-label">グループ</span>
        </button>
      </nav>
    </main>

    {#if showTaskForm}
      <TaskForm
        {allUsers}
        {allGroups}
        onClose={() => showTaskForm = false}
        onCreated={handleTaskCreated}
      />
    {/if}

    {#if selectedTaskId}
      <TaskDetail
        taskId={selectedTaskId}
        {allUsers}
        {allGroups}
        {currentUser}
        onClose={handleTaskClosed}
        onUpdated={handleTaskUpdated}
      />
    {/if}

    {#if showImportConfirm}
      <div class="modal-overlay" onclick={cancelImport} onkeydown={(e) => e.key === 'Escape' && cancelImport()} role="dialog" tabindex="-1">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="import-confirm-modal" onclick={(e) => e.stopPropagation()} role="document">
          <div class="import-warning-icon">⚠️</div>
          <h3>インポート確認</h3>
          <p class="import-warning-text">
            <strong>この操作は既存のすべてのタスクを削除し、インポートデータで上書きします。</strong><br>
            この操作は取り消せません。
          </p>
          <div class="import-stats">
            <div class="import-stat">
              <span class="import-stat-icon">🗑️</span>
              <span>削除されるタスク: <strong>{stats?.total ?? 0}件</strong></span>
            </div>
            <div class="import-stat">
              <span class="import-stat-icon">📥</span>
              <span>インポートされるタスク: <strong>{importData?.tasks?.length ?? 0}件</strong></span>
            </div>
          </div>
          <div class="import-actions">
            <button class="btn btn-danger" onclick={executeImport} disabled={importLoading}>
              {#if importLoading}
                ⏳ 処理中...
              {:else}
                ⚠️ はい、インポートする
              {/if}
            </button>
            <button class="btn btn-secondary" onclick={cancelImport} disabled={importLoading}>
              ❌ いいえ、キャンセル
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .loading-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--bg-primary);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .dashboard {
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    position: relative;
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 90;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    min-height: var(--header-height);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .menu-toggle {
    display: none;
    padding: 8px;
    background: transparent;
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    transition: var(--transition);
  }
  .menu-toggle:hover { background: var(--bg-tertiary); }

  .main-header h1 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .stats-badge {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 20px;
    border: 1px solid var(--border-color);
  }

  .header-actions {
    display: flex;
    gap: 10px;
  }

  .btn {
    padding: 10px 16px;
    border: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: var(--transition);
    cursor: pointer;
  }
  .btn-icon { font-size: 16px; }

  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .btn-secondary:hover { background: var(--border-color); }

  .export-dropdown { position: relative; }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 6px;
    z-index: 100;
    min-width: 140px;
    box-shadow: var(--shadow);
  }
  .dropdown-menu button {
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 14px;
    text-align: left;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition);
  }
  .dropdown-menu button:hover { background: var(--bg-tertiary); }

  /* ===== Filter Toolbar ===== */
  .filter-toolbar {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 10px 24px;
  }

  .filter-row-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sort-group {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .sort-btn {
    padding: 7px 14px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    white-space: nowrap;
  }
  .sort-btn:not(:last-child) { border-right: 1px solid var(--border-color); }
  .sort-btn.active {
    background: var(--primary);
    color: white;
  }
  .sort-btn:not(.active):hover {
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .sort-order-btn {
    padding: 7px 14px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    white-space: nowrap;
    border-radius: 0 var(--radius) var(--radius) 0;
  }
  .sort-order-btn:hover {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  .sort-order-btn.active {
    background: var(--primary-light, rgba(88, 101, 242, 0.15));
    color: var(--primary);
  }

  .filter-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip-btn {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    white-space: nowrap;
  }
  .chip-btn:hover { border-color: var(--primary); color: var(--text-primary); }
  .chip-btn.active {
    background: var(--primary);
    border-color: var(--primary);
    color: white;
  }

  .my-tasks-btn { font-size: 13px; }

  .filter-toggle-btn {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .filter-toggle-btn:hover { border-color: var(--primary); color: var(--text-primary); }
  .filter-toggle-btn.active {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(88, 101, 242, 0.1);
  }

  .filter-count {
    background: var(--primary);
    color: white;
    font-size: 10px;
    font-weight: 700;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-btn {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: var(--transition);
  }
  .clear-btn:hover { background: var(--danger); border-color: var(--danger); color: white; }

  .filter-row-detail {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .filter-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    min-width: 64px;
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .content-area {
    flex: 1;
    padding: 20px 24px;
    overflow-y: auto;
  }

  /* Mobile Navigation */
  .mobile-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    height: var(--mobile-nav-height);
    padding: 0 16px;
    z-index: 80;
  }

  .mobile-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: transparent;
    color: var(--text-muted);
    padding: 8px;
    transition: var(--transition);
    border: none;
    cursor: pointer;
  }
  .mobile-nav-item.active { color: var(--primary); }
  .nav-icon { font-size: 20px; }
  .nav-label { font-size: 11px; font-weight: 500; }

  .mobile-nav-fab {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: -20px;
    box-shadow: var(--shadow);
    transition: var(--transition);
    border: none;
    cursor: pointer;
  }
  .mobile-nav-fab:hover { background: var(--primary-dark); transform: scale(1.05); }

  /* Tablet & Mobile */
  @media (max-width: 1024px) {
    .content-area { padding: 16px 20px; }
    .filter-toolbar { padding: 10px 20px; }
  }

  @media (max-width: 768px) {
    .sidebar-overlay {
      display: block;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .dashboard.sidebar-open .sidebar-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    .menu-toggle { display: flex; }

    .main-header { padding: 12px 16px; }
    .main-header h1 { font-size: 1.1rem; }
    .header-actions { gap: 8px; }
    .btn { padding: 8px 12px; font-size: 13px; }
    .btn-text { display: none; }

    .filter-toolbar { padding: 10px 16px; }
    .filter-row-main { gap: 8px; }
    .sort-btn { padding: 6px 10px; font-size: 12px; }
    .sort-order-btn { padding: 6px 10px; font-size: 12px; }
    .my-tasks-btn { font-size: 12px; }
    .filter-toggle-btn span { display: none; }
    .filter-toggle-btn svg { display: block; }
    .filter-toggle-btn { padding: 6px 10px; }

    .content-area {
      padding: 16px;
      padding-bottom: calc(var(--mobile-nav-height) + 20px);
    }

    .mobile-nav {
      display: flex;
      align-items: center;
      justify-content: space-around;
    }

    .filter-section { gap: 8px; }
    .filter-label { min-width: 50px; font-size: 11px; }
    .chip-btn { padding: 5px 10px; font-size: 11px; }
  }

  @media (max-width: 480px) {
    .main-header h1 { font-size: 1rem; }
    .sort-btn { padding: 5px 8px; font-size: 11px; }
    .sort-order-btn { padding: 5px 8px; font-size: 11px; }
  }

  /* Hidden file input */
  .hidden-input {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  /* Dropdown divider */
  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
    margin: 4px 0;
  }

  /* Import Confirm Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }

  .import-confirm-modal {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 32px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
  }

  .import-warning-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .import-confirm-modal h3 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 12px;
    color: var(--text-primary);
  }

  .import-warning-text {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 20px;
  }

  .import-stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    text-align: left;
  }

  .import-stat {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-primary);
  }

  .import-stat-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .import-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-danger {
    background: var(--danger);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
  }

  .btn-danger:hover:not(:disabled) {
    background: #c33;
  }

  .btn-danger:disabled,
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .import-confirm-modal {
      padding: 24px 20px;
    }

    .import-actions {
      flex-direction: column;
    }
  }
</style>
