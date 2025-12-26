import { Router } from 'express';
import { authenticate, validate } from '../middlewares';
import {
    register,
    login,
    verifyEmail,
    resendOTP,
    getProfile,
    updateProfile,
    changePassword,
    githubAuth,
    githubCallback,
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    resendOTPSchema,
    updateProfileSchema,
    changePasswordSchema,
} from '../controllers/auth.controller';

const router = Router();

// ===========================================
// PUBLIC ROUTES
// ===========================================

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(registerSchema), register);

/**
 * @route   POST /auth/verify-email
 * @desc    Verify email with OTP
 * @access  Public
 */
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);

/**
 * @route   POST /auth/resend-otp
 * @desc    Resend OTP for email verification
 * @access  Public
 */
router.post('/resend-otp', validate(resendOTPSchema), resendOTP);

/**
 * @route   POST /auth/login
 * @desc    Login user and get token
 * @access  Public
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route   GET /auth/github
 * @desc    Get GitHub OAuth authorization URL
 * @access  Public
 */
router.get('/github', githubAuth);

/**
 * @route   POST /auth/github/callback
 * @desc    Handle GitHub OAuth callback
 * @access  Public
 */
router.post('/github/callback', githubCallback);

// ===========================================
// PROTECTED ROUTES
// ===========================================

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getProfile);

/**
 * @route   PATCH /auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile);

/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    changePassword
);

export default router;

