<script lang="ts">
  import { tasks } from '../lib/api';

  interface Props {
    filter: { status?: string; assignedUserId?: string; priority?: string; assignedType?: string; sort?: string; sortOrder?: string };
    version: number;
    onSelect: (id: string) => void;
    onRefresh: () => void;
  }

  let { filter, version, onSelect, onRefresh }: Props = $props();

  let taskList = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');

  const STATUS_LABELS: Record<string, string> = {
    pending: '⏳ 未着手',
    in_progress: '🔄 進行中',
    on_hold: '⏸️ 保留中',
    completed: '✅ 完了',
    other: '📌 その他'
  };

  const PRIORITY_LABELS: Record<string, string> = {
    low: '🟢 低',
    medium: '🟡 中',
    high: '🔴 高',
    urgent: '🚨 緊急'
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: '#FEE75C',
    in_progress: '#5865F2',
    on_hold: '#9b59b6',
    completed: '#57F287',
    other: '#95a5a6'
  };

  let loadVersion = 0;

  $effect(() => {
    // フィルターまたはバージョンの変更でリアクティブに再読み込み
    const _f = JSON.stringify(filter);
    const _v = version;
    loadTasks();
  });

  async function loadTasks() {
    const version = ++loadVersion;
    loading = true;
    error = '';
    try {
      let result;
      // 自分のタスク表示モード（assignedUserId === 'me'）なら /my API を利用して「個人+グループ+全員」を取得
      if (filter.assignedUserId === 'me') {
        const apiFilters: any = {};
        // @ts-ignore
        if (filter.priority) apiFilters.priority = filter.priority;
        // @ts-ignore
        if (filter.assignedType) apiFilters.assignedType = filter.assignedType;
        // @ts-ignore
        if (filter.status) apiFilters.status = filter.status;
        // @ts-ignore
        if (filter.sort) apiFilters.sort = filter.sort;
        if (filter.sortOrder) apiFilters.sortOrder = filter.sortOrder;
        result = await tasks.getMy(apiFilters);
      } else {
        result = await tasks.getAll(filter);
      }

      // 最新のリクエストのみ反映（レースコンディション防止）
      if (version === loadVersion) {
        taskList = result;
      }
    } catch (e: any) {
      if (version === loadVersion) {
        error = e.message || 'タスクの読み込みに失敗しました';
      }
    } finally {
      if (version === loadVersion) {
        loading = false;
      }
    }
  }


  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      await tasks.update(taskId, { status: newStatus });
      // タスク一覧をインプレース更新
      const updated = taskList.find(t => t.id === taskId);
      if (updated) {
        updated.status = newStatus;
        taskList = [...taskList];
      }
      onRefresh();
    } catch (e: any) {
      console.error('Failed to update status:', e);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      await tasks.delete(taskId);
      // リストから即座に削除
      taskList = taskList.filter(t => t.id !== taskId);
      onRefresh();
    } catch (e: any) {
      console.error('Failed to delete task:', e);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isOverdue = date < now;
    return `${isOverdue ? '⚠️ ' : ''}${date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}`;
  }

  function getAssignee(task: any): string {
    if (task.assigned_type === 'all') return '👥 全員';
    if (task.assigned_users && task.assigned_users.length > 0) {
      return task.assigned_users.map((u: any) => `👤 ${u.username}`).join(', ');
    }
    if (task.assigned_user_name) return `👤 ${task.assigned_user_name}`;
    if (task.assigned_group_name) return `📁 ${task.assigned_group_name}`;
    return '未割当';
  }
</script>

{#if loading}
  <div class="loading">
    <div class="spinner"></div>
    <p>読み込み中...</p>
  </div>
{:else if error}
  <div class="error-message">
    <p>❌ {error}</p>
    <button onclick={loadTasks}>再読み込み</button>
  </div>
{:else if taskList.length === 0}
  <div class="empty-state">
    <span class="empty-icon">📭</span>
    <h3>タスクがありません</h3>
    <p>新しいタスクを作成してみましょう</p>
  </div>
{:else}
  <div class="task-list">
    <div class="task-list-header">
      <span class="result-count">{taskList.length}件</span>
    </div>
    {#each taskList as task (task.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="task-card" class:completed={task.status === 'completed'} onclick={() => onSelect(task.id)} tabindex="0" role="button" onkeydown={(e) => e.key === 'Enter' && onSelect(task.id)}>
        <div class="task-header">
          <div class="task-header-left">
            <span class="task-id">#{task.id}</span>
            {#if task.priority}
              <span class="task-priority" title="優先度">
                {PRIORITY_LABELS[task.priority] || task.priority}
              </span>
            {/if}
          </div>
          <div class="status-badge" style="background-color: {STATUS_COLORS[task.status]}20; color: {STATUS_COLORS[task.status]}; border-color: {STATUS_COLORS[task.status]}">
            {STATUS_LABELS[task.status]?.split(' ')[0] || '📌'}
          </div>
        </div>
        
        <h3 class="task-title">{task.title}</h3>
        
        {#if task.description}
          <p class="task-description">{task.description.slice(0, 80)}{task.description.length > 80 ? '...' : ''}</p>
        {/if}

        <div class="task-meta">
          <span class="task-assignee">{getAssignee(task)}</span>
          {#if task.due_date}
            <span class="task-due" class:overdue={new Date(task.due_date) < new Date()}>📅 {formatDate(task.due_date)}</span>
          {/if}
        </div>

        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div class="task-footer" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <select 
            value={task.status}
            onchange={(e) => handleStatusChange(task.id, e.currentTarget.value)}
            class="status-select"
          >
            <option value="pending">未着手</option>
            <option value="in_progress">進行中</option>
            <option value="on_hold">保留中</option>
            <option value="completed">完了</option>
            <option value="other">その他</option>
          </select>
          <button class="btn-delete" onclick={() => handleDelete(task.id)} title="削除" aria-label="削除">
            🗑️
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    text-align: center;
    padding: 40px 20px;
    color: var(--danger);
  }

  .error-message button {
    margin-top: 12px;
    padding: 10px 20px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
  }

  .error-message button:hover {
    background: var(--primary-dark);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 72px;
    display: block;
    margin-bottom: 20px;
  }

  .empty-state h3 {
    font-size: 1.25rem;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .task-list {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }

  .task-list-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: 4px;
  }

  .result-count {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .task-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 18px;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 150px;
    -webkit-tap-highlight-color: rgba(88, 101, 242, 0.2);
  }

  .task-card.completed {
    opacity: 0.65;
  }

  .task-card:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .task-card:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .task-card:active {
    transform: translateY(0);
    opacity: 0.9;
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .task-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-id {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .task-priority {
    font-size: 12px;
    font-weight: 500;
  }

  .task-title {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--text-primary);
  }

  .task-description {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .task-due.overdue {
    color: var(--danger);
    font-weight: 600;
  }

  .task-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .status-badge {
    font-size: 14px;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid;
    font-weight: 500;
  }

  .status-select {
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
    transition: var(--transition);
    min-height: 38px;
  }

  .status-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.2);
  }

  .btn-delete {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition);
    font-size: 16px;
    min-width: 44px;
    min-height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-delete:hover {
    background: var(--danger);
    border-color: var(--danger);
  }

  .btn-delete:active {
    transform: scale(0.95);
  }

  /* Mobile */
  @media (max-width: 768px) {
    .task-list {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .task-card {
      padding: 18px;
      gap: 14px;
    }

    .task-title {
      font-size: 1rem;
      line-height: 1.5;
    }

    .task-description {
      font-size: 14px;
      line-height: 1.5;
    }

    .task-meta {
      font-size: 13px;
    }

    .task-footer {
      gap: 12px;
    }

    .status-select {
      flex: 1;
      min-width: 0;
      padding: 10px 12px;
      font-size: 15px;
      min-height: 44px;
    }

    .btn-delete {
      min-width: 50px;
      min-height: 44px;
      font-size: 18px;
    }
  }
</style>
