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

if "%~1"=="" (
  set /p XLSX=Informe o caminho completo da BASE2326ETL.xlsx:
) else (
  set "XLSX=%~1"
)

if not exist "%XLSX%" (
  echo [ERRO] Excel bruto nao encontrado: %XLSX%
  exit /b 1
)

if not "%~2"=="" (
  if not exist "%~2" (
    echo [ERRO] Memoria semantica nao encontrada: %~2
    exit /b 1
  )
)

echo [1/5] Conferindo origem, classificacao fixa e artefato candidato...
if "%~2"=="" (
  "%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\importar_excel.py "%XLSX%"
) else (
  "%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\importar_excel.py "%XLSX%" --semantic-audit "%~2"
)
if errorlevel 1 exit /b 1

echo [2/5] Aplicando artefato local de forma transacional...
if "%~2"=="" (
  "%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\importar_excel.py "%XLSX%" --apply
) else (
  "%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\importar_excel.py "%XLSX%" --semantic-audit "%~2" --apply
)
if errorlevel 1 exit /b 1

echo [3/5] Validando privacidade e minimizacao...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\check_data_privacy.py
if errorlevel 1 exit /b 1

echo [4/5] Validando indicadores e baseline homologado...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B scripts\validate.py
if errorlevel 1 exit /b 1

echo [5/5] Executando testes de regressao e gates semanticos...
"%PYTHON_EXE%" %PYTHON_PREFIX% -B -m unittest discover -s tests -v
if errorlevel 1 exit /b 1

echo.
echo Base derivada preparada e validada localmente.
echo Nenhum git add, commit, push ou deploy foi executado.
echo Revise o diff antes de qualquer versionamento.
endlocal
