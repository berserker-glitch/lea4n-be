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

export const verifyEmailSchema = z.object({
    email: z.string().email('Invalid email format'),
    otp: z.string().length(6, 'Verification code must be 6 digits'),
});

export const resendOTPSchema = z.object({
    email: z.string().email('Invalid email format'),
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
        message: 'Registration successful. Please check your email for verification code.',
        data: result,
    });
});

/**
 * Verify email with OTP
 * POST /auth/verify-email
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyEmail(req.body);

    res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: result,
    });
});

/**
 * Resend OTP for email verification
 * POST /auth/resend-otp
 */
export const resendOTP = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resendOTP(req.body.email);

    res.status(200).json({
        success: true,
        message: result.message,
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
