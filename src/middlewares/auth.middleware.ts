import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';

/**
 * Extended Request interface with authenticated user data
 */
export interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
        role: UserRole;
    };
}

interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}

/**
 * Authentication middleware that validates JWT tokens
 * and attaches user information to the request object.
 */
export const authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw AppError.unauthorized('No token provided', 'NO_TOKEN');
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify and decode token
        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
        } catch (jwtError) {
            if (jwtError instanceof jwt.TokenExpiredError) {
                throw AppError.unauthorized('Token has expired', 'TOKEN_EXPIRED');
            }
            if (jwtError instanceof jwt.JsonWebTokenError) {
                throw AppError.unauthorized('Invalid token', 'INVALID_TOKEN');
            }
            throw jwtError;
        }

        // Verify user still exists in database and get current role
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            throw AppError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
        }

        // Attach user to request object (use DB role for most up-to-date)
        (req as AuthenticatedRequest).user = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional authentication - allows requests without token
 * but still validates token if provided
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without user
        return next();
    }

    // Token provided, validate it
    return authenticate(req, res, next);
};
