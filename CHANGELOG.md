# Changelog

All notable changes to ComfyUI Smart Resolution Calculator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7] - 2025-11-04

### Changed
- **Widget Rename**: "USE IMAGE?" renamed to "USE IMAGE DIMS?" for clarity
  - Updated all code, tooltips, and documentation
  - Makes it clear the toggle controls dimension extraction, not image output usage
- **Aspect Ratio Labels**: Updated dropdown labels to be more quantifiable and platform-specific
  - Replaced subjective flavor text with concrete use cases and standards
  - Examples: "9:16 (Slim Vertical)" → "9:16 (Vert Vids: YT Shorts/TikTok/Reels)", "16:9 (Panorama)" → "16:9 (HD Video/YouTube/TV)", "3:4 (Golden Ratio)" → "3:4 (SD Video Portrait)"
  - Added platform/format context: Instagram, photo print sizes, monitor standards, video platforms
  - Makes aspect ratio selection more intuitive for real-world use cases

### Added
- **SCALE Widget: Double-Click Reset** (Issue #13): Double-click anywhere on SCALE slider to instantly reset to 1.0x
  - Works on both slider track and handle
  - 300ms double-click detection threshold
  - Quality of life improvement for quick reset without precise dragging
  - Logs reset action for debugging

### Fixed
- **SCALE Tooltip Aspect Ratio Bug** (Issue #11): Fixed tooltip showing incorrect base dimensions and aspect ratio
  - **Root cause**: Tooltip only checked `aspect_ratio` dropdown, never `custom_ratio` toggle, `custom_aspect_ratio` field, USE IMAGE DIMS (AR Only) mode, or WIDTH+HEIGHT explicit AR
  - **Now handles all 4 AR sources correctly**:
    1. `custom_ratio` + `custom_aspect_ratio` (checked first)
    2. USE IMAGE DIMS (AR Only) - uses image aspect ratio
    3. WIDTH + HEIGHT (both enabled) - explicit aspect ratio from dimensions
    4. `aspect_ratio` dropdown (fallback)
  - **Displays AR in tooltip**: Shows "(MP, AR)" format on Base line for clarity (e.g., "1.44 MP, 1:1 AR")
  - **Reduces AR to simplest form**: Uses GCD to show 1:1 instead of 1024:1024, matching Python backend behavior
  - **Supports float ratios**: Parses with `parseFloat()` for cinema formats (2.39:1, 1.85:1)
  - **Example fixes**:
    - Custom ratio "5.225:2.25" + HEIGHT 1200 → tooltip shows base ~2790×1200 (was 900×1200) with "5.225:2.25 AR"
    - USE IMAGE DIMS with 1024×1024 image → tooltip shows "1:1 AR" (was "3:4 AR" from dropdown)
    - WIDTH=320 + HEIGHT=640 enabled → tooltip shows "1:2 AR" (was "3:4 AR" from dropdown)

### Technical
- **JavaScript Changes** (`web/smart_resolution_calc.js`):
  - Updated `ScaleWidget.calculatePreview()` to check all aspect ratio sources in priority order
  - Added `aspectW` and `aspectH` to return value for tooltip display
  - Reduces image AR to simplest form using GCD when USE IMAGE DIMS enabled (both AR Only and Exact Dims modes)
  - Reduces WIDTH+HEIGHT explicit AR to simplest form using GCD (e.g., 320:640 → 1:2)
  - Parses `custom_aspect_ratio` with `parseFloat()` to support decimal ratios
  - Falls back to dropdown if custom ratio invalid or not enabled
  - Added debug logging for aspect ratio source selection

## [0.3.5] - 2025-11-04

### Changed
- **Documentation Updates**: Complete documentation for v0.3.x feature set
  - CHANGELOG.md: Documented all transform modes and color picker fixes from v0.3.4
  - README.md: Updated features list with 4 transform modes and IMAGE output details
  - docs/image-input.md: Updated version number
- **Version Bump**: Incremented to v0.3.5 for documentation completion

### Notes
This is a documentation-only release. All functionality was implemented in v0.3.4.

## [0.3.4] - 2025-11-04

### Added
- **Complete Transform Mode Suite**: Four distinct image transformation strategies for IMAGE output (Issue #4)
  - **transform (distort)**: Scale to exact dimensions, ignores aspect ratio (stretch/squash to fit)
  - **transform (crop/pad)**: Pure crop/pad at 1:1 scale, NO scaling applied
  - **transform (scale/crop)**: Scale to cover target maintaining AR, crop excess
  - **transform (scale/pad)**: Scale to fit inside target maintaining AR, pad remainder
- **Smart Mode Selection**: Enhanced "auto" mode defaults to "transform (distort)" when image input detected
- **Enhanced Tooltips**: Clear descriptions for each transform mode explaining behavior and use cases

### Fixed
- **Color Picker Button Positioning**: Fixed duplicate widget insertion causing position drift (from index 9 to 15+)
  - Root cause: `addWidget()` appends to end, then `splice()` re-inserted, creating duplicate references
  - Solution: Remove from auto-inserted position before manual positioning
  - Button now stable at correct index across all connection cycles
- **Color Picker Button Unclickable After Hide/Restore**: Fixed `origType` preservation issue
  - Root cause: `origType` save loop ran before button creation, button never got `type = "custom"` preserved
  - Solution: Moved `origType` save loop after all widget creation
  - Button now immediately clickable and remains clickable through all hide/restore cycles
- **Color Picker Positioning**: Picker now appears at mouse position + 100px offset (with edge detection)
  - Previously appeared at 0,0 or viewport center
  - Smart boundary detection prevents picker going off-screen
- **Widget Value Contamination**: Resolved as side effect of fixing button position drift
  - Values no longer swap between widgets during initial creation

### Technical (Backend)
- **Updated Parameters** (`py/smart_resolution_calc.py`):
  - `output_image_mode`: Expanded from 3 to 6 options (auto, empty, 4 transform modes)
  - Enhanced tooltip documentation for all modes
- **New Methods**:
  - `transform_image_scale_pad()`: Scales to fit inside, pads remainder (lines 606-681)
  - `transform_image_crop_pad()`: Pure crop/pad with NO scaling (lines 683-784)
  - `transform_image_scale_crop()`: Scales to cover, crops excess (lines 786-863)
- **Renamed Method**:
  - `transform_image_crop_pad()` → `transform_image_scale_pad()` (accurate naming)
- **Implementation Details**:
  - All modes maintain input batch size
  - Center alignment for crop/pad operations
  - Exact target dimension output guaranteed
  - Aspect ratio preservation for scale/crop and scale/pad modes
  - Debug logging for transform strategy details

### Transform Mode Examples (1024×1024 → 1885×530)
1. **distort**: Direct scale to 1885×530 (stretched/squashed)
2. **crop/pad**: Keep 1024×530 centered, pad 431px left/right (1:1 original scale)
3. **scale/crop**: Scale to 1885×1885 (cover width), crop 677px top/bottom
4. **scale/pad**: Scale to 530×530 (fit height), pad 677px left/right

### Benefits
- ✅ **Complete Control**: Four strategies cover all common image transformation needs
- ✅ **Aspect Ratio Options**: Preserve AR (scale/crop, scale/pad) or ignore it (distort)
- ✅ **Scaling Options**: Scale (distort, scale/crop, scale/pad) or no scale (crop/pad)
- ✅ **Professional Results**: Center-aligned operations, exact dimension output
- ✅ **Fill Integration**: Padding uses existing fill_type/fill_color system

### Related Issues
- Completes Issue #4 (Add IMAGE output) - Full transform functionality implemented
- Created Issue #9: Future enhancement for chainable transform operations
- Created Issue #10: SCALE widget fine granularity bug (0.01-0.02 step limitation)

### Known Limitations
- Transform modes use bilinear interpolation only (no other upscale methods)
- SCALE widget fine increments (0.01-0.02) difficult to achieve by dragging (Issue #10)
- Widget value corruption bug still present (Issue #8)

## [0.3.3] - 2025-11-02 (Work in Progress - Known Bugs)

### Added
- **DazzleNodes Compatibility**: Dynamic import support for multi-package loading
  - Auto-detects import path depth using import.meta.url
  - Works in standalone mode: `/extensions/smart-resolution-calc/`
  - Works in DazzleNodes mode: `/extensions/DazzleNodes/smart-resolution-calc/`
  - Wrapped extension in async IIFE with Promise-based imports

- **Color Picker Button Widget**: Dedicated button for visual color selection
  - Separate "🎨 Pick Color" button widget (not hybrid text widget)
  - Custom draw shows color preview with contrasting text
  - Updates fill_color text widget when color selected
  - Inserted directly after fill_color widget for logical grouping

### Changed
- **Category**: Changed from "Smart Resolution" to "DazzleNodes" for package grouping

### Known Issues (DO NOT RELEASE)
- ⚠️ Color picker positioning BROKEN - appears in wrong location
- ⚠️ Picker may not appear consistently
- ⚠️ Position calculation based on estimates (80px header + 30px/widget)
- ⚠️ Does not account for actual widget heights or node transformations
- **Next**: Fix positioning algorithm or implement alternative approach

### Technical
- Dynamic import helper: importComfyCore() with path depth calculation
- Color picker button uses fixed positioning with calculated coordinates
- Debug logging via visibilityLogger for click events
- Widget splice insertion maintains logical order

## [0.3.2] - 2025-11-01 (Non-functional release)

### Changed
- **Color Button Widget**: Replaced fill_color text input with button showing color preview
  - Visual color preview as button background
  - Automatic text color inversion for legibility (black text on light colors, white on dark)
  - Single-click to open native browser color picker
  - No focus-fighting issues (resolved text widget conflict from v0.3.1)

### Technical
- Custom button widget with `draw()` method for color preview rendering
- Luminance-based contrast calculation for text color (0.299*R + 0.587*G + 0.114*B formula)
- Direct button callback (no double-click detection needed)
- Hidden color input element for native picker integration

## [0.3.1] - 2025-11-01

### Added
- **Debug Infrastructure**: Separate visibility logger for conditional widget features
  - New debug channel: `SmartResCalc:Visibility`
  - Globally accessible via `window.smartResCalcVisibilityLogger`
  - Cleaned up verbose console.log statements

### Experimental
- **Double-Click Color Picker** (partially working)
  - Detects double-click on fill_color text field
  - Opens native browser color picker
  - Known issue: Immediately dismissed due to text widget focus stealing
  - Will be replaced with button widget in v0.3.2

## [0.3.0] - 2025-11-01

### Added
- **IMAGE Output**: New dedicated IMAGE output for generated/transformed images (separate from preview)
  - Three output modes: auto (smart default), empty (generated image), transformed (resized input)
  - Five fill patterns: black, white, custom_color, noise (Gaussian), random (uniform)
  - Smart defaults: "auto" mode selects transformed (with image input) or empty (without image input)
  - Conditional visibility: output parameters hidden when IMAGE output not connected
  - Breaking change: LATENT output moved from position 5 to 6 (IMAGE now at position 5)

### Technical (Backend)
- **New Parameters** (`py/smart_resolution_calc.py`):
  - `output_image_mode`: ["auto", "empty", "transformed"] with smart defaults
  - `fill_type`: Five pattern options with detailed tooltips
  - `fill_color`: Hex color code support (#RRGGBB format)
- **New Methods**:
  - `create_empty_image()`: Generates images with configurable fill patterns
  - `transform_image()`: Resizes input images using `comfy.utils.common_upscale`
- **Fill Pattern Implementations**:
  - Black: `torch.zeros()` (solid #000000)
  - White: `torch.ones()` (solid #FFFFFF)
  - Custom Color: Hex RGB parsing with validation
  - Noise: Gaussian distribution (`randn() * 0.1 + 0.5`, camera-like)
  - Random: Uniform distribution (`rand()`, TV static-like)
- **Smart Defaults Logic**: "auto" mode selects based on input image presence
  - Input image connected → "transformed" (resize input to calculated dimensions)
  - No input image → "empty" (generate image with fill pattern)
  - User can override by selecting "empty" or "transformed" explicitly

### Technical (Frontend)
- **Conditional Widget Visibility** (`web/smart_resolution_calc.js`):
  - Monitors IMAGE output (position 5) connection state
  - Hides `output_image_mode`, `fill_type`, `fill_color` when output not connected
  - Uses `widget.type = "converted-widget"` pattern for hiding
  - Automatic node resize when widgets shown/hidden
- **Double-Click Color Picker**:
  - Native browser color picker via hidden input element
  - Opens on double-click of fill_color widget
  - Updates widget value on color selection
  - Graceful cancellation handling
- **Enhanced Tooltips**: Multi-line tooltips explaining all parameters and fill pattern differences

### Benefits
- ✅ **Dual Output System**: Preview (unchanged) + dedicated IMAGE output
- ✅ **Flexible Fill Patterns**: Multiple options for generated images
- ✅ **User-Friendly**: Visual color picker, smart defaults, conditional visibility
- ✅ **Backward Compatible**: Preview output unchanged, existing workflows unaffected (except LATENT position)
- ✅ **Performance**: Uses ComfyUI standard upscale function for transforms

### Breaking Changes
- **LATENT Output Position**: Moved from position 5 to 6 (IMAGE now at position 5)
  - Workflows using LATENT output will need reconnection
  - All other outputs remain in same positions

### Known Limitations
- Color picker requires double-click (single click edits text value)
- Transform mode only supports bilinear interpolation currently
- IMAGE output nub is always visible (cannot be hidden, even when not connected)

## [0.2.0-beta]

### Fixed
- **Custom Aspect Ratio Float Parsing**: Fixed bug where custom aspect ratios with decimal values (e.g., "1.85:1", "2.39:1") threw `invalid literal for int()` error
  - Changed parsing from `int()` to `float()` to support cinema-standard ratios
  - Added validation for positive values (rejects negative, zero, or non-numeric input)
  - Graceful fallback to 16:9 with error logging for invalid input
  - Maintains backward compatibility with integer ratios ("16:9" still works)
  - Fulfills tooltip promise: "fractional OK: '1:2.5', '16:9', '1.85:1'"

## [0.2.0-alpha8] - 2025-10-26

### Added
- **Label-Based Tooltip System**: Info icons positioned on widget labels with quick/full tooltips and external documentation
- **Tooltip Manager**: Centralized tooltip lifecycle management with dual-delay timing (quick at 250ms, full at 1250ms)
- **InfoIcon Component**: Reusable info icon with hit detection, hover state, and click-to-docs functionality
- **Composite Widget Support**: ImageModeWidget with toggle + mode selector + tooltip (complex layout)
- **Native Widget Tooltips**: Tooltip support for ComfyUI native widgets (aspect_ratio, divisible_by, custom_aspect_ratio)
- **Shift+Click Documentation**: Quick tooltip on hover, full tooltip after delay, Shift+Click opens external docs (USE IMAGE widget)
- **Performance Optimized**: Hot-path logging removed, efficient hit detection, minimal redraw overhead

### Technical (Frontend)
- **TooltipManager** (`web/smart_resolution_calc.js` lines 183-278):
  - Global singleton pattern for lifecycle management
  - Dual-delay system: quick (250ms), full (1250ms + 750ms fade-in)
  - Reset on mouse leave, Shift+Click handling
  - Clean state management (activeTooltip, quickShown, fullShown)
- **InfoIcon** (`web/smart_resolution_calc.js` lines 280-514):
  - Label-relative positioning (icon at label end)
  - Hit area detection with padding (15px × widgetHeight)
  - Three states: normal, hover (blue #4a7a9a), docs available (cursor:pointer)
  - External docs handling via `window.open(docsUrl)`
- **Tooltip Content** (`web/tooltip_content.js`):
  - Centralized content definitions (quick, full, docsUrl, hoverDelay)
  - Six widgets configured: image_mode, megapixel, divisible_by, custom_aspect_ratio, scale, aspect_ratio
  - Prioritized by user confusion potential (high/medium/low)
- **Native Widget Integration** (`web/smart_resolution_calc.js` lines 2555-2590):
  - `wrapWidgetWithTooltip()` method for native widgets
  - ComfyUI drawWidgets() override to set hit areas after native draw
  - Hit area calculated from label position + label width
  - Tooltip draw/mouse delegated to InfoIcon
- **ImageModeWidget Integration** (lines 1918-2035):
  - Composite widget with InfoIcon positioned at label
  - Toggle + mode selector + tooltip in single widget
  - Hit area set during draw, tooltip handled in mouse method
- **Widget Measurements**:
  - Label width via `ctx.measureText(labelText).width`
  - Icon positioned at label end (labelX + labelWidth)
  - Hit area: 15px left of label start to end of label text
  - Widget height: `LiteGraph.NODE_WIDGET_HEIGHT` (28px standard)

### Tooltip Content Added
1. **USE IMAGE?** (image_mode) - High priority
   - Quick: "Extract dimensions from image. AR Only: ratio | Exact Dims: exact"
   - Full: Explains two modes, asymmetric behavior, snapshot workflow
   - Docs: `/docs/image-input.md` (Shift+Click functional)
2. **MEGAPIXEL** (megapixel) - High priority
   - Quick: "Target resolution in millions of pixels (1MP = 1024×1024)"
   - Full: Explains MP calculation, future features
3. **divisible_by** - High priority
   - Quick: "Ensures dimensions divisible by N for AI model compatibility"
   - Full: Explains why needed, model requirements, recommended values
4. **custom_aspect_ratio** - Medium priority
   - Quick: "Format: W:H (fractional OK: '1:2.5', '16:9', '1.85:1')"
   - Full: Multiple format examples, cinema ratios
5. **SCALE** - Medium priority
   - Quick: "Multiplies base dimensions (applies to image input + manual)"
   - Full: Explains interaction with image modes, asymmetric slider
6. **aspect_ratio** - Low priority
   - Quick: "Aspect ratio for calculations (ignored if both W+H set)"
   - Full: Priority rules, preset vs custom ratios

### Benefits
- ✅ **Self-Documenting UI**: Users discover features via tooltips without reading full docs
- ✅ **Progressive Disclosure**: Quick hint → full explanation → external docs (three levels)
- ✅ **Label Integration**: Icons positioned naturally at widget labels (not separate widgets)
- ✅ **Performance**: Hot-path logging removed (~10 verbose logs), minimal redraw overhead
- ✅ **Extensible**: Easy to add tooltips to new widgets via TOOLTIP_CONTENT
- ✅ **Native Widget Support**: Works with both custom and ComfyUI native widgets

### Documentation
- Updated `docs/image-input.md` to reflect current ImageModeWidget implementation
- Documented composite widget structure (toggle + mode selector)
- Added Shift+Click functionality documentation

### Performance Improvements
- Removed verbose logging from tooltip hot paths (draw/mouse methods that fire every frame)
- Eliminated ~10 debug logs from TooltipManager, ImageModeWidget, CopyImageButton
- Kept one-time event logs (node creation, toggle blocking)

### Known Limitations
- Shift+Click only functional for USE_IMAGE widget (others have `docsUrl: null`)
- Native widget Shift+Click planned for future release (requires ComfyUI framework changes)
- Single-level tooltip nesting (no tooltip-within-tooltip)

## [0.2.0-alpha7] - 2025-10-26

### Added
- **Behavior Pattern System**: Configurable widget interaction modes via `ToggleBehavior` and `ValueBehavior` enums
- **ToggleBehavior Enum**: SYMMETRIC (can toggle both directions freely) / ASYMMETRIC (one direction has constraints)
- **ValueBehavior Enum**: ALWAYS (values always editable) / CONDITIONAL (values only editable when conditions met)
- **Explicit Configuration**: Widget behavior now explicitly configured via constructor config parameter

### Changed
- **DimensionWidget**: Now explicitly configured as `ToggleBehavior.SYMMETRIC` + `ValueBehavior.ALWAYS`
- **ImageModeWidget**: Now explicitly configured as `ToggleBehavior.ASYMMETRIC` + `ValueBehavior.CONDITIONAL`
- **Self-Documenting Code**: Behavior intent obvious from configuration (e.g., `valueBehavior: ValueBehavior.ALWAYS`)

### Technical (Frontend)
- **Behavior Enums** (`web/smart_resolution_calc.js` lines 75-105):
  - `ToggleBehavior`: Controls when toggle can be enabled/disabled
  - `ValueBehavior`: Controls when values can be edited
  - Independent dimensions support all 4 combinations
- **DimensionWidget** (lines 1081-1299):
  - Constructor accepts optional `config` parameter with behavior properties
  - Mouse method checks `valueBehavior` before allowing value editing
  - Defaults preserve alpha6 behavior (SYMMETRIC toggle + ALWAYS values)
- **ImageModeWidget** (lines 1365-1568):
  - Constructor accepts optional `config` parameter with behavior properties
  - Toggle logic wrapped in `toggleBehavior` check (asymmetric by default)
  - Mode selector checks `valueBehavior` (conditional by default)
  - Defaults preserve alpha6 behavior (ASYMMETRIC toggle + CONDITIONAL values)

### Behavior Combinations Supported

All 4 combinations are valid and supported:

1. **Symmetric Toggle + Always Values** (DimensionWidget)
   - Toggle: Can enable/disable freely
   - Values: Always editable regardless of toggle state

2. **Asymmetric Toggle + Conditional Values** (ImageModeWidget)
   - Toggle: Can disable anytime, can only enable when image connected
   - Values: Only editable when toggle ON and image connected

3. **Asymmetric Toggle + Always Values** (Future use case)
   - Toggle: Has constraints (e.g., can't enable without connection)
   - Values: Always editable even when toggle OFF

4. **Symmetric Toggle + Conditional Values** (Future use case)
   - Toggle: Can enable/disable freely
   - Values: Only editable when toggle ON

### Benefits

**User Experience**:
- Behavior is predictable and consistent
- Alpha6 symmetric value editing preserved for DimensionWidget
- ImageModeWidget constraints preserved (can't enable without image)

**Developer Experience**:
- Self-documenting code (intent clear from configuration)
- Future widgets can choose behavior by passing config object
- Pattern established for consistent widget development
- Extensible (can add READONLY or other modes later)

**Terminology**:
- **SYMMETRIC/ASYMMETRIC** (toggles): Reflects bidirectional nature (both directions free vs one constrained)
- **ALWAYS/CONDITIONAL** (values): Reflects editing availability (always editable vs conditionally editable)
- Intuitive terminology matching actual behavior

### Backward Compatibility
- 100% backward compatible with alpha6
- All defaults preserve exact current behavior
- Config parameter optional (defaults handle everything)
- No breaking changes to existing workflows

## [0.2.0-alpha6] - 2025-10-26

### Fixed
- **DimensionWidget Value Editing**: Values can now be edited when MEGAPIXEL, WIDTH, HEIGHT widgets are toggled OFF
- **Symmetric Value Behavior**: Clicking grayed-out dimension values opens edit dialog (previously blocked)
- **Hit Area Registration**: Widget draw() method now sets value edit hit areas even when toggle is OFF

### Behavior Changes
- **Value Editing** (MEGAPIXEL/WIDTH/HEIGHT): Can edit values regardless of toggle state (symmetric behavior)
  - Toggle ON: Click value → edit dialog appears ✅
  - Toggle OFF: Click grayed value → edit dialog appears ✅ (NEW)
- **Button Visibility**: +/- increment/decrement buttons correctly hidden when toggle OFF (unchanged)
  - Toggle ON: +/- buttons visible and functional ✅
  - Toggle OFF: +/- buttons hidden, value still editable ✅

### What This Fixes
**Problem**: In alpha5 and earlier, dimension values couldn't be edited when toggled OFF
- User disables WIDTH, clicks "960" → nothing happens (edit blocked)
- Only workaround: Re-enable WIDTH, edit value, disable WIDTH again
- Asymmetric behavior forced unnecessary toggle state changes

**Solution**: Set hit areas in draw() method when toggle OFF, allow mouse() to handle clicks
- User disables WIDTH, clicks "960" → edit dialog appears ✅
- Value editable regardless of toggle state (symmetric behavior)
- +/- buttons still correctly hidden when toggle OFF

### Technical (Frontend)
- **Draw Method** (`web/smart_resolution_calc.js` lines 1112-1125):
  - Set `hitAreas.valueEdit` when toggle OFF (enables click detection)
  - Clear `hitAreas.valueDec/Inc` when toggle OFF (prevents invisible button clicks)
- **Mouse Method** (`web/smart_resolution_calc.js` lines 1221-1226):
  - Removed `if (this.value.on)` conditional blocking value editing
  - Changed comment from "Only handle if toggle is on" to "symmetric behavior - always editable"

### Known Limitations
- Full behavior pattern system not yet implemented (planned for future release)
- Currently only DimensionWidget has symmetric value editing
- Future: Configurable toggle/value/button behavior modes per widget type

## [0.2.0-alpha5] - 2025-10-25

### Fixed
- **Scale Tooltip AR Only Mode**: Tooltip now correctly respects user's dimension settings when USE_IMAGE in "AR Only" mode
- **Accurate AR-Based Calculation**: Extracts aspect ratio from image and applies to user's WIDTH/HEIGHT/MEGAPIXEL settings
- **Mode-Aware Logic**: Distinguishes between "AR Only" (extract AR, use with settings) and "Exact Dims" (use raw image dimensions)

### Technical (Frontend)
- **Mode Detection**: Check `imageMode` value (0=AR Only, 1=Exact Dims) to determine calculation path
- **AR Extraction**: Compute `imageAR = width / height` from cached image dimensions
- **AR-Based Calculation**: Use extracted AR with user's dimension settings:
  - HEIGHT enabled → compute WIDTH from HEIGHT × AR
  - WIDTH enabled → compute HEIGHT from WIDTH ÷ AR
  - MEGAPIXEL enabled → compute dimensions from MP and AR
  - Both W+H enabled → use as-is (ignore AR)
  - No settings → use raw image dimensions
- **AR Validation**: Check for NaN, infinity, zero before using AR (graceful fallback)
- **Enhanced Logging**: Show mode, extracted AR, and computed dimensions in debug logs

### Behavior Changes
- **AR Only Mode** (imageMode=0): Tooltip shows computed dimensions from image AR + user settings
  - Example: Image 1024×1024 (1:1), HEIGHT=1200 → Base: 1200×1200
  - Previously showed: Base: 1024×1024 (incorrect - ignored user's HEIGHT)
- **Exact Dims Mode** (imageMode=1): Tooltip shows raw image dimensions (unchanged)
  - Example: Image 1024×1024, HEIGHT=1200 → Base: 1024×1024 (correct - ignores HEIGHT)

### What This Fixes
**Problem**: In alpha4, Scale tooltip ignored user's dimension settings in "AR Only" mode
- User sets HEIGHT=1200 with 1024×1024 image
- Expected: Base 1200×1200 (computed from 1:1 AR + HEIGHT)
- Got: Base 1024×1024 (raw image dimensions)

**Solution**: Extract AR from image, apply to user's settings (matches backend logic)
- Now shows: Base 1200×1200 (computed WIDTH from HEIGHT × 1:1 AR)
- Tooltip preview matches actual backend calculation

### Testing Recommendations
Test all combinations of USE_IMAGE modes and dimension settings:
1. AR Only + HEIGHT → should compute WIDTH from AR
2. AR Only + WIDTH → should compute HEIGHT from AR
3. AR Only + MEGAPIXEL → should compute dimensions from AR + MP
4. Exact Dims + HEIGHT → should ignore HEIGHT, use image dimensions
5. Exact Dims + WIDTH → should ignore WIDTH, use image dimensions

## [0.2.0-alpha4] - 2025-10-25

### Fixed
- **Scale Tooltip Image-Aware**: Scale widget tooltip now shows correct base dimensions when USE_IMAGE is enabled
- **Automatic Dimension Fetching**: Tooltip silently fetches actual image dimensions in background using hybrid B+C strategy
- **Accurate Preview**: Users see the true starting dimensions (from image) rather than stale widget values

### Added
- **ImageDimensionUtils Module**: Shared utility functions for image dimension extraction (eliminates code duplication)
- **Dimension Caching**: ScaleWidget caches image dimensions for fast, responsive tooltip preview
- **Auto-Refresh Triggers**: Dimension cache automatically refreshes when image connected/disconnected or USE_IMAGE toggled

### Changed
- **CopyImageButton Refactored**: Now uses shared ImageDimensionUtils instead of duplicating fetch methods
- **Scale Preview Logic**: calculatePreview() checks USE_IMAGE state and uses cached image dimensions when available
- **Graceful Fallback**: If image dimensions unavailable, tooltip falls back to widget-based calculations (existing behavior)

### Technical (Frontend)
- **ImageDimensionUtils**: Three shared methods for dimension extraction:
  - `getImageFilePath()` - Extract path from LoadImage nodes
  - `fetchDimensionsFromServer()` - Server endpoint fetch (Tier 1)
  - `parseDimensionsFromInfo()` - Cached info parsing (Tier 2)
- **ScaleWidget.refreshImageDimensions()**: Async method using hybrid B+C strategy
  - Tier 1: Server endpoint (immediate for LoadImage nodes)
  - Tier 2: Info parsing (cached execution output)
  - Tier 3: Clear cache (fallback to widget values)
- **Dimension Cache Structure**: `{width, height, timestamp, path}` with path-based validation
- **Connection Change Handler**: Triggers dimension refresh on image connect/disconnect
- **Toggle Handler**: Triggers dimension refresh when USE_IMAGE toggled on/off
- **Performance**: Cache prevents redundant fetches, <50ms refresh time

### Benefits
- ✅ **Tooltip Accuracy**: Preview matches actual image dimensions when USE_IMAGE enabled
- ✅ **No User Action**: Dimension fetching happens silently in background
- ✅ **Fast & Responsive**: Cached dimensions keep tooltip snappy (no delays)
- ✅ **Code Reuse**: Shared utilities eliminate duplication between CopyImageButton and ScaleWidget
- ✅ **Robust Fallback**: Multi-tier strategy ensures tooltip always works

### Known Limitations
- Cache only refreshes on connection change or toggle (not on LoadImage widget changes)
- Generated images (not from files) require workflow run before dimensions cached

### Known Issues (Will Fix in Alpha5)
- Asymmetric toggle logic incorrectly applied to dimension widgets (MEGAPIXEL, WIDTH, HEIGHT)
- Should only apply to USE_IMAGE widget, dimension widgets should have symmetric toggle behavior

## [0.2.0-alpha3] - 2025-10-25

### Added
- **Hybrid B+C Copy Button**: Fully functional "Copy from Image" button with three-tier fallback strategy
- **Server Endpoint**: `/smart-resolution/get-dimensions` API for immediate dimension extraction from Load Image nodes
- **UNDO Button**: One-level undo for copy operations (restores previous WIDTH/HEIGHT values and toggle states)
- **USE_IMAGE Disabled State**: Asymmetric toggle logic when image input is disconnected
- **Multi-Level Debug Logging**: Verbose/Debug/Info/Error levels with localStorage control
- **Tier 1 - Server Method**: Reads image file metadata via PIL (works immediately for file-based images)
- **Tier 2 - Info Parsing**: Extracts dimensions from cached execution output (works after first workflow run)
- **Tier 3 - Instructions**: Helpful dialog guiding users through manual workflow

### Changed
- **Toggle State Preservation**: Copy button now preserves user's WIDTH/HEIGHT toggle states (doesn't force ON)
- **Widget Property Naming**: Renamed `disabled` to `imageDisconnected` to avoid LiteGraph framework conflicts

### Fixed
- **Visual Corruption**: Hidden default scale widget no longer renders over USE_IMAGE widget
- **Mouse Event Blocking**: LiteGraph `disabled` property was preventing all mouse events - now uses custom property
- **Server Endpoint**: Now handles filename-only paths (constructs full path in input directory)
- **Widget Type**: CopyImageButton now uses `type = "custom"` for proper mouse event routing
- **Logger Methods**: Added `info()`, `error()`, `verbose()` methods to DebugLogger

### Technical (Backend)
- Added `SmartResolutionCalc.get_image_dimensions_from_path()` static method
- Security validation: Path checking to prevent directory traversal
- Filename detection: Automatically constructs full path from filename when needed
- Allowed directories: ComfyUI input/output/temp folders only
- API endpoint registration in `__init__.py` with aiohttp

### Technical (Frontend)
- `CopyImageButton.copyFromImage()` orchestrates three-tier fallback
- `CopyImageButton.undoCopy()` restores previous dimension values
- `ImageModeWidget.mouse()` implements asymmetric toggle logic (allow OFF, block ON when disconnected)
- `getImageFilePath()` extracts file path from LoadImage nodes
- `fetchDimensionsFromServer()` async server call with error handling
- `parseDimensionsFromInfo()` regex parsing of cached info output
- `populateWidgets()` saves undo state before updating, preserves toggle states
- `showSuccessNotification()` logs success with source indicator
- Dual-button layout: Copy button shrinks when Undo available (3px margin)
- Success logging: `✓ Copied from File: 1920×1080 (16:9)`
- Undo logging: `↶ Undone: Restored WIDTH=512 (ON), HEIGHT=512 (OFF)`

### Coverage
- ✅ **Load Image (file)** - Works immediately via server endpoint
- ✅ **Previous execution** - Works via cached info parsing
- ✅ **Copy undo** - Restores previous values with one-level stack
- ✅ **USE_IMAGE disabled** - Cannot enable without image, can disable anytime
- ⚠️ **Generated images** - Works after first workflow run (info parsing)

### Known Limitations
- Generated images (not from files) require workflow run before copy works
- Server endpoint only supports file-based Load Image nodes currently
- UNDO is one-level only (not multi-level undo stack)
- No visual indication of USE_IMAGE disabled state (blocks clicks only)

## [0.2.0-alpha2] - 2025-10-25

### Changed (from alpha1)
- **ImageModeWidget Styling Fixes**: Added "USE IMAGE?" label, fixed toggle colors
- **Label Display**: Widget now shows "[Toggle] USE IMAGE? [AR Only/Exact Dims]" layout
- **Toggle Color**: Matches dimension widgets (green #4CAF50 when ON, gray #888888 when OFF)
- **Mode Selector**: Fixed width (100px), proper alignment on right side

### Technical
- Updated `ImageModeWidget.draw()` to include label text
- Updated `ImageModeWidget.drawToggle()` to match DimensionWidget style exactly
- Fixed mode selector positioning and hit area detection

### Known Issues
- Copy button still shows placeholder instructions (will fix in alpha3)
- Requires hybrid B+C implementation for immediate copying

## [0.2.0-alpha1] - 2025-10-25

### Added
- **Enable/Disable Toggle**: `enable_image_input` parameter allows turning off image extraction without disconnecting
- **Copy from Image Button**: New button widget for snapshot workflow (extract once, then manually adjust)
- **Parameter Tooltips**: Native ComfyUI tooltips explaining each image input parameter
- **Override Warning**: Info output shows `⚠️ [Manual W/H Ignored]` when Exact Dims mode overrides manual settings
- **Documentation**: Detailed image input guide in `docs/image-input.md`

### Changed
- **Parameter Renamed**: `match_exact_dimensions` → `use_image_dimensions` (clearer reference to image input)
- **Version Phase**: Updated from alpha to beta (UX improvements complete)
- **README Structure**: Simplified README, moved detailed docs to CHANGELOG and `docs/` folder

### Improved
- Image input parameters now clearly reference the image source
- Users can understand which settings are active via override warnings
- Three distinct workflows documented: Live AR, Exact Dims, Snapshot

## [0.2.0-alpha] - 2025-10-25

### Added
- **Image Input Feature**: Optional IMAGE input to extract dimensions from reference images
- **Two Extraction Modes**:
  - AR Only (default): Extract aspect ratio, use with megapixel calculation
  - Exact Dims: Use exact image dimensions with scale applied
- **Visual Indicator**: Node background color changes when image connected
- **Image Source Info**: Info output shows image extraction mode and dimensions

### Technical
- Python: Image dimension extraction from torch tensor `[batch, height, width, channels]`
- JavaScript: Visual connection indicator via `onConnectionsChange` handler
- Backward compatible with v0.1.x workflows

## [0.1.3-alpha] - 2025-10-22

### Fixed
- Various bug fixes and stability improvements

## [0.1.0-alpha] - 2025-10-20

### Added
- Initial release with compact custom widgets
- 5 calculation modes (Width+Height, Width+AR, Height+AR, MP+AR, Default)
- 23 preset aspect ratios (portrait, square, landscape)
- Custom aspect ratio support
- Scale multiplier with asymmetric slider (0.0-10.0x, 1.0x centered)
- Direct latent output
- Visual preview image
- Divisibility control (8/16/32/64)
- Debug logging (Python + JavaScript)
- Workflow persistence

### Technical
- rgthree-style compact widgets with toggle LEFT, value RIGHT
- Widget state serialization for workflow save/load
- ComfyUI Registry publication
