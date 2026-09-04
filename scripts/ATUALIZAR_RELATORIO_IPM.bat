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
echo [1/6] Conferindo delta, classificacao historica e eventos...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\atualizar_relatorio_ipm.py "%XLSX%" --semantic-audit "%AUDITORIA%"
if errorlevel 1 exit /b 1
echo [2/6] Aplicando artefato local de forma transacional...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\atualizar_relatorio_ipm.py "%XLSX%" --semantic-audit "%AUDITORIA%" --apply
if errorlevel 1 exit /b 1
echo [3/6] Sincronizando a camada privada da MESMA fonte no servidor...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\sincronizar_base_privada.py "%XLSX%"
if errorlevel 1 (
  echo [ERRO] A base publica local foi atualizada, mas a copia privada nao foi sincronizada.
  echo        Nao publique esta versao ate corrigir a sincronizacao privada.
  exit /b 1
)
echo [4/6] Validando privacidade e minimizacao...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\check_data_privacy.py
if errorlevel 1 exit /b 1
echo [5/6] Validando indicadores...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\validate.py
if errorlevel 1 exit /b 1
echo [6/6] Executando testes de regressao...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B -m unittest discover -s tests -v
if errorlevel 1 exit /b 1
echo.
echo Base publica local e camada privada da mesma fonte validadas.
echo Git e deploy ainda NAO foram executados.
exit /b 0

:uso
echo Uso:
echo   %~nx0 "C:\caminho\Relatorio.xlsx" PREPARAR "C:\privado\auditoria.csv"
echo   %~nx0 "C:\caminho\Relatorio.xlsx" CONFERIR "C:\privado\auditoria_preenchida.xlsx"
echo   %~nx0 "C:\caminho\Relatorio.xlsx" APLICAR "C:\privado\auditoria_preenchida.xlsx"
echo.
echo No modo APLICAR, a mesma planilha e sincronizada no armazenamento privado.
echo A senha administrativa e solicitada de forma oculta se SEPLAN_ADMIN_PASSWORD nao estiver definida.
exit /b 2
