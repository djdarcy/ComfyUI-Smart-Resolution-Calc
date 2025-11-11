/**
 * DimensionSourceManager
 *
 * Thin client wrapper that calls Python API for dimension calculations.
 * Python is the single source of truth for all dimension/AR calculations.
 *
 * This class handles:
 * - Serializing widget state for Python API
 * - Calling /smart-resolution/calculate-dimensions endpoint
 * - Caching results (100ms TTL)
 * - Error handling with fallback
 *
 * Related Issues: #15 (umbrella), #19 (Python parity), #27 (consolidation)
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
     * @returns {Promise<Object>} Dimension source result from Python API
     */
    async getActiveDimensionSource(forceRefresh = false, runtimeContext = {}) {
        const now = Date.now();

        // Return cached result if valid
        if (!forceRefresh && this.cache.dimensionSource &&
            (now - this.cache.timestamp < this.cache.ttl)) {
            return this.cache.dimensionSource;
        }

        // Calculate fresh result with runtime context (calls Python API)
        const result = await this._calculateDimensionSource(runtimeContext);

        // Update cache
        this.cache.dimensionSource = result;
        this.cache.timestamp = now;

        return result;
    }

    /**
     * Internal calculation logic - CALLS PYTHON API for single source of truth
     *
     * Python handles all dimension calculations using DimensionSourceCalculator class.
     * This eliminates code duplication and prevents JS/Python drift (v0.4.11 bug).
     *
     * UI vs Backend State Management:
     * --------------------------------
     * UI STATE (JavaScript widgets):
     *   - imageMode.value.on: Toggle visible in UI (persists when image disconnects)
     *   - imageMode.value.value: Mode selector (0=AR Only, 1=Exact Dims)
     *   - imageMode.imageDisconnected: Connection tracking (true = no image)
     *
     * BACKEND STATE (sent to Python):
     *   - image_mode_enabled: Whether Python should use image-based calculations
     *   - image_mode_value: Which image mode to use (0=AR Only, 1=Exact Dims)
     *
     * CRITICAL: UI and Backend states can differ!
     *   - UX Benefit: Toggle stays ON when image disconnects (easy reconnection)
     *   - Backend Override: image_mode_enabled forced to false when no valid image
     *   - All logic decisions MUST use backend state (what Python receives)
     *
     * Validation Override Scenarios (Scenario 2):
     *   - no_connection: No image input connected → override to false
     *   - disabled_source: Source node disabled → override to false
     *   - broken_link: Connection broken → override to false
     *   - Other errors: Treat as invalid source → override to false
     *
     * @param {Object} runtimeContext - Runtime data including imageDimensionsCache
     * @returns {Promise<Object>} Dimension source result
     */
    async _calculateDimensionSource(runtimeContext = {}) {
        const widgets = this._getWidgets();
        const { imageDimensionsCache } = runtimeContext;

        logger.debug('[Manager] Calling Python API for dimension calculation');
        logger.verbose('[Manager] runtimeContext:', runtimeContext);
        logger.verbose('[Manager] imageDimensionsCache:', imageDimensionsCache);

        // Build widget state dictionary for Python API
        // Note: Toggle widgets (like custom_ratio) store boolean directly in .value
        // Dimension widgets store {on: bool, value: number} in .value
        const widgetState = {
            width_enabled: widgets.width?.value?.on || false,
            width_value: widgets.width?.value?.value || 1024,
            height_enabled: widgets.height?.value?.on || false,
            height_value: widgets.height?.value?.value || 1024,
            mp_enabled: widgets.mp?.value?.on || false,
            mp_value: widgets.mp?.value?.value || 1.0,
            image_mode_enabled: widgets.imageMode?.value?.on || false,  // UI state (may be overridden)
            image_mode_value: widgets.imageMode?.value?.value || 0,
            custom_ratio_enabled: widgets.customRatioToggle?.value || false,  // Direct boolean, not .on
            custom_aspect_ratio: widgets.customRatioText?.value || '5.2:2.5',
            aspect_ratio_dropdown: widgets.aspectRatio?.value || '16:9'
        };

        logger.debug('[Manager] Widget state being sent to Python:', {
            custom_ratio_enabled: widgetState.custom_ratio_enabled,
            custom_aspect_ratio: widgetState.custom_aspect_ratio,
            customRatioToggle_value: widgets.customRatioToggle?.value,
            customRatioText_value: widgets.customRatioText?.value
        });

        // Build runtime context for Python API
        const apiContext = {};
        if (imageDimensionsCache) {
            apiContext.image_info = {
                width: imageDimensionsCache.width,
                height: imageDimensionsCache.height
            };
        }

        // Validate image source before API call (Scenario 2: Invalid Source Detection)
        const imageInput = this.node.inputs?.find(inp => inp.name === "image");
        const sourceValidation = this.node._validateImageSource(imageInput);

        logger.debug('[Manager] Image source validation:', sourceValidation);

        // CRITICAL: Override backend state if image source invalid (UI/Backend state disconnect)
        // UI toggle may be ON (for easy reconnection), but Python should ignore it
        if (!sourceValidation.valid) {
            const uiState = widgetState.image_mode_enabled;
            widgetState.image_mode_enabled = false;  // Force Python to ignore image mode
            logger.debug(`[Manager] Image source invalid (${sourceValidation.reason}) - overriding backend state:`);
            logger.debug(`  UI state: image_mode_enabled=${uiState} (toggle visible to user)`);
            logger.debug(`  Backend state: image_mode_enabled=false (sent to Python)`);
            logger.debug(`  UX: Toggle stays ON for easy reconnection, but calculations use defaults`);
        }

        try {
            // Call Python API
            const response = await fetch('/smart-resolution/calculate-dimensions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    widgets: widgetState,
                    runtime_context: apiContext
                })
            });

            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Unknown API error');
            }

            logger.debug('[Manager] Python API success:', result);

            // Inject source validation warnings if source is invalid (Scenario 2)
            if (!sourceValidation.valid && result.dimSource) {
                const sourceConflict = this._createSourceConflict(sourceValidation);
                result.dimSource.conflicts = result.dimSource.conflicts || [];
                result.dimSource.conflicts.push(sourceConflict);
                logger.debug('[Manager] Injected source validation conflict:', sourceConflict);
            }

            return result;

        } catch (error) {
            logger.error(`[Manager] Python API call failed: ${error.message}`);
            // Return error result with fallback dimensions
            return {
                mode: 'error',
                priority: -1,
                baseW: 1920,
                baseH: 1080,
                source: 'fallback',
                ar: { ratio: 16/9, aspectW: 16, aspectH: 9, source: 'fallback' },
                conflicts: [{
                    type: 'api_error',
                    severity: 'error',
                    message: `⚠️ Failed to calculate dimensions: ${error.message}`,
                    affectedWidgets: []
                }],
                description: `Error: ${error.message} (using fallback 1920×1080)`,
                activeSources: []
            };
        }
    }

    /**
     * Get widget references from node
     * @returns {Object} Widget references
     */
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

    /**
     * Create conflict object for invalid image source (Scenario 2)
     * Converts validation result into conflict object compatible with existing warning system.
     *
     * @param {Object} validation - Validation result from _validateImageSource()
     * @returns {Object} Conflict object for warning system
     */
    _createSourceConflict(validation) {
        const messages = {
            'no_connection': 'No image connected',
            'broken_link': 'Image connection is broken',
            'missing_node': 'Source node not found',
            'circular_reference': 'Circular reference in image connections',
            'disabled_source': `Image source "${validation.nodeName}" is disabled - using defaults`,
            'reroute_no_input': 'Reroute node has no input',
            'max_depth_exceeded': 'Image connection chain too deep (possible circular reference)'
        };

        return {
            type: 'invalid_image_source',
            severity: validation.severity,
            message: messages[validation.reason] || `Invalid image source: ${validation.reason}`,
            affectedWidgets: ['image_mode'],
            validationDetails: validation  // Include full details for debugging
        };
    }

    /**
     * Clear cache (call when widgets change)
     */
    invalidateCache() {
        this.cache.dimensionSource = null;
        this.cache.timestamp = 0;
    }
}
