import { Router } from 'express';
import { ragController } from '../controllers/rag.controller';
import { authenticate } from '../middlewares';
import { asyncHandler } from '../utils';

const router = Router();

// All RAG routes are protected
router.use(authenticate);

// Context-aware query
router.post('/query', asyncHandler(ragController.query));

// Context-aware stream query
router.post('/query/stream', asyncHandler(ragController.queryStream));

// Question generation
router.post('/questions', asyncHandler(ragController.generateQuestions));

export default router;
