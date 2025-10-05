# Genie AI Server Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Genie AI Server.

## 📋 Table of Contents

1. [Quick Diagnostics](#-quick-diagnostics)
2. [Common Issues & Solutions](#-common-issues--solutions)
3. [Advanced Debugging](#-advanced-debugging)
4. [Performance Analysis](#-performance-analysis)
5. [Emergency Procedures](#-emergency-procedures)
6. [Getting Help](#-getting-help)
7. [Maintenance Tasks](#-maintenance-tasks)

## 🚨 Quick Diagnostics

### Health Check Commands
```bash
# Basic health check
curl -f http://localhost:3000/api/health

# Detailed health check
curl http://localhost:3000/api/health/detailed

# Performance metrics
curl http://localhost:3000/api/performance/metrics

# System status
curl http://localhost:3000/api/status
```

### Log Locations
```bash
# Application logs
pm2 logs genie-ai-server

# Error logs
pm2 logs genie-ai-server --err

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# System logs
journalctl -u genie-ai-server -f
```

## 🔧 Common Issues & Solutions

### 1. Application Won't Start

#### Issue: Port Already in Use
```bash
# Error: EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

#### Issue: Database Connection Failed
```bash
# Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

#### Issue: Redis Connection Failed
```bash
# Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check if Redis is running
sudo systemctl status redis

# Start Redis
sudo systemctl start redis

# Test connection
redis-cli ping
```

#### Issue: Missing Environment Variables
```bash
# Error: JWT_SECRET is required
```

**Solution:**
```bash
# Check environment file
cat .env

# Copy example file
cp .env.example .env

# Edit with required values
nano .env
```

### 2. Authentication Issues

#### Issue: JWT Token Invalid
```bash
# Error: Unauthorized - Invalid token
```

**Solutions:**
```bash
# Check JWT secret
echo $JWT_SECRET

# Verify token format
echo "your-token" | base64 -d

# Check token expiration
curl -H "Authorization: Bearer your-token" http://localhost:3000/api/auth/verify
```

#### Issue: User Not Found
```bash
# Error: User not found
```

**Solutions:**
```bash
# Check user in database
psql $DATABASE_URL -c "SELECT * FROM users WHERE email = 'user@example.com';"

# Check user service
curl http://localhost:3000/api/users/profile -H "Authorization: Bearer your-token"
```

#### Issue: Insufficient Permissions
```bash
# Error: Forbidden - Insufficient permissions
```

**Solutions:**
```bash
# Check user role
psql $DATABASE_URL -c "SELECT role FROM users WHERE id = 'user-id';"

# Update user role
psql $DATABASE_URL -c "UPDATE users SET role = 'admin' WHERE id = 'user-id';"
```

### 3. Database Issues

#### Issue: Migration Failed
```bash
# Error: Migration failed
```

**Solutions:**
```bash
# Check migration status
npm run migration:show

# Rollback last migration
npm run migration:revert

# Run specific migration
npm run migration:run -- --transaction all

# Reset database
npm run migration:revert -- --transaction all
npm run migration:run
```

#### Issue: Slow Queries
```bash
# High response times
```

**Solutions:**
```bash
# Get slow query report
curl http://localhost:3000/api/performance/database/slow-queries

# Optimize database
curl -X POST http://localhost:3000/api/performance/database/optimize

# Check database metrics
curl http://localhost:3000/api/performance/database/metrics
```

#### Issue: Connection Pool Exhausted
```bash
# Error: Too many connections
```

**Solutions:**
```bash
# Check connection pool status
curl http://localhost:3000/api/performance/database/pool

# Restart application
pm2 restart genie-ai-server

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### 4. Redis Issues

#### Issue: Redis Memory Full
```bash
# Error: OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**
```bash
# Check Redis memory usage
redis-cli info memory

# Clear Redis cache
redis-cli flushall

# Optimize Redis
curl -X POST http://localhost:3000/api/performance/redis/optimize

# Check Redis configuration
redis-cli config get maxmemory
```

#### Issue: Redis Connection Timeout
```bash
# Error: Redis connection timeout
```

**Solutions:**
```bash
# Check Redis status
redis-cli ping

# Check Redis logs
tail -f /var/log/redis/redis-server.log

# Restart Redis
sudo systemctl restart redis
```

### 5. AI Service Issues

#### Issue: AI Provider API Error
```bash
# Error: OpenAI API error
```

**Solutions:**
```bash
# Check API key
echo $OPENAI_API_KEY

# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Check rate limits
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/usage

# Check available models
curl http://localhost:3000/api/ai/models
```

#### Issue: Insufficient Credits
```bash
# Error: Insufficient credits
```

**Solutions:**
```bash
# Check user credits
curl http://localhost:3000/api/credits/balance -H "Authorization: Bearer your-token"

# Add credits (admin only)
curl -X POST http://localhost:3000/api/credits/add \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id", "amount": 100}'
```

#### Issue: AI Response Timeout
```bash
# Error: Request timeout
```

**Solutions:**
```bash
# Check AI service status
curl http://localhost:3000/api/ai/status

# Check performance metrics
curl http://localhost:3000/api/performance/ai

# Increase timeout in configuration
# Edit config/ai.config.ts
```

### 6. Payment Issues

#### Issue: Razorpay Integration Error
```bash
# Error: Razorpay API error
```

**Solutions:**
```bash
# Check Razorpay credentials
echo $RAZORPAY_KEY_ID
echo $RAZORPAY_KEY_SECRET

# Test Razorpay connection
curl -u "$RAZORPAY_KEY_ID:$RAZORPAY_KEY_SECRET" \
  https://api.razorpay.com/v1/orders

# Check payment logs
curl http://localhost:3000/api/payments/logs
```

#### Issue: Webhook Verification Failed
```bash
# Error: Webhook signature verification failed
```

**Solutions:**
```bash
# Check webhook secret
echo $RAZORPAY_WEBHOOK_SECRET

# Verify webhook endpoint
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: test-signature" \
  -d '{"test": "data"}'

# Check webhook logs
curl http://localhost:3000/api/payments/webhook/logs
```

### 7. Performance Issues

#### Issue: High Memory Usage
```bash
# Memory usage > 80%
```

**Solutions:**
```bash
# Check memory usage
curl http://localhost:3000/api/performance/memory

# Optimize memory
curl -X POST http://localhost:3000/api/performance/memory/optimize

# Check memory leaks
curl http://localhost:3000/api/performance/memory/leaks

# Restart application
pm2 restart genie-ai-server
```

#### Issue: High CPU Usage
```bash
# CPU usage > 80%
```

**Solutions:**
```bash
# Check CPU usage
curl http://localhost:3000/api/performance/cpu

# Check active processes
pm2 monit

# Scale horizontally
pm2 scale genie-ai-server 2

# Check for infinite loops in logs
pm2 logs genie-ai-server --err | grep -i "loop\|infinite"
```

#### Issue: Slow Response Times
```bash
# Response time > 2 seconds
```

**Solutions:**
```bash
# Check response time metrics
curl http://localhost:3000/api/performance/response-time

# Check slow endpoints
curl http://localhost:3000/api/performance/slow-endpoints

# Optimize database queries
curl -X POST http://localhost:3000/api/performance/database/optimize

# Check cache hit rate
curl http://localhost:3000/api/performance/cache/hit-rate
```

### 8. Security Issues

#### Issue: Rate Limit Exceeded
```bash
# Error: Rate limit exceeded
```

**Solutions:**
```bash
# Check rate limit status
curl http://localhost:3000/api/security/rate-limits

# Check user rate limits
curl http://localhost:3000/api/security/rate-limits/user -H "Authorization: Bearer your-token"

# Reset rate limits (admin only)
curl -X POST http://localhost:3000/api/security/rate-limits/reset \
  -H "Authorization: Bearer admin-token"
```

#### Issue: Brute Force Protection Triggered
```bash
# Error: Too many failed attempts
```

**Solutions:**
```bash
# Check brute force status
curl http://localhost:3000/api/security/brute-force/status

# Unblock IP (admin only)
curl -X POST http://localhost:3000/api/security/brute-force/unblock \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.100"}'

# Check audit logs
curl http://localhost:3000/api/security/audit
```

### 9. Monitoring Issues

#### Issue: Metrics Not Updating
```bash
# Metrics showing stale data
```

**Solutions:**
```bash
# Check metrics service
curl http://localhost:3000/api/metrics/status

# Force metrics update
curl -X POST http://localhost:3000/api/metrics/refresh

# Check metrics configuration
curl http://localhost:3000/api/metrics/config

# Restart metrics service
pm2 restart genie-ai-server
```

#### Issue: Health Check Failing
```bash
# Health check returning 500
```

**Solutions:**
```bash
# Check detailed health status
curl http://localhost:3000/api/health/detailed

# Check individual services
curl http://localhost:3000/api/health/database
curl http://localhost:3000/api/health/redis
curl http://localhost:3000/api/health/external-apis

# Check service logs
pm2 logs genie-ai-server --err
```

## 🔍 Advanced Debugging

### 1. Enable Debug Logging
```bash
# Set debug log level
export LOG_LEVEL=debug

# Restart application
pm2 restart genie-ai-server

# View debug logs
pm2 logs genie-ai-server --lines 100
```

### 2. Database Debugging
```bash
# Enable query logging
export TYPEORM_LOGGING=true

# Check slow query log
tail -f /var/log/postgresql/postgresql-*.log | grep "slow"

# Analyze query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';"
```

### 3. Redis Debugging
```bash
# Monitor Redis commands
redis-cli monitor

# Check Redis slow log
redis-cli slowlog get 10

# Analyze memory usage
redis-cli --bigkeys
```

### 4. Network Debugging
```bash
# Check network connectivity
netstat -tulpn | grep :3000

# Test external API connectivity
curl -v https://api.openai.com/v1/models

# Check DNS resolution
nslookup api.openai.com
```

### 5. Process Debugging
```bash
# Check process status
ps aux | grep node

# Check file descriptors
lsof -p <PID>

# Check memory map
cat /proc/<PID>/maps

# Generate core dump
gcore <PID>
```

## 📊 Performance Analysis

### 1. Response Time Analysis
```bash
# Get response time distribution
curl http://localhost:3000/api/performance/response-time/distribution

# Check slowest endpoints
curl http://localhost:3000/api/performance/endpoints/slowest

# Analyze response time trends
curl http://localhost:3000/api/performance/response-time/trends
```

### 2. Memory Analysis
```bash
# Get memory usage breakdown
curl http://localhost:3000/api/performance/memory/breakdown

# Check for memory leaks
curl http://localhost:3000/api/performance/memory/leaks

# Get garbage collection stats
curl http://localhost:3000/api/performance/memory/gc
```

### 3. Database Analysis
```bash
# Get database performance metrics
curl http://localhost:3000/api/performance/database/metrics

# Check connection pool status
curl http://localhost:3000/api/performance/database/pool

# Get query performance report
curl http://localhost:3000/api/performance/database/queries
```

### 4. Cache Analysis
```bash
# Get cache performance metrics
curl http://localhost:3000/api/performance/cache/metrics

# Check cache hit rate
curl http://localhost:3000/api/performance/cache/hit-rate

# Get cache memory usage
curl http://localhost:3000/api/performance/cache/memory
```

## 🚨 Emergency Procedures

### 1. Service Down
```bash
# Check service status
pm2 status

# Restart all services
pm2 restart all

# Check system resources
free -h
df -h
top
```

### 2. Database Down
```bash
# Check database status
sudo systemctl status postgresql

# Start database
sudo systemctl start postgresql

# Check database logs
tail -f /var/log/postgresql/postgresql-*.log
```

### 3. High Memory Usage
```bash
# Check memory usage
free -h

# Find memory-intensive processes
ps aux --sort=-%mem | head -10

# Restart application
pm2 restart genie-ai-server

# Clear caches
redis-cli flushall
```

### 4. Security Incident
```bash
# Check security logs
curl http://localhost:3000/api/security/audit

# Block suspicious IPs
curl -X POST http://localhost:3000/api/security/block-ip \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"ip": "suspicious-ip"}'

# Enable additional monitoring
curl -X POST http://localhost:3000/api/security/enable-monitoring
```

## 📞 Getting Help

### 1. Self-Service Resources
- **Documentation**: https://docs.genie-ai.com
- **API Reference**: https://api.genie-ai.com/docs
- **GitHub Issues**: https://github.com/genie-ai/server/issues

### 2. Support Channels
- **Email**: support@genie-ai.com
- **Slack**: #genie-ai-support
- **Emergency**: +1-800-GENIE-AI

### 3. When Reporting Issues
Include the following information:
- Error messages and stack traces
- Steps to reproduce the issue
- Environment details (OS, Node.js version, etc.)
- Log files and configuration
- Screenshots or videos if applicable

### 4. Log Collection
```bash
# Collect all logs
mkdir -p /tmp/genie-ai-logs
pm2 logs genie-ai-server > /tmp/genie-ai-logs/app.log
cp /var/log/nginx/error.log /tmp/genie-ai-logs/nginx-error.log
cp /var/log/nginx/access.log /tmp/genie-ai-logs/nginx-access.log
tar -czf genie-ai-logs.tar.gz /tmp/genie-ai-logs/
```

## 🔧 Maintenance Tasks

### Daily Tasks
- Check health status
- Review error logs
- Monitor performance metrics
- Check disk space

### Weekly Tasks
- Review security logs
- Check for updates
- Analyze performance trends
- Clean up old logs

### Monthly Tasks
- Security audit
- Performance optimization
- Backup verification
- Capacity planning

---

*This troubleshooting guide is maintained by the Genie AI Team and updated regularly based on common issues and solutions.*
