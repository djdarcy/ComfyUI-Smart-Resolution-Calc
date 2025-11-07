@echo off
REM Test runner for Smart Resolution Calculator
REM Uses ComfyUI venv for dependencies (torch, comfy module)

echo ============================================================
echo Smart Resolution Calculator - Test Suite
echo ============================================================
echo.

REM Try primary venv first, fallback to venv_new
if exist C:\code\ComfyUI_experiment\venv\Scripts\python.exe (
    echo Using ComfyUI venv: C:\code\ComfyUI_experiment\venv
    C:\code\ComfyUI_experiment\venv\Scripts\python.exe tests\test_dimension_source_calculator.py %*
) else if exist C:\code\ComfyUI_experiment\venv_new\Scripts\python.exe (
    echo Using ComfyUI venv_new: C:\code\ComfyUI_experiment\venv_new
    C:\code\ComfyUI_experiment\venv_new\Scripts\python.exe tests\test_dimension_source_calculator.py %*
) else (
    echo ERROR: ComfyUI venv not found at:
    echo   - C:\code\ComfyUI_experiment\venv
    echo   - C:\code\ComfyUI_experiment\venv_new
    echo.
    echo Please ensure ComfyUI is installed with venv.
    exit /b 1
)

echo.
echo ============================================================
echo Test run complete
echo ============================================================
