# Loan Management System

A modern, full-stack loan management and prediction system built with Flask, React, MongoDB, and XGBoost.

## Features

- **User Authentication**: Email/password and Google OAuth2
- **Loan Applications**: Submit and manage loan applications
- **ML Prediction**: Real-time loan default risk prediction using XGBoost
- **Admin Dashboard**: Manage applications and make approval decisions
- **Responsive UI**: Modern React frontend with intuitive design
- **Containerized**: Full Docker and Kubernetes support

## Tech Stack

- **Backend**: Flask, Flask-JWT-Extended, PyMongo
- **Frontend**: React, Axios
- **Database**: MongoDB
- **ML**: XGBoost, Scikit-learn, Imbalanced-learn
- **Deployment**: Docker, Kubernetes, Nginx

## Quick Start

### Local Development (with Docker Compose)

1. **Setup environment**:
```bash
cp .env.example .env
```

2. **Edit `.env`** with your configuration (Google OAuth credentials, etc.)

3. **Start services**:
```bash
docker-compose up --build
```

4. **Access application**:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- MongoDB: localhost:27017

### Traditional Setup (without Docker)

**Backend**:
```bash
cd backend
pip install -r requirements.txt
python run.py
```

**Frontend**:
```bash
cd frontend/client
npm install
npm start
```

**Database**:
```bash
# Install MongoDB and start it
mongod
```

## Project Structure

```
loan-system/
├── backend/                    # Flask API
│   ├── app/
│   │   ├── __init__.py        # App factory
│   │   ├── auth.py            # Authentication routes
│   │   ├── loan.py            # Loan application routes
│   │   ├── admin.py           # Admin routes
│   │   ├── predict.py         # ML prediction routes
│   │   ├── ml.py              # ML model logic
│   │   └── models.py          # Data models
│   ├── models/                # Trained ML models
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
│
├── frontend/                   # React App
│   ├── client/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── pages/         # Page components
│   │   │   ├── components/    # Reusable components
│   │   │   ├── auth/          # Auth context
│   │   │   ├── api/           # API wrapper
│   │   │   └── App.js
│   │   ├── package.json
│   │   └── Dockerfile
│   └── nginx.conf
│
├── k8s/                        # Kubernetes manifests
│   ├── 00-namespace-configmap-secret.yaml
│   ├── 01-mongodb-statefulset.yaml
│   ├── 02-backend-deployment.yaml
│   ├── 03-frontend-deployment.yaml
│   ├── 04-ingress.yaml
│   └── 05-policies.yaml
│
├── docker-compose.yml
├── deploy-k8s.sh              # Kubernetes deployment script
├── deploy-k8s.bat             # Kubernetes deployment (Windows)
└── KUBERNETES_DEPLOYMENT.md   # Detailed K8s guide
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/google/url` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback

### Loan Applications
- `POST /api/loan/applications` - Submit application
- `GET /api/loan/applications/my` - Get user's applications

### ML Prediction
- `POST /api/predict` - Get default risk prediction

### Admin
- `GET /api/admin/loan/applications` - List all applications
- `PATCH /api/admin/loan/applications/<id>/decision` - Update application status

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `REACT_APP_API_URL` - Backend API URL for frontend

## Docker Deployment

### Build Images

```bash
# Backend
docker build -t loan-backend:latest ./backend

# Frontend
docker build -t loan-frontend:latest ./frontend
```

### Docker Compose

```bash
docker-compose up --build
docker-compose logs -f
docker-compose down
```

## Kubernetes Deployment

For detailed Kubernetes setup and deployment instructions, see [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md).

### Quick Start with Minikube

```bash
# On Windows
.\deploy-k8s.bat

# On Mac/Linux
chmod +x deploy-k8s.sh
./deploy-k8s.sh
```

### Manual Deployment

```bash
# Create images
docker build -t loan-backend:latest ./backend
docker build -t loan-frontend:latest ./frontend

# Load to Minikube
eval $(minikube docker-env)
docker build -t loan-backend:latest ./backend
docker build -t loan-frontend:latest ./frontend

# Deploy
kubectl apply -f k8s/
```

## Database Setup

### MongoDB Initial Setup

```bash
# Create admin user (run this once)
python backend/create_admin_mongo.py
```

### Credentials

```
Admin User:
- Email: admin@example.com
- Password: admin123
- Role: admin
```

## ML Model

The system uses a trained XGBoost model for loan default prediction.

**Model Input Features**:
- Age, Income, Loan Amount
- Credit Score, Employment Type
- Marital Status, Location, Gender
- And other financial indicators

**Model Output**:
- Default probability (0-1)
- Risk label (0=Low Risk, 1=High Risk)

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend/client
npm test
```

### Code Style

```bash
# Backend
flake8 app/
black app/

# Frontend
npm run lint
```

## Troubleshooting

### ML Scores Not Showing

1. Check backend logs: `docker-compose logs backend`
2. Verify model file exists: `ls backend/models/`
3. Check feature defaults: `cat backend/models/feature_defaults.json`

### CORS Errors

- Ensure backend is running
- Check REACT_APP_API_URL environment variable
- Verify CORS is enabled in Flask app

### Database Connection Failed

- Check MongoDB is running
- Verify MONGO_URI in .env
- Check credentials and authentication

## Performance

- Frontend: Optimized React bundle (~100KB gzipped)
- Backend: FastAPI-like response times
- Database: Indexed queries
- ML: ~50ms prediction latency

## Security

- JWT-based authentication
- HTTPS support via Ingress
- Password hashing with werkzeug
- CORS properly configured
- Non-root Docker containers
- Network policies in Kubernetes

## Monitoring

### Logs

```bash
# Docker Compose
docker-compose logs -f <service>

# Kubernetes
kubectl -n loan-system logs -f deployment/<name>
```

### Health Checks

```bash
curl http://localhost:5000/api/auth/health
```

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check KUBERNETES_DEPLOYMENT.md for deployment help
2. Review error logs
3. Open GitHub issue

---

**Last Updated**: November 27, 2025
