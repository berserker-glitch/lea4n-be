import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
    // Server
    port: number;
    nodeEnv: string;

    // Database
    databaseUrl: string;

    // JWT
    jwtSecret: string;
    jwtExpiresIn: string;

    // Security
    bcryptSaltRounds: number;
    rateLimitMax: number;
    rateLimitWindowMs: number;

    // SMTP
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvVarAsNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Missing required environment variable: ${key}`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
}

export const config: Config = {
    // Server
    port: getEnvVarAsNumber('PORT', 3000),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),

    // Database
    databaseUrl: getEnvVar('DB_URL'),

    // JWT
    jwtSecret: getEnvVar('JWT_SECRET'),
    jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '7d'),

    // Security
    bcryptSaltRounds: getEnvVarAsNumber('BCRYPT_SALT_ROUNDS', 10),
    rateLimitMax: getEnvVarAsNumber('RATE_LIMIT_MAX', 100),
    rateLimitWindowMs: getEnvVarAsNumber('RATE_LIMIT_WINDOW_MS', 15) * 60 * 1000, // Convert minutes to ms

    // SMTP
    smtpHost: getEnvVar('SMTP_HOST', ''),
    smtpPort: getEnvVarAsNumber('SMTP_PORT', 587),
    smtpUser: getEnvVar('SMTP_USER', ''),
    smtpPassword: getEnvVar('SMTP_PASSWORD', ''),
    smtpFrom: getEnvVar('SMTP_FROM', 'noreply@lea4n.com'),
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
