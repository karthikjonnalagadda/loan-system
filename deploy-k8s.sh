#!/bin/bash

# Loan System Kubernetes Deployment Script
# Supports: Minikube, EKS, GKE, AKS

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
K8S_DIR="$SCRIPT_DIR/k8s"
NAMESPACE="loan-system"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "docker not found. Please install Docker."
        exit 1
    fi
    
    print_info "Prerequisites check passed!"
}

# Build Docker images
build_images() {
    print_info "Building Docker images..."
    
    docker build -t loan-backend:latest "$SCRIPT_DIR/backend"
    docker build -t loan-frontend:latest "$SCRIPT_DIR/frontend"
    
    print_info "Docker images built successfully!"
}

# Load images to Minikube
load_images_minikube() {
    print_info "Loading images to Minikube..."
    
    eval $(minikube docker-env)
    docker build -t loan-backend:latest "$SCRIPT_DIR/backend"
    docker build -t loan-frontend:latest "$SCRIPT_DIR/frontend"
    
    print_info "Images loaded to Minikube!"
}

# Deploy to Kubernetes
deploy_k8s() {
    print_info "Deploying to Kubernetes..."
    
    # Apply manifests in order
    kubectl apply -f "$K8S_DIR/00-namespace-configmap-secret.yaml"
    print_info "Applied namespace, ConfigMap, and Secrets"
    
    sleep 2
    
    kubectl apply -f "$K8S_DIR/01-mongodb-statefulset.yaml"
    print_info "Applied MongoDB StatefulSet"
    
    sleep 5
    
    kubectl apply -f "$K8S_DIR/02-backend-deployment.yaml"
    print_info "Applied Backend Deployment"
    
    sleep 3
    
    kubectl apply -f "$K8S_DIR/03-frontend-deployment.yaml"
    print_info "Applied Frontend Deployment"
    
    sleep 3
    
    kubectl apply -f "$K8S_DIR/04-ingress.yaml"
    print_info "Applied Ingress"
    
    kubectl apply -f "$K8S_DIR/05-policies.yaml"
    print_info "Applied Policies"
    
    print_info "Deployment complete!"
}

# Wait for deployments
wait_for_deployment() {
    print_info "Waiting for deployments to be ready..."
    
    kubectl -n $NAMESPACE wait --for=condition=available --timeout=300s \
        deployment/loan-backend deployment/loan-frontend
    
    print_info "Deployments are ready!"
}

# Port forward
port_forward() {
    print_info "Setting up port forwarding..."
    print_info "Frontend: http://localhost:3000"
    print_info "Backend: http://localhost:5000"
    print_info ""
    print_warn "Starting port forwarding (Ctrl+C to stop)..."
    
    # Kill any existing port-forward processes
    pkill -f "kubectl.*port-forward" || true
    
    # Start port forwarding in background
    kubectl -n $NAMESPACE port-forward svc/loan-frontend 3000:80 &
    kubectl -n $NAMESPACE port-forward svc/loan-backend 5000:5000 &
    
    wait
}

# Check cluster
check_cluster() {
    print_info "Checking cluster connectivity..."
    
    if kubectl cluster-info &> /dev/null; then
        print_info "Connected to cluster"
        kubectl cluster-info
    else
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
}

# Show deployment status
show_status() {
    print_info "Deployment status:"
    echo ""
    kubectl -n $NAMESPACE get all
    echo ""
    print_info "To view logs:"
    echo "  Backend:  kubectl -n $NAMESPACE logs -f deployment/loan-backend"
    echo "  Frontend: kubectl -n $NAMESPACE logs -f deployment/loan-frontend"
    echo "  MongoDB:  kubectl -n $NAMESPACE logs -f statefulset/mongodb"
}

# Main menu
show_menu() {
    echo ""
    echo "Loan System Kubernetes Deployment"
    echo "===================================="
    echo "1) Check cluster"
    echo "2) Build Docker images"
    echo "3) Load images to Minikube"
    echo "4) Deploy to Kubernetes"
    echo "5) Wait for deployment"
    echo "6) Port forward (access locally)"
    echo "7) Show deployment status"
    echo "8) Full deployment (all steps)"
    echo "9) Exit"
    echo ""
}

# Main
main() {
    check_prerequisites
    
    while true; do
        show_menu
        read -p "Choose an option: " choice
        
        case $choice in
            1) check_cluster ;;
            2) build_images ;;
            3) load_images_minikube ;;
            4) deploy_k8s ;;
            5) wait_for_deployment ;;
            6) port_forward ;;
            7) show_status ;;
            8) 
                load_images_minikube
                deploy_k8s
                wait_for_deployment
                show_status
                ;;
            9) 
                print_info "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                ;;
        esac
    done
}

# Run main
main "$@"
