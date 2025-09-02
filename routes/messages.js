const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

// Get user conversations
router.get('/conversations', authenticateToken, messageController.getConversations);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', authenticateToken, messageController.getMessages);

// Send a message
router.post('/conversations/:conversationId/messages', authenticateToken, messageController.sendMessage);

// Mark messages as read
router.put('/conversations/:conversationId/read', authenticateToken, messageController.markAsRead);

// Create new conversation (from session)
router.post('/conversations', authenticateToken, messageController.createConversation);

module.exports = router;
