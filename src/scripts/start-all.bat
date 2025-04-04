@echo off
echo Starting both servers...

:: Start Python API server
cd "%~dp0\..\python-api"
start cmd /k "echo Starting Python API server... & python3 -m uvicorn main:app --reload --port 8000"

:: Start Next.js frontend
cd "%~dp0\..\.."
start cmd /k "echo Starting Next.js frontend... & yarn dev"

echo Both servers are running. Close the command windows to stop. 