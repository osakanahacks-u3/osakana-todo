#!/usr/bin/env node

/**
 * TODO - 対話形式セットアップスクリプト
 */

const readline = require('readline');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const ENV_PATH = path.join(BACKEND, '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue = '') {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askYesNo(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${question} [${hint}]: `, (answer) => {
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}

function run(cmd, cwd = ROOT) {
  console.log(`\n  > ${cmd}\n`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function header(text) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${text}`);
  console.log(`${'='.repeat(50)}\n`);
}

async function main() {
  console.log(`
  TODO セットアップ
  ────────────────────────────
  対話形式で設定を行います。
  `);

  // ─── 1. .env 設定 ───
  header('Step 1: 環境変数の設定');

  let envConfig = {};

  if (fs.existsSync(ENV_PATH)) {
    const useExisting = await askYesNo('既存の .env が見つかりました。そのまま使いますか？', true);
    if (useExisting) {
      // 既存の.envを読み込んでパース
      const content = fs.readFileSync(ENV_PATH, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) envConfig[match[1].trim()] = match[2].trim();
      }
      console.log('  ✅ 既存の .env を使用します\n');
    } else {
      envConfig = await collectEnvConfig();
    }
  } else {
    envConfig = await collectEnvConfig();
  }

  // .env 書き込み
  writeEnvFile(envConfig);
  console.log('  ✅ .env を保存しました\n');

  // ecosystem.config.js のコピー
  const ecoSrc = path.join(ROOT, 'ecosystem.config.js.example');
  const ecoDest = path.join(ROOT, 'ecosystem.config.js');
  if (fs.existsSync(ecoDest)) {
    const overwrite = await askYesNo('既存の ecosystem.config.js が見つかりました。上書きしますか？', false);
    if (overwrite) {
      fs.copyFileSync(ecoSrc, ecoDest);
      console.log('  ✅ ecosystem.config.js を上書きしました\n');
    } else {
      console.log('  ✅ 既存の ecosystem.config.js を使用します\n');
    }
  } else if (fs.existsSync(ecoSrc)) {
    fs.copyFileSync(ecoSrc, ecoDest);
    console.log('  ✅ ecosystem.config.js を作成しました\n');
  } else {
    console.log('  ⚠️  ecosystem.config.js.example が見つかりません\n');
  }

  // ─── 2. 依存関係インストール ───
  header('Step 2: 依存関係のインストール');

  const doInstall = await askYesNo('依存関係をインストールしますか？', true);
  if (doInstall) {
    console.log('\n  📦 バックエンドの依存関係をインストール中...');
    run('npm install', BACKEND);

    console.log('\n  📦 フロントエンドの依存関係をインストール中...');
    run('npm install', FRONTEND);
  }

  // ─── 3. フロントエンドビルド ───
  header('Step 3: フロントエンドのビルド');

  const doBuild = await askYesNo('フロントエンドをビルドしますか？', true);
  if (doBuild) {
    console.log('\n  🔨 ビルド中...');
    run('npm run deploy', FRONTEND);
  }

  // ─── 4. Discordスラッシュコマンド登録 ───
  header('Step 4: Discord スラッシュコマンドの登録');

  const doDeploy = await askYesNo('スラッシュコマンドを登録しますか？', true);
  if (doDeploy) {
    console.log('\n  🤖 コマンドを登録中...');
    run('npm run deploy-commands', BACKEND);
  }

  // ─── 5. pm2 起動 ───
  header('Step 5: pm2 で起動');

  const doStart = await askYesNo('pm2 で起動しますか？', true);
  if (doStart) {
    // pm2 がインストールされているか確認
    try {
      execSync('pm2 --version', { stdio: 'ignore' });
    } catch {
      console.log('  ⚠️  pm2 が見つかりません。インストールします...');
      run('npm install -g pm2');
    }

    run('pm2 start ecosystem.config.js', ROOT);
    console.log('\n  ✅ 起動しました！');
    console.log(`  🌐 URL: ${envConfig.BASE_URL || 'http://localhost:' + (envConfig.PORT || '4040')}`);
  }

  // ─── 完了 ───
  header('セットアップ完了！');

  console.log('  よく使うコマンド:');
  console.log('    pm2 restart todo    再起動');
  console.log('    pm2 logs todo       ログ確認');
  console.log('    pm2 stop todo       停止');
  console.log('');

  rl.close();
}

async function collectEnvConfig() {
  const config = {};

  console.log('  Discord Developer Portal から取得した値を入力してください。\n');

  // 必須
  config.DISCORD_TOKEN = await ask('  Bot トークン (DISCORD_TOKEN)');
  config.DISCORD_CLIENT_ID = await ask('  Client ID (DISCORD_CLIENT_ID)');
  config.DISCORD_CLIENT_SECRET = await ask('  Client Secret (DISCORD_CLIENT_SECRET)');
  config.DISCORD_GUILD_ID = await ask('  サーバーID (DISCORD_GUILD_ID)');

  console.log('');

  // サーバー設定
  config.PORT = await ask('  ポート番号 (PORT)', '4040');
  config.BASE_URL = await ask('  公開URL (BASE_URL)', `http://localhost:${config.PORT}`);

  console.log('');

  // 認証設定
  config.SESSION_SECRET = await ask('  セッション秘密鍵 (SESSION_SECRET)', crypto.randomBytes(32).toString('hex'));

  // パスワード認証
  const enablePw = await askYesNo('  パスワード認証を有効にしますか？', false);
  config.ENABLE_PASSWORD_LOGIN = enablePw ? 'true' : 'false';
  if (enablePw) {
    config.ADMIN_PASSWORD = await ask('  管理者パスワード (ADMIN_PASSWORD)');
  }

  console.log('');

  // 権限設定
  console.log('  権限モード:');
  console.log('    disable - 制限なし（デフォルト）');
  console.log('    white   - 指定ロールを持つユーザーのみ利用可');
  console.log('    black   - 指定ロールを持つユーザーは利用不可');
  const permMode = await ask('  権限モード (PERMISSION_MODE)', 'disable');
  config.PERMISSION_MODE = permMode;
  if (permMode === 'white' || permMode === 'black') {
    config.PERMISSION_ROLE_ID = await ask('  対象ロールID (PERMISSION_ROLE_ID)');
  }

  console.log('');

  // オプション
  const panelChannel = await ask('  パネルチャンネルID (PANEL_CHANNEL_ID, 省略可)');
  if (panelChannel) config.PANEL_CHANNEL_ID = panelChannel;

  const notifyChannel = await ask('  通知チャンネルID (NOTIFY_CHANNEL_ID, 省略可)');
  if (notifyChannel) config.NOTIFY_CHANNEL_ID = notifyChannel;

  return config;
}

function writeEnvFile(config) {
  const lines = [
    '# ========================================',
    '# Discord Bot設定',
    '# ========================================',
    `DISCORD_TOKEN=${config.DISCORD_TOKEN || ''}`,
    `DISCORD_CLIENT_ID=${config.DISCORD_CLIENT_ID || ''}`,
    `DISCORD_CLIENT_SECRET=${config.DISCORD_CLIENT_SECRET || ''}`,
    `DISCORD_GUILD_ID=${config.DISCORD_GUILD_ID || ''}`,
    '',
    '# ========================================',
    '# サーバー設定',
    '# ========================================',
    `PORT=${config.PORT || '4040'}`,
    `BASE_URL=${config.BASE_URL || 'http://localhost:4040'}`,
    '',
    '# ========================================',
    '# 認証設定',
    '# ========================================',
    `SESSION_SECRET=${config.SESSION_SECRET || ''}`,
    `ADMIN_PASSWORD=${config.ADMIN_PASSWORD || ''}`,
    `ENABLE_PASSWORD_LOGIN=${config.ENABLE_PASSWORD_LOGIN || 'false'}`,
    '',
    '# ========================================',
    '# 権限設定',
    '# ========================================',
    `PERMISSION_MODE=${config.PERMISSION_MODE || 'disable'}`,
    `PERMISSION_ROLE_ID=${config.PERMISSION_ROLE_ID || ''}`,
    '',
    '# ========================================',
    '# チャンネル設定（オプション）',
    '# ========================================',
    `PANEL_CHANNEL_ID=${config.PANEL_CHANNEL_ID || ''}`,
    `NOTIFY_CHANNEL_ID=${config.NOTIFY_CHANNEL_ID || ''}`,
  ];

  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

main().catch((err) => {
  console.error('\n  ❌ セットアップ中にエラーが発生しました:', err.message);
  rl.close();
  process.exit(1);
});
