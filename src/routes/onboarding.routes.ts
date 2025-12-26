import { Router } from 'express';
import { authenticate, validate } from '../middlewares';
import {
    saveOnboardingAnswers,
    completeSetup,
    getOnboardingStatus,
    saveOnboardingAnswersSchema,
} from '../controllers/onboarding.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /onboarding/status
 * @desc    Get onboarding status for current user
 * @access  Private
 */
router.get('/status', getOnboardingStatus);

/**
 * @route   POST /onboarding/answers
 * @desc    Save onboarding answers
 * @access  Private
 */
router.post('/answers', validate(saveOnboardingAnswersSchema), saveOnboardingAnswers);

/**
 * @route   POST /onboarding/complete
 * @desc    Complete user setup
 * @access  Private
 */
router.post('/complete', completeSetup);

export default router;
