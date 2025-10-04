import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/security/guards/roles.guard';

@Injectable()
export class AdminRoleGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Check if user has admin or system role
        const userRole = user.role || UserRole.USER;
        const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SYSTEM;

        if (!isAdmin) {
            throw new ForbiddenException('Admin access required');
        }

        return true;
    }
}
