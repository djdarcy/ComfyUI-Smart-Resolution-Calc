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

from .py.smart_resolution_calc import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, SmartResolutionCalc
from .version import __version__, VERSION, BASE_VERSION, get_version, get_base_version

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', '__version__', 'VERSION', 'BASE_VERSION']

# Web directory for JavaScript widgets
WEB_DIRECTORY = "./web"

# Register API endpoint for image dimension extraction
try:
    import server
    from aiohttp import web
    import json

    @server.PromptServer.instance.routes.post("/smart-resolution/get-dimensions")
    async def get_image_dimensions(request):
        """
        API endpoint to extract image dimensions from file path.

        POST body: {"image_path": "/path/to/image.png"}
        Returns: {"width": 1920, "height": 1080, "success": true}
        """
        try:
            data = await request.json()
            image_path = data.get('image_path')

            if not image_path:
                return web.json_response({
                    'success': False,
                    'error': 'No image_path provided'
                }, status=400)

            # Use the static method from SmartResolutionCalc
            result = SmartResolutionCalc.get_image_dimensions_from_path(image_path)

            if result['success']:
                return web.json_response(result)
            else:
                return web.json_response(result, status=400)

        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)

    print("[SmartResCalc] Registered API endpoint: /smart-resolution/get-dimensions")

except Exception as e:
    print(f"[SmartResCalc] Warning: Could not register API endpoint: {e}")
