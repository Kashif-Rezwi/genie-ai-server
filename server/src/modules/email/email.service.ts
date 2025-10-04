import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { emailConfig } from '../../config';

export interface EmailTemplate {
    subject: string;
    html: string;
    text?: string;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly config = emailConfig();
    private transporter: nodemailer.Transporter;

    constructor() {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        this.transporter = nodemailer.createTransport({
            host: this.config.smtp.host,
            port: this.config.smtp.port,
            secure: this.config.smtp.secure,
            auth: {
                user: this.config.smtp.auth.user,
                pass: this.config.smtp.auth.pass,
            },
        });

        // Verify connection
        this.transporter.verify((error, success) => {
            if (error) {
                this.logger.error('SMTP connection failed:', error);
            } else {
                this.logger.log('✅ SMTP server ready');
            }
        });
    }

    async sendEmail(
        to: string | string[],
        subject: string,
        html: string,
        text?: string,
        attachments?: any[],
    ): Promise<any> {
        try {
            const mailOptions = {
                from: this.config.from,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html,
                text: text || this.htmlToText(html),
                attachments,
            };

            const result = await this.transporter.sendMail(mailOptions);
            this.logger.log(`Email sent successfully to ${mailOptions.to}`);
            return result;
        } catch (error) {
            this.logger.error('Failed to send email:', error);
            throw error;
        }
    }

    // Email templates
    getEmailTemplate(templateName: string, data: any): EmailTemplate {
        switch (templateName) {
            case 'welcome':
                return this.getWelcomeTemplate(data);
            case 'payment_confirmation':
                return this.getPaymentConfirmationTemplate(data);
            case 'payment_failure':
                return this.getPaymentFailureTemplate(data);
            case 'low_credits_warning':
                return this.getLowCreditsTemplate(data);
            case 'security_alert':
                return this.getSecurityAlertTemplate(data);
            case 'alert':
                return this.getAlertTemplate(data);
            default:
                throw new Error(`Unknown email template: ${templateName}`);
        }
    }

    // High-level email methods
    async sendWelcomeEmail(userEmail: string, userData: any): Promise<any> {
        const template = this.getEmailTemplate('welcome', userData);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendPaymentConfirmationEmail(userEmail: string, paymentData: any): Promise<any> {
        const template = this.getEmailTemplate('payment_confirmation', paymentData);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendPaymentFailureEmail(userEmail: string, failureData: any): Promise<any> {
        const template = this.getEmailTemplate('payment_failure', failureData);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendLowCreditsEmail(userEmail: string, creditsData: any): Promise<any> {
        const template = this.getEmailTemplate('low_credits_warning', creditsData);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendSecurityAlertEmail(userEmail: string, securityData: any): Promise<any> {
        const template = this.getEmailTemplate('security_alert', securityData);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendAlertEmail(userEmail: string, alertData: any): Promise<any> {
        const template = this.getEmailTemplate('alert', alertData);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<any> {
        const resetUrl = `${this.config.appUrl}/reset-password?token=${resetToken}`;
        const template = this.getPasswordResetTemplate(resetUrl);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    async sendVerificationEmail(userEmail: string, verificationToken: string): Promise<any> {
        const verificationUrl = `${this.config.appUrl}/verify-email?token=${verificationToken}`;
        const template = this.getEmailVerificationTemplate(verificationUrl);
        return this.sendEmail(
            userEmail,
            template.subject,
            template.html,
            template.text
        );
    }

    // Template implementations
    private getWelcomeTemplate(data: any): EmailTemplate {
        return {
            subject: 'Welcome to Genie AI! 🎉',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to Genie AI!</h1>
          <p>Hi${data.name ? ` ${data.name}` : ''},</p>
          <p>Welcome to Genie AI! We're excited to have you on board.</p>
          <p>To get you started, we've added <strong>${data.creditsAdded} free credits</strong> to your account.</p>
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>What you can do with Genie AI:</h3>
            <ul>
              <li>Chat with multiple AI models (GPT-4, Claude, and more)</li>
              <li>Create unlimited chat sessions with custom prompts</li>
              <li>Stream real-time AI responses</li>
              <li>Track your usage and costs</li>
            </ul>
          </div>
          <p><a href="${this.config.appUrl}/dashboard" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Start Chatting Now</a></p>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Best regards,<br>The Genie AI Team</p>
        </div>
      `,
        };
    }

    private getPaymentConfirmationTemplate(data: any): EmailTemplate {
        return {
            subject: 'Payment Confirmed - Credits Added! 💳',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Payment Confirmed!</h1>
          <p>Your payment has been successfully processed.</p>
          
          <div style="background: #ECFDF5; border: 1px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Payment Details:</h3>
            <p><strong>Package:</strong> ${data.packageName}</p>
            <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
            <p><strong>Credits Added:</strong> ${data.creditsAdded}</p>
            <p><strong>New Balance:</strong> ${data.newBalance} credits</p>
            <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
          </div>

          <p>Your credits are now available and ready to use!</p>
          <p><a href="${this.config.appUrl}/dashboard" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Start Using Your Credits</a></p>
          
          <p>Thank you for choosing Genie AI!</p>
        </div>
      `,
        };
    }

    private getPaymentFailureTemplate(data: any): EmailTemplate {
        return {
            subject: 'Payment Failed - Need Help? 🔧',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #DC2626;">Payment Failed</h1>
          <p>We encountered an issue processing your payment.</p>
          
          <div style="background: #FEF2F2; border: 1px solid #DC2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Payment Details:</h3>
            <p><strong>Package:</strong> ${data.packageName}</p>
            <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
            <p><strong>Order ID:</strong> ${data.orderId}</p>
            <p><strong>Reason:</strong> ${data.failureReason}</p>
          </div>

          <h3>What you can do:</h3>
          <ul>
            <li>Check your payment method details</li>
            <li>Ensure sufficient funds are available</li>
            <li>Try again with a different payment method</li>
            <li>Contact our support team for assistance</li>
          </ul>

          <p><a href="${this.config.appUrl}/credits/packages" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Try Again</a></p>
          
          <p>If you need help, please contact our support team with the order ID above.</p>
        </div>
      `,
        };
    }

    private getLowCreditsTemplate(data: any): EmailTemplate {
        return {
            subject: 'Low Credits Alert - Time to Top Up? ⚡',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #F59E0B;">Low Credits Alert</h1>
          <p>Your credit balance is running low.</p>
          
          <div style="background: #FFFBEB; border: 1px solid #F59E0B; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Current Balance:</strong> ${data.currentBalance} credits</p>
            <p><strong>Alert Threshold:</strong> ${data.threshold} credits</p>
          </div>

          <p>To continue enjoying uninterrupted AI conversations, consider purchasing more credits.</p>
          
          ${data.recommendedPackage ? `<p><strong>Recommended:</strong> ${data.recommendedPackage} package for the best value!</p>` : ''}

          <p><a href="${this.config.appUrl}/credits/packages" style="background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Buy Credits Now</a></p>
        </div>
      `,
        };
    }

    private getSecurityAlertTemplate(data: any): EmailTemplate {
        return {
            subject: '🔒 Security Alert - Account Activity',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #DC2626;">Security Alert</h1>
          <p>We detected ${data.alertType} on your account.</p>
          
          <div style="background: #FEF2F2; border: 1px solid #DC2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Alert Details:</h3>
            <p><strong>Type:</strong> ${data.alertType}</p>
            <p><strong>Description:</strong> ${data.description}</p>
            <p><strong>Time:</strong> ${data.timestamp}</p>
            <p><strong>IP Address:</strong> ${data.ip}</p>
          </div>

          ${
              data.actionRequired
                  ? `
            <div style="background: #FEF2F2; padding: 15px; border-radius: 6px;">
              <strong>Action Required:</strong> Please review your account security settings.
            </div>
          `
                  : ''
          }

          <p>If this was you, no action is needed. If you don't recognize this activity, please secure your account immediately.</p>
          
          <p><a href="${this.config.appUrl}/security" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Security Settings</a></p>
        </div>
      `,
        };
    }

    private getAlertTemplate(data: any): EmailTemplate {
        return {
            subject: `🚨 Alert: ${data.title}`,
            html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${this.getSeverityColor(data.severity)}; color: white; padding: 20px; text-align: center;">
          <h1>🚨 ${data.title}</h1>
          <p style="margin: 0; font-size: 18px;">Severity: ${data.severity?.toUpperCase() || 'MEDIUM'}</p>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <h2>Alert Details</h2>
          <p><strong>Time:</strong> ${data.timestamp || new Date().toISOString()}</p>
          <p><strong>Message:</strong> ${data.message}</p>
          
          ${
              data.data && Object.keys(data.data).length > 0
                  ? `
            <h3>Additional Data</h3>
            <pre style="background: #e9ecef; padding: 10px; border-radius: 4px;">${JSON.stringify(data.data, null, 2)}</pre>
          `
                  : ''
          }
        </div>
        
        <div style="padding: 20px; text-align: center; background: #e9ecef;">
          <p>This alert was generated by Genie AI Monitoring System</p>
          <p>Alert ID: ${data.id || 'N/A'}</p>
        </div>
      </div>
    `,
        };
    }

    private getSeverityColor(severity: string): string {
        switch (severity) {
            case 'critical':
                return '#dc3545';
            case 'high':
                return '#fd7e14';
            case 'medium':
                return '#ffc107';
            case 'low':
                return '#28a745';
            default:
                return '#6c757d';
        }
    }

    private getPasswordResetTemplate(resetUrl: string): EmailTemplate {
        return {
            subject: 'Reset Your Password - Genie AI',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Reset Your Password</h1>
          <p>You requested to reset your password for your Genie AI account.</p>
          <p>Click the button below to reset your password:</p>
          <p><a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p>Best regards,<br>The Genie AI Team</p>
        </div>
      `,
        };
    }

    private getEmailVerificationTemplate(verificationUrl: string): EmailTemplate {
        return {
            subject: 'Verify Your Email - Genie AI',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Verify Your Email Address</h1>
          <p>Welcome to Genie AI! Please verify your email address to complete your registration.</p>
          <p>Click the button below to verify your email:</p>
          <p><a href="${verificationUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verify Email</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account with us, please ignore this email.</p>
          <p>Best regards,<br>The Genie AI Team</p>
        </div>
      `,
        };
    }

    private htmlToText(html: string): string {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}
