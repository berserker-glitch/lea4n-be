/**
 * AI Service - OpenRouter Integration
 * Handles communication with OpenRouter API using Gemini model
 * Supports both regular and streaming chat completions
 */

import { Response } from 'express';

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.0-flash-001';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenRouterResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface StreamChunk {
    id: string;
    choices: Array<{
        delta: {
            content?: string;
        };
        finish_reason: string | null;
    }>;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant for the Lea4n learning platform. 
You help students with their studies by answering questions, explaining concepts, 
and providing guidance on various subjects. Be clear, concise, and educational in your responses.
When appropriate, structure your responses with clear formatting to improve readability.`;

/**
 * AI Service class for handling chat completions
 */
export class AIService {
    private apiKey: string;

    constructor() {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn('Warning: OPENROUTER_API_KEY not set. AI features will not work.');
        }
        this.apiKey = apiKey || '';
    }

    /**
     * Build full messages array with system prompt
     */
    private buildMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
        const fullMessages: ChatMessage[] = [];

        fullMessages.push({
            role: 'system',
            content: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        });

        fullMessages.push(...messages);
        return fullMessages;
    }

    /**
     * Send a chat completion request to OpenRouter (non-streaming)
     */
    async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key not configured');
        }

        const fullMessages = this.buildMessages(messages, systemPrompt);

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                    'X-Title': 'Lea4n Learning Platform',
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: fullMessages,
                    max_tokens: 2048,
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
                throw new Error(
                    `OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`
                );
            }

            const data = await response.json() as OpenRouterResponse;

            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response from AI model');
            }

            return data.choices[0].message.content;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to communicate with AI service');
        }
    }

    /**
     * Stream a chat completion response using SSE
     * @param messages - Array of chat messages
     * @param res - Express response object for SSE
     * @param systemPrompt - Optional system prompt
     * @returns Accumulated response content
     */
    async chatStream(
        messages: ChatMessage[],
        res: Response,
        systemPrompt?: string
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key not configured');
        }

        const fullMessages = this.buildMessages(messages, systemPrompt);

        // NOTE: SSE headers should be set by the controller before calling this method

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                    'X-Title': 'Lea4n Learning Platform',
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: fullMessages,
                    max_tokens: 2048,
                    temperature: 0.7,
                    stream: true, // Enable streaming
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
                throw new Error(
                    `OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`
                );
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            let accumulatedContent = '';
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();

                        if (data === '[DONE]') {
                            // Send completion event
                            res.write('data: [DONE]\n\n');
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data) as StreamChunk;
                            const content = parsed.choices[0]?.delta?.content;

                            if (content) {
                                accumulatedContent += content;
                                // Send content chunk to client
                                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                            }
                        } catch {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            return accumulatedContent;
        } catch (error) {
            // Send error to client
            res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' })}\n\n`);
            throw error;
        }
    }

    /**
     * Generate a conversation title from the first message
     */
    async generateTitle(firstMessage: string): Promise<string> {
        try {
            const response = await this.chat(
                [{ role: 'user', content: firstMessage }],
                'Generate a very short title (max 6 words) for a conversation that starts with the following message. Return ONLY the title, no quotes or extra text.'
            );
            return response.slice(0, 50).trim();
        } catch {
            // Fallback: use first part of message as title
            return firstMessage.slice(0, 40).trim() + (firstMessage.length > 40 ? '...' : '');
        }
    }
}

// Export singleton instance
export const aiService = new AIService();
