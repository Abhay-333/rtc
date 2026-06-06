import express from 'express';
import protect from '../middlewares/auth.middleware.js';
import ConversationModel from '../models/conversation.model.js';
import GroupModel from '../models/group.model.js';
import MessageModel from '../models/message.model.js';
import GroupMessageModel from '../models/groupmesssage.model.js';
import UserModel from '../models/auth.model.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';

const router = express.Router();

// ==================== ONE-TO-ONE CONVERSATION ROUTES ====================

// Get or create conversation between two users
router.post('/conversation/get-or-create', protect, async (req, res, next) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.id;

    if (!participantId) {
      throw new ApiError(400, 'Participant ID is required');
    }

    // Check if both users exist
    const participant = await UserModel.findById(participantId);
    if (!participant) {
      throw new ApiError(404, 'User not found');
    }

    // Find existing conversation
    let conversation = await ConversationModel.findOne({
      participants: {
        $all: [userId, participantId],
      },
    }).populate('participants', 'name email avatar isOnline lastSeen');

    // Create new conversation if not exists
    if (!conversation) {
      conversation = await ConversationModel.create({
        participants: [userId, participantId],
      });

      await conversation.populate('participants', 'name email avatar isOnline lastSeen');
    }

    return res.status(200).json(
      new ApiResponse(200, conversation, 'Conversation retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Get all conversations for current user
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // fetch conversations and include lastMessage and unreadCount per conversation
    const conversations = await ConversationModel.find({ participants: userId })
      .populate('participants', 'name email avatar isOnline lastSeen')
      .sort({ updatedAt: -1 });

    const enriched = await Promise.all(conversations.map(async (conv) => {
      const lastMsg = await MessageModel.findOne({ conversationId: conv._id }).sort({ createdAt: -1 }).populate('sender', 'name email avatar');
      const unreadCount = await MessageModel.countDocuments({ conversationId: conv._id, deleted: { $ne: true }, readBy: { $nin: [userId] } });
      return {
        ...conv.toObject(),
        lastMessage: lastMsg ? {
          messageId: lastMsg._id,
          text: lastMsg.deleted ? null : lastMsg.text,
          sender: lastMsg.sender ? { _id: lastMsg.sender._id, name: lastMsg.sender.name } : null,
          createdAt: lastMsg ? lastMsg.createdAt : null,
          deleted: !!lastMsg?.deleted,
        } : null,
        unreadCount,
      };
    }));

    return res.status(200).json(
      new ApiResponse(200, enriched, 'Conversations retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId/messages', protect, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of conversation
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation || !conversation.participants.includes(req.user.id)) {
      throw new ApiError(403, 'Not authorized to view this conversation');
    }

    const skip = (page - 1) * limit;

    const messages = await MessageModel.find({
      conversationId,
    })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await MessageModel.countDocuments({ conversationId });

    return res.status(200).json(
      new ApiResponse(200, {
        messages: messages.reverse(),
        totalMessages,
        page: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
      }, 'Messages retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
});

// ==================== GROUP ROUTES ====================

// Create group
router.post('/group/create', protect, async (req, res, next) => {
  try {
    const { groupName, groupImage, memberIds } = req.body;
    const userId = req.user.id;

    if (!groupName || !groupName.trim()) {
      throw new ApiError(400, 'Group name is required');
    }

    // Create group with current user as admin
    const group = await GroupModel.create({
      groupName,
      groupImage: groupImage || '',
      admin: userId,
      members: [userId, ...(memberIds || [])],
    });

    await group.populate('admin', 'name email avatar');
    await group.populate('members', 'name email avatar isOnline lastSeen');

    return res.status(201).json(
      new ApiResponse(201, group, 'Group created successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Get all groups for current user
router.get('/groups', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const groups = await GroupModel.find({
      members: userId,
    })
      .populate('admin', 'name email avatar')
      .populate('members', 'name email avatar isOnline lastSeen')
      .sort({ updatedAt: -1 });

    return res.status(200).json(
      new ApiResponse(200, groups, 'Groups retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Get group details
router.get('/group/:groupId', protect, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await GroupModel.findById(groupId)
      .populate('admin', 'name email avatar')
      .populate('members', 'name email avatar isOnline lastSeen');

    if (!group) {
      throw new ApiError(404, 'Group not found');
    }

    if (!group.members.find(member => member._id.toString() === userId)) {
      throw new ApiError(403, 'Not a member of this group');
    }

    return res.status(200).json(
      new ApiResponse(200, group, 'Group retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Get messages for a group
router.get('/group/:groupId/messages', protect, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    // Verify user is member of group
    const group = await GroupModel.findById(groupId);
    if (!group || !group.members.includes(userId)) {
      throw new ApiError(403, 'Not authorized to view this group');
    }

    const skip = (page - 1) * limit;

    const messages = await GroupMessageModel.find({
      groupId,
    })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await GroupMessageModel.countDocuments({ groupId });

    return res.status(200).json(
      new ApiResponse(200, {
        messages: messages.reverse(),
        totalMessages,
        page: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
      }, 'Group messages retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Update group (admin only)
router.put('/group/:groupId/update', protect, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { groupName, groupImage } = req.body;
    const userId = req.user.id;

    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new ApiError(404, 'Group not found');
    }

    if (group.admin.toString() !== userId) {
      throw new ApiError(403, 'Only admin can update group');
    }

    if (groupName) group.groupName = groupName;
    if (groupImage) group.groupImage = groupImage;

    await group.save();

    await group.populate('admin', 'name email avatar');
    await group.populate('members', 'name email avatar isOnline lastSeen');

    return res.status(200).json(
      new ApiResponse(200, group, 'Group updated successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Add member to group (admin only)
router.post('/group/:groupId/add-member', protect, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new ApiError(404, 'Group not found');
    }

    if (group.admin.toString() !== userId) {
      throw new ApiError(403, 'Only admin can add members');
    }

    // Check if user exists
    const user = await UserModel.findById(memberId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if already a member
    if (group.members.includes(memberId)) {
      throw new ApiError(400, 'User is already a member of this group');
    }

    group.members.push(memberId);
    await group.save();

    await group.populate('admin', 'name email avatar');
    await group.populate('members', 'name email avatar isOnline lastSeen');

    return res.status(200).json(
      new ApiResponse(200, group, 'Member added successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Remove member from group (admin only or member removing themselves)
router.delete('/group/:groupId/remove-member/:memberId', protect, async (req, res, next) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user.id;

    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new ApiError(404, 'Group not found');
    }

    // Allow admin to remove anyone, or member to remove themselves
    if (group.admin.toString() !== userId && memberId !== userId) {
      throw new ApiError(403, 'Not authorized to remove member');
    }

    group.members = group.members.filter(id => id.toString() !== memberId);
    await group.save();

    await group.populate('admin', 'name email avatar');
    await group.populate('members', 'name email avatar isOnline lastSeen');

    return res.status(200).json(
      new ApiResponse(200, group, 'Member removed successfully')
    );
  } catch (error) {
    next(error);
  }
});

// Delete group (admin only)
router.delete('/group/:groupId/delete', protect, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await GroupModel.findById(groupId);
    if (!group) {
      throw new ApiError(404, 'Group not found');
    }

    if (group.admin.toString() !== userId) {
      throw new ApiError(403, 'Only admin can delete group');
    }

    await GroupModel.findByIdAndDelete(groupId);
    await GroupMessageModel.deleteMany({ groupId });

    return res.status(200).json(
      new ApiResponse(200, null, 'Group deleted successfully')
    );
  } catch (error) {
    next(error);
  }
});

export default router;
