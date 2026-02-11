/**
 * タイムゾーンユーティリティ
 * 環境変数 TIMEZONE で設定可能（デフォルト: Asia/Tokyo）
 */

const TIMEZONE = process.env.TIMEZONE || 'Asia/Tokyo';

/**
 * 日時をフォーマットされた文字列に変換
 * @param {string|Date} dateStr - 日付文字列またはDateオブジェクト
 * @returns {string} フォーマットされた日時文字列
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', { timeZone: TIMEZONE });
}

/**
 * 日付をフォーマットされた文字列に変換（時刻なし）
 * @param {string|Date} dateStr - 日付文字列またはDateオブジェクト
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', { timeZone: TIMEZONE });
}

/**
 * 短い日時フォーマット（コメント用）
 * @param {string|Date} dateStr 
 * @returns {string}
 */
function formatShortDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 現在のタイムゾーン名を取得
 * @returns {string}
 */
function getTimezone() {
  return TIMEZONE;
}

module.exports = {
  formatDateTime,
  formatDate,
  formatShortDateTime,
  getTimezone,
  TIMEZONE
};
