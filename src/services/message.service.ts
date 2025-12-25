import prisma from '../config/database';
import { conversationService } from './conversation.service';
import { aiService } from './ai.service';
import { MessageRole } from '@prisma/client';

export interface CreateMessageInput {
    content: string;
    role: MessageRole;
}

/**
 * Message service handling all message-related business logic.
 * Ensures strict isolation - users can only access messages in their conversations.
 */
export class MessageService {
    /**
     * Create a new message in a conversation
     */
    async create(userId: string, conversationId: string, input: CreateMessageInput) {
        // Verify user owns the conversation
        await conversationService.verifyOwnership(userId, conversationId);

        const message = await prisma.message.create({
            data: {
                content: input.content,
                role: input.role,
                conversationId,
            },
        });

        // Update conversation's updatedAt timestamp
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        });

        return message;
    }

    /**
     * Get all messages for a conversation with feedback
     */
    async findByConversation(userId: string, conversationId: string) {
        // Verify user owns the conversation
        await conversationService.verifyOwnership(userId, conversationId);

        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            include: {
                feedback: {
                    select: {
                        id: true,
                        isLiked: true,
                        reasons: true,
                        feedback: true,
                    }
                }
            }
        });

        // Parse feedback reasons JSON for each message
        return messages.map(msg => ({
            ...msg,
            feedback: msg.feedback ? {
                ...msg.feedback,
                reasons: msg.feedback.reasons ? JSON.parse(msg.feedback.reasons) : [],
            } : null,
        }));
    }

    /**
     * Get conversation history formatted for AI
     */
    async getConversationHistory(
        userId: string,
        conversationId: string
    ): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
        const messages = await this.findByConversation(userId, conversationId);

        return messages.map((msg) => ({
            role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
            content: msg.content,
        }));
    }

    /**
     * Send a message and get AI response
     * Creates both user message and AI response
     */
    async sendMessageAndGetResponse(userId: string, conversationId: string, content: string) {
        // Verify ownership
        await conversationService.verifyOwnership(userId, conversationId);

        // Create user message
        const userMessage = await this.create(userId, conversationId, {
            content,
            role: 'USER',
        });

        // Get conversation history for context
        const history = await this.getConversationHistory(userId, conversationId);

        // Get AI response
        const aiResponse = await aiService.chat(history);

        // Save AI response
        const assistantMessage = await this.create(userId, conversationId, {
            content: aiResponse,
            role: 'ASSISTANT',
        });

        return {
            userMessage,
            assistantMessage,
        };
    }
}

// Export singleton instance
export const messageService = new MessageService();
