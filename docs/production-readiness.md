# Production Readiness Guide - Genie AI Server

## Overview

This guide provides comprehensive instructions for deploying the Genie AI Server to production. It covers all aspects of production deployment, monitoring, security, and maintenance.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: Minimum 4GB, Recommended 8GB+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Storage**: Minimum 50GB SSD, Recommended 100GB+ SSD
- **Network**: Stable internet connection with static IP

### Software Requirements
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Git**: 2.30+
- **Node.js**: 18+ (for development)
- **PostgreSQL**: 15+ (if not using Docker)
- **Redis**: 7+ (if not using Docker)

## Pre-Deployment Checklist

### 1. Security Configuration
- [ ] Strong JWT secret (32+ characters)
- [ ] Secure database passwords
- [ ] HTTPS certificates configured
- [ ] Security headers enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] Environment secrets secured

### 2. Performance Optimization
- [ ] Database indexes created
- [ ] Redis caching configured
- [ ] Connection pooling optimized
- [ ] Response compression enabled
- [ ] Static file optimization
- [ ] CDN configured (if applicable)

### 3. Monitoring Setup
- [ ] Health checks implemented
- [ ] Logging configured
- [ ] Metrics collection active
- [ ] Alerting rules configured
- [ ] APM integration complete
- [ ] Business analytics active

### 4. Backup Strategy
- [ ] Database backup automated
- [ ] Application data backed up
- [ ] Configuration files versioned
- [ ] Disaster recovery plan ready
- [ ] Backup testing completed

## Deployment Process

### 1. Environment Setup

#### Clone Repository
```bash
git clone https://github.com/your-org/genie-ai-server.git
cd genie-ai-server
```

#### Configure Environment Variables
```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit environment variables
nano .env.production
```

#### Required Environment Variables
```bash
# Application
NODE_ENV=production
PORT=4000

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=genie_user
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=genie_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Security
TRUST_PROXY=true
CORS_ORIGIN=https://yourdomain.com
FORCE_HTTPS=true

# External Services
RAZORPAY_KEY_ID=your-production-key-id
RAZORPAY_KEY_SECRET=your-production-key-secret
OPENAI_API_KEY=your-production-openai-key
ANTHROPIC_API_KEY=your-production-anthropic-key
GROQ_API_KEY=your-production-groq-key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-production-email@gmail.com
SMTP_PASS=your-production-email-password

# Monitoring
GRAFANA_PASSWORD=your-secure-grafana-password
PROMETHEUS_RETENTION=30d

# Backup
AWS_S3_BUCKET=your-production-backup-bucket
AWS_ACCESS_KEY_ID=your-production-aws-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret

# Notifications
SLACK_WEBHOOK_URL=your-production-slack-webhook
```

### 2. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to nginx directory
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chown -R $USER:$USER nginx/ssl/
```

#### Using Custom Certificates
```bash
# Place your certificates in nginx/ssl/
mkdir -p nginx/ssl
# Copy your cert.pem and key.pem files to this directory
```

### 3. Database Setup

#### Create Database
```bash
# Start PostgreSQL container
docker-compose -f docker-compose.production.yml up -d postgres

# Wait for database to be ready
sleep 30

# Run database migrations
docker-compose -f docker-compose.production.yml exec app npm run migration:run

# Create initial admin user (optional)
docker-compose -f docker-compose.production.yml exec app npm run seed:admin
```

### 4. Application Deployment

#### Deploy Application
```bash
# Deploy using deployment script
./scripts/deploy.sh production

# Or deploy manually
docker-compose -f docker-compose.production.yml up -d
```

#### Verify Deployment
```bash
# Check application health
curl -f https://yourdomain.com/api/health

# Check all services
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f app
```

### 5. Monitoring Setup

#### Access Monitoring Dashboards
- **Grafana**: https://monitoring.yourdomain.com
- **Prometheus**: https://metrics.yourdomain.com
- **Application Health**: https://yourdomain.com/api/health

#### Configure Alerts
1. Access Grafana dashboard
2. Import alert rules from `monitoring/alert_rules.yml`
3. Configure notification channels (Slack, Email)
4. Test alert notifications

## Post-Deployment Verification

### 1. Health Checks
```bash
# Application health
curl -f https://yourdomain.com/api/health

# Database connectivity
curl -f https://yourdomain.com/api/health/database

# Redis connectivity
curl -f https://yourdomain.com/api/health/redis

# Full system health
curl -f https://yourdomain.com/api/health/detailed
```

### 2. Security Verification
```bash
# Run security audit
curl -X POST https://yourdomain.com/api/production/security-audit \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check security vulnerabilities
curl -f https://yourdomain.com/api/production/security/vulnerabilities \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Performance Testing
```bash
# Run performance tests
npm run test:performance

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/health
```

### 4. Monitoring Verification
```bash
# Check metrics collection
curl -f https://yourdomain.com/api/monitoring/metrics

# Check active alerts
curl -f https://yourdomain.com/api/monitoring/alerts/active \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Maintenance Procedures

### 1. Regular Backups
```bash
# Run backup script
./scripts/backup.sh all

# Verify backup integrity
./scripts/backup.sh verify

# Restore from backup (if needed)
./scripts/backup.sh restore database backup_file.sql.gz
```

### 2. Security Updates
```bash
# Update dependencies
docker-compose -f docker-compose.production.yml exec app npm audit fix

# Rebuild and redeploy
docker-compose -f docker-compose.production.yml build --no-cache app
docker-compose -f docker-compose.production.yml up -d app
```

### 3. Performance Monitoring
```bash
# Check system metrics
curl -f https://yourdomain.com/api/production/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check production readiness
curl -f https://yourdomain.com/api/production/readiness \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Log Management
```bash
# View application logs
docker-compose -f docker-compose.production.yml logs -f app

# View nginx logs
docker-compose -f docker-compose.production.yml logs -f nginx

# Rotate logs (if needed)
docker-compose -f docker-compose.production.yml exec app npm run log:rotate
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Check environment variables
docker-compose -f docker-compose.production.yml config

# Restart services
docker-compose -f docker-compose.production.yml restart app
```

#### 2. Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.production.yml ps postgres

# Check database logs
docker-compose -f docker-compose.production.yml logs postgres

# Test database connection
docker-compose -f docker-compose.production.yml exec app npm run db:test
```

#### 3. High Memory Usage
```bash
# Check memory usage
docker stats

# Restart services
docker-compose -f docker-compose.production.yml restart

# Check for memory leaks
curl -f https://yourdomain.com/api/monitoring/metrics
```

#### 4. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

### Emergency Procedures

#### 1. Rollback Deployment
```bash
# Rollback to previous version
./scripts/deploy.sh rollback

# Or manually rollback
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

#### 2. Database Recovery
```bash
# Restore from backup
./scripts/backup.sh restore database latest

# Or restore specific backup
./scripts/backup.sh restore database backup_20240101_120000.sql.gz
```

#### 3. Service Recovery
```bash
# Restart all services
docker-compose -f docker-compose.production.yml restart

# Restart specific service
docker-compose -f docker-compose.production.yml restart app

# Check service health
docker-compose -f docker-compose.production.yml ps
```

## Security Considerations

### 1. Access Control
- Use strong passwords for all accounts
- Enable two-factor authentication where possible
- Regularly rotate API keys and secrets
- Implement IP whitelisting for admin access

### 2. Network Security
- Use HTTPS for all communications
- Configure firewall rules appropriately
- Enable DDoS protection
- Monitor network traffic

### 3. Data Protection
- Encrypt sensitive data at rest
- Use secure communication protocols
- Implement data retention policies
- Regular security audits

### 4. Monitoring and Alerting
- Monitor all security events
- Set up alerts for suspicious activities
- Regular security assessments
- Incident response procedures

## Performance Optimization

### 1. Database Optimization
- Regular index maintenance
- Query performance monitoring
- Connection pool tuning
- Regular VACUUM and ANALYZE

### 2. Caching Strategy
- Redis cache optimization
- Application-level caching
- CDN configuration
- Cache invalidation strategies

### 3. Load Balancing
- Multiple application instances
- Health check configuration
- Load balancer optimization
- Auto-scaling configuration

### 4. Monitoring and Metrics
- Performance metrics collection
- Alert threshold configuration
- Capacity planning
- Regular performance reviews

## Support and Maintenance

### 1. Regular Maintenance Tasks
- **Daily**: Health checks, log monitoring
- **Weekly**: Security updates, backup verification
- **Monthly**: Performance review, security audit
- **Quarterly**: Disaster recovery testing, capacity planning

### 2. Monitoring and Alerting
- Set up comprehensive monitoring
- Configure appropriate alert thresholds
- Regular alert testing
- Incident response procedures

### 3. Documentation and Training
- Keep documentation updated
- Train team members on procedures
- Regular security awareness training
- Incident response training

### 4. Continuous Improvement
- Regular performance reviews
- Security assessment updates
- Process improvement
- Technology updates

---

**Last Updated**: $(date)
**Next Review**: $(date -d '+3 months')
**Document Owner**: DevOps Team
