@echo off
title TANK ONLINE - MASTER LAUNCHER
echo [SYSTEM] Dang khoi dong toan bo he thong (Node.js + Nginx)...

:: 1. Start Auth Service
echo [1/4] Khoi dong Auth Service...
start "Auth Service (5000)" cmd /k "set PORT=5000 && node services/auth/index.js"

:: 2. Start Game Nodes
echo [2/4] Khoi dong Game Nodes (Cluster)...
start "Game Node 1 (6001)" cmd /k "set PORT=6001 && node services/game/index.js"
start "Game Node 2 (6002)" cmd /k "set PORT=6002 && node services/game/index.js"
start "Game Node 3 (6003)" cmd /k "set PORT=6003 && node services/game/index.js"

:: 3. Start Nginx
echo [3/4] Khoi dong Nginx...
cd nginx-1.29.4
start nginx.exe
cd ..

:: 4. Start Ngrok
echo [4/4] Khoi dong Ngrok Public Tunnel...
echo [NGROK] Console: http://localhost:4040
start "Ngrok Tunnel" ngrok.exe http 80

echo.
echo ===================================================
echo   [SUCCESS] HE THONG DA SAN SANG!
echo   Truy cap Web Local: http://localhost
echo   Kiem tra Link Public: http://localhost:4040
echo ===================================================
pause
