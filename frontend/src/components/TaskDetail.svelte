<script lang="ts">
  import { onMount } from 'svelte';
  import { tasks } from '../lib/api';

  interface Props {
    taskId: string;
    allUsers: any[];
    allGroups: any[];
    currentUser: any;
    onClose: () => void;
    onUpdated: () => void;
  }

  let { taskId, allUsers, allGroups, currentUser, onClose, onUpdated }: Props = $props();

  let task = $state<any>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let newComment = $state('');
  let editMode = $state(false);

  // 編集用フィールド
  let editTitle = $state('');
  let editDescription = $state('');
  let editPriority = $state('medium');
  let editDueDate = $state('');
  let editAssignType = $state<'none' | 'mixed' | 'all'>('none');
  let editAssignedUserIds = $state<string[]>([]);
  let editAssignedGroupIds = $state<string[]>([]);

  // 表示モード用クイック割り当て
  let quickAssignType = $state<'none' | 'mixed' | 'all'>('none');
  let quickAssignUserIds = $state<string[]>([]);
  let quickAssignGroupIds = $state<string[]>([]);

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
    high: '🔴 高'
  };

  onMount(() => {
    loadTask();
  });

  async function loadTask() {
    loading = true;
    try {
      task = await tasks.get(taskId);
      initEditFields();
      initQuickAssign();
    } catch (e: any) {
      error = e.message || 'タスクの読み込みに失敗しました';
    } finally {
      loading = false;
    }
  }

  function initEditFields() {
    if (!task) return;
    editTitle = task.title;
    editDescription = task.description || '';
    editPriority = task.priority;
    editDueDate = task.due_date ? task.due_date.split('T')[0] : '';
    
    const hasUsers = task.assigned_users && task.assigned_users.length > 0;
    const hasGroups = task.assigned_groups && task.assigned_groups.length > 0;

    if (task.assigned_type === 'all') {
      editAssignType = 'all';
      editAssignedUserIds = [];
      editAssignedGroupIds = [];
    } else if (hasUsers || hasGroups) {
      editAssignType = 'mixed';
      editAssignedUserIds = hasUsers ? task.assigned_users.map((u: any) => String(u.id)) : [];
      editAssignedGroupIds = hasGroups ? task.assigned_groups.map((g: any) => String(g.id)) : [];
    } else if (task.assigned_group_id) {
      editAssignType = 'mixed';
      editAssignedUserIds = [];
      editAssignedGroupIds = [String(task.assigned_group_id)];
    } else {
      editAssignType = 'none';
      editAssignedUserIds = [];
      editAssignedGroupIds = [];
    }
  }

  function initQuickAssign() {
    if (!task) return;
    const hasUsers = task.assigned_users && task.assigned_users.length > 0;
    const hasGroups = task.assigned_groups && task.assigned_groups.length > 0;

    if (task.assigned_type === 'all') {
      quickAssignType = 'all';
      quickAssignUserIds = [];
      quickAssignGroupIds = [];
    } else if (hasUsers || hasGroups) {
      quickAssignType = 'mixed';
      quickAssignUserIds = hasUsers ? task.assigned_users.map((u: any) => String(u.id)) : [];
      quickAssignGroupIds = hasGroups ? task.assigned_groups.map((g: any) => String(g.id)) : [];
    } else if (task.assigned_group_id) {
      quickAssignType = 'mixed';
      quickAssignUserIds = [];
      quickAssignGroupIds = [String(task.assigned_group_id)];
    } else {
      quickAssignType = 'none';
      quickAssignUserIds = [];
      quickAssignGroupIds = [];
    }
  }

  async function handleQuickAssignType() {
    if (quickAssignType === 'none' || quickAssignType === 'all') {
      quickAssignUserIds = [];
      quickAssignGroupIds = [];
      await saveQuickAssign();
    }
  }

  function toggleQuickAssignUser(userId: string) {
    if (quickAssignUserIds.includes(userId)) {
      quickAssignUserIds = quickAssignUserIds.filter(id => id !== userId);
    } else {
      quickAssignUserIds = [...quickAssignUserIds, userId];
    }
  }

  function toggleQuickAssignGroup(groupId: string) {
    if (quickAssignGroupIds.includes(groupId)) {
      quickAssignGroupIds = quickAssignGroupIds.filter(id => id !== groupId);
    } else {
      quickAssignGroupIds = [...quickAssignGroupIds, groupId];
    }
  }

  async function applyQuickAssignUsers() {
    await saveQuickAssign();
  }

  async function saveQuickAssign() {
    try {
      let resolvedType: string | null = null;
      if (quickAssignType === 'all') resolvedType = 'all';
      else if (quickAssignType === 'mixed') {
        if (quickAssignUserIds.length > 0) resolvedType = 'user';
        else if (quickAssignGroupIds.length > 0) resolvedType = 'group';
      }

      await tasks.update(taskId, {
        assignedType: resolvedType,
        assignedUserIds: quickAssignType === 'mixed' ? quickAssignUserIds : [],
        assignedGroupIds: quickAssignType === 'mixed' ? quickAssignGroupIds : [],
      });
      task = await tasks.get(taskId);
      initQuickAssign();
      onUpdated();
    } catch (e: any) {
      console.error('Failed to update assignment:', e);
    }
  }

  async function handleSave() {
    if (!editTitle.trim()) {
      error = 'タイトルを入力してください';
      return;
    }

    saving = true;
    error = '';

    try {
      await tasks.update(taskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        dueDate: editDueDate || null,
        assignedType: editAssignType === 'none' ? null : (editAssignType === 'all' ? 'all' : (editAssignedUserIds.length > 0 ? 'user' : (editAssignedGroupIds.length > 0 ? 'group' : null))),
        assignedUserIds: editAssignType === 'mixed' ? editAssignedUserIds : [],
        assignedGroupIds: editAssignType === 'mixed' ? editAssignedGroupIds : [],
      });
      // 編集モードを解除し、タスクを再取得してインプレースで反映
      editMode = false;
      task = await tasks.get(taskId);
      initEditFields();
      initQuickAssign();
      onUpdated();
    } catch (e: any) {
      error = e.message || '更新に失敗しました';
    } finally {
      saving = false;
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      await tasks.update(taskId, { status: newStatus });
      task = await tasks.get(taskId);
      onUpdated();
    } catch (e: any) {
      console.error('Failed to update status:', e);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;

    try {
      task.comments = await tasks.addComment(taskId, newComment.trim());
      newComment = '';
    } catch (e: any) {
      console.error('Failed to add comment:', e);
    }
  }

  async function handleDelete() {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      await tasks.delete(taskId);
      onUpdated();
      onClose();
    } catch (e: any) {
      console.error('Failed to delete:', e);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '未設定';
    return new Date(dateStr).toLocaleString('ja-JP');
  }

  function getAssignee(): string {
    if (!task) return '';
    if (task.assigned_type === 'all') return '👥 全員';
    const parts: string[] = [];
    if (task.assigned_users && task.assigned_users.length > 0) {
      parts.push(...task.assigned_users.map((u: any) => `👤 ${u.username}`));
    }
    if (task.assigned_groups && task.assigned_groups.length > 0) {
      parts.push(...task.assigned_groups.map((g: any) => `📁 ${g.name}`));
    }
    if (parts.length > 0) return parts.join(', ');
    if (task.assigned_user_name) return `👤 ${task.assigned_user_name}`;
    if (task.assigned_group_name) return `📁 ${task.assigned_group_name}`;
    return '未割当';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>読み込み中...</p>
      </div>
    {:else if error && !task}
      <div class="error-state">
        <p>❌ {error}</p>
        <button onclick={onClose}>閉じる</button>
      </div>
    {:else if task}
      <div class="modal-header">
        <div class="header-info">
          <span class="task-id">#{task.id}</span>
          {#if !editMode}
            <h2 id="task-detail-title">{task.title}</h2>
          {/if}
        </div>
        <div class="header-actions">
          {#if !editMode}
            <button class="btn-icon" onclick={() => editMode = true} title="編集">✏️</button>
            <button class="btn-icon danger" onclick={handleDelete} title="削除">🗑️</button>
          {/if}
          <button class="close-btn" onclick={onClose}>✕</button>
        </div>
      </div>

      <div class="modal-body">
        {#if error}
          <div class="error-message">{error}</div>
        {/if}

        {#if editMode}
          <!-- 編集モード -->
          <div class="form-group">
            <label for="edit-title">タイトル</label>
            <input id="edit-title" type="text" bind:value={editTitle} disabled={saving} />
          </div>

          <div class="form-group">
            <label for="edit-description">説明</label>
            <textarea id="edit-description" bind:value={editDescription} rows="4" disabled={saving}></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-priority">優先度</label>
              <select id="edit-priority" bind:value={editPriority} disabled={saving}>
                <option value="low">🟢 低</option>
                <option value="medium">🟡 中</option>
                <option value="high">🟠 高</option>
                <option value="urgent">🔴 緊急</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-due-date">期限</label>
              <input id="edit-due-date" type="date" bind:value={editDueDate} disabled={saving} />
            </div>
          </div>

          <div class="form-group">
            <span class="field-label">担当</span>
            <div class="assign-options">
              <label><input type="radio" bind:group={editAssignType} value="none" /> 未割当</label>
              <label><input type="radio" bind:group={editAssignType} value="all" /> 全員</label>
              <label><input type="radio" bind:group={editAssignType} value="mixed" /> ユーザー / グループ</label>
            </div>
          </div>

          {#if editAssignType === 'mixed'}
            <div class="form-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>👤 担当ユーザー（複数選択可）</label>
              <div class="user-checkboxes">
                {#each allUsers as user}
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editAssignedUserIds.includes(String(user.id))}
                      onchange={() => {
                        const uid = String(user.id);
                        if (editAssignedUserIds.includes(uid)) {
                          editAssignedUserIds = editAssignedUserIds.filter(id => id !== uid);
                        } else {
                          editAssignedUserIds = [...editAssignedUserIds, uid];
                        }
                      }}
                      disabled={saving}
                    />
                    {user.username}
                  </label>
                {/each}
              </div>
            </div>
            {#if allGroups.length > 0}
              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>📁 担当グループ（複数選択可）</label>
                <div class="user-checkboxes">
                  {#each allGroups as group}
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editAssignedGroupIds.includes(String(group.id))}
                        onchange={() => {
                          const gid = String(group.id);
                          if (editAssignedGroupIds.includes(gid)) {
                            editAssignedGroupIds = editAssignedGroupIds.filter(id => id !== gid);
                          } else {
                            editAssignedGroupIds = [...editAssignedGroupIds, gid];
                          }
                        }}
                        disabled={saving}
                      />
                      {group.name}
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}

          <div class="edit-actions">
            <button class="btn btn-secondary" onclick={() => { editMode = false; initEditFields(); }} disabled={saving}>
              キャンセル
            </button>
            <button class="btn btn-primary" onclick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        {:else}
          <!-- 表示モード -->
          <div class="detail-section">
            <div class="status-section">
              <label for="task-status">ステータス</label>
              <select id="task-status" value={task.status} onchange={(e) => handleStatusChange(e.currentTarget.value)}>
                <option value="pending">⏳ 未処理</option>
                <option value="in_progress">🔄 処理中</option>
                <option value="on_hold">⏸️ 保留</option>
                <option value="completed">✅ 完了</option>
                <option value="other">📌 その他</option>
              </select>
            </div>

            {#if task.description}
              <div class="detail-item">
                <span class="detail-label">説明</span>
                <p class="description">{task.description}</p>
              </div>
            {/if}

            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">優先度</span>
                <span>{PRIORITY_LABELS[task.priority]}</span>
              </div>
              <div class="detail-item assign-item">
                <span class="detail-label">担当</span>
                <div class="quick-assign-controls">
                  <select bind:value={quickAssignType} onchange={handleQuickAssignType}>
                    <option value="none">未割当</option>
                    <option value="all">👥 全員</option>
                    <option value="mixed">👤 ユーザー / 📁 グループ</option>
                  </select>
                  {#if quickAssignType === 'mixed'}
                    <div class="quick-assign-users">
                      <span class="quick-assign-section-label">👤 ユーザー</span>
                      {#each allUsers as user}
                        <label class="checkbox-label-small">
                          <input
                            type="checkbox"
                            checked={quickAssignUserIds.includes(String(user.id))}
                            onchange={() => toggleQuickAssignUser(String(user.id))}
                          />
                          {user.username}
                        </label>
                      {/each}
                      {#if allGroups.length > 0}
                        <span class="quick-assign-section-label">📁 グループ</span>
                        {#each allGroups as group}
                          <label class="checkbox-label-small">
                            <input
                              type="checkbox"
                              checked={quickAssignGroupIds.includes(String(group.id))}
                              onchange={() => toggleQuickAssignGroup(String(group.id))}
                            />
                            {group.name}
                          </label>
                        {/each}
                      {/if}
                      <button class="btn btn-small btn-primary" onclick={applyQuickAssignUsers}>適用</button>
                    </div>
                  {/if}
                </div>
              </div>
              <div class="detail-item">
                <span class="detail-label">作成者</span>
                <span>{task.creator_name || '不明'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">作成日</span>
                <span>{formatDate(task.created_at)}</span>
              </div>
              {#if task.due_date}
                <div class="detail-item">
                  <span class="detail-label">期限</span>
                  <span>{formatDate(task.due_date)}</span>
                </div>
              {/if}
              {#if task.completed_at}
                <div class="detail-item">
                  <span class="detail-label">完了日</span>
                  <span>{formatDate(task.completed_at)}</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- コメント -->
          <div class="comments-section">
            <h3>💬 コメント</h3>
            
            {#if task.comments && task.comments.length > 0}
              <div class="comments-list">
                {#each task.comments as comment}
                  <div class="comment">
                    <div class="comment-header">
                      <span class="comment-author">{comment.username || '匿名'}</span>
                      <span class="comment-date">{formatDate(comment.created_at)}</span>
                    </div>
                    <p class="comment-content">{comment.content}</p>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="no-comments">コメントはありません</p>
            {/if}

            {#if currentUser}
              <div class="comment-form">
                <textarea
                  bind:value={newComment}
                  placeholder="コメントを入力..."
                  rows="2"
                ></textarea>
                <button class="btn btn-primary" onclick={handleAddComment} disabled={!newComment.trim()}>
                  送信
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-secondary);
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .loading, .error-state {
    padding: 60px;
    text-align: center;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .header-info {
    flex: 1;
  }

  .task-id {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .header-info h2 {
    font-size: 18px;
    margin-top: 4px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--bg-tertiary);
  }

  .btn-icon.danger:hover {
    background: var(--danger);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
    border-radius: 8px;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 24px;
  }

  .error-message {
    background: rgba(231, 76, 60, 0.2);
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  input, textarea, select {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--primary);
  }

  .assign-options {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .assign-options label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    text-transform: none;
    font-weight: normal;
    color: var(--text-primary);
    cursor: pointer;
  }

  .assign-options input {
    width: auto;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 10px 18px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .detail-section {
    margin-bottom: 24px;
  }

  .status-section {
    margin-bottom: 20px;
  }

  .status-section select {
    font-size: 16px;
    font-weight: 500;
  }

  .detail-item {
    margin-bottom: 16px;
  }

  .detail-item span, .detail-item p {
    font-size: 14px;
    color: var(--text-primary);
  }

  .detail-label, .field-label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
    font-weight: 500;
  }

  .description {
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .assign-item {
    grid-column: 1 / -1;
  }

  .quick-assign-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .quick-assign-controls select {
    padding: 8px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 13px;
    flex: 1;
    min-width: 120px;
  }

  .quick-assign-controls select:focus {
    outline: none;
    border-color: var(--primary);
  }

  .quick-assign-users {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    max-height: 150px;
    overflow-y: auto;
    width: 100%;
    align-items: center;
  }

  .checkbox-label-small {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 12px;
    padding: 3px 6px;
    background: var(--bg-secondary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
    white-space: nowrap;
  }

  .checkbox-label-small:hover {
    border-color: var(--primary);
  }

  .checkbox-label-small input {
    width: auto;
  }

  .btn-small {
    padding: 4px 10px;
    font-size: 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .user-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 180px;
    overflow-y: auto;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
    transition: all 0.2s;
  }

  .checkbox-label:hover {
    border-color: var(--primary);
  }

  .checkbox-label input {
    width: auto;
  }

  .comments-section {
    border-top: 1px solid var(--border-color);
    padding-top: 20px;
  }

  .comments-section h3 {
    font-size: 14px;
    margin-bottom: 16px;
  }

  .no-comments {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .comments-list {
    margin-bottom: 16px;
  }

  .comment {
    background: var(--bg-tertiary);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .comment-author {
    font-weight: 500;
    font-size: 13px;
  }

  .comment-date {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .comment-content {
    font-size: 14px;
    line-height: 1.5;
  }

  .comment-form {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .comment-form textarea {
    flex: 1;
    resize: none;
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 0;
      align-items: flex-end;
    }

    .modal {
      max-width: 100%;
      max-height: 95vh;
      max-height: 95dvh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .modal-header {
      padding: 18px 20px;
      position: sticky;
      top: 0;
      background: var(--bg-secondary);
      z-index: 10;
      border-bottom: 1px solid var(--border-color);
    }

    .header-info h2 {
      font-size: 1.125rem;
    }

    .btn-icon {
      width: 40px;
      height: 40px;
      font-size: 18px;
    }

    .close-btn {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }

    .modal-body {
      padding: 20px;
    }

    .form-row {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    label {
      font-size: 13px;
    }

    input, textarea, select {
      padding: 14px 16px;
      font-size: 16px;
      min-height: 48px;
    }

    textarea {
      min-height: 100px;
    }

    .assign-options {
      gap: 14px;
    }

    .assign-options label {
      font-size: 15px;
      min-height: 44px;
    }

    .edit-actions {
      gap: 12px;
      position: sticky;
      bottom: 0;
      background: var(--bg-secondary);
      padding: 16px 0 0 0;
      margin-top: 24px;
    }

    .btn {
      flex: 1;
      padding: 14px 24px;
      font-size: 16px;
      min-height: 48px;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }

    .detail-item span, .detail-item p {
      font-size: 15px;
    }

    .status-section select {
      min-height: 48px;
      padding: 14px 16px;
      font-size: 16px;
    }

    .quick-assign-controls {
      flex-direction: column;
      gap: 12px;
    }

    .quick-assign-controls select {
      width: 100%;
      padding: 14px 16px;
      font-size: 16px;
      min-height: 48px;
    }

    .quick-assign-users {
      padding: 12px;
      gap: 10px;
    }

    .checkbox-label-small {
      font-size: 14px;
      padding: 8px 12px;
      min-height: 40px;
    }

    .checkbox-label-small input {
      width: 18px;
      height: 18px;
    }

    .btn-small {
      padding: 10px 16px;
      font-size: 14px;
      min-height: 44px;
    }

    .user-checkboxes {
      padding: 12px;
      gap: 10px;
    }

    .checkbox-label {
      font-size: 14px;
      padding: 8px 12px;
      min-height: 40px;
    }

    .checkbox-label input {
      width: 18px;
      height: 18px;
    }

    .comment-form {
      flex-direction: column;
      align-items: stretch;
    }

    .comment-form textarea {
      min-height: 80px;
      font-size: 16px;
    }

    .comment-form button {
      padding: 14px 24px;
      font-size: 16px;
      min-height: 48px;
    }
  }

  @media (max-width: 480px) {
    .edit-actions {
      flex-direction: column-reverse;
    }

    .btn {
      width: 100%;
    }
  }
</style>
