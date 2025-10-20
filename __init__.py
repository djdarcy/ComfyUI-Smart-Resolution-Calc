"""
Smart Resolution Calculator - Flexible resolution and latent generation node

Author: Claude & User
Description: Toggle-based resolution calculator that accepts any combination of
            megapixels/width/height + aspect ratio, automatically calculates
            missing values, and generates both preview and latent images.

Features:
- Explicit toggle control for which dimensions to use
- Automatic calculation of missing values
- Preview image showing aspect ratio and dimensions
- Direct latent generation for sampling
- rgthree-style custom widgets
"""

from .py.smart_resolution_calc import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

# Web directory for JavaScript widgets
WEB_DIRECTORY = "./web"
