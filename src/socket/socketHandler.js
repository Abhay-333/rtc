import jwt from "jsonwebtoken";
import MessageModel from "../models/message.model.js";
import GroupMessageModel from "../models/groupmesssage.model.js";
import UserModel from "../models/auth.model.js";
import ConversationModel from "../models/conversation.model.js";
import GroupModel from "../models/group.model.js";

// Store active user connections (userId -> socketId)
const activeUsers = new Map();

const socketHandler = (io) => {
  // Middleware to authenticate socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  // Handle user connection
  io.on("connection", (socket) => {
    console.log(`User ${socket.userId} connected with socket ID: ${socket.id}`);

    // Store active user
    activeUsers.set(socket.userId, socket.id);

    // Broadcast user online status
    socket.broadcast.emit("userOnline", {
      userId: socket.userId,
      socketId: socket.id,
      timestamp: new Date(),
    });

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
        io.to(room).emit("messageReceived", {
          messageId: message._id,
          conversationId,
          sender: message.sender,
          text: message.text,
          timestamp: message.createdAt,
          readBy: message.readBy,
        });

        // Send notification to recipient if offline
        if (activeUsers.has(recipientId)) {
          const recipientSocketId = activeUsers.get(recipientId);
          io.to(recipientSocketId).emit("messageNotification", {
            conversationId,
            senderName: socket.userEmail,
            message: text.substring(0, 50),
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
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
        io.to(room).emit("messageReadStatusUpdated", {
          messageId,
          readBy: message.readBy,
        });
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
        io.to(room).emit("groupMessageReceived", {
          messageId: groupMessage._id,
          groupId,
          sender: groupMessage.sender,
          text: groupMessage.text,
          timestamp: groupMessage.createdAt,
          readBy: groupMessage.readBy,
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
        io.to(room).emit("groupMessageReadStatusUpdated", {
          messageId,
          readBy: message.readBy,
        });
      } catch (error) {
        console.error("Error marking group message as read:", error);
      }
    });

    // Typing indicator for groups
    socket.on("groupTypingStart", ({ groupId }) => {
      const room = `group_${groupId}`;
      socket.to(room).emit("groupUserTyping", {
        userId: socket.userId,
        groupId,
      });
    });

    socket.on("groupTypingStop", ({ groupId }) => {
      const room = `group_${groupId}`;
      socket.to(room).emit("groupUserStoppedTyping", {
        userId: socket.userId,
        groupId,
      });
    });

    // Typing indicator for one-to-one chats
    socket.on("typingStart", ({ conversationId }) => {
      const room = `conversation_${conversationId}`;
      socket.to(room).emit("userTyping", {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on("typingStop", ({ conversationId }) => {
      const room = `conversation_${conversationId}`;
      socket.to(room).emit("userStoppedTyping", {
        userId: socket.userId,
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

        // Notify new user
        if (activeUsers.has(newUserId)) {
          const userSocketId = activeUsers.get(newUserId);
          io.to(userSocketId).emit("addedToGroup", {
            groupId,
            groupName: group.groupName,
          });
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
      console.log(`User ${socket.userId} disconnected`);

      // Remove user from active users
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
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });
};

export default socketHandler;
