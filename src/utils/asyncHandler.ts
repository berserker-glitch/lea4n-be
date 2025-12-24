import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to automatically catch and forward errors
 * to the Express error handling middleware.
 * 
 * Usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json(users);
 * }));
 */
type AsyncHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncHandler) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
