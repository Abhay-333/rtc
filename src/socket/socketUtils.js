/**
 * Socket.IO Utilities for Chat Application
 */

/**
 * Generate room name for one-to-one conversation
 * @param {string} conversationId - ID of the conversation
 * @returns {string} Room name
 */
export const getConversationRoom = (conversationId) => {
  return `conversation_${conversationId}`;
};

/**
 * Generate room name for group
 * @param {string} groupId - ID of the group
 * @returns {string} Room name
 */
export const getGroupRoom = (groupId) => {
  return `group_${groupId}`;
};

/**
 * Validate message object
 * @param {object} message - Message object to validate
 * @returns {boolean} Is valid
 */
export const isValidMessage = (message) => {
  if (!message || typeof message !== 'object') return false;
  if (!message.text || typeof message.text !== 'string') return false;
  if (message.text.trim().length === 0) return false;
  return true;
};

/**
 * Validate conversation object
 * @param {object} conversation - Conversation object
 * @returns {boolean} Is valid
 */
export const isValidConversation = (conversation) => {
  if (!conversation || typeof conversation !== 'object') return false;
  if (!conversation.participants || !Array.isArray(conversation.participants)) {
    return false;
  }
  if (conversation.participants.length !== 2) return false;
  return true;
};

/**
 * Validate group object
 * @param {object} group - Group object
 * @returns {boolean} Is valid
 */
export const isValidGroup = (group) => {
  if (!group || typeof group !== 'object') return false;
  if (!group.groupName || typeof group.groupName !== 'string') return false;
  if (group.groupName.trim().length === 0) return false;
  if (!group.members || !Array.isArray(group.members)) return false;
  return true;
};

/**
 * Debounce function for typing indicators
 * @param {function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  const now = new Date();
  const messageDate = new Date(date);
  
  const diffInSeconds = Math.floor((now - messageDate) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return messageDate.toLocaleDateString();
};

/**
 * Check if user is online
 * @param {object} user - User object
 * @returns {boolean} Is online
 */
export const isUserOnline = (user) => {
  return user && user.isOnline === true;
};

/**
 * Get user's last seen time
 * @param {object} user - User object
 * @returns {string} Last seen string
 */
export const getLastSeenTime = (user) => {
  if (user && user.isOnline) return 'Active now';
  if (user && user.lastSeen) return `Last seen ${formatDate(user.lastSeen)}`;
  return 'Offline';
};

/**
 * Create message object for display
 * @param {object} messageData - Raw message data from socket
 * @returns {object} Formatted message object
 */
export const formatMessageForDisplay = (messageData) => {
  return {
    id: messageData.messageId,
    sender: messageData.sender,
    text: messageData.text,
    timestamp: messageData.timestamp,
    readBy: messageData.readBy,
    isRead: messageData.readBy.length > 1, // Assuming sender is always first
  };
};

/**
 * Get unread message count
 * @param {array} messages - Array of messages
 * @param {string} userId - Current user ID
 * @returns {number} Unread count
 */
export const getUnreadCount = (messages, userId) => {
  if (!Array.isArray(messages)) return 0;
  return messages.filter(msg => {
    return msg.sender._id !== userId && !msg.readBy.includes(userId);
  }).length;
};

export default {
  getConversationRoom,
  getGroupRoom,
  isValidMessage,
  isValidConversation,
  isValidGroup,
  debounce,
  formatDate,
  isUserOnline,
  getLastSeenTime,
  formatMessageForDisplay,
  getUnreadCount,
};
