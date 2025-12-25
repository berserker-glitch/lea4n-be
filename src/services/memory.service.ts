/**
 * Memory Service - Subject-Scoped Memory Management
 * Handles persistent memory storage and retrieval for cross-conversation context
 */

import prisma from '../config/database';
import { MemoryCategory, SubjectMemory } from '@prisma/client';
import { AppError } from '../utils';
import { subjectService } from './subject.service';

// Maximum tokens to use for memory context (~1000 tokens ≈ ~4000 chars)
const MAX_MEMORY_CHARS = 4000;

export interface CreateMemoryInput {
    content: string;
    category: MemoryCategory;
    importance?: number;
    sourceConversationId?: string;
    expiresAt?: Date;
}

export interface UpdateMemoryInput {
    content?: string;
    category?: MemoryCategory;
    importance?: number;
    isActive?: boolean;
    expiresAt?: Date | null;
}

export interface ExtractedMemory {
    content: string;
    category: MemoryCategory;
    importance: number;
}

/**
 * Memory Service - Manages subject-scoped memories for cross-conversation context
 */
export class MemoryService {
    /**
     * Get all active memories for a subject, ordered by importance
     */
    async getSubjectMemories(userId: string, subjectId: string): Promise<SubjectMemory[]> {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const now = new Date();

        return prisma.subjectMemory.findMany({
            where: {
                subjectId,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } }
                ]
            },
            orderBy: [
                { importance: 'desc' },
                { createdAt: 'desc' }
            ]
        });
    }

    /**
     * Format memories for injection into AI system prompt
     * Respects the ~1000 token budget
     */
    formatMemoriesForPrompt(memories: SubjectMemory[]): string {
        if (memories.length === 0) return '';

        let formattedContent = '';
        let charCount = 0;

        // Group memories by category
        const grouped = new Map<MemoryCategory, SubjectMemory[]>();
        for (const memory of memories) {
            const existing = grouped.get(memory.category) || [];
            existing.push(memory);
            grouped.set(memory.category, existing);
        }

        const categoryLabels: Record<MemoryCategory, string> = {
            PREFERENCE: '📌 Learning Preferences',
            FACT: '📝 Student Info',
            PROGRESS: '✅ Progress',
            CORRECTION: '🔄 Corrections',
            GOAL: '🎯 Goals & Deadlines',
            CUSTOM: '💡 Notes'
        };

        for (const [category, categoryMemories] of grouped) {
            const categoryHeader = `\n**${categoryLabels[category]}**:\n`;

            if (charCount + categoryHeader.length > MAX_MEMORY_CHARS) break;

            formattedContent += categoryHeader;
            charCount += categoryHeader.length;

            for (const memory of categoryMemories) {
                const line = `- ${memory.content}\n`;
                if (charCount + line.length > MAX_MEMORY_CHARS) break;

                formattedContent += line;
                charCount += line.length;
            }
        }

        return formattedContent.trim();
    }

    /**
     * Create a new memory for a subject
     */
    async create(
        userId: string,
        subjectId: string,
        input: CreateMemoryInput
    ): Promise<SubjectMemory> {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        return prisma.subjectMemory.create({
            data: {
                content: input.content,
                category: input.category,
                importance: input.importance ?? 5,
                sourceConversationId: input.sourceConversationId,
                expiresAt: input.expiresAt,
                subjectId
            }
        });
    }

    /**
     * Bulk create memories (used by extraction)
     */
    async createMany(
        userId: string,
        subjectId: string,
        conversationId: string,
        memories: ExtractedMemory[]
    ): Promise<number> {
        if (memories.length === 0) return 0;

        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const result = await prisma.subjectMemory.createMany({
            data: memories.map(mem => ({
                content: mem.content,
                category: mem.category,
                importance: mem.importance,
                sourceConversationId: conversationId,
                subjectId
            }))
        });

        return result.count;
    }

    /**
     * Update a memory
     */
    async update(
        userId: string,
        memoryId: string,
        input: UpdateMemoryInput
    ): Promise<SubjectMemory> {
        // Find the memory and verify ownership through subject
        const memory = await prisma.subjectMemory.findUnique({
            where: { id: memoryId },
            include: { subject: true }
        });

        if (!memory) {
            throw AppError.notFound('Memory not found');
        }

        if (memory.subject.userId !== userId) {
            throw AppError.forbidden('Access denied');
        }

        return prisma.subjectMemory.update({
            where: { id: memoryId },
            data: input
        });
    }

    /**
     * Delete a memory (hard delete)
     */
    async delete(userId: string, memoryId: string): Promise<void> {
        // Find the memory and verify ownership through subject
        const memory = await prisma.subjectMemory.findUnique({
            where: { id: memoryId },
            include: { subject: true }
        });

        if (!memory) {
            throw AppError.notFound('Memory not found');
        }

        if (memory.subject.userId !== userId) {
            throw AppError.forbidden('Access denied');
        }

        await prisma.subjectMemory.delete({
            where: { id: memoryId }
        });
    }

    /**
     * Soft delete - deactivate a memory
     */
    async deactivate(userId: string, memoryId: string): Promise<SubjectMemory> {
        return this.update(userId, memoryId, { isActive: false });
    }

    /**
     * Get existing memory contents for deduplication during extraction
     */
    async getExistingMemoryContents(subjectId: string): Promise<string[]> {
        const memories = await prisma.subjectMemory.findMany({
            where: { subjectId, isActive: true },
            select: { content: true }
        });
        return memories.map(m => m.content);
    }

    /**
     * Cleanup expired memories
     */
    async cleanupExpired(): Promise<number> {
        const result = await prisma.subjectMemory.deleteMany({
            where: {
                expiresAt: { lt: new Date() }
            }
        });
        return result.count;
    }

    /**
     * Get memory count for a subject
     */
    async getCount(userId: string, subjectId: string): Promise<number> {
        await subjectService.verifyOwnership(userId, subjectId);

        return prisma.subjectMemory.count({
            where: { subjectId, isActive: true }
        });
    }
}

// Export singleton instance
export const memoryService = new MemoryService();
