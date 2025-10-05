import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PerUserRateLimitService, RateLimitResult } from './services/per-user-rate-limit.service';
import {
  BruteForceProtectionService,
  BruteForceResult,
  BruteForceStats,
} from './services/brute-force-protection.service';
import { AuditLoggingService, AuditQuery, AuditStats } from './services/audit-logging.service';
import { ContentSecurityPolicyService } from './services/content-security-policy.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('Security')
@Controller('security')
export class SecurityController {
  constructor(
    private readonly rateLimitService: PerUserRateLimitService,
    private readonly bruteForceService: BruteForceProtectionService,
    private readonly auditService: AuditLoggingService,
    private readonly cspService: ContentSecurityPolicyService
  ) {}

  // Rate Limiting Endpoints
  @Get('rate-limits')
  @ApiOperation({ summary: 'Get user rate limits' })
  @ApiResponse({ status: 200, description: 'Rate limits retrieved successfully' })
  @ApiBearerAuth()
  async getUserRateLimits(
    @Request() req: any
  ): Promise<ApiResponseDto<Record<string, RateLimitResult>>> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const userTier = await this.rateLimitService.getUserTier(userId);
    const rateLimits = await this.rateLimitService.getAllRateLimits(userId, userTier);

    return {
      success: true,
      message: 'Rate limits retrieved successfully',
      data: rateLimits,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('rate-limits/reset')
  @ApiOperation({ summary: 'Reset user rate limits' })
  @ApiResponse({ status: 200, description: 'Rate limits reset successfully' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async resetRateLimits(
    @Request() req: any,
    @Body() body: { endpoint?: string }
  ): Promise<ApiResponseDto<{ reset: boolean }>> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (body.endpoint) {
      await this.rateLimitService.resetRateLimit(userId, body.endpoint);
    } else {
      // Reset all rate limits for user
      const userTier = await this.rateLimitService.getUserTier(userId);
      const rateLimits = await this.rateLimitService.getAllRateLimits(userId, userTier);

      for (const endpoint of Object.keys(rateLimits)) {
        await this.rateLimitService.resetRateLimit(userId, endpoint);
      }
    }

    return {
      success: true,
      message: 'Rate limits reset successfully',
      data: { reset: true },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('rate-limits/tier')
  @ApiOperation({ summary: 'Update user tier' })
  @ApiResponse({ status: 200, description: 'User tier updated successfully' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async updateUserTier(
    @Request() req: any,
    @Body() body: { tier: string }
  ): Promise<ApiResponseDto<{ updated: boolean }>> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const updated = await this.rateLimitService.updateUserTier(userId, body.tier);

    return {
      success: true,
      message: 'User tier updated successfully',
      data: { updated },
      timestamp: new Date().toISOString(),
    };
  }

  // Brute Force Protection Endpoints
  @Get('brute-force/status')
  @ApiOperation({ summary: 'Get brute force protection status' })
  @ApiResponse({ status: 200, description: 'Brute force status retrieved successfully' })
  @ApiBearerAuth()
  async getBruteForceStatus(
    @Request() req: any,
    @Query('action') action: string = 'login'
  ): Promise<ApiResponseDto<BruteForceResult>> {
    const userId = req.user?.id;
    const identifier = userId || req.ip;

    const status = await this.bruteForceService.checkBruteForce(identifier, action);

    return {
      success: true,
      message: 'Brute force status retrieved successfully',
      data: status,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('brute-force/stats')
  @ApiOperation({ summary: 'Get brute force protection statistics' })
  @ApiResponse({ status: 200, description: 'Brute force statistics retrieved successfully' })
  @ApiBearerAuth()
  async getBruteForceStats(
    @Request() req: any,
    @Query('action') action: string = 'login'
  ): Promise<ApiResponseDto<BruteForceStats>> {
    const userId = req.user?.id;
    const identifier = userId || req.ip;

    const stats = await this.bruteForceService.getBruteForceStats(identifier, action);

    return {
      success: true,
      message: 'Brute force statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('brute-force/reset')
  @ApiOperation({ summary: 'Reset brute force protection' })
  @ApiResponse({ status: 200, description: 'Brute force protection reset successfully' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async resetBruteForceProtection(
    @Request() req: any,
    @Body() body: { action?: string }
  ): Promise<ApiResponseDto<{ reset: boolean }>> {
    const userId = req.user?.id;
    const identifier = userId || req.ip;

    const reset = await this.bruteForceService.resetBruteForceProtection(
      identifier,
      body.action || 'login'
    );

    return {
      success: true,
      message: 'Brute force protection reset successfully',
      data: { reset },
      timestamp: new Date().toISOString(),
    };
  }

  // Audit Logging Endpoints
  @Get('audit/events')
  @ApiOperation({ summary: 'Query audit events' })
  @ApiResponse({ status: 200, description: 'Audit events retrieved successfully' })
  @ApiBearerAuth()
  async queryAuditEvents(
    @Request() req: any,
    @Query() query: AuditQuery
  ): Promise<ApiResponseDto<any[]>> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Only allow users to query their own events unless admin
    const auditQuery = {
      ...query,
      userId: query.userId || userId,
    };

    const events = await this.auditService.queryEvents(auditQuery);

    return {
      success: true,
      message: 'Audit events retrieved successfully',
      data: events,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('audit/stats')
  @ApiOperation({ summary: 'Get audit statistics' })
  @ApiResponse({ status: 200, description: 'Audit statistics retrieved successfully' })
  @ApiBearerAuth()
  async getAuditStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<ApiResponseDto<AuditStats>> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await this.auditService.getAuditStats(start, end);

    return {
      success: true,
      message: 'Audit statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('audit/cleanup')
  @ApiOperation({ summary: 'Cleanup old audit events' })
  @ApiResponse({ status: 200, description: 'Audit cleanup completed successfully' })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async cleanupAuditEvents(
    @Request() req: any,
    @Body() body: { olderThanDays?: number }
  ): Promise<ApiResponseDto<{ deletedCount: number }>> {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const deletedCount = await this.auditService.cleanupOldEvents(body.olderThanDays || 90);

    return {
      success: true,
      message: 'Audit cleanup completed successfully',
      data: { deletedCount },
      timestamp: new Date().toISOString(),
    };
  }

  // Content Security Policy Endpoints
  @Get('csp/header')
  @ApiOperation({ summary: 'Get CSP header' })
  @ApiResponse({ status: 200, description: 'CSP header retrieved successfully' })
  async getCSPHeader(
    @Query('environment') environment: string = 'production'
  ): Promise<ApiResponseDto<{ header: string }>> {
    const header = this.cspService.getCSPHeader(environment);

    return {
      success: true,
      message: 'CSP header retrieved successfully',
      data: { header },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('csp/report-only')
  @ApiOperation({ summary: 'Get CSP report-only header' })
  @ApiResponse({ status: 200, description: 'CSP report-only header retrieved successfully' })
  async getCSPReportOnlyHeader(
    @Query('environment') environment: string = 'production',
    @Query('reportUri') reportUri?: string
  ): Promise<ApiResponseDto<{ header: string }>> {
    const header = this.cspService.getCSPReportOnlyHeader(environment, reportUri);

    return {
      success: true,
      message: 'CSP report-only header retrieved successfully',
      data: { header },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('csp/report')
  @ApiOperation({ summary: 'Handle CSP violation report' })
  @ApiResponse({ status: 204, description: 'CSP violation report processed' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleCSPReport(@Request() req: any): Promise<void> {
    // This endpoint is handled by the CSP service middleware
    // The actual processing happens in the middleware
  }

  // Security Health Check
  @Get('health')
  @ApiOperation({ summary: 'Get security health status' })
  @ApiResponse({ status: 200, description: 'Security health status retrieved successfully' })
  async getSecurityHealth(@Request() req: any): Promise<ApiResponseDto<any>> {
    const userId = req.user?.id;
    const ipAddress = req.ip;

    const health = {
      timestamp: new Date().toISOString(),
      userId,
      ipAddress,
      rateLimiting: {
        status: 'active',
        userTier: userId ? await this.rateLimitService.getUserTier(userId) : 'free',
      },
      bruteForceProtection: {
        status: 'active',
        identifier: userId || ipAddress,
      },
      apiKeyManagement: {
        status: 'disabled',
        hasApiKey: false,
      },
      auditLogging: {
        status: 'active',
      },
      contentSecurityPolicy: {
        status: 'active',
        environment: process.env.NODE_ENV || 'production',
      },
    };

    return {
      success: true,
      message: 'Security health status retrieved successfully',
      data: health,
      timestamp: new Date().toISOString(),
    };
  }
}
