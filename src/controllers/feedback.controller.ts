import { Request, Response } from 'express';
import { z } from 'zod';
import { feedbackService } from '../services/feedback.service';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const submitFeedbackSchema = z.object({
    messageId: z.string().uuid('Invalid message ID format'),
    isLiked: z.boolean(),
    reasons: z.array(z.string()).optional(),
    feedback: z.string().max(1000, 'Feedback must be at most 1000 characters').optional(),
});

export const messageIdParamSchema = z.object({
    messageId: z.string().uuid('Invalid message ID format'),
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Submit feedback for an AI message (like or dislike)
 * POST /feedback
 */
export const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { messageId, isLiked, reasons, feedback } = req.body;

    const result = await feedbackService.upsertFeedback(authReq.user.id, {
        messageId,
        isLiked,
        reasons,
        feedback,
    });

    res.status(200).json({
        success: true,
        message: isLiked ? 'Thanks for the positive feedback!' : 'Thanks for your feedback. We\'ll work to improve.',
        data: result,
    });
});

/**
 * Get feedback for a specific message
 * GET /feedback/:messageId
 */
export const getFeedback = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { messageId } = req.params;

    const feedback = await feedbackService.getFeedback(authReq.user.id, messageId);

    res.status(200).json({
        success: true,
        data: feedback,
    });
});

/**
 * Delete feedback for a message
 * DELETE /feedback/:messageId
 */
export const deleteFeedback = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { messageId } = req.params;

    await feedbackService.deleteFeedback(authReq.user.id, messageId);

    res.status(200).json({
        success: true,
        message: 'Feedback removed',
    });
});
