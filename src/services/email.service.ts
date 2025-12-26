import nodemailer from 'nodemailer';
import { config } from '../config';

/**
 * Email service for sending OTP verification emails
 */
export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: config.smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: config.smtpUser,
                pass: config.smtpPassword,
            },
        });
    }

    /**
     * Generate a 6-digit OTP
     */
    generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Send OTP verification email
     */
    async sendVerificationEmail(email: string, otp: string, name?: string): Promise<void> {
        const mailOptions = {
            from: `"Lea4n" <${config.smtpFrom}>`,
            to: email,
            subject: 'Verify your email - Lea4n',
            html: this.getVerificationEmailTemplate(otp, name),
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`Verification email sent to ${email}`);
        } catch (error) {
            console.error('Failed to send verification email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    /**
     * Get styled HTML email template for OTP verification
     */
    private getVerificationEmailTemplate(otp: string, name?: string): string {
        const greeting = name ? `Hi ${name}` : 'Hi there';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse;">
                    <!-- Logo -->
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">
                                <span style="background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Lea4n</span>
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Main Card -->
                    <tr>
                        <td style="background: linear-gradient(145deg, rgba(30, 30, 40, 0.95), rgba(20, 20, 30, 0.98)); border-radius: 16px; padding: 40px; border: 1px solid rgba(99, 102, 241, 0.2); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                            <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
                                Verify Your Email
                            </h2>
                            <p style="margin: 0 0 24px 0; font-size: 16px; color: #a1a1aa; line-height: 1.6;">
                                ${greeting}! Use the code below to verify your email address and complete your registration.
                            </p>
                            
                            <!-- OTP Code -->
                            <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(99, 102, 241, 0.3);">
                                <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #a1a1aa;">Verification Code</p>
                                <p style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', monospace;">
                                    ${otp}
                                </p>
                            </div>
                            
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #71717a;">
                                This code will expire in <strong style="color: #ffffff;">10 minutes</strong>.
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #71717a;">
                                If you didn't request this code, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding-top: 32px;">
                            <p style="margin: 0; font-size: 12px; color: #52525b;">
                                © ${new Date().getFullYear()} Lea4n. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }
}

// Export singleton instance
export const emailService = new EmailService();
