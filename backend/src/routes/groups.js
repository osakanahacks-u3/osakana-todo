const express = require('express');
const { GroupModel, UserModel } = require('../database/models');
const { authMiddleware } = require('../middleware/auth');
const discordClient = require('../discord/client');

const router = express.Router();

// 認証ミドルウェアを適用
router.use(authMiddleware);

// グループ一覧取得
router.get('/', (req, res) => {
  const groups = GroupModel.getAll();
  
  // 各グループのメンバー数も取得
  const groupsWithMembers = groups.map(group => ({
    ...group,
    memberCount: GroupModel.getMembers(group.id).length
  }));

  res.json(groupsWithMembers);
});

// グループ詳細取得
router.get('/:id', (req, res) => {
  const group = GroupModel.findById(parseInt(req.params.id));
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const members = GroupModel.getMembers(group.id);
  
  res.json({ ...group, members });
});

// グループ作成
router.post('/', async (req, res) => {
  const { name, description, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  let createdBy = null;
  if (req.user) {
    createdBy = req.user.id;
  }

  const group = GroupModel.create(name, description || null, color || '#3498db', createdBy);

  // Discordロールを作成して紐付け
  try {
    if (discordClient.isReady() && discordClient.createGroupRole) {
      const roleId = await discordClient.createGroupRole(name, color || '#3498db');
      if (roleId) {
        GroupModel.setDiscordRoleId(group.id, roleId);
        group.discord_role_id = roleId;
      }
    }
  } catch (e) {
    console.error('Failed to create group role:', e);
  }

  res.status(201).json(group);
});

// グループ更新
router.put('/:id', (req, res) => {
  const groupId = parseInt(req.params.id);
  const existingGroup = GroupModel.findById(groupId);

  if (!existingGroup) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const { name, description, color } = req.body;

  const group = GroupModel.update(
    groupId,
    name || existingGroup.name,
    description !== undefined ? description : existingGroup.description,
    color || existingGroup.color
  );

  res.json(group);
});

// グループ削除
router.delete('/:id', async (req, res) => {
  const groupId = parseInt(req.params.id);
  const existingGroup = GroupModel.findById(groupId);

  if (!existingGroup) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Discordロールを削除
  try {
    if (discordClient.isReady() && existingGroup.discord_role_id && discordClient.deleteGroupRole) {
      await discordClient.deleteGroupRole(existingGroup.discord_role_id);
    }
  } catch (e) {
    console.error('Failed to delete group role:', e);
  }

  GroupModel.delete(groupId);
  res.json({ success: true });
});

// グループにメンバー追加
router.post('/:id/members', async (req, res) => {
  const groupId = parseInt(req.params.id);
  const { userId, discordId } = req.body;

  const group = GroupModel.findById(groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  let user;
  if (userId) {
    user = UserModel.findById(parseInt(userId));
  } else if (discordId) {
    user = UserModel.findByDiscordId(discordId);
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const success = GroupModel.addMember(groupId, user.id);

  if (success) {
    // Discordロールを付与
    try {
      if (discordClient.isReady() && group.discord_role_id && user.discord_id && discordClient.addRoleToMember) {
        await discordClient.addRoleToMember(user.discord_id, group.discord_role_id);
      }
    } catch (e) {
      console.error('Failed to add role to member:', e);
    }

    const members = GroupModel.getMembers(groupId);
    res.status(201).json(members);
  } else {
    res.status(409).json({ error: 'User is already a member of this group' });
  }
});

// グループからメンバー削除
router.delete('/:id/members/:userId', async (req, res) => {
  const groupId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);

  const group = GroupModel.findById(groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Discordロールを剥奪
  try {
    const user = UserModel.findById(userId);
    if (discordClient.isReady() && group.discord_role_id && user?.discord_id && discordClient.removeRoleFromMember) {
      await discordClient.removeRoleFromMember(user.discord_id, group.discord_role_id);
    }
  } catch (e) {
    console.error('Failed to remove role from member:', e);
  }

  GroupModel.removeMember(groupId, userId);
  const members = GroupModel.getMembers(groupId);
  
  res.json(members);
});

module.exports = router;
