import jwt from "jsonwebtoken";
import MessageModel from "../models/message.model.js";
import GroupMessageModel from "../models/groupmesssage.model.js";
import UserModel from "../models/auth.model.js";
import ConversationModel from "../models/conversation.model.js";
import GroupModel from "../models/group.model.js";

// Store active user connections (userId -> Set of socketIds)
const activeUsers = new Map();
// Pending hard-delete timers (messageId -> timeoutId)
const pendingHardDeletes = new Map();

const socketHandler = (io) => {
  // Middleware to authenticate socket connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      // attach user name/avatar for convenience (avoid extra DB lookups in events)
      try {
        const user = await UserModel.findById(decoded.id).select('name avatar email');
        if (user) {
          socket.userName = user.name;
          socket.userAvatar = user.avatar;
        }
      } catch (e) {
        // ignore DB lookup errors, not critical
      }
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  // Handle user connection
  io.on("connection", async (socket) => {
    console.log(`User ${socket.userId} connected with socket ID: ${socket.id}`);

    // Store active socket for the user (support multiple devices)
    const existing = activeUsers.get(socket.userId) || new Set();
    existing.add(socket.id);
    activeUsers.set(socket.userId, existing);

    // If this is the first active socket for the user, mark online and notify others
    if (existing.size === 1) {
      try {
        await UserModel.findByIdAndUpdate(socket.userId, { isOnline: true });
      } catch (e) {
        console.error('Error updating user online status:', e);
      }

      socket.broadcast.emit("userOnline", {
        userId: socket.userId,
        socketIds: Array.from(existing),
        timestamp: new Date(),
      });
    } else {
      // Notify other sockets about the new socket connection for the same user
      socket.broadcast.emit("userSocketAdded", {
        userId: socket.userId,
        socketId: socket.id,
        timestamp: new Date(),
      });
    }

    // Auto-join user's personal conversation rooms and groups for seamless delivery
    (async () => {
      try {
        const conversations = await ConversationModel.find({ participants: socket.userId }).select('_id');
        conversations.forEach(c => socket.join(`conversation_${c._id}`));

        const groups = await GroupModel.find({ members: socket.userId }).select('_id');
        groups.forEach(g => socket.join(`group_${g._id}`));
      } catch (err) {
        console.error('Error auto-joining rooms for user:', err);
      }
    })();

    // ==================== ONE-TO-ONE CHAT EVENTS ====================

    // User joins their personal room
    socket.on("joinPersonalRoom", ({ conversationId }) => {
      const room = `conversation_${conversationId}`;
      socket.join(room);
      console.log(
        `User ${socket.userId} joined room: ${room}`
      );
    });

    // Send one-to-one message
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, recipientId, text } = data;

        // Save message to database
        const message = await MessageModel.create({
          conversationId,
          sender: socket.userId,
          text,
          readBy: [socket.userId],
        });

        // Populate message data
        await message.populate("sender", "name email avatar");

        // Emit to conversation room (both sender and recipient)
        const room = `conversation_${conversationId}`;
        const initialDeliveredIST = message.deliveredAt
          ? new Date(message.deliveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : null;

        io.to(room).emit("messageReceived", {
          messageId: message._id,
          conversationId,
          sender: message.sender,
          text: message.text,
          timestamp: message.createdAt,
          readBy: message.readBy,
          deliveredAt: message.deliveredAt || null,
          deliveredAtIST: initialDeliveredIST,
        });

        // Send notification to recipient sockets if online
        if (activeUsers.has(recipientId)) {
          const recipientSockets = activeUsers.get(recipientId);
          for (const sid of recipientSockets) {
            io.to(sid).emit("messageNotification", {
              conversationId,
              senderName: socket.userEmail,
              message: text.substring(0, 50),
            });
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Delete one-to-one message (soft delete)
    socket.on('deleteMessage', async (data) => {
      try {
        const { messageId } = data;
        const message = await MessageModel.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Only sender can delete
        if (message.sender.toString() !== socket.userId) {
          socket.emit('error', { message: 'Not authorized to delete this message' });
          return;
        }

        const deletedAt = new Date();
        await MessageModel.findByIdAndUpdate(messageId, { deleted: true, deletedAt, deletedBy: socket.userId });

        const room = `conversation_${message.conversationId}`;
        const deletedAtIST = new Date(deletedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        io.to(room).emit('messageDeleted', {
          messageId,
          deletedBy: socket.userId,
          deletedByName: socket.userName || socket.userEmail,
          deletedAt,
          deletedAtIST,
        });
        // update conversation unread count / last message for UI
        try {
          const unreadCount = await MessageModel.countDocuments({ conversationId: message.conversationId, deleted: { $ne: true }, readBy: { $nin: [socket.userId] } });
          const lastMsg = await MessageModel.findOne({ conversationId: message.conversationId }).sort({ createdAt: -1 }).populate('sender', 'name');
          io.to(room).emit('conversationUpdated', { conversationId: message.conversationId, unreadCount, lastMessage: lastMsg ? { messageId: lastMsg._id, text: lastMsg.deleted ? null : lastMsg.text, sender: lastMsg.sender ? { _id: lastMsg.sender._id, name: lastMsg.sender.name } : null, createdAt: lastMsg.createdAt, deleted: !!lastMsg.deleted } : null });
        } catch (e) {
          console.error('Error emitting conversationUpdated after delete:', e);
        }
        // schedule server-side hard delete in 30s unless restored
        if (pendingHardDeletes.has(messageId)) {
          clearTimeout(pendingHardDeletes.get(messageId));
          pendingHardDeletes.delete(messageId);
        }
        const t = setTimeout(async () => {
          try {
            const m = await MessageModel.findById(messageId);
            if (m && m.deleted) {
              await MessageModel.findByIdAndDelete(messageId);
              io.to(room).emit('messageHardDeleted', { messageId });
            }
          } catch (e) {
            console.error('Error during scheduled hard delete:', e);
          } finally {
            pendingHardDeletes.delete(messageId);
          }
        }, 30000);
        pendingHardDeletes.set(messageId, t);
      } catch (err) {
        console.error('Error deleting message:', err);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Mark message as read in one-to-one chat
    socket.on("markMessageAsRead", async (data) => {
      try {
        const { messageId } = data;

        const message = await MessageModel.findByIdAndUpdate(
          messageId,
          {
            $addToSet: { readBy: socket.userId },
          },
          { new: true }
        );

        const room = `conversation_${message.conversationId}`;
        // set deliveredAt when message is read by someone else (first delivery)
        let deliveredAt = message.deliveredAt;
        if (message.readBy.length > 1 && !deliveredAt) {
          deliveredAt = new Date();
          await MessageModel.findByIdAndUpdate(messageId, { deliveredAt }, { new: true });
        }

        const deliveredAtIST = deliveredAt
          ? new Date(deliveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : null;

        io.to(room).emit("messageReadStatusUpdated", {
          messageId,
          readBy: message.readBy,
          deliveredAt: deliveredAt || null,
          deliveredAtIST,
        });
        // emit conversation updated (unread count)
        try {
          const unreadCount = await MessageModel.countDocuments({ conversationId: message.conversationId, deleted: { $ne: true }, readBy: { $nin: [socket.userId] } });
          io.to(room).emit('conversationUpdated', { conversationId: message.conversationId, unreadCount });
        } catch (e) {
          console.error('Error emitting conversationUpdated:', e);
        }
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    });

    // ==================== GROUP CHAT EVENTS ====================

    // User joins a group room
    socket.on("joinGroupRoom", ({ groupId }) => {
      const room = `group_${groupId}`;
      socket.join(room);
      console.log(`User ${socket.userId} joined group room: ${room}`);

      // Notify others in group
      socket.to(room).emit("userJoinedGroup", {
        userId: socket.userId,
        groupId,
        timestamp: new Date(),
      });
    });

    // Leave group room
    socket.on("leaveGroupRoom", ({ groupId }) => {
      const room = `group_${groupId}`;
      socket.leave(room);
      console.log(`User ${socket.userId} left group room: ${room}`);

      io.to(room).emit("userLeftGroup", {
        userId: socket.userId,
        groupId,
        timestamp: new Date(),
      });
    });

    // Send group message
    socket.on("sendGroupMessage", async (data) => {
      try {
        const { groupId, text } = data;

        // Save group message to database
        const groupMessage = await GroupMessageModel.create({
          groupId,
          sender: socket.userId,
          text,
          readBy: [socket.userId],
        });

        // Populate sender information
        await groupMessage.populate("sender", "name email avatar");

        // Emit to all users in group room
        const room = `group_${groupId}`;
        const initialGroupDeliveredIST = groupMessage.deliveredAt
          ? new Date(groupMessage.deliveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : null;

        io.to(room).emit("groupMessageReceived", {
          messageId: groupMessage._id,
          groupId,
          sender: groupMessage.sender,
          text: groupMessage.text,
          timestamp: groupMessage.createdAt,
          readBy: groupMessage.readBy,
          deliveredAt: groupMessage.deliveredAt || null,
          deliveredAtIST: initialGroupDeliveredIST,
        });
      } catch (error) {
        console.error("Error sending group message:", error);
        socket.emit("error", { message: "Failed to send group message" });
      }
    });

    // Mark group message as read
    socket.on("markGroupMessageAsRead", async (data) => {
      try {
        const { messageId } = data;

        const message = await GroupMessageModel.findByIdAndUpdate(
          messageId,
          {
            $addToSet: { readBy: socket.userId },
          },
          { new: true }
        );

        const room = `group_${message.groupId}`;
        // set deliveredAt when group message read by someone else
        let deliveredAt = message.deliveredAt;
        if (message.readBy.length > 1 && !deliveredAt) {
          deliveredAt = new Date();
          await GroupMessageModel.findByIdAndUpdate(messageId, { deliveredAt }, { new: true });
        }

        const deliveredAtIST = deliveredAt
          ? new Date(deliveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : null;

        io.to(room).emit("groupMessageReadStatusUpdated", {
          messageId,
          readBy: message.readBy,
          deliveredAt: deliveredAt || null,
          deliveredAtIST,
        });
      } catch (error) {
        console.error("Error marking group message as read:", error);
      }
    });

    // Delete group message (soft delete)
    socket.on('deleteGroupMessage', async (data) => {
      try {
        const { messageId } = data;
        const message = await GroupMessageModel.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Group message not found' });
          return;
        }

        // Allow delete if sender or group admin
        const group = await GroupModel.findById(message.groupId);
        const isAdmin = group && group.admin && group.admin.toString() === socket.userId;
        if (message.sender.toString() !== socket.userId && !isAdmin) {
          socket.emit('error', { message: 'Not authorized to delete this group message' });
          return;
        }

        const deletedAt = new Date();
        await GroupMessageModel.findByIdAndUpdate(messageId, { deleted: true, deletedAt, deletedBy: socket.userId });

        const room = `group_${message.groupId}`;
        const deletedAtIST = new Date(deletedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        io.to(room).emit('groupMessageDeleted', {
          messageId,
          deletedBy: socket.userId,
          deletedByName: socket.userName || socket.userEmail,
          deletedAt,
          deletedAtIST,
        });
        // schedule server-side hard delete in 30s unless restored
        if (pendingHardDeletes.has(messageId)) {
          clearTimeout(pendingHardDeletes.get(messageId));
          pendingHardDeletes.delete(messageId);
        }
        const t = setTimeout(async () => {
          try {
            const m = await GroupMessageModel.findById(messageId);
            if (m && m.deleted) {
              await GroupMessageModel.findByIdAndDelete(messageId);
              io.to(room).emit('groupMessageHardDeleted', { messageId });
            }
          } catch (e) {
            console.error('Error during scheduled hard delete (group):', e);
          } finally {
            pendingHardDeletes.delete(messageId);
          }
        }, 30000);
        pendingHardDeletes.set(messageId, t);
      } catch (err) {
        console.error('Error deleting group message:', err);
        socket.emit('error', { message: 'Failed to delete group message' });
      }
    });

    // Hard delete one-to-one message (permanent)
    socket.on('hardDeleteMessage', async (data) => {
      try {
        const { messageId } = data;
        const message = await MessageModel.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Only sender can hard delete
        if (message.sender.toString() !== socket.userId) {
          socket.emit('error', { message: 'Not authorized to delete this message' });
          return;
        }

        await MessageModel.findByIdAndDelete(messageId);
        if (pendingHardDeletes.has(messageId)) {
          clearTimeout(pendingHardDeletes.get(messageId));
          pendingHardDeletes.delete(messageId);
        }
        const room = `conversation_${message.conversationId}`;
        io.to(room).emit('messageHardDeleted', { messageId });
        // update conversation after hard delete
        try {
          const unreadCount = await MessageModel.countDocuments({ conversationId: message.conversationId, deleted: { $ne: true }, readBy: { $nin: [socket.userId] } });
          const lastMsg = await MessageModel.findOne({ conversationId: message.conversationId }).sort({ createdAt: -1 }).populate('sender', 'name');
          io.to(room).emit('conversationUpdated', { conversationId: message.conversationId, unreadCount, lastMessage: lastMsg ? { messageId: lastMsg._id, text: lastMsg.deleted ? null : lastMsg.text, sender: lastMsg.sender ? { _id: lastMsg.sender._id, name: lastMsg.sender.name } : null, createdAt: lastMsg.createdAt, deleted: !!lastMsg.deleted } : null });
        } catch (e) {
          console.error('Error emitting conversationUpdated after hard delete:', e);
        }
      } catch (err) {
        console.error('Error hard-deleting message:', err);
        socket.emit('error', { message: 'Failed to hard-delete message' });
      }
    });

    // Hard delete group message (permanent)
    socket.on('hardDeleteGroupMessage', async (data) => {
      try {
        const { messageId } = data;
        const message = await GroupMessageModel.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Group message not found' });
          return;
        }

        const group = await GroupModel.findById(message.groupId);
        const isAdmin = group && group.admin && group.admin.toString() === socket.userId;
        if (message.sender.toString() !== socket.userId && !isAdmin) {
          socket.emit('error', { message: 'Not authorized to delete this group message' });
          return;
        }

        await GroupMessageModel.findByIdAndDelete(messageId);
        if (pendingHardDeletes.has(messageId)) {
          clearTimeout(pendingHardDeletes.get(messageId));
          pendingHardDeletes.delete(messageId);
        }
        const room = `group_${message.groupId}`;
        io.to(room).emit('groupMessageHardDeleted', { messageId });
      } catch (err) {
        console.error('Error hard-deleting group message:', err);
        socket.emit('error', { message: 'Failed to hard-delete group message' });
      }
    });

    // Restore soft-deleted one-to-one message
    socket.on('restoreMessage', async (data) => {
      try {
        const { messageId } = data;
        const message = await MessageModel.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // authorize: allow if deletedBy is requester or original sender
        if (message.deletedBy && message.deletedBy.toString() !== socket.userId && message.sender.toString() !== socket.userId) {
          socket.emit('error', { message: 'Not authorized to restore this message' });
          return;
        }

        await MessageModel.findByIdAndUpdate(messageId, { deleted: false, deletedAt: null, deletedBy: null });

        const room = `conversation_${message.conversationId}`;
        io.to(room).emit('messageRestored', { messageId, restoredBy: socket.userId, restoredByName: socket.userName || socket.userEmail });
        // cancel scheduled hard delete if present
        if (pendingHardDeletes.has(messageId)) {
          clearTimeout(pendingHardDeletes.get(messageId));
          pendingHardDeletes.delete(messageId);
        }
        // update conversation after restore
        try {
          const unreadCount = await MessageModel.countDocuments({ conversationId: message.conversationId, deleted: { $ne: true }, readBy: { $nin: [socket.userId] } });
          const lastMsg = await MessageModel.findOne({ conversationId: message.conversationId }).sort({ createdAt: -1 }).populate('sender', 'name');
          io.to(room).emit('conversationUpdated', { conversationId: message.conversationId, unreadCount, lastMessage: lastMsg ? { messageId: lastMsg._id, text: lastMsg.deleted ? null : lastMsg.text, sender: lastMsg.sender ? { _id: lastMsg.sender._id, name: lastMsg.sender.name } : null, createdAt: lastMsg.createdAt, deleted: !!lastMsg.deleted } : null });
        } catch (e) {
          console.error('Error emitting conversationUpdated after restore:', e);
        }
      } catch (err) {
        console.error('Error restoring message:', err);
        socket.emit('error', { message: 'Failed to restore message' });
      }
    });

    // Restore soft-deleted group message
    socket.on('restoreGroupMessage', async (data) => {
      try {
        const { messageId } = data;
        const message = await GroupMessageModel.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Group message not found' });
          return;
        }

        const group = await GroupModel.findById(message.groupId);
        const isAdmin = group && group.admin && group.admin.toString() === socket.userId;

        // authorize: allow if deletedBy is requester, original sender, or group admin
        if (message.deletedBy && message.deletedBy.toString() !== socket.userId && message.sender.toString() !== socket.userId && !isAdmin) {
          socket.emit('error', { message: 'Not authorized to restore this group message' });
          return;
        }

        await GroupMessageModel.findByIdAndUpdate(messageId, { deleted: false, deletedAt: null, deletedBy: null });

        const room = `group_${message.groupId}`;
        io.to(room).emit('groupMessageRestored', { messageId, restoredBy: socket.userId, restoredByName: socket.userName || socket.userEmail });
        if (pendingHardDeletes.has(messageId)) {
          clearTimeout(pendingHardDeletes.get(messageId));
          pendingHardDeletes.delete(messageId);
        }
      } catch (err) {
        console.error('Error restoring group message:', err);
        socket.emit('error', { message: 'Failed to restore group message' });
      }
    });

    // Typing indicator for groups
    socket.on("groupTypingStart", ({ groupId }) => {
      const room = `group_${groupId}`;
      socket.to(room).emit("groupUserTyping", {
        userId: socket.userId,
        userName: socket.userName || socket.userEmail,
        groupId,
      });
    });

    socket.on("groupTypingStop", ({ groupId }) => {
      const room = `group_${groupId}`;
      socket.to(room).emit("groupUserStoppedTyping", {
        userId: socket.userId,
        userName: socket.userName || socket.userEmail,
        groupId,
      });
    });

    // Typing indicator for one-to-one chats
    socket.on("typingStart", ({ conversationId }) => {
      const room = `conversation_${conversationId}`;
      socket.to(room).emit("userTyping", {
        userId: socket.userId,
        userName: socket.userName || socket.userEmail,
        conversationId,
      });
    });

    socket.on("typingStop", ({ conversationId }) => {
      const room = `conversation_${conversationId}`;
      socket.to(room).emit("userStoppedTyping", {
        userId: socket.userId,
        userName: socket.userName || socket.userEmail,
        conversationId,
      });
    });

    // ==================== GROUP MANAGEMENT EVENTS ====================

    // User joins group (admin adds user or user accepts invite)
    socket.on("addUserToGroup", async (data) => {
      try {
        const { groupId, newUserId } = data;

        const group = await GroupModel.findById(groupId);
        if (!group) {
          socket.emit("error", { message: "Group not found" });
          return;
        }

        // Check if user is admin
        if (group.admin.toString() !== socket.userId) {
          socket.emit("error", { message: "Only admin can add users" });
          return;
        }

        // Add user to group
        if (!group.members.includes(newUserId)) {
          group.members.push(newUserId);
          await group.save();
        }

        // Emit event to all users in group
        const room = `group_${groupId}`;
        io.to(room).emit("userAddedToGroup", {
          groupId,
          newUserId,
          groupName: group.groupName,
        });

        // Notify new user on all active sockets
        if (activeUsers.has(newUserId)) {
          const userSockets = activeUsers.get(newUserId);
          for (const sid of userSockets) {
            io.to(sid).emit("addedToGroup", {
              groupId,
              groupName: group.groupName,
            });
          }
        }
      } catch (error) {
        console.error("Error adding user to group:", error);
        socket.emit("error", { message: "Failed to add user to group" });
      }
    });

    // Remove user from group
    socket.on("removeUserFromGroup", async (data) => {
      try {
        const { groupId, userId } = data;

        const group = await GroupModel.findById(groupId);
        if (!group) {
          socket.emit("error", { message: "Group not found" });
          return;
        }

        // Check if user is admin or removing themselves
        if (
          group.admin.toString() !== socket.userId &&
          userId !== socket.userId
        ) {
          socket.emit("error", { message: "Not authorized" });
          return;
        }

        // Remove user from group
        group.members = group.members.filter((id) => id.toString() !== userId);
        await group.save();

        const room = `group_${groupId}`;
        io.to(room).emit("userRemovedFromGroup", {
          groupId,
          userId,
        });
      } catch (error) {
        console.error("Error removing user from group:", error);
        socket.emit("error", { message: "Failed to remove user from group" });
      }
    });

    // Handle user disconnect
    socket.on("disconnect", async () => {
      console.log(`User ${socket.userId} disconnected (socket ${socket.id})`);

      // Remove this socket from the user's set
      try {
        const sockets = activeUsers.get(socket.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            activeUsers.delete(socket.userId);
            // Update user online status in database
            try {
              await UserModel.findByIdAndUpdate(socket.userId, {
                isOnline: false,
                lastSeen: new Date(),
              });
            } catch (error) {
              console.error("Error updating user status:", error);
            }

            // Broadcast user offline status
            socket.broadcast.emit("userOffline", {
              userId: socket.userId,
              timestamp: new Date(),
            });
          } else {
            // Notify remaining sockets that one socket disconnected
            socket.broadcast.emit("userSocketRemoved", {
              userId: socket.userId,
              socketId: socket.id,
              timestamp: new Date(),
            });
          }
        }
      } catch (err) {
        console.error('Error handling disconnect:', err);
      }
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });
};

export default socketHandler;
