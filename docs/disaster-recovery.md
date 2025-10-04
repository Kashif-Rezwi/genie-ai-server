# Disaster Recovery Plan - Genie AI Server

## Overview

This document outlines the disaster recovery procedures for the Genie AI Server application. It covers backup strategies, recovery procedures, and business continuity measures.

## Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Maximum Acceptable Downtime**: 8 hours

## Backup Strategy

### 1. Database Backups

#### Automated Backups
- **Frequency**: Every 6 hours
- **Retention**: 30 days for daily backups, 12 months for weekly backups
- **Location**: Local storage + cloud storage (AWS S3/Google Cloud Storage)
- **Format**: PostgreSQL dump files (.sql)

#### Manual Backups
- **Before major deployments**
- **Before database schema changes**
- **Before system maintenance**

#### Backup Commands
```bash
# Create database backup
docker-compose exec postgres pg_dump -U $POSTGRES_USER -d $POSTGRES_DB > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_$(date +%Y%m%d_%H%M%S).sql

# Upload to cloud storage
aws s3 cp backup_$(date +%Y%m%d_%H%M%S).sql.gz s3://your-backup-bucket/database/
```

### 2. Application Data Backups

#### Redis Data
- **Frequency**: Every 12 hours
- **Method**: Redis RDB snapshots
- **Retention**: 7 days

#### File Storage
- **User uploads**: Real-time replication to secondary storage
- **Logs**: Centralized logging with 90-day retention
- **Configuration**: Version controlled in Git

### 3. Infrastructure Backups

#### Docker Images
- **Registry**: Container registry with versioning
- **Retention**: Keep last 10 versions of each image

#### Configuration Files
- **Docker Compose**: Version controlled
- **Environment Variables**: Encrypted storage
- **SSL Certificates**: Automated renewal with backup

## Recovery Procedures

### 1. Database Recovery

#### Full Database Recovery
```bash
# 1. Stop application services
docker-compose down

# 2. Restore database from backup
docker-compose up -d postgres
docker-compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker-compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < backup_file.sql

# 3. Verify data integrity
docker-compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT COUNT(*) FROM users;"

# 4. Restart application
docker-compose up -d
```

#### Point-in-Time Recovery
```bash
# 1. Restore from base backup
docker-compose exec postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB backup_file.sql

# 2. Apply WAL files for point-in-time recovery
docker-compose exec postgres pg_receivewal -D /var/lib/postgresql/data/pg_wal -U $POSTGRES_USER
```

### 2. Application Recovery

#### Complete Application Recovery
```bash
# 1. Clone repository
git clone https://github.com/your-org/genie-ai-server.git
cd genie-ai-server

# 2. Restore environment configuration
cp .env.production.backup .env.production

# 3. Deploy application
./scripts/deploy.sh production

# 4. Verify deployment
curl -f http://localhost:4000/api/health
```

#### Rolling Recovery
```bash
# 1. Deploy new version alongside existing
docker-compose -f docker-compose.production.yml up -d --scale app=2

# 2. Health check new instance
curl -f http://localhost:4001/api/health

# 3. Update load balancer to point to new instance
# 4. Remove old instance
docker-compose -f docker-compose.production.yml up -d --scale app=1
```

### 3. Infrastructure Recovery

#### Server Failure Recovery
```bash
# 1. Provision new server
# 2. Install Docker and Docker Compose
# 3. Clone repository and restore configuration
# 4. Deploy application using deployment script
# 5. Restore data from backups
# 6. Update DNS records
```

#### Network Failure Recovery
```bash
# 1. Check network connectivity
ping google.com

# 2. Verify DNS resolution
nslookup your-domain.com

# 3. Check firewall rules
iptables -L

# 4. Restart network services
systemctl restart networking
```

## Business Continuity Measures

### 1. High Availability Setup

#### Load Balancer Configuration
- **Primary**: Active load balancer
- **Secondary**: Standby load balancer
- **Failover**: Automatic failover within 30 seconds

#### Database Replication
- **Primary**: Master database
- **Secondary**: Read replica
- **Failover**: Automatic promotion of replica to master

#### Application Scaling
- **Minimum**: 2 application instances
- **Auto-scaling**: Scale based on CPU/memory usage
- **Health checks**: Continuous health monitoring

### 2. Monitoring and Alerting

#### Critical Alerts
- **Database down**: Immediate notification
- **Application down**: Immediate notification
- **High error rate**: 5-minute notification
- **Disk space low**: 1-hour notification

#### Alert Channels
- **Primary**: Email notifications
- **Secondary**: Slack notifications
- **Emergency**: SMS notifications

### 3. Communication Plan

#### Internal Communication
- **Incident Commander**: Technical Lead
- **Communication Lead**: Product Manager
- **Technical Team**: Development Team
- **Stakeholders**: Management Team

#### External Communication
- **Status Page**: Real-time status updates
- **Customer Notifications**: Email/SMS notifications
- **Social Media**: Twitter updates for major incidents

## Testing and Validation

### 1. Recovery Testing

#### Monthly Tests
- **Database restore test**: Restore from backup and verify data
- **Application deployment test**: Deploy from scratch
- **Failover test**: Test automatic failover procedures

#### Quarterly Tests
- **Full disaster recovery simulation**: Complete system recovery
- **Communication plan test**: Test notification systems
- **Documentation review**: Update procedures and documentation

### 2. Backup Validation

#### Daily Validation
- **Backup integrity check**: Verify backup files are not corrupted
- **Backup accessibility**: Test backup file access
- **Backup completeness**: Verify all required data is backed up

#### Weekly Validation
- **Restore test**: Test restoring from recent backup
- **Data consistency check**: Verify data integrity after restore
- **Performance test**: Ensure restored system meets performance requirements

## Incident Response

### 1. Incident Classification

#### Severity Levels
- **P1 - Critical**: Complete system outage
- **P2 - High**: Major functionality unavailable
- **P3 - Medium**: Minor functionality affected
- **P4 - Low**: Cosmetic issues

#### Response Times
- **P1**: 15 minutes
- **P2**: 1 hour
- **P3**: 4 hours
- **P4**: 24 hours

### 2. Incident Response Process

#### Detection
1. **Automated monitoring**: System alerts
2. **User reports**: Customer support tickets
3. **Manual checks**: Regular health checks

#### Response
1. **Acknowledge incident**: Within response time
2. **Assess impact**: Determine severity and scope
3. **Implement fix**: Apply appropriate recovery procedure
4. **Verify resolution**: Confirm system is working
5. **Communicate status**: Update stakeholders

#### Post-Incident
1. **Root cause analysis**: Identify underlying cause
2. **Document lessons learned**: Update procedures
3. **Implement improvements**: Prevent future occurrences
4. **Incident report**: Document incident details

## Contact Information

### Emergency Contacts
- **Technical Lead**: +1-555-0001
- **DevOps Engineer**: +1-555-0002
- **Product Manager**: +1-555-0003
- **Management**: +1-555-0004

### External Services
- **Cloud Provider**: AWS Support
- **Domain Registrar**: Namecheap Support
- **SSL Certificate**: Let's Encrypt
- **Monitoring Service**: DataDog Support

## Appendices

### A. Backup Scripts
See `scripts/backup.sh` for automated backup scripts.

### B. Recovery Scripts
See `scripts/recovery.sh` for recovery automation scripts.

### C. Monitoring Configuration
See `monitoring/` directory for monitoring setup.

### D. Environment Configuration
See `.env.production` for production environment variables.

---

**Last Updated**: $(date)
**Next Review**: $(date -d '+3 months')
**Document Owner**: DevOps Team
