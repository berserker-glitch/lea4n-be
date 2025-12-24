import { Router } from 'express';
import { authenticate, validate } from '../middlewares';
import {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    registerSchema,
    loginSchema,
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
 * @route   POST /auth/login
 * @desc    Login user and get token
 * @access  Public
 */
router.post('/login', validate(loginSchema), login);

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
