import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from '../utils';

/**
 * Validation targets - where to look for data in the request
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Creates a validation middleware for request data using Zod schemas.
 * 
 * @param schema - Zod schema to validate against
 * @param target - Where to find the data (body, query, or params)
 */
export const validate = <T>(
    schema: ZodSchema<T>,
    target: ValidationTarget = 'body'
) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            const data = req[target];
            const validated = schema.parse(data);

            // Replace the request data with parsed/transformed data
            req[target] = validated as typeof req[typeof target];

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));

                const errorMessage = formattedErrors
                    .map((e) => `${e.field}: ${e.message}`)
                    .join('; ');

                next(AppError.badRequest(`Validation failed: ${errorMessage}`, 'VALIDATION_ERROR'));
                return;
            }
            next(error);
        }
    };
};

/**
 * Validates multiple targets at once
 */
export const validateAll = <
    TBody = unknown,
    TQuery = unknown,
    TParams = unknown
>(schemas: {
    body?: ZodSchema<TBody>;
    query?: ZodSchema<TQuery>;
    params?: ZodSchema<TParams>;
}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const errors: string[] = [];

        for (const [target, schema] of Object.entries(schemas)) {
            if (schema) {
                try {
                    const data = req[target as ValidationTarget];
                    const validated = schema.parse(data);
                    req[target as ValidationTarget] = validated as typeof data;
                } catch (error) {
                    if (error instanceof ZodError) {
                        error.errors.forEach((err) => {
                            errors.push(`${target}.${err.path.join('.')}: ${err.message}`);
                        });
                    }
                }
            }
        }

        if (errors.length > 0) {
            next(AppError.badRequest(`Validation failed: ${errors.join('; ')}`, 'VALIDATION_ERROR'));
            return;
        }

        next();
    };
};
