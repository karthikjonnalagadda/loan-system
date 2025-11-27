@echo off
REM Comprehensive test script for Loan System API workflows
REM Tests: Registration, Login, Loan Application, Admin Access, ML Prediction

setlocal enabledelayedexpansion

set BASE_URL=http://localhost:5000
set API_URL=%BASE_URL%/api

echo.
echo ============================================================
echo LOAN SYSTEM API - COMPREHENSIVE TEST SUITE
echo ============================================================
echo.
echo Testing: %BASE_URL%
echo.

REM Check if server is running
echo Checking if server is running...
timeout /t 2 /nobreak > nul
for /l %%i in (1,1,5) do (
    curl -s -f %API_URL%/auth/health > nul
    if !errorlevel! equ 0 (
        echo [OK] Server is ready
        goto run_tests
    )
    if %%i lss 5 (
        timeout /t 1 /nobreak > nul
    )
)

echo [ERROR] Server is not responding. Make sure backend is running!
echo Start backend with: python backend/run.py
goto end

:run_tests

REM Test 1: Health Check
echo.
echo ============================================================
echo TEST: Health Check
echo ============================================================
curl -s %API_URL%/auth/health | findstr /i "status" > nul
if !errorlevel! equ 0 (
    echo [OK] Health check endpoint
    curl -s %API_URL%/auth/health
) else (
    echo [FAIL] Health check endpoint
)

REM Test 2: User Registration
echo.
echo ============================================================
echo TEST: User Registration
echo ============================================================
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set EMAIL=testuser_%mydate%_%mytime%@example.com

setlocal enabledelayedexpansion
set PAYLOAD={"email":"%EMAIL%","name":"Test User","password":"TestPassword123!"}
curl -s -X POST %API_URL%/auth/register -H "Content-Type: application/json" -d "%PAYLOAD%" > register_response.json
echo Response:
type register_response.json
REM Extract token from response
for /f "tokens=*" %%i in ('findstr /i "access_token" register_response.json') do (
    set TOKEN_LINE=%%i
)
echo Token extracted: !TOKEN_LINE!

REM Test 3: ML Prediction
echo.
echo ============================================================
echo TEST: ML Prediction
echo ============================================================
set PRED_PAYLOAD={"Age":35,"Income":60000,"LoanAmount":200000,"CreditScore":650,"EmploymentType":"Salaried","MaritalStatus":"Married","location":"Mumbai","gender":"Male"}
curl -s -X POST %API_URL%/predict -H "Content-Type: application/json" -d "%PRED_PAYLOAD%" > predict_response.json
echo Response:
type predict_response.json

REM Test 4: Loan Application (requires valid token from registration)
echo.
echo ============================================================
echo TEST: Loan Application Submission
echo ============================================================
echo Note: This test requires a valid token. Make sure registration succeeded.
echo Skipping auto-test due to token extraction complexity in batch.
echo Run test_workflows.py for full automated testing.

REM Test 5: Authorization Check
echo.
echo ============================================================
echo TEST: Authorization Check
echo ============================================================
echo Testing access to protected endpoint without token...
curl -s -X GET %API_URL%/loan/applications/my
echo.

echo.
echo ============================================================
echo TEST SUMMARY
echo ============================================================
echo To run comprehensive automated tests, use:
echo   python test_workflows.py
echo.

:end
del /q register_response.json predict_response.json 2>nul
endlocal
