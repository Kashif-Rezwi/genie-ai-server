#!/bin/bash

# Genie AI Server Backup Script
# Usage: ./scripts/backup.sh [database|redis|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_TYPE=${1:-all}
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Load environment variables
if [[ -f "$PROJECT_DIR/.env.production" ]]; then
    export $(cat "$PROJECT_DIR/.env.production" | grep -v '^#' | xargs)
elif [[ -f "$PROJECT_DIR/.env" ]]; then
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
fi

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# Function to create backup directory
create_backup_dir() {
    local backup_type=$1
    local backup_path="$BACKUP_DIR/$backup_type"
    
    if [[ ! -d "$backup_path" ]]; then
        mkdir -p "$backup_path"
        print_status "Created backup directory: $backup_path"
    fi
}

# Function to backup database
backup_database() {
    print_status "Starting database backup..."
    
    create_backup_dir "database"
    
    local backup_file="database_backup_$DATE.sql"
    local backup_path="$BACKUP_DIR/database/$backup_file"
    local compressed_file="$backup_path.gz"
    
    # Create database backup
    print_status "Creating database dump..."
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec -T postgres pg_dump \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="/tmp/$backup_file"
    
    # Copy backup from container to host
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" cp postgres:/tmp/$backup_file "$backup_path"
    
    # Compress backup
    print_status "Compressing backup..."
    gzip "$backup_path"
    
    # Verify backup
    if [[ -f "$compressed_file" ]]; then
        local backup_size=$(du -h "$compressed_file" | cut -f1)
        print_success "Database backup completed: $backup_file.gz ($backup_size)"
        
        # Upload to cloud storage if configured
        if [[ -n "$AWS_S3_BUCKET" ]]; then
            upload_to_s3 "$compressed_file" "database/"
        fi
    else
        print_error "Database backup failed"
        return 1
    fi
}

# Function to backup Redis data
backup_redis() {
    print_status "Starting Redis backup..."
    
    create_backup_dir "redis"
    
    local backup_file="redis_backup_$DATE.rdb"
    local backup_path="$BACKUP_DIR/redis/$backup_file"
    
    # Create Redis backup
    print_status "Creating Redis dump..."
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec redis redis-cli BGSAVE
    
    # Wait for background save to complete
    while [[ $(docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec redis redis-cli LASTSAVE) == $(docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" exec redis redis-cli LASTSAVE) ]]; do
        sleep 1
    done
    
    # Copy backup from container to host
    docker-compose -f "$PROJECT_DIR/docker-compose.production.yml" cp redis:/data/dump.rdb "$backup_path"
    
    # Compress backup
    print_status "Compressing backup..."
    gzip "$backup_path"
    
    # Verify backup
    if [[ -f "$backup_path.gz" ]]; then
        local backup_size=$(du -h "$backup_path.gz" | cut -f1)
        print_success "Redis backup completed: $backup_file.gz ($backup_size)"
        
        # Upload to cloud storage if configured
        if [[ -n "$AWS_S3_BUCKET" ]]; then
            upload_to_s3 "$backup_path.gz" "redis/"
        fi
    else
        print_error "Redis backup failed"
        return 1
    fi
}

# Function to backup application files
backup_application() {
    print_status "Starting application backup..."
    
    create_backup_dir "application"
    
    local backup_file="application_backup_$DATE.tar.gz"
    local backup_path="$BACKUP_DIR/application/$backup_file"
    
    # Create application backup (excluding node_modules, logs, etc.)
    print_status "Creating application archive..."
    tar -czf "$backup_path" \
        --exclude="node_modules" \
        --exclude="logs" \
        --exclude="coverage" \
        --exclude="dist" \
        --exclude=".git" \
        --exclude="backups" \
        -C "$PROJECT_DIR" .
    
    # Verify backup
    if [[ -f "$backup_path" ]]; then
        local backup_size=$(du -h "$backup_path" | cut -f1)
        print_success "Application backup completed: $backup_file ($backup_size)"
        
        # Upload to cloud storage if configured
        if [[ -n "$AWS_S3_BUCKET" ]]; then
            upload_to_s3 "$backup_path" "application/"
        fi
    else
        print_error "Application backup failed"
        return 1
    fi
}

# Function to backup configuration files
backup_configuration() {
    print_status "Starting configuration backup..."
    
    create_backup_dir "configuration"
    
    local backup_file="config_backup_$DATE.tar.gz"
    local backup_path="$BACKUP_DIR/configuration/$backup_file"
    
    # Create configuration backup
    print_status "Creating configuration archive..."
    tar -czf "$backup_path" \
        -C "$PROJECT_DIR" \
        docker-compose*.yml \
        .env* \
        nginx/ \
        monitoring/ \
        scripts/ \
        docs/
    
    # Verify backup
    if [[ -f "$backup_path" ]]; then
        local backup_size=$(du -h "$backup_path" | cut -f1)
        print_success "Configuration backup completed: $backup_file ($backup_size)"
        
        # Upload to cloud storage if configured
        if [[ -n "$AWS_S3_BUCKET" ]]; then
            upload_to_s3 "$backup_path" "configuration/"
        fi
    else
        print_error "Configuration backup failed"
        return 1
    fi
}

# Function to upload backup to S3
upload_to_s3() {
    local file_path=$1
    local s3_prefix=$2
    
    if [[ -n "$AWS_S3_BUCKET" && -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]]; then
        print_status "Uploading to S3..."
        
        local s3_key="$s3_prefix$(basename "$file_path")"
        
        if aws s3 cp "$file_path" "s3://$AWS_S3_BUCKET/$s3_key"; then
            print_success "Uploaded to S3: s3://$AWS_S3_BUCKET/$s3_key"
        else
            print_warning "Failed to upload to S3"
        fi
    else
        print_warning "S3 configuration not found, skipping cloud upload"
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    print_status "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.rdb.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    print_success "Old backups cleaned up"
}

# Function to verify backup integrity
verify_backup() {
    local backup_file=$1
    
    if [[ -f "$backup_file" ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            print_success "Backup integrity verified: $(basename "$backup_file")"
            return 0
        else
            print_error "Backup integrity check failed: $(basename "$backup_file")"
            return 1
        fi
    else
        print_error "Backup file not found: $backup_file"
        return 1
    fi
}

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Add notification logic here (Slack, email, etc.)
    # Example: curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"$message\"}" $SLACK_WEBHOOK_URL
    
    print_status "Notification sent: $message"
}

# Main backup process
main() {
    print_status "Starting backup process (type: $BACKUP_TYPE)"
    
    # Create main backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Run backups based on type
    case "$BACKUP_TYPE" in
        "database")
            backup_database
            ;;
        "redis")
            backup_redis
            ;;
        "application")
            backup_application
            ;;
        "configuration")
            backup_configuration
            ;;
        "all")
            backup_database
            backup_redis
            backup_application
            backup_configuration
            ;;
        *)
            print_error "Invalid backup type: $BACKUP_TYPE"
            print_status "Valid types: database, redis, application, configuration, all"
            exit 1
            ;;
    esac
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send success notification
    send_notification "success" "Backup completed successfully ($BACKUP_TYPE)"
    
    print_success "Backup process completed!"
}

# Error handling
trap 'print_error "Backup failed. Check logs for details."; exit 1' ERR

# Run main function
main "$@"
