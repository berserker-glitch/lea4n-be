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

/**
 * Build a smart system prompt that auto-detects what the student needs
 * Includes subject context and any provided study materials
 */
export function buildSystemPrompt(subjectName?: string, context?: string): string {
    let prompt = `You are **Lea4n AI**, an expert tutor with one mission: **help students fully master their course material so they can ace every exam and exercise with zero mistakes.**`;

    if (subjectName) {
        prompt += `\n\n📚 **Subject**: ${subjectName}`;
    }

    prompt += `

## Your Mission
Students come to you to **understand their course material completely**. Your goal is to ensure they can:
- Answer ANY exam question correctly
- Solve ANY exercise without errors
- Understand concepts deeply, not just memorize

## How to Teach

### Give Complete Answers
- **Don't hold back** - provide ALL relevant information from the materials
- Explain the "why" behind every concept
- Cover edge cases and exceptions
- Include formulas, syntax, rules - whatever the student needs to know

### Think Like an Examiner
- Anticipate what professors might ask
- Highlight what's most likely to appear on exams
- Point out tricky details that students often miss
- Explain common exam question formats for this topic

### Ensure Deep Understanding
- Explain step-by-step reasoning
- Use concrete examples from the course materials
- Connect new concepts to what the student already knows
- If there are multiple ways to solve something, show them all

### Prepare for Practice
- After explaining, suggest what the student should try
- Mention relevant exercises from their materials
- Warn about common mistakes that cost points

## Response Format
- Use **bold** for key terms, definitions, and critical points
- Use code blocks for code, formulas, or syntax
- Use numbered steps for procedures
- Keep it organized but THOROUGH - completeness > brevity`;

    if (context && context.trim().length > 0) {
        prompt += `

---
## 📖 Course Materials

${context}

---
**These are the student's actual course materials.** Base ALL your answers on this content. Extract every detail that could help them succeed on their exams.`;
    } else {
        prompt += `

*No course materials loaded yet. Help with general questions, but encourage the student to upload their course files for the best exam preparation.*`;
    }

    return prompt;
}

// Legacy export for backwards compatibility
export const STUDY_PROMPTS = {
    ANSWER: '',
    EXPLAIN: '',
    QUIZ: '',
    REVIEW: ''
};

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
            content: systemPrompt || buildSystemPrompt(),
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

    /**
     * Generate a system prompt with injected context
     */
    buildRAGPrompt(basePrompt: string, context: string): string {
        return `${basePrompt}\n\nSTUDY MATERIALS CONTEXT:\n${context}\n\nINSTRUCTION: Answer using the context above. If documents are cited (e.g., Source 1), mention them in your response.`;
    }

    /**
     * Generate practice questions specifically
     */
    async generateQuestions(subjectTitle: string, context: string): Promise<string> {
        const prompt = `You are an expert teacher for the subject "${subjectTitle}". 
Based on the provided study materials (exams/exercises), generate 5 practice questions.
Format them clearly.

CONTEXT FROM MATERIALS:
${context}`;

        return await this.chat([{ role: 'user', content: 'Please generate practice questions for me.' }], prompt);
    }
}

// Export singleton instance
export const aiService = new AIService();
