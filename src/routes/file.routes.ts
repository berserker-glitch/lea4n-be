import { Router } from 'express';
import { authenticate, validate, validateAll } from '../middlewares';
import {
    getAllFiles,
    getFile,
    updateFileTag,
    deleteFile,
    fileIdParamSchema,
    updateFileTagSchema,
    listQuerySchema,
} from '../controllers/file.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// FILE ROUTES
// ===========================================

/**
 * @route   GET /files
 * @desc    Get all files for the current user (across all subjects)
 * @access  Private
 */
router.get('/', validate(listQuerySchema, 'query'), getAllFiles);

/**
 * @route   GET /files/:fileId
 * @desc    Get a single file by ID
 * @access  Private
 */
router.get(
    '/:fileId',
    validate(fileIdParamSchema, 'params'),
    getFile
);

/**
 * @route   PATCH /files/:fileId
 * @desc    Update file tag
 * @access  Private
 */
router.patch(
    '/:fileId',
    validateAll({
        params: fileIdParamSchema,
        body: updateFileTagSchema,
    }),
    updateFileTag
);

/**
 * @route   DELETE /files/:fileId
 * @desc    Delete a file
 * @access  Private
 */
router.delete(
    '/:fileId',
    validate(fileIdParamSchema, 'params'),
    deleteFile
);

export default router;
