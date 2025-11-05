/**
 * DimensionSourceManager
 *
 * Manages dimension source priority and aspect ratio determination for Smart Resolution Calculator.
 * Implements complete state machine with 6 priority levels to resolve dimension/AR conflicts.
 *
 * Priority Hierarchy:
 * 1. USE IMAGE DIMS = Exact Dims (absolute override)
 * 2. MP + W + H (scalar with AR from W:H)
 * 3. Explicit Dimensions (W+H, MP+W, MP+H)
 * 4. USE IMAGE DIMS = AR Only
 * 5. Single dimension with AR (W/H/MP + AR source)
 * 6. Defaults with AR
 *
 * Related Issues: #15 (umbrella), #16 (this implementation)
 * Related Docs: private/claude/2025-11-04__14-06-00__centralized-aspect-ratio-manager__EXPANSION.md
 */

// Import logger from extracted module
import { logger } from '../utils/debug_logger.js';

export class DimensionSourceManager {
    constructor(node) {
        this.node = node;
        // Memoization cache (100ms TTL for performance)
        this.cache = {
            dimensionSource: null,
            aspectRatio: null,
            timestamp: 0,
            ttl: 100 // milliseconds
        };
    }

    /**
     * Get active dimension source and calculate base dimensions.
     * Returns complete calculation context including mode, dimensions, AR, conflicts.
     *
     * @param {boolean} forceRefresh - Skip cache and recalculate
     * @param {Object} runtimeContext - Runtime data (imageDimensionsCache, etc.)
     * @returns {Object} Dimension source result
     */
    getActiveDimensionSource(forceRefresh = false, runtimeContext = {}) {
        const now = Date.now();

        // Return cached result if valid
        if (!forceRefresh && this.cache.dimensionSource &&
            (now - this.cache.timestamp < this.cache.ttl)) {
            return this.cache.dimensionSource;
        }

        // Calculate fresh result with runtime context
        const result = this._calculateDimensionSource(runtimeContext);

        // Update cache
        this.cache.dimensionSource = result;
        this.cache.timestamp = now;

        return result;
    }

    /**
     * Internal calculation logic - implements priority hierarchy
     * @param {Object} runtimeContext - Runtime data including imageDimensionsCache
     */
    _calculateDimensionSource(runtimeContext = {}) {
        const widgets = this._getWidgets();
        const { imageDimensionsCache } = runtimeContext;

        logger.verbose('[Manager] runtimeContext:', runtimeContext);
        logger.debug('[Manager] imageDimensionsCache:', imageDimensionsCache);
        logger.verbose('[Manager] imageMode widget:', widgets.imageMode);

        // PRIORITY 1: Exact Dims mode
        if (widgets.imageMode?.value?.on && widgets.imageMode.value.value === 1) {
            logger.debug('[Manager] Taking Priority 1: Exact Dims');
            return this._calculateExactDims(widgets, imageDimensionsCache);
        }

        // Check which dimension widgets are enabled
        const hasMP = widgets.mp?.value?.on;
        const hasWidth = widgets.width?.value?.on;
        const hasHeight = widgets.height?.value?.on;

        logger.debug('[Manager] hasMP:', hasMP, 'hasWidth:', hasWidth, 'hasHeight:', hasHeight);

        // PRIORITY 2: WIDTH + HEIGHT + MEGAPIXEL (all three)
        if (hasMP && hasWidth && hasHeight) {
            logger.debug('[Manager] Taking Priority 2: MP+W+H');
            return this._calculateMPScalarWithAR(widgets);
        }

        // PRIORITY 3: Explicit dimensions (three variants)
        if (hasWidth && hasHeight) {
            logger.debug('[Manager] Taking Priority 3: W+H explicit');
            return this._calculateWidthHeightExplicit(widgets);
        }
        if (hasMP && hasWidth) {
            logger.debug('[Manager] Taking Priority 3: MP+W explicit');
            return this._calculateMPWidthExplicit(widgets);
        }
        if (hasMP && hasHeight) {
            logger.debug('[Manager] Taking Priority 3: MP+H explicit');
            return this._calculateMPHeightExplicit(widgets);
        }

        // PRIORITY 4: AR Only mode (image AR + dimension widgets)
        logger.debug('[Manager] Checking Priority 4 (AR Only):', {
             imageMode_on: widgets.imageMode?.value?.on,
             imageMode_value: widgets.imageMode?.value?.value,
             shouldTrigger: widgets.imageMode?.value?.on && widgets.imageMode.value.value === 0
         });
        if (widgets.imageMode?.value?.on && widgets.imageMode.value.value === 0) {
            logger.debug('[Manager] Taking Priority 4: AR Only');
            return this._calculateAROnly(widgets, imageDimensionsCache);
        }

        // PRIORITY 5: Single dimension with AR
        if (hasWidth) {
            return this._calculateWidthWithAR(widgets);
        }
        if (hasHeight) {
            return this._calculateHeightWithAR(widgets);
        }
        if (hasMP) {
            return this._calculateMPWithAR(widgets);
        }

        // PRIORITY 6: Defaults
        return this._calculateDefaults(widgets);
    }

    // ========================================
    // Priority Level Implementations
    // ========================================

    _calculateExactDims(widgets, imageDimensionsCache) {
        if (!imageDimensionsCache) {
            // No image loaded, fall back to defaults
            return this._calculateDefaults(widgets);
        }

        const img = imageDimensionsCache;
        const ar = this._computeARFromDimensions(img.width, img.height);

        return {
            mode: "exact_dims",
            priority: 1,
            baseW: img.width,
            baseH: img.height,
            source: "image",
            ar: ar,
            conflicts: this._detectConflicts("exact_dims", widgets),
            description: "USE IMAGE DIMS = Exact Dims (overrides all widgets)"
        };
    }

    _calculateMPScalarWithAR(widgets) {
        const w = widgets.width.value.value;
        const h = widgets.height.value.value;
        const targetMP = widgets.mp.value.value * 1_000_000;

        // Compute AR from WIDTH/HEIGHT
        const ar = this._computeARFromDimensions(w, h);

        // Scale to MEGAPIXEL target maintaining AR
        // Solve: scaledW × scaledH = targetMP, scaledW/scaledH = ar.ratio
        const scaledH = Math.sqrt(targetMP / ar.ratio);
        const scaledW = scaledH * ar.ratio;

        return {
            mode: "mp_scalar_with_ar",
            priority: 2,
            baseW: Math.round(scaledW),
            baseH: Math.round(scaledH),
            source: "widgets_mp_scalar",
            ar: ar,
            conflicts: this._detectConflicts("mp_scalar_with_ar", widgets),
            description: `MP+W+H: AR ${ar.aspectW}:${ar.aspectH} from ${w}×${h}, scaled to ${widgets.mp.value.value}MP`,
            activeSources: ['WIDTH', 'HEIGHT', 'MEGAPIXEL'] // Track enabled widgets
        };
    }

    _calculateWidthHeightExplicit(widgets) {
        const w = widgets.width.value.value;
        const h = widgets.height.value.value;
        const ar = this._computeARFromDimensions(w, h);

        return {
            mode: "width_height_explicit",
            priority: 3,
            baseW: w,
            baseH: h,
            source: "widgets_explicit",
            ar: ar,
            conflicts: this._detectConflicts("width_height_explicit", widgets),
            description: `Explicit dimensions: ${w}×${h} (AR ${ar.aspectW}:${ar.aspectH} implied)`,
            activeSources: ['WIDTH', 'HEIGHT'] // Track enabled widgets
        };
    }

    _calculateMPWidthExplicit(widgets) {
        const w = widgets.width.value.value;
        const targetMP = widgets.mp.value.value * 1_000_000;

        // Calculate: H = (MP × 1,000,000) / W
        const h = Math.round(targetMP / w);
        const ar = this._computeARFromDimensions(w, h);

        return {
            mode: "mp_width_explicit",
            priority: 3,
            baseW: w,
            baseH: h,
            source: "widgets_mp_computed",
            ar: ar,
            conflicts: this._detectConflicts("mp_width_explicit", widgets),
            description: `MP+W: ${w}×${h} (H computed from ${widgets.mp.value.value}MP, AR ${ar.aspectW}:${ar.aspectH} implied)`,
            activeSources: ['WIDTH', 'MEGAPIXEL'] // Track enabled widgets
        };
    }

    _calculateMPHeightExplicit(widgets) {
        const h = widgets.height.value.value;
        const targetMP = widgets.mp.value.value * 1_000_000;

        // Calculate: W = (MP × 1,000,000) / H
        const w = Math.round(targetMP / h);
        const ar = this._computeARFromDimensions(w, h);

        return {
            mode: "mp_height_explicit",
            priority: 3,
            baseW: w,
            baseH: h,
            source: "widgets_mp_computed",
            ar: ar,
            conflicts: this._detectConflicts("mp_height_explicit", widgets),
            description: `MP+H: ${w}×${h} (W computed from ${widgets.mp.value.value}MP, AR ${ar.aspectW}:${ar.aspectH} implied)`,
            activeSources: ['HEIGHT', 'MEGAPIXEL'] // Track enabled widgets
        };
    }

    _calculateAROnly(widgets, imageDimensionsCache) {
        if (!imageDimensionsCache) {
            // No image, fall back to defaults
            return this._calculateDefaults(widgets);
        }

        const img = imageDimensionsCache;
        const imageAR = this._computeARFromDimensions(img.width, img.height);

        // Use image AR with dimension widgets
        const hasWidth = widgets.width?.value?.on;
        const hasHeight = widgets.height?.value?.on;
        const hasMP = widgets.mp?.value?.on;

        let baseW, baseH, dimensionSource;

        if (hasWidth) {
            baseW = widgets.width.value.value;
            baseH = Math.round(baseW / imageAR.ratio);
            dimensionSource = "WIDTH";
        } else if (hasHeight) {
            baseH = widgets.height.value.value;
            baseW = Math.round(baseH * imageAR.ratio);
            dimensionSource = "HEIGHT";
        } else if (hasMP) {
            const targetMP = widgets.mp.value.value * 1_000_000;
            baseH = Math.sqrt(targetMP / imageAR.ratio);
            baseW = Math.round(baseH * imageAR.ratio);
            baseH = Math.round(baseH);
            dimensionSource = "MEGAPIXEL";
        } else {
            // No dimension widget, use defaults with image AR
            const defaultMP = 1.0 * 1_000_000;
            baseH = Math.sqrt(defaultMP / imageAR.ratio);
            baseW = Math.round(baseH * imageAR.ratio);
            baseH = Math.round(baseH);
            dimensionSource = "defaults";
        }

        return {
            mode: "ar_only",
            priority: 4,
            baseW: baseW,
            baseH: baseH,
            source: "image_ar",
            ar: imageAR,
            conflicts: this._detectConflicts("ar_only", widgets),
            description: `${dimensionSource} & image_ar: ${imageAR.aspectW}:${imageAR.aspectH} (${img.width}×${img.height})`
        };
    }

    _calculateWidthWithAR(widgets) {
        const w = widgets.width.value.value;
        const ar = this._getActiveAspectRatio(widgets);
        const h = Math.round(w / ar.ratio);

        return {
            mode: "width_with_ar",
            priority: 5,
            baseW: w,
            baseH: h,
            source: "widget_with_ar",
            ar: ar,
            conflicts: this._detectConflicts("width_with_ar", widgets),
            description: `WIDTH ${w} with AR ${ar.aspectW}:${ar.aspectH} (${ar.source})`,
            activeSources: ['WIDTH'] // Track enabled widgets
        };
    }

    _calculateHeightWithAR(widgets) {
        const h = widgets.height.value.value;
        const ar = this._getActiveAspectRatio(widgets);
        const w = Math.round(h * ar.ratio);

        return {
            mode: "height_with_ar",
            priority: 5,
            baseW: w,
            baseH: h,
            source: "widget_with_ar",
            ar: ar,
            conflicts: this._detectConflicts("height_with_ar", widgets),
            description: `HEIGHT ${h} with AR ${ar.aspectW}:${ar.aspectH} (${ar.source})`,
            activeSources: ['HEIGHT'] // Track enabled widgets
        };
    }

    _calculateMPWithAR(widgets) {
        const targetMP = widgets.mp.value.value * 1_000_000;
        const ar = this._getActiveAspectRatio(widgets);

        const h = Math.sqrt(targetMP / ar.ratio);
        const w = h * ar.ratio;

        return {
            mode: "mp_with_ar",
            priority: 5,
            baseW: Math.round(w),
            baseH: Math.round(h),
            source: "widget_with_ar",
            ar: ar,
            conflicts: this._detectConflicts("mp_with_ar", widgets),
            description: `MEGAPIXEL ${widgets.mp.value.value}MP with AR ${ar.aspectW}:${ar.aspectH} (${ar.source})`,
            activeSources: ['MEGAPIXEL'] // Track enabled widgets
        };
    }

    _calculateDefaults(widgets) {
        const ar = this._getActiveAspectRatio(widgets);
        const defaultMP = 1.0 * 1_000_000;

        const h = Math.sqrt(defaultMP / ar.ratio);
        const w = h * ar.ratio;

        return {
            mode: "defaults_with_ar",
            priority: 6,
            baseW: Math.round(w),
            baseH: Math.round(h),
            source: "defaults",
            ar: ar,
            conflicts: [],
            description: `Defaults: 1.0MP with AR ${ar.aspectW}:${ar.aspectH} (${ar.source})`
        };
    }

    // ========================================
    // Aspect Ratio Determination
    // ========================================

    /**
     * Get active aspect ratio based on context.
     * Priority: custom_ratio > image AR (if AR Only mode) > aspect_ratio dropdown
     */
    _getActiveAspectRatio(widgets) {
        // Priority 1: custom_ratio (if enabled)
        if (widgets.customRatioToggle?.value) {
            const customARText = widgets.customRatioText?.value || "1:1";
            return this._parseCustomAspectRatio(customARText, "custom_ratio");
        }

        // Priority 2: Image AR (if AR Only mode)
        if (widgets.imageMode?.value?.on && widgets.imageMode.value.value === 0) {
            const scaleWidget = this.node.widgets.find(w => w.name === "scale");
            if (scaleWidget?.imageDimensionsCache) {
                const img = scaleWidget.imageDimensionsCache;
                const ar = this._computeARFromDimensions(img.width, img.height);
                return { ...ar, source: "image" };
            }
        }

        // Priority 3: aspect_ratio dropdown
        const arValue = widgets.aspectRatio?.value || "16:9 (HD Video/YouTube/TV)";
        return this._parseDropdownAspectRatio(arValue, "dropdown");
    }

    // ========================================
    // Helper Methods
    // ========================================

    _getWidgets() {
        return {
            imageMode: this.node.widgets.find(w => w.name === "image_mode"),
            width: this.node.widgets.find(w => w.name === "dimension_width"),
            height: this.node.widgets.find(w => w.name === "dimension_height"),
            mp: this.node.widgets.find(w => w.name === "dimension_megapixel"),
            customRatioToggle: this.node.widgets.find(w => w.name === "custom_ratio"),
            customRatioText: this.node.widgets.find(w => w.name === "custom_aspect_ratio"),
            aspectRatio: this.node.widgets.find(w => w.name === "aspect_ratio")
        };
    }

    _computeARFromDimensions(w, h) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(w, h);
        const aspectW = w / divisor;
        const aspectH = h / divisor;
        const ratio = w / h;

        return { ratio, aspectW, aspectH };
    }

    _parseCustomAspectRatio(text, source) {
        // Parse "W:H" format
        const match = text.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
        if (match) {
            const w = parseFloat(match[1]);
            const h = parseFloat(match[2]);
            return { ratio: w / h, aspectW: w, aspectH: h, source };
        }
        // Fallback
        return { ratio: 16 / 9, aspectW: 16, aspectH: 9, source: "fallback" };
    }

    _parseDropdownAspectRatio(value, source) {
        // Extract "W:H" from dropdown text (e.g., "16:9 (HD Video/YouTube/TV)" → 16:9)
        const match = value.match(/^(\d+):(\d+)/);
        if (match) {
            const w = parseInt(match[1]);
            const h = parseInt(match[2]);
            return { ratio: w / h, aspectW: w, aspectH: h, source };
        }
        // Fallback
        return { ratio: 16 / 9, aspectW: 16, aspectH: 9, source: "fallback" };
    }

    _detectConflicts(activeMode, widgets) {
        const conflicts = [];

        // Exact Dims conflicts
        if (activeMode === "exact_dims") {
            if (widgets.width?.value?.on || widgets.height?.value?.on) {
                conflicts.push({
                    type: "exact_dims_overrides_widgets",
                    severity: "info",
                    message: "⚠️ Exact Dims mode ignores WIDTH/HEIGHT toggles",
                    affectedWidgets: ["dimension_width", "dimension_height"]
                });
            }
            if (widgets.mp?.value?.on) {
                conflicts.push({
                    type: "exact_dims_overrides_mp",
                    severity: "info",
                    message: "⚠️ Exact Dims mode ignores MEGAPIXEL setting",
                    affectedWidgets: ["dimension_megapixel"]
                });
            }
        }

        // MP Scalar conflicts (Priority 2)
        if (activeMode === "mp_scalar_with_ar") {
            if (widgets.customRatioToggle?.value) {
                conflicts.push({
                    type: "mp_scalar_overrides_custom_ar",
                    severity: "warning",
                    message: "⚠️ WIDTH+HEIGHT creates explicit AR, overriding custom_ratio",
                    affectedWidgets: ["custom_ratio", "custom_aspect_ratio"]
                });
            }
            if (widgets.imageMode?.value?.on && widgets.imageMode.value.value === 0) {
                conflicts.push({
                    type: "mp_scalar_overrides_image_ar",
                    severity: "warning",
                    message: "⚠️ WIDTH+HEIGHT creates explicit AR, overriding image AR",
                    affectedWidgets: ["image_mode"]
                });
            }
        }

        // Explicit dimension conflicts (Priority 3)
        if (["width_height_explicit", "mp_width_explicit", "mp_height_explicit"].includes(activeMode)) {
            if (widgets.customRatioToggle?.value) {
                conflicts.push({
                    type: "explicit_dims_overrides_custom_ar",
                    severity: "warning",
                    message: "⚠️ Explicit dimensions create implied AR, overriding custom_ratio",
                    affectedWidgets: ["custom_ratio", "custom_aspect_ratio"]
                });
            }
            if (widgets.imageMode?.value?.on && widgets.imageMode.value.value === 0) {
                conflicts.push({
                    type: "explicit_dims_overrides_image_ar",
                    severity: "warning",
                    message: "⚠️ Explicit dimensions create implied AR, overriding image AR",
                    affectedWidgets: ["image_mode"]
                });
            }
            const arWidget = widgets.aspectRatio;
            if (arWidget) {
                conflicts.push({
                    type: "explicit_dims_overrides_dropdown_ar",
                    severity: "info",
                    message: "⚠️ Explicit dimensions create implied AR, ignoring dropdown",
                    affectedWidgets: ["aspect_ratio"]
                });
            }
        }

        // AR Only conflicts
        if (activeMode === "ar_only") {
            if (widgets.customRatioToggle?.value) {
                conflicts.push({
                    type: "ar_only_overrides_custom",
                    severity: "warning",
                    message: "⚠️ AR Only mode uses image AR, overriding custom_ratio",
                    affectedWidgets: ["custom_ratio", "custom_aspect_ratio"]
                });
            }
        }

        return conflicts;
    }

    /**
     * Clear cache (call when widgets change)
     */
    invalidateCache() {
        this.cache.dimensionSource = null;
        this.cache.timestamp = 0;
    }
}
