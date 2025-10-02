import {
    Controller,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { SecurityService } from './services/security.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
    constructor(
        private readonly securityService: SecurityService,
    ) {}

    @Post('validate-password')
    async validatePassword(@Body('password') password: string) {
        const validation = this.securityService.validatePassword(password);
        const strength = this.securityService.checkPasswordStrength(password);
        return { ...validation, strength };
    }
}