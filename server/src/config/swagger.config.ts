import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { CURRENT_API_VERSION, SUPPORTED_API_VERSIONS } from '../common/decorators/api-version.decorator';

/**
 * Swagger configuration for API documentation
 */
export const swaggerConfig = new DocumentBuilder()
  .setTitle('Genie AI Server API')
  .setDescription(`
    # Genie AI Server API Documentation
    
    A comprehensive, production-ready API for AI-powered chat and credit management services built with NestJS, TypeScript, and PostgreSQL.
    
    ## 🚀 Features
    
    ### Core Services
    - **🤖 AI Chat**: Interactive conversations with multiple AI models (OpenAI, Anthropic, Groq)
    - **💳 Credit System**: Flexible credit-based usage model with transaction tracking
    - **🔐 Authentication**: Secure JWT-based authentication with role-based access control
    - **📊 Analytics**: Comprehensive usage tracking and performance metrics
    - **🛡️ Security**: Advanced rate limiting, input validation, and sanitization
    - **⚡ Performance**: Real-time monitoring and optimization tools
    - **📈 Scalability**: Auto-scaling and load balancing capabilities
    
    ### Advanced Features
    - **🔄 Real-time Streaming**: Server-sent events for AI responses
    - **💾 Caching**: Redis-based query and response caching
    - **📝 Audit Logging**: Comprehensive audit trails for all operations
    - **🔒 Security Headers**: CSP, HSTS, and other security headers
    - **🌐 CORS Support**: Configurable cross-origin resource sharing
    - **📱 API Versioning**: Multiple API versions with backward compatibility
    
    ## 🔐 Authentication
    
    Most endpoints require authentication. Include the JWT token in the Authorization header:
    \`\`\`
    Authorization: Bearer <your-jwt-token>
    \`\`\`
    
    ### User Roles
    - **user**: Standard user with credit-based access
    - **admin**: Administrative access with full permissions
    - **premium**: Enhanced user with higher rate limits
    
    ## ⚡ Rate Limiting
    
    API requests are rate limited based on user tier and credit balance:
    - **Free Tier**: 100 requests/hour, 10 credits/hour
    - **Premium Tier**: 1000 requests/hour, 100 credits/hour
    - **Admin**: Unlimited requests
    
    ### Rate Limit Headers
    All responses include rate limit information:
    \`\`\`
    X-RateLimit-Limit: 1000
    X-RateLimit-Remaining: 999
    X-RateLimit-Reset: 1640995200
    \`\`\`
    
    ## 📊 Error Handling
    
    All endpoints return standardized error responses with appropriate HTTP status codes:
    
    \`\`\`json
    {
      "success": false,
      "message": "Error description",
      "error": {
        "code": "ERROR_CODE",
        "details": "Additional error details",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    }
    \`\`\`
    
    ### Common Error Codes
    - **400**: Bad Request - Invalid input data
    - **401**: Unauthorized - Invalid or missing authentication
    - **403**: Forbidden - Insufficient permissions
    - **404**: Not Found - Resource not found
    - **409**: Conflict - Resource already exists
    - **429**: Too Many Requests - Rate limit exceeded
    - **500**: Internal Server Error - Server error
    
    ## 🔄 API Versioning
    
    Current API version: **${CURRENT_API_VERSION}**
    Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}
    
    Version-specific endpoints are available at:
    - \`/api/v1/...\` - Version 1 endpoints
    - \`/api/v2/...\` - Version 2 endpoints (current)
    
    ## 📈 Performance Monitoring
    
    The API includes comprehensive performance monitoring:
    - **Response Time Tracking**: Monitor API response times
    - **Error Rate Monitoring**: Track error rates and types
    - **Resource Usage**: Monitor memory, CPU, and database usage
    - **Business Metrics**: Track user engagement and revenue metrics
    
    ## 🛠️ Development
    
    ### Local Development
    \`\`\`bash
    # Install dependencies
    npm install
    
    # Start development server
    npm run start:dev
    
    # Access API documentation
    http://localhost:3000/api/docs
    \`\`\`
    
    ### Environment Variables
    Required environment variables for configuration:
    - \`DATABASE_URL\`: PostgreSQL connection string
    - \`REDIS_URL\`: Redis connection string
    - \`JWT_SECRET\`: JWT signing secret
    - \`NODE_ENV\`: Environment (development/production)
    
    ## 📚 Additional Resources
    
    - **API Examples**: \`/api/docs/examples\`
    - **Health Check**: \`/api/health\`
    - **Metrics**: \`/api/metrics\`
    - **Performance**: \`/api/performance\`
  `)
  .setVersion(CURRENT_API_VERSION)
  .setContact(
    'Genie AI Team',
    'https://genie-ai.com',
    'support@genie-ai.com',
  )
  .setLicense(
    'MIT',
    'https://opensource.org/licenses/MIT',
  )
  .addServer('http://localhost:3000', 'Development Server')
  .addServer('https://api.genie-ai.com', 'Production Server')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addTag('Authentication', 'User authentication and authorization')
  .addTag('AI Chat', 'AI-powered chat and conversation management')
  .addTag('Credits', 'Credit system and transaction management')
  .addTag('Payments', 'Payment processing and package management')
  .addTag('Users', 'User profile and account management')
  .addTag('Monitoring', 'System monitoring and health checks')
  .addTag('Performance', 'Performance metrics and optimization')
  .addTag('Security', 'Security features and rate limiting')
  .build();

/**
 * Setup Swagger documentation
 * @param app - NestJS application instance
 */
export const setupSwagger = (app: INestApplication): void => {
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  
  // Main API documentation
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Genie AI Server API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #3b82f6; }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px; }
    `,
  });

  // API version specific documentation
  SUPPORTED_API_VERSIONS.forEach(version => {
    const versionedDocument = SwaggerModule.createDocument(app, {
      ...swaggerConfig,
      info: {
        ...swaggerConfig.info,
        version,
        title: `${swaggerConfig.info?.title} v${version}`,
      },
    }, {
      include: [], // Include all modules
    });

    SwaggerModule.setup(`api/docs/v${version}`, app, versionedDocument, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showRequestHeaders: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: `Genie AI Server API v${version} Documentation`,
    });
  });
};
