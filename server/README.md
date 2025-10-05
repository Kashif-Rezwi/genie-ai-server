# Genie AI Server

A production-ready, scalable backend API for AI-powered chat and credit management services built with NestJS, TypeScript, and PostgreSQL.

**Version**: 1.0.0  
**Last Updated**: January 2024  
**Status**: Production Ready

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

## 📚 Documentation

### 📋 [Complete Documentation Index](DOCS_INDEX.md)
**Start here for comprehensive navigation of all documentation**

### Comprehensive Guides
- **[Architecture Documentation](ARCHITECTURE.md)** - Complete system architecture and design patterns
- **[Deployment Guide](DEPLOYMENT.md)** - Step-by-step deployment instructions for all environments
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions
- **[API Examples](src/modules/api-docs/api-examples.md)** - Comprehensive API usage examples

### Quick Navigation
- **🚀 [Quick Start](#-quick-start)** - Get up and running in minutes
- **🔧 [Configuration](#-configuration)** - Environment setup and configuration
- **📚 [API Reference](#-api-reference)** - Complete endpoint documentation
- **🚨 [Troubleshooting](#-troubleshooting)** - Common issues and solutions

### API Documentation
- **Interactive Docs**: http://localhost:3000/api/docs (development)
- **API Reference**: Complete endpoint documentation with examples
- **Authentication Guide**: JWT token management and security
- **Rate Limiting**: Usage limits and tier management

## 🏗️ Quick Start

### Prerequisites
- Node.js v18.0.0+
- PostgreSQL v13.0+
- Redis v6.0+
- npm v8.0.0+

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/genie-ai/server.git
   cd server
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Start services with Docker
   docker-compose up -d postgres redis
   
   # Run migrations
   npm run migration:run
   
   # Seed development data
   npm run seed:run
   ```

5. **Start Development Server**
   ```bash
   npm run start:dev
   ```

6. **Verify Installation**
   - API: http://localhost:3000/api/health
   - Documentation: http://localhost:3000/api/docs

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/genie_ai

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
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Environment
NODE_ENV=development
PORT=3000
```

### Configuration Files
- `config/database.config.ts` - Database connection settings
- `config/redis.config.ts` - Redis configuration
- `config/ai.config.ts` - AI provider settings
- `config/swagger.config.ts` - API documentation

## 🏛️ Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile App     │    │   API Client    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    Load Balancer          │
                    │    (Nginx)                │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Genie AI Server API     │
                    │   (NestJS + TypeScript)   │
                    └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐    ┌─────────▼─────────┐    ┌─────────▼─────────┐
│   PostgreSQL   │    │      Redis        │    │   External APIs   │
│   (Database)   │    │     (Cache)       │    │ (OpenAI, Razorpay)│
└────────────────┘    └───────────────────┘    └───────────────────┘
```

### Module Structure
- **Authentication** - User auth and JWT management
- **AI Service** - AI model integration and management
- **Chat** - Chat management and message handling
- **Credits** - Credit-based usage system
- **Payments** - Payment processing and management
- **Monitoring** - System monitoring and metrics
- **Security** - Security services and protection
- **Performance** - Performance optimization and monitoring

## 🚀 Deployment

### Docker Deployment
```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Deployment
- **AWS**: ECS with Fargate, RDS, ElastiCache
- **GCP**: Cloud Run, Cloud SQL, Memorystore
- **Azure**: Container Instances, Azure Database

See [Deployment Guide](DEPLOYMENT.md) for detailed instructions.

## 📊 Monitoring & Observability

### Health Checks
- **Basic**: `/api/health`
- **Detailed**: `/api/health/detailed`
- **Metrics**: `/api/metrics`
- **Performance**: `/api/performance/metrics`

### Logging
- **Structured Logging**: JSON format with Winston
- **Log Levels**: Error, Warn, Info, Debug
- **Request Tracing**: Unique request IDs
- **Error Tracking**: Comprehensive error logging

### Metrics
- **Request Metrics**: Response times, status codes
- **Business Metrics**: User engagement, revenue
- **System Metrics**: CPU, memory, disk usage
- **Custom Metrics**: Application-specific metrics

## 🔒 Security

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Role-Based Access Control**: User, Admin, Premium roles
- **Session Management**: Redis-based session storage

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

## 🧪 Testing

### Test Categories
- **Unit Tests**: Service logic, repository methods
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Critical user flows

### Running Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov

# All tests
npm run test:all
```

## 📈 Performance

### Optimization Features
- **Query Caching**: Database query results
- **Response Caching**: API response caching
- **Connection Pooling**: Efficient database connections
- **Memory Management**: Automatic garbage collection

### Performance Monitoring
- **Real-time Metrics**: Live performance data
- **Alerting**: Performance threshold alerts
- **Optimization**: Automated performance tuning
- **Reporting**: Performance reports and insights

## 🔧 Development

### Code Quality
- **TypeScript**: Type safety throughout
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks

### Development Workflow
```bash
# Start development server
npm run start:dev

# Run tests
npm run test

# Build for production
npm run build

# Start production server
npm run start:prod
```

### Available Scripts
- `npm run start:dev` - Start development server
- `npm run start:prod` - Start production server
- `npm run build` - Build application
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run integration tests
- `npm run migration:run` - Run database migrations
- `npm run migration:revert` - Revert last migration
- `npm run seed:run` - Seed development data

## 🚨 Troubleshooting

### Common Issues
- **Port Already in Use**: Check and kill processes using port 3000
- **Database Connection**: Verify PostgreSQL is running and accessible
- **Redis Connection**: Check Redis service status
- **Authentication**: Verify JWT secret and token format

### Getting Help
- **Documentation**: Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- **Logs**: Review application and system logs
- **Health Checks**: Use built-in health check endpoints
- **Support**: Contact support@genie-ai.com

## 📄 API Reference

### Authentication
```bash
# Register
POST /api/auth/register

# Login
POST /api/auth/login

# Refresh token
POST /api/auth/refresh
```

### AI Chat
```bash
# Generate response
POST /api/ai/chat

# Stream response
POST /api/ai/chat/stream

# Get chat history
GET /api/ai/chat/history
```

### Credits
```bash
# Get balance
GET /api/credits/balance

# Get transactions
GET /api/credits/transactions

# Add credits (admin)
POST /api/credits/add
```

### Payments
```bash
# Create payment
POST /api/payments/create

# Verify payment
POST /api/payments/verify

# Get payment history
GET /api/payments/history
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: https://docs.genie-ai.com
- **API Reference**: https://api.genie-ai.com/docs
- **Support Email**: support@genie-ai.com
- **GitHub Issues**: https://github.com/genie-ai/server/issues

## 🙏 Acknowledgments

- **NestJS** - The amazing Node.js framework
- **TypeScript** - Type-safe JavaScript development
- **PostgreSQL** - The reliable database
- **Redis** - The fast in-memory data store
- **OpenAI** - AI model integration
- **Razorpay** - Payment processing

---

## 📝 Documentation Maintenance

### Version Synchronization
This documentation is synchronized with the codebase version. When updating the codebase:

1. **Update Version Numbers**: Update version in `package.json` and all documentation files
2. **Update Last Modified**: Update "Last Updated" dates in documentation headers
3. **Review Changes**: Ensure documentation reflects all code changes
4. **Test Links**: Verify all cross-references and links work correctly

### Documentation Files
- `README.md` - Project overview and quick start
- `ARCHITECTURE.md` - System architecture and design
- `DEPLOYMENT.md` - Deployment instructions
- `TROUBLESHOOTING.md` - Problem-solving guide
- `src/modules/api-docs/api-examples.md` - API usage examples

---

**Built with ❤️ by the Genie AI Team**
