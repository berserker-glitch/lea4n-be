import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { messageService } from '../services/message.service';
import { aiService } from '../services/ai.service';
import { conversationService } from '../services/conversation.service';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const sendMessageSchema = z.object({
    content: z.string().min(1, 'Message content is required').max(10000, 'Message must be at most 10000 characters'),
});

export const conversationIdParamSchema = z.object({
    conversationId: z.string().uuid('Invalid conversation ID format'),
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Send a message to a conversation and get AI response
 * POST /conversations/:conversationId/messages
 */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { conversationId } = req.params;
    const { content } = req.body;

    const result = await messageService.sendMessageAndGetResponse(
        authReq.user.id,
        conversationId,
        content
    );

    res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: result,
    });
});

/**
 * Send a message and stream AI response using SSE
 * POST /conversations/:conversationId/messages/stream
 */
export const sendMessageStream = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { conversationId } = req.params;
    const { content } = req.body;

    // Verify ownership
    await conversationService.verifyOwnership(authReq.user.id, conversationId);

    // Create user message
    const userMessage = await prisma.message.create({
        data: {
            content,
            role: 'USER',
            conversationId,
        },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    // Get conversation history for context
    const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
    });

    const history = messages.map((msg) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
    }));

    // Set up SSE headers BEFORE any response writing
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send user message first
    res.write(`data: ${JSON.stringify({ type: 'userMessage', data: userMessage })}\n\n`);

    try {
        // Stream the AI response
        const accumulatedContent = await aiService.chatStream(history, res);

        // Save the complete AI response to database
        const assistantMessage = await prisma.message.create({
            data: {
                content: accumulatedContent,
                role: 'ASSISTANT',
                conversationId,
            },
        });

        // Send the final saved message
        res.write(`data: ${JSON.stringify({ type: 'assistantMessage', data: assistantMessage })}\n\n`);
        res.end();
    } catch (error) {
        console.error('Stream error:', error);
        res.end();
    }
});

/**
 * Get all messages for a conversation
 * GET /conversations/:conversationId/messages
 */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { conversationId } = req.params;

    const messages = await messageService.findByConversation(
        authReq.user.id,
        conversationId
    );

    res.status(200).json({
        success: true,
        data: messages,
    });
});
