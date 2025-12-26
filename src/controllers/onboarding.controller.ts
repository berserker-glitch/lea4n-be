import { Request, Response } from 'express';
import { z } from 'zod';
import { onboardingService } from '../services/onboarding.service';
import { asyncHandler } from '../utils';
import { AuthenticatedRequest } from '../middlewares';

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

export const saveOnboardingAnswersSchema = z.object({
    heardFrom: z.enum([
        'SOCIAL_MEDIA',
        'FRIEND_REFERRAL',
        'SEARCH_ENGINE',
        'SCHOOL',
        'YOUTUBE',
        'OTHER',
    ] as const),
    institution: z.string().min(1, 'Institution is required').max(200),
});

// ===========================================
// CONTROLLER HANDLERS
// ===========================================

/**
 * Get onboarding status
 * GET /onboarding/status
 */
export const getOnboardingStatus = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = await onboardingService.getOnboardingStatus(authReq.user.id);

    res.status(200).json({
        success: true,
        data: status,
    });
});

/**
 * Save onboarding answers
 * POST /onboarding/answers
 */
export const saveOnboardingAnswers = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    await onboardingService.saveOnboardingAnswers(authReq.user.id, req.body);

    res.status(200).json({
        success: true,
        message: 'Onboarding answers saved successfully',
    });
});

/**
 * Complete user setup
 * POST /onboarding/complete
 */
export const completeSetup = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await onboardingService.completeSetup(authReq.user.id);

    res.status(200).json({
        success: true,
        message: result.message,
    });
});
