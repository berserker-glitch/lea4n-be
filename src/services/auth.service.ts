import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config';
import { AppError } from '../utils';
import { UserRole } from '@prisma/client';
import { emailService } from './email.service';

export interface RegisterInput {
    email: string;
    password: string;
    name?: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string | null;
        role: UserRole;
        isEmailVerified: boolean;
        setupCompleted: boolean;
        createdAt: Date;
    };
    token: string;
}

export interface VerifyEmailInput {
    email: string;
    otp: string;
}

/**
 * Authentication service handling user registration, login, and token management.
 */
export class AuthService {
    private readonly OTP_EXPIRY_MINUTES = 10;

    /**
     * Register a new user (unverified - requires email verification)
     */
    async register(input: RegisterInput): Promise<AuthResponse> {
        const { email, password, name } = input;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            // If user exists but not verified, allow re-registration (update OTP)
            if (!existingUser.isEmailVerified) {
                const otp = emailService.generateOTP();
                const otpExpiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        emailVerificationOTP: otp,
                        otpExpiresAt,
                        password: await bcrypt.hash(password, config.bcryptSaltRounds),
                        name,
                    },
                });

                // Send verification email
                await emailService.sendVerificationEmail(email, otp, name);

                const token = this.generateToken(existingUser.id, email, existingUser.role);
                return {
                    user: {
                        id: existingUser.id,
                        email,
                        name: name || existingUser.name,
                        role: existingUser.role,
                        isEmailVerified: false,
                        setupCompleted: false,
                        createdAt: existingUser.createdAt,
                    },
                    token,
                };
            }
            throw AppError.conflict('Email already registered', 'EMAIL_EXISTS');
        }

        // Generate OTP
        const otp = emailService.generateOTP();
        const otpExpiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

        // Create user (unverified)
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
                isEmailVerified: false,
                emailVerificationOTP: otp,
                otpExpiresAt,
                setupCompleted: false,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isEmailVerified: true,
                setupCompleted: true,
                createdAt: true,
            },
        });

        // Send verification email
        await emailService.sendVerificationEmail(email, otp, name);

        // Generate token with role
        const token = this.generateToken(user.id, user.email, user.role);

        return { user, token };
    }

    /**
     * Verify email with OTP
     */
    async verifyEmail(input: VerifyEmailInput): Promise<AuthResponse> {
        const { email, otp } = input;

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        if (user.isEmailVerified) {
            throw AppError.badRequest('Email already verified', 'ALREADY_VERIFIED');
        }

        if (!user.emailVerificationOTP || !user.otpExpiresAt) {
            throw AppError.badRequest('No verification code found. Please request a new one.', 'NO_OTP');
        }

        if (new Date() > user.otpExpiresAt) {
            throw AppError.badRequest('Verification code expired. Please request a new one.', 'OTP_EXPIRED');
        }

        if (user.emailVerificationOTP !== otp) {
            throw AppError.badRequest('Invalid verification code', 'INVALID_OTP');
        }

        // Update user as verified
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                emailVerificationOTP: null,
                otpExpiresAt: null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isEmailVerified: true,
                setupCompleted: true,
                createdAt: true,
            },
        });

        const token = this.generateToken(updatedUser.id, updatedUser.email, updatedUser.role);

        return { user: updatedUser, token };
    }

    /**
     * Resend OTP for email verification
     */
    async resendOTP(email: string): Promise<{ message: string }> {
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        if (user.isEmailVerified) {
            throw AppError.badRequest('Email already verified', 'ALREADY_VERIFIED');
        }

        // Generate new OTP
        const otp = emailService.generateOTP();
        const otpExpiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerificationOTP: otp,
                otpExpiresAt,
            },
        });

        // Send verification email
        await emailService.sendVerificationEmail(email, otp, user.name || undefined);

        return { message: 'Verification code sent successfully' };
    }

    /**
     * Login user with email and password
     */
    async login(input: LoginInput): Promise<AuthResponse> {
        const { email, password } = input;

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
        }

        // Auto-verify and complete setup for SUPERADMIN accounts
        if (user.role === 'SUPERADMIN' && (!user.isEmailVerified || !user.setupCompleted)) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    isEmailVerified: true,
                    setupCompleted: true,
                    emailVerificationOTP: null,
                    otpExpiresAt: null,
                },
            });
            user.isEmailVerified = true;
            user.setupCompleted = true;
        }

        // Generate token with role
        const token = this.generateToken(user.id, user.email, user.role);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                setupCompleted: user.setupCompleted,
                createdAt: user.createdAt,
            },
            token,
        };
    }

    /**
     * Get current user profile
     */
    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isEmailVerified: true,
                setupCompleted: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        subjects: true,
                        conversations: true,
                    },
                },
            },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        return user;
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: string, data: { name?: string }) {
        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return user;
    }

    /**
     * Change user password
     */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw AppError.notFound('User not found', 'USER_NOT_FOUND');
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            throw AppError.unauthorized('Current password is incorrect', 'INVALID_PASSWORD');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, config.bcryptSaltRounds);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
    }

    /**
     * Generate JWT token with role
     */
    private generateToken(userId: string, email: string, role: UserRole): string {
        return jwt.sign(
            { userId, email, role },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
        );
    }
}

// Export singleton instance
export const authService = new AuthService();
