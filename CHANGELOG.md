# Changelog

All notable changes to ComfyUI Smart Resolution Calculator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased - 0.2.0-beta]

### Planned
- Info icon tooltip system for advanced features
- Additional testing and polish

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
