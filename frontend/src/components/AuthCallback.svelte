<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../lib/api';

  let status = $state('認証中...');
  let error = $state('');

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
      error = '認証コードが見つかりません';
      return;
    }

    try {
      status = 'Discord認証を処理中...';
      await auth.loginWithDiscord(code);
      status = 'ログイン成功！リダイレクト中...';
      window.location.href = '/';
    } catch (e: any) {
      error = e.message || '認証に失敗しました';
    }
  });
</script>

<div class="callback-container">
  <div class="callback-card">
    {#if error}
      <div class="error">
        <span class="icon">❌</span>
        <h2>認証エラー</h2>
        <p>{error}</p>
        <a href="/login" class="btn">ログイン画面に戻る</a>
      </div>
    {:else}
      <div class="loading">
        <div class="spinner"></div>
        <p>{status}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .callback-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  }

  .callback-card {
    background: var(--bg-secondary);
    border-radius: 16px;
    padding: 40px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
  }

  .loading p {
    margin-top: 20px;
    color: var(--text-primary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error .icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }

  .error h2 {
    color: var(--danger);
    margin-bottom: 8px;
  }

  .error p {
    color: var(--text-secondary);
    margin-bottom: 20px;
  }

  .btn {
    display: inline-block;
    padding: 12px 24px;
    background: var(--primary);
    color: white;
    border-radius: 8px;
    font-weight: 600;
  }

  .btn:hover {
    background: var(--primary-dark);
    text-decoration: none;
  }
</style>
