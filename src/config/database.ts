import { PrismaClient } from '@prisma/client';
import { isDevelopment } from './index';

// Create a single instance of PrismaClient
const prisma = new PrismaClient({
    log: isDevelopment ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;
