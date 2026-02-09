const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('コマンドの使い方やパネルの説明を表示します'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 TODO管理ボット ヘルプ')
      .setDescription(
        'タスクの作成・管理をDiscordとWebの両方から行えるBotです。\n' +
        '下のメニューからカテゴリを選んで詳細を確認できます。'
      )
      .addFields(
        { name: '📋 /todo', value: 'タスクの作成・編集・削除・一覧表示など', inline: true },
        { name: '👥 /group', value: 'グループの作成・メンバー管理', inline: true },
        { name: '🏓 /ping', value: 'Botの応答確認', inline: true },
      )
      .setFooter({ text: '下のメニューからカテゴリを選択してください' })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('help_category')
          .setPlaceholder('📂 カテゴリを選択')
          .addOptions([
            { label: 'タスク基本操作', value: 'help_task_basic', emoji: '📋', description: '追加・表示・一覧・削除' },
            { label: 'タスク編集', value: 'help_task_edit', emoji: '✏️', description: 'ステータス・優先度・担当者の変更' },
            { label: 'エクスポート / インポート', value: 'help_data', emoji: '📥', description: 'データの出力・取り込み' },
            { label: 'グループ管理', value: 'help_group', emoji: '👥', description: 'グループの作成・メンバー管理' },
            { label: 'パネルの使い方', value: 'help_panel', emoji: '🖥️', description: 'パネルの各機能の説明' },
            { label: 'Webアプリについて', value: 'help_web', emoji: '🌐', description: 'Webアプリの機能紹介' },
          ]),
      );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }
};
