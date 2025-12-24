import prisma from '../config/database';
import { AppError } from '../utils';

export interface CreateSubjectInput {
    title: string;
    description?: string;
}

export interface UpdateSubjectInput {
    title?: string;
    description?: string;
}

export interface SubjectListOptions {
    page?: number;
    limit?: number;
    search?: string;
}

/**
 * Subject service handling all subject-related business logic.
 * Ensures strict user isolation - users can only access their own subjects.
 */
export class SubjectService {
    /**
     * Create a new subject for a user
     */
    async create(userId: string, input: CreateSubjectInput) {
        const subject = await prisma.subject.create({
            data: {
                title: input.title,
                description: input.description,
                userId,
            },
            include: {
                _count: {
                    select: { conversations: true },
                },
            },
        });

        return subject;
    }

    /**
     * Get all subjects for a user with pagination and search
     */
    async findAll(userId: string, options: SubjectListOptions = {}) {
        const { page = 1, limit = 20, search } = options;
        const skip = (page - 1) * limit;

        const where = {
            userId,
            ...(search && {
                OR: [
                    { title: { contains: search } },
                    { description: { contains: search } },
                ],
            }),
        };

        const [subjects, total] = await Promise.all([
            prisma.subject.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    _count: {
                        select: { conversations: true },
                    },
                },
            }),
            prisma.subject.count({ where }),
        ]);

        return {
            data: subjects,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single subject by ID (with ownership verification)
     */
    async findById(userId: string, subjectId: string) {
        const subject = await prisma.subject.findFirst({
            where: {
                id: subjectId,
                userId, // Ensures user can only access their own subjects
            },
            include: {
                _count: {
                    select: { conversations: true },
                },
            },
        });

        if (!subject) {
            throw AppError.notFound('Subject not found', 'SUBJECT_NOT_FOUND');
        }

        return subject;
    }

    /**
     * Update a subject (with ownership verification)
     */
    async update(userId: string, subjectId: string, input: UpdateSubjectInput) {
        // First verify ownership
        await this.verifyOwnership(userId, subjectId);

        const subject = await prisma.subject.update({
            where: { id: subjectId },
            data: input,
            include: {
                _count: {
                    select: { conversations: true },
                },
            },
        });

        return subject;
    }

    /**
     * Delete a subject (with ownership verification)
     * This will cascade delete all conversations under this subject
     */
    async delete(userId: string, subjectId: string): Promise<void> {
        // First verify ownership
        await this.verifyOwnership(userId, subjectId);

        await prisma.subject.delete({
            where: { id: subjectId },
        });
    }

    /**
     * Verify that a user owns a subject
     */
    async verifyOwnership(userId: string, subjectId: string): Promise<void> {
        const subject = await prisma.subject.findFirst({
            where: {
                id: subjectId,
                userId,
            },
            select: { id: true },
        });

        if (!subject) {
            throw AppError.notFound('Subject not found', 'SUBJECT_NOT_FOUND');
        }
    }
}

// Export singleton instance
export const subjectService = new SubjectService();
