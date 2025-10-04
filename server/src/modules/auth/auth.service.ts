import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MetricsService } from '../monitoring/services/metrics.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';

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
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly metricsService: MetricsService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password } = registerDto;

    // Email validation is handled by DTO validation
    // Password validation is handled by DTO validation with @IsStrongPassword

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
        console.error('Failed to send welcome email:', error);
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
}
