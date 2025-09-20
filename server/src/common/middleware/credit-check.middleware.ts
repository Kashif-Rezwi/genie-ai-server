import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CreditsService } from '../../modules/credits/services/credits.service';

export interface CreditCheckOptions {
    minimumRequired?: number;
    modelSpecific?: boolean;
    operation?: string;
}

@Injectable()
export class CreditCheckMiddleware implements NestMiddleware {
    constructor(private readonly creditsService: CreditsService) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const user = req.user as any;

        if (!user) {
            return next();
        }

        try {
            const balance = await this.creditsService.getUserBalance(user.id);

            // Add credit info to request for downstream use
            req['creditInfo'] = {
                balance,
                userId: user.id,
            };

            // Check for low credit warning
            if (balance <= 5) {
                res.setHeader('X-Credit-Warning', 'Low credit balance');
            }

            next();
        } catch (error) {
            throw new ForbiddenException('Credit check failed');
        }
    }
}

// Decorator for requiring minimum credits
export const RequireCredits = (minimumAmount: number) => {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const req = args.find(arg => arg && arg.user);
            if (req && req.creditInfo) {
                if (req.creditInfo.balance < minimumAmount) {
                    throw new ForbiddenException(`Insufficient credits. Required: ${minimumAmount}, Available: ${req.creditInfo.balance}`);
                }
            }

            return method.apply(this, args);
        };

        return descriptor;
    };
};