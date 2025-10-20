---
name: Bug report
about: Create a report to help improve Smart Resolution Calculator
title: "[BUG] "
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1.
2.
3.

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS:
- ComfyUI Version:
- Node Version: **REQUIRED** - See instructions below
- Other Custom Nodes: (if applicable)

**Version Information**

Always include the full version string for accurate bug diagnosis.

**Get Your Version** (choose one method):

**Method 1: Python Console**
```python
# In ComfyUI console or Python
import sys
sys.path.append('ComfyUI/custom_nodes/ComfyUI-Smart-Resolution-Calc')
from version import __version__
print(__version__)
# Example output: 0.1.0-alpha_main_10-20251020-88bd441
```

**Method 2: Check version.py**
Open `ComfyUI/custom_nodes/ComfyUI-Smart-Resolution-Calc/version.py` and look for `__version__`

**Method 3: Git Command**
```bash
cd ComfyUI/custom_nodes/ComfyUI-Smart-Resolution-Calc
git log -1 --pretty=format:"%H %s"
```

**Version Format**: `VERSION_BRANCH_BUILD-YYYYMMDD-COMMITHASH`

Example: `0.1.0-alpha_main_10-20251020-88bd441`

Components:
- **Base**: `0.1.0-alpha` (semantic version with phase)
- **Branch**: `main` (git branch name)
- **Build**: `10` (commit count)
- **Date**: `20251020` (YYYYMMDD format)
- **Commit**: `88bd441` (short commit hash)

**Additional context**
If the issue involves a specific workflow, please attach the workflow JSON.
Add any other context about the problem here.
