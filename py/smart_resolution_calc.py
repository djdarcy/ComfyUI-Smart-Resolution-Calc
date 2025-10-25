from PIL import Image, ImageDraw, ImageFont
import numpy as np
import torch
import comfy.model_management
import logging
import os
from math import gcd

# Configure debug logging
logger = logging.getLogger('SmartResolutionCalc')
DEBUG_ENABLED = os.getenv('COMFY_DEBUG_SMART_RES_CALC', 'false').lower() == 'true'
logger.setLevel(logging.DEBUG if DEBUG_ENABLED else logging.WARNING)

# Console handler with clear formatting
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '[SmartResCalc] %(levelname)s: %(message)s'
    ))
    logger.addHandler(handler)

# Always log when module is loaded
print("[SmartResCalc] Module loaded, DEBUG_ENABLED =", DEBUG_ENABLED)


def pil2tensor(image):
    """Convert PIL image to tensor in the correct format"""
    return torch.from_numpy(np.array(image).astype(np.float32) / 255.0).unsqueeze(0)


class SmartResolutionCalc:
    """
    Smart Resolution Calculator - Flexible resolution and latent generation node.

    Accepts any combination of megapixels/width/height + aspect ratio, automatically
    calculates missing values, and generates both preview and latent images.

    Toggle-based input system allows explicit control over which dimensions to use.
    """

    @classmethod
    def INPUT_TYPES(cls):
        aspect_ratios = [
            "1:1 (Perfect Square)",
            "2:3 (Classic Portrait)",
            "3:4 (Golden Ratio)",
            "3:5 (Elegant Vertical)",
            "4:5 (Artistic Frame)",
            "5:7 (Balanced Portrait)",
            "5:8 (Tall Portrait)",
            "7:9 (Modern Portrait)",
            "9:16 (Slim Vertical)",
            "9:19 (Tall Slim)",
            "9:21 (Ultra Tall)",
            "9:32 (Skyline)",
            "3:2 (Golden Landscape)",
            "4:3 (Classic Landscape)",
            "5:3 (Wide Horizon)",
            "5:4 (Balanced Frame)",
            "7:5 (Elegant Landscape)",
            "8:5 (Cinematic View)",
            "9:7 (Artful Horizon)",
            "16:9 (Panorama)",
            "19:9 (Cinematic Ultrawide)",
            "21:9 (Epic Ultrawide)",
            "32:9 (Extreme Ultrawide)"
        ]

        return {
            "required": {
                "aspect_ratio": (aspect_ratios, {"default": "3:4 (Golden Ratio)"}),
                "divisible_by": (["Exact", "8", "16", "32", "64"], {"default": "16"}),
                "custom_ratio": ("BOOLEAN", {"default": False, "label_on": "Enable", "label_off": "Disable"}),
            },
            "optional": {
                "custom_aspect_ratio": ("STRING", {"default": "16:9"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 64}),
                "scale": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "slider"
                }),
                "image": ("IMAGE",),
            },
            # Custom widgets added via JavaScript - declare in hidden so ComfyUI passes them to Python
            # Widget data structure: {'on': bool, 'value': number}
            "hidden": {
                "image_mode": "IMAGE_MODE_WIDGET",  # {on: bool, value: 0|1} - 0=AR Only, 1=Exact Dims
                "dimension_megapixel": "DIMENSION_WIDGET",
                "dimension_width": "DIMENSION_WIDGET",
                "dimension_height": "DIMENSION_WIDGET",
            },
        }

    RETURN_TYPES = ("FLOAT", "INT", "INT", "STRING", "IMAGE", "LATENT", "STRING")
    RETURN_NAMES = ("megapixels", "width", "height", "resolution", "preview", "latent", "info")
    FUNCTION = "calculate_dimensions"
    CATEGORY = "Smart Resolution"

    def __init__(self):
        self.device = comfy.model_management.intermediate_device()

    def format_aspect_ratio(self, width, height):
        """
        Format aspect ratio as simplified W:H notation using GCD.

        Returns a simplified aspect ratio that users can manually enter
        into the aspect ratio field for future use.

        Examples:
            1920 × 1080 → "16:9"
            1024 × 1024 → "1:1"
            3840 × 2160 → "16:9"
            1997 × 1123 → "1997:1123" (coprime, already reduced)
        """
        divisor = gcd(width, height)
        w_ratio = width // divisor
        h_ratio = height // divisor
        return f"{w_ratio}:{h_ratio}"

    def calculate_dimensions(self, aspect_ratio, divisible_by, custom_ratio=False,
                            custom_aspect_ratio="16:9", batch_size=1, scale=1.0,
                            image=None, **kwargs):
        """
        Calculate dimensions based on active toggle inputs from custom widgets.

        kwargs contains widget data from JavaScript:
        {
            'dimension_megapixel': {'on': True, 'value': 1.0},
            'dimension_width': {'on': False, 'value': 1920},
            'dimension_height': {'on': True, 'value': 1080},
        }

        Priority order (first match wins):
        1. Width + Height → calculate megapixels, infer aspect ratio
        2. Width + Aspect Ratio → calculate height, then megapixels
        3. Height + Aspect Ratio → calculate width, then megapixels
        4. Megapixels + Aspect Ratio → calculate both dimensions
        5. None active → default to 1.0 MP + aspect ratio
        """

        # ALWAYS log that function was called (critical diagnostic)
        print(f"[SmartResCalc] calculate_dimensions() CALLED - aspect_ratio={aspect_ratio}, divisible_by={divisible_by}")

        # Debug logging for kwargs
        logger.debug(f"Function called with standard args: aspect_ratio={aspect_ratio}, divisible_by={divisible_by}, custom_ratio={custom_ratio}")
        logger.debug(f"kwargs keys received: {list(kwargs.keys())}")
        logger.debug(f"kwargs contents: {kwargs}")

        # Image input handling - extract dimensions from connected image
        # image_mode widget: {on: bool, value: 0|1} - 0=AR Only, 1=Exact Dims
        mode_info = None
        override_warning = False
        image_mode = kwargs.get('image_mode', {'on': True, 'value': 0})  # Default: enabled, AR Only
        use_image = image_mode.get('on', True) if isinstance(image_mode, dict) else True
        exact_dims = image_mode.get('value', 0) == 1 if isinstance(image_mode, dict) else False

        if image is not None and use_image:
            # Extract dimensions from first image in batch
            # Image tensor shape: [batch, height, width, channels]
            h, w = image.shape[1], image.shape[2]
            actual_ar = self.format_aspect_ratio(w, h)

            logger.debug(f"Image input detected: {w}×{h}, AR: {actual_ar}, mode={image_mode}")

            if exact_dims:
                # Check if manual WIDTH or HEIGHT settings will be overridden
                manual_width = kwargs.get('dimension_width', {}).get('on', False)
                manual_height = kwargs.get('dimension_height', {}).get('on', False)
                if manual_width or manual_height:
                    override_warning = True
                    logger.debug(f"Override warning: Manual W/H settings detected but will be ignored in exact dims mode")

                # Force Width+Height mode with extracted dimensions
                # Apply scale to extracted dimensions
                kwargs['dimension_width'] = {'on': True, 'value': int(w * scale)}
                kwargs['dimension_height'] = {'on': True, 'value': int(h * scale)}
                mode_info = f"From Image (Exact: {w}×{h})"
                if scale != 1.0:
                    mode_info += f" @ {scale}x"
                logger.debug(f"Exact dimensions mode: forcing width={int(w * scale)}, height={int(h * scale)}")
            else:
                # Extract AR only, use with current megapixel calculation
                custom_ratio = True
                custom_aspect_ratio = actual_ar
                mode_info = f"From Image (AR: {actual_ar})"
                logger.debug(f"AR extraction mode: using AR {actual_ar} with existing megapixel logic")

        # Extract widget toggle states and values
        use_mp = kwargs.get('dimension_megapixel', {}).get('on', False)
        megapixel_val = float(kwargs.get('dimension_megapixel', {}).get('value', 1.0))

        use_width = kwargs.get('dimension_width', {}).get('on', False)
        width_val = int(kwargs.get('dimension_width', {}).get('value', 1920))

        use_height = kwargs.get('dimension_height', {}).get('on', False)
        height_val = int(kwargs.get('dimension_height', {}).get('value', 1080))

        # Debug: Log extracted widget values
        logger.debug(f"Extracted widget states: use_mp={use_mp} (val={megapixel_val}), use_width={use_width} (val={width_val}), use_height={use_height} (val={height_val})")

        # Get aspect ratio string
        if custom_ratio and custom_aspect_ratio:
            ratio_str = custom_aspect_ratio
            ratio_display = custom_aspect_ratio
        else:
            ratio_str = aspect_ratio.split(' ')[0]  # "3:4 (Golden Ratio)" → "3:4"
            ratio_display = ratio_str

        logger.debug(f"Aspect ratio: {ratio_str} (display: {ratio_display})")

        # Parse aspect ratio
        w_ratio, h_ratio = map(int, ratio_str.split(':'))

        # Handle divisibility - "Exact" means no rounding (divisor=1)
        if divisible_by == "Exact":
            divisor = 1
        else:
            divisor = int(divisible_by)

        logger.debug(f"Parsed: w_ratio={w_ratio}, h_ratio={h_ratio}, divisor={divisor}")

        # Calculate based on active toggles (priority order)
        if use_width and use_height:
            # Both dimensions specified - calculate megapixels, actual aspect may differ
            w = width_val
            h = height_val
            # Calculate and display actual aspect ratio (GCD-reduced for reusability)
            actual_ar = self.format_aspect_ratio(w, h)
            ratio_display = actual_ar  # Use calculated AR for preview instead of preset
            mode = f"Width + Height (AR: {actual_ar})"
            info_detail_base = f"Base W: {w} × H: {h}"
            logger.debug(f"Mode: Width + Height - width={width_val}, height={height_val}, actual AR={actual_ar}")

        elif use_width:
            # Width + aspect ratio → calculate height
            w = width_val
            h = int(width_val * h_ratio / w_ratio)
            mode = "Width + Aspect Ratio"
            info_detail_base = f"Calculated H: {h}"
            logger.debug(f"Mode: {mode} - width={width_val}, calculated h={h}")

        elif use_height:
            # Height + aspect ratio → calculate width
            w = int(height_val * w_ratio / h_ratio)
            h = height_val
            mode = "Height + Aspect Ratio"
            info_detail_base = f"Calculated W: {w}"
            logger.debug(f"Mode: {mode} - height={height_val}, calculated w={w}")

        elif use_mp:
            # Megapixels + aspect ratio → calculate both dimensions
            total_pixels = megapixel_val * 1_000_000
            dimension = (total_pixels / (w_ratio * h_ratio)) ** 0.5
            w = int(dimension * w_ratio)
            h = int(dimension * h_ratio)
            mode = "Megapixels + Aspect Ratio"
            info_detail_base = f"Calculated W: {w} × H: {h}"
            logger.debug(f"Mode: {mode} - mp={megapixel_val} → w={w}, h={h}")

        else:
            # No inputs active - use default (1.0 MP at aspect ratio)
            total_pixels = 1.0 * 1_000_000
            dimension = (total_pixels / (w_ratio * h_ratio)) ** 0.5
            w = int(dimension * w_ratio)
            h = int(dimension * h_ratio)
            mode = "Default (1.0 MP)"
            info_detail_base = f"W: {w} × H: {h}"
            logger.debug(f"Mode: {mode} - no toggles active, defaulting to 1.0 MP")

        # Apply scale multiplier
        # Clamp scale to minimum 0.0 (user requirement: allow 0 but it's clamped by default)
        scale = max(0.0, scale)

        # Warn if scale is very high
        if scale > 10.0:
            logger.warning(f"Scale {scale}x exceeds recommended maximum (10x). This may cause out-of-memory errors.")
            print(f"[SmartResCalc] WARNING: Scale {scale}x is very high and may exceed GPU limits")

        # Apply scale to base dimensions
        w_scaled = int(w * scale)
        h_scaled = int(h * scale)

        # Warn if scaled dimensions exceed typical GPU limits
        if w_scaled > 16384 or h_scaled > 16384:
            logger.warning(f"Scaled dimensions {w_scaled}×{h_scaled} exceed typical GPU texture limits (16384px)")
            print(f"[SmartResCalc] WARNING: Dimensions {w_scaled}×{h_scaled} may exceed GPU limits")

        # Apply divisibility rounding
        w = round(w_scaled / divisor) * divisor
        h = round(h_scaled / divisor) * divisor

        # Recalculate megapixels after scaling and rounding
        mp = (w * h) / 1_000_000

        # Build info detail string
        if scale != 1.0:
            info_detail = f"{info_detail_base} | Scale: {scale}x | Final: {w}×{h} | MP: {mp:.2f}"
        else:
            info_detail = f"{info_detail_base} | MP: {mp:.2f}"

        # Generate outputs
        resolution = f"{w} x {h}"
        preview = self.create_preview_image(w, h, resolution, ratio_display, mp)
        latent = self.create_latent(w, h, batch_size)

        # Format divisibility info
        div_info = "Exact" if divisible_by == "Exact" else str(divisor)
        info = f"Mode: {mode} | {info_detail} | Div: {div_info}"

        # Prepend image source info if applicable
        if mode_info:
            info = f"{mode_info} | {info}"
            # Add override warning if exact dims mode overrides manual settings
            if override_warning:
                info = f"⚠️ [Manual W/H Ignored] | {info}"

        # ALWAYS log final results
        print(f"[SmartResCalc] RESULT: {info}, resolution={resolution}")
        logger.debug(f"Returning: mp={mp}, w={w}, h={h}, resolution={resolution}, info={info}")

        return (mp, w, h, resolution, preview, latent, info)

    def create_preview_image(self, width, height, resolution, ratio_display, megapixels):
        """
        Create preview image showing aspect ratio box with dimensions.
        Based on controlaltai-nodes implementation.
        """
        # 1024x1024 preview size
        preview_size = (1024, 1024)
        image = Image.new('RGB', preview_size, (0, 0, 0))  # Black background
        draw = ImageDraw.Draw(image)

        # Draw grid with grey lines
        grid_color = '#333333'
        grid_spacing = 50
        for x in range(0, preview_size[0], grid_spacing):
            draw.line([(x, 0), (x, preview_size[1])], fill=grid_color)
        for y in range(0, preview_size[1], grid_spacing):
            draw.line([(0, y), (preview_size[0], y)], fill=grid_color)

        # Calculate preview box dimensions (maintain aspect ratio)
        preview_width = 800
        preview_height = int(preview_width * (height / width))

        # Adjust if height is too tall
        if preview_height > 800:
            preview_height = 800
            preview_width = int(preview_height * (width / height))

        # Calculate center position
        x_offset = (preview_size[0] - preview_width) // 2
        y_offset = (preview_size[1] - preview_height) // 2

        # Draw the aspect ratio box with red outline
        draw.rectangle(
            [(x_offset, y_offset), (x_offset + preview_width, y_offset + preview_height)],
            outline='red',
            width=4
        )

        # Add text with dimension info
        try:
            # Resolution text in center (red)
            text_y = y_offset + preview_height // 2
            draw.text(
                (preview_size[0] // 2, text_y),
                f"{width}x{height}",
                fill='red',
                anchor="mm",
                font=ImageFont.truetype("arial.ttf", 48)
            )

            # Aspect ratio text below resolution (red)
            draw.text(
                (preview_size[0] // 2, text_y + 60),
                f"({ratio_display})",
                fill='red',
                anchor="mm",
                font=ImageFont.truetype("arial.ttf", 36)
            )

            # Megapixels text at bottom (white)
            draw.text(
                (preview_size[0] // 2, y_offset + preview_height + 60),
                f"{megapixels:.2f} MP",
                fill='white',
                anchor="mm",
                font=ImageFont.truetype("arial.ttf", 32)
            )

        except:
            # Fallback if font loading fails (non-Windows systems)
            draw.text((preview_size[0] // 2, text_y), f"{width}x{height}", fill='red', anchor="mm")
            draw.text((preview_size[0] // 2, text_y + 60), f"({ratio_display})", fill='red', anchor="mm")
            draw.text((preview_size[0] // 2, y_offset + preview_height + 60), f"{megapixels:.2f} MP", fill='white', anchor="mm")

        # Convert to tensor
        return pil2tensor(image)

    def create_latent(self, width, height, batch_size=1):
        """
        Create latent tensor compatible with SD/Flux models.

        Latent dimensions are downsampled by 8x from pixel dimensions.
        Format: [batch_size, 4_channels, height//8, width//8]
        """
        latent = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)
        return {"samples": latent}


NODE_CLASS_MAPPINGS = {
    "SmartResolutionCalc": SmartResolutionCalc,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SmartResolutionCalc": "Smart Resolution Calculator",
}
