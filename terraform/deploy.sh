#!/bin/bash

# Deployment script for AWS infrastructure
# This script automates the deployment process

set -e

echo "🚀 Starting AWS deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v terraform >/dev/null 2>&1 || { echo -e "${RED}❌ Terraform is not installed${NC}" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is not installed${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is not installed${NC}" >&2; exit 1; }

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Change to terraform directory
cd terraform

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo -e "${YELLOW}⚠️  terraform.tfvars not found${NC}"
    echo "Creating from example..."
    cp terraform.tfvars.example terraform.tfvars
    echo -e "${YELLOW}⚠️  Please edit terraform/terraform.tfvars with your values before continuing${NC}"
    exit 1
fi

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Plan infrastructure
echo "📊 Planning infrastructure changes..."
terraform plan -out=tfplan

# Ask for confirmation
echo -e "${YELLOW}Review the plan above. Do you want to apply these changes? (yes/no)${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

# Apply infrastructure
echo "🏗️  Creating infrastructure..."
terraform apply tfplan

echo -e "${GREEN}✅ Infrastructure created successfully${NC}"

# Get ECR repository URL
ECR_URL=$(terraform output -raw ecr_repository_url)
AWS_REGION=$(terraform output -raw aws_region)

echo "📦 ECR Repository: $ECR_URL"

# Build and push Docker image
echo "🐳 Building Docker image..."
cd ..
docker build -t loanlight-app:latest .

echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URL"

echo "🏷️  Tagging image..."
docker tag loanlight-app:latest "$ECR_URL:latest"
docker tag loanlight-app:latest "$ECR_URL:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')"

echo "⬆️  Pushing image to ECR..."
docker push "$ECR_URL:latest"
docker push "$ECR_URL:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')" || true

echo -e "${GREEN}✅ Image pushed successfully${NC}"

# Update ECS service
echo "🔄 Updating ECS service..."
cd terraform
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
SERVICE_NAME=$(terraform output -raw ecs_service_name)

aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

echo -e "${GREEN}✅ ECS service updated${NC}"

# Display outputs
echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
terraform output

echo ""
echo "📝 Next steps:"
echo "1. Run database migrations (see DEPLOYMENT.md)"
echo "2. Test the application health check:"
ALB_URL=$(terraform output -raw alb_url)
echo "   curl $ALB_URL/health"
echo "3. Monitor deployment:"
echo "   aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME"
echo ""
echo "📚 For more information, see terraform/DEPLOYMENT.md"
