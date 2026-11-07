@echo off
setlocal
title Sorvetes Donda - Configurar impressao automatica
echo.
echo Donda - Impressao sem confirmacao
echo Este configurador cria um atalho separado para o painel da loja.
echo Ele nao modifica seu navegador normal e nao imprime nada agora.
echo.

set "DONDA_PRINT_BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "DONDA_PRINT_BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined DONDA_PRINT_BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "DONDA_PRINT_BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined DONDA_PRINT_BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "DONDA_PRINT_BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined DONDA_PRINT_BROWSER if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "DONDA_PRINT_BROWSER=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined DONDA_PRINT_BROWSER if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "DONDA_PRINT_BROWSER=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined DONDA_PRINT_BROWSER if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" set "DONDA_PRINT_BROWSER=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined DONDA_PRINT_BROWSER (
  echo Instale o Google Chrome neste computador e execute este arquivo novamente.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; try { $printer=Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1; if (-not $printer -or $printer.DriverName -match 'Microsoft Print To PDF|OneNote|XPS|Fax') { Write-Host 'Defina a impressora da loja como padrao nas configuracoes de Impressoras do Windows. Depois execute este arquivo novamente.'; exit 2 }; $profile=Join-Path $env:LOCALAPPDATA 'Sorvetes Donda\Impressao'; $desktop=[Environment]::GetFolderPath('Desktop'); $shortcut=Join-Path $desktop 'Donda - Impressao Automatica.lnk'; $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut($shortcut); $link.TargetPath=$env:DONDA_PRINT_BROWSER; $link.Arguments='--user-data-dir='+[char]34+$profile+[char]34+' --kiosk-printing --no-first-run --no-default-browser-check --app=__DONDA_ADMIN_URL__'; $link.WorkingDirectory=Split-Path -Parent $env:DONDA_PRINT_BROWSER; $link.IconLocation=$env:DONDA_PRINT_BROWSER; $link.Description='Painel Sorvetes Donda com impressao automatica na impressora padrao do Windows'; $link.Save(); Write-Host ('Impressora padrao: '+$printer.Name); Write-Host ('Atalho criado: '+$shortcut) } catch { Write-Host ('Nao foi possivel configurar: '+$_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo.
  echo A configuracao nao foi concluida. Verifique a mensagem acima.
  pause
  exit /b 1
)

echo.
echo 1. Abra o novo atalho Donda - Impressao Automatica na area de trabalho.
echo 2. Entre na conta administrativa. O perfil separado exige login uma vez.
echo 3. Em Configuracoes - Impressao, ative Aceitar e imprimir novos pedidos.
echo 4. Ative Imprimir neste dispositivo e mantenha o painel aberto neste atalho.
echo Os proximos pedidos imprimirao cozinha e cliente, sem pedir confirmacao.
echo Para encerrar, feche a janela do painel. Para desfazer, remova o atalho.
echo.
pause
endlocal
