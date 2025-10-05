import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export const API_VERSION_KEY = 'apiVersion';

/**
 * API Version decorator
 * Marks controllers and methods with version information
 */
export const ApiVersion = (version: string) =>
  applyDecorators(SetMetadata(API_VERSION_KEY, version), ApiTags(`v${version}`));

/**
 * Get API version from metadata
 */
export const getApiVersion = (target: any): string => {
  return Reflect.getMetadata(API_VERSION_KEY, target) || '1.0.0';
};

/**
 * Current API version
 */
export const CURRENT_API_VERSION = '1.0.0';

/**
 * Supported API versions
 */
export const SUPPORTED_API_VERSIONS = ['1.0.0'];

/**
 * API version validation
 */
export const isValidApiVersion = (version: string): boolean => {
  return SUPPORTED_API_VERSIONS.includes(version);
};
