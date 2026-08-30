@echo off
setlocal
cd /d "%~dp0\.."

set "PYTHON_EXE="
set "PYTHON_PREFIX="
if exist "%LocalAppData%\Programs\Python\Launcher\py.exe" (
  set "PYTHON_EXE=%LocalAppData%\Programs\Python\Launcher\py.exe"
  set "PYTHON_PREFIX=-3"
) else (
  where python.exe >nul 2>&1
  if not errorlevel 1 set "PYTHON_EXE=python.exe"
)
if not defined PYTHON_EXE (
  echo [ERRO] Python nao encontrado. Instale Python 3 ou ajuste o PATH.
  exit /b 1
)

if "%~3"=="" goto :uso
set "XLSX=%~1"
set "MODO=%~2"
set "AUDITORIA=%~3"

if not exist "%XLSX%" (
  echo [ERRO] Relatorio IPM nao encontrado: %XLSX%
  exit /b 1
)

if /I "%MODO%"=="PREPARAR" goto :preparar
if /I "%MODO%"=="CONFERIR" goto :conferir
if /I "%MODO%"=="APLICAR" goto :aplicar
goto :uso

:preparar
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\atualizar_relatorio_ipm.py "%XLSX%" --prepare-audit "%AUDITORIA%"
exit /b %errorlevel%

:conferir
if not exist "%AUDITORIA%" (
  echo [ERRO] Auditoria preenchida nao encontrada: %AUDITORIA%
  exit /b 1
)
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\atualizar_relatorio_ipm.py "%XLSX%" --semantic-audit "%AUDITORIA%"
exit /b %errorlevel%

:aplicar
if not exist "%AUDITORIA%" (
  echo [ERRO] Auditoria preenchida nao encontrada: %AUDITORIA%
  exit /b 1
)
echo [1/5] Conferindo delta, classificacao historica e eventos...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\atualizar_relatorio_ipm.py "%XLSX%" --semantic-audit "%AUDITORIA%"
if errorlevel 1 exit /b 1
echo [2/5] Aplicando artefato local de forma transacional...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\atualizar_relatorio_ipm.py "%XLSX%" --semantic-audit "%AUDITORIA%" --apply
if errorlevel 1 exit /b 1
echo [3/5] Validando privacidade e minimizacao...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\check_data_privacy.py
if errorlevel 1 exit /b 1
echo [4/5] Validando indicadores...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\validate.py
if errorlevel 1 exit /b 1
echo [5/5] Executando testes de regressao...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B -m unittest discover -s tests -v
if errorlevel 1 exit /b 1
echo.
echo Base derivada validada localmente. Git e deploy NAO foram executados.
exit /b 0

:uso
echo Uso:
echo   %~nx0 "C:\caminho\Relatorio.xlsx" PREPARAR "C:\privado\auditoria.csv"
echo   %~nx0 "C:\caminho\Relatorio.xlsx" CONFERIR "C:\privado\auditoria_preenchida.xlsx"
echo   %~nx0 "C:\caminho\Relatorio.xlsx" APLICAR "C:\privado\auditoria_preenchida.xlsx"
exit /b 2
