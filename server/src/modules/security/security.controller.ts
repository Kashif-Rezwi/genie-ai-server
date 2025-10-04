import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Req,
    Res,
    ValidationPipe,
} from '@nestjs/common';
import { SecurityService } from './services/security.service';
import { CsrfMiddleware } from './middleware/csrf.middleware';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request, Response } from 'express';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
    constructor(
        private readonly securityService: SecurityService,
        private readonly csrfMiddleware: CsrfMiddleware,
    ) {}

    @Post('validate-password')
    async validatePassword(@Body('password', ValidationPipe) password: string) {
        const validation = this.securityService.validatePassword(password);
        const strength = this.securityService.checkPasswordStrength(password);
        return { ...validation, strength };
    }

    @Get('csrf-token')
    async getCsrfToken(@Req() req: Request, @Res() res: Response) {
        const sessionId = (req as any).sessionID || req.headers['x-session-id'] as string || 'default';
        const token = await this.csrfMiddleware.generateToken(sessionId);
        
        res.setHeader('X-CSRF-Token', token);
        res.setHeader('X-Session-ID', sessionId);
        
        return res.json({
            csrfToken: token,
            sessionId: sessionId,
            message: 'Include these headers in subsequent requests'
        });
    }
}