<script lang="ts">
  import { onMount } from 'svelte';
  import { groups } from '../lib/api';

  interface Props {
    allUsers: any[];
    onRefresh: () => void;
  }

  let { allUsers, onRefresh }: Props = $props();

  let groupList = $state<any[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let selectedGroup = $state<any>(null);
  let showAddMember = $state(false);

  // フォーム用
  let formName = $state('');
  let formDescription = $state('');
  let formColor = $state('#3498db');
  let saving = $state(false);
  let error = $state('');

  onMount(() => {
    loadGroups();
  });

  async function loadGroups() {
    loading = true;
    try {
      groupList = await groups.getAll();
    } catch (e) {
      console.error('Failed to load groups:', e);
    } finally {
      loading = false;
    }
  }

  async function handleCreateGroup() {
    if (!formName.trim()) {
      error = 'グループ名を入力してください';
      return;
    }

    saving = true;
    error = '';

    try {
      await groups.create({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        color: formColor
      });
      showForm = false;
      formName = '';
      formDescription = '';
      formColor = '#3498db';
      await loadGroups();
      onRefresh();
    } catch (e: any) {
      error = e.message || 'グループの作成に失敗しました';
    } finally {
      saving = false;
    }
  }

  async function handleSelectGroup(groupId: string) {
    try {
      selectedGroup = await groups.get(groupId);
    } catch (e) {
      console.error('Failed to load group:', e);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('このグループを削除しますか？')) return;
    try {
      await groups.delete(groupId);
      selectedGroup = null;
      await loadGroups();
      onRefresh();
    } catch (e) {
      console.error('Failed to delete group:', e);
    }
  }

  async function handleAddMember(userId: string) {
    if (!selectedGroup) return;
    try {
      await groups.addMember(selectedGroup.id, userId);
      selectedGroup = await groups.get(selectedGroup.id);
      showAddMember = false;
      await loadGroups();
    } catch (e: any) {
      console.error('Failed to add member:', e);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedGroup) return;
    if (!confirm('このメンバーをグループから削除しますか？')) return;
    try {
      await groups.removeMember(selectedGroup.id, userId);
      selectedGroup = await groups.get(selectedGroup.id);
      await loadGroups();
    } catch (e) {
      console.error('Failed to remove member:', e);
    }
  }

  function getAvailableUsers(): any[] {
    if (!selectedGroup?.members) return allUsers;
    const memberIds = new Set(selectedGroup.members.map((m: any) => m.id));
    return allUsers.filter(u => !memberIds.has(u.id));
  }
</script>

<div class="group-manager">
  <div class="group-list-section">
    <div class="section-header">
      <h2>📁 グループ一覧</h2>
      <button class="btn btn-primary" onclick={() => showForm = true}>
        ➕ 新規グループ
      </button>
    </div>

    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
      </div>
    {:else if groupList.length === 0}
      <div class="empty-state">
        <p>グループがありません</p>
        <button class="btn btn-primary" onclick={() => showForm = true}>
          最初のグループを作成
        </button>
      </div>
    {:else}
      <div class="group-grid">
        {#each groupList as group}
          <button
            class="group-card"
            class:active={selectedGroup?.id === group.id}
            onclick={() => handleSelectGroup(group.id)}
            style="border-left-color: {group.color}"
          >
            <h3>{group.name}</h3>
            {#if group.description}
              <p class="group-desc">{group.description}</p>
            {/if}
            <span class="member-count">👥 {group.memberCount || 0}人</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if selectedGroup}
    <div class="group-detail-section">
      <div class="detail-header">
        <div>
          <h2 style="color: {selectedGroup.color}">{selectedGroup.name}</h2>
          {#if selectedGroup.description}
            <p>{selectedGroup.description}</p>
          {/if}
        </div>
        <button class="btn-delete" onclick={() => handleDeleteGroup(selectedGroup.id)}>
          🗑️ 削除
        </button>
      </div>

      <div class="members-section">
        <div class="members-header">
          <h3>👥 メンバー ({selectedGroup.members?.length || 0}人)</h3>
          <button class="btn btn-secondary" onclick={() => showAddMember = true}>
            ➕ メンバー追加
          </button>
        </div>

        {#if selectedGroup.members && selectedGroup.members.length > 0}
          <div class="members-list">
            {#each selectedGroup.members as member}
              <div class="member-item">
                <div class="member-info">
                  {#if member.avatar}
                    <img
                      src="https://cdn.discordapp.com/avatars/{member.discord_id}/{member.avatar}.png"
                      alt={member.username}
                      class="member-avatar"
                    />
                  {:else}
                    <div class="member-avatar placeholder">
                      {member.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  {/if}
                  <span>{member.username}</span>
                </div>
                <button
                  class="btn-remove"
                  onclick={() => handleRemoveMember(member.id)}
                  title="削除"
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="no-members">メンバーがいません</p>
        {/if}
      </div>
    </div>
  {:else}
    <div class="group-detail-section empty">
      <p>グループを選択してください</p>
    </div>
  {/if}
</div>

{#if showForm}
  <div class="modal-backdrop" role="button" tabindex="-1" onclick={(e) => e.target === e.currentTarget && (showForm = false)} onkeydown={(e) => e.key === 'Escape' && (showForm = false)}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
      <div class="modal-header">
        <h2 id="group-form-title">➕ 新規グループ</h2>
        <button class="close-btn" onclick={() => showForm = false}>✕</button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); handleCreateGroup(); }}>
        {#if error}
          <div class="error-message">{error}</div>
        {/if}
        <div class="form-group">
          <label for="group-name">グループ名 *</label>
          <input id="group-name" type="text" bind:value={formName} placeholder="グループ名" disabled={saving} />
        </div>
        <div class="form-group">
          <label for="group-description">説明</label>
          <textarea id="group-description" bind:value={formDescription} placeholder="説明（任意）" rows="3" disabled={saving}></textarea>
        </div>
        <div class="form-group">
          <label for="group-color">カラー</label>
          <input id="group-color" type="color" bind:value={formColor} disabled={saving} />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick={() => showForm = false}>キャンセル</button>
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {saving ? '作成中...' : '作成'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showAddMember}
  <div class="modal-backdrop" role="button" tabindex="-1" onclick={(e) => e.target === e.currentTarget && (showAddMember = false)} onkeydown={(e) => e.key === 'Escape' && (showAddMember = false)}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <div class="modal-header">
        <h2 id="add-member-title">➕ メンバー追加</h2>
        <button class="close-btn" onclick={() => showAddMember = false}>✕</button>
      </div>
      <div class="modal-body">
        {#if getAvailableUsers().length === 0}
          <p class="no-users">追加できるユーザーがいません</p>
        {:else}
          <div class="user-select-list">
            {#each getAvailableUsers() as user}
              <button class="user-select-item" onclick={() => handleAddMember(user.id)}>
                {#if user.avatar}
                  <img
                    src="https://cdn.discordapp.com/avatars/{user.discord_id}/{user.avatar}.png"
                    alt={user.username}
                    class="user-avatar"
                  />
                {:else}
                  <div class="user-avatar placeholder">
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                {/if}
                <span>{user.username}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .group-manager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 100%;
  }

  .group-list-section,
  .group-detail-section {
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid var(--border-color);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .section-header h2 {
    font-size: 16px;
  }

  .loading {
    display: flex;
    justify-content: center;
    padding: 40px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
  }

  .empty-state button {
    margin-top: 16px;
  }

  .group-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .group-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-left-width: 4px;
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    color: var(--text-primary);
  }

  .group-card:hover {
    border-color: var(--primary);
  }

  .group-card.active {
    border-color: var(--primary);
    background: rgba(52, 152, 219, 0.1);
  }

  .group-card h3 {
    font-size: 15px;
    margin-bottom: 4px;
  }

  .group-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .member-count {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .group-detail-section.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }

  .detail-header h2 {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .detail-header p {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .btn-delete {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--danger);
    color: var(--danger);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn-delete:hover {
    background: var(--danger);
    color: white;
  }

  .members-section {
    margin-top: 20px;
  }

  .members-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .members-header h3 {
    font-size: 14px;
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .member-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-tertiary);
    border-radius: 8px;
  }

  .member-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .member-avatar, .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .member-avatar.placeholder, .user-avatar.placeholder {
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }

  .btn-remove {
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
  }

  .btn-remove:hover {
    background: var(--danger);
    color: white;
  }

  .no-members, .no-users {
    color: var(--text-secondary);
    font-size: 14px;
    text-align: center;
    padding: 20px;
  }

  .btn {
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
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
    border: 1px solid var(--border-color);
  }

  /* Modal styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: var(--bg-secondary);
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    font-size: 16px;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
  }

  .modal form, .modal-body {
    padding: 20px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    margin-bottom: 6px;
  }

  .form-group input[type="text"],
  .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
  }

  .form-group input[type="color"] {
    width: 60px;
    height: 40px;
    padding: 4px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  .error-message {
    background: rgba(231, 76, 60, 0.2);
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 10px 12px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .user-select-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .user-select-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-primary);
    text-align: left;
  }

  .user-select-item:hover {
    border-color: var(--primary);
    background: rgba(52, 152, 219, 0.1);
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    .group-manager {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .group-list-section,
    .group-detail-section {
      border-radius: var(--radius-lg);
      padding: 18px;
    }

    .section-header h2 {
      font-size: 1.125rem;
    }

    .btn {
      padding: 10px 16px;
      font-size: 14px;
      min-height: 44px;
    }

    .group-card {
      padding: 18px;
      border-left-width: 5px;
      -webkit-tap-highlight-color: rgba(88, 101, 242, 0.2);
    }

    .group-card:active {
      opacity: 0.9;
      transform: scale(0.98);
    }

    .group-card h3 {
      font-size: 16px;
    }

    .group-desc {
      font-size: 14px;
    }

    .member-count {
      font-size: 13px;
    }

    .detail-header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .detail-header h2 {
      font-size: 1.25rem;
    }

    .btn-delete {
      padding: 10px 16px;
      font-size: 14px;
      min-height: 44px;
      width: 100%;
    }

    .members-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .members-header h3 {
      font-size: 1rem;
    }

    .member-item {
      padding: 14px;
      -webkit-tap-highlight-color: rgba(88, 101, 242, 0.1);
    }

    .member-avatar, .user-avatar {
      width: 40px;
      height: 40px;
      font-size: 16px;
    }

    .member-info span {
      font-size: 15px;
    }

    .btn-remove {
      width: 32px;
      height: 32px;
      font-size: 16px;
    }

    /* Modal adjustments */
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
      font-size: 18px;
    }

    .modal form, .modal-body {
      padding: 20px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      font-size: 15px;
      margin-bottom: 10px;
    }

    .form-group input[type="text"],
    .form-group textarea {
      padding: 14px 16px;
      font-size: 16px;
      min-height: 48px;
    }

    .form-group textarea {
      min-height: 100px;
    }

    .form-group input[type="color"] {
      width: 80px;
      height: 48px;
    }

    .form-actions {
      gap: 12px;
      position: sticky;
      bottom: 0;
      background: var(--bg-secondary);
      padding: 16px 0 0 0;
    }

    .form-actions .btn {
      flex: 1;
      padding: 14px 24px;
      font-size: 16px;
      min-height: 48px;
    }

    .user-select-item {
      padding: 16px;
      -webkit-tap-highlight-color: rgba(88, 101, 242, 0.2);
    }

    .user-select-item:active {
      opacity: 0.9;
      transform: scale(0.98);
    }
  }

  @media (max-width: 480px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .form-actions .btn {
      width: 100%;
    }
  }
</style>
