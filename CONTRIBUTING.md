# Contributing to Smart Resolution Calculator

Thank you for considering contributing to Smart Resolution Calculator!

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct.
By participating in this project you agree to abide by its terms.

## How Can I Contribute?

### Reporting Bugs

Use the Bug Report issue template to report issues. Please include:
- Your ComfyUI version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or workflow JSON if applicable

### Suggesting Enhancements

Use the Feature Request issue template to suggest new features or improvements.

### Pull Requests

Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Test your changes in ComfyUI (see Testing section below)
5. Submit a pull request

## Testing ComfyUI Nodes

This is a ComfyUI custom node. To test your changes:

1. Copy your modified version to `ComfyUI/custom_nodes/smart-resolution-calc/`
2. Restart ComfyUI or use "Manager > Refresh Node Definitions"
3. Test the node in a workflow
4. Enable debug mode to verify widget data flow:
   - Python: Set environment variable `COMFY_DEBUG_SMART_RES_CALC=true`
   - JavaScript: Run `localStorage.setItem('DEBUG_SMART_RES_CALC', 'true')` in browser console

See README.md for full debug mode documentation.

## Development Setup

This node requires ComfyUI to run. Dependencies (PyTorch, PIL, numpy) are provided by ComfyUI.

Optional development tools (for code quality):
```bash
pip install black flake8 mypy  # Code formatting and linting
```

### VSCode Debugging

To use the "ComfyUI: Debug This Node" configuration:

1. Set the `COMFYUI_PATH` environment variable to your ComfyUI installation:
   - **Windows**: `setx COMFYUI_PATH "C:\path\to\ComfyUI"`
   - **Linux/Mac**: Add `export COMFYUI_PATH="/path/to/ComfyUI"` to `~/.bashrc` or `~/.zshrc`

2. Restart VSCode to pick up the environment variable

3. Set breakpoints in your node code (`py/smart_resolution_calc.py` or `web/smart_resolution_calc.js`)

4. Press F5 and select "ComfyUI: Debug This Node"

5. ComfyUI will launch with debug logging enabled, and your breakpoints will be hit when the node executes

## Code Style

- Follow PEP 8 for Python code
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and small
