import { Request, Response } from 'express';
import { z } from 'zod';
import { conversationService } from '../services';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const createConversationSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
});

export const updateConversationSchema = z.object({
    title: z.string().min(1).max(200).optional(),
});

export const conversationIdParamSchema = z.object({
    conversationId: z.string().uuid('Invalid conversation ID format'),
});

export const subjectIdParamSchema = z.object({
    subjectId: z.string().uuid('Invalid subject ID format'),
});

export const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().max(100).optional(),
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Create a new conversation under a subject
 * POST /subjects/:subjectId/conversations
 */
export const createConversation = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const conversation = await conversationService.create(authReq.user.id, subjectId, req.body);

    res.status(201).json({
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
    });
});

/**
 * Get all conversations for a subject
 * GET /subjects/:subjectId/conversations
 */
export const getConversationsBySubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const result = await conversationService.findAllBySubject(
        authReq.user.id,
        subjectId,
        req.query
    );

    res.status(200).json({
        success: true,
        ...result,
    });
});

/**
 * Get all conversations for the current user (across all subjects)
 * GET /conversations
 */
export const getAllConversations = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await conversationService.findAllByUser(authReq.user.id, req.query);

    res.status(200).json({
        success: true,
        ...result,
    });
});

/**
 * Get a single conversation by ID
 * GET /conversations/:conversationId
 */
export const getConversation = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { conversationId } = req.params;
    const conversation = await conversationService.findById(authReq.user.id, conversationId);

    res.status(200).json({
        success: true,
        data: conversation,
    });
});

/**
 * Update a conversation
 * PATCH /conversations/:conversationId
 */
export const updateConversation = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { conversationId } = req.params;
    const conversation = await conversationService.update(
        authReq.user.id,
        conversationId,
        req.body
    );

    res.status(200).json({
        success: true,
        message: 'Conversation updated successfully',
        data: conversation,
    });
});

/**
 * Delete a conversation
 * DELETE /conversations/:conversationId
 */
export const deleteConversation = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { conversationId } = req.params;
    await conversationService.delete(authReq.user.id, conversationId);

    res.status(200).json({
        success: true,
        message: 'Conversation deleted successfully',
    });
});
