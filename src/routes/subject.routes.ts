import { Router } from 'express';
import { authenticate, validate, validateAll } from '../middlewares';
import {
    createSubject,
    getSubjects,
    getSubject,
    updateSubject,
    deleteSubject,
    togglePinSubject,
    createSubjectSchema,
    updateSubjectSchema,
    subjectIdParamSchema,
    listQuerySchema,
} from '../controllers/subject.controller';
import {
    createConversation,
    getConversationsBySubject,
    createConversationSchema,
    listQuerySchema as conversationListQuerySchema,
} from '../controllers/conversation.controller';
import {
    uploadFiles,
    getFilesBySubject,
    listQuerySchema as fileListQuerySchema,
} from '../controllers/file.controller';
import { upload } from '../config/upload';
import memoryRoutes from './memory.routes';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// SUBJECT ROUTES
// ===========================================

/**
 * @route   POST /subjects
 * @desc    Create a new subject
 * @access  Private
 */
router.post('/', validate(createSubjectSchema), createSubject);

/**
 * @route   GET /subjects
 * @desc    Get all subjects for the current user
 * @access  Private
 */
router.get('/', validate(listQuerySchema, 'query'), getSubjects);

/**
 * @route   GET /subjects/:subjectId
 * @desc    Get a single subject by ID
 * @access  Private
 */
router.get(
    '/:subjectId',
    validate(subjectIdParamSchema, 'params'),
    getSubject
);

/**
 * @route   PATCH /subjects/:subjectId
 * @desc    Update a subject
 * @access  Private
 */
router.patch(
    '/:subjectId',
    validateAll({
        params: subjectIdParamSchema,
        body: updateSubjectSchema,
    }),
    updateSubject
);

/**
 * @route   POST /subjects/:subjectId/pin
 * @desc    Toggle pin status of a subject
 * @access  Private
 */
router.post(
    '/:subjectId/pin',
    validate(subjectIdParamSchema, 'params'),
    togglePinSubject
);

/**
 * @route   DELETE /subjects/:subjectId
 * @desc    Delete a subject
 * @access  Private
 */
router.delete(
    '/:subjectId',
    validate(subjectIdParamSchema, 'params'),
    deleteSubject
);

// ===========================================
// NESTED CONVERSATION ROUTES
// ===========================================

/**
 * @route   POST /subjects/:subjectId/conversations
 * @desc    Create a new conversation under a subject
 * @access  Private
 */
router.post(
    '/:subjectId/conversations',
    validateAll({
        params: subjectIdParamSchema,
        body: createConversationSchema,
    }),
    createConversation
);

/**
 * @route   GET /subjects/:subjectId/conversations
 * @desc    Get all conversations for a subject
 * @access  Private
 */
router.get(
    '/:subjectId/conversations',
    validateAll({
        params: subjectIdParamSchema,
        query: conversationListQuerySchema,
    }),
    getConversationsBySubject
);

// ===========================================
// NESTED FILE ROUTES
// ===========================================

/**
 * @route   POST /subjects/:subjectId/files
 * @desc    Upload files to a subject
 * @access  Private
 */
router.post(
    '/:subjectId/files',
    validate(subjectIdParamSchema, 'params'),
    upload.array('files', 10),
    uploadFiles
);

/**
 * @route   GET /subjects/:subjectId/files
 * @desc    Get all files for a subject
 * @access  Private
 */
router.get(
    '/:subjectId/files',
    validateAll({
        params: subjectIdParamSchema,
        query: fileListQuerySchema,
    }),
    getFilesBySubject
);

// ===========================================
// NESTED MEMORY ROUTES
// ===========================================

/**
 * @route   /subjects/:subjectId/memories/*
 * @desc    Memory routes for a subject
 * @access  Private
 */
router.use('/:subjectId/memories', memoryRoutes);

export default router;


