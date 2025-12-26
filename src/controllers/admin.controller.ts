import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { adminService } from '../services/admin.service';

/**
 * Admin Controller - handles admin-only routes
 */
export const adminController = {
    /**
     * GET /admin/stats - Get admin dashboard stats
     */
    async getStats(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const stats = await adminService.getDashboardStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /admin/users - List all users
     */
    async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { page, limit, search } = req.query;
            const result = await adminService.getAllUsers({
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
                search: search as string | undefined,
            });
            res.json({ success: true, data: result.users, pagination: result.pagination });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /admin/users/:userId - Get user details
     */
    async getUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const user = await adminService.getUserById(userId);
            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /admin/users/:userId/conversations - Get user's conversations
     */
    async getUserConversations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { page, limit, subjectId } = req.query;
            const result = await adminService.getUserConversations(userId, {
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
                subjectId: subjectId as string | undefined,
            });
            res.json({ success: true, data: result.conversations, pagination: result.pagination });
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /admin/conversations/:conversationId/messages - Get conversation messages
     */
    async getConversationMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { conversationId } = req.params;
            const { page, limit } = req.query;
            const result = await adminService.getConversationMessages(conversationId, {
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            });
            res.json({
                success: true,
                data: {
                    conversation: result.conversation,
                    messages: result.messages,
                },
                pagination: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    },
};
