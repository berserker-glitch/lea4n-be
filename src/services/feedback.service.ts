import prisma from '../config/database';

export interface CreateFeedbackInput {
    messageId: string;
    isLiked: boolean;
    reasons?: string[];
    feedback?: string;
}

/**
 * Feedback service handling message feedback (like/dislike) operations.
 * Allows users to provide feedback on AI responses.
 */
export class FeedbackService {
    /**
     * Create or update feedback for a message
     * Each user can only have one feedback per message
     */
    async upsertFeedback(userId: string, input: CreateFeedbackInput) {
        // Verify the message exists and belongs to user's conversation
        const message = await prisma.message.findUnique({
            where: { id: input.messageId },
            include: {
                conversation: {
                    select: { userId: true }
                }
            }
        });

        if (!message) {
            throw new Error('Message not found');
        }

        if (message.conversation.userId !== userId) {
            throw new Error('Unauthorized: You can only provide feedback on your own conversations');
        }

        // Only allow feedback on assistant messages
        if (message.role !== 'ASSISTANT') {
            throw new Error('Feedback can only be provided on AI responses');
        }

        // Upsert feedback (create or update)
        const feedback = await prisma.messageFeedback.upsert({
            where: { messageId: input.messageId },
            update: {
                isLiked: input.isLiked,
                reasons: input.reasons ? JSON.stringify(input.reasons) : null,
                feedback: input.feedback || null,
            },
            create: {
                messageId: input.messageId,
                userId,
                isLiked: input.isLiked,
                reasons: input.reasons ? JSON.stringify(input.reasons) : null,
                feedback: input.feedback || null,
            },
        });

        return {
            ...feedback,
            reasons: feedback.reasons ? JSON.parse(feedback.reasons) : [],
        };
    }

    /**
     * Get feedback for a specific message
     */
    async getFeedback(userId: string, messageId: string) {
        const feedback = await prisma.messageFeedback.findFirst({
            where: {
                messageId,
                userId,
            },
        });

        if (!feedback) {
            return null;
        }

        return {
            ...feedback,
            reasons: feedback.reasons ? JSON.parse(feedback.reasons) : [],
        };
    }

    /**
     * Delete feedback for a message
     */
    async deleteFeedback(userId: string, messageId: string) {
        // First verify ownership
        const feedback = await prisma.messageFeedback.findFirst({
            where: {
                messageId,
                userId,
            },
        });

        if (!feedback) {
            throw new Error('Feedback not found');
        }

        await prisma.messageFeedback.delete({
            where: { id: feedback.id },
        });

        return { success: true };
    }
}

// Export singleton instance
export const feedbackService = new FeedbackService();
