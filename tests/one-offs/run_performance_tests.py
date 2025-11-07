#!/usr/bin/env python3
"""
Helper script to run performance tests.
Copies test files to web/ directory temporarily so ComfyUI can serve them.

Cross-platform compatible (Windows, Linux, macOS).
"""

import os
import shutil
import sys
from pathlib import Path

def main():
    print("Performance Test Runner")
    print("=======================")
    print()

    # Get paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent
    web_tests_dir = repo_root / "web" / "tests"
    performance_src = script_dir / "performance"

    # Create web/tests directory structure
    print("Creating web/tests directory...")
    web_tests_dir.mkdir(parents=True, exist_ok=True)

    # Copy performance tests
    print("Copying performance tests to web/tests/...")
    performance_dst = web_tests_dir / "performance"

    # Remove destination if it exists, then copy
    if performance_dst.exists():
        shutil.rmtree(performance_dst)

    shutil.copytree(performance_src, performance_dst)

    print()
    print("[SUCCESS] Tests copied to web/tests/")
    print()
    print("Instructions:")
    print("1. Make sure ComfyUI is running")
    print("2. Open: http://localhost:8188/extensions/smart-resolution-calc/tests/performance/test_logging_performance.html")
    print("3. Run tests and review results")
    print("4. When done, run: python tests/one-offs/clean_performance_tests.py")
    print()
    print("Note: web/tests/ is gitignored and won't be committed")
    print()

    return 0

if __name__ == "__main__":
    sys.exit(main())
