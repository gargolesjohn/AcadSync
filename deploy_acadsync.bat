@echo off
echo =======================================================
echo        AcadSync Production Deployment Build
echo =======================================================
echo.

echo [1/3] Installing backend dependencies...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (echo [ERROR] Backend dependency install failed! & pause & exit /b 1)
cd ..

echo.
echo [2/3] Building frontend for production...
cd frontend
call npm install
if %errorlevel% neq 0 (echo [ERROR] Frontend dependency install failed! & pause & exit /b 1)
call npm run build
if %errorlevel% neq 0 (echo [ERROR] Frontend build failed! & pause & exit /b 1)
cd ..

echo.
echo [3/3] Starting production server...
echo The backend will serve both API and frontend on port 8000.
echo.
echo =======================================================
echo   AcadSync is running at: http://localhost:8000
echo   API Documentation at:   http://localhost:8000/docs
echo =======================================================
echo.

cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
