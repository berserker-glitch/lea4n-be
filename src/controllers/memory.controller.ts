import { Request, Response } from 'express';
import { z } from 'zod';
import { memoryService } from '../services/memory.service';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const createMemorySchema = z.object({
    content: z.string().min(1, 'Content is required').max(1000, 'Content must be at most 1000 characters'),
    category: z.enum(['PREFERENCE', 'FACT', 'PROGRESS', 'CORRECTION', 'GOAL', 'CUSTOM']),
    importance: z.number().int().min(1).max(10).optional().default(5),
    expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined)
});

export const updateMemorySchema = z.object({
    content: z.string().min(1).max(1000).optional(),
    category: z.enum(['PREFERENCE', 'FACT', 'PROGRESS', 'CORRECTION', 'GOAL', 'CUSTOM']).optional(),
    importance: z.number().int().min(1).max(10).optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional().transform(val => val ? new Date(val) : val === null ? null : undefined)
});

export const subjectIdParamSchema = z.object({
    subjectId: z.string().uuid('Invalid subject ID format')
});

export const memoryIdParamSchema = z.object({
    memoryId: z.string().uuid('Invalid memory ID format')
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Get all memories for a subject
 * GET /subjects/:subjectId/memories
 */
export const getMemories = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;

    const memories = await memoryService.getSubjectMemories(
        authReq.user.id,
        subjectId
    );

    res.status(200).json({
        success: true,
        data: memories,
        count: memories.length
    });
});

/**
 * Get memory count for a subject
 * GET /subjects/:subjectId/memories/count
 */
export const getMemoryCount = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;

    const count = await memoryService.getCount(
        authReq.user.id,
        subjectId
    );

    res.status(200).json({
        success: true,
        count
    });
});

/**
 * Create a new memory for a subject
 * POST /subjects/:subjectId/memories
 */
export const createMemory = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const data = createMemorySchema.parse(req.body);

    const memory = await memoryService.create(
        authReq.user.id,
        subjectId,
        {
            content: data.content,
            category: data.category as any,
            importance: data.importance,
            expiresAt: data.expiresAt
        }
    );

    res.status(201).json({
        success: true,
        message: 'Memory created successfully',
        data: memory
    });
});

/**
 * Update a memory
 * PATCH /memories/:memoryId
 */
export const updateMemory = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { memoryId } = req.params;
    const data = updateMemorySchema.parse(req.body);

    const memory = await memoryService.update(
        authReq.user.id,
        memoryId,
        {
            content: data.content,
            category: data.category as any,
            importance: data.importance,
            isActive: data.isActive,
            expiresAt: data.expiresAt
        }
    );

    res.status(200).json({
        success: true,
        message: 'Memory updated successfully',
        data: memory
    });
});

/**
 * Delete a memory
 * DELETE /memories/:memoryId
 */
export const deleteMemory = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { memoryId } = req.params;

    await memoryService.delete(
        authReq.user.id,
        memoryId
    );

    res.status(200).json({
        success: true,
        message: 'Memory deleted successfully'
    });
});

/**
 * Deactivate a memory (soft delete)
 * POST /memories/:memoryId/deactivate
 */
export const deactivateMemory = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { memoryId } = req.params;

    const memory = await memoryService.deactivate(
        authReq.user.id,
        memoryId
    );

    res.status(200).json({
        success: true,
        message: 'Memory deactivated successfully',
        data: memory
    });
});
