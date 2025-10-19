# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project**: C:/code/smart-resolution-calc-repo
**Description**: Smart Resolution Calculator for ComfyUI - Flexible resolution and latent generation with toggle-based dimension inputs, automatic calculation of missing values, and rgthree-style compact widgets. Primary use case: specify aspect ratio + height to auto-calculate width for precise image generation.
**Language**: python
**Created**: 2025-10-19

## Common Development Commands

```bash
# Run tests
pytest

# Lint/Format code  
black . && flake8

# Build/Run
python setup.py build
```

## Test Development Guidelines

### Test Script Management
- **One-off test scripts**: Store in `tests/one-offs/` directory
- **Test runs**: Always use `test_runs/` directory (not test-runs)
- **Keep test artifacts**: Don't delete one-off scripts - they may be useful later

Example:
```bash
# Create test script
mkdir -p tests/one-offs
vim tests/one-offs/test_feature.py

# Run tests that create artifacts
cd test_runs  # Standardized location
python test_feature.py
```

## Architecture Notes

<!-- Add your project-specific architecture notes here -->

## Private Branch Guidelines

### Documentation Requirements

- **ALWAYS** document all work performed in timestamped files under `./private/claude/`
- Use filename format: `YYYY_MM_DD__HH_MM_SS__(TOPIC).md`
- Include all commands executed, their outputs, and summaries

### Version Control Practices

- The `private` branch is LOCAL ONLY - never push to remote repositories
- Commit frequently to track all changes and edits
- Make minimal edits to preserve diff readability:
  - Avoid unnecessary variable/function/class name changes
  - Only rename when truly warranted for clarity or correctness
  - Preserve existing code structure when possible

### Private Content Structure

```
private/
├── claude/         # All Claude-assisted work documentation
│   ├── instructions/   # Core workflow instructions
│   └── YYYY_MM_DD__HH_MM_SS__(TOPIC).md
├── convos/         # Conversation logs (protected from commits)
└── logs/           # System logs (protected from commits)
```

## The Dev Workflow Process

When tackling complex problems or making significant decisions, use **THE PROCESS** - a 5-stage systematic approach:

### 🔁 The 5 Stages:

1. **Problem Analysis** - Define and understand the full context
2. **Conceptual Exploration** - Explore the nature and relationships  
3. **Brainstorming Solutions** - Generate and evaluate multiple approaches
4. **Synthesis and Recommendation** - Combine best elements into optimal solution
5. **Implementation Plan** - Create actionable roadmap

**When to use**: For any complex problem, design decision, bug investigation, or strategic choice.

## Additional Instructions

Detailed workflow instructions are available in `./private/claude/instructions/`:
- Context rebuilding between sessions
- The full Dev Workflow Process
- Creating conversation summaries

## Project-Specific Notes

<!-- Add any project-specific guidelines, patterns, or warnings here -->