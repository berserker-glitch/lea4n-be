import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        ),
    name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        ),
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Register a new user
 * POST /auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);

    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
    });
});

/**
 * Login user
 * POST /auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
    });
});

/**
 * Get current user profile
 * GET /auth/me
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const user = await authService.getProfile(authReq.user.id);

    res.status(200).json({
        success: true,
        data: user,
    });
});

/**
 * Update current user profile
 * PATCH /auth/me
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const user = await authService.updateProfile(authReq.user.id, req.body);

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
    });
});

/**
 * Change password
 * POST /auth/change-password
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(authReq.user.id, currentPassword, newPassword);

    res.status(200).json({
        success: true,
        message: 'Password changed successfully',
    });
});
