import prisma from '../config/database';
import { AppError } from '../utils';
import { UserSource } from '@prisma/client';

export interface OnboardingInput {
    heardFrom: UserSource;
    institution: string;
}

/**
 * Onboarding service for handling user setup flow
 */
export class OnboardingService {
    /**
     * Save onboarding answers
     */
    async saveOnboardingAnswers(userId: string, input: OnboardingInput): Promise<void> {
        const { heardFrom, institution } = input;

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { onboarding: true },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        // Create or update onboarding data
        if (user.onboarding) {
            await prisma.userOnboarding.update({
                where: { userId },
                data: { heardFrom, institution },
            });
        } else {
            await prisma.userOnboarding.create({
                data: {
                    userId,
                    heardFrom,
                    institution,
                },
            });
        }
    }

    /**
     * Complete user setup
     */
    async completeSetup(userId: string): Promise<{ message: string }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { onboarding: true, subjects: true },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        if (!user.onboarding) {
            throw AppError.badRequest('Please complete onboarding questions first', 'ONBOARDING_INCOMPLETE');
        }

        if (user.subjects.length === 0) {
            throw AppError.badRequest('Please create at least one subject', 'NO_SUBJECTS');
        }

        await prisma.user.update({
            where: { id: userId },
            data: { setupCompleted: true },
        });

        return { message: 'Setup completed successfully' };
    }

    /**
     * Get onboarding status for a user
     */
    async getOnboardingStatus(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                isEmailVerified: true,
                setupCompleted: true,
                onboarding: true,
                _count: { select: { subjects: true } },
            },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        return {
            isEmailVerified: user.isEmailVerified,
            setupCompleted: user.setupCompleted,
            hasOnboardingAnswers: !!user.onboarding,
            subjectsCount: user._count.subjects,
        };
    }

    /**
     * Get analytics for admin dashboard - user sources
     */
    async getSourceAnalytics() {
        const sources = await prisma.userOnboarding.groupBy({
            by: ['heardFrom'],
            _count: { heardFrom: true },
        });

        return sources.map(s => ({
            source: s.heardFrom,
            count: s._count.heardFrom,
        }));
    }

    /**
     * Get analytics for admin dashboard - top institutions
     */
    async getInstitutionAnalytics(limit: number = 10) {
        const institutions = await prisma.userOnboarding.groupBy({
            by: ['institution'],
            _count: { institution: true },
            orderBy: { _count: { institution: 'desc' } },
            take: limit,
        });

        return institutions.map(i => ({
            institution: i.institution,
            count: i._count.institution,
        }));
    }

    /**
     * Get user growth trends for admin dashboard
     */
    async getUserGrowthTrends(days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const users = await prisma.user.findMany({
            where: { createdAt: { gte: startDate } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Group by date
        const dailyCounts: { [date: string]: number } = {};
        users.forEach(user => {
            const dateKey = user.createdAt.toISOString().split('T')[0];
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
        });

        // Fill in missing dates
        const result: { date: string; count: number }[] = [];
        const currentDate = new Date(startDate);
        const today = new Date();

        while (currentDate <= today) {
            const dateKey = currentDate.toISOString().split('T')[0];
            result.push({
                date: dateKey,
                count: dailyCounts[dateKey] || 0,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return result;
    }
}

// Export singleton instance
export const onboardingService = new OnboardingService();
