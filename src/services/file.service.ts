import prisma from '../config/database';
import { AppError } from '../utils';
import { getFileType, deleteFileFromDisk } from '../config/upload';
import { subjectService } from './subject.service';
import { FileType, FileTag } from '@prisma/client';

export interface UploadedFile {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    path: string;
}

export interface FileListOptions {
    page?: number;
    limit?: number;
    type?: FileType;
    tag?: FileTag;
}

/**
 * File service handling all file-related business logic.
 * Ensures strict user/subject isolation.
 */
export class FileService {
    /**
     * Create a file record after upload
     */
    async create(
        userId: string,
        subjectId: string,
        file: UploadedFile,
        tag?: FileTag
    ) {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const fileType = getFileType(file.mimetype);

        const fileRecord = await prisma.file.create({
            data: {
                name: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                type: fileType,
                path: file.path,
                tag,
                subjectId,
                userId,
            },
        });

        return fileRecord;
    }

    /**
     * Upload multiple files
     */
    async createMany(
        userId: string,
        subjectId: string,
        files: UploadedFile[],
        tag?: FileTag
    ) {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const fileRecords = await Promise.all(
            files.map((file) => this.create(userId, subjectId, file, tag))
        );

        return fileRecords;
    }

    /**
     * Get all files for a subject (with ownership verification)
     */
    async findAllBySubject(
        userId: string,
        subjectId: string,
        options: FileListOptions = {}
    ) {
        // Verify user owns the subject
        await subjectService.verifyOwnership(userId, subjectId);

        const { page = 1, limit = 50, type, tag } = options;
        const skip = (page - 1) * limit;

        const where = {
            subjectId,
            userId,
            ...(type && { type }),
            ...(tag && { tag }),
        };

        const [files, total] = await Promise.all([
            prisma.file.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.file.count({ where }),
        ]);

        return {
            data: files,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all files for a user (across all subjects)
     */
    async findAllByUser(userId: string, options: FileListOptions = {}) {
        const { page = 1, limit = 50, type, tag } = options;
        const skip = (page - 1) * limit;

        const where = {
            userId,
            ...(type && { type }),
            ...(tag && { tag }),
        };

        const [files, total] = await Promise.all([
            prisma.file.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    subject: {
                        select: { id: true, title: true },
                    },
                },
            }),
            prisma.file.count({ where }),
        ]);

        return {
            data: files,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single file by ID (with ownership verification)
     */
    async findById(userId: string, fileId: string) {
        const file = await prisma.file.findFirst({
            where: {
                id: fileId,
                userId,
            },
            include: {
                subject: {
                    select: { id: true, title: true },
                },
            },
        });

        if (!file) {
            throw AppError.notFound('File not found', 'FILE_NOT_FOUND');
        }

        return file;
    }

    /**
     * Update file tag
     */
    async updateTag(userId: string, fileId: string, tag: FileTag) {
        await this.verifyOwnership(userId, fileId);

        const file = await prisma.file.update({
            where: { id: fileId },
            data: { tag },
        });

        return file;
    }

    /**
     * Delete a file (with ownership verification)
     */
    async delete(userId: string, fileId: string): Promise<void> {
        const file = await this.findById(userId, fileId);

        // Delete from disk
        try {
            await deleteFileFromDisk(file.path);
        } catch (error) {
            console.error('Failed to delete file from disk:', error);
            // Continue to delete from database even if disk delete fails
        }

        // Delete from database
        await prisma.file.delete({
            where: { id: fileId },
        });
    }

    /**
     * Delete all files for a subject
     */
    async deleteAllBySubject(userId: string, subjectId: string): Promise<void> {
        await subjectService.verifyOwnership(userId, subjectId);

        const files = await prisma.file.findMany({
            where: { subjectId, userId },
            select: { path: true },
        });

        // Delete from disk
        await Promise.all(
            files.map((file) => deleteFileFromDisk(file.path).catch(console.error))
        );

        // Delete from database
        await prisma.file.deleteMany({
            where: { subjectId, userId },
        });
    }

    /**
     * Verify that a user owns a file
     */
    async verifyOwnership(userId: string, fileId: string): Promise<void> {
        const file = await prisma.file.findFirst({
            where: {
                id: fileId,
                userId,
            },
            select: { id: true },
        });

        if (!file) {
            throw AppError.notFound('File not found', 'FILE_NOT_FOUND');
        }
    }
}

// Export singleton instance
export const fileService = new FileService();
