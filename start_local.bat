@echo off
start "Tank Auth Service (Port 5000)" cmd /k "cd services\auth && npm start"
start "Tank Game Service (Port 6000)" cmd /k "cd services\game && npm start"
echo Services started! Open http://localhost:5000 to play.
