@echo off
echo ===================================================
echo Starting PU-CMS Development Environment
echo ===================================================

echo.
echo [1/4] Setting up Backend...
cd backend

IF NOT EXIST .env (
    echo Creating .env file from .env.local.example...
    copy .env.local.example .env
)

echo Installing backend dependencies...
call npm install

echo Running database migrations...
call npm run db:migrate

echo Seeding Super Admin (yash@mes.ac.in)...
call npm run seed:super-admin -- yash@mes.ac.in

cd ..

echo.
echo [2/4] Setting up Frontend...
cd frontend
echo Installing frontend dependencies...
call npm install
cd ..

echo.
echo [3/4] Starting Backend Server...
start "PU-CMS Backend" cmd /k "cd backend && npm run dev"

echo.
echo [4/4] Starting Frontend Server...
start "PU-CMS Frontend" cmd /k "cd frontend && npm start"

echo.
echo ===================================================
echo Development environment is starting up!
echo - Backend will be available at http://localhost:4000
echo - Frontend will be available at http://localhost:4200
echo ===================================================
