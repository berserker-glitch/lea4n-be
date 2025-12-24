import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils';
import { isDevelopment } from '../config';

interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code?: string;
        statusCode: number;
        stack?: string;
    };
}

/**
 * Global error handling middleware.
 * Catches all errors and formats them consistently.
 */
export const errorHandler = (
    err: Error | AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Default error values
    let statusCode = 500;
    let message = 'Internal server error';
    let code: string | undefined;
    let isOperational = false;

    // Handle AppError instances
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        code = err.code;
        isOperational = err.isOperational;
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
        isOperational = true;
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token has expired';
        code = 'TOKEN_EXPIRED';
        isOperational = true;
    }

    // Log error (in production, you'd want to use a proper logger)
    if (!isOperational) {
        console.error('Unhandled Error:', err);
    } else if (isDevelopment) {
        console.log(`[${statusCode}] ${message}${code ? ` (${code})` : ''}`);
    }

    // Build error response
    const response: ErrorResponse = {
        success: false,
        error: {
            message,
            code,
            statusCode,
        },
    };

    // Include stack trace in development
    if (isDevelopment && err.stack) {
        response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};
