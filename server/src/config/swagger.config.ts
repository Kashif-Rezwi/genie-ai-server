import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { CURRENT_API_VERSION, SUPPORTED_API_VERSIONS } from '../common/decorators/api-version.decorator';

/**
 * Swagger configuration for API documentation
 */
export const swaggerConfig = new DocumentBuilder()
  .setTitle('Genie AI Server API')
  .setDescription(`
    ## Genie AI Server API Documentation
    
    This is the comprehensive API documentation for the Genie AI Server, providing AI-powered chat and credit management services.
    
    ### Features
    - 🤖 **AI Chat**: Interactive conversations with multiple AI models
    - 💳 **Credit System**: Flexible credit-based usage model
    - 🔐 **Authentication**: Secure JWT-based authentication
    - 📊 **Analytics**: Usage tracking and performance metrics
    - 🛡️ **Security**: Rate limiting, input validation, and sanitization
    
    ### Authentication
    Most endpoints require authentication. Include the JWT token in the Authorization header:
    \`\`\`
    Authorization: Bearer <your-jwt-token>
    \`\`\`
    
    ### Rate Limiting
    API requests are rate limited based on user tier and credit balance:
    - **Free Tier**: 100 requests/hour
    - **Premium Tier**: 1000 requests/hour
    - **Admin**: Unlimited requests
    
    ### Error Handling
    All endpoints return standardized error responses with appropriate HTTP status codes.
    
    ### API Versioning
    Current API version: **${CURRENT_API_VERSION}**
    Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}
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
