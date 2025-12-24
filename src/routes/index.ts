import { Router } from 'express';
import authRoutes from './auth.routes';
import subjectRoutes from './subject.routes';
import conversationRoutes from './conversation.routes';

const router = Router();

// API Health check
router.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
    });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/subjects', subjectRoutes);
router.use('/conversations', conversationRoutes);

export default router;
