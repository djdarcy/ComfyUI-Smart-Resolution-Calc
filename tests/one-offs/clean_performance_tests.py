#!/usr/bin/env python3
"""
Clean up performance tests from web/ directory after testing.

Cross-platform compatible (Windows, Linux, macOS).
"""

import shutil
import sys
from pathlib import Path

def main():
    print("Cleaning up performance tests...")

    # Get paths
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent.parent
    web_tests_dir = repo_root / "web" / "tests"

    # Remove web/tests directory if it exists
    if web_tests_dir.exists():
        shutil.rmtree(web_tests_dir)
        print("[SUCCESS] Removed web/tests/ directory")
    else:
        print("[INFO] web/tests/ directory not found (already clean)")

    print()
    print("Done! web/tests/ is now clean and won't be committed.")
    print()

    return 0

if __name__ == "__main__":
    sys.exit(main())
