# Image Input Guide

**Version**: 0.3.5
**Feature**: Extract dimensions directly from reference images

## Overview

The image input feature allows you to connect images to the Smart Resolution Calculator and automatically extract their dimensions or aspect ratio. This eliminates manual dimension entry and ensures accurate calculations based on your reference images.

## Quick Start

1. Connect an IMAGE output to the `image` input on Smart Resolution Calculator
2. Toggle **USE IMAGE?** to ON (enabled by default when image connected)
3. Choose extraction mode:
   - **AR Only**: Extracts aspect ratio, combines with megapixel setting
   - **Exact Dims**: Uses exact image dimensions with scale applied
4. Check the **info** output to verify extraction mode

## Parameters

### USE IMAGE?

**Type**: Composite widget (toggle + mode selector)

**Default**: ON with "AR Only" mode

**Purpose**: Control image dimension extraction and mode

**Widget Components**:
1. **Toggle** (left side): Turn image extraction ON/OFF
2. **Mode Selector** (right side): Choose "AR Only" or "Exact Dims"

**Behavior**:
- **Image Disconnected**: Can turn OFF but cannot turn ON (asymmetric behavior)
- **Image Connected**: Full control of toggle and mode selector
- Mode selector only active when toggle is ON and image is connected

**AR Only Mode**:
- Extracts aspect ratio from image
- Combines with your MEGAPIXEL, WIDTH, or HEIGHT settings
- Allows resolution scaling while maintaining image proportions
- Best for: Flexible resolution matching with adjustable megapixels

**Exact Dims Mode**:
- Uses exact image dimensions
- Applies SCALE multiplier if not 1.0x
- Overrides manual WIDTH/HEIGHT settings (shows warning in info output)
- Best for: Precise dimension matching, upscaling workflows

**Tooltip**:
- *Hover over "USE IMAGE?" label for quick help*
- *Shift+Click label for full documentation (opens this page)*

## Visual Indicators

### Node Background Color
- **Connected**: Subtle blue tint (#1a2a3a background, #4a7a9a border)
- **Disconnected**: Default gray background
- **Purpose**: Quick visual confirmation of image connection status

### Info Output
Shows extraction mode and dimensions:

**AR Only Mode**:
```
From Image (AR: 16:9) | Mode: Megapixels + Aspect Ratio | Calculated W: 1216 × H: 688 | MP: 1.00 | Div: 8
```

**Exact Dims Mode**:
```
From Image (Exact: 1920×1080) | Mode: Width + Height | Calculated MP: 2.07 | Div: 8
```

**With Override Warning**:
```
⚠️ [Manual W/H Ignored] | From Image (Exact: 1920×1080) | Mode: Width + Height | Calculated MP: 2.07 | Div: 8
```

**With Scale Applied**:
```
From Image (Exact: 1920×1080) @ 0.5x | Mode: Width + Height | W: 960 × H: 540 | MP: 0.52 | Div: 8
```

## Copy from Image Button

**Feature**: 📋 Copy from Image button

**Location**: Right after `use_image_dimensions` toggle in node

**Purpose**: Snapshot workflow - extract dimensions once, then manually adjust

### Button States

**Enabled** (image connected):
- Blue background (#3a5a7a)
- Hover: Lighter blue (#4a7a9a)
- Text: "📋 Copy from Image"
- Click: Shows instructions dialog

**Disabled** (no image):
- Dark gray background (#2a2a2a)
- Gray text (#666666)
- Text: "📋 Copy from Image (No Image)"
- Click: No action

### Usage Instructions

When clicked, the button displays:

```
Copy Image Dimensions

To copy dimensions:
1. Run the workflow once (Queue Prompt)
2. Image dimensions will auto-populate
3. You can then disconnect the image if desired

Or manually enter width and height from your source image.
```

## Three Workflows

### 1. Live AR Extraction

**Best for**: Dynamic aspect ratio matching with adjustable resolution

**Setup**:
- Connect image
- `enable_image_input`: ON
- `use_image_dimensions`: OFF (AR Only)

**Behavior**:
- Aspect ratio updates automatically when image changes
- Adjust megapixels to scale resolution up/down
- Maintains image proportions at any resolution

**Example**:
- Input: 3840×2160 image (16:9)
- Megapixels: 1.0
- Output: 1216×688 (16:9 at 1.0 MP)

### 2. Exact Dimension Matching

**Best for**: Maintaining exact resolution through pipeline

**Setup**:
- Connect image
- `enable_image_input`: ON
- `use_image_dimensions`: ON (Exact Dims)

**Behavior**:
- Always outputs same dimensions as input
- Apply scale multiplier for variations (0.5x = half size, 2.0x = double)
- Overrides manual WIDTH/HEIGHT if enabled

**Example**:
- Input: 1920×1080 image
- Scale: 0.5x
- Output: 960×540 (exact half)

**Warning**: If you have manual WIDTH or HEIGHT toggles enabled, you'll see:
```
⚠️ [Manual W/H Ignored] | From Image (Exact: 1920×1080) | ...
```

### 3. Snapshot Workflow

**Best for**: One-time extraction with manual fine-tuning

**Setup**:
- Connect image
- Click "📋 Copy from Image" button
- Queue workflow once
- Dimensions populate automatically
- Optionally disconnect image

**Behavior**:
- Extracts dimensions on first run
- Values remain in manual widgets after disconnect
- Allows tweaking extracted dimensions
- Best of both worlds: accurate extraction + manual control

**Use cases**:
- Extract base dimensions, then adjust for divisibility
- Copy aspect ratio, then modify resolution
- Quick dimension reference without permanent connection

## Technical Details

### Dimension Extraction

**Image Tensor Format**: `[batch, height, width, channels]`

**Extraction**:
```python
h, w = image.shape[1], image.shape[2]  # Extract from first image in batch
actual_ar = format_aspect_ratio(w, h)  # Simplify using GCD
```

**Aspect Ratio Simplification**:
- 1920×1080 → 16:9
- 1024×1024 → 1:1
- 1997×1123 → 1997:1123 (already coprime)

### Priority and Overrides

**Exact Dims Mode** overrides manual settings:
1. Checks if manual WIDTH or HEIGHT toggles are ON
2. Sets `override_warning = True` if conflict detected
3. Forces WIDTH+HEIGHT mode with image dimensions
4. Applies scale multiplier to extracted dimensions

**AR Only Mode** works with existing priority:
1. Extracts aspect ratio
2. Enables `custom_ratio` mode
3. Uses megapixel calculation with extracted ratio
4. No conflicts with manual settings

### Scale Multiplier

Works with both modes:

**AR Only Mode**:
- Scale affects final calculated dimensions
- Same as manual megapixel workflow

**Exact Dims Mode**:
- Scale multiplies extracted dimensions
- `int(width * scale)` and `int(height * scale)`
- Applied before divisibility rounding

## Troubleshooting

### Image connected but not extracting

**Check**:
1. `enable_image_input` toggle is ON
2. Image actually connected (check node background color)
3. Upstream node has executed and produced image output

### Dimensions seem wrong

**Check**:
1. Extraction mode (`use_image_dimensions` setting)
2. Scale multiplier value (default 1.0x)
3. Divisibility rounding (8/16/32/64 affects final dimensions)
4. Info output shows actual extracted values

### Override warning appears

**This is expected** when:
- `use_image_dimensions` is ON (Exact Dims mode)
- Manual WIDTH or HEIGHT toggle is also ON
- Image dimensions will override manual settings

**To resolve**:
- Turn off manual WIDTH/HEIGHT toggles, OR
- Switch to AR Only mode (`use_image_dimensions` OFF), OR
- Disable image input (`enable_image_input` OFF)

### Copy button doesn't work

**Remember**:
- Button shows instructions, not automatic copy
- Must queue workflow once for extraction
- Future versions may add direct dimension copying

## Best Practices

1. **Use AR Only for flexible resolution**: Match image proportions but adjust megapixels freely
2. **Use Exact Dims for precise matching**: img2img, upscaling, or dimension-critical workflows
3. **Use Snapshot for one-time extraction**: When you need initial dimensions but plan to adjust
4. **Watch the info output**: Always verify extraction mode and dimensions
5. **Enable override warnings**: Help catch conflicts between image and manual settings

## Examples

### Example 1: Upscaling Workflow

**Goal**: Generate at exactly 2x the input image resolution

```
Input: 512×768 image (Load Image node)
↓
Smart Resolution Calculator:
  - enable_image_input: ON
  - use_image_dimensions: ON (Exact Dims)
  - scale: 2.0x
↓
Output: 1024×1536 latent
↓
KSampler (img2img at 2x resolution)
```

### Example 2: Aspect Ratio Matching

**Goal**: Match portrait image proportions at 1.0 MP

```
Input: 1080×1920 image (9:16)
↓
Smart Resolution Calculator:
  - enable_image_input: ON
  - use_image_dimensions: OFF (AR Only)
  - megapixel: 1.0
↓
Output: 688×1216 (9:16 at 1.0 MP)
↓
KSampler (portrait at optimal resolution)
```

### Example 3: Quick Dimension Reference

**Goal**: Extract dimensions, then manually adjust

```
1. Connect image to Smart Resolution Calculator
2. Click "📋 Copy from Image" button
3. Queue workflow once
4. Dimensions populate in WIDTH/HEIGHT widgets
5. Disconnect image
6. Fine-tune dimensions manually
7. Continue workflow with adjusted values
```

## Version History

- **v0.2.0-beta**: Added tooltips, override warning, copy button, enable toggle, parameter rename
- **v0.2.0-alpha**: Initial image input feature with two extraction modes
