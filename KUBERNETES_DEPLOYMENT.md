# Kubernetes & Docker Deployment Guide

## Overview

This guide covers deploying the Loan System application using Docker and Kubernetes.

## Table of Contents

1. [Local Development with Docker Compose](#local-development)
2. [Building Docker Images](#building-docker-images)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Monitoring & Troubleshooting](#monitoring)

---

## Local Development with Docker Compose {#local-development}

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

### Quick Start

1. **Clone and setup**:
```bash
git clone <repository-url>
cd loan-system
```

2. **Create `.env` file** in project root:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
FLASK_ENV=development
MONGO_ROOT_PASSWORD=mongodb
JWT_SECRET=dev-secret-key-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
REACT_APP_API_URL=http://localhost:5000
```

3. **Build and start services**:
```bash
docker-compose up --build
```

4. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: localhost:27017

### Useful Docker Compose Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run migrations/scripts
docker-compose exec backend python create_admin_mongo.py

# Stop services
docker-compose down

# Remove volumes (careful!)
docker-compose down -v

# Rebuild specific service
docker-compose build --no-cache backend
```

---

## Building Docker Images {#building-docker-images}

### Building Locally

```bash
# Backend
cd backend
docker build -t loan-backend:latest .
docker build -t loan-backend:v1.0.0 .

# Frontend
cd ../frontend
docker build -t loan-frontend:latest .
docker build -t loan-frontend:v1.0.0 .
```

### Registry Setup (e.g., Docker Hub)

```bash
# Tag images
docker tag loan-backend:latest username/loan-backend:latest
docker tag loan-frontend:latest username/loan-frontend:latest

# Push to registry
docker login
docker push username/loan-backend:latest
docker push username/loan-frontend:latest
```

### Image Specifications

**Backend Image**:
- Base: `python:3.13-slim`
- Multi-stage build (builder + final)
- Non-root user: `appuser (uid: 1000)`
- Health check: `/api/auth/health`
- Size: ~200MB

**Frontend Image**:
- Base: `node:18-alpine` (build) → `nginx:alpine` (production)
- Multi-stage build
- Non-root user: `nginx (uid: 101)`
- Includes nginx for routing
- Size: ~30MB

---

## Kubernetes Deployment {#kubernetes-deployment}

### Prerequisites

- Kubernetes cluster 1.20+ (Minikube, EKS, GKE, AKS, etc.)
- `kubectl` configured
- Images available in registry or local Docker daemon (for Minikube)
- Optional: Ingress controller (nginx-ingress, traefik)
- Optional: Cert-manager for HTTPS

### Quick Deployment

1. **Load images into Minikube** (if using Minikube):
```bash
eval $(minikube docker-env)
docker build -t loan-backend:latest ./backend
docker build -t loan-frontend:latest ./frontend
```

2. **Deploy to Kubernetes**:
```bash
# Apply in order
kubectl apply -f k8s/00-namespace-configmap-secret.yaml
kubectl apply -f k8s/01-mongodb-statefulset.yaml
kubectl apply -f k8s/02-backend-deployment.yaml
kubectl apply -f k8s/03-frontend-deployment.yaml
kubectl apply -f k8s/04-ingress.yaml
kubectl apply -f k8s/05-policies.yaml
```

3. **Verify deployment**:
```bash
kubectl -n loan-system get all
kubectl -n loan-system get pods -w
```

4. **Port forward to access locally**:
```bash
# Backend
kubectl -n loan-system port-forward svc/loan-backend 5000:5000

# Frontend
kubectl -n loan-system port-forward svc/loan-frontend 3000:80

# MongoDB
kubectl -n loan-system port-forward svc/mongodb 27017:27017
```

5. **Access application**:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Manifest Files Explained

| File | Purpose |
|------|---------|
| `00-namespace-configmap-secret.yaml` | Namespace, ConfigMaps, Secrets, PersistentVolumes |
| `01-mongodb-statefulset.yaml` | MongoDB database (StatefulSet) |
| `02-backend-deployment.yaml` | Flask backend (Deployment + HPA) |
| `03-frontend-deployment.yaml` | React frontend (Deployment + HPA) |
| `04-ingress.yaml` | Ingress routing + SSL/TLS |
| `05-policies.yaml` | Pod Disruption Budgets + Network Policies |

---

## Environment Configuration {#environment-configuration}

### ConfigMaps

Located in `00-namespace-configmap-secret.yaml`:

```yaml
backend-config:
  FLASK_ENV: "production"
  GOOGLE_REDIRECT_URI: "https://yourdomain.com/..."
  FRONTEND_URL: "https://yourdomain.com"

frontend-config:
  REACT_APP_API_URL: "https://yourdomain.com"
```

**Update for your domain**:
```bash
kubectl -n loan-system edit configmap backend-config
kubectl -n loan-system edit configmap frontend-config
```

### Secrets

Located in `00-namespace-configmap-secret.yaml`:

```yaml
backend-secrets:
  JWT_SECRET: <value>
  MONGO_ROOT_PASSWORD: <value>
  GOOGLE_CLIENT_ID: <value>
  GOOGLE_CLIENT_SECRET: <value>
```

**Update secrets securely**:
```bash
kubectl -n loan-system create secret generic backend-secrets \
  --from-literal=JWT_SECRET='your-secret' \
  --from-literal=MONGO_ROOT_PASSWORD='your-password' \
  --from-literal=GOOGLE_CLIENT_ID='your-id' \
  --from-literal=GOOGLE_CLIENT_SECRET='your-secret' \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Scaling & High Availability {#scaling}

### Horizontal Pod Autoscaling

Both backend and frontend deployments include HPA:

```bash
# View HPA status
kubectl -n loan-system get hpa

# Manual scaling
kubectl -n loan-system scale deployment loan-backend --replicas=3
kubectl -n loan-system scale deployment loan-frontend --replicas=3

# Monitor metrics
kubectl top pods -n loan-system
kubectl top nodes
```

### Replica Configuration

**Backend**:
- Min: 2 replicas
- Max: 5 replicas
- Triggers: CPU > 70% or Memory > 80%

**Frontend**:
- Min: 2 replicas
- Max: 4 replicas
- Triggers: CPU > 80% or Memory > 80%

---

## Monitoring & Troubleshooting {#monitoring}

### Check Pod Status

```bash
# All resources
kubectl -n loan-system get all

# Pod details
kubectl -n loan-system describe pod <pod-name>

# Pod logs
kubectl -n loan-system logs <pod-name>
kubectl -n loan-system logs -f <pod-name>  # Follow
kubectl -n loan-system logs --tail=50 <pod-name>
```

### Database Checks

```bash
# Connect to MongoDB
kubectl -n loan-system exec -it mongodb-0 -- mongosh

# Inside MongoDB:
use loansdb
db.users.find()
db.loan_applications.find()
```

### Service & Network Debugging

```bash
# Check services
kubectl -n loan-system get svc

# DNS test
kubectl -n loan-system run -it --rm debug --image=alpine --restart=Never -- sh
nslookup loan-backend
nslookup mongodb

# Test endpoint
curl http://loan-backend:5000/api/auth/health
```

### Common Issues

**Pod stuck in CrashLoopBackOff**:
```bash
kubectl -n loan-system logs <pod-name> --previous
kubectl -n loan-system describe pod <pod-name>
```

**MongoDB connection fails**:
- Ensure StatefulSet is ready: `kubectl -n loan-system get statefulset mongodb`
- Check secret: `kubectl -n loan-system get secret backend-secrets`
- Verify MONGO_URI environment variable

**Ingress not working**:
```bash
kubectl get ingress -n loan-system
kubectl describe ingress -n loan-system loan-system-ingress
```

### Health Checks

```bash
# Manual health check
kubectl -n loan-system exec <backend-pod> -- curl http://localhost:5000/api/auth/health

# Check probes
kubectl -n loan-system describe pod <pod-name> | grep -A 5 "Liveness\|Readiness"
```

---

## Production Deployment Checklist

- [ ] Update domain in `04-ingress.yaml`
- [ ] Set strong passwords in `00-namespace-configmap-secret.yaml`
- [ ] Configure Google OAuth credentials
- [ ] Set JWT_SECRET to cryptographically secure value
- [ ] Update FRONTEND_URL and REACT_APP_API_URL
- [ ] Install ingress controller on cluster
- [ ] Install cert-manager for HTTPS
- [ ] Configure persistent storage backend (not hostPath)
- [ ] Set resource requests/limits appropriately
- [ ] Enable network policies
- [ ] Setup monitoring (Prometheus, Grafana)
- [ ] Setup logging (ELK, Loki)
- [ ] Enable RBAC
- [ ] Regular database backups

---

## Cleanup

```bash
# Delete all resources
kubectl delete namespace loan-system

# Or delete selectively
kubectl -n loan-system delete deployment --all
kubectl -n loan-system delete service --all
kubectl -n loan-system delete statefulset --all
```

---

## Advanced Topics

### Custom Domain with HTTPS

1. Install cert-manager:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
```

2. Update domain in `04-ingress.yaml`

3. Update email in ClusterIssuer

4. Apply ingress:
```bash
kubectl apply -f k8s/04-ingress.yaml
```

### Private Image Registry

Update image pull policy and add ImagePullSecret in deployments:

```yaml
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: backend
    image: registry.example.com/loan-backend:latest
```

### Database Persistence

Replace `hostPath` in `00-namespace-configmap-secret.yaml` with your cloud provider's storage:

**AWS EBS**:
```yaml
storageClassName: gp2
```

**Azure AzureDisk**:
```yaml
storageClassName: managed-premium
```

**GCP GCE PersistentDisk**:
```yaml
storageClassName: standard
```

---

## Support & Resources

- Kubernetes Docs: https://kubernetes.io/docs
- Docker Docs: https://docs.docker.com
- MongoDB Kubernetes: https://www.mongodb.com/docs/kubernetes-operator/
- Nginx Ingress: https://kubernetes.github.io/ingress-nginx/

---

**Last Updated**: November 27, 2025
