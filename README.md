# Favicon Finder — Backend Service

A NestJS backend service to create jobs for fetching favicons from a list of domains asynchronously.  
Uses PostgreSQL for persistence and BullMQ + Redis for background processing.

---

## Setup

### Requirements

- Node.js >= 18  
- PostgreSQL >= 16  
- Redis  
- npm or yarn  

### Installation

```bash
git clone <your-repo-url>
cd favicon-finder

# Install dependencies
npm install

# Configure environment variables
cp .env.template .env
# Adjust DB_USER, DB_PASS, DB_NAME, REDIS_HOST, REDIS_PORT, and SENTRY_DSN

# Run migrations
npm run migration:run

# Start the application
npm run start:dev

-------------------------------------------------
## API Usage
###1. Create Job

### POST /jobs

Request Body (example with 109 domains):

{
  "client_id": "test-123",
  "domains": [
    "google.com","youtube.com","facebook.com","tmall.com","baidu.com","qq.com","sohu.com","taobao.com","yahoo.com","360.cn",
    "jd.com","amazon.com","zoom.us","wikipedia.org","sina.com.cn","weibo.com","live.com","reddit.com","microsoft.com","xinhuanet.com",
    "netflix.com","office.com","okezone.com","vk.com","microsoftonline.com","csdn.net","instagram.com","myshopify.com","alipay.com","yahoo.co.jp",
    "panda.tv","naver.com","zhanqi.tv","twitch.tv","google.com.hk","stackoverflow.com","bing.com","ebay.com","adobe.com","aliexpress.com",
    "amazon.in","apple.com","china.com.cn","amazon.co.jp","tianya.cn","google.co.in","yandex.ru","tribunnews.com","twitter.com","instructure.com",
    "dropbox.com","mail.ru","linkedin.com","sogou.com","msn.com","google.cn","huanqiu.com","1688.com","wordpress.com","ok.ru",
    "aparat.com","amazonaws.com","google.com.br","espn.com","alibaba.com","whatsapp.com","google.de","imdb.com","mama.cn","etsy.com",
    "imgur.com","kompas.com","rakuten.co.jp","cnn.com","detik.com","spotify.com","freepik.com","bbc.com","jrj.com.cn","amazon.co.uk",
    "ettoday.net","flipkart.com","nytimes.com","pixnet.net","udemy.com","aliyun.com","thestartmagazine.com","bilibili.com","okta.com","google.fr",
    "so.com","google.ru","babytree.com","soundcloud.com","grid.id","booking.com","wetransfer.com","padlet.com","canva.com","discord.com",
    "hao123.com","amazon.de","soso.com","google.it","6.cn","cnblogs.com","tumblr.com","github.com","paypal.com"
  ]
}

#### Response:

{
  "job_id": "abc123",
  "status": "processing"
}

### 2. Check Job Status

### GET /jobs/:id

####Response:

{
  "job_id": "abc123",
  "status": "completed",
  "progress": 100,
  "total": 109,
  "completed": 109,
  "failed": 0
}

### 3. Get Job Results (Paginated)

### GET /jobs/:id/results?page=1&per_page=20

####Response:

{
  "results": [
    {"domain": "google.com", "favicon_url": "https://google.com/favicon.ico", "status": "success"},
    {"domain": "youtube.com", "favicon_url": "https://youtube.com/favicon.ico", "status": "success"}
  ],
  "page": 1,
  "per_page": 20,
  "total": 109
}

### 4. Download CSV

### GET /jobs/:id/download

Returns a CSV file containing all job results.

## Schema Overview
### Client
| Column    | Type      | Notes       |
| --------- | --------- | ----------- |
| id        | UUID      | Primary Key |
| clientId  | String    | Unique      |
| createdAt | Timestamp | Auto        |
| updatedAt | Timestamp | Auto        |


### Job
| Column    | Type      | Notes                       |
| --------- | --------- | --------------------------- |
| id        | UUID      | Primary Key                 |
| clientId  | UUID      | Foreign Key → Client.id     |
| status    | Enum      | processing/completed/failed |
| total     | Int       | Number of domains           |
| completed | Int       | Number of finished domains  |
| failed    | Int       | Number of failed domains    |
| createdAt | Timestamp | Auto                        |
| updatedAt | Timestamp | Auto                        |

### Result
| Column     | Type      | Notes                  |
| ---------- | --------- | ---------------------- |
| id         | UUID      | Primary Key            |
| jobId      | UUID      | Foreign Key → Job.id   |
| domain     | String    | Domain name            |
| faviconUrl | String    | Favicon URL            |
| status     | Enum      | success/failed         |
| error      | String    | Optional error message |
| tries      | Int       | Number of attempts     |
| createdAt  | Timestamp | Auto                   |
| updatedAt  | Timestamp | Auto                   |


## Scaling Notes
Concurrency: Use BullMQ workers to process multiple domains in parallel. Configure concurrency per worker based on CPU/memory.

Retries & Error Handling: Use BullMQ retry strategy for transient errors, and log failures for permanent errors.

Result Deduplication: Use PostgreSQL unique constraints or advisory locks to avoid duplicate domain entries.

Horizontal Scaling: Multiple worker instances can connect to the same Redis queue. Job state remains consistent in PostgreSQL.

Monitoring: Integrate metrics Sentry for error tracking.

## AWS Deployment

This application is deployment-ready for AWS using Terraform infrastructure-as-code. The deployment includes:

### Infrastructure Components

- **VPC**: Custom VPC with public and private subnets across multiple availability zones
- **ECS Fargate**: Serverless container orchestration for running the application
  - Auto-scaling based on CPU, memory, and request count (1-4 tasks)
  - Deployment circuit breaker with automatic rollback
  - Container Insights enabled for monitoring
- **Application Load Balancer**: Distributes traffic across ECS tasks
  - Health check endpoint: `/health`
  - CloudWatch alarms for response time and errors
- **RDS PostgreSQL 16.3**: Managed database service
  - Encrypted at rest
  - Automated backups with 7-day retention
  - Multi-AZ support (configurable)
  - CloudWatch alarms for CPU, storage, and connections
- **ECR**: Private container registry for Docker images
- **Secrets Manager**: Secure storage for database credentials
- **CloudWatch**: Centralized logging and monitoring
- **VPC Endpoints**: Private communication with AWS services (ECR, CloudWatch, S3)

### Security Features

- **Network Isolation**: Application runs in private subnets with no direct internet access
- **NAT Gateway**: Secure outbound internet access for private resources
- **Security Groups**: Strict inbound/outbound rules:
  - ALB: Allows HTTP/HTTPS from internet
  - ECS: Only accepts traffic from ALB
  - RDS: Only accepts traffic from ECS tasks
- **IAM Roles**: Least privilege access for ECS tasks
- **Encryption**: Database encryption at rest, Secrets Manager for sensitive data

### Deployment Process

1. **Prerequisites**: AWS CLI, Terraform >= 1.0, Docker
2. **Configure**: Update `terraform/terraform.tfvars` with your settings
3. **Deploy Infrastructure**: Run `terraform apply` to create all AWS resources
4. **Build & Push**: Build Docker image and push to ECR
5. **Run Migrations**: Execute database migrations
6. **Access**: Application available via ALB DNS

For detailed deployment instructions, see `terraform/DEPLOYMENT.md`.

### Monitoring & Observability

- **CloudWatch Logs**: Application logs with 30-day retention
- **CloudWatch Alarms**: Automated alerts for:
  - ECS: CPU/memory utilization, task count
  - ALB: Response time, unhealthy hosts, 5xx errors
  - RDS: CPU, storage, connection count
- **ECS Container Insights**: Detailed container metrics and performance data

For infrastructure code and deployment automation, see the `terraform/` directory.

---

**Note**: For this project deployment, I used [Mau](https://www.mau.nestjs.com/) instead of manually running Terraform. Mau provides an automated deployment platform for NestJS applications that handles the same AWS infrastructure provisioning (ECS, RDS, Load Balancers, VPC, etc.) that the Terraform files would create, but with a simplified deployment experience for this test.