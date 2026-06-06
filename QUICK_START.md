# Socket.IO Chat Application - Quick Start Guide

## Project Structure

```
backend/
├── src/
│   ├── socket/
│   │   ├── socketHandler.js      # Main socket event handlers
│   │   └── socketUtils.js         # Utility functions
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── chat.routes.js         # NEW: Chat API routes
│   ├── models/
│   │   ├── auth.model.js
│   │   ├── conversation.model.js
│   │   ├── message.model.js
│   │   ├── group.model.js
│   │   └── groupmesssage.model.js
│   ├── controllers/
│   ├── middlewares/
│   │   └── auth.middleware.js
│   ├── services/
│   ├── utils/
│   ├── config/
│   └── app.js                     # UPDATED: Added CORS and chat routes
├── server.js                      # UPDATED: Socket.IO integration
├── package.json
├── .env.example                   # NEW: Environment variables template
├── SOCKET_IO_GUIDE.md             # NEW: Complete documentation
├── REACT_CLIENT_EXAMPLE.js        # NEW: React client example
└── QUICK_START.md                 # This file
```

## Installation & Setup

### 1. Install Dependencies
Socket.IO is already in package.json, but ensure all are installed:
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and update values:
```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
```

### 3. Start the Server
```bash
npm run dev
```

Server will run on `http://localhost:3000`

## Testing the Chat Application

### Using Postman/cURL

#### 1. Create Two Test Users (via existing auth endpoint)
Register/login as two different users to get their JWT tokens and user IDs.

#### 2. Test One-to-One Chat

**Get or Create Conversation:**
```bash
POST http://localhost:3000/api/chat/conversation/get-or-create
Headers: 
  - Authorization: Bearer <token_user1>
  - Content-Type: application/json
Body: {
  "participantId": "user2_id"
}
```

**Get All Conversations:**
```bash
GET http://localhost:3000/api/chat/conversations
Headers:
  - Authorization: Bearer <token_user1>
```

**Get Messages (requires conversationId from above):**
```bash
GET http://localhost:3000/api/chat/conversation/<conversationId>/messages?page=1&limit=50
Headers:
  - Authorization: Bearer <token_user1>
```

### Using Socket.IO Client (Test Tool)

#### Connect to Socket.IO:
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});

socket.on('connect', () => {
  console.log('Connected!');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

#### Send One-to-One Message:
```javascript
// First, join the conversation room
socket.emit('joinPersonalRoom', {
  conversationId: 'conversation_id_from_api'
});

// Send message
socket.emit('sendMessage', {
  conversationId: 'conversation_id',
  recipientId: 'user2_id',
  text: 'Hello!'
});

// Listen for incoming messages
socket.on('messageReceived', (data) => {
  console.log('New message:', data);
});
```

#### Mark Message as Read:
```javascript
socket.emit('markMessageAsRead', {
  messageId: 'message_id'
});

socket.on('messageReadStatusUpdated', (data) => {
  console.log('Message read by:', data.readBy);
});
```

### Test Group Chat

#### 1. Create Group:
```bash
POST http://localhost:3000/api/chat/group/create
Headers:
  - Authorization: Bearer <token_user1>
  - Content-Type: application/json
Body: {
  "groupName": "Test Group",
  "groupImage": "https://example.com/image.jpg",
  "memberIds": ["user2_id", "user3_id"]
}
```

#### 2. Get User's Groups:
```bash
GET http://localhost:3000/api/chat/groups
Headers:
  - Authorization: Bearer <token_user1>
```

#### 3. Join Group Room and Send Message:
```javascript
socket.emit('joinGroupRoom', {
  groupId: 'group_id_from_api'
});

socket.emit('sendGroupMessage', {
  groupId: 'group_id',
  text: 'Hello group!'
});

socket.on('groupMessageReceived', (data) => {
  console.log('New group message:', data);
});
```

#### 4. Add User to Group:
```bash
POST http://localhost:3000/api/chat/group/<groupId>/add-member
Headers:
  - Authorization: Bearer <token_admin>
Body: {
  "memberId": "user4_id"
}
```

#### 5. Remove User from Group:
```bash
DELETE http://localhost:3000/api/chat/group/<groupId>/remove-member/<memberId>
Headers:
  - Authorization: Bearer <token_admin>
```

## Key Features Overview

### ✅ One-to-One Chat
- Create conversations between two users
- Send and receive messages in real-time
- Message read receipts
- Typing indicators

### ✅ Group Chat
- Create groups with multiple members
- Add/remove members dynamically
- Group messaging with read status
- Group typing indicators

### ✅ Real-Time Features
- User online/offline status
- Live message delivery
- Message notifications
- Typing indicators

### ✅ Persistence
- All messages stored in MongoDB
- Conversation and group metadata
- Message read status tracking
- User online status tracking

### ✅ Security
- JWT token authentication
- Authorization checks
- Admin-only group operations
- Role-based access control

## API Response Format

### Success Response
```json
{
  "statusCode": 200,
  "data": { /* response data */ },
  "message": "Success message"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error message"
}
```

## Socket Events Summary

### Connection Events
- `connect` - User connects
- `disconnect` - User disconnects
- `error` - Error occurs

### One-to-One Events
- `joinPersonalRoom` - Join conversation
- `sendMessage` - Send message
- `messageReceived` - Receive message
- `markMessageAsRead` - Mark as read
- `messageReadStatusUpdated` - Read status updated
- `typingStart` - Start typing
- `typingStop` - Stop typing
- `userTyping` - Other user typing
- `userStoppedTyping` - Other user stopped

### Group Events
- `joinGroupRoom` - Join group
- `leaveGroupRoom` - Leave group
- `sendGroupMessage` - Send group message
- `groupMessageReceived` - Receive group message
- `groupTypingStart` - Start typing in group
- `groupTypingStop` - Stop typing in group
- `userJoinedGroup` - User joined
- `userLeftGroup` - User left
- `addUserToGroup` - Add member (socket)
- `removeUserFromGroup` - Remove member (socket)

### User Status Events
- `userOnline` - User came online
- `userOffline` - User went offline
- `messageNotification` - Message notification

## Troubleshooting

### Connection Issues
1. Check CORS is enabled in app.js
2. Verify CLIENT_URL in .env
3. Check JWT token validity
4. Ensure port is correct

### Messages Not Persisting
1. Check MongoDB connection
2. Verify MONGODB_URI in .env
3. Check mongoose connection in db.js

### Real-time Updates Not Working
1. Verify socket is connected
2. Check room names are correct (`conversation_{id}`, `group_{id}`)
3. Verify event names match exactly
4. Check browser console for errors

### Authorization Errors
1. Ensure JWT token is passed in socket auth
2. Check user permissions for group operations
3. Verify user is in conversation/group

## Performance Optimization

1. **Use Pagination**: Load messages in chunks (default: 50)
2. **Debounce Typing**: Implemented in `socketUtils.js`
3. **Room-Based Broadcasting**: Only relevant users receive updates
4. **Connection Pooling**: MongoDB connection pooling
5. **Error Handling**: Graceful error recovery

## Security Best Practices

1. Always validate JWT tokens
2. Check user authorization before DB operations
3. Sanitize message content
4. Rate limit message sending
5. Use HTTPS/WSS in production
6. Implement message encryption
7. Add message content validation

## Next Steps

1. Set up frontend with React (see REACT_CLIENT_EXAMPLE.js)
2. Implement UI components for chat
3. Add styling and responsive design
4. Deploy to production
5. Monitor performance and logs
6. Implement message search
7. Add file/media sharing

## Documentation Files

- `SOCKET_IO_GUIDE.md` - Comprehensive API documentation
- `REACT_CLIENT_EXAMPLE.js` - Complete React implementation example
- `.env.example` - Environment variables template
- `src/socket/socketUtils.js` - Utility functions for client/server

## Support

For more details, see:
- Socket.IO Docs: https://socket.io/docs/
- Express Docs: https://expressjs.com/
- MongoDB Docs: https://docs.mongodb.com/
- JWT Docs: https://jwt.io/

---

**Chat Application is Ready to Use! 🚀**
