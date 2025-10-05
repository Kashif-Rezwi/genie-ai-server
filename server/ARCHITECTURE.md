# Genie AI Server Architecture Documentation

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Status**: Production Ready

## Overview

The Genie AI Server is a production-ready, scalable backend API built with NestJS, TypeScript, and PostgreSQL. It provides AI-powered chat services with a credit-based usage model, comprehensive monitoring, and enterprise-grade security features.

## 📋 Table of Contents

1. [System Architecture](#-system-architecture)
2. [Project Structure](#-project-structure)
3. [Core Technologies](#-core-technologies)
4. [Module Architecture](#-module-architecture)
5. [Data Flow](#-data-flow)
6. [Security Architecture](#-security-architecture)
7. [Monitoring & Observability](#-monitoring--observability)
8. [Performance Optimization](#-performance-optimization)
9. [Configuration Management](#-configuration-management)
10. [Deployment Architecture](#-deployment-architecture)
11. [Scalability Considerations](#-scalability-considerations)
12. [Testing Strategy](#-testing-strategy)
13. [API Documentation](#-api-documentation)
14. [Error Handling](#-error-handling)
15. [Development Workflow](#-development-workflow)
16. [Maintenance & Operations](#-maintenance--operations)
17. [Future Enhancements](#-future-enhancements)

## 🏗️ System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Client]
        MOBILE[Mobile App]
        API_CLIENT[API Client]
    end
    
    subgraph "Load Balancer"
        NGINX[Nginx Load Balancer]
    end
    
    subgraph "Application Layer"
        API[Genie AI Server API]
        AUTH[Authentication Service]
        AI[AI Service]
        CHAT[Chat Service]
        CREDITS[Credits Service]
        PAYMENTS[Payments Service]
        MONITORING[Monitoring Service]
        SECURITY[Security Service]
        PERFORMANCE[Performance Service]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        FILES[File Storage]
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API]
        ANTHROPIC[Anthropic API]
        GROQ[Groq API]
        RAZORPAY[Razorpay API]
    end
    
    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    
    NGINX --> API
    
    API --> AUTH
    API --> AI
    API --> CHAT
    API --> CREDITS
    API --> PAYMENTS
    API --> MONITORING
    API --> SECURITY
    API --> PERFORMANCE
    
    AUTH --> POSTGRES
    AI --> POSTGRES
    CHAT --> POSTGRES
    CREDITS --> POSTGRES
    PAYMENTS --> POSTGRES
    MONITORING --> POSTGRES
    
    AUTH --> REDIS
    AI --> REDIS
    CHAT --> REDIS
    CREDITS --> REDIS
    PAYMENTS --> REDIS
    MONITORING --> REDIS
    SECURITY --> REDIS
    PERFORMANCE --> REDIS
    
    AI --> OPENAI
    AI --> ANTHROPIC
    AI --> GROQ
    PAYMENTS --> RAZORPAY
```

## 📁 Project Structure

```
server/
├── src/
│   ├── common/                    # Shared utilities and decorators
│   │   ├── decorators/           # Custom decorators
│   │   ├── dto/                  # Common DTOs
│   │   ├── exceptions/           # Custom exceptions
│   │   ├── guards/               # Authentication guards
│   │   ├── interceptors/         # Request/response interceptors
│   │   └── utils/                # Utility functions
│   ├── config/                   # Configuration files
│   │   ├── database.config.ts    # Database configuration
│   │   ├── redis.config.ts       # Redis configuration
│   │   ├── swagger.config.ts     # API documentation
│   │   └── index.ts              # Main config export
│   ├── core/                     # Core services and repositories
│   │   ├── interfaces/           # Service interfaces
│   │   ├── mocks/                # Mock implementations
│   │   ├── repositories/         # Repository pattern
│   │   └── core.module.ts        # Core module
│   ├── database/                 # Database related files
│   │   ├── entities/             # TypeORM entities
│   │   ├── migrations/           # Database migrations
│   │   └── seeds/                # Database seeds
│   ├── modules/                  # Feature modules
│   │   ├── auth/                 # Authentication module
│   │   ├── ai/                   # AI service module
│   │   ├── chat/                 # Chat management module
│   │   ├── credits/              # Credit system module
│   │   ├── payments/             # Payment processing module
│   │   ├── monitoring/           # Monitoring and metrics
│   │   ├── security/             # Security services
│   │   ├── performance/          # Performance optimization
│   │   ├── scalability/          # Scalability services
│   │   └── production/           # Production readiness
│   └── main.ts                   # Application entry point
├── docker/                       # Docker configurations
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
├── tests/                        # Test files
├── docker-compose.yml            # Local development setup
├── Dockerfile                    # Production Docker image
├── package.json                  # Dependencies and scripts
└── README.md                     # Project documentation
```

## 🔧 Core Technologies

### Backend Framework
- **NestJS**: Modern Node.js framework with TypeScript support
- **TypeScript**: Type-safe JavaScript development
- **Express**: Underlying HTTP server framework

### Database & Caching
- **PostgreSQL**: Primary relational database
- **Redis**: Caching, session storage, and rate limiting
- **TypeORM**: Object-Relational Mapping

### AI Integration
- **OpenAI API**: GPT models integration
- **Anthropic API**: Claude models integration
- **Groq API**: Fast inference models

### Security & Monitoring
- **JWT**: Authentication tokens
- **Helmet**: Security headers
- **Winston**: Structured logging
- **Prometheus**: Metrics collection

## 🏛️ Module Architecture

### 1. Authentication Module (`auth/`)
**Purpose**: User authentication and authorization

**Key Components**:
- `AuthService`: User registration, login, token management
- `AuthController`: Authentication endpoints
- `JwtAuthGuard`: JWT token validation
- `AdminRoleGuard`: Role-based access control

**Dependencies**: PostgreSQL, Redis, JWT

### 2. AI Module (`ai/`)
**Purpose**: AI model integration and management

**Key Components**:
- `AIService`: Core AI functionality
- `AIProviderFactory`: Provider abstraction
- `AIController`: AI endpoints
- Provider implementations (OpenAI, Anthropic, Groq)

**Dependencies**: External AI APIs, Credits Service

### 3. Chat Module (`chat/`)
**Purpose**: Chat management and message handling

**Key Components**:
- `ChatService`: Chat CRUD operations
- `MessageService`: Message management
- `ChatStreamingService`: Real-time streaming
- `ChatController`: Chat endpoints

**Dependencies**: PostgreSQL, AI Service, Credits Service

### 4. Credits Module (`credits/`)
**Purpose**: Credit-based usage system

**Key Components**:
- `CreditsService`: Credit balance management
- `CreditTransactionService`: Transaction tracking
- `CreditsController`: Credit endpoints
- `OptimizedCreditReservationService`: Credit reservations

**Dependencies**: PostgreSQL, Redis

### 5. Payments Module (`payments/`)
**Purpose**: Payment processing and management

**Key Components**:
- `PaymentsService`: Payment processing
- `PaymentsController`: Payment endpoints
- Razorpay integration

**Dependencies**: Razorpay API, Credits Service

### 6. Monitoring Module (`monitoring/`)
**Purpose**: System monitoring and metrics

**Key Components**:
- `MetricsService`: Metrics collection
- `LoggingService`: Structured logging
- `MonitoringController`: Monitoring endpoints
- `BusinessAnalyticsService`: Business metrics

**Dependencies**: PostgreSQL, Redis, Winston

### 7. Security Module (`security/`)
**Purpose**: Security services and protection

**Key Components**:
- `PerUserRateLimitService`: Rate limiting
- `BruteForceProtectionService`: Brute force protection
- `AuditLoggingService`: Security audit logs
- `ContentSecurityPolicyService`: CSP management

**Dependencies**: Redis, PostgreSQL

### 8. Performance Module (`performance/`)
**Purpose**: Performance optimization and monitoring

**Key Components**:
- `PerformanceMonitoringService`: Performance tracking
- `DatabaseOptimizationService`: Database optimization
- `MemoryOptimizationService`: Memory management
- `RedisOptimizationService`: Redis optimization

**Dependencies**: PostgreSQL, Redis, System metrics

## 🔄 Data Flow

### 1. User Authentication Flow
```
1. User submits credentials → AuthController
2. AuthService validates credentials → Database
3. JWT token generated → Redis (session storage)
4. Token returned to client
5. Subsequent requests include token in Authorization header
```

### 2. AI Chat Flow
```
1. User sends message → ChatController
2. CreditsService checks/reserves credits → Redis
3. AIService processes request → External AI API
4. Response streamed back to client
5. CreditsService deducts actual credits used
6. MetricsService records usage → Database
```

### 3. Payment Flow
```
1. User initiates payment → PaymentsController
2. PaymentsService creates order → Razorpay API
3. Payment processed externally
4. Webhook received → PaymentsController
5. Payment verified → CreditsService
6. Credits added to user account
```

## 🛡️ Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Role-Based Access Control**: User, Admin, Premium roles
- **Session Management**: Redis-based session storage
- **Token Refresh**: Automatic token renewal

### Rate Limiting
- **Per-User Rate Limiting**: Individual user limits
- **Endpoint-Specific Limits**: Different limits per endpoint
- **Tier-Based Limits**: Free, Premium, Admin tiers
- **Brute Force Protection**: Login attempt limiting

### Input Validation & Sanitization
- **DTO Validation**: Class-validator decorators
- **XSS Protection**: Input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **CSRF Protection**: Token-based protection

### Security Headers
- **CSP**: Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: Clickjacking protection
- **X-Content-Type-Options**: MIME type sniffing protection

## 📊 Monitoring & Observability

### Metrics Collection
- **Request Metrics**: Response times, status codes
- **Business Metrics**: User engagement, revenue
- **System Metrics**: CPU, memory, disk usage
- **Custom Metrics**: Application-specific metrics

### Logging
- **Structured Logging**: JSON format with Winston
- **Log Levels**: Error, Warn, Info, Debug
- **Request Tracing**: Unique request IDs
- **Error Tracking**: Comprehensive error logging

### Health Checks
- **Database Health**: Connection status
- **Redis Health**: Cache availability
- **External APIs**: AI provider status
- **System Resources**: Memory, CPU usage

## 🚀 Performance Optimization

### Caching Strategy
- **Query Caching**: Database query results
- **Response Caching**: API response caching
- **Session Caching**: User session data
- **Rate Limit Caching**: Rate limit counters

### Database Optimization
- **Connection Pooling**: Efficient connection management
- **Query Optimization**: Indexed queries
- **Migration Management**: Schema versioning
- **Performance Monitoring**: Slow query detection

### Memory Management
- **Garbage Collection**: Automatic memory cleanup
- **Memory Monitoring**: Usage tracking
- **Leak Detection**: Memory leak prevention
- **Optimization**: Memory usage optimization

## 🔧 Configuration Management

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/genie_ai

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# AI Providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GROQ_API_KEY=your-groq-key

# Payments
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret

# Environment
NODE_ENV=production
PORT=3000
```

### Configuration Files
- **Database Config**: Connection settings, migrations
- **Redis Config**: Cache configuration
- **AI Config**: Provider settings, model configurations
- **Security Config**: Rate limits, security policies

## 🐳 Deployment Architecture

### Docker Configuration
- **Multi-stage Build**: Optimized production image
- **Health Checks**: Container health monitoring
- **Resource Limits**: CPU and memory constraints
- **Security**: Non-root user, minimal attack surface

### Docker Compose
- **Development**: Local development environment
- **Staging**: Pre-production testing
- **Production**: Production deployment

### Kubernetes (Optional)
- **Deployments**: Application deployment
- **Services**: Load balancing
- **ConfigMaps**: Configuration management
- **Secrets**: Sensitive data management

## 📈 Scalability Considerations

### Horizontal Scaling
- **Stateless Design**: No server-side session storage
- **Load Balancing**: Multiple instance support
- **Database Scaling**: Read replicas, connection pooling
- **Cache Scaling**: Redis clustering

### Auto-Scaling
- **Metrics-Based**: CPU, memory, request rate
- **Custom Metrics**: Business-specific scaling
- **Predictive Scaling**: Trend-based scaling
- **Cost Optimization**: Resource efficiency

### Performance Monitoring
- **Real-time Metrics**: Live performance data
- **Alerting**: Performance threshold alerts
- **Optimization**: Automated performance tuning
- **Reporting**: Performance reports and insights

## 🔍 Testing Strategy

### Unit Tests
- **Service Tests**: Business logic testing
- **Repository Tests**: Data access testing
- **Utility Tests**: Helper function testing
- **Mock Services**: Isolated testing

### Integration Tests
- **API Tests**: Endpoint testing
- **Database Tests**: Data persistence testing
- **External API Tests**: Third-party integration testing
- **End-to-End Tests**: Complete workflow testing

### Test Coverage
- **Minimum Coverage**: 80% code coverage
- **Critical Paths**: 100% coverage for critical paths
- **Edge Cases**: Comprehensive edge case testing
- **Performance Tests**: Load and stress testing

## 📚 API Documentation

### OpenAPI/Swagger
- **Interactive Documentation**: Live API testing
- **Schema Definitions**: Request/response schemas
- **Authentication**: Security scheme documentation
- **Examples**: Usage examples and samples

### API Versioning
- **Version Strategy**: URL-based versioning
- **Backward Compatibility**: Legacy version support
- **Deprecation Policy**: Graceful deprecation
- **Migration Guides**: Version upgrade guides

## 🚨 Error Handling

### Error Types
- **Validation Errors**: Input validation failures
- **Authentication Errors**: Auth failures
- **Authorization Errors**: Permission failures
- **Business Logic Errors**: Application-specific errors
- **System Errors**: Infrastructure failures

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_1234567890"
  }
}
```

### Error Logging
- **Structured Logging**: JSON error logs
- **Error Context**: Request details, user info
- **Stack Traces**: Development debugging
- **Error Aggregation**: Error pattern analysis

## 🔄 Development Workflow

### Code Quality
- **TypeScript**: Type safety
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks

### CI/CD Pipeline
- **Automated Testing**: Test execution on commits
- **Code Quality**: Linting and formatting checks
- **Security Scanning**: Vulnerability detection
- **Deployment**: Automated deployment to environments

### Version Control
- **Git Flow**: Feature branch workflow
- **Semantic Versioning**: Version numbering
- **Changelog**: Release notes
- **Tagging**: Release tagging

## 📋 Maintenance & Operations

### Monitoring
- **Health Checks**: Service availability
- **Performance Metrics**: Response times, throughput
- **Error Rates**: Error frequency and types
- **Resource Usage**: CPU, memory, disk usage

### Logging
- **Centralized Logging**: Log aggregation
- **Log Rotation**: Log file management
- **Log Analysis**: Pattern detection
- **Alerting**: Critical error notifications

### Backup & Recovery
- **Database Backups**: Regular data backups
- **Configuration Backups**: Settings backup
- **Disaster Recovery**: Recovery procedures
- **Testing**: Backup restoration testing

## 🎯 Future Enhancements

### Planned Features
- **GraphQL API**: Alternative to REST API
- **WebSocket Support**: Real-time communication
- **Microservices**: Service decomposition
- **Event Sourcing**: Event-driven architecture

### Performance Improvements
- **CDN Integration**: Content delivery optimization
- **Database Sharding**: Data partitioning
- **Caching Layers**: Multi-level caching
- **Edge Computing**: Geographic distribution

### Security Enhancements
- **OAuth 2.0**: Third-party authentication
- **API Keys**: API access management
- **Audit Logging**: Enhanced audit trails
- **Compliance**: GDPR, SOC2 compliance

---

## 📞 Support & Contact

For technical support, feature requests, or bug reports:
- **Email**: support@genie-ai.com
- **Documentation**: https://docs.genie-ai.com
- **API Reference**: https://api.genie-ai.com/docs
- **GitHub**: https://github.com/genie-ai/server

---

*This architecture documentation is maintained by the Genie AI Team and updated regularly to reflect the current system design.*
