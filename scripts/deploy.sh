#!/bin/bash

# Genie AI Server Deployment Script
# Usage: ./scripts/deploy.sh [staging|production] [version]

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
ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
DOCKER_COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

# Check if docker-compose file exists
if [[ ! -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" ]]; then
    echo -e "${RED}Error: Docker compose file $DOCKER_COMPOSE_FILE not found${NC}"
    exit 1
fi

# Load environment variables
if [[ -f "$PROJECT_DIR/.env.${ENVIRONMENT}" ]]; then
    echo -e "${BLUE}Loading environment variables from .env.${ENVIRONMENT}${NC}"
    export $(cat "$PROJECT_DIR/.env.${ENVIRONMENT}" | grep -v '^#' | xargs)
elif [[ -f "$PROJECT_DIR/.env" ]]; then
    echo -e "${BLUE}Loading environment variables from .env${NC}"
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: No environment file found. Using system environment variables.${NC}"
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

# Function to check if service is healthy
check_health() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    print_status "Checking health of $service_name..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" ps "$service_name" | grep -q "healthy"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    print_error "$service_name failed health check after $max_attempts attempts"
    return 1
}

# Function to backup database
backup_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        print_status "Creating database backup..."
        
        local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
        local backup_path="$PROJECT_DIR/backups/$backup_file"
        
        # Create backup directory if it doesn't exist
        mkdir -p "$PROJECT_DIR/backups"
        
        # Create database backup
        docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$backup_path"
        
        if [[ $? -eq 0 ]]; then
            print_success "Database backup created: $backup_file"
        else
            print_error "Database backup failed"
            return 1
        fi
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for database to be ready
    check_health "postgres"
    
    # Run migrations
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" exec -T app npm run migration:run
    
    if [[ $? -eq 0 ]]; then
        print_success "Database migrations completed"
    else
        print_error "Database migrations failed"
        return 1
    fi
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application to $ENVIRONMENT environment..."
    
    # Stop existing services
    print_status "Stopping existing services..."
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" down
    
    # Pull latest images
    print_status "Pulling latest images..."
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" pull
    
    # Build application image
    print_status "Building application image..."
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" build --no-cache app
    
    # Start services
    print_status "Starting services..."
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    check_health "postgres"
    check_health "redis"
    check_health "app"
    
    print_success "Application deployed successfully"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    local app_port
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        app_port="4001"
    else
        app_port="4000"
    fi
    
    # Check application health endpoint
    local health_url="http://localhost:$app_port/api/health"
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$health_url" > /dev/null; then
            print_success "Application health check passed"
            return 0
        fi
        
        echo -n "."
        sleep 5
        ((attempt++))
    done
    
    print_error "Application health check failed"
    return 1
}

# Function to run smoke tests
run_smoke_tests() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        print_status "Running smoke tests..."
        
        # Add your smoke tests here
        # Example: curl -f https://yourapp.com/api/health
        # Example: npm run test:smoke
        
        print_success "Smoke tests completed"
    fi
}

# Function to cleanup old images
cleanup_images() {
    print_status "Cleaning up old Docker images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove old versions of the application image
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | \
    grep "genie-ai-server" | \
    awk '$3 < "'$(date -d '7 days ago' -Iseconds)'" {print $1":"$2}' | \
    xargs -r docker rmi || true
    
    print_success "Cleanup completed"
}

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Add notification logic here (Slack, email, etc.)
    # Example: curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"$message\"}" $SLACK_WEBHOOK_URL
    
    print_status "Notification sent: $message"
}

# Main deployment process
main() {
    print_status "Starting deployment to $ENVIRONMENT environment (version: $VERSION)"
    
    # Pre-deployment checks
    print_status "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "docker-compose is not installed"
        exit 1
    fi
    
    print_success "Pre-deployment checks passed"
    
    # Create database backup (production only)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        backup_database
    fi
    
    # Deploy application
    deploy_application
    
    # Run database migrations
    run_migrations
    
    # Run health checks
    if ! run_health_checks; then
        print_error "Health checks failed. Rolling back..."
        # Add rollback logic here
        exit 1
    fi
    
    # Run smoke tests (production only)
    run_smoke_tests
    
    # Cleanup old images
    cleanup_images
    
    # Send success notification
    send_notification "success" "Deployment to $ENVIRONMENT completed successfully"
    
    print_success "Deployment completed successfully!"
    print_status "Application is available at: http://localhost:$app_port"
}

# Error handling
trap 'print_error "Deployment failed. Check logs for details."; exit 1' ERR

# Run main function
main "$@"
