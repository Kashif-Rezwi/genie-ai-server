import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../../security/guards/roles.guard';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { PerformanceRegressionService } from '../services/performance-regression.service';

@Controller('monitoring/performance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PerformanceController {
  constructor(private readonly performanceRegressionService: PerformanceRegressionService) {}

  @Get('tests')
  async getPerformanceTests(@Query('limit') limit = 50): Promise<ApiResponseDto> {
    const tests = this.performanceRegressionService.getTests();
    return {
      success: true,
      message: 'Performance tests retrieved successfully',
      data: tests,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tests/:id')
  async getPerformanceTest(@Param('id') id: string): Promise<ApiResponseDto> {
    const test = this.performanceRegressionService.getTest(id);
    if (!test) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test retrieved successfully',
      data: test,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tests')
  async createPerformanceTest(@Body() testData: any): Promise<ApiResponseDto> {
    const test = this.performanceRegressionService.createTest(testData);
    return {
      success: true,
      message: 'Performance test created successfully',
      data: test,
      timestamp: new Date().toISOString(),
    };
  }

  @Put('tests/:id')
  async updatePerformanceTest(
    @Param('id') id: string,
    @Body() testData: any
  ): Promise<ApiResponseDto> {
    const test = this.performanceRegressionService.updateTest(id, testData);
    if (!test) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test updated successfully',
      data: test,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('tests/:id')
  async deletePerformanceTest(@Param('id') id: string): Promise<ApiResponseDto> {
    const deleted = this.performanceRegressionService.deleteTest(id);
    if (!deleted) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test deleted successfully',
      data: { id },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tests/:id/run')
  async runPerformanceTest(@Param('id') id: string): Promise<ApiResponseDto> {
    const result = this.performanceRegressionService.runTest(id);
    if (!result) {
      return {
        success: false,
        message: 'Performance test not found or already running',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Performance test started successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tests/run-all')
  async runAllPerformanceTests(): Promise<ApiResponseDto> {
    const results = this.performanceRegressionService.runAllTests();
    return {
      success: true,
      message: 'All performance tests started successfully',
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tests/:id/results')
  async getTestResults(@Param('id') id: string): Promise<ApiResponseDto> {
    const results = this.performanceRegressionService.getResults(id);
    if (!results) {
      return {
        success: false,
        message: 'Test results not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Test results retrieved successfully',
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tests/:id/report')
  async getTestReport(@Param('id') id: string): Promise<ApiResponseDto> {
    const report = this.performanceRegressionService.getPerformanceReport(id);
    if (!report) {
      return {
        success: false,
        message: 'Test report not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Test report generated successfully',
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tests/:id/baseline')
  async setTestBaseline(@Param('id') id: string): Promise<ApiResponseDto> {
    const baseline = this.performanceRegressionService.setBaseline(id);
    if (!baseline) {
      return {
        success: false,
        message: 'Performance test not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Test baseline set successfully',
      data: baseline,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tests/:id/baseline')
  async getTestBaseline(@Param('id') id: string): Promise<ApiResponseDto> {
    const baseline = this.performanceRegressionService.getBaseline(id);
    if (!baseline) {
      return {
        success: false,
        message: 'Test baseline not found',
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      message: 'Test baseline retrieved successfully',
      data: baseline,
      timestamp: new Date().toISOString(),
    };
  }
}
