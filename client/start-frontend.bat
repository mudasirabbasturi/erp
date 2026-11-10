@echo off
title IMP React Frontend (Port 5173)
cd /d "%~dp0"
echo ========================================================
echo  Starting IMP React Frontend (Vite)
echo  Opening on: http://localhost:5173
echo ========================================================
npm.cmd run dev
pause