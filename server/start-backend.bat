@echo off
title IMP Backend API Server (Port 8000)
cd /d "%~dp0"
echo ========================================================
echo  Starting IMP Pure PHP Backend API Server
echo  Listening on: http://127.0.0.1:8000
echo  Router script: router.php
echo ========================================================
php -S 0.0.0.0:8000 router.php
pause

