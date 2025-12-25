import { Request, Response } from 'express';
import { messageService } from '../services/message.service';
import { aiService } from '../services/ai.service';
import { ragService } from '../services/rag.service';
import { subjectService } from '../services/subject.service';
import { AppError } from '../utils';

/**
 * Controller for RAG-related operations
 */
export class RAGController {
    /**
     * Context-aware chat query
     */
    async query(req: Request, res: Response) {
        const userId = (req as any).user.id;
        const { conversationId, content } = req.body;

        if (!content) {
            throw AppError.badRequest('Content is required');
        }

        if (!conversationId) {
            throw AppError.badRequest('ConversationId is required');
        }

        const result = await messageService.sendMessageAndGetResponse(
            userId,
            conversationId,
            content
        );

        res.json({
            status: 'success',
            data: result
        });
    }

    /**
     * Context-aware stream query
     */
    async queryStream(req: Request, res: Response) {
        const userId = (req as any).user.id;
        const { conversationId, content } = req.body;

        if (!content) {
            throw AppError.badRequest('Content is required');
        }

        if (!conversationId) {
            throw AppError.badRequest('ConversationId is required');
        }

        await messageService.streamMessageAndGetResponse(
            userId,
            conversationId,
            content,
            res
        );
    }

    /**
     * Generate practice questions for a subject
     */
    async generateQuestions(req: Request, res: Response) {
        const userId = (req as any).user.id;
        const { subjectId } = req.body;

        if (!subjectId) {
            throw AppError.badRequest('SubjectId is required');
        }

        const subject = await subjectService.findById(userId, subjectId);

        // Retrieve context specifically from exams and exercises if possible
        const retrievalResult = await ragService.retrieve(userId, 'practice questions exam exercises', {
            subjectId,
            topK: 10
        });

        const contextText = ragService.formatContext(retrievalResult.chunks);
        const questions = await aiService.generateQuestions(subject.title, contextText);

        res.json({
            status: 'success',
            data: {
                questions,
                sources: retrievalResult.chunks.map(c => ({ fileName: c.fileName, fileId: c.fileId }))
            }
        });
    }
}

export const ragController = new RAGController();
