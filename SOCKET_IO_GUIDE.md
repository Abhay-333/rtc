# Socket.IO Chat Application Guide

A real-time chat application built with Socket.IO supporting one-to-one and group messaging with room-based architecture.

## Features

- ✅ **One-to-One Chat**: Direct messaging between two users
- ✅ **Group Chat**: Chat with multiple users in a room
- ✅ **Room-Based Architecture**: Users automatically join/leave rooms
- ✅ **Typing Indicators**: Real-time typing notifications
- ✅ **Read Receipts**: Track message read status
- ✅ **Online Status**: See who's online/offline
- ✅ **Message History**: Persist all messages in database
- ✅ **Group Management**: Create, update, add/remove members, delete groups
- ✅ **Pagination**: Load messages with pagination support

## Installation

### Backend Setup

1. **Install Socket.IO Package** (already included in package.json)
```bash
npm install socket.io http
```

2. **Environment Variables** (add to .env)
```env
PORT=5000
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret_key
MONGODB_URI=your_mongodb_connection_string
```

## API Endpoints

### Conversation Management

#### 1. Get or Create Conversation
```
POST /api/chat/conversation/get-or-create
Headers: { Authorization: Bearer token }
Body: { participantId: "userId" }
Response: { _id, participants: [user1, user2] }
```

#### 2. Get All Conversations for Current User
```
GET /api/chat/conversations
Headers: { Authorization: Bearer token }
Response: [{ _id, participants, updatedAt }, ...]
```

#### 3. Get Messages from a Conversation
```
GET /api/chat/conversation/:conversationId/messages?page=1&limit=50
Headers: { Authorization: Bearer token }
Response: { messages: [], totalMessages, page, totalPages }
```

### Group Management

#### 1. Create Group
```
POST /api/chat/group/create
Headers: { Authorization: Bearer token }
Body: { 
  groupName: "Group Name",
  groupImage: "imageUrl",
  memberIds: ["userId1", "userId2"]
}
Response: { _id, groupName, admin, members }
```

#### 2. Get All User's Groups
```
GET /api/chat/groups
Headers: { Authorization: Bearer token }
Response: [{ _id, groupName, admin, members }, ...]
```

#### 3. Get Group Details
```
GET /api/chat/group/:groupId
Headers: { Authorization: Bearer token }
Response: { _id, groupName, admin, members, updatedAt }
```

#### 4. Get Group Messages
```
GET /api/chat/group/:groupId/messages?page=1&limit=50
Headers: { Authorization: Bearer token }
Response: { messages: [], totalMessages, page, totalPages }
```

#### 5. Update Group (Admin Only)
```
PUT /api/chat/group/:groupId/update
Headers: { Authorization: Bearer token }
Body: { groupName: "New Name", groupImage: "newImageUrl" }
Response: { _id, groupName, groupImage, ... }
```

#### 6. Add Member to Group (Admin Only)
```
POST /api/chat/group/:groupId/add-member
Headers: { Authorization: Bearer token }
Body: { memberId: "userId" }
Response: { _id, members: [..., newMember] }
```

#### 7. Remove Member from Group
```
DELETE /api/chat/group/:groupId/remove-member/:memberId
Headers: { Authorization: Bearer token }
Response: { _id, members: [updatedMembers] }
```

#### 8. Delete Group (Admin Only)
```
DELETE /api/chat/group/:groupId/delete
Headers: { Authorization: Bearer token }
Response: { success: true }
```

## Socket.IO Events

### Connection

#### Connect with Authentication
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'jwt_token_from_login'
  }
});
```

### One-to-One Chat Events

#### Join Conversation
```javascript
socket.emit('joinPersonalRoom', { 
  conversationId: 'conversationId' 
});
```

#### Send Message
```javascript
socket.emit('sendMessage', {
  conversationId: 'conversationId',
  recipientId: 'userId',
  text: 'Hello!'
});

// Listen for incoming messages
socket.on('messageReceived', (data) => {
  console.log(data); // { messageId, conversationId, sender, text, timestamp, readBy }
});
```

#### Mark Message as Read
```javascript
socket.emit('markMessageAsRead', {
  messageId: 'messageId'
});

// Listen for read status updates
socket.on('messageReadStatusUpdated', (data) => {
  console.log(data); // { messageId, readBy: [userId1, userId2] }
});
```

#### Typing Indicators
```javascript
// Notify others that user is typing
socket.emit('typingStart', { conversationId: 'conversationId' });

// Notify others that user stopped typing
socket.emit('typingStop', { conversationId: 'conversationId' });

// Listen for typing notifications
socket.on('userTyping', (data) => {
  console.log(data); // { userId, conversationId }
});

socket.on('userStoppedTyping', (data) => {
  console.log(data); // { userId, conversationId }
});
```

### Group Chat Events

#### Join Group Room
```javascript
socket.emit('joinGroupRoom', {
  groupId: 'groupId'
});

socket.on('userJoinedGroup', (data) => {
  console.log(data); // { userId, groupId, timestamp }
});
```

#### Leave Group Room
```javascript
socket.emit('leaveGroupRoom', {
  groupId: 'groupId'
});

socket.on('userLeftGroup', (data) => {
  console.log(data); // { userId, groupId, timestamp }
});
```

#### Send Group Message
```javascript
socket.emit('sendGroupMessage', {
  groupId: 'groupId',
  text: 'Hello group!'
});

// Listen for incoming group messages
socket.on('groupMessageReceived', (data) => {
  console.log(data); // { messageId, groupId, sender, text, timestamp, readBy }
});
```

#### Mark Group Message as Read
```javascript
socket.emit('markGroupMessageAsRead', {
  messageId: 'messageId'
});

socket.on('groupMessageReadStatusUpdated', (data) => {
  console.log(data); // { messageId, readBy: [userId1, userId2] }
});
```

#### Group Typing Indicators
```javascript
socket.emit('groupTypingStart', { groupId: 'groupId' });
socket.emit('groupTypingStop', { groupId: 'groupId' });

socket.on('groupUserTyping', (data) => {
  console.log(data); // { userId, groupId }
});

socket.on('groupUserStoppedTyping', (data) => {
  console.log(data); // { userId, groupId }
});
```

### Group Management Events (Socket)

#### Add User to Group
```javascript
socket.emit('addUserToGroup', {
  groupId: 'groupId',
  newUserId: 'userId'
});

// User being added receives:
socket.on('addedToGroup', (data) => {
  console.log(data); // { groupId, groupName }
});

// All group members receive:
socket.on('userAddedToGroup', (data) => {
  console.log(data); // { groupId, newUserId, groupName }
});
```

#### Remove User from Group
```javascript
socket.emit('removeUserFromGroup', {
  groupId: 'groupId',
  userId: 'userId'
});

socket.on('userRemovedFromGroup', (data) => {
  console.log(data); // { groupId, userId }
});
```

### User Status Events

#### User Online/Offline
```javascript
// When a user connects
socket.on('userOnline', (data) => {
  console.log(data); // { userId, socketId, timestamp }
});

// When a user disconnects
socket.on('userOffline', (data) => {
  console.log(data); // { userId, timestamp }
});
```

#### Message Notifications
```javascript
socket.on('messageNotification', (data) => {
  console.log(data); // { conversationId, senderName, message }
});
```

## Frontend Integration Example

### React Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const ChatComponent = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    // Connect to Socket.IO
    const token = localStorage.getItem('token'); // Get JWT token from localStorage
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('messageReceived', (data) => {
      setMessages(prev => [...prev, data]);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, []);

  const joinConversation = (convId) => {
    setConversationId(convId);
    socket?.emit('joinPersonalRoom', { conversationId: convId });
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    
    socket?.emit('sendMessage', {
      conversationId,
      recipientId: 'recipientUserId',
      text
    });
    
    setText('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <strong>{msg.sender.name}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default ChatComponent;
```

## Room Structure

### One-to-One Chat Rooms
```
Room Name: conversation_{conversationId}
Participants: 2 users
Events: sendMessage, markMessageAsRead, typingStart, typingStop
```

### Group Chat Rooms
```
Room Name: group_{groupId}
Participants: Multiple users (group members)
Events: sendGroupMessage, markGroupMessageAsRead, groupTypingStart, groupTypingStop
```

## Database Models

### User Model
- name, email, password, avatar, isOnline, lastSeen

### Conversation Model
- participants: [User references]

### Message Model
- conversationId, sender, text, readBy, timestamps

### Group Model
- groupName, groupImage, admin, members

### GroupMessage Model
- groupId, sender, text, readBy, timestamps

## Error Handling

All errors are emitted as Socket.IO events:
```javascript
socket.on('error', (data) => {
  console.error(data.message);
  // Handle error appropriately
});
```

Common errors:
- "Authentication required" - No token provided
- "Invalid token" - Token verification failed
- "Unauthorized user" - User doesn't have permission
- "Group not found" - Invalid group ID
- "Not authorized to view this conversation" - User not in conversation

## Best Practices

1. **Always disconnect cleanly** - Call `socket.disconnect()` when component unmounts
2. **Handle authentication errors** - Implement token refresh if needed
3. **Pagination** - Load messages in chunks to improve performance
4. **Typing indicators** - Implement debouncing to reduce event frequency
5. **User status** - Update UI based on online/offline status
6. **Error handling** - Always listen to 'error' events
7. **Memory management** - Clean up listeners when needed
8. **Rate limiting** - Implement client-side throttling for message sending

## Performance Tips

1. Use pagination for message history (limit: 50 per page)
2. Implement message lazy loading
3. Debounce typing indicators
4. Use message compression for large payloads
5. Archive old messages separately
6. Implement presence system efficiently

## Security Considerations

1. JWT tokens are validated on Socket.IO connection
2. All database operations check user authorization
3. Admin-only operations are verified
4. Messages are only accessible to participants
5. User data is populated selectively (avoid exposing sensitive info)

## Troubleshooting

### Socket Connection Issues
- Check CORS configuration
- Verify JWT token validity
- Check client URL in environment variables

### Messages Not Persisting
- Verify MongoDB connection
- Check mongoose schema definitions
- Ensure proper error handling

### Real-time Updates Not Working
- Verify socket is connected
- Check room names are correct
- Ensure event names match exactly

---

For more information, refer to Socket.IO documentation: https://socket.io/docs/
