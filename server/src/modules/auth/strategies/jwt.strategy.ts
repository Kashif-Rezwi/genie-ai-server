import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../auth.service';
import { getClientIP } from '../../../common/utils/request.utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(
        private readonly usersService: UsersService,
        private readonly configService: ConfigService,
    ) {
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!jwtSecret || jwtSecret.length < 32) {
            throw new Error('JWT_SECRET must be at least 32 characters long');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
            algorithms: ['HS256'], // Explicitly specify algorithm
            issuer: configService.get<string>('JWT_ISSUER') || 'genie-ai-server',
            audience: configService.get<string>('JWT_AUDIENCE') || 'genie-ai-client',
            passReqToCallback: true, // Pass request to validate method
        });
    }

    async validate(req: any, payload: JwtPayload) {
        // Validate payload structure
        if (!payload || !payload.sub || !payload.email) {
            this.logger.warn('Invalid JWT payload structure', {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                payload: payload ? Object.keys(payload) : 'null',
            });
            throw new UnauthorizedException('Invalid token payload');
        }

        // Check token age (additional security)
        const tokenAge = Date.now() - payload.iat * 1000;
        const maxAge = this.configService.get<number>('JWT_MAX_AGE') || 7 * 24 * 60 * 60 * 1000; // 7 days default

        if (tokenAge > maxAge) {
            this.logger.warn('JWT token too old', {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                userId: payload.sub,
                tokenAge: Math.floor(tokenAge / (24 * 60 * 60 * 1000)), // days
            });
            throw new UnauthorizedException('Token has expired');
        }

        // Validate user exists and is active
        const user = await this.usersService.findById(payload.sub);

        if (!user) {
            this.logger.warn('JWT validation failed - user not found', {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                userId: payload.sub,
                email: payload.email,
            });
            throw new UnauthorizedException('User not found');
        }

        if (!user.isActive) {
            this.logger.warn('JWT validation failed - user inactive', {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                userId: payload.sub,
                email: payload.email,
            });
            throw new UnauthorizedException('Account is deactivated');
        }

        // Check if email matches (additional validation)
        if (user.email !== payload.email) {
            this.logger.warn('JWT validation failed - email mismatch', {
                ip: getClientIP(req),
                userAgent: req.get('User-Agent'),
                userId: payload.sub,
                tokenEmail: payload.email,
                userEmail: user.email,
            });
            throw new UnauthorizedException('Token validation failed');
        }

        // Log successful validation (debug level)
        this.logger.debug('JWT validation successful', {
            ip: getClientIP(req),
            userId: payload.sub,
            email: payload.email,
            role: user.role,
        });

        return {
            id: user.id,
            email: user.email,
            creditsBalance: user.creditsBalance,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
        };
    }
}
