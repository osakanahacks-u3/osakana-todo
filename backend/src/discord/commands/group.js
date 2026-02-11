const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectBuilder, MessageFlags } = require('discord.js');
const { GroupModel, UserModel } = require('../../database/models');
const { formatDateTime } = require('../../utils/timezone');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('group')
    .setDescription('グループを管理します')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('新しいグループを作成します')
        .addStringOption(option =>
          option.setName('name').setDescription('グループ名').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('description').setDescription('グループの説明')
        )
        .addStringOption(option =>
          option.setName('color').setDescription('グループの色（例: #3498db）')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('グループ一覧を表示します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('グループの詳細を表示します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('グループID').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-member')
        .setDescription('グループにメンバーを追加します')
        .addIntegerOption(option =>
          option.setName('group_id').setDescription('グループID').setRequired(true)
        )
        .addUserOption(option =>
          option.setName('user').setDescription('追加するユーザー').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-member')
        .setDescription('グループからメンバーを削除します')
        .addIntegerOption(option =>
          option.setName('group_id').setDescription('グループID').setRequired(true)
        )
        .addUserOption(option =>
          option.setName('user').setDescription('削除するユーザー').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('グループを削除します')
        .addIntegerOption(option =>
          option.setName('id').setDescription('グループID').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // サーバー内のメンバーかチェック
    if (!interaction.member) {
      await interaction.reply({ content: '❌ このコマンドはサーバー内でのみ使用できます', flags: MessageFlags.Ephemeral });
      return;
    }

    switch (subcommand) {
      case 'create':
        await this.createGroup(interaction);
        break;
      case 'list':
        await this.listGroups(interaction);
        break;
      case 'view':
        await this.viewGroup(interaction);
        break;
      case 'add-member':
        await this.addMember(interaction);
        break;
      case 'remove-member':
        await this.removeMember(interaction);
        break;
      case 'delete':
        await this.deleteGroup(interaction);
        break;
    }
  },

  async createGroup(interaction) {
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color') || '#3498db';

    const creator = UserModel.upsert(
      interaction.user.id,
      interaction.user.username,
      interaction.user.discriminator,
      interaction.user.avatar
    );

    const group = GroupModel.create(name, description, color, creator.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ グループを作成しました')
      .setColor(parseInt(color.replace('#', ''), 16))
      .addFields(
        { name: 'ID', value: `${group.id}`, inline: true },
        { name: 'グループ名', value: group.name, inline: true },
      );

    if (description) {
      embed.addFields({ name: '説明', value: description, inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async listGroups(interaction) {
    const groups = GroupModel.getAll();

    if (groups.length === 0) {
      await interaction.reply({ content: '📭 グループがありません', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📁 グループ一覧')
      .setColor(0x3498db)
      .setDescription(
        groups.map(g => {
          const members = GroupModel.getMembers(g.id);
          return `**#${g.id}** ${g.name}\n　└ メンバー: ${members.length}人${g.description ? `\n　└ ${g.description}` : ''}`;
        }).join('\n\n')
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },

  async viewGroup(interaction) {
    const groupId = interaction.options.getInteger('id');
    const group = GroupModel.findById(groupId);

    if (!group) {
      await interaction.reply({ content: '❌ グループが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    const members = GroupModel.getMembers(groupId);

    const embed = new EmbedBuilder()
      .setTitle(`📁 グループ #${group.id}: ${group.name}`)
      .setColor(parseInt(group.color.replace('#', ''), 16))
      .addFields(
        { name: 'メンバー数', value: `${members.length}人`, inline: true },
        { name: '作成日', value: formatDateTime(group.created_at), inline: true },
      );

    if (group.description) {
      embed.addFields({ name: '説明', value: group.description, inline: false });
    }

    if (members.length > 0) {
      embed.addFields({
        name: '👥 メンバー',
        value: members.map(m => `• ${m.username}`).join('\n'),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async addMember(interaction) {
    const groupId = interaction.options.getInteger('group_id');
    const targetUser = interaction.options.getUser('user');

    const group = GroupModel.findById(groupId);
    if (!group) {
      await interaction.reply({ content: '❌ グループが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    // サーバー内のメンバーかチェック
    try {
      await interaction.guild.members.fetch(targetUser.id);
    } catch {
      await interaction.reply({ content: '❌ このユーザーはサーバー内にいません', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = UserModel.upsert(
      targetUser.id,
      targetUser.username,
      targetUser.discriminator,
      targetUser.avatar
    );

    const success = GroupModel.addMember(groupId, user.id);

    if (success) {
      await interaction.reply({
        content: `✅ ${targetUser.username} をグループ「${group.name}」に追加しました`,
      });
    } else {
      await interaction.reply({
        content: `⚠️ ${targetUser.username} は既にグループのメンバーです`,
        flags: MessageFlags.Ephemeral
      });
    }
  },

  async removeMember(interaction) {
    const groupId = interaction.options.getInteger('group_id');
    const targetUser = interaction.options.getUser('user');

    const group = GroupModel.findById(groupId);
    if (!group) {
      await interaction.reply({ content: '❌ グループが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    const user = UserModel.findByDiscordId(targetUser.id);
    if (!user) {
      await interaction.reply({ content: '❌ ユーザーが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    GroupModel.removeMember(groupId, user.id);

    await interaction.reply({
      content: `✅ ${targetUser.username} をグループ「${group.name}」から削除しました`,
    });
  },

  async deleteGroup(interaction) {
    const groupId = interaction.options.getInteger('id');
    const group = GroupModel.findById(groupId);

    if (!group) {
      await interaction.reply({ content: '❌ グループが見つかりませんでした', flags: MessageFlags.Ephemeral });
      return;
    }

    GroupModel.delete(groupId);

    await interaction.reply({
      content: `🗑️ グループ「${group.name}」を削除しました`,
    });
  }
};
