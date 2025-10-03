import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { emailConfig } from '../../../config';

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

    // Email templates - keep these for template generation
    getEmailTemplate(templateName: string, data: any): EmailTemplate {
        switch (templateName) {
            case 'welcome':
                return this.getWelcomeTemplate(data);
            case 'payment_confirmation':
                return this.getPaymentConfirmationTemplate(data);
            case 'payment_failure':
                return this.getPaymentFailureTemplate(data);
            case 'refund_confirmation':
                return this.getRefundConfirmationTemplate(data);
            case 'low_credits_warning':
                return this.getLowCreditsTemplate(data);
            case 'security_alert':
                return this.getSecurityAlertTemplate(data);
            case 'monthly_report':
                return this.getMonthlyReportTemplate(data);
            default:
                throw new Error(`Unknown email template: ${templateName}`);
        }
    }

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

    private getRefundConfirmationTemplate(data: any): EmailTemplate {
        return {
            subject: 'Refund Processed Successfully 💰',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Refund Processed</h1>
          <p>Your refund has been successfully processed and will be credited to your original payment method.</p>
          
          <div style="background: #ECFDF5; border: 1px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Refund Details:</h3>
            <p><strong>Package:</strong> ${data.packageName}</p>
            <p><strong>Refund Amount:</strong> ${data.currency} ${data.refundAmount}</p>
            <p><strong>Refund ID:</strong> ${data.refundId}</p>
            <p><strong>Reason:</strong> ${data.reason}</p>
          </div>

          <p>The refund will appear in your account within 5-7 business days, depending on your bank's processing time.</p>
          
          <p>If you have any questions about this refund, please contact our support team with the refund ID above.</p>
          
          <p>Thank you for using Genie AI!</p>
        </div>
      `,
        };
    }

    private getMonthlyReportTemplate(data: any): EmailTemplate {
        return {
            subject: `Your Monthly AI Usage Report - ${data.month} 📊`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Your Monthly Report</h1>
          <p>Here's your AI usage summary for ${data.month}:</p>
          
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Usage Statistics:</h3>
            <p><strong>Total Chats:</strong> ${data.totalChats}</p>
            <p><strong>Total Messages:</strong> ${data.totalMessages}</p>
            <p><strong>Credits Used:</strong> ${data.creditsUsed}</p>
            <p><strong>Favorite Model:</strong> ${data.favoriteModel}</p>
            <p><strong>Total Spent:</strong> ₹${data.totalSpent}</p>
          </div>

          <p>Keep exploring the power of AI with Genie!</p>
          <p><a href="${this.config.appUrl}/analytics" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Detailed Analytics</a></p>
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

    // High-level email methods for JobSchedulerService
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
}