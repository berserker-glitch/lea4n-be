/**
 * Script to create a SUPERADMIN user
 * 
 * Usage: npx ts-node scripts/create-superadmin.ts
 * 
 * Or set environment variables:
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=yourpassword
 *   ADMIN_NAME="Admin User"
 */

import bcrypt from 'bcryptjs';
import prisma from '../src/config/database';
import { config } from '../src/config';

async function createSuperAdmin() {
    // Get credentials from env or use defaults
    const email = process.env.ADMIN_EMAIL || 'admin@lea4n.com';
    const password = process.env.ADMIN_PASSWORD || 'Lea4nLea4n';
    const name = process.env.ADMIN_NAME || 'Super Admin';

    console.log('🔐 Creating SUPERADMIN user...\n');

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            if (existingUser.role === 'SUPERADMIN') {
                console.log(`✅ User "${email}" is already a SUPERADMIN`);
                return;
            }

            // Upgrade existing user to SUPERADMIN
            await prisma.user.update({
                where: { email: email.toLowerCase() },
                data: { role: 'SUPERADMIN' },
            });
            console.log(`✅ Upgraded existing user "${email}" to SUPERADMIN`);
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

        // Create the SUPERADMIN user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
                role: 'SUPERADMIN',
            },
        });

        console.log('✅ SUPERADMIN user created successfully!\n');
        console.log('   📧 Email:', user.email);
        console.log('   👤 Name:', user.name);
        console.log('   🔑 Password:', password);
        console.log('   👑 Role:', user.role);
        console.log('\n🎉 You can now login with these credentials!');

    } catch (error) {
        console.error('❌ Error creating SUPERADMIN:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createSuperAdmin();
