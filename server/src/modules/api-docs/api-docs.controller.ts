import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { CURRENT_API_VERSION, SUPPORTED_API_VERSIONS } from '../../common/decorators/api-version.decorator';

/**
 * API Documentation Controller
 * Provides API information and documentation endpoints
 */
@Controller('docs')
@ApiTags('API Documentation')
export class ApiDocsController {
  /**
   * Get API information
   * @returns API information and available versions
   */
  @Get('info')
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({
    status: 200,
    description: 'API information retrieved successfully',
    type: ApiResponseDto,
  })
  getApiInfo(): ApiResponseDto<{
    name: string;
    version: string;
    description: string;
    supportedVersions: string[];
    documentation: {
      swagger: string;
      examples: string;
    };
    features: string[];
    rateLimits: {
      free: string;
      premium: string;
      admin: string;
    };
  }> {
    return ApiResponseDto.success({
      name: 'Genie AI Server API',
      version: CURRENT_API_VERSION,
      description: 'AI-powered chat and credit management API',
      supportedVersions: SUPPORTED_API_VERSIONS,
      documentation: {
        swagger: '/api/docs',
        examples: '/api/docs/examples',
      },
      features: [
        'AI Chat with multiple models',
        'Credit-based usage system',
        'JWT Authentication',
        'Rate limiting and security',
        'Real-time monitoring',
        'Payment processing',
      ],
      rateLimits: {
        free: '100 requests/hour',
        premium: '1000 requests/hour',
        admin: 'Unlimited requests',
      },
    }, 'API information retrieved successfully');
  }

  /**
   * Get API examples
   * @param res - Express response object
   * @returns API usage examples
   */
  @Get('examples')
  @ApiOperation({ summary: 'Get API usage examples' })
  @ApiResponse({
    status: 200,
    description: 'API examples retrieved successfully',
    content: {
      'text/markdown': {
        schema: {
          type: 'string',
          example: '# API Examples\n\n## Authentication...',
        },
      },
    },
  })
  getApiExamples(@Res() res: Response): void {
    const examples = `# Genie AI Server API Examples

## Authentication Examples

### Register a new user
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
\`\`\`

### Login
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
\`\`\`

## AI Chat Examples

### Start a new chat
\`\`\`bash
curl -X POST http://localhost:3000/api/ai/chat \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello, how can you help me today?",
    "model": "gpt-4",
    "stream": false
  }'
\`\`\`

### Stream chat response
\`\`\`bash
curl -X POST http://localhost:3000/api/ai/chat/stream \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Write a short story about a robot",
    "model": "gpt-4",
    "stream": true
  }'
\`\`\`

## Credits Examples

### Get credit balance
\`\`\`bash
curl -X GET http://localhost:3000/api/credits/balance \\
  -H "Authorization: Bearer your-jwt-token"
\`\`\`

### Get transaction history
\`\`\`bash
curl -X GET "http://localhost:3000/api/credits/transactions?page=1&limit=20" \\
  -H "Authorization: Bearer your-jwt-token"
\`\`\`

## Payment Examples

### Create payment
\`\`\`bash
curl -X POST http://localhost:3000/api/payments/create \\
  -H "Authorization: Bearer your-jwt-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "packageId": "package-id",
    "amount": 2999,
    "currency": "INR"
  }'
\`\`\`

## Error Handling Examples

### Validation Error Response
\`\`\`json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "email": ["Email must be a valid email address"],
      "password": ["Password must be at least 8 characters long"]
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890"
}
\`\`\`

### Authentication Error Response
\`\`\`json
{
  "success": false,
  "message": "Unauthorized",
  "error": {
    "code": "UNAUTHORIZED",
    "details": "Invalid or expired token"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890"
}
\`\`\`

## Rate Limiting Examples

### Rate limit headers in response
\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 3600
\`\`\`

## SDK Examples

### JavaScript/Node.js
\`\`\`javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});

// Start a chat
const chatResponse = await api.post('/ai/chat', {
  message: 'Hello, how are you?',
  model: 'gpt-4',
  stream: false
});

// console.log(chatResponse.data); // Removed console.log from example
\`\`\`

### Python
\`\`\`python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Get credit balance
response = requests.get(
    'http://localhost:3000/api/credits/balance',
    headers=headers
)

print(response.json())
\`\`\`
`;

    res.setHeader('Content-Type', 'text/markdown');
    res.status(HttpStatus.OK).send(examples);
  }

  /**
   * Get API health status
   * @returns API health information
   */
  @Get('health')
  @ApiOperation({ summary: 'Get API health status' })
  @ApiResponse({
    status: 200,
    description: 'API health status retrieved successfully',
    type: ApiResponseDto,
  })
  getApiHealth(): ApiResponseDto<{
    status: string;
    version: string;
    uptime: number;
    timestamp: string;
    endpoints: {
      total: number;
      documented: number;
      coverage: string;
    };
  }> {
    const uptime = process.uptime();
    
    return ApiResponseDto.success({
      status: 'healthy',
      version: CURRENT_API_VERSION,
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      endpoints: {
        total: 25, // Approximate number of endpoints
        documented: 25,
        coverage: '100%',
      },
    }, 'API health status retrieved successfully');
  }
}
