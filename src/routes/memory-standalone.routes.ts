import { Router } from 'express';
import { authenticate } from '../middlewares';
import {
    updateMemory,
    deleteMemory,
    deactivateMemory
} from '../controllers/memory.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// STANDALONE MEMORY ROUTES
// These are mounted under /memories/:memoryId
// ===========================================

// Update a memory
router.patch('/:memoryId', updateMemory);

// Delete a memory
router.delete('/:memoryId', deleteMemory);

// Deactivate a memory (soft delete)
router.post('/:memoryId/deactivate', deactivateMemory);

export default router;
