const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createOSUtils } = require('node-os-utils');
const os = require('os');

const osu = createOSUtils();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botの状態とサーバーの状態を表示します'),

  async execute(interaction) {
    await interaction.reply('計測中...');
    const sent = await interaction.fetchReply();

    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    const [cpuResult, memResult, diskResult] = await Promise.all([
      osu.cpu.usage(),
      osu.memory.info(),
      osu.disk.info().catch(() => null),
    ]);

    const cpuUsage = cpuResult.success ? cpuResult.data : null;
    const memData = memResult.success ? memResult.data : null;

    // メインディスク（最大容量のパーティション）を取得
    let mainDisk = null;
    if (diskResult?.success && Array.isArray(diskResult.data)) {
      mainDisk = diskResult.data.reduce((max, d) =>
        (d.total.bytes > (max?.total?.bytes || 0)) ? d : max, null);
    }

    const uptime = process.uptime();
    const uptimeStr = formatUptime(uptime);

    // メモリ情報の整形
    const usedMemMb = memData ? (memData.used.bytes / 1024 / 1024).toFixed(0) : '?';
    const totalMemMb = memData ? (memData.total.bytes / 1024 / 1024).toFixed(0) : '?';
    const memPercent = memData ? memData.usagePercentage.toFixed(1) : '?';

    // ディスク情報の整形
    const usedDiskGb = mainDisk ? (mainDisk.used.bytes / 1024 / 1024 / 1024).toFixed(1) : '?';
    const totalDiskGb = mainDisk ? (mainDisk.total.bytes / 1024 / 1024 / 1024).toFixed(1) : '?';
    const diskPercent = mainDisk ? mainDisk.usagePercentage : '?';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'メッセージ遅延', value: `\`${latency}ms\``, inline: true },
        { name: 'WebSocket Ping', value: `\`${wsPing}ms\``, inline: true },
        { name: '稼働時間', value: `\`${uptimeStr}\``, inline: true },
        { name: 'メモリ使用率', value: `\`${usedMemMb}MB / ${totalMemMb}MB (${memPercent}%)\``, inline: false },
        { name: 'ディスク使用率', value: `\`${usedDiskGb}GB / ${totalDiskGb}GB (${diskPercent}%)\``, inline: false },
        { name: 'CPU使用率', value: `\`${cpuUsage !== null ? cpuUsage.toFixed(1) : '?'}%\``, inline: true },
        { name: 'CPUモデル', value: `\`${os.cpus()[0]?.model || '不明'}\``, inline: false },
        { name: 'OS', value: `\`${os.type()} ${os.release()}\``, inline: true },
        { name: 'Node.js', value: `\`${process.version}\``, inline: true },
      )
      .setFooter({ text: `サーバー数: ${interaction.client.guilds.cache.size}` })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}日`);
  if (h > 0) parts.push(`${h}時間`);
  if (m > 0) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join(' ');
}
