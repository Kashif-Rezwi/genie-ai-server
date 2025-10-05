import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../../security/guards/roles.guard';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { BusinessAnalyticsService } from '../services/business-analytics.service';

@Controller('monitoring/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly businessAnalyticsService: BusinessAnalyticsService) {}

  @Get('metrics')
  async getBusinessMetrics(@Query('period') period = '30d'): Promise<ApiResponseDto> {
    const metrics = this.businessAnalyticsService.getBusinessMetrics();
    return {
      success: true,
      message: 'Business metrics retrieved successfully',
      data: metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('trends')
  async getBusinessTrends(@Query('period') period = '30d'): Promise<ApiResponseDto> {
    const trends = this.businessAnalyticsService.getBusinessTrends();
    return {
      success: true,
      message: 'Business trends retrieved successfully',
      data: trends,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('insights')
  async getBusinessInsights(@Query('limit') limit = 10): Promise<ApiResponseDto> {
    const insights = this.businessAnalyticsService.getInsights(limit);
    return {
      success: true,
      message: 'Business insights retrieved successfully',
      data: insights,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('insights/:type')
  async getInsightsByType(
    @Param('type') type: string,
    @Query('limit') limit = 10
  ): Promise<ApiResponseDto> {
    const insights = this.businessAnalyticsService.getInsightsByType(type as any, limit);
    return {
      success: true,
      message: `Business insights for ${type} retrieved successfully`,
      data: insights,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('insights/generate')
  async generateInsights(@Body() request: { types: string[] }): Promise<ApiResponseDto> {
    const insights = this.businessAnalyticsService.generateInsights();
    return {
      success: true,
      message: 'Business insights generated successfully',
      data: insights,
      timestamp: new Date().toISOString(),
    };
  }
}
