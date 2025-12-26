import prisma from '../config/database';
import { AppError } from '../utils';

/**
 * Admin Service - handles admin-only queries for user and conversation management
 */
export class AdminService {
    /**
     * Get all users with statistics
     */
    async getAllUsers(options?: { page?: number; limit?: number; search?: string }) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        const where = options?.search ? {
            OR: [
                { email: { contains: options.search } },
                { name: { contains: options.search } },
            ]
        } : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            subjects: true,
                            conversations: true,
                            files: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get user details with subjects and conversations
     */
    async getUserById(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                subjects: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        createdAt: true,
                        _count: {
                            select: {
                                conversations: true,
                                files: true,
                            },
                        },
                    },
                    orderBy: { updatedAt: 'desc' },
                },
                _count: {
                    select: {
                        subjects: true,
                        conversations: true,
                        files: true,
                    },
                },
            },
        });

        if (!user) {
            throw AppError.notFound('User not found');
        }

        return user;
    }

    /**
     * Get all conversations for a specific user
     */
    async getUserConversations(
        userId: string,
        options?: { page?: number; limit?: number; subjectId?: string }
    ) {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        // Verify user exists
        const userExists = await prisma.user.findUnique({ where: { id: userId } });
        if (!userExists) {
            throw AppError.notFound('User not found');
        }

        const where = {
            userId,
            ...(options?.subjectId && { subjectId: options.subjectId }),
        };

        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    updatedAt: true,
                    subject: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    _count: {
                        select: {
                            messages: true,
                        },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.conversation.count({ where }),
        ]);

        return {
            conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all messages for any conversation (admin access)
     */
    async getConversationMessages(
        conversationId: string,
        options?: { page?: number; limit?: number }
    ) {
        const page = options?.page || 1;
        const limit = options?.limit || 50;
        const skip = (page - 1) * limit;

        // Get conversation with user info
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                title: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                subject: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });

        if (!conversation) {
            throw AppError.notFound('Conversation not found');
        }

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: { conversationId },
                select: {
                    id: true,
                    content: true,
                    role: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
                skip,
                take: limit,
            }),
            prisma.message.count({ where: { conversationId } }),
        ]);

        return {
            conversation,
            messages,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get admin dashboard stats
     */
    async getDashboardStats() {
        const [
            totalUsers,
            totalSubjects,
            totalConversations,
            totalMessages,
            totalFiles,
            recentUsers,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.subject.count(),
            prisma.conversation.count(),
            prisma.message.count(),
            prisma.file.count(),
            prisma.user.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                },
            }),
        ]);

        return {
            totalUsers,
            totalSubjects,
            totalConversations,
            totalMessages,
            totalFiles,
            recentUsers,
        };
    }
}

export const adminService = new AdminService();
