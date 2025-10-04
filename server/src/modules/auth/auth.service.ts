import { Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MetricsService } from '../monitoring/services/metrics.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { VerifyEmailDto } from './dto/email-verification.dto';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

export interface JwtPayload {
    sub: string;
    email: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        creditsBalance: number;
    };
    accessToken: string;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService,
        private readonly metricsService: MetricsService,
    ) {}

    async register(registerDto: RegisterDto): Promise<AuthResponse> {
        const { email, password } = registerDto;

        // Check if user already exists
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Create new user
        const user = await this.usersService.create(email, password);

        // Generate JWT token
        const payload: JwtPayload = { sub: user.id, email: user.email };
        const accessToken = this.jwtService.sign(payload);

        // Send welcome email asynchronously (don't wait for it)
        this.emailService
            .sendWelcomeEmail(user.email, {
                name: user.email.split('@')[0],
                creditsAdded: user.creditsBalance,
            })
            .catch(error => {
                // Log error - for MVP, we don't need complex retry logic
                this.logger.error('Failed to send welcome email:', error);
            });

        // Record active user metric
        this.metricsService.recordActiveUser();
        
        return {
            user: {
                id: user.id,
                email: user.email,
                creditsBalance: user.creditsBalance,
            },
            accessToken,
        };
    }

    async login(loginDto: LoginDto): Promise<AuthResponse> {
        const { email, password } = loginDto;

        // Find user by email
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Validate password
        const isPasswordValid = await this.usersService.validatePassword(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check if user is active
        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        // Generate JWT token
        const payload: JwtPayload = { sub: user.id, email: user.email };
        const accessToken = this.jwtService.sign(payload);

        // Record active user metric
        this.metricsService.recordActiveUser();

        return {
            user: {
                id: user.id,
                email: user.email,
                creditsBalance: user.creditsBalance,
            },
            accessToken,
        };
    }

    async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto): Promise<{ message: string }> {
        const { email } = requestPasswordResetDto;

        const user = await this.usersService.findByEmail(email);
        if (!user) {
            // Don't reveal if user exists or not for security
            return { message: 'If an account with that email exists, a password reset link has been sent.' };
        }

        // Generate reset token
        const resetToken = uuidv4();
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        // Update user with reset token
        await this.usersService.updateUser(user.id, {
            resetToken,
            resetTokenExpiry,
        });

        // Send reset email
        await this.emailService.sendPasswordResetEmail(user.email, resetToken);

        return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
        const { token, newPassword } = resetPasswordDto;

        const user = await this.usersService.findByResetToken(token);
        if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password and clear reset token
        await this.usersService.updateUser(user.id, {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null,
        });

        return { message: 'Password has been reset successfully' };
    }

    async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
        const { token } = verifyEmailDto;

        const user = await this.usersService.findByEmailVerificationToken(token);
        if (!user) {
            throw new BadRequestException('Invalid verification token');
        }

        // Update user as verified
        await this.usersService.updateUser(user.id, {
            isEmailVerified: true,
            emailVerificationToken: null,
        });

        return { message: 'Email verified successfully' };
    }

    async resendVerificationEmail(email: string): Promise<{ message: string }> {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email already verified');
        }

        // Generate new verification token
        const verificationToken = uuidv4();
        await this.usersService.updateUser(user.id, {
            emailVerificationToken: verificationToken,
        });

        // Send verification email
        await this.emailService.sendVerificationEmail(user.email, verificationToken);

        return { message: 'Verification email sent' };
    }
}
