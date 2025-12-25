import prisma from '../config/database';
import { embeddingService } from './embedding.service';
import { FileTag } from '@prisma/client';

export interface RetrievedChunk {
    content: string;
    fileId: string;
    fileName: string;
    fileTag?: FileTag | null;
    similarity: number;
    chunkIndex: number;
    metadata?: any;
}

export interface RetrievalResult {
    chunks: RetrievedChunk[];
    queryEmbedding: number[];
}

/**
 * Service for Retrieval-Augmented Generation
 */
export class RAGService {
    /**
     * Retrieve relevant context chunks for a query
     */
    async retrieve(
        userId: string,
        query: string,
        options: {
            subjectId: string;
            fileTags?: FileTag[];
            topK?: number;
            minSimilarity?: number;
        }
    ): Promise<RetrievalResult> {
        const { subjectId, fileTags, topK = 5, minSimilarity = 0.3 } = options;

        console.log(`RAG: Retrieving for user ${userId}, subject ${subjectId}, query: "${query.substring(0, 50)}..."`);

        // 1. Generate embedding for the query
        const queryEmbedding = await embeddingService.generate(query);

        // 2. Fetch all embeddings for the subject (and optionally filter by tags)
        const embeddingsData = await (prisma as any).fileEmbedding.findMany({
            where: {
                chunk: {
                    file: {
                        userId,
                        subjectId,
                        ...(fileTags && fileTags.length > 0 ? { tag: { in: fileTags } } : {})
                    }
                }
            },
            include: {
                chunk: {
                    include: {
                        file: {
                            select: {
                                id: true,
                                originalName: true,
                                tag: true
                            }
                        }
                    }
                }
            }
        });

        // 3. Calculate similarity and rank chunks
        const rankedChunks = (embeddingsData as any[])
            .map(item => {
                const vector = JSON.parse(item.vector) as number[];
                const similarity = this.cosineSimilarity(queryEmbedding, vector);

                return {
                    content: item.chunk.content,
                    fileId: item.chunk.fileId,
                    fileName: item.chunk.file.originalName,
                    fileTag: item.chunk.file.tag,
                    similarity,
                    chunkIndex: item.chunk.chunkIndex,
                    metadata: item.chunk.metadata ? JSON.parse(item.chunk.metadata) : {}
                };
            })
            .sort((a, b) => b.similarity - a.similarity);

        // Debug: Log top similarity scores
        if (rankedChunks.length > 0) {
            console.log(`RAG: Top 5 similarity scores: ${rankedChunks.slice(0, 5).map(c => c.similarity.toFixed(4)).join(', ')}`);
        }

        // Filter by minimum similarity
        const filteredChunks = rankedChunks
            .filter(chunk => chunk.similarity >= minSimilarity)
            .slice(0, topK);

        console.log(`RAG: Found ${embeddingsData.length} embeddings, ${filteredChunks.length} relevant chunks after filtering`);

        return {
            chunks: filteredChunks,
            queryEmbedding
        };
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        return isNaN(similarity) ? 0 : similarity;
    }

    /**
     * Build a prompt-friendly context string from retrieved chunks
     */
    formatContext(chunks: RetrievedChunk[]): string {
        if (chunks.length === 0) return 'No relevant information found in study materials.';

        return chunks.map((chunk, i) => {
            const source = `Source ${i + 1}: ${chunk.fileName}${chunk.fileTag ? ` (${chunk.fileTag})` : ''}`;
            return `--- ${source} ---\n${chunk.content}`;
        }).join('\n\n');
    }
}

export const ragService = new RAGService();
