import prisma from '../config/database';
import { textExtractionService } from './text-extraction.service';
import { chunkingService } from './chunking.service';
import { embeddingService } from './embedding.service';
import { ProcessStatus } from '@prisma/client';
import path from 'path';

/**
 * Service to orchestrate the full file processing pipeline for RAG
 */
export class FileProcessorService {
    /**
     * Process a file: Extract -> Chunk -> Embed -> Store
     */
    async processFile(fileId: string): Promise<void> {
        try {
            // 1. Get file record
            const file = await prisma.file.findUnique({
                where: { id: fileId }
            });

            if (!file) {
                console.error(`FileProcessor: File ${fileId} not found`);
                return;
            }

            // Update status to PROCESSING
            await prisma.file.update({
                where: { id: fileId },
                data: { processStatus: ProcessStatus.PROCESSING }
            });

            console.log(`FileProcessor: Starting processing for file: ${file.originalName} (${fileId})`);

            // 2. Extract Text
            // Assuming uploads are relative to be root
            const absolutePath = path.resolve(file.path);
            const extractionResult = await textExtractionService.extract(absolutePath, file.mimeType);

            if (!extractionResult.text || extractionResult.text.trim().length === 0) {
                throw new Error('No text content extracted from file');
            }

            // 3. Chunk Text
            const chunks = chunkingService.semanticChunking(extractionResult.text, {
                chunkSize: 500,
                chunkOverlap: 50
            });

            console.log(`FileProcessor: Created ${chunks.length} chunks for file ${fileId}`);

            // 4. Generate Embeddings & Save in Batches
            // We'll process in batches of 10 to avoid API limits and manage DB transactions
            const batchSize = 10;
            let processedChunks = 0;

            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                const textsToEmbed = batch.map(c => c.content);

                const embeddings = await embeddingService.generateBatch(textsToEmbed);

                // Save chunks and embeddings in database
                await Promise.all(batch.map(async (chunk, index) => {
                    const createdChunk = await prisma.fileChunk.create({
                        data: {
                            fileId,
                            content: chunk.content,
                            chunkIndex: chunk.index,
                            metadata: JSON.stringify(chunk.metadata || {}),
                        }
                    });

                    await prisma.fileEmbedding.create({
                        data: {
                            chunkId: createdChunk.id,
                            vector: JSON.stringify(embeddings[index]),
                            model: 'openai/text-embedding-3-small'
                        }
                    });
                }));

                processedChunks += batch.length;
                console.log(`FileProcessor: Processed ${processedChunks}/${chunks.length} chunks`);
            }

            // 5. Finalize status
            await prisma.file.update({
                where: { id: fileId },
                data: {
                    processStatus: ProcessStatus.COMPLETED,
                    processedAt: new Date(),
                    chunkCount: chunks.length
                }
            });

            console.log(`FileProcessor: Completed processing for file ${fileId}`);
        } catch (error) {
            console.error(`FileProcessor: Error processing file ${fileId}:`, error);

            await prisma.file.update({
                where: { id: fileId },
                data: { processStatus: ProcessStatus.FAILED }
            }).catch(e => console.error('Failed to update file status to FAILED', e));
        }
    }

    /**
     * Batch process files for a subject
     */
    async processSubjectFiles(subjectId: string): Promise<void> {
        const files = await prisma.file.findMany({
            where: { subjectId, processStatus: ProcessStatus.PENDING }
        });

        for (const file of files) {
            // Process sequentially to avoid overwhelming the API/DB
            await this.processFile(file.id);
        }
    }
}

export const fileProcessorService = new FileProcessorService();
