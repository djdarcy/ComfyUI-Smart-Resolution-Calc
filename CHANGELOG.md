# Changelog

All notable changes to ComfyUI Smart Resolution Calculator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased - 0.2.0-beta]

### Planned
- Hybrid B+C copy button implementation (server endpoint + info parsing)
- Info icon tooltip system for advanced features

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
