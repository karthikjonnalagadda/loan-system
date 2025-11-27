# Docker Build & Test Guide

This guide walks through building Docker images and testing them locally.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- MongoDB running (either locally or in container)

## Step 1: Build Docker Images

### Build Backend Image

```bash
cd backend
docker build -t loan-backend:latest .
docker build -t loan-backend:v1.0.0 .
cd ..
```

**Verify build**:
```bash
docker images | grep loan-backend
```

Expected output:
```
loan-backend              latest      abc123def456   2 minutes ago   200MB
loan-backend              v1.0.0      abc123def456   2 minutes ago   200MB
```

### Build Frontend Image

```bash
cd frontend
docker build -t loan-frontend:latest .
docker build -t loan-frontend:v1.0.0 .
cd ..
```

**Verify build**:
```bash
docker images | grep loan-frontend
```

Expected output:
```
loan-frontend             latest      xyz789uvw012   1 minute ago    30MB
loan-frontend             v1.0.0      xyz789uvw012   1 minute ago    30MB
```

## Step 2: Test with Docker Compose

### Setup

1. **Create `.env` file**:
```bash
cp .env.example .env
```

2. **Edit `.env`** with your settings (keep defaults for local testing):
```env
FLASK_ENV=development
MONGO_ROOT_PASSWORD=mongodb
JWT_SECRET=dev-secret-key
GOOGLE_CLIENT_ID=your-google-id-optional
GOOGLE_CLIENT_SECRET=your-google-secret-optional
```

### Run Full Stack

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d --build
```

### Verify Services are Running

```bash
# List running containers
docker-compose ps

# Expected output:
# NAME              COMMAND                  SERVICE      STATUS
# loan-mongodb      mongod                   mongodb      Up 2 minutes
# loan-backend      python run.py            backend      Up 1 minute
# loan-frontend     nginx -g daemon off      frontend     Up 1 minute
```

### Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **MongoDB**: localhost:27017

### Check Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Last 50 lines
docker-compose logs --tail=50 backend
```

### Test Backend Health

```bash
curl http://localhost:5000/api/auth/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "auth"
}
```

## Step 3: Run Test Suite

### Python Test Suite (Recommended)

```bash
# Install requests if needed
pip install requests

# Run comprehensive tests
python test_workflows.py
```

This tests:
- ✓ Health check endpoint
- ✓ User registration
- ✓ User login
- ✓ ML prediction
- ✓ Loan application submission
- ✓ Retrieve user applications with ML scores
- ✓ Admin access verification
- ✓ Authorization checks

### Windows Batch Test

```bash
test_workflows.bat
```

### Manual Testing

**Test Registration**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPassword123!"
  }'
```

Expected response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "role": "user",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Test User",
    "email": "test@example.com",
    "role": "user",
    "auth_provider": "email",
    "created_at": "2025-11-27T10:30:00"
  }
}
```

**Test ML Prediction**:
```bash
curl -X POST http://localhost:5000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "Age": 35,
    "Income": 60000,
    "LoanAmount": 200000,
    "CreditScore": 650,
    "EmploymentType": "Salaried",
    "MaritalStatus": "Married",
    "location": "Mumbai",
    "gender": "Male"
  }'
```

Expected response:
```json
{
  "predicted_label": 0,
  "default_probability": 0.153
}
```

**Test Loan Application** (requires token):
```bash
BACKEND_URL="http://localhost:5000"
TOKEN="your-token-from-registration"

curl -X POST $BACKEND_URL/api/loan/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "full_name": "John Doe",
    "age": 35,
    "employment_type": "Salaried",
    "monthly_income": 5000,
    "Income": 60000,
    "loan_amount": 200000,
    "loan_purpose": "Home",
    "existing_debts": 50000,
    "credit_history_flag": false,
    "credit_score": 650,
    "marital_status": "Married",
    "location": "Mumbai",
    "gender": "Male"
  }'
```

Expected response:
```json
{
  "msg": "Application submitted",
  "application_id": "507f1f77bcf86cd799439012"
}
```

## Step 4: Test Individual Containers

### Test Backend Container

```bash
# Run backend only
docker run -d \
  --name loan-backend-test \
  -e MONGO_URI="mongodb://root:mongodb@host.docker.internal:27017/loansdb?authSource=admin" \
  -e JWT_SECRET="test-secret" \
  -p 5000:5000 \
  loan-backend:latest

# Check logs
docker logs loan-backend-test

# Test endpoint
curl http://localhost:5000/api/auth/health

# Cleanup
docker stop loan-backend-test
docker rm loan-backend-test
```

### Test Frontend Container

```bash
# Run frontend only
docker run -d \
  --name loan-frontend-test \
  -e REACT_APP_API_URL="http://localhost:5000" \
  -p 3000:80 \
  loan-frontend:latest

# Check logs
docker logs loan-frontend-test

# Test endpoint
curl http://localhost:3000

# Cleanup
docker stop loan-frontend-test
docker rm loan-frontend-test
```

## Step 5: Image Inspection

### Inspect Image Details

```bash
# Backend image details
docker image inspect loan-backend:latest

# Frontend image details
docker image inspect loan-frontend:latest
```

### Check Image Layers

```bash
# Backend layers
docker history loan-backend:latest

# Frontend layers
docker history loan-frontend:latest
```

### Get Image Size

```bash
docker images loan-backend loan-frontend
```

## Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Port already in use: lsof -i :5000
# - MongoDB connection: Check MONGO_URI in .env
# - Dependencies: Check requirements.txt
```

### Database Connection Failed

```bash
# Test MongoDB connection
docker-compose exec mongodb mongosh

# Inside mongosh:
use loansdb
db.users.find()
db.loan_applications.find()
```

### Frontend Can't Connect to Backend

```bash
# Check backend is running
docker-compose logs backend

# Check REACT_APP_API_URL environment variable
docker-compose exec frontend sh
echo $REACT_APP_API_URL

# Test from frontend container
curl http://loan-backend:5000/api/auth/health
```

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5000
kill -9 <PID>
```

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (careful!)
docker-compose down -v

# Remove images
docker rmi loan-backend:latest loan-frontend:latest

# Remove dangling images
docker image prune -f
```

## Performance Metrics

### Image Sizes

Expected sizes:
- Backend: ~200MB (python:3.13-slim base)
- Frontend: ~30MB (nginx:alpine base)

### Startup Times

```bash
docker-compose up
```

Expected startup:
- MongoDB: 3-5 seconds
- Backend: 3-5 seconds
- Frontend: 2-3 seconds
- Total: ~15 seconds

### Memory Usage

```bash
docker stats
```

Expected per container:
- MongoDB: 100-200MB
- Backend: 80-150MB
- Frontend: 20-50MB

## Next Steps

1. ✓ Docker images built and tested locally
2. → Push images to Docker registry
3. → Deploy to Kubernetes cluster
4. → Set up CI/CD pipeline

See [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) for production deployment.
