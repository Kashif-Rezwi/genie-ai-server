import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CreditsService } from '../../modules/credits/services/credits.service';

export const CREDIT_REQUIREMENT_KEY = 'creditRequirement';

export const CreditRequirement = (amount: number) =>
    SetMetadata(CREDIT_REQUIREMENT_KEY, amount);

@Injectable()
export class CreditGuard implements CanActivate {
    constructor(
        private readonly creditsService: CreditsService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredCredits = this.reflector.getAllAndOverride<number>(
            CREDIT_REQUIREMENT_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredCredits) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            return false;
        }

        const balance = await this.creditsService.getUserBalance(user.id);

        if (balance < requiredCredits) {
            throw new ForbiddenException(
                `Insufficient credits. Required: ${requiredCredits}, Available: ${balance}`
            );
        }

        // Add credit info to request
        request.creditInfo = { balance, userId: user.id };

        return true;
    }
}