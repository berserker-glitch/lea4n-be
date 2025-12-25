import { Router } from 'express';
import { authenticate } from '../middlewares';
import { validate } from '../middlewares';
import {
    submitFeedback,
    getFeedback,
    deleteFeedback,
    submitFeedbackSchema,
    messageIdParamSchema,
} from '../controllers/feedback.controller';

const router = Router();

// All feedback routes require authentication
router.use(authenticate);

/**
 * POST /feedback
 * Submit feedback for an AI message (like/dislike with optional reasons)
 */
router.post(
    '/',
    validate(submitFeedbackSchema),
    submitFeedback
);

/**
 * GET /feedback/:messageId
 * Get feedback for a specific message
 */
router.get(
    '/:messageId',
    validate(messageIdParamSchema, 'params'),
    getFeedback
);

/**
 * DELETE /feedback/:messageId
 * Remove feedback from a message
 */
router.delete(
    '/:messageId',
    validate(messageIdParamSchema, 'params'),
    deleteFeedback
);

export default router;
