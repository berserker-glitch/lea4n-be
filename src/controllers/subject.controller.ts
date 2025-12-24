import { Request, Response } from 'express';
import { z } from 'zod';
import { subjectService } from '../services';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const createSubjectSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
    description: z.string().max(2000, 'Description must be at most 2000 characters').optional(),
});

export const updateSubjectSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
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
 * Create a new subject
 * POST /subjects
 */
export const createSubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const subject = await subjectService.create(authReq.user.id, req.body);

    res.status(201).json({
        success: true,
        message: 'Subject created successfully',
        data: subject,
    });
});

/**
 * Get all subjects for the current user
 * GET /subjects
 */
export const getSubjects = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await subjectService.findAll(authReq.user.id, req.query);

    res.status(200).json({
        success: true,
        ...result,
    });
});

/**
 * Get a single subject by ID
 * GET /subjects/:subjectId
 */
export const getSubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const subject = await subjectService.findById(authReq.user.id, subjectId);

    res.status(200).json({
        success: true,
        data: subject,
    });
});

/**
 * Update a subject
 * PATCH /subjects/:subjectId
 */
export const updateSubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const subject = await subjectService.update(authReq.user.id, subjectId, req.body);

    res.status(200).json({
        success: true,
        message: 'Subject updated successfully',
        data: subject,
    });
});

/**
 * Delete a subject
 * DELETE /subjects/:subjectId
 */
export const deleteSubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    await subjectService.delete(authReq.user.id, subjectId);

    res.status(200).json({
        success: true,
        message: 'Subject deleted successfully',
    });
});

/**
 * Toggle pin status of a subject
 * POST /subjects/:subjectId/pin
 */
export const togglePinSubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const subject = await subjectService.togglePin(authReq.user.id, subjectId);

    res.status(200).json({
        success: true,
        message: subject.isPinned ? 'Subject pinned' : 'Subject unpinned',
        data: subject,
    });
});

