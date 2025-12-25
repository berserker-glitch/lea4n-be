import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { fromPath } from 'pdf2pic';
import { AppError } from '../utils';
import { ocrService } from './ocr.service';

// Minimum characters to consider a PDF has enough text
const MIN_TEXT_THRESHOLD = 100;

interface ExtractionResult {
    text: string;
    pages?: { pageNumber: number; content: string }[];
    metadata?: Record<string, any>;
}

/**
 * Service for extracting text from various file formats
 */
export class TextExtractionService {
    /**
     * Extract text from a file based on its mime type
     */
    async extract(filePath: string, mimeType: string): Promise<ExtractionResult> {
        if (!fs.existsSync(filePath)) {
            throw AppError.notFound(`File not found at path: ${filePath}`);
        }

        try {
            if (mimeType === 'application/pdf') {
                return await this.extractPdf(filePath);
            } else if (
                mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                mimeType === 'application/msword'
            ) {
                return await this.extractWord(filePath);
            } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
                return await this.extractText(filePath);
            } else if (mimeType.startsWith('image/')) {
                return await this.extractImage(filePath);
            } else {
                throw AppError.badRequest(`Unsupported file type for extraction: ${mimeType}`);
            }
        } catch (error) {
            console.error(`Extraction error for ${filePath}:`, error);
            throw AppError.internal(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract text from PDF including page information
     */
    private async extractPdf(filePath: string): Promise<ExtractionResult> {
        const dataBuffer = fs.readFileSync(filePath);

        // pdf-parse v1 is a simple function
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(dataBuffer);

        // Check if PDF has enough text or is likely a scanned document
        const extractedText = data.text.trim();

        if (extractedText.length < MIN_TEXT_THRESHOLD && data.numpages > 0) {
            console.log(`TextExtraction: PDF has minimal text (${extractedText.length} chars), attempting OCR fallback`);
            return await this.extractPdfWithOCR(filePath, data.numpages);
        }

        return {
            text: extractedText,
            metadata: {
                totalPages: data.numpages,
                info: data.info,
                version: data.version
            }
        };
    }

    /**
     * Extract text from scanned PDF using OCR
     */
    private async extractPdfWithOCR(filePath: string, pageCount: number): Promise<ExtractionResult> {
        const tempDir = path.join(path.dirname(filePath), 'temp_ocr_' + Date.now());

        try {
            // Create temp directory for page images
            fs.mkdirSync(tempDir, { recursive: true });

            // Convert PDF pages to images
            const options = {
                density: 150,
                savePath: tempDir,
                format: 'png',
                width: 1200,
                height: 1600
            };

            const convert = fromPath(filePath, options);
            const imagePaths: string[] = [];

            // Convert each page (limit to first 10 pages for performance)
            const pagesToProcess = Math.min(pageCount, 10);

            for (let i = 1; i <= pagesToProcess; i++) {
                console.log(`TextExtraction: Converting PDF page ${i}/${pagesToProcess} to image`);
                const result = await convert(i);
                if (result.path) {
                    imagePaths.push(result.path);
                }
            }

            // Run OCR on all page images
            const ocrText = await ocrService.extractTextFromImages(imagePaths);

            return {
                text: ocrText,
                metadata: {
                    source: 'ocr',
                    model: 'deepseek-vl2',
                    totalPages: pageCount,
                    processedPages: pagesToProcess
                }
            };
        } finally {
            // Cleanup temp directory
            try {
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            } catch (e) {
                console.error('Failed to cleanup temp OCR directory:', e);
            }
        }
    }

    /**
     * Extract text from Word documents
     */
    private async extractWord(filePath: string): Promise<ExtractionResult> {
        const result = await mammoth.extractRawText({ path: filePath });
        return {
            text: result.value,
            metadata: {
                messages: result.messages
            }
        };
    }

    /**
     * Extract text from plain text files
     */
    private async extractText(filePath: string): Promise<ExtractionResult> {
        const text = fs.readFileSync(filePath, 'utf-8');
        return { text };
    }

    /**
     * Extract text from images using OCR
     */
    private async extractImage(filePath: string): Promise<ExtractionResult> {
        console.log(`TextExtraction: Running OCR on image ${filePath}`);
        const text = await ocrService.extractTextFromImage(filePath);
        return {
            text,
            metadata: {
                source: 'ocr',
                model: 'deepseek-vl2'
            }
        };
    }
}

export const textExtractionService = new TextExtractionService();
