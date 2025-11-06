#!/bin/bash
# Test runner for Smart Resolution Calculator
# Uses ComfyUI venv for dependencies (torch, comfy module)

echo "============================================================"
echo "Smart Resolution Calculator - Test Suite"
echo "============================================================"
echo ""

# Try primary venv first, fallback to venv_new
if [ -f "/c/code/ComfyUI_experiment/venv/Scripts/python.exe" ]; then
    echo "Using ComfyUI venv: /c/code/ComfyUI_experiment/venv"
    /c/code/ComfyUI_experiment/venv/Scripts/python.exe tests/test_dimension_source_calculator.py "$@"
elif [ -f "/c/code/ComfyUI_experiment/venv_new/Scripts/python.exe" ]; then
    echo "Using ComfyUI venv_new: /c/code/ComfyUI_experiment/venv_new"
    /c/code/ComfyUI_experiment/venv_new/Scripts/python.exe tests/test_dimension_source_calculator.py "$@"
else
    echo "ERROR: ComfyUI venv not found at:"
    echo "  - /c/code/ComfyUI_experiment/venv"
    echo "  - /c/code/ComfyUI_experiment/venv_new"
    echo ""
    echo "Please ensure ComfyUI is installed with venv."
    exit 1
fi

echo ""
echo "============================================================"
echo "Test run complete"
echo "============================================================"
