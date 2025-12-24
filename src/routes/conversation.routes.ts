import { Router } from 'express';
import { authenticate, validate, validateAll } from '../middlewares';
import {
    getAllConversations,
    getConversation,
    updateConversation,
    deleteConversation,
    updateConversationSchema,
    conversationIdParamSchema,
    listQuerySchema,
} from '../controllers/conversation.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// CONVERSATION ROUTES
// ===========================================

/**
 * @route   GET /conversations
 * @desc    Get all conversations for the current user (across all subjects)
 * @access  Private
 */
router.get('/', validate(listQuerySchema, 'query'), getAllConversations);

/**
 * @route   GET /conversations/:conversationId
 * @desc    Get a single conversation by ID (with messages)
 * @access  Private
 */
router.get(
    '/:conversationId',
    validate(conversationIdParamSchema, 'params'),
    getConversation
);

/**
 * @route   PATCH /conversations/:conversationId
 * @desc    Update a conversation
 * @access  Private
 */
router.patch(
    '/:conversationId',
    validateAll({
        params: conversationIdParamSchema,
        body: updateConversationSchema,
    }),
    updateConversation
);

/**
 * @route   DELETE /conversations/:conversationId
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete(
    '/:conversationId',
    validate(conversationIdParamSchema, 'params'),
    deleteConversation
);

export default router;
