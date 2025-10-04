import { Controller, Post, Body, Get, UseGuards, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit, RateLimitGuard } from '../security/guards/rate-limit.guard';
import { CSRFProtectionGuard } from '../security/guards/csrf-protection.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RateLimitGuard, CSRFProtectionGuard)
  @RateLimit('auth')
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @UseGuards(RateLimitGuard, CSRFProtectionGuard)
  @RateLimit('auth')
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      creditsBalance: user.creditsBalance,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout() {
    // JWT tokens are stateless, so logout is handled client-side
    return { message: 'Logged out successfully' };
  }
}
