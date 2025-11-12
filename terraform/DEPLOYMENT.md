# AWS Deployment Guide

This guide provides instructions for deploying the NestJS application to AWS using Terraform with ECS Fargate, Application Load Balancer, RDS PostgreSQL, and VPC.

## Architecture Overview

The infrastructure consists of:

- **VPC**: Custom VPC with public and private subnets across multiple availability zones
- **ECS Fargate**: Serverless container orchestration for running the application
- **Application Load Balancer**: Distributes traffic across ECS tasks
- **RDS PostgreSQL**: Managed database service (version 16.3)
- **ECR**: Container registry for Docker images
- **CloudWatch**: Logging and monitoring
- **Auto Scaling**: Automatic scaling based on CPU, memory, and request count
- **VPC Endpoints**: Private communication with AWS services (ECR, CloudWatch)
- **Secrets Manager**: Secure storage for database credentials

### Network Architecture

```
Internet
    |
    v
Internet Gateway
    |
    v
Application Load Balancer (Public Subnets)
    |
    v
ECS Tasks (Private Subnets)
    |
    +-> RDS PostgreSQL (Private Subnets)
    |
    v
NAT Gateway -> Internet (for outbound traffic)
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
   ```bash
   aws configure
   ```
3. **Terraform** (>= 1.0) installed
   ```bash
   brew install terraform  # macOS
   ```
4. **Docker** installed for building images
   ```bash
   brew install docker  # macOS
   ```

## Deployment Steps

### 1. Configure Terraform Variables

Copy the example variables file and update with your values:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and update:
- `db_password`: Set a strong database password
- `aws_region`: Your preferred AWS region
- `project_name`: Your project name
- `environment`: dev, staging, or prod

### 2. Configure Terraform Backend (Optional but Recommended)

For production use, configure S3 backend for remote state storage. Uncomment and update in `terraform/main.tf`:

```hcl
backend "s3" {
  bucket         = "your-terraform-state-bucket"
  key            = "loanlight/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "terraform-state-lock"
  encrypt        = true
}
```

Create the S3 bucket and DynamoDB table:

```bash
aws s3 mb s3://your-terraform-state-bucket
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### 3. Initialize Terraform

```bash
cd terraform
terraform init
```

### 4. Review Infrastructure Plan

```bash
terraform plan
```

Review the resources that will be created.

### 5. Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted to confirm. This will create:
- VPC with subnets, NAT gateways, and route tables
- Security groups
- RDS PostgreSQL instance
- ECS cluster
- Application Load Balancer
- IAM roles and policies
- CloudWatch log groups
- ECR repository

**Note**: Initial deployment takes approximately 10-15 minutes, mostly due to RDS instance creation.

### 6. Build and Push Docker Image

After infrastructure is deployed, get the ECR repository URL:

```bash
ECR_URL=$(terraform output -raw ecr_repository_url)
AWS_REGION=$(terraform output -raw aws_region)
```

Authenticate Docker with ECR:

```bash
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL
```

Build and tag the Docker image:

```bash
cd ..
docker build -t loanlight-app .
docker tag loanlight-app:latest $ECR_URL:latest
```

Push the image to ECR:

```bash
docker push $ECR_URL:latest
```

### 7. Run Database Migrations

You can run migrations in two ways:

**Option A: From your local machine**

Set environment variables from Terraform outputs:

```bash
export DB_HOST=$(cd terraform && terraform output -raw rds_address)
export DB_PORT=$(cd terraform && terraform output -raw rds_port)
export DB_NAME=$(cd terraform && terraform output -raw rds_database_name)
export DB_USER=postgres
export DB_PASS=<your-db-password>

npm run migration:run
```

**Option B: Using ECS Exec (after service is running)**

```bash
CLUSTER_NAME=$(cd terraform && terraform output -raw ecs_cluster_name)
SERVICE_NAME=$(cd terraform && terraform output -raw ecs_service_name)
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster $CLUSTER_NAME \
  --task $TASK_ARN \
  --container loanlight-app \
  --interactive \
  --command "npm run migration:run"
```

### 8. Deploy ECS Service

After pushing the image, update the ECS service to deploy:

```bash
cd terraform
terraform apply -target=aws_ecs_service.app
```

Or force a new deployment:

```bash
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
SERVICE_NAME=$(terraform output -raw ecs_service_name)

aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment
```

### 9. Access the Application

Get the Application Load Balancer URL:

```bash
cd terraform
terraform output alb_url
```

Wait a few minutes for the ECS tasks to be healthy, then access the application:

```bash
curl $(terraform output -raw alb_url)/health
```

## Monitoring and Logging

### CloudWatch Logs

View application logs:

```bash
LOG_GROUP=$(cd terraform && terraform output -raw cloudwatch_log_group)
aws logs tail $LOG_GROUP --follow
```

### CloudWatch Alarms

The following alarms are configured:
- **ECS**: CPU/Memory utilization, running task count
- **ALB**: Response time, unhealthy hosts, 5xx errors
- **RDS**: CPU utilization, free storage, connection count

View alarms in the AWS Console or via CLI:

```bash
aws cloudwatch describe-alarms
```

### ECS Service Metrics

Monitor ECS service in AWS Console:
- Navigate to ECS → Clusters → Your Cluster → Services
- View metrics, tasks, and events

## Auto Scaling

Auto scaling is configured based on:
- **CPU Utilization**: Target 70%
- **Memory Utilization**: Target 80%
- **Request Count**: Target 1000 requests per minute per task

Auto scaling range: 1-4 tasks (configurable in `terraform.tfvars`)

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: loanlight-app

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build, tag, and push image to Amazon ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster loanlight-dev-cluster \
            --service loanlight-dev-service \
            --force-new-deployment
```

## Troubleshooting

### ECS Tasks Not Starting

Check task logs:
```bash
aws logs tail /ecs/loanlight-dev --follow
```

Check ECS service events:
```bash
aws ecs describe-services \
  --cluster loanlight-dev-cluster \
  --services loanlight-dev-service
```

### Health Check Failures

Ensure the health check endpoint is accessible:
```bash
# From inside the container
curl http://localhost:3000/health
```

Update health check configuration in `terraform/variables.tf` if needed.

### Database Connection Issues

1. Verify security group rules allow traffic from ECS to RDS
2. Check database endpoint in Secrets Manager
3. Verify database is in available state
4. Check RDS connection limits

## Cleanup

To destroy all resources:

```bash
cd terraform
terraform destroy
```

Type `yes` when prompted. This will:
1. Delete ECS service and tasks
2. Delete ALB and target groups
3. Delete RDS instance (with final snapshot)
4. Delete VPC and networking components
5. Delete CloudWatch logs and alarms
6. Delete IAM roles and policies

**Note**: ECR images and S3 backend state are not automatically deleted.
