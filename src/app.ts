import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config, isDevelopment } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares';

// ===========================================
// CREATE EXPRESS APPLICATION
// ===========================================

const app: Application = express();

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Set security HTTP headers
app.use(helmet());

// Enable CORS with configuration
app.use(
    cors({
        origin: isDevelopment ? '*' : process.env.CORS_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// Rate limiting to prevent brute force attacks
const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: {
        success: false,
        error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
            statusCode: 429,
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', limiter);

// ===========================================
// BODY PARSING MIDDLEWARE
// ===========================================

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===========================================
// STATIC FILES - Serve uploaded files
// ===========================================

const uploadsPath = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// ===========================================
// ROUTES
// ===========================================

// Mount API routes
app.use('/api', routes);

// Root route
app.get('/', (_req, res) => {
    res.json({
        success: true,
        message: 'Lea4n API Server',
        version: '1.0.0',
        documentation: '/api/health',
    });
});

// ===========================================
// ERROR HANDLING
// ===========================================

// Handle 404 - Route not found
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================

const startServer = async (): Promise<void> => {
    try {
        app.listen(config.port, () => {
            console.log('='.repeat(50));
            console.log(`🚀 Server is running on port ${config.port}`);
            console.log(`📍 Environment: ${config.nodeEnv}`);
            console.log(`🔗 API URL: http://localhost:${config.port}/api`);
            console.log(`❤️  Health: http://localhost:${config.port}/api/health`);
            console.log('='.repeat(50));
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

// Start the server
startServer();

export default app;
