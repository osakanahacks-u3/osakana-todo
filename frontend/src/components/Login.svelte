<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../lib/api';

  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let passwordLoginEnabled = $state(false);
  let configLoaded = $state(false);

  onMount(async () => {
    // 既にログイン済みならダッシュボードへ
    if (auth.isLoggedIn()) {
      const session = await auth.checkSession();
      if (session?.valid) {
        window.location.href = '/';
        return;
      }
    }

    // パスワードログインが有効か確認
    try {
      const config = await auth.getConfig();
      passwordLoginEnabled = config.enablePasswordLogin;
    } catch {
      passwordLoginEnabled = false;
    }
    configLoaded = true;
  });

  async function handlePasswordLogin() {
    if (!password.trim()) {
      error = 'パスワードを入力してください';
      return;
    }

    loading = true;
    error = '';

    try {
      await auth.loginWithPassword(password);
      window.location.href = '/';
    } catch (e: any) {
      error = e.message || 'ログインに失敗しました';
    } finally {
      loading = false;
    }
  }

  async function handleDiscordLogin() {
    loading = true;
    error = '';

    try {
      const { url } = await auth.getDiscordAuthUrl();
      window.location.href = url;
    } catch (e: any) {
      error = e.message || 'Discord認証の開始に失敗しました';
      loading = false;
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <span class="logo-icon">📋</span>
      <h1>🐟 TODO管理</h1>
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <div class="login-section">
      <h2>Discord認証</h2>
      <p class="hint">サーバーメンバーはこちらからログイン</p>
      <button class="btn btn-discord" onclick={handleDiscordLogin} disabled={loading}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        Discordでログイン
      </button>
    </div>

    {#if configLoaded && passwordLoginEnabled}
    <div class="divider">
      <span>または</span>
    </div>

    <div class="login-section">
      <h2>パスワード認証</h2>
      <p class="hint">管理者パスワードでログイン</p>
      <form onsubmit={(e) => { e.preventDefault(); handlePasswordLogin(); }}>
        <input
          type="password"
          bind:value={password}
          placeholder="パスワードを入力"
          disabled={loading}
        />
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
    {/if}
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(135deg, var(--bg-primary) 0%, #0d1b2a 100%);
  }

  .login-card {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
  }

  .logo {
    text-align: center;
    margin-bottom: 32px;
  }

  .logo-icon {
    font-size: 56px;
    display: block;
    margin-bottom: 12px;
  }

  .logo h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .error-message {
    background: rgba(237, 66, 69, 0.15);
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 14px 16px;
    border-radius: var(--radius-md);
    margin-bottom: 24px;
    font-size: 14px;
    text-align: center;
  }

  .login-section {
    margin-bottom: 20px;
  }

  .login-section h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .hint {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 14px;
  }

  input {
    width: 100%;
    padding: 14px 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 16px;
    margin-bottom: 14px;
    transition: var(--transition);
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.2);
  }

  input::placeholder {
    color: var(--text-muted);
  }

  .btn {
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: var(--radius-md);
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: var(--transition);
    min-height: 48px;
    -webkit-tap-highlight-color: rgba(88, 101, 242, 0.2);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
    transform: translateY(-1px);
  }

  .btn-discord {
    background: #5865F2;
    color: white;
  }

  .btn-discord:hover:not(:disabled) {
    background: #4752C4;
    transform: translateY(-1px);
  }

  .divider {
    display: flex;
    align-items: center;
    margin: 28px 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }

  .divider span {
    padding: 0 16px;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .login-card {
      padding: 32px 24px;
    }

    .logo-icon {
      font-size: 48px;
    }

    .logo h1 {
      font-size: 1.25rem;
    }
  }
</style>
