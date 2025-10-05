# Genie AI Server Deployment Guide

This guide covers deployment of the Genie AI Server across different environments, from local development to production.

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Local Development](#-local-development)
3. [Docker Deployment](#-docker-deployment)
4. [Cloud Deployment](#-cloud-deployment)
5. [Production Deployment](#-production-deployment)
6. [Kubernetes Deployment](#-kubernetes-deployment)
7. [Monitoring & Observability](#-monitoring--observability)
8. [Security Considerations](#-security-considerations)
9. [Troubleshooting](#-troubleshooting)
10. [Performance Optimization](#-performance-optimization)
11. [Backup & Recovery](#-backup--recovery)
12. [Support](#-support)

## 📋 Prerequisites

### System Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **PostgreSQL**: v13.0 or higher
- **Redis**: v6.0 or higher
- **Docker**: v20.0 or higher (for containerized deployment)

### Required Services
- **Database**: PostgreSQL instance
- **Cache**: Redis instance
- **External APIs**: OpenAI, Anthropic, Groq API keys
- **Payment**: Razorpay account (for payments)

## 🏠 Local Development

### 1. Clone Repository
```bash
git clone https://github.com/genie-ai/server.git
cd server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create `.env` file:
```bash
cp .env.example .env
```

Configure environment variables:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/genie_ai_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-development-secret-key
JWT_EXPIRES_IN=24h

# AI Providers
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GROQ_API_KEY=your-groq-api-key

# Payments (Optional for development)
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Environment
NODE_ENV=development
PORT=3000
```

### 4. Database Setup
```bash
# Start PostgreSQL and Redis (using Docker)
docker-compose up -d postgres redis

# Run database migrations
npm run migration:run

# Seed development data
npm run seed:run
```

### 5. Start Development Server
```bash
# Start with hot reload
npm run start:dev

# Or start with Docker
docker-compose up
```

### 6. Verify Installation
- **API**: http://localhost:3000/api/health
- **Documentation**: http://localhost:3000/api/docs
- **Metrics**: http://localhost:3000/api/metrics

## 🐳 Docker Deployment

### 1. Development with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 2. Production Docker Build
```bash
# Build production image
docker build -t genie-ai-server:latest .

# Run container
docker run -d \
  --name genie-ai-server \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379 \
  -e JWT_SECRET=your-secret \
  genie-ai-server:latest
```

### 3. Docker Compose Production
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=genie_ai
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## ☁️ Cloud Deployment

### AWS Deployment

#### 1. ECS with Fargate
```yaml
# task-definition.json
{
  "family": "genie-ai-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "genie-ai-server",
      "image": "your-account.dkr.ecr.region.amazonaws.com/genie-ai-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:genie-ai/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/genie-ai-server",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 2. RDS Database Setup
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier genie-ai-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password your-password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-12345678
```

#### 3. ElastiCache Redis Setup
```bash
# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id genie-ai-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

### Google Cloud Platform

#### 1. Cloud Run Deployment
```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/genie-ai-server', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/genie-ai-server']
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['run', 'deploy', 'genie-ai-server', '--image', 'gcr.io/$PROJECT_ID/genie-ai-server', '--region', 'us-central1']
```

#### 2. Cloud SQL Setup
```bash
# Create Cloud SQL instance
gcloud sql instances create genie-ai-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

### Azure Deployment

#### 1. Container Instances
```yaml
# azure-deploy.yaml
apiVersion: 2021-07-01
location: eastus
name: genie-ai-server
properties:
  containers:
  - name: genie-ai-server
    image: your-registry.azurecr.io/genie-ai-server:latest
    resources:
      requests:
        cpu: 1
        memoryInGb: 1
    ports:
    - port: 3000
    environmentVariables:
    - name: NODE_ENV
      value: production
    - name: DATABASE_URL
      secureValue: your-database-connection-string
  osType: Linux
  restartPolicy: Always
```

## 🚀 Production Deployment

### 1. Environment Preparation

#### Production Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:password@prod-db-host:5432/genie_ai_prod

# Redis
REDIS_URL=redis://prod-redis-host:6379

# JWT (Use strong, unique secret)
JWT_SECRET=your-super-secure-production-secret-key
JWT_EXPIRES_IN=24h

# AI Providers
OPENAI_API_KEY=your-production-openai-key
ANTHROPIC_API_KEY=your-production-anthropic-key
GROQ_API_KEY=your-production-groq-key

# Payments
RAZORPAY_KEY_ID=your-production-razorpay-key-id
RAZORPAY_KEY_SECRET=your-production-razorpay-key-secret

# Environment
NODE_ENV=production
PORT=3000

# Security
CORS_ORIGIN=https://your-frontend-domain.com
TRUST_PROXY=true

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 2. Database Migration
```bash
# Run production migrations
NODE_ENV=production npm run migration:run

# Verify migration status
NODE_ENV=production npm run migration:show
```

### 3. SSL/TLS Setup

#### Using Nginx as Reverse Proxy
```nginx
# /etc/nginx/sites-available/genie-ai
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Process Management

#### Using PM2
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'genie-ai-server',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### 5. Monitoring Setup

#### Health Checks
```bash
# Basic health check
curl -f http://localhost:3000/api/health || exit 1

# Detailed health check
curl -f http://localhost:3000/api/health/detailed || exit 1
```

#### Log Management
```bash
# Configure log rotation
cat > /etc/logrotate.d/genie-ai << EOF
/var/log/genie-ai/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 node node
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## 🔧 Kubernetes Deployment

### 1. Namespace and ConfigMap
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: genie-ai

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: genie-ai-config
  namespace: genie-ai
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
```

### 2. Secrets
```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: genie-ai-secrets
  namespace: genie-ai
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  OPENAI_API_KEY: <base64-encoded-openai-key>
  ANTHROPIC_API_KEY: <base64-encoded-anthropic-key>
  GROQ_API_KEY: <base64-encoded-groq-key>
  RAZORPAY_KEY_ID: <base64-encoded-razorpay-key-id>
  RAZORPAY_KEY_SECRET: <base64-encoded-razorpay-key-secret>
```

### 3. Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: genie-ai-server
  namespace: genie-ai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: genie-ai-server
  template:
    metadata:
      labels:
        app: genie-ai-server
    spec:
      containers:
      - name: genie-ai-server
        image: your-registry/genie-ai-server:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: genie-ai-config
        - secretRef:
            name: genie-ai-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 4. Service and Ingress
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: genie-ai-service
  namespace: genie-ai
spec:
  selector:
    app: genie-ai-server
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: genie-ai-ingress
  namespace: genie-ai
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.genie-ai.com
    secretName: genie-ai-tls
  rules:
  - host: api.genie-ai.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: genie-ai-service
            port:
              number: 80
```

## 📊 Monitoring & Observability

### 1. Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'genie-ai-server'
    static_configs:
      - targets: ['genie-ai-server:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 5s
```

### 2. Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Genie AI Server",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### 3. Alerting Rules
```yaml
# alerts.yml
groups:
- name: genie-ai-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"
```

## 🔒 Security Considerations

### 1. Network Security
- **Firewall Rules**: Restrict access to necessary ports only
- **VPC**: Use private subnets for database and cache
- **Security Groups**: Restrict database access to application servers only

### 2. Application Security
- **Environment Variables**: Use secure secret management
- **HTTPS Only**: Enforce SSL/TLS in production
- **Security Headers**: Implement CSP, HSTS, etc.
- **Rate Limiting**: Implement per-user and global rate limits

### 3. Database Security
- **Encryption at Rest**: Enable database encryption
- **Encryption in Transit**: Use SSL connections
- **Access Control**: Implement least privilege access
- **Backup Encryption**: Encrypt database backups

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
curl http://localhost:3000/api/health/detailed
```

#### 2. Redis Connection Issues
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli -u $REDIS_URL info memory
```

#### 3. High Memory Usage
```bash
# Check memory usage
curl http://localhost:3000/api/performance/memory

# Force garbage collection
curl -X POST http://localhost:3000/api/performance/memory/optimize
```

#### 4. Slow Database Queries
```bash
# Get slow query report
curl http://localhost:3000/api/performance/database/slow-queries

# Optimize database
curl -X POST http://localhost:3000/api/performance/database/optimize
```

### Log Analysis
```bash
# View application logs
pm2 logs genie-ai-server

# View error logs
pm2 logs genie-ai-server --err

# View access logs
tail -f /var/log/nginx/access.log
```

## 📈 Performance Optimization

### 1. Database Optimization
- **Connection Pooling**: Optimize connection pool settings
- **Query Optimization**: Add indexes for frequently queried columns
- **Read Replicas**: Use read replicas for read-heavy workloads

### 2. Caching Strategy
- **Query Caching**: Cache frequently accessed database queries
- **Response Caching**: Cache API responses for static data
- **Session Caching**: Use Redis for session storage

### 3. Load Balancing
- **Horizontal Scaling**: Deploy multiple application instances
- **Load Balancer**: Use nginx or cloud load balancer
- **Health Checks**: Implement proper health check endpoints

## 🔄 Backup & Recovery

### 1. Database Backup
```bash
# Create database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql $DATABASE_URL < backup_20240101_120000.sql
```

### 2. Configuration Backup
```bash
# Backup environment variables
cp .env .env.backup

# Backup configuration files
tar -czf config_backup.tar.gz config/
```

### 3. Disaster Recovery
- **RTO**: Recovery Time Objective < 1 hour
- **RPO**: Recovery Point Objective < 15 minutes
- **Backup Frequency**: Daily database backups
- **Testing**: Monthly disaster recovery testing

## 📞 Support

For deployment issues or questions:
- **Documentation**: https://docs.genie-ai.com/deployment
- **Support Email**: support@genie-ai.com
- **GitHub Issues**: https://github.com/genie-ai/server/issues

---

*This deployment guide is maintained by the Genie AI Team and updated regularly to reflect current best practices.*
