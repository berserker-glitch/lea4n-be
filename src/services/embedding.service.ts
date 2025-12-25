import { AppError } from '../utils';

/**
 * Service for generating vector embeddings
 */
export class EmbeddingService {
    private apiKey: string;
    private apiUrl = 'https://openrouter.ai/api/v1/embeddings';
    private model = 'openai/text-embedding-3-small'; // Standard efficient model

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('Warning: OPENROUTER_API_KEY not set for EmbeddingService');
        }
    }

    /**
     * Generate embedding for a single string
     */
    async generate(text: string): Promise<number[]> {
        const embeddings = await this.generateBatch([text]);
        return embeddings[0];
    }

    /**
     * Generate embeddings for multiple strings in one request
     */
    async generateBatch(texts: string[]): Promise<number[][]> {
        if (!this.apiKey) {
            throw AppError.internal('Embedding API key not configured');
        }

        try {
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
                    input: texts,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Embedding API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = (await response.json()) as any;

            if (!data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid response from embedding API');
            }

            // OpenRouter/OpenAI response format: { data: [{ embedding: [...] }, ...] }
            return data.data.map((item: any) => item.embedding);
        } catch (error) {
            console.error('Embedding generation failed:', error);
            throw AppError.internal(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export const embeddingService = new EmbeddingService();
