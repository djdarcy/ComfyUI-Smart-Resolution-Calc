# One-Off Tests

This directory contains one-time or temporary tests that are **not** distributed with the extension.

## Performance Tests

Performance tests measure the overhead of logging operations to ensure zero impact for normal users.

### Directory Structure

```
tests/one-offs/
├── performance/
│   ├── test_logging_performance.html    # Performance test UI
│   └── LOGGING_PERFORMANCE_ANALYSIS.md  # Documentation
├── run_performance_tests.py              # Copy tests to web/ for testing
└── clean_performance_tests.py            # Remove tests from web/
```

### Running Performance Tests

**Step 1: Copy tests to web/ directory**
```bash
python tests/one-offs/run_performance_tests.py
```

**Step 2: Open test page**
```
http://localhost:8188/extensions/smart-resolution-calc/tests/performance/test_logging_performance.html
```

**Step 3: Run tests and review results**
- Ensure "Current debug state: ❌ DISABLED" is shown
- Click "Run All Tests"
- Check that "Guarded overhead" is < 1%

**Step 4: Clean up**
```bash
python tests/one-offs/clean_performance_tests.py
```

### Why Not Distribute These?

- **Size**: HTML test files are unnecessary bloat for users
- **Security**: No need to expose test code in production
- **Clarity**: Users don't need to see dev tests

The `web/tests/` directory is gitignored and only exists temporarily during testing.

### Test Results (v0.5.3)

**Before optimization:**
- Current overhead: **+112.31%** (7.30ms for 200K operations)
- JSON.stringify and template literals evaluated even with debug OFF

**After optimization:**
- Guarded overhead: **-6.15%** (essentially zero)
- Guards prevent argument evaluation when debug disabled
- Full debug functionality preserved when enabled

### Cross-Platform Support

Python scripts work on Windows, Linux, and macOS without modification.
