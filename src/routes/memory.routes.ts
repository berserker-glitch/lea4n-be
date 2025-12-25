import { Router } from 'express';
import { authenticate } from '../middlewares';
import {
    getMemories,
    getMemoryCount,
    createMemory
} from '../controllers/memory.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// SUBJECT-SCOPED MEMORY ROUTES
// These are mounted under /subjects/:subjectId/memories
// ===========================================

// Get all memories for a subject
router.get('/', getMemories);

// Get memory count for a subject
router.get('/count', getMemoryCount);

// Create a new memory for a subject
router.post('/', createMemory);

export default router;
