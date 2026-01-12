@echo off
echo [SYSTEM] Dang tat toan bo Server Tank Online...

:: Tat Node.js (Auth + Game Services)
echo [KILL] Tat Node.js...
taskkill /F /IM node.exe

:: Tat Nginx (Load Balancer)
echo [KILL] Tat Nginx...
taskkill /F /IM nginx.exe

:: Tat CMD windows (Optional - neu muon dong ca cua so)
:: echo [KILL] Dong cac cua so CMD...
:: taskkill /F /IM cmd.exe

echo [SUCCESS] Da tat het Server va Nginx!
pause
