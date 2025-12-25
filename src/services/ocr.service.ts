import fs from 'fs';
import path from 'path';
import { AppError } from '../utils';

/**
 * Service for OCR (Optical Character Recognition) using DeepSeek VL2 vision model
 */
export class OCRService {
    private apiKey: string;
    private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    private model = 'deepseek/deepseek-vl2'; // Vision-capable model

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('Warning: OPENROUTER_API_KEY not set for OCRService');
        }
    }

    /**
     * Extract text from an image file using vision model
     */
    async extractTextFromImage(imagePath: string): Promise<string> {
        if (!fs.existsSync(imagePath)) {
            throw AppError.notFound(`Image file not found: ${imagePath}`);
        }

        if (!this.apiKey) {
            throw AppError.internal('OCR API key not configured');
        }

        try {
            // Read image and convert to base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');

            // Determine MIME type from extension
            const ext = path.extname(imagePath).toLowerCase();
            const mimeType = this.getMimeType(ext);

            // Call vision API
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                    'X-Title': 'Lea4n Learning Platform',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Extract all the text from this image. Return ONLY the extracted text, maintaining the original structure and formatting as much as possible. Do not add any explanations or commentary.'
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 4096,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as any;
                throw new Error(`OCR API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json() as any;

            if (!data.choices || !data.choices[0]?.message?.content) {
                throw new Error('Invalid response from OCR API');
            }

            return data.choices[0].message.content;
        } catch (error) {
            console.error('OCR extraction failed:', error);
            throw AppError.internal(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract text from multiple images (e.g., PDF pages)
     */
    async extractTextFromImages(imagePaths: string[]): Promise<string> {
        const results: string[] = [];

        for (let i = 0; i < imagePaths.length; i++) {
            console.log(`OCR: Processing image ${i + 1}/${imagePaths.length}`);
            const text = await this.extractTextFromImage(imagePaths[i]);
            results.push(`--- Page ${i + 1} ---\n${text}`);
        }

        return results.join('\n\n');
    }

    /**
     * Check if a file is an image based on MIME type
     */
    isImage(mimeType: string): boolean {
        return mimeType.startsWith('image/');
    }

    /**
     * Get MIME type from file extension
     */
    private getMimeType(ext: string): string {
        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
        };
        return mimeTypes[ext] || 'image/png';
    }
}

export const ocrService = new OCRService();
