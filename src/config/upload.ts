import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// File filter - allowed types
const allowedMimeTypes = [
    // Documents
    'application/pdf',
    'text/plain',
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
];

const fileFilter = (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError(
            `File type ${file.mimetype} is not allowed. Allowed types: PDF, TXT, JPEG, PNG, GIF, WebP, SVG`,
            400,
            'INVALID_FILE_TYPE'
        ) as unknown as null);
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        // Generate unique filename: timestamp-randomstring-originalname
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);
        cb(null, `${uniqueSuffix}-${baseName}${ext}`);
    },
});

// Multer upload configuration
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 10, // Max 10 files at once
    },
});

// Helper to get file type from mimetype
export function getFileType(mimeType: string): 'PDF' | 'IMAGE' | 'DOCUMENT' | 'OTHER' {
    if (mimeType === 'application/pdf') {
        return 'PDF';
    }
    if (mimeType.startsWith('image/')) {
        return 'IMAGE';
    }
    if (mimeType === 'text/plain') {
        return 'DOCUMENT';
    }
    return 'OTHER';
}

// Helper to delete file from disk
export function deleteFileFromDisk(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const fullPath = path.join(uploadDir, path.basename(filePath));
        fs.unlink(fullPath, (err) => {
            if (err && err.code !== 'ENOENT') {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export const uploadsDirectory = uploadDir;
