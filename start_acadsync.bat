@echo off
echo =======================================================
echo          Starting AcadSync Full-Stack System
echo             Development Mode (Hot Reload)
echo =======================================================
echo.

echo [1/2] Starting Backend Server (FastAPI on Port 8000)...
cd backend
start "AcadSync Backend" cmd /k "python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0"
cd ..

echo [2/2] Starting Frontend Server (Vite/React on Port 5173)...
cd frontend
start "AcadSync Frontend" cmd /k "npm.cmd run dev -- --host 0.0.0.0"
cd ..

echo.
echo =======================================================
echo Both servers have been launched in new terminal windows!
echo - Backend API Docs: http://localhost:8000/docs
echo - Frontend Web App: http://localhost:5173
echo =======================================================
echo You can close this window.
pause
