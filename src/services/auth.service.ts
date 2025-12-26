import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config';
import { AppError } from '../utils';
import { UserRole } from '@prisma/client';

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
        createdAt: Date;
    };
    token: string;
}

/**
 * Authentication service handling user registration, login, and token management.
 */
export class AuthService {
    /**
     * Register a new user
     */
    async register(input: RegisterInput): Promise<AuthResponse> {
        const { email, password, name } = input;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            throw AppError.conflict('Email already registered', 'EMAIL_EXISTS');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });

        // Generate token with role
        const token = this.generateToken(user.id, user.email, user.role);

        return { user, token };
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

        // Generate token with role
        const token = this.generateToken(user.id, user.email, user.role);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
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
