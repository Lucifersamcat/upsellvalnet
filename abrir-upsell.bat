@echo off
REM ============================================================
REM  Abrir Upsell ValNet
REM  Asegura que el servidor este corriendo y abre el navegador.
REM ============================================================
cd /d "C:\Users\HP\Desktop\upsell"

REM Si el proceso "upsell" esta detenido lo inicia; si no existe, lo crea.
pm2 start upsell >nul 2>&1
if errorlevel 1 (
  pm2 start server.js --name upsell >nul 2>&1
  pm2 save >nul 2>&1
)

REM Abre la app en el navegador predeterminado.
start "" "http://localhost:4321"
exit
