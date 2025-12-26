import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from '../utils';
import { UserRole } from '@prisma/client';

/**
 * Middleware to require SUPERADMIN role
 * Must be used after authenticate middleware
 */
export const requireAdmin = (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): void => {
    try {
        if (!req.user) {
            throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
        }

        if (req.user.role !== UserRole.SUPERADMIN) {
            throw AppError.forbidden('Admin access required', 'ADMIN_REQUIRED');
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (...roles: UserRole[]) => {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
        try {
            if (!req.user) {
                throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
            }

            if (!roles.includes(req.user.role)) {
                throw AppError.forbidden(`Required role: ${roles.join(' or ')}`, 'INSUFFICIENT_ROLE');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
