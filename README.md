# Smart Resolution Calculator

A flexible ComfyUI custom node for calculating image resolutions with toggle-based input control and automatic latent generation.

## Features

- **Compact Custom Widgets**: rgthree-style toggle controls with inline number inputs (24px height, minimal spacing)
- **Toggle-Based Control**: Enable/disable dimension inputs WITHOUT changing their values
- **Automatic Calculation**: Calculates missing dimensions based on enabled inputs and aspect ratio
- **Multiple Input Modes**:
  - Width + Height → calculates megapixels
  - Width + Aspect Ratio → calculates height
  - Height + Aspect Ratio → calculates width
  - Megapixels + Aspect Ratio → calculates both dimensions
- **Direct Latent Output**: Generates latent tensor ready for sampling (no need for separate Empty Latent Image node)
- **Visual Preview**: Shows aspect ratio box with dimensions and megapixels
- **Divisibility Control**: Ensures dimensions are divisible by 8/16/32/64 for model compatibility
- **23 Preset Aspect Ratios**: From 1:1 to 32:9, plus custom ratio support
- **Detailed Info Output**: Shows calculation mode and computed values for verification

## Installation

1. Clone or copy this directory to your ComfyUI `custom_nodes` folder:
   ```
   ComfyUI/custom_nodes/smart-resolution-calc/
   ```

2. Restart ComfyUI

3. The node will appear in the menu under: **Smart Resolution → Smart Resolution Calculator**

## Usage

### Basic Workflow

1. Add the **Smart Resolution Calculator** node to your workflow
2. Select an aspect ratio from the dropdown (default: 3:4 Golden Ratio)
3. Enable one or more dimension toggles (click toggle switch on left):
   - **MEGAPIXEL** toggle + set value (e.g., 1.0)
   - **WIDTH** toggle + set value (e.g., 1920)
   - **HEIGHT** toggle + set value (e.g., 1080)
4. The node calculates missing dimensions automatically
5. Check the **info** output to verify calculation mode and results
6. Connect the **latent** output directly to your KSampler

### Input Modes

#### Mode 1: Height + Aspect Ratio (Typical Designer Workflow)
- Enable: **HEIGHT** toggle (click left switch)
- Set: **height** to 1920
- Select: **aspect_ratio** 4:3
- Result: Width automatically calculated as 1536
- Info output: `Mode: Height + Aspect Ratio | Calculated Width: 1536 | MP: 2.95 | Div: 16`

#### Mode 2: Width + Aspect Ratio
- Enable: **WIDTH** toggle
- Set: **width** to 1920
- Select: **aspect_ratio** 16:9
- Result: Height automatically calculated as 1080
- Info output: `Mode: Width + Aspect Ratio | Calculated Height: 1080 | MP: 2.07 | Div: 16`

#### Mode 3: Megapixels + Aspect Ratio (Original Flux Resolution Calc behavior)
- Enable: **MEGAPIXEL** toggle
- Set: **megapixel** to 1.0
- Select: **aspect_ratio** 16:9
- Result: Both width and height calculated
- Info output: `Mode: Megapixels + Aspect Ratio | Calculated W: 1216 × H: 688 | Div: 16`

#### Mode 4: Both Dimensions (Override Aspect Ratio)
- Enable: Both **WIDTH** and **HEIGHT** toggles
- Set: **width** to 1920, **height** to 1080
- Result: Megapixels calculated, actual aspect ratio may differ from selected
- Info output: `Mode: Width + Height | Calculated MP: 2.07 | Div: 16`

#### Mode 5: Default (No Toggles Active)
- Result: Uses 1.0 MP with selected aspect ratio
- Info output: `Mode: Default (1.0 MP) | W: 1216 × H: 688 | Div: 16`

### Inputs

**Required:**
- `aspect_ratio`: Dropdown with 23 preset ratios (default: 3:4 Golden Ratio)
- `divisible_by`: Rounding divisor (8, 16, 32, 64) - ensures model compatibility

**Optional:**
- `custom_ratio`: Enable custom aspect ratio input
- `custom_aspect_ratio`: String input for custom ratio (e.g., "5:3")
- `batch_size`: Number of latent images to generate (default: 1)

**Dimension Controls** (Custom compact widgets):
- `dimension_megapixel`: Toggle + value widget (default: OFF, 1.0)
  - Toggle megapixel input on/off
  - Click value to edit, use +/- buttons to adjust by 0.1
- `dimension_width`: Toggle + value widget (default: OFF, 1920)
  - Toggle width input on/off
  - Click value to edit, use +/- buttons to adjust by 8 pixels
- `dimension_height`: Toggle + value widget (default: OFF, 1080)
  - Toggle height input on/off
  - Click value to edit, use +/- buttons to adjust by 8 pixels

### Outputs

- `megapixels` (FLOAT): Calculated megapixels value
- `width` (INT): Final width (after divisibility rounding)
- `height` (INT): Final height (after divisibility rounding)
- `resolution` (STRING): Formatted resolution string (e.g., "1920 x 1080")
- `preview` (IMAGE): Visual preview showing aspect ratio box and dimensions
- `latent` (LATENT): Generated latent tensor ready for sampling
- `info` (STRING): Calculation mode and details

### Aspect Ratio Presets

**Portrait Ratios:**
- 2:3 (Classic Portrait)
- 3:4 (Golden Ratio) ← **Default**
- 3:5 (Elegant Vertical)
- 4:5 (Artistic Frame)
- 5:7 (Balanced Portrait)
- 5:8 (Tall Portrait)
- 7:9 (Modern Portrait)
- 9:16 (Slim Vertical)
- 9:19 (Tall Slim)
- 9:21 (Ultra Tall)
- 9:32 (Skyline)

**Square:**
- 1:1 (Perfect Square)

**Landscape Ratios:**
- 3:2 (Golden Landscape)
- 4:3 (Classic Landscape)
- 5:3 (Wide Horizon)
- 5:4 (Balanced Frame)
- 7:5 (Elegant Landscape)
- 8:5 (Cinematic View)
- 9:7 (Artful Horizon)
- 16:9 (Panorama)
- 19:9 (Cinematic Ultrawide)
- 21:9 (Epic Ultrawide)
- 32:9 (Extreme Ultrawide)

## Widget Controls

### Compact Custom Widgets (rgthree-style)
Each dimension control has an inline toggle switch and number input:

**Toggle Switch (LEFT)**:
- Click to enable/disable the dimension input
- Green = ON (dimension will be used for calculation)
- Gray = OFF (dimension will be ignored)
- **Important**: Toggling OFF does NOT change the stored value

**Number Controls (RIGHT)**:
- **[-]** button: Decrement value (megapixels: -0.1, width/height: -8px)
- **Value display**: Click to type exact value
- **[+]** button: Increment value (megapixels: +0.1, width/height: +8px)
- Grayed out when toggle is OFF (but value is preserved)

## Technical Details

### Divisibility Rounding

The `divisible_by` parameter ensures dimensions are compatible with model latent space:
- **8**: Minimum for SD/Flux models (latent space is 8x downsampled)
- **16**: Safer for some models
- **32**: Recommended for many models
- **64**: Most compatible (default)

Rounding is applied **separately** to width and height, not their product.

### Latent Generation

Latent tensor format: `[batch_size, 4, height // 8, width // 8]`
- Compatible with Stable Diffusion and Flux models
- 4-channel latent space
- Automatically placed on appropriate device (CPU/GPU)

### Calculation Priority

When multiple toggles are enabled (priority order):
1. Width + Height (overrides aspect ratio)
2. Width + Aspect Ratio
3. Height + Aspect Ratio
4. Megapixels + Aspect Ratio
5. None active → defaults to 1.0 MP + aspect ratio

## Architecture Notes

### Custom Widget System
This node uses a custom JavaScript widget system inspired by rgthree's Power Lora Loader:

**Key Implementation Details**:
- Widgets declared in `INPUT_TYPES["hidden"]` section - **CRITICAL for data flow**
- Widget names must match between JavaScript (`DimensionWidget.name`) and Python (`kwargs` keys)
- `serialize_widgets = true` flag enables workflow save/load
- Widget data structure: `{on: boolean, value: number}`

**Why this matters**: ComfyUI only passes widget data to Python if widgets are declared in `INPUT_TYPES`. Setting `serialize_widgets = true` alone is NOT sufficient - both are required for proper data flow.

### Data Flow
1. User interacts with JavaScript widget (toggle/value change)
2. Widget updates internal `this.value` state
3. ComfyUI calls `serializeValue()` when queuing workflow
4. Widget data sent to Python as kwargs with widget name as key
5. Python extracts values: `kwargs.get('dimension_width', {}).get('on', False)`

## Credits

- Inspired by **Flux Resolution Calc** from [controlaltai-nodes](https://github.com/gseth/ControlAltAI-Nodes)
- Widget design based on **rgthree's Power Lora Loader** compact style
- Aspect ratio list from controlaltai-nodes
- Preview generation adapted from controlaltai-nodes

## Troubleshooting

### Widget toggles don't affect calculation
**Symptom**: Changing toggles or values doesn't change the output, always shows "Mode: Default (1.0 MP)"

**Solution**: Enable debug mode (see below) to verify widget data is being passed to Python. If kwargs are empty, ensure:
1. Widget names in JavaScript match `INPUT_TYPES["hidden"]` keys exactly
2. `serialize_widgets = true` is set in node creation
3. ComfyUI has been restarted after code changes

### Workflow won't save/load widget states
**Symptom**: Widget values reset when loading saved workflow

**Verify**:
- Check browser console for `configure called` debug logs
- Ensure `nodeType.prototype.configure` is properly defined
- Verify widget values have correct structure: `{on: boolean, value: number}`

### Cache errors on second run
**Symptom**: `KeyError` in ComfyUI cache system after first successful run

**Solution**: Remove `OUTPUT_NODE = True` if present - only use for pure display nodes with no downstream outputs

### Latent tensor errors
**Symptom**: `TypeError: tuple indices must be integers or slices, not str`

**Solution**: Ensure helper methods return dict directly, not wrapped in tuple:
- ✅ Correct: `return {"samples": latent}`
- ❌ Wrong: `return ({"samples": latent},)`

### Widgets appear too large
**Symptom**: Custom widgets take up too much vertical space

**Verify**:
- Widget height should be 24px in `computeSize()`
- Inner margins should be 3px for compact appearance
- Check rgthree nodes for visual reference

## Debug Mode

To enable debug logging for troubleshooting:

### Python Debug Logs (ComfyUI Console)

**Windows**:
```cmd
set COMFY_DEBUG_SMART_RES_CALC=true
```

**Linux/Mac**:
```bash
export COMFY_DEBUG_SMART_RES_CALC=true
```

Then start/restart ComfyUI. Python debug logs will appear in the console showing:
- Widget data received (kwargs)
- Calculation mode selected
- Dimension computations
- Final results

### JavaScript Debug Logs (Browser Console)

Open browser console (F12), then run:
```javascript
localStorage.setItem('DEBUG_SMART_RES_CALC', 'true');
```

Then reload the page (Ctrl+R). JavaScript debug logs will show:
- Widget creation and initialization
- Toggle clicks and value changes
- Widget serialization (data passing to Python)
- Workflow save/load operations

### Disable Debug Mode

**Python**:
```cmd
set COMFY_DEBUG_SMART_RES_CALC=false   # Windows
export COMFY_DEBUG_SMART_RES_CALC=false   # Linux/Mac
```

**JavaScript**:
```javascript
localStorage.removeItem('DEBUG_SMART_RES_CALC');
```

## License

MIT License - Feel free to use, modify, and distribute

## Support

For issues or feature requests, please check the ComfyUI custom nodes documentation.
