import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard API response wrapper
 * Provides consistent response format across all endpoints
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Response data payload',
    example: {},
  })
  data?: T;

  @ApiProperty({
    description: 'Error details (only present when success is false)',
    example: null,
    required: false,
  })
  error?: {
    code: string;
    details?: any;
  };

  @ApiProperty({
    description: 'Request timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request ID for tracking',
    example: 'req_1234567890',
    required: false,
  })
  requestId?: string;

  constructor(
    success: boolean,
    message: string,
    data?: T,
    error?: { code: string; details?: any },
    requestId?: string
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;
  }

  /**
   * Create a successful response
   */
  static success<T>(data: T, message: string = 'Success', requestId?: string): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data, undefined, requestId);
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    errorCode: string,
    details?: any,
    requestId?: string
  ): ApiResponseDto {
    return new ApiResponseDto(false, message, undefined, { code: errorCode, details }, requestId);
  }
}

/**
 * Paginated response wrapper
 * For endpoints that return paginated data
 */
export class PaginatedResponseDto<T = any> extends ApiResponseDto<{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  @ApiProperty({
    description: 'Paginated data items',
    type: 'array',
  })
  override data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };

  constructor(
    items: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Success',
    requestId?: string
  ) {
    const totalPages = Math.ceil(total / limit);
    super(
      true,
      message,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      undefined,
      requestId
    );
  }
}

/**
 * Error response DTO
 * Standardized error response format
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Indicates the request failed',
    example: false,
  })
  success: false;

  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message: string;

  @ApiProperty({
    description: 'Error code',
    example: 'VALIDATION_ERROR',
  })
  error: {
    code: string;
    details?: any;
  };

  @ApiProperty({
    description: 'Request timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request ID for tracking',
    example: 'req_1234567890',
    required: false,
  })
  requestId?: string;
}
