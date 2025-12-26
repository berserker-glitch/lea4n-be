import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/requireAdmin.middleware';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + SUPERADMIN role
router.use(authenticate);
router.use(requireAdmin as any);

/**
 * @route   GET /admin/stats
 * @desc    Get admin dashboard statistics
 * @access  SUPERADMIN only
 */
router.get('/stats', adminController.getStats as any);

/**
 * @route   GET /admin/users
 * @desc    List all users with pagination
 * @access  SUPERADMIN only
 */
router.get('/users', adminController.listUsers as any);

/**
 * @route   GET /admin/users/:userId
 * @desc    Get user details with subjects
 * @access  SUPERADMIN only
 */
router.get('/users/:userId', adminController.getUser as any);

/**
 * @route   GET /admin/users/:userId/conversations
 * @desc    Get all conversations for a user
 * @access  SUPERADMIN only
 */
router.get('/users/:userId/conversations', adminController.getUserConversations as any);

/**
 * @route   GET /admin/conversations/:conversationId/messages
 * @desc    Get all messages for any conversation
 * @access  SUPERADMIN only
 */
router.get('/conversations/:conversationId/messages', adminController.getConversationMessages as any);

export default router;
