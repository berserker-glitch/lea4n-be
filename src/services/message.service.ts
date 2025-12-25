import prisma from '../config/database';
import { AppError } from '../utils';
import { conversationService } from './conversation.service';
import { aiService, buildSystemPrompt } from './ai.service';
import { ragService } from './rag.service';
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
     * Send a message and get AI response using RAG
     */
    async sendMessageAndGetResponse(
        userId: string,
        conversationId: string,
        content: string
    ) {
        // 1. Verify ownership and get conversation context with subject name
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId },
            select: {
                subjectId: true,
                subject: { select: { title: true } }
            }
        });

        if (!conversation) {
            throw AppError.notFound('Conversation not found');
        }

        const subjectName = conversation.subject?.title;

        // 2. Create user message
        const userMessage = await this.create(userId, conversationId, {
            content,
            role: 'USER',
        });

        // 3. Retrieve relevant context from files
        // By default, retrieve from any course/exam/exercise file in the subject
        const retrievalResult = await ragService.retrieve(userId, content, {
            subjectId: conversation.subjectId,
            topK: 5
        });

        const contextText = ragService.formatContext(retrievalResult.chunks);

        // 4. Build smart AI prompt with subject context
        const systemPrompt = buildSystemPrompt(subjectName, contextText);

        // 5. Get conversation history
        const history = await this.getConversationHistory(userId, conversationId);

        // 6. Get AI response
        const aiResponse = await aiService.chat(history, systemPrompt);

        // 7. Save AI response
        const assistantMessage = await this.create(userId, conversationId, {
            content: aiResponse,
            role: 'ASSISTANT',
        });

        return {
            userMessage,
            assistantMessage,
            sources: retrievalResult.chunks.map(chunk => ({
                fileName: chunk.fileName,
                fileId: chunk.fileId,
                tag: chunk.fileTag,
                similarity: chunk.similarity
            }))
        };
    }

    /**
     * Stream message and AI response using RAG
     */
    async streamMessageAndGetResponse(
        userId: string,
        conversationId: string,
        content: string,
        res: any // Express Response
    ) {
        // 1. Verify ownership and get conversation context with subject name
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, userId },
            select: {
                subjectId: true,
                subject: { select: { title: true } }
            }
        });

        if (!conversation) {
            throw AppError.notFound('Conversation not found');
        }

        const subjectName = conversation.subject?.title;

        // 2. Create user message
        const userMessage = await this.create(userId, conversationId, {
            content,
            role: 'USER',
        });

        // 3. Retrieve relevant context from files
        const retrievalResult = await ragService.retrieve(userId, content, {
            subjectId: conversation.subjectId,
            topK: 5
        });

        const contextText = ragService.formatContext(retrievalResult.chunks);

        // 4. Build smart AI prompt with subject context
        const systemPrompt = buildSystemPrompt(subjectName, contextText);

        // 5. Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // 6. Send user message and sources first
        const sources = retrievalResult.chunks.map(chunk => ({
            fileName: chunk.fileName,
            fileId: chunk.fileId,
            tag: chunk.fileTag,
            similarity: chunk.similarity
        }));

        res.write(`data: ${JSON.stringify({ type: 'userMessage', data: userMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'sources', data: sources })}\n\n`);

        // 7. Get conversation history
        const history = await this.getConversationHistory(userId, conversationId);

        try {
            // 8. Stream the AI response
            const accumulatedContent = await aiService.chatStream(history, res, systemPrompt);

            // 9. Save AI response
            const assistantMessage = await this.create(userId, conversationId, {
                content: accumulatedContent,
                role: 'ASSISTANT',
            });

            // 10. Send the final saved message
            res.write(`data: ${JSON.stringify({ type: 'assistantMessage', data: assistantMessage })}\n\n`);
            res.end();
        } catch (error) {
            console.error('Stream error:', error);
            res.end();
        }
    }
}

// Export singleton instance
export const messageService = new MessageService();
