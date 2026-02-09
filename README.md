# TODO

> Discord × Web のTODO管理ツール

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-ISC-blue)](LICENSE)

## 概要

DiscordサーバーとWebダッシュボードの両方からタスクを管理できるツールです。  
静的ビルドのフロントエンドをバックエンドでホストする統合型アーキテクチャを採用しています。

## クイックスタート

```bash
git clone <repository-url> todo && cd todo
node setup.js
```

対話形式でセットアップが完了します。

---

## 機能一覧

<details>
<summary><b>📋 タスク管理</b></summary>

| 機能 | 説明 |
|------|------|
| CRUD | タスクの作成・閲覧・編集・削除 |
| ステータス | 未着手 / 進行中 / 保留 / 完了 / その他 |
| 優先度 | 低 / 中 / 高 / 緊急 |
| 期限 | 日付指定 |
| コメント | タスクへのコメント追加 |
| 複数担当 | 複数ユーザーへの同時割り当て |

</details>

<details>
<summary><b>👥 グループ管理</b></summary>

- グループの作成・編集・削除
- メンバーの追加・削除
- グループ単位でのタスク割り当て
- Discord ロールの自動作成・同期

</details>

<details>
<summary><b>🤖 Discord Bot</b></summary>

| コマンド | 説明 |
|----------|------|
| `/todo panel` | 管理パネル表示 |
| `/todo add` | タスク追加 |
| `/todo list` | タスク一覧 |
| `/todo view` | タスク詳細 |
| `/todo status` | ステータス変更 |
| `/todo delete` | タスク削除 |
| `/todo stats` | 統計表示 |
| `/group create` | グループ作成 |
| `/group list` | グループ一覧 |
| `/group view` | グループ詳細 |
| `/group add-member` | メンバー追加 |
| `/group remove-member` | メンバー削除 |
| `/group delete` | グループ削除 |
| `/ping` | Bot ステータス |

</details>

<details>
<summary><b>🔐 認証・権限</b></summary>

- **Discord OAuth** — サーバーメンバー認証
- **パスワード認証** — バックアップ（`.env` で有効/無効切替）
- **ロール権限制御** — ホワイトリスト / ブラックリスト方式（`.env` で設定）
- **ブルートフォース対策** — 5回失敗で15分ロック
- **レート制限** — 全体 200req/min、認証 20req/15min

</details>

<details>
<summary><b>📤 エクスポート</b></summary>

TXT / CSV / JSON 形式でタスクを出力

</details>

---

## セットアップ

### 前提条件

- **Node.js** v18+
- **npm** v9+

### 1. Discord Application の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成
2. **Bot** セクションでトークンを生成し、以下の Intents を有効化:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
3. **OAuth2** で Client ID / Client Secret を取得
4. **Redirects** に `https://<YOUR_DOMAIN>/auth/callback` を追加
5. Bot をサーバーに招待（スコープ: `bot`, `applications.commands`）

> [!TIP]
> サーバーIDの取得: Discord で開発者モードを有効にし、サーバー右クリック → 「サーバーIDをコピー」

### 2. セットアップ実行

```bash
node setup.js
```

以下が対話形式で設定されます:

- `.env` の作成（Discord 設定・認証・チャンネルID等）
- 依存関係のインストール
- フロントエンドのビルド
- Discord スラッシュコマンドの登録
- pm2 での起動

### 3. 手動セットアップ（任意）

<details>
<summary>手動でセットアップする場合</summary>

```bash
# 依存関係インストール
cd backend && npm install && cd ../frontend && npm install && cd ..

# 設定ファイルをコピー
cp backend/.env.example backend/.env
cp ecosystem.config.js.example ecosystem.config.js
# → backend/.env を編集

# フロントエンドビルド
cd frontend && npm run deploy && cd ..

# コマンド登録
cd backend && npm run deploy-commands && cd ..

# 起動
pm2 start ecosystem.config.js
```

</details>

---

## 環境変数

> [!IMPORTANT]
> `backend/.env` に設定してください。`.env.example` をコピーして使用できます。

| 変数 | 必須 | 説明 | デフォルト |
|------|:----:|------|-----------|
| `DISCORD_TOKEN` | ✅ | Bot トークン | — |
| `DISCORD_CLIENT_ID` | ✅ | OAuth2 Client ID | — |
| `DISCORD_CLIENT_SECRET` | ✅ | OAuth2 Client Secret | — |
| `DISCORD_GUILD_ID` | ✅ | 対象サーバーID | — |
| `PORT` | — | サーバーポート | `4040` |
| `BASE_URL` | — | 公開URL | `http://localhost:4040` |
| `SESSION_SECRET` | ✅ | セッション暗号化キー | — |
| `ADMIN_PASSWORD` | — | パスワード認証用パスワード | — |
| `ENABLE_PASSWORD_LOGIN` | — | パスワード認証の有効/無効 | `false` |
| `PANEL_CHANNEL_ID` | — | パネル自動送信チャンネル | — |
| `NOTIFY_CHANNEL_ID` | — | 通知チャンネル | — |
| `PERMISSION_MODE` | — | 権限モード（`white` / `black` / `disable`） | `disable` |
| `PERMISSION_ROLE_ID` | — | 対象ロールID | — |

> [!NOTE]
> **権限モード** について:
> - `disable` — 制限なし（サーバーメンバーなら全員利用可）
> - `white` — 指定ロールを持つユーザー**のみ**利用可
> - `black` — 指定ロールを持つユーザーは利用**不可**

---

## Nginx & SSL（本番環境）

<details>
<summary>Nginx 設定例</summary>

```nginx
server {
    listen 80;
    server_name todo.example.com;

    location / {
        proxy_pass http://127.0.0.1:4040;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# SSL 証明書取得（Nginx設定は自動で更新されます）
sudo certbot --nginx -d todo.example.com
```

</details>

---

## pm2 コマンド

```bash
pm2 start ecosystem.config.js   # 起動
pm2 restart todo         # 再起動
pm2 logs todo            # ログ確認
pm2 stop todo            # 停止
```

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| Backend | Node.js, Express, Discord.js v14 |
| Database | SQLite (better-sqlite3, WAL) |
| Frontend | Astro (静的出力), Svelte 5, TypeScript |
| Process | pm2 |

## ライセンス

[ISC](LICENSE)
