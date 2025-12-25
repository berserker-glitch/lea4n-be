import { encoding_for_model, TiktokenModel } from 'tiktoken';

export interface Chunk {
    content: string;
    index: number;
    metadata?: Record<string, any>;
}

export interface ChunkingOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    model?: string;
}

/**
 * Service for splitting text into manageable chunks for embeddings
 */
export class ChunkingService {
    private defaultChunkSize = 512;
    private defaultChunkOverlap = 50;
    private defaultModel: TiktokenModel = 'gpt-3.5-turbo'; // Standard for token counting

    /**
     * Split text into chunks using token-based semantic splitting
     */
    chunkText(text: string, options: ChunkingOptions = {}): Chunk[] {
        const {
            chunkSize = this.defaultChunkSize,
            chunkOverlap = this.defaultChunkOverlap,
            model = this.defaultModel
        } = options;

        const encoding = encoding_for_model(model as TiktokenModel);
        const tokens = encoding.encode(text);
        const chunks: Chunk[] = [];

        let start = 0;
        let index = 0;

        while (start < tokens.length) {
            const end = Math.min(start + chunkSize, tokens.length);
            const chunkTokens = tokens.slice(start, end);
            const content = new TextDecoder().decode(encoding.decode(chunkTokens));

            chunks.push({
                content,
                index,
                metadata: {
                    tokenCount: chunkTokens.length,
                    charCount: content.length
                }
            });

            start += (chunkSize - chunkOverlap);
            index++;

            // Safety check to prevent infinite loop
            if (chunkSize <= chunkOverlap) break;
        }

        encoding.free();
        return chunks;
    }

    /**
     * Advanced semantic chunking that tries to break at paragraph/sentence boundaries
     */
    semanticChunking(text: string, options: ChunkingOptions = {}): Chunk[] {
        const {
            chunkSize = this.defaultChunkSize
        } = options;

        // For now, using a simpler paragraph-aware split as a first pass
        // then refining with the token-based splitter
        const paragraphs = text.split(/\n\s*\n/);
        const chunks: Chunk[] = [];
        let currentChunk = '';
        let index = 0;

        for (const para of paragraphs) {
            if ((currentChunk + para).length < chunkSize * 4) { // Rough character estimate
                currentChunk += (currentChunk ? '\n\n' : '') + para;
            } else {
                if (currentChunk) {
                    chunks.push({
                        content: currentChunk,
                        index: index++,
                        metadata: { type: 'semantic' }
                    });
                }
                currentChunk = para;
            }
        }

        if (currentChunk) {
            chunks.push({
                content: currentChunk,
                index: index++,
                metadata: { type: 'semantic' }
            });
        }

        // If chunks are still too large, further sub-chunk them
        return chunks.flatMap(c => {
            const encoding = encoding_for_model(this.defaultModel);
            const tokens = encoding.encode(c.content);
            encoding.free();

            if (tokens.length > chunkSize) {
                return this.chunkText(c.content, options);
            }
            return [c];
        });
    }
}

export const chunkingService = new ChunkingService();
