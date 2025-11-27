@echo off
REM Loan System Kubernetes Deployment Script for Windows

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set K8S_DIR=%SCRIPT_DIR%k8s
set NAMESPACE=loan-system

:menu
cls
echo Loan System Kubernetes Deployment
echo ====================================
echo 1) Check cluster
echo 2) Build Docker images
echo 3) Load images to Minikube
echo 4) Deploy to Kubernetes
echo 5) Wait for deployment
echo 6) Port forward (access locally^)
echo 7) Show deployment status
echo 8) View backend logs
echo 9) View frontend logs
echo 10) Full deployment (all steps^)
echo 11) Cleanup (delete namespace^)
echo 12) Exit
echo.

set /p choice=Choose an option: 

if "%choice%"=="1" goto check_cluster
if "%choice%"=="2" goto build_images
if "%choice%"=="3" goto load_minikube
if "%choice%"=="4" goto deploy_k8s
if "%choice%"=="5" goto wait_deployment
if "%choice%"=="6" goto port_forward
if "%choice%"=="7" goto show_status
if "%choice%"=="8" goto logs_backend
if "%choice%"=="9" goto logs_frontend
if "%choice%"=="10" goto full_deploy
if "%choice%"=="11" goto cleanup
if "%choice%"=="12" goto end

echo Invalid option
timeout /t 2
goto menu

:check_cluster
echo Checking cluster connectivity...
kubectl cluster-info
pause
goto menu

:build_images
echo Building Docker images...
docker build -t loan-backend:latest "%SCRIPT_DIR%backend"
docker build -t loan-frontend:latest "%SCRIPT_DIR%frontend"
echo Done!
pause
goto menu

:load_minikube
echo Loading images to Minikube...
@for /f "tokens=*" %%i in ('minikube docker-env --shell cmd') do @%%i
docker build -t loan-backend:latest "%SCRIPT_DIR%backend"
docker build -t loan-frontend:latest "%SCRIPT_DIR%frontend"
echo Done!
pause
goto menu

:deploy_k8s
echo Deploying to Kubernetes...
kubectl apply -f "%K8S_DIR%\00-namespace-configmap-secret.yaml"
timeout /t 2
kubectl apply -f "%K8S_DIR%\01-mongodb-statefulset.yaml"
timeout /t 5
kubectl apply -f "%K8S_DIR%\02-backend-deployment.yaml"
timeout /t 3
kubectl apply -f "%K8S_DIR%\03-frontend-deployment.yaml"
timeout /t 3
kubectl apply -f "%K8S_DIR%\04-ingress.yaml"
kubectl apply -f "%K8S_DIR%\05-policies.yaml"
echo Deployment complete!
pause
goto menu

:wait_deployment
echo Waiting for deployments to be ready...
kubectl -n %NAMESPACE% wait --for=condition=available --timeout=300s ^
    deployment/loan-backend deployment/loan-frontend
echo Deployments are ready!
pause
goto menu

:port_forward
echo Setting up port forwarding...
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000
echo.
echo Press Ctrl+C to stop port forwarding
kubectl -n %NAMESPACE% port-forward svc/loan-frontend 3000:80
pause
goto menu

:show_status
echo Deployment status:
echo.
kubectl -n %NAMESPACE% get all
echo.
echo To view logs:
echo   Backend:  kubectl -n %NAMESPACE% logs -f deployment/loan-backend
echo   Frontend: kubectl -n %NAMESPACE% logs -f deployment/loan-frontend
echo   MongoDB:  kubectl -n %NAMESPACE% logs -f statefulset/mongodb
pause
goto menu

:logs_backend
kubectl -n %NAMESPACE% logs -f deployment/loan-backend
goto menu

:logs_frontend
kubectl -n %NAMESPACE% logs -f deployment/loan-frontend
goto menu

:full_deploy
echo Performing full deployment...
call :load_minikube
call :deploy_k8s
call :wait_deployment
call :show_status
pause
goto menu

:cleanup
echo WARNING: This will delete the entire loan-system namespace!
set /p confirm=Are you sure? (yes/no): 
if /i "%confirm%"=="yes" (
    kubectl delete namespace %NAMESPACE%
    echo Cleanup complete!
) else (
    echo Cleanup cancelled
)
pause
goto menu

:end
echo Goodbye!
exit /b
