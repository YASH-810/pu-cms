@echo off
echo ==========================================
echo Starting PU CMS Development Environment
echo ==========================================

echo.
echo Installing Backend Dependencies...
cd backend
call npm install

echo.
echo Installing Frontend Dependencies...
cd ../frontend
call npm install

echo.
echo Starting Backend Server (Port 3000)...
cd ../backend
start "PU CMS Backend" cmd /c "npm run dev"

echo.
echo Starting Frontend Server (Port 4200)...
cd ../frontend
start "PU CMS Frontend" cmd /c "npm start"

echo.
echo Both servers have been started in new windows.
echo Frontend will be available at http://localhost:4200
echo Backend will be available at http://localhost:3000
echo.
cd ..
pause
