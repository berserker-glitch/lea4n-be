import prisma from '../config/database';
import { AppError } from '../utils';
import { subjectService } from './subject.service';

export interface CreateConversationInput {
    title: string;
}

export interface UpdateConversationInput {
    title?: string;
}

export interface ConversationListOptions {
    page?: number;
    limit?: number;
    search?: string;
}

/**
 * Conversation service handling all conversation-related business logic.
 * Ensures strict isolation - users can only access conversations within their own subjects.
 */
export class ConversationService {
    /**
     * Create a new conversation under a subject
     */
    async create(userId: string, subjectId: string, input: CreateConversationInput) {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const conversation = await prisma.conversation.create({
            data: {
                title: input.title,
                subjectId,
                userId, // Store userId for efficient querying
            },
            include: {
                subject: {
                    select: { id: true, title: true },
                },
                _count: {
                    select: { messages: true },
                },
            },
        });

        return conversation;
    }

    /**
     * Get all conversations for a subject (with ownership verification)
     */
    async findAllBySubject(
        userId: string,
        subjectId: string,
        options: ConversationListOptions = {}
    ) {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const { page = 1, limit = 20, search } = options;
        const skip = (page - 1) * limit;

        const where = {
            subjectId,
            userId, // Double-check ownership
            ...(search && {
                title: { contains: search },
            }),
        };

        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    _count: {
                        select: { messages: true },
                    },
                },
            }),
            prisma.conversation.count({ where }),
        ]);

        return {
            data: conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all conversations for a user (across all subjects)
     */
    async findAllByUser(userId: string, options: ConversationListOptions = {}) {
        const { page = 1, limit = 20, search } = options;
        const skip = (page - 1) * limit;

        const where = {
            userId,
            ...(search && {
                title: { contains: search },
            }),
        };

        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    subject: {
                        select: { id: true, title: true },
                    },
                    _count: {
                        select: { messages: true },
                    },
                },
            }),
            prisma.conversation.count({ where }),
        ]);

        return {
            data: conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single conversation by ID (with ownership verification)
     */
    async findById(userId: string, conversationId: string) {
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                userId, // Ensures user can only access their own conversations
            },
            include: {
                subject: {
                    select: { id: true, title: true },
                },
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
                _count: {
                    select: { messages: true },
                },
            },
        });

        if (!conversation) {
            throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
        }

        return conversation;
    }

    /**
     * Update a conversation (with ownership verification)
     */
    async update(
        userId: string,
        conversationId: string,
        input: UpdateConversationInput
    ) {
        // First verify ownership
        await this.verifyOwnership(userId, conversationId);

        const conversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: input,
            include: {
                subject: {
                    select: { id: true, title: true },
                },
                _count: {
                    select: { messages: true },
                },
            },
        });

        return conversation;
    }

    /**
     * Delete a conversation (with ownership verification)
     * This will cascade delete all messages in this conversation
     */
    async delete(userId: string, conversationId: string): Promise<void> {
        // First verify ownership
        await this.verifyOwnership(userId, conversationId);

        await prisma.conversation.delete({
            where: { id: conversationId },
        });
    }

    /**
     * Verify that a user owns a conversation
     */
    async verifyOwnership(userId: string, conversationId: string): Promise<void> {
        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                userId,
            },
            select: { id: true },
        });

        if (!conversation) {
            throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
        }
    }
}

// Export singleton instance
export const conversationService = new ConversationService();
