/**
 * Socket.IO Chat Client Example (React)
 * 
 * This is a comprehensive example showing how to use the Socket.IO chat API
 * from a React frontend application.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Custom Hook for Socket.IO Chat
 */
export const useSocketChat = (token) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(new Map());

  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    const socket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Connected to chat server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
      setIsConnected(false);
    });

    socket.on('userOnline', (data) => {
      setActiveUsers(prev => new Map(prev).set(data.userId, true));
    });

    socket.on('userOffline', (data) => {
      setActiveUsers(prev => {
        const updated = new Map(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return {
    socket: socketRef.current,
    isConnected,
    activeUsers,
  };
};

/**
 * One-to-One Chat Component
 */
export const OneToOneChatComponent = ({ conversationId, recipientId, token }) => {
  const { socket, isConnected } = useSocketChat(token);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Join conversation room on mount
  useEffect(() => {
    if (socket && isConnected && conversationId) {
      socket.emit('joinPersonalRoom', { conversationId });
    }
  }, [socket, isConnected, conversationId]);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (data) => {
      setMessages(prev => [...prev, data]);
    };

    const handleUserTyping = (data) => {
      if (data.conversationId === conversationId) {
        setOtherUserTyping(true);
      }
    };

    const handleUserStoppedTyping = (data) => {
      if (data.conversationId === conversationId) {
        setOtherUserTyping(false);
      }
    };

    const handleMessageReadStatusUpdated = (data) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.messageId === data.messageId
            ? { ...msg, readBy: data.readBy }
            : msg
        )
      );
    };

    socket.on('messageReceived', handleMessageReceived);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);
    socket.on('messageReadStatusUpdated', handleMessageReadStatusUpdated);

    return () => {
      socket.off('messageReceived', handleMessageReceived);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      socket.off('messageReadStatusUpdated', handleMessageReadStatusUpdated);
    };
  }, [socket, conversationId]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setMessageText(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      socket?.emit('typingStart', { conversationId });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket?.emit('typingStop', { conversationId });
    }, 3000);
  };

  // Send message
  const handleSendMessage = () => {
    if (!messageText.trim() || !socket) return;

    socket.emit('sendMessage', {
      conversationId,
      recipientId,
      text: messageText.trim(),
    });

    setMessageText('');
    setIsTyping(false);
  };

  // Mark message as read when viewed
  useEffect(() => {
    messages.forEach(msg => {
      if (!msg.readBy.includes(recipientId)) {
        socket?.emit('markMessageAsRead', { messageId: msg.messageId });
      }
    });
  }, [messages, socket, recipientId]);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.messageId} className="message">
            <strong>{msg.sender.name}:</strong>
            <p>{msg.text}</p>
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
            {msg.readBy.length > 1 && <span className="read-receipt">✓✓</span>}
          </div>
        ))}
        {otherUserTyping && <div className="typing-indicator">User is typing...</div>}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={messageText}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button onClick={handleSendMessage} disabled={!isConnected || !messageText.trim()}>
          Send
        </button>
      </div>
    </div>
  );
};

/**
 * Group Chat Component
 */
export const GroupChatComponent = ({ groupId, token }) => {
  const { socket, isConnected } = useSocketChat(token);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [groupInfo, setGroupInfo] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);

  // Fetch group info and join room
  useEffect(() => {
    if (!token || !groupId) return;

    const fetchGroupInfo = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/group/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroupInfo(response.data.data);
      } catch (error) {
        console.error('Error fetching group info:', error);
      }
    };

    if (socket && isConnected) {
      socket.emit('joinGroupRoom', { groupId });
      fetchGroupInfo();
    }

    return () => {
      if (socket) {
        socket.emit('leaveGroupRoom', { groupId });
      }
    };
  }, [socket, isConnected, groupId, token]);

  // Listen for group chat events
  useEffect(() => {
    if (!socket) return;

    const handleGroupMessageReceived = (data) => {
      setMessages(prev => [...prev, data]);
    };

    const handleGroupUserTyping = (data) => {
      setTypingUsers(prev => new Set(prev).add(data.userId));
    };

    const handleGroupUserStoppedTyping = (data) => {
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    };

    const handleUserJoinedGroup = (data) => {
      console.log(`User ${data.userId} joined the group`);
    };

    socket.on('groupMessageReceived', handleGroupMessageReceived);
    socket.on('groupUserTyping', handleGroupUserTyping);
    socket.on('groupUserStoppedTyping', handleGroupUserStoppedTyping);
    socket.on('userJoinedGroup', handleUserJoinedGroup);

    return () => {
      socket.off('groupMessageReceived', handleGroupMessageReceived);
      socket.off('groupUserTyping', handleGroupUserTyping);
      socket.off('groupUserStoppedTyping', handleGroupUserStoppedTyping);
      socket.off('userJoinedGroup', handleUserJoinedGroup);
    };
  }, [socket]);

  // Handle typing
  const handleInputChange = (e) => {
    setMessageText(e.target.value);

    socket?.emit('groupTypingStart', { groupId });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('groupTypingStop', { groupId });
    }, 3000);
  };

  // Send group message
  const handleSendMessage = () => {
    if (!messageText.trim() || !socket) return;

    socket.emit('sendGroupMessage', {
      groupId,
      text: messageText.trim(),
    });

    setMessageText('');
  };

  return (
    <div className="group-chat-container">
      <div className="group-header">
        <h2>{groupInfo?.groupName}</h2>
        <p>Members: {groupInfo?.members.length}</p>
      </div>

      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.messageId} className="message">
            <strong>{msg.sender.name}:</strong>
            <p>{msg.text}</p>
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={messageText}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button onClick={handleSendMessage} disabled={!isConnected || !messageText.trim()}>
          Send
        </button>
      </div>
    </div>
  );
};

/**
 * Chat Conversations List Component
 */
export const ConversationsListComponent = ({ token, onSelectConversation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchConversations = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(response.data.data);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [token]);

  if (loading) return <div>Loading conversations...</div>;

  return (
    <div className="conversations-list">
      {conversations.map(conv => {
        const otherUser = conv.participants.find(p => p._id !== localStorage.getItem('userId'));
        return (
          <div
            key={conv._id}
            className="conversation-item"
            onClick={() => onSelectConversation(conv._id, otherUser._id)}
          >
            <strong>{otherUser?.name}</strong>
            <small>{new Date(conv.updatedAt).toLocaleDateString()}</small>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Groups List Component
 */
export const GroupsListComponent = ({ token, onSelectGroup }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchGroups = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/chat/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroups(response.data.data);
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [token]);

  if (loading) return <div>Loading groups...</div>;

  return (
    <div className="groups-list">
      {groups.map(group => (
        <div
          key={group._id}
          className="group-item"
          onClick={() => onSelectGroup(group._id)}
        >
          <strong>{group.groupName}</strong>
          <small>{group.members.length} members</small>
        </div>
      ))}
    </div>
  );
};

/**
 * Main Chat Application Component
 */
export const ChatApplication = ({ token, userId }) => {
  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [recipientId, setRecipientId] = useState(null);

  const handleSelectConversation = (convId, recipientUserId) => {
    setSelectedConversation(convId);
    setRecipientId(recipientUserId);
    setSelectedGroup(null);
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroup(groupId);
    setSelectedConversation(null);
  };

  return (
    <div className="chat-application">
      <div className="chat-sidebar">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            Conversations
          </button>
          <button
            className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
        </div>

        {activeTab === 'conversations' ? (
          <ConversationsListComponent token={token} onSelectConversation={handleSelectConversation} />
        ) : (
          <GroupsListComponent token={token} onSelectGroup={handleSelectGroup} />
        )}
      </div>

      <div className="chat-main">
        {selectedConversation && recipientId ? (
          <OneToOneChatComponent
            conversationId={selectedConversation}
            recipientId={recipientId}
            token={token}
          />
        ) : selectedGroup ? (
          <GroupChatComponent groupId={selectedGroup} token={token} />
        ) : (
          <div className="no-chat-selected">
            Select a conversation or group to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApplication;
