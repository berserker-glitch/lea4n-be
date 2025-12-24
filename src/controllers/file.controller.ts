import { Request, Response } from 'express';
import { z } from 'zod';
import { fileService, UploadedFile } from '../services/file.service';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';
import { FileTag } from '@prisma/client';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const fileIdParamSchema = z.object({
    fileId: z.string().uuid('Invalid file ID format'),
});

export const subjectIdParamSchema = z.object({
    subjectId: z.string().uuid('Invalid subject ID format'),
});

export const updateFileTagSchema = z.object({
    tag: z.enum(['EXAM', 'EXERCISE', 'COURSE']),
});

export const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    type: z.enum(['PDF', 'IMAGE', 'DOCUMENT', 'OTHER']).optional(),
    tag: z.enum(['EXAM', 'EXERCISE', 'COURSE']).optional(),
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Upload files to a subject
 * POST /subjects/:subjectId/files
 */
export const uploadFiles = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const tag = req.body.tag as FileTag | undefined;

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
            success: false,
            error: { message: 'No files uploaded', code: 'NO_FILES' },
        });
        return;
    }

    const uploadedFiles: UploadedFile[] = (req.files as Express.Multer.File[]).map(
        (file) => ({
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
        })
    );

    const files = await fileService.createMany(
        authReq.user.id,
        subjectId,
        uploadedFiles,
        tag
    );

    res.status(201).json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`,
        data: files,
    });
});

/**
 * Get all files for a subject
 * GET /subjects/:subjectId/files
 */
export const getFilesBySubject = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { subjectId } = req.params;
    const result = await fileService.findAllBySubject(
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
 * Get all files for the current user (across all subjects)
 * GET /files
 */
export const getAllFiles = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await fileService.findAllByUser(authReq.user.id, req.query);

    res.status(200).json({
        success: true,
        ...result,
    });
});

/**
 * Get a single file by ID
 * GET /files/:fileId
 */
export const getFile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { fileId } = req.params;
    const file = await fileService.findById(authReq.user.id, fileId);

    res.status(200).json({
        success: true,
        data: file,
    });
});

/**
 * Update file tag
 * PATCH /files/:fileId
 */
export const updateFileTag = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { fileId } = req.params;
    const { tag } = req.body;

    const file = await fileService.updateTag(authReq.user.id, fileId, tag);

    res.status(200).json({
        success: true,
        message: 'File tag updated successfully',
        data: file,
    });
});

/**
 * Delete a file
 * DELETE /files/:fileId
 */
export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { fileId } = req.params;
    await fileService.delete(authReq.user.id, fileId);

    res.status(200).json({
        success: true,
        message: 'File deleted successfully',
    });
});
