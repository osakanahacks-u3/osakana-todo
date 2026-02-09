<script lang="ts">
  import { tasks } from '../lib/api';

  interface Props {
    allUsers: any[];
    allGroups: any[];
    onClose: () => void;
    onCreated: () => void;
  }

  let { allUsers, allGroups, onClose, onCreated }: Props = $props();

  let title = $state('');
  let description = $state('');
  let priority = $state('medium');
  let dueDate = $state('');
  let assignType = $state<'none' | 'user' | 'group' | 'all'>('none');
  let assignedUserIds = $state<string[]>([]);
  let assignedGroupId = $state<string | null>(null);
  let loading = $state(false);
  let error = $state('');

  function toggleUserId(id: string) {
    if (assignedUserIds.includes(id)) {
      assignedUserIds = assignedUserIds.filter(uid => uid !== id);
    } else {
      assignedUserIds = [...assignedUserIds, id];
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      error = 'タイトルを入力してください';
      return;
    }

    loading = true;
    error = '';

    try {
      await tasks.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        assignedType: assignType === 'none' ? undefined : assignType,
        assignedUserIds: assignType === 'user' ? assignedUserIds : undefined,
        assignedGroupId: assignType === 'group' ? assignedGroupId ?? undefined : undefined
      });
      onCreated();
    } catch (e: any) {
      error = e.message || 'タスクの作成に失敗しました';
    } finally {
      loading = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
  <div class="modal modal-content" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
    <div class="modal-header">
      <h2 id="task-form-title">➕ 新規タスク</h2>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-group">
        <label for="title">タイトル <span class="required">*</span></label>
        <input
          id="title"
          type="text"
          bind:value={title}
          placeholder="タスクのタイトル"
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="description">説明</label>
        <textarea
          id="description"
          bind:value={description}
          placeholder="タスクの詳細説明（任意）"
          rows="3"
          disabled={loading}
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="priority">優先度</label>
          <select id="priority" bind:value={priority} disabled={loading}>
            <option value="low">🟢 低</option>
            <option value="medium">🟡 中</option>
            <option value="high">🟠 高</option>
            <option value="urgent">🔴 緊急</option>
          </select>
        </div>

        <div class="form-group">
          <label for="dueDate">期限</label>
          <input
            id="dueDate"
            type="date"
            bind:value={dueDate}
            disabled={loading}
          />
        </div>
      </div>

      <div class="form-group">
        <span class="field-label">担当</span>
        <div class="assign-options">
          <label class="radio-label">
            <input type="radio" bind:group={assignType} value="none" disabled={loading} />
            未割当
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={assignType} value="all" disabled={loading} />
            👥 全員
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={assignType} value="user" disabled={loading} />
            👤 ユーザー
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={assignType} value="group" disabled={loading} />
            📁 グループ
          </label>
        </div>
      </div>

      {#if assignType === 'user'}
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label>担当ユーザー（複数選択可）</label>
          <div class="user-checkboxes">
            {#each allUsers as user}
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={assignedUserIds.includes(String(user.id))}
                  onchange={() => toggleUserId(String(user.id))}
                  disabled={loading}
                />
                {user.username}
              </label>
            {/each}
          </div>
        </div>
      {/if}

      {#if assignType === 'group'}
        <div class="form-group">
          <label for="assignGroup">担当グループ</label>
          <select id="assignGroup" bind:value={assignedGroupId} disabled={loading}>
            <option value={null}>選択してください</option>
            {#each allGroups as group}
              <option value={group.id}>{group.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick={onClose} disabled={loading}>
          キャンセル
        </button>
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {loading ? '作成中...' : 'タスクを作成'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
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
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
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
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  form {
    padding: 24px;
  }

  .error-message {
    background: rgba(231, 76, 60, 0.2);
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  label, .field-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .required {
    color: var(--danger);
  }

  input[type="text"],
  input[type="date"],
  textarea,
  select {
    width: 100%;
    padding: 12px 14px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
    transition: border-color 0.2s;
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: var(--primary);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-secondary);
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .assign-options {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .radio-label input {
    width: auto;
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

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--border-color);
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
    }

    .modal-header h2 {
      font-size: 1.125rem;
    }

    .close-btn {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }

    form {
      padding: 20px;
    }

    .form-row {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    label, .field-label {
      font-size: 15px;
      margin-bottom: 10px;
    }

    input[type="text"],
    input[type="date"],
    textarea,
    select {
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

    .radio-label {
      font-size: 15px;
      gap: 8px;
      min-height: 44px;
      align-items: center;
    }

    .radio-label input {
      width: 20px;
      height: 20px;
    }

    .user-checkboxes {
      max-height: 200px;
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

    .form-actions {
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
  }

  @media (max-width: 480px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .btn {
      width: 100%;
    }
  }
</style>
