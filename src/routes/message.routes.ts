import { Router } from 'express';
import { authenticate } from '../middlewares';
import { validate } from '../middlewares';
import {
    sendMessage,
    sendMessageStream,
    getMessages,
    sendMessageSchema,
    conversationIdParamSchema,
} from '../controllers/message.controller';

const router = Router();

// All message routes require authentication
router.use(authenticate);

// Message routes (nested under conversations)
// These routes are mounted at /conversations/:conversationId/messages

/**
 * GET /conversations/:conversationId/messages
 * Get all messages for a conversation
 */
router.get(
    '/:conversationId/messages',
    validate(conversationIdParamSchema, 'params'),
    getMessages
);

/**
 * POST /conversations/:conversationId/messages
 * Send a new message and get AI response
 */
router.post(
    '/:conversationId/messages',
    validate(conversationIdParamSchema, 'params'),
    validate(sendMessageSchema),
    sendMessage
);

/**
 * POST /conversations/:conversationId/messages/stream
 * Send a message and stream AI response via SSE
 */
router.post(
    '/:conversationId/messages/stream',
    validate(conversationIdParamSchema, 'params'),
    validate(sendMessageSchema),
    sendMessageStream
);

export default router;
