/**
 * Smart Resolution Calculator - Compact Custom Widgets
 *
 * rgthree-style compact widgets with toggle on LEFT, value on RIGHT
 * Reduced spacing and height for professional, space-efficient layout
 *
 * COMPATIBILITY NOTE:
 * Uses dynamic imports with auto-depth detection to work in both:
 * - Standalone mode: /extensions/smart-resolution-calc/
 * - DazzleNodes mode: /extensions/DazzleNodes/smart-resolution-calc/
 */

// Dynamic import helper for standalone vs DazzleNodes compatibility (Option A: Inline)
async function importComfyCore() {
    const currentPath = import.meta.url;
    const urlParts = new URL(currentPath).pathname.split('/').filter(p => p);
    const depth = urlParts.length; // Each part requires one ../ to traverse up
    const prefix = '../'.repeat(depth);

    const [appModule, tooltipModule] = await Promise.all([
        import(`${prefix}scripts/app.js`),
        import('./tooltip_content.js')
    ]);

    return {
        app: appModule.app,
        TOOLTIP_CONTENT: tooltipModule.TOOLTIP_CONTENT
    };
}

// Initialize extension with dynamic imports
(async () => {
    // Import ComfyUI app and local tooltip content
    const { app, TOOLTIP_CONTENT } = await importComfyCore();

/**
 * Debug Logger - Multi-level logging
 *
 * Levels (from most to least verbose):
 * - VERBOSE: Detailed internal state (mouse events, hit areas, every step)
 * - DEBUG: Standard debugging (user actions, state changes)
 * - INFO: Important events (always shown when debug enabled)
 *
 * Enable debug: localStorage.setItem('DEBUG_SMART_RES_CALC', 'true')
 * Enable verbose: localStorage.setItem('VERBOSE_SMART_RES_CALC', 'true')
 * Disable: localStorage.removeItem('DEBUG_SMART_RES_CALC')
 */
class DebugLogger {
    constructor(name) {
        this.name = name;
        // Check localStorage OR URL parameter for debug/verbose mode
        this.debugEnabled = localStorage.getItem('DEBUG_SMART_RES_CALC') === 'true' ||
                           window.location.search.includes('debug=smart-res');
        this.verboseEnabled = localStorage.getItem('VERBOSE_SMART_RES_CALC') === 'true' ||
                             window.location.search.includes('verbose=smart-res');

        if (this.verboseEnabled) {
            console.log(`[${this.name}] Verbose mode enabled (includes all debug messages)`);
        } else if (this.debugEnabled) {
            console.log(`[${this.name}] Debug mode enabled`);
        }
    }

    // VERBOSE: Detailed internal state (mouse coords, hit areas, serialization)
    verbose(...args) {
        if (this.verboseEnabled) {
            console.log(`[${this.name}] VERBOSE:`, ...args);
        }
    }

    // DEBUG: Standard debugging (user actions, state changes)
    debug(...args) {
        if (this.debugEnabled || this.verboseEnabled) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    // INFO: Important events (always shown when debug enabled)
    info(...args) {
        if (this.debugEnabled || this.verboseEnabled) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    // ERROR: Always shown
    error(...args) {
        console.error(`[${this.name}] ERROR:`, ...args);
    }

    group(label) {
        if (this.debugEnabled || this.verboseEnabled) console.group(`[${this.name}] ${label}`);
    }

    groupEnd() {
        if (this.debugEnabled || this.verboseEnabled) console.groupEnd();
    }
}

const logger = new DebugLogger('SmartResCalc');
const visibilityLogger = new DebugLogger('SmartResCalc:Visibility');

// Expose loggers globally for debugging
window.smartResCalcLogger = logger;
window.smartResCalcVisibilityLogger = visibilityLogger;

/**
 * Toggle Behavior Modes
 *
 * Controls when a toggle can be enabled/disabled.
 *
 * - SYMMETRIC: Can toggle both ON→OFF and OFF→ON freely
 *   Example: DimensionWidget can be enabled/disabled anytime
 *
 * - ASYMMETRIC: Can toggle one direction freely, other direction has constraints
 *   Example: ImageModeWidget can be disabled anytime, but can only be enabled when image connected
 */
const ToggleBehavior = {
    SYMMETRIC: 'symmetric',      // Can toggle both directions freely
    ASYMMETRIC: 'asymmetric'     // One direction free, other has constraints
};

/**
 * Value Behavior Modes
 *
 * Controls when widget values can be edited.
 *
 * - ALWAYS: Values are always editable regardless of toggle state
 *   Example: DimensionWidget values can be edited even when toggle is OFF
 *
 * - CONDITIONAL: Values only editable when certain conditions met
 *   Example: ImageModeWidget mode selector only editable when toggle is ON and image connected
 */
const ValueBehavior = {
    ALWAYS: 'always',            // Always editable
    CONDITIONAL: 'conditional'   // Only editable when conditions met
};

/**
 * Tooltip Manager - Singleton for tooltip rendering and state management
 *
 * Manages tooltip display on canvas with three-level help system:
 * - Quick (hover): Shows after hoverDelay (default 500ms)
 * - Full (extended hover): Shows after fullDelay (default 2s)
 * - Docs (click icon): Opens external documentation in browser
 *
 * Features:
 * - Canvas-based rendering with text wrapping
 * - Smart positioning (flips to avoid clipping)
 * - Configurable delays per tooltip
 * - Global show/hide toggle via localStorage
 */
class TooltipManager {
    constructor() {
        this.activeTooltip = null;
        this.hoverStartTime = null;
        this.quickShown = false;
        this.fullShown = false;

        // Load config from localStorage
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const config = localStorage.getItem('smart-res-calc-tooltip-config');
            return config ? JSON.parse(config) : {
                showInfoIcons: true,
                defaultDelay: 250,    // Quick tooltip delay (ms) - snappier feel
                fullDelay: 1500,      // Full tooltip delay (ms) - faster access to full info
                advancedMode: false
            };
        } catch (e) {
            return { showInfoIcons: true, defaultDelay: 250, fullDelay: 1500 };
        }
    }

    saveConfig() {
        try {
            localStorage.setItem('smart-res-calc-tooltip-config', JSON.stringify(this.config));
            logger.debug('Saved tooltip config:', this.config);
        } catch (e) {
            logger.error('Failed to save tooltip config:', e);
        }
    }

    startHover(tooltipContent, iconBounds, canvasBounds, nodePos) {
        this.hoverStartTime = Date.now();

        // Convert icon bounds from node-local to canvas-global coordinates
        const globalBounds = nodePos ? {
            x: iconBounds.x + nodePos[0],
            y: iconBounds.y + nodePos[1],
            width: iconBounds.width,
            height: iconBounds.height
        } : iconBounds;

        // Store canvas-global bounds (will be converted to screen coords in graph-level draw)
        this.activeTooltip = {
            content: tooltipContent,
            bounds: globalBounds,
            position: null // Calculated at draw time with screen coords
        };
        this.quickShown = false;
        this.fullShown = false;
    }

    updateHover() {
        if (!this.activeTooltip) return;

        const elapsed = Date.now() - this.hoverStartTime;
        const delay = this.activeTooltip.content.hoverDelay || this.config.defaultDelay;

        if (!this.quickShown && elapsed >= delay) {
            this.quickShown = true;
        }

        if (!this.fullShown && elapsed >= this.config.fullDelay) {
            this.fullShown = true;
        }
    }

    endHover() {
        if (this.activeTooltip) {
        }
        this.activeTooltip = null;
        this.hoverStartTime = null;
        this.quickShown = false;
        this.fullShown = false;
    }

    calculateTooltipPosition(iconBounds, canvasBounds) {
        // Smart positioning: right of icon by default, flip left if clipping
        const tooltipWidth = 300;
        const tooltipHeight = 150; // Approximate, will be calculated during draw


        let x = iconBounds.x + iconBounds.width + 10; // 10px right of icon
        let y = iconBounds.y;

        // Check right edge clipping
        if (canvasBounds && x + tooltipWidth > canvasBounds.width) {
            x = iconBounds.x - tooltipWidth - 10; // Flip to left
        }

        // Check bottom edge clipping
        if (canvasBounds && y + tooltipHeight > canvasBounds.height) {
            y = Math.max(10, canvasBounds.height - tooltipHeight - 10);
        }


        return { x, y };
    }

    draw(ctx, canvasBounds) {
        if (!this.activeTooltip || !this.config.showInfoIcons) return;

        this.updateHover();

        const tooltip = this.activeTooltip;
        const pos = tooltip.position;

        // Determine which content to show
        let content = '';
        if (this.fullShown && tooltip.content.full) {
            content = tooltip.content.full;
        } else if (this.quickShown && tooltip.content.quick) {
            content = tooltip.content.quick;
        }

        if (!content) {
            return;
        }

        // Draw tooltip
        const padding = 12;
        const lineHeight = 16;
        const maxWidth = 280; // Reduced from 300 for better text wrapping with padding

        // Wrap text
        const lines = this.wrapText(ctx, content, maxWidth - padding * 2);
        const tooltipHeight = lines.length * lineHeight + padding * 2;

        ctx.save();

        // Background with border
        ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Use roundRect if available, otherwise regular rect
        if (ctx.roundRect) {
            ctx.roundRect(pos.x, pos.y, maxWidth, tooltipHeight, 4);
        } else {
            ctx.rect(pos.x, pos.y, maxWidth, tooltipHeight);
        }
        ctx.fill();
        ctx.stroke();


        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';

        lines.forEach((line, i) => {
            ctx.fillText(line, pos.x + padding, pos.y + padding + i * lineHeight);
        });

        // Doc link indicator (if full tooltip and has docsUrl)
        if (this.fullShown && tooltip.content.docsUrl) {
            const linkY = pos.y + tooltipHeight - padding - lineHeight;
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('Click icon for full docs →', pos.x + padding, linkY);
        }

        ctx.restore();
    }

    drawAtScreenCoords(ctx, screenBounds, canvasBounds) {
        // Draw tooltip at graph level using screen coordinates
        // Called from app.canvas.onDrawForeground with identity transform

        if (!this.activeTooltip || !this.config.showInfoIcons) return;

        this.updateHover();

        const tooltip = this.activeTooltip;

        logger.verbose(`quickShown: ${this.quickShown}, fullShown: ${this.fullShown}`);

        // Determine which content to show
        let content = '';
        if (this.fullShown && tooltip.content.full) {
            content = tooltip.content.full;
        } else if (this.quickShown && tooltip.content.quick) {
            content = tooltip.content.quick;
        }

        if (!content) {
            return;
        }


        // Calculate tooltip position in screen space
        const tooltipWidth = 280;
        const tooltipHeight = 150; // Will be recalculated after text wrapping

        let x = screenBounds.x + screenBounds.width + 10; // 10px right of icon
        let y = screenBounds.y;

        // Check right edge clipping
        if (x + tooltipWidth > canvasBounds.width) {
            x = screenBounds.x - tooltipWidth - 10; // Flip to left
        }

        // Check bottom edge clipping
        if (y + tooltipHeight > canvasBounds.height) {
            y = Math.max(10, canvasBounds.height - tooltipHeight - 10);
        }


        // Draw tooltip
        const padding = 12;
        const lineHeight = 16;
        const maxWidth = 280;

        // Wrap text
        const lines = this.wrapText(ctx, content, maxWidth - padding * 2);

        // Calculate height - include extra line for doc link if showing full tooltip with docs
        const hasDocLink = this.fullShown && tooltip.content.docsUrl;
        const contentLines = lines.length + (hasDocLink ? 1 : 0);
        const actualTooltipHeight = contentLines * lineHeight + padding * 2;

        // Recheck bottom clipping with actual height
        if (y + actualTooltipHeight > canvasBounds.height) {
            y = Math.max(10, canvasBounds.height - actualTooltipHeight - 10);
        }


        ctx.save();

        // Background with border
        ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, maxWidth, actualTooltipHeight, 4);
        } else {
            ctx.rect(x, y, maxWidth, actualTooltipHeight);
        }
        ctx.fill();
        ctx.stroke();


        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';

        lines.forEach((line, i) => {
            ctx.fillText(line, x + padding, y + padding + i * lineHeight);
        });

        // Doc link indicator (if full tooltip and has docsUrl)
        // Render on the line AFTER the last content line
        if (hasDocLink) {
            const linkY = y + padding + lines.length * lineHeight;
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('Shift+Click label for full docs →', x + padding, linkY);
        }

        ctx.restore();
    }

    wrapText(ctx, text, maxWidth) {
        const lines = [];
        const paragraphs = text.split('\n');

        ctx.font = '12px sans-serif'; // Ensure font is set for measurement

        paragraphs.forEach(paragraph => {
            if (!paragraph.trim()) {
                lines.push('');
                return;
            }

            const words = paragraph.split(' ');
            let currentLine = '';

            words.forEach(word => {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });

            if (currentLine) {
                lines.push(currentLine);
            }
        });

        return lines;
    }

    handleClick(tooltipContent) {
        if (tooltipContent.docsUrl) {
            window.open(tooltipContent.docsUrl, '_blank');
            logger.info('Opened docs:', tooltipContent.docsUrl);
        } else {
            logger.debug('No docs URL available for this tooltip');
        }
    }
}

/**
 * Info Icon - Label text tooltip trigger (no icon drawn)
 *
 * Uses label text as tooltip trigger area - no visual icon.
 * Hover over label shows tooltip, Shift+Click opens docs.
 * Integrates with TooltipManager for hover state and tooltip display.
 *
 * Usage:
 * - Add to widget: this.infoIcon = new InfoIcon(TOOLTIP_CONTENT.widget_name)
 * - Set hit area: this.infoIcon.setHitArea(labelX, labelY, labelWidth, labelHeight)
 * - Mouse: if (this.infoIcon.mouse(event, pos, canvasBounds, nodePos)) return true;
 *
 * Note: No visible icon is drawn - the label text itself is the interactive area.
 */
class InfoIcon {
    constructor(tooltipContent) {
        this.content = tooltipContent;
        this.hitArea = { x: 0, y: 0, width: 0, height: 0 };
        this.isHovering = false;
    }

    /**
     * Set the hit area for tooltip triggering (replaces icon drawing)
     * Call this after drawing the label text to set the interactive region.
     *
     * @param {number} x - Label text X position
     * @param {number} y - Label text Y position
     * @param {number} width - Label text width (from ctx.measureText())
     * @param {number} height - Label text height (typically line height or widget height)
     */
    setHitArea(x, y, width, height) {
        if (!tooltipManager.config.showInfoIcons) return;

        // Store label bounds as hit area
        this.hitArea = { x, y, width, height };

    }

    /**
     * Legacy draw method - now just calls setHitArea for backwards compatibility
     * @deprecated Use setHitArea() instead
     */
    draw(ctx, x, y, height, canvasBounds) {
        // Backwards compatibility - assume this is icon position, not label
        // Widget should call setHitArea() with actual label bounds instead
        this.setHitArea(x, y, 14, height);
    }

    mouse(event, pos, canvasBounds, nodePos) {
        if (!tooltipManager.config.showInfoIcons) return false;

        const inBounds = this.isInBounds(pos, this.hitArea);


        if (event.type === 'pointermove') {
            if (inBounds && !this.isHovering) {
                // Start hover (convert node-local to canvas-global coords)
                this.isHovering = true;
                tooltipManager.startHover(this.content, this.hitArea, canvasBounds, nodePos);
                return true;
            } else if (!inBounds && this.isHovering) {
                // End hover
                this.isHovering = false;
                tooltipManager.endHover();
                return false;
            }
        }

        if (event.type === 'pointerdown' && inBounds) {
            // Shift+Click to open docs (prevents conflicts with normal clicks)
            if (event.shiftKey) {
                tooltipManager.handleClick(this.content);
                return true;
            }
            // Regular click without shift - don't consume event (let widget handle it)
            return false;
        }

        return inBounds;
    }

    isInBounds(pos, bounds) {
        return pos[0] >= bounds.x &&
               pos[0] <= bounds.x + bounds.width &&
               pos[1] >= bounds.y &&
               pos[1] <= bounds.y + bounds.height;
    }
}

// Singleton instance
const tooltipManager = new TooltipManager();

/**
 * Add tooltip support to a native ComfyUI widget
 * Only wraps mouse() method - does NOT modify draw() to avoid breaking widget rendering
 *
 * @param {object} widget - Native ComfyUI widget (combo, text, etc.)
 * @param {object} tooltipContent - Tooltip content from TOOLTIP_CONTENT
 * @param {object} node - The LiteGraph node containing the widget
 */
function wrapWidgetWithTooltip(widget, tooltipContent, node) {
    // Create InfoIcon for this widget
    widget.infoIcon = new InfoIcon(tooltipContent);

    // Store original mouse method
    const originalMouse = widget.mouse;

    // Wrap mouse method to handle tooltip events
    widget.mouse = function(event, pos, node) {
        // Check tooltip first
        if (this.infoIcon) {
            const canvasBounds = { width: node.size[0], height: node.size[1] };
            const tooltipHandled = this.infoIcon.mouse(event, pos, canvasBounds, node.pos);
            if (tooltipHandled) {
                node.setDirtyCanvas(true);
                return true; // Tooltip handled the event
            }
        }

        // Call original mouse handler
        if (originalMouse) {
            return originalMouse.call(this, event, pos, node);
        }
        return false;
    };
}

/**
 * Shared utilities for image dimension extraction
 * Used by both CopyImageButton and ScaleWidget to avoid code duplication
 */
const ImageDimensionUtils = {
    /**
     * Extract file path from LoadImage node
     * Returns null if not a LoadImage node or path not found
     */
    getImageFilePath(sourceNode) {
        if (!sourceNode) return null;

        // Check if this is a LoadImage node
        if (sourceNode.type === "LoadImage" || sourceNode.title?.includes("Load Image")) {
            // Try to get the image filename from the widget
            const imageWidget = sourceNode.widgets?.find(w => w.name === "image");
            if (imageWidget && imageWidget.value) {
                logger.verbose(`Found LoadImage with filename: ${imageWidget.value}`);
                return imageWidget.value;
            }
        }

        logger.verbose(`Source node type: ${sourceNode.type} - not a LoadImage node`);
        return null;
    },

    /**
     * Fetch dimensions from server endpoint
     * Returns {width, height, success} or null on failure
     */
    async fetchDimensionsFromServer(imagePath) {
        try {
            const response = await fetch('/smart-resolution/get-dimensions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image_path: imagePath })
            });

            if (!response.ok) {
                logger.verbose(`Server responded with status: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data;
        } catch (e) {
            logger.verbose(`Server request failed: ${e}`);
            return null;
        }
    },

    /**
     * Parse dimensions from cached info output
     * Looks for patterns like "From Image (Exact: 1920×1080)" or "From Image (AR: 16:9)"
     * Returns {width, height, success: true} or null
     */
    parseDimensionsFromInfo(node) {
        // Get the info widget value (last execution output)
        const infoWidget = node.widgets?.find(w => w.name === "info");
        if (!infoWidget || !infoWidget.value) {
            logger.verbose("No info widget or value found for dimension parsing");
            return null;
        }

        const infoText = infoWidget.value;
        logger.verbose(`Parsing info text: ${infoText}`);

        // Pattern: "From Image (Exact: 1920×1080)" or "From Image (AR: 16:9)"
        // Extract the source dimensions
        const match = infoText.match(/From Image \((?:Exact|AR): (\d+)×(\d+)\)/);
        if (match) {
            return {
                width: parseInt(match[1]),
                height: parseInt(match[2]),
                success: true
            };
        }

        logger.verbose("No dimension pattern found in info text");
        return null;
    }
};

/**
 * Custom scale multiplier widget
 * Features:
 * - 1.0x visually centered (asymmetric: 30% for 0-1.0, 70% for 1.0-10.0)
 * - Variable steps (0.05 below 1.0, 0.1 above)
 * - Click numeric value to edit
 * - Muted appearance at 1.0 (neutral/inactive state)
 */
class ScaleWidget {
    constructor(name, defaultValue = 1.0) {
        this.name = name;
        this.type = "custom";
        this.value = defaultValue;
        this.min = 0.0;
        this.max = 10.0;

        // Visual layout: 0-1.0 takes 30% of slider, 1.0-10.0 takes 70%
        this.centerPoint = 1.0;
        this.leftPortion = 0.3;  // 30% for 0-1.0
        this.rightPortion = 0.7; // 70% for 1.0-10.0

        // Configurable step sizes
        this.leftStep = 0.05;   // Step size below 1.0x
        this.rightStep = 0.1;   // Step size at/above 1.0x
        this.showingSettings = false;

        // Mouse state
        this.mouseDowned = null;
        this.isDragging = false;
        this.isHovering = false;
        this.tooltipTimeout = null;

        // Hit areas
        this.hitAreas = {
            slider: { x: 0, y: 0, width: 0, height: 0 },
            handle: { x: 0, y: 0, width: 0, height: 0 },
            valueEdit: { x: 0, y: 0, width: 0, height: 0 },
            settingsIcon: { x: 0, y: 0, width: 0, height: 0 },
            leftStepValue: { x: 0, y: 0, width: 0, height: 0 },
            leftStepDown: { x: 0, y: 0, width: 0, height: 0 },
            leftStepUp: { x: 0, y: 0, width: 0, height: 0 },
            rightStepValue: { x: 0, y: 0, width: 0, height: 0 },
            rightStepDown: { x: 0, y: 0, width: 0, height: 0 },
            rightStepUp: { x: 0, y: 0, width: 0, height: 0 }
        };

        // Image dimension cache for tooltip preview
        // Stores actual image dimensions when USE_IMAGE is enabled
        this.imageDimensionsCache = null;  // {width, height, timestamp, path}
        this.fetchingDimensions = false;   // Prevent concurrent fetches

        // Tooltip support - label-based tooltip trigger
        this.infoIcon = new InfoIcon(TOOLTIP_CONTENT.scale);
    }

    /**
     * Get step size based on current value
     */
    getStepSize(value) {
        return value < 1.0 ? this.leftStep : this.rightStep;
    }

    /**
     * Convert value to slider position (asymmetric mapping)
     */
    valueToPosition(value, sliderWidth) {
        if (value <= this.centerPoint) {
            // Left side: 0 to 1.0 maps to 0% to 30% of slider
            const ratio = value / this.centerPoint;
            return ratio * this.leftPortion * sliderWidth;
        } else {
            // Right side: 1.0 to 10.0 maps to 30% to 100% of slider
            const ratio = (value - this.centerPoint) / (this.max - this.centerPoint);
            return (this.leftPortion + ratio * this.rightPortion) * sliderWidth;
        }
    }

    /**
     * Convert slider position to value (asymmetric mapping)
     */
    positionToValue(position, sliderWidth) {
        const ratio = position / sliderWidth;

        if (ratio <= this.leftPortion) {
            // Left side: 0% to 30% maps to 0 to 1.0
            return (ratio / this.leftPortion) * this.centerPoint;
        } else {
            // Right side: 30% to 100% maps to 1.0 to 10.0
            return this.centerPoint + ((ratio - this.leftPortion) / this.rightPortion) * (this.max - this.centerPoint);
        }
    }

    /**
     * Calculate preview dimensions for tooltip
     */
    calculatePreview(node) {
        // Check if we should fetch image dimensions (if USE_IMAGE enabled but cache empty)
        const imageModeWidget = node.widgets?.find(w => w.name === "image_mode");
        const useImage = imageModeWidget?.value?.on;

        if (useImage && !this.imageDimensionsCache && !this.fetchingDimensions) {
            // Trigger async fetch (won't block, but will populate cache for next time)
            logger.verbose('Scale preview: cache empty, triggering dimension fetch');
            this.refreshImageDimensions(node);
        }

        // Get current dimension values from the node's other widgets
        const mpWidget = node.widgets.find(w => w.name === "dimension_megapixel");
        const widthWidget = node.widgets.find(w => w.name === "dimension_width");
        const heightWidget = node.widgets.find(w => w.name === "dimension_height");
        const aspectRatioWidget = node.widgets.find(w => w.name === "aspect_ratio");

        if (!mpWidget || !widthWidget || !heightWidget) {
            return null;
        }

        // Parse aspect ratio from widget value (e.g., "16:9 (Panorama)" -> [16, 9])
        let aspectW = 16, aspectH = 9;
        if (aspectRatioWidget && aspectRatioWidget.value) {
            const match = aspectRatioWidget.value.match(/(\d+):(\d+)/);
            if (match) {
                aspectW = parseInt(match[1]);
                aspectH = parseInt(match[2]);
            }
        }
        const aspectRatio = aspectW / aspectH;

        // Determine calculation mode and base dimensions
        let baseW, baseH, baseMp;
        const useMp = mpWidget.value.on;
        const useWidth = widthWidget.value.on;
        const useHeight = heightWidget.value.on;

        // Check if we should use cached image dimensions
        const imageModeWidgetForCache = node.widgets?.find(w => w.name === "image_mode");
        const useImageForCache = imageModeWidgetForCache?.value?.on;
        const imageMode = imageModeWidgetForCache?.value?.value; // 0=AR Only, 1=Exact Dims

        logger.verbose(`[ScaleWidget] calculatePreview: USE_IMAGE=${useImageForCache}, mode=${imageMode === 0 ? 'AR Only' : imageMode === 1 ? 'Exact Dims' : 'unknown'}, cache=${this.imageDimensionsCache ? 'populated' : 'empty'}`);

        if (useImageForCache && this.imageDimensionsCache) {
            if (imageMode === 1) {
                // Exact Dims mode - use raw image dimensions (ignore all user settings)
                baseW = this.imageDimensionsCache.width;
                baseH = this.imageDimensionsCache.height;
                logger.info(`✓ Scale preview using exact image dimensions: ${baseW}×${baseH}`);
            } else {
                // AR Only mode (imageMode === 0) - extract AR and use with user's dimension settings
                const imageAR = this.imageDimensionsCache.width / this.imageDimensionsCache.height;

                // Validate AR before use
                if (isNaN(imageAR) || !isFinite(imageAR) || imageAR <= 0) {
                    logger.debug(`[ScaleWidget] Invalid image AR (${imageAR}), falling back to widget calculation`);
                    // Clear cache temporarily to trigger fallback
                    const savedCache = this.imageDimensionsCache;
                    this.imageDimensionsCache = null;
                    // Will fall through to widget-based calculation below
                    // Restore cache after (for next time)
                    setTimeout(() => { this.imageDimensionsCache = savedCache; }, 0);
                } else {
                    // Use image AR with user's dimension settings
                    logger.debug(`[ScaleWidget] AR Only mode - using image AR: ${imageAR.toFixed(3)}`);

                    if (useWidth && useHeight) {
                        // Both W+H specified - use as-is (ignore AR)
                        baseW = widthWidget.value.value;
                        baseH = heightWidget.value.value;
                        logger.verbose(`[ScaleWidget] Using user WIDTH+HEIGHT: ${baseW}×${baseH}`);
                    } else if (useWidth) {
                        // Width specified - calculate height from image AR
                        baseW = widthWidget.value.value;
                        baseH = Math.round(baseW / imageAR);
                        logger.verbose(`[ScaleWidget] Computed HEIGHT from WIDTH ${baseW} ÷ AR ${imageAR.toFixed(3)} = ${baseH}`);
                    } else if (useHeight) {
                        // Height specified - calculate width from image AR
                        baseH = heightWidget.value.value;
                        baseW = Math.round(baseH * imageAR);
                        logger.verbose(`[ScaleWidget] Computed WIDTH from HEIGHT ${baseH} × AR ${imageAR.toFixed(3)} = ${baseW}`);
                    } else if (useMp) {
                        // Megapixel mode - calculate from MP and image AR
                        const targetMp = mpWidget.value.value * 1_000_000;
                        baseH = Math.sqrt(targetMp / imageAR);
                        baseW = baseH * imageAR;
                        logger.verbose(`[ScaleWidget] Computed from MP ${mpWidget.value.value} and AR ${imageAR.toFixed(3)}: ${Math.round(baseW)}×${Math.round(baseH)}`);
                    } else {
                        // No settings enabled - use raw image dimensions as fallback
                        baseW = this.imageDimensionsCache.width;
                        baseH = this.imageDimensionsCache.height;
                        logger.verbose(`[ScaleWidget] No dimension settings, using raw image dimensions: ${baseW}×${baseH}`);
                    }

                    logger.info(`✓ Scale preview using image AR (${imageAR.toFixed(2)}) with user settings: ${Math.round(baseW)}×${Math.round(baseH)}`);
                }
            }
        }

        if (!useImageForCache || !this.imageDimensionsCache) {
            // Widget-based calculation (fallback when no image or cache empty)
            if (useImageForCache && !this.imageDimensionsCache) {
                logger.debug(`[ScaleWidget] Cache empty, falling back to widget-based calculation`);
            }
            // Calculate base dimensions with proper aspect ratio handling (existing logic)
            if (useWidth && useHeight) {
                // Both W+H specified - use as-is
                baseW = widthWidget.value.value;
                baseH = heightWidget.value.value;
            } else if (useWidth) {
                // Width specified - calculate height from aspect ratio
                baseW = widthWidget.value.value;
                baseH = Math.round(baseW / aspectRatio);
            } else if (useHeight) {
                // Height specified - calculate width from aspect ratio
                baseH = heightWidget.value.value;
                baseW = Math.round(baseH * aspectRatio);
            } else if (useMp) {
                // Megapixel mode - calculate dimensions from MP and aspect ratio
                const targetMp = mpWidget.value.value * 1_000_000;
                baseH = Math.sqrt(targetMp / aspectRatio);
                baseW = baseH * aspectRatio;
            } else {
                // Default mode - use 1920x1080
                baseW = 1920;
                baseH = 1080;
            }
        }

        baseMp = (baseW * baseH) / 1_000_000;

        // Apply scale
        const scaledW = Math.round(baseW * this.value);
        const scaledH = Math.round(baseH * this.value);

        // Get divisor from node's divisible_by widget
        const divisibleWidget = node.widgets.find(w => w.name === "divisible_by");
        let divisor = 16;
        if (divisibleWidget && divisibleWidget.value) {
            divisor = divisibleWidget.value === "Exact" ? 1 : parseInt(divisibleWidget.value);
        }

        // Apply divisibility
        const finalW = Math.round(scaledW / divisor) * divisor;
        const finalH = Math.round(scaledH / divisor) * divisor;
        const finalMp = (finalW * finalH) / 1_000_000;

        return {
            baseW, baseH, baseMp,
            scaledW, scaledH,
            finalW, finalH, finalMp,
            divisor
        };
    }

    /**
     * Refresh image dimensions cache using hybrid B+C strategy
     * Called when image connected/disconnected or USE_IMAGE toggled
     */
    async refreshImageDimensions(node) {
        // Check if USE_IMAGE is enabled
        const imageModeWidget = node.widgets?.find(w => w.name === "image_mode");
        if (!imageModeWidget?.value?.on) {
            this.imageDimensionsCache = null;
            logger.verbose('USE_IMAGE disabled, clearing dimension cache');
            return;
        }

        // Get connected image node
        const imageInput = node.inputs?.find(inp => inp.name === "image");
        const link = imageInput?.link;
        if (!link) {
            this.imageDimensionsCache = null;
            logger.verbose('No image connected, clearing dimension cache');
            return;
        }

        // Get source node from link
        const linkInfo = node.graph.links[link];
        const sourceNode = linkInfo ? node.graph.getNodeById(linkInfo.origin_id) : null;
        if (!sourceNode) {
            this.imageDimensionsCache = null;
            logger.verbose('Source node not found, clearing dimension cache');
            return;
        }

        // Check cache validity (same image path)
        const filePath = ImageDimensionUtils.getImageFilePath(sourceNode);
        if (this.imageDimensionsCache?.path === filePath && filePath) {
            logger.verbose(`Using cached dimensions for ${filePath}`);
            return; // Cache still valid
        }

        // Prevent concurrent fetches
        if (this.fetchingDimensions) {
            logger.verbose('Already fetching dimensions, skipping');
            return;
        }

        // Fetch using hybrid strategy
        this.fetchingDimensions = true;
        try {
            // Tier 1: Server endpoint (immediate for LoadImage nodes)
            if (filePath) {
                logger.debug(`[ScaleWidget] Attempting server endpoint for: ${filePath}`);
                const dims = await ImageDimensionUtils.fetchDimensionsFromServer(filePath);
                logger.debug(`[ScaleWidget] Server response:`, dims);
                if (dims?.success) {
                    this.imageDimensionsCache = {
                        width: dims.width,
                        height: dims.height,
                        timestamp: Date.now(),
                        path: filePath
                    };
                    logger.info(`✓ Cached image dimensions from server: ${dims.width}×${dims.height}`);
                    node.setDirtyCanvas(true, true);
                    return;
                }
                logger.debug('[ScaleWidget] Server endpoint returned no data or failed');
            } else {
                logger.debug('[ScaleWidget] No file path found (not a LoadImage node?)');
            }

            // Tier 2: Info parsing (cached execution output)
            logger.verbose('Attempting info parsing for cached dimensions');
            const cachedDims = ImageDimensionUtils.parseDimensionsFromInfo(node);
            if (cachedDims) {
                this.imageDimensionsCache = {
                    width: cachedDims.width,
                    height: cachedDims.height,
                    timestamp: Date.now(),
                    path: filePath
                };
                logger.debug(`✓ Cached image dimensions from info: ${cachedDims.width}×${cachedDims.height}`);
                node.setDirtyCanvas(true, true);
                return;
            }
            logger.verbose('Info parsing found no dimensions');

            // Tier 3: Clear cache (will fallback to widget values in calculatePreview)
            logger.verbose('No dimensions available from any source, clearing cache');
            this.imageDimensionsCache = null;

        } finally {
            this.fetchingDimensions = false;
        }
    }

    /**
     * Draw the scale widget
     */
    draw(ctx, node, width, y, height) {
        const margin = 15;
        const innerMargin = 3;
        const midY = y + height / 2;

        ctx.save();

        // Background
        ctx.fillStyle = "#1e1e1e";
        ctx.beginPath();
        ctx.roundRect(margin, y + 1, width - margin * 2, height - 2, 4);
        ctx.fill();

        let posX = margin + innerMargin;

        // Label
        const isNeutral = Math.abs(this.value - 1.0) < 0.001;
        ctx.fillStyle = isNeutral ? "#666666" : "#ffffff";  // Muted at 1.0
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "13px sans-serif";
        const labelText = "SCALE";
        const labelTextWidth = ctx.measureText(labelText).width;
        ctx.fillText(labelText, posX, midY);

        // Set tooltip trigger area on label text
        this.infoIcon.setHitArea(posX, y, labelTextWidth, height);

        // Slider and value display area
        const sliderStartX = posX + 60;
        const valueWidth = 60;
        const sliderWidth = width - margin * 2 - sliderStartX - valueWidth - innerMargin * 3;

        // Draw slider track
        const trackY = midY - 2;
        const trackHeight = 4;

        ctx.fillStyle = "#333333";
        ctx.beginPath();
        ctx.roundRect(sliderStartX, trackY, sliderWidth, trackHeight, 2);
        ctx.fill();

        // Draw center mark at 1.0
        const centerX = sliderStartX + this.leftPortion * sliderWidth;
        ctx.strokeStyle = "#555555";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, trackY - 2);
        ctx.lineTo(centerX, trackY + trackHeight + 2);
        ctx.stroke();

        this.hitAreas.slider = { x: sliderStartX, y: y, width: sliderWidth, height: height };

        // Draw filled portion (only if not at 1.0)
        if (!isNeutral) {
            const handlePos = this.valueToPosition(this.value, sliderWidth);
            const fillWidth = handlePos;

            ctx.fillStyle = this.value < 1.0 ? "#d4af37" : "#4CAF50";  // Gold for <1.0, green for >1.0
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            if (this.value < 1.0) {
                // Fill from handle to center
                ctx.roundRect(sliderStartX + fillWidth, trackY, centerX - (sliderStartX + fillWidth), trackHeight, 2);
            } else {
                // Fill from center to handle
                ctx.roundRect(centerX, trackY, fillWidth - (centerX - sliderStartX), trackHeight, 2);
            }
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // Draw handle
        const handlePos = this.valueToPosition(this.value, sliderWidth);
        const handleX = sliderStartX + handlePos;
        const handleRadius = 7;

        this.hitAreas.handle = {
            x: handleX - handleRadius,
            y: midY - handleRadius,
            width: handleRadius * 2,
            height: handleRadius * 2
        };

        ctx.beginPath();
        ctx.arc(handleX, midY, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = isNeutral ? "#666666" : (this.value < 1.0 ? "#d4af37" : "#4CAF50");
        ctx.fill();

        ctx.strokeStyle = "#1e1e1e";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw value display (clickable to edit)
        const valueX = sliderStartX + sliderWidth + innerMargin * 2;
        this.hitAreas.valueEdit = { x: valueX, y: y, width: valueWidth, height: height };

        ctx.fillStyle = isNeutral ? "#2a2a2a" : "#333333";
        ctx.beginPath();
        ctx.roundRect(valueX, y + 2, valueWidth, height - 4, 3);
        ctx.fill();

        ctx.fillStyle = isNeutral ? "#666666" : "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "12px monospace";
        ctx.fillText(this.value.toFixed(2) + "x", valueX + valueWidth / 2, midY);

        // Draw tooltip when hovering or dragging (and not at 1.0)
        if ((this.isHovering || this.isDragging) && !isNeutral) {
            const preview = this.calculatePreview(node);
            if (preview) {
                this.drawTooltip(ctx, y + height, width, preview);
            }
        }

        // Draw settings gear icon at far right
        const gearSize = 14;
        const gearX = width - margin - gearSize - 4;
        const gearY = y + height / 2 - gearSize / 2;

        ctx.font = `${gearSize}px Arial`;
        ctx.fillStyle = this.showingSettings ? "#4CAF50" : "#666";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚙", gearX + gearSize / 2, gearY + gearSize / 2);

        this.hitAreas.settingsIcon = {
            x: gearX, y: gearY,
            width: gearSize, height: gearSize
        };

        // Draw settings panel if open
        if (this.showingSettings) {
            this.drawSettingsPanel(ctx, y + height, width);
        }

        ctx.restore();
    }

    /**
     * Draw preview tooltip below the widget
     */
    drawTooltip(ctx, startY, width, preview) {
        const margin = 15;
        const padding = 8;
        const lineHeight = 16;

        ctx.save();

        // Tooltip content
        const lines = [
            `Scale: ${this.value.toFixed(2)}x`,
            `━━━━━━━━━━━━━━━━━━━━━━━━`,
            `Base: ${preview.baseW} × ${preview.baseH} (${preview.baseMp.toFixed(2)} MP)`,
            `  ↓`,
            `Scaled: ${preview.scaledW} × ${preview.scaledH}`,
            `After Div/${preview.divisor}: ${preview.finalW} × ${preview.finalH} (${preview.finalMp.toFixed(2)} MP)`
        ];

        // Measure text width to ensure tooltip background fits all content
        ctx.font = "bold 11px monospace"; // Use bold for measurement (widest case)
        let maxTextWidth = 0;
        lines.forEach(line => {
            const textWidth = ctx.measureText(line).width;
            if (textWidth > maxTextWidth) {
                maxTextWidth = textWidth;
            }
        });

        // Calculate tooltip dimensions with dynamic width
        const tooltipWidth = Math.min(maxTextWidth + padding * 2, width - margin * 2);
        const tooltipHeight = lines.length * lineHeight + padding * 2;

        // Draw tooltip background
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.beginPath();
        ctx.roundRect(margin, startY + 4, tooltipWidth, tooltipHeight, 4);
        ctx.fill();

        // Draw tooltip border
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw tooltip text
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "11px monospace";

        lines.forEach((line, index) => {
            const textY = startY + 4 + padding + index * lineHeight;
            if (index === 0) {
                // Highlight scale value
                ctx.fillStyle = this.value < 1.0 ? "#d4af37" : "#4CAF50";
                ctx.font = "bold 11px monospace";
                ctx.fillText(line, margin + padding, textY);
                ctx.font = "11px monospace";
                ctx.fillStyle = "#ffffff";
            } else if (index === 1) {
                // Separator line
                ctx.fillStyle = "#666666";
                ctx.fillText(line, margin + padding, textY);
                ctx.fillStyle = "#ffffff";
            } else {
                ctx.fillText(line, margin + padding, textY);
            }
        });

        ctx.restore();
    }

    /**
     * Draw settings configuration panel
     */
    drawSettingsPanel(ctx, startY, width) {
        const panelHeight = 65;
        const margin = 15;
        const padding = 6;

        ctx.save();

        // Panel background
        ctx.fillStyle = "rgba(30, 30, 30, 0.95)";
        ctx.beginPath();
        ctx.roundRect(margin, startY, width - margin * 2, panelHeight, 4);
        ctx.fill();

        // Border
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Title
        ctx.fillStyle = "#4CAF50";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("Scale Step Sizes", margin + padding, startY + padding);

        // Button dimensions
        const btnW = 18, btnH = 16;
        const btnGap = 2;

        // Calculate button positions from right edge
        const rightEdge = width - margin - padding;
        const plusX = rightEdge - btnW;
        const minusX = plusX - btnGap - btnW;

        // Left step control (row 1)
        const row1Y = startY + 28;
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Below 1.0x:", margin + padding, row1Y);

        // Value positioned to left of buttons (clickable)
        const valueX = minusX - 6;
        const valueWidth = 35;
        const valueHeight = 16;
        const leftValueX = valueX - valueWidth;
        const leftValueY = row1Y - valueHeight / 2 + 3;

        // Draw clickable background for left step value
        ctx.fillStyle = "rgba(80, 80, 80, 0.3)";
        ctx.beginPath();
        ctx.roundRect(leftValueX, leftValueY, valueWidth, valueHeight, 2);
        ctx.fill();

        // Draw left step value (centered in box)
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const leftBoxCenterY = leftValueY + valueHeight / 2;
        ctx.fillText(this.leftStep.toFixed(3), valueX, leftBoxCenterY);

        // Store hit area for left step value
        this.hitAreas.leftStepValue = { x: leftValueX, y: leftValueY, width: valueWidth, height: valueHeight };

        // +/- buttons for left step (right-aligned)
        this.drawButton(ctx, minusX, row1Y - 4, btnW, btnH, "-");
        this.hitAreas.leftStepDown = { x: minusX, y: row1Y - 4, width: btnW, height: btnH };

        this.drawButton(ctx, plusX, row1Y - 4, btnW, btnH, "+");
        this.hitAreas.leftStepUp = { x: plusX, y: row1Y - 4, width: btnW, height: btnH };

        // Right step control (row 2)
        const row2Y = startY + 48;

        // Reset font/style after buttons (drawButton changes these)
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("At/above 1.0x:", margin + padding, row2Y);

        // Value positioned to left of buttons (clickable)
        const rightValueX = valueX - valueWidth;
        const rightValueY = row2Y - valueHeight / 2 + 3;

        // Draw clickable background for right step value
        ctx.fillStyle = "rgba(80, 80, 80, 0.3)";
        ctx.beginPath();
        ctx.roundRect(rightValueX, rightValueY, valueWidth, valueHeight, 2);
        ctx.fill();

        // Draw right step value (centered in box)
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const rightBoxCenterY = rightValueY + valueHeight / 2;
        ctx.fillText(this.rightStep.toFixed(3), valueX, rightBoxCenterY);

        // Store hit area for right step value
        this.hitAreas.rightStepValue = { x: rightValueX, y: rightValueY, width: valueWidth, height: valueHeight };

        // +/- buttons for right step (right-aligned)
        this.drawButton(ctx, minusX, row2Y - 4, btnW, btnH, "-");
        this.hitAreas.rightStepDown = { x: minusX, y: row2Y - 4, width: btnW, height: btnH };

        this.drawButton(ctx, plusX, row2Y - 4, btnW, btnH, "+");
        this.hitAreas.rightStepUp = { x: plusX, y: row2Y - 4, width: btnW, height: btnH };

        ctx.restore();
    }

    /**
     * Draw a button
     */
    drawButton(ctx, x, y, w, h, label) {
        ctx.fillStyle = "#555";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + w / 2, y + h / 2);
    }

    /**
     * Handle mouse events
     */
    mouse(event, pos, node) {
        const canvas = app.canvas;

        // Check info icon first (tooltip on label)
        const canvasBounds = { width: node.size[0], height: node.size[1] };
        if (this.infoIcon.mouse(event, pos, canvasBounds, node.pos)) {
            node.setDirtyCanvas(true);
            return true; // Tooltip handled the event
        }

        if (event.type === "pointerdown") {
            this.mouseDowned = [...pos];

            // Settings icon clicked - toggle panel
            if (this.isInBounds(pos, this.hitAreas.settingsIcon)) {
                this.showingSettings = !this.showingSettings;

                // Preserve width, adjust height by panel size (65px)
                const currentSize = node.size || [200, 24];
                const heightDelta = this.showingSettings ? 65 : -65;
                node.setSize([currentSize[0], currentSize[1] + heightDelta]);

                node.setDirtyCanvas(true);
                return true;
            }

            // Settings panel button clicks (when panel open)
            if (this.showingSettings) {
                if (this.isInBounds(pos, this.hitAreas.leftStepDown)) {
                    this.leftStep = Math.max(0.001, this.leftStep - 0.01);
                    node.setDirtyCanvas(true);
                    return true;
                }
                if (this.isInBounds(pos, this.hitAreas.leftStepUp)) {
                    this.leftStep = Math.min(1.0, this.leftStep + 0.01);
                    node.setDirtyCanvas(true);
                    return true;
                }
                if (this.isInBounds(pos, this.hitAreas.rightStepDown)) {
                    this.rightStep = Math.max(0.001, this.rightStep - 0.01);
                    node.setDirtyCanvas(true);
                    return true;
                }
                if (this.isInBounds(pos, this.hitAreas.rightStepUp)) {
                    this.rightStep = Math.min(10.0, this.rightStep + 0.01);
                    node.setDirtyCanvas(true);
                    return true;
                }

                // Check left step value edit click
                if (this.isInBounds(pos, this.hitAreas.leftStepValue)) {
                    canvas.prompt("Enter left step size (0.001 - 1.0)", String(this.leftStep.toFixed(3)), (newValue) => {
                        const parsed = parseFloat(newValue);
                        if (!isNaN(parsed) && parsed >= 0.001 && parsed <= 1.0) {
                            this.leftStep = parsed;
                            node.setDirtyCanvas(true);
                        }
                    }, event);
                    return true;
                }

                // Check right step value edit click
                if (this.isInBounds(pos, this.hitAreas.rightStepValue)) {
                    canvas.prompt("Enter right step size (0.001 - 10.0)", String(this.rightStep.toFixed(3)), (newValue) => {
                        const parsed = parseFloat(newValue);
                        if (!isNaN(parsed) && parsed >= 0.001 && parsed <= 10.0) {
                            this.rightStep = parsed;
                            node.setDirtyCanvas(true);
                        }
                    }, event);
                    return true;
                }
            }

            // Check value edit click
            if (this.isInBounds(pos, this.hitAreas.valueEdit)) {
                canvas.prompt("Enter scale value (0.0 - 10.0+)", String(this.value.toFixed(2)), (newValue) => {
                    const parsed = parseFloat(newValue);
                    if (!isNaN(parsed) && parsed >= 0.0) {
                        this.value = Math.max(0.0, parsed);
                        node.setDirtyCanvas(true);
                    }
                }, event);
                return true;
            }

            // Check slider/handle click
            if (this.isInBounds(pos, this.hitAreas.slider) || this.isInBounds(pos, this.hitAreas.handle)) {
                this.isDragging = true;
                this.updateValueFromMouse(pos);
                node.setDirtyCanvas(true);
                return true;
            }
        }

        if (event.type === "pointermove") {
            // Clear any existing safety timeout
            if (this.tooltipTimeout) {
                clearTimeout(this.tooltipTimeout);
                this.tooltipTimeout = null;
            }

            // Update hover state based on mouse position
            const wasHovering = this.isHovering;
            this.isHovering = this.isInBounds(pos, this.hitAreas.slider) ||
                             this.isInBounds(pos, this.hitAreas.handle) ||
                             this.isInBounds(pos, this.hitAreas.valueEdit);

            // Handle dragging
            if (this.isDragging && this.mouseDowned) {
                this.updateValueFromMouse(pos);
                node.setDirtyCanvas(true);
                return true;
            }

            // Redraw if hover state changed
            if (wasHovering !== this.isHovering) {
                node.setDirtyCanvas(true);
            }

            // Safety timeout: hide tooltip after 2 seconds of no mouse movement
            // This handles cases where pointerleave doesn't fire (e.g., switching windows)
            if (this.isHovering) {
                this.tooltipTimeout = setTimeout(() => {
                    this.isHovering = false;
                    node.setDirtyCanvas(true);
                }, 2000);
            }
        }

        if (event.type === "pointerup") {
            this.isDragging = false;
            this.mouseDowned = null;
            // Start safety timeout after mouse release
            if (this.tooltipTimeout) {
                clearTimeout(this.tooltipTimeout);
            }
            if (this.isHovering) {
                this.tooltipTimeout = setTimeout(() => {
                    this.isHovering = false;
                    node.setDirtyCanvas(true);
                }, 2000);
            }
        }

        // Handle mouse leaving widget area - immediately hide tooltip
        if (event.type === "pointerleave" || event.type === "pointerout") {
            if (this.tooltipTimeout) {
                clearTimeout(this.tooltipTimeout);
                this.tooltipTimeout = null;
            }
            if (this.isHovering) {
                this.isHovering = false;
                node.setDirtyCanvas(true);
            }
        }

        return false;
    }

    /**
     * Update value from mouse position
     */
    updateValueFromMouse(pos) {
        const slider = this.hitAreas.slider;
        const relativeX = Math.max(0, Math.min(slider.width, pos[0] - slider.x));
        let newValue = this.positionToValue(relativeX, slider.width);

        // Snap to step
        const step = this.getStepSize(newValue);
        newValue = Math.round(newValue / step) * step;

        // Clamp to range
        this.value = Math.max(this.min, Math.min(this.max, newValue));
    }

    /**
     * Check if position is within bounds
     */
    isInBounds(pos, bounds) {
        return pos[0] >= bounds.x &&
               pos[0] <= bounds.x + bounds.width &&
               pos[1] >= bounds.y &&
               pos[1] <= bounds.y + bounds.height;
    }

    /**
     * Compute size for layout
     */
    computeSize(width) {
        // Base height: 24px slider
        // Settings panel: 65px when open
        return [width, this.showingSettings ? 89 : 24];
    }

    /**
     * Serialize value for workflow JSON
     * Returns ONLY the float value - this is what Python receives
     * Step configuration is stored separately in node.serialize()
     */
    serializeValue(node, index) {
        logger.debug(`serializeValue called: ${this.name} (index ${index}) = ${this.value}, steps: ${this.leftStep}/${this.rightStep}`);
        return this.value;  // Return float for Python, config stored elsewhere
    }
}

/**
 * Compact dimension widget with inline toggle and number controls
 * Matches rgthree's Power Lora Loader aesthetic
 */
class DimensionWidget {
    constructor(name, defaultValue, isInteger = true, config = {}) {
        this.name = name;
        this.type = "custom";
        this.isInteger = isInteger;
        this.value = {
            on: false,
            value: defaultValue
        };

        // Behavior configuration
        // - Toggle Behavior: Controls when toggle can be enabled/disabled
        // - Value Behavior: Controls when values can be edited
        this.toggleBehavior = config.toggleBehavior ?? ToggleBehavior.SYMMETRIC;
        this.valueBehavior = config.valueBehavior ?? ValueBehavior.ALWAYS;

        // Mouse state
        this.mouseDowned = null;
        this.isMouseDownedAndOver = false;

        // Hit areas for mouse interaction (updated during draw)
        this.hitAreas = {
            toggle: { x: 0, y: 0, width: 0, height: 0 },
            valueDec: { x: 0, y: 0, width: 0, height: 0 },
            valueInc: { x: 0, y: 0, width: 0, height: 0 },
            valueEdit: { x: 0, y: 0, width: 0, height: 0 }
        };

        // Optional tooltip support (only used for MEGAPIXEL)
        this.infoIcon = config.tooltipContent ? new InfoIcon(config.tooltipContent) : null;
    }

    /**
     * Draw compact widget (rgthree-style)
     * Height: 24px (compact), Margins: 3px (tight)
     */
    draw(ctx, node, width, y, height) {
        const margin = 15;
        const innerMargin = 3;  // Reduced from 5px for tighter layout
        const midY = y + height / 2;

        ctx.save();

        // Draw background (rounded)
        ctx.fillStyle = "#1e1e1e";
        ctx.beginPath();
        ctx.roundRect(margin, y + 1, width - margin * 2, height - 2, 4);
        ctx.fill();

        let posX = margin + innerMargin;

        // Draw toggle switch (LEFT side)
        const toggleWidth = height * 1.5;
        this.drawToggle(ctx, posX, y, height, this.value.on);
        this.hitAreas.toggle = { x: posX, y: y, width: toggleWidth, height: height };
        posX += toggleWidth + innerMargin * 2;

        // Draw label
        ctx.fillStyle = this.value.on ? "#ffffff" : "#888888";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "13px sans-serif";  // Slightly smaller for compact layout

        const labelText = this.name.replace("dimension_", "").replace("_", " ").toUpperCase();
        const labelTextWidth = ctx.measureText(labelText).width;
        ctx.fillText(labelText, posX, midY);

        // Set tooltip trigger area on label (if tooltip configured)
        if (this.infoIcon) {
            this.infoIcon.setHitArea(posX, y, labelTextWidth, height);
        }

        // Draw number controls (RIGHT side)
        const numberWidth = 110;  // Reduced from 120 for compact layout
        const numberX = width - margin - numberWidth - innerMargin;

        if (this.value.on) {
            this.drawNumberWidget(ctx, numberX, y, numberWidth, height, this.value.on);
        } else {
            // Draw grayed out value (still clickable to edit - symmetric behavior)
            ctx.fillStyle = "#555555";
            ctx.textAlign = "center";
            ctx.font = "12px monospace";
            const displayValue = this.isInteger ? String(Math.round(this.value.value)) : this.value.value.toFixed(1);
            ctx.fillText(displayValue, numberX + numberWidth / 2, midY);

            // Set hit area for value editing (symmetric behavior - always editable)
            this.hitAreas.valueEdit = { x: numberX, y: y, width: numberWidth, height: height };

            // Clear +/- button hit areas (buttons not shown when toggle OFF)
            this.hitAreas.valueDec = { x: 0, y: 0, width: 0, height: 0 };
            this.hitAreas.valueInc = { x: 0, y: 0, width: 0, height: 0 };
        }

        ctx.restore();
    }

    /**
     * Draw toggle switch (rgthree-style)
     */
    drawToggle(ctx, x, y, height, state) {
        const radius = height * 0.36;
        const bgWidth = height * 1.5;

        ctx.save();

        // Toggle track background
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, bgWidth - 8, height - 8, height * 0.5);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Toggle circle
        const circleX = state ? x + height : x + height * 0.5;
        ctx.beginPath();
        ctx.arc(circleX, y + height * 0.5, radius, 0, Math.PI * 2);
        ctx.fillStyle = state ? "#4CAF50" : "#888888";
        ctx.fill();

        ctx.restore();
    }

    /**
     * Draw number input widget with +/- buttons (compact)
     */
    drawNumberWidget(ctx, x, y, width, height, isActive) {
        const buttonWidth = 18;  // Reduced from 20 for compact layout
        const midY = y + height / 2;

        ctx.save();

        // Value background
        ctx.fillStyle = isActive ? "#2a2a2a" : "#1a1a1a";
        ctx.beginPath();
        ctx.roundRect(x, y + 2, width, height - 4, 3);
        ctx.fill();

        // Decrement button [-]
        ctx.fillStyle = "#444444";
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 3, buttonWidth, height - 6, 2);
        ctx.fill();
        this.hitAreas.valueDec = { x: x, y: y, width: buttonWidth + 4, height: height };

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "14px sans-serif";
        ctx.fillText("−", x + buttonWidth / 2 + 2, midY);

        // Value display (clickable to edit)
        const valueX = x + buttonWidth + 4;
        const valueWidth = width - (buttonWidth + 4) * 2;
        this.hitAreas.valueEdit = { x: valueX, y: y, width: valueWidth, height: height };

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "12px monospace";
        const displayValue = this.isInteger ? String(Math.round(this.value.value)) : this.value.value.toFixed(1);
        ctx.fillText(displayValue, valueX + valueWidth / 2, midY);

        // Increment button [+]
        ctx.fillStyle = "#444444";
        ctx.beginPath();
        ctx.roundRect(x + width - buttonWidth - 2, y + 3, buttonWidth, height - 6, 2);
        ctx.fill();
        this.hitAreas.valueInc = { x: x + width - buttonWidth - 4, y: y, width: buttonWidth + 4, height: height };

        ctx.fillStyle = "#ffffff";
        ctx.fillText("+", x + width - buttonWidth / 2 - 2, midY);

        ctx.restore();
    }

    /**
     * Handle mouse events
     */
    mouse(event, pos, node) {
        const canvas = app.canvas;

        // Check info icon first (tooltip on label) if configured
        if (this.infoIcon) {
            const canvasBounds = { width: node.size[0], height: node.size[1] };
            if (this.infoIcon.mouse(event, pos, canvasBounds, node.pos)) {
                node.setDirtyCanvas(true);
                return true; // Tooltip handled the event
            }
        }

        if (event.type === "pointerdown") {
            this.mouseDowned = [...pos];
            this.isMouseDownedAndOver = true;

            // Check toggle click
            if (this.isInBounds(pos, this.hitAreas.toggle)) {
                const oldState = this.value.on;
                this.value.on = !this.value.on;
                logger.debug(`Toggle clicked: ${this.name} - ${oldState} → ${this.value.on}`);
                node.setDirtyCanvas(true);
                return true;
            }

            // Value editing - check behavior mode
            // ALWAYS: Values editable regardless of toggle state (default)
            // CONDITIONAL: Values only editable when toggle ON
            const allowValueEdit = this.value.on ||
                                   (this.valueBehavior === ValueBehavior.ALWAYS);

            if (allowValueEdit) {
                // Decrement button
                if (this.isInBounds(pos, this.hitAreas.valueDec)) {
                    this.changeValue(-1, node);
                    node.setDirtyCanvas(true);
                    return true;
                }

                // Increment button
                if (this.isInBounds(pos, this.hitAreas.valueInc)) {
                    this.changeValue(1, node);
                    node.setDirtyCanvas(true);
                    return true;
                }

                // Value edit (prompt for new value)
                if (this.isInBounds(pos, this.hitAreas.valueEdit)) {
                    const currentValue = this.isInteger ? Math.round(this.value.value) : this.value.value;
                    canvas.prompt("Enter value", String(currentValue), (newValue) => {
                        const parsed = parseFloat(newValue);
                        if (!isNaN(parsed)) {
                            this.value.value = this.isInteger ? Math.round(parsed) : parsed;
                            node.setDirtyCanvas(true);
                        }
                    }, event);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if position is within bounds
     */
    isInBounds(pos, bounds) {
        return pos[0] >= bounds.x &&
               pos[0] <= bounds.x + bounds.width &&
               pos[1] >= bounds.y &&
               pos[1] <= bounds.y + bounds.height;
    }

    /**
     * Change value by increment
     */
    changeValue(delta, node) {
        if (this.isInteger) {
            // Get divisible_by setting from node
            let increment = 8; // Default to 8 for divisibility-friendly increments
            if (node && node.widgets) {
                const divisibleWidget = node.widgets.find(w => w.name === "divisible_by");
                if (divisibleWidget) {
                    if (divisibleWidget.value === "Exact") {
                        increment = 1;
                    } else {
                        const divisor = parseInt(divisibleWidget.value);
                        if (!isNaN(divisor)) {
                            increment = divisor;
                        }
                    }
                }
            }
            // Integer: increment by divisible_by value
            this.value.value = Math.max(64, Math.round(this.value.value) + delta * increment);
        } else {
            // Float: increment by 0.1
            this.value.value = Math.max(0.1, Math.round((this.value.value + delta * 0.1) * 10) / 10);
        }
    }

    /**
     * Compute size for layout (compact height)
     */
    computeSize(width) {
        return [width, 24];  // Reduced from 30px for compact layout
    }

    /**
     * Serialize value for workflow JSON
     */
    serializeValue(node, index) {
        logger.debug(`serializeValue called: ${this.name} (index ${index}) =`, this.value);
        return this.value;
    }
}

/**
 * Image Mode Widget
 * Compact widget with toggle (LEFT) and mode selector (RIGHT)
 * Answers the question "USE IMAGE?" with ON/OFF + AR Only/Exact Dims
 */
class ImageModeWidget {
    constructor(name = "image_mode", config = {}) {
        this.name = name;
        this.type = "custom";
        this.value = {
            on: true,   // Default: enabled
            value: 0    // 0 = AR Only, 1 = Exact Dims
        };

        // Behavior configuration (both default to asymmetric/conditional for USE_IMAGE)
        // - Toggle: Can't enable without image (asymmetric)
        // - Values (mode): Can't change when toggle OFF or image disconnected (conditional)
        this.toggleBehavior = config.toggleBehavior ?? ToggleBehavior.ASYMMETRIC;
        this.valueBehavior = config.valueBehavior ?? ValueBehavior.CONDITIONAL;

        // Mode labels
        this.modes = ["AR Only", "Exact Dims"];

        // Track image connection state (set by onConnectionsChange)
        // NOTE: Don't use 'disabled' - LiteGraph checks it and blocks mouse() calls
        this.imageDisconnected = false;  // False = image connected, True = no image

        // Mouse state
        this.mouseDowned = null;
        this.isMouseDownedAndOver = false;

        // Hit areas
        this.hitAreas = {
            toggle: { x: 0, y: 0, width: 0, height: 0 },
            modeSelector: { x: 0, y: 0, width: 0, height: 0 }
        };

        // Info icon for tooltip
        this.infoIcon = new InfoIcon(TOOLTIP_CONTENT.image_mode);
    }

    /**
     * Draw compact widget matching DimensionWidget style
     * Layout: [Toggle] USE IMAGE? [AR Only/Exact Dims]
     * Note: Visual appearance unchanged when disabled, only blocks clicks
     */
    draw(ctx, node, width, y, height) {
        const margin = 15;
        const innerMargin = 3;
        const midY = y + height / 2;

        ctx.save();

        // Background (normal appearance always)
        ctx.fillStyle = "#1e1e1e";
        ctx.beginPath();
        ctx.roundRect(margin, y + 1, width - margin * 2, height - 2, 4);
        ctx.fill();

        let posX = margin + innerMargin;

        // Draw toggle switch (LEFT) - matching DimensionWidget style
        const toggleWidth = height * 1.5;
        this.drawToggle(ctx, posX, y, height, this.value.on);

        // Always set toggle hit area - mouse() handles asymmetric logic
        // (allows turning OFF when disabled, blocks turning ON)
        this.hitAreas.toggle = { x: posX, y, width: toggleWidth, height };

        posX += toggleWidth + innerMargin * 2;

        // Draw label (MIDDLE) - "USE IMAGE?"
        const labelText = "USE IMAGE?";
        ctx.fillStyle = this.value.on ? "#ffffff" : "#888888";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "13px sans-serif";

        // Measure text width to position icon correctly
        const labelTextWidth = ctx.measureText(labelText).width;
        const labelStartX = posX;

        ctx.fillText(labelText, labelStartX, midY);

        // Calculate mode selector position (RIGHT side)
        const modeWidth = 100;  // Fixed width for mode selector
        const modeX = width - margin - modeWidth - innerMargin;

        // Draw mode selector (RIGHT)
        const modeText = this.modes[this.value.value];

        // Mode background (subtle highlight if enabled)
        if (this.value.on) {
            ctx.fillStyle = "#2a2a2a";
            ctx.beginPath();
            ctx.roundRect(modeX, y + 2, modeWidth, height - 4, 3);
            ctx.fill();
        }

        // Mode text
        ctx.fillStyle = this.value.on ? "#ffffff" : "#666666";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(modeText, modeX + modeWidth / 2, midY);

        // Only set mode selector hit area when image connected
        // (mouse() method will still block it, but this prevents visual feedback)
        if (!this.imageDisconnected) {
            this.hitAreas.modeSelector = { x: modeX, y, width: modeWidth, height };
        } else {
            this.hitAreas.modeSelector = { x: 0, y: 0, width: 0, height: 0 };
        }

        // Set tooltip trigger area to the label text itself (no icon drawn)
        // Hover over "USE IMAGE?" label shows tooltip, Shift+Click opens docs
        this.infoIcon.setHitArea(labelStartX, y, labelTextWidth, height);

        ctx.restore();
    }

    /**
     * Draw toggle switch (matching DimensionWidget style exactly)
     */
    drawToggle(ctx, x, y, height, state) {
        const radius = height * 0.36;
        const bgWidth = height * 1.5;

        ctx.save();

        // Toggle track background
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, bgWidth - 8, height - 8, height * 0.5);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Toggle circle (green when ON, gray when OFF)
        const circleX = state ? x + height : x + height * 0.5;
        ctx.beginPath();
        ctx.arc(circleX, y + height * 0.5, radius, 0, Math.PI * 2);
        ctx.fillStyle = state ? "#4CAF50" : "#888888";  // Green when ON, gray when OFF
        ctx.fill();

        ctx.restore();
    }

    /**
     * Handle mouse events
     * Asymmetric logic when no image connected:
     * - Allow turning OFF (user wants to disable USE_IMAGE)
     * - Block turning ON (doesn't make sense without image)
     * - Block mode selector entirely
     */
    mouse(event, pos, node) {
        // Check info icon first (before other interactions)
        // Pass node position for coordinate conversion (node-local → canvas-global)
        const canvasBounds = { width: node.size[0], height: node.size[1] };
        if (this.infoIcon.mouse(event, pos, canvasBounds, node.pos)) {
            node.setDirtyCanvas(true);
            return true; // Icon handled the event
        }

        if (event.type === "pointerdown") {
            logger.debug(`ImageModeWidget.mouse() - imageDisconnected: ${this.imageDisconnected}, value.on: ${this.value.on}, pos: [${pos[0]}, ${pos[1]}]`);
            logger.debug('Toggle hit area:', this.hitAreas.toggle);

            this.mouseDowned = [...pos];
            this.isMouseDownedAndOver = true;

            // Toggle click
            const inToggleBounds = this.isInBounds(pos, this.hitAreas.toggle);
            logger.debug(`Toggle bounds check: ${inToggleBounds}`);

            if (inToggleBounds) {
                const oldState = this.value.on;
                const newState = !this.value.on;

                logger.debug(`Toggle clicked: ${oldState} → ${newState}, imageDisconnected: ${this.imageDisconnected}`);

                // Toggle behavior check (asymmetric by default)
                if (this.toggleBehavior === ToggleBehavior.ASYMMETRIC) {
                    // Asymmetric logic when image disconnected:
                    // - Allow ON → OFF (user turning it off is fine)
                    // - Block OFF → ON (can't enable without image)
                    if (this.imageDisconnected && newState === true) {
                        logger.debug('Toggle blocked: Cannot enable without image (asymmetric toggle behavior)');
                        return false;
                    }
                }
                // Symmetric toggle behavior would skip this check (always allow)

                this.value.on = newState;
                logger.debug(`Image mode toggled: ${oldState} → ${this.value.on}`);

                // Trigger scale dimension refresh when USE_IMAGE is toggled
                const scaleWidget = node.widgets?.find(w => w.name === "scale");
                if (scaleWidget?.refreshImageDimensions) {
                    if (newState) {
                        // Toggled ON - fetch image dimensions
                        logger.info('[Toggle] USE_IMAGE enabled, triggering scale dimension refresh');
                        scaleWidget.refreshImageDimensions(node);
                    } else {
                        // Toggled OFF - clear cache
                        scaleWidget.imageDimensionsCache = null;
                        logger.info('[Toggle] USE_IMAGE disabled, cleared scale dimension cache');
                    }
                } else {
                    logger.debug('[Toggle] No scale widget or refresh method found');
                }

                node.setDirtyCanvas(true);
                return true;
            }

            // Mode selector - check value behavior mode
            // CONDITIONAL (default): Only when toggle ON and image connected
            // ALWAYS: Always allow (future use case: edit mode even when disabled)
            const allowModeEdit = this.valueBehavior === ValueBehavior.ALWAYS ||
                                  (this.value.on && !this.imageDisconnected);

            if (allowModeEdit && this.isInBounds(pos, this.hitAreas.modeSelector)) {
                this.value.value = this.value.value === 0 ? 1 : 0;
                logger.debug(`Image mode changed to: ${this.modes[this.value.value]}`);
                node.setDirtyCanvas(true);
                return true;
            }
        }

        return false;
    }

    /**
     * Check if position is within bounds
     */
    isInBounds(pos, bounds) {
        return pos[0] >= bounds.x &&
               pos[0] <= bounds.x + bounds.width &&
               pos[1] >= bounds.y &&
               pos[1] <= bounds.y + bounds.height;
    }

    /**
     * Compute size for layout
     */
    computeSize(width) {
        return [width, 24];  // Compact height matching DimensionWidget
    }

    /**
     * Serialize value for workflow JSON
     */
    serializeValue(node, index) {
        logger.debug(`serializeValue called: ${this.name} (index ${index}) =`, this.value);
        return this.value;
    }
}

/**
 * Copy from Image Button Widget
 * Simple button to extract dimensions from connected image and populate widgets
 */
class CopyImageButton {
    constructor(name = "copy_from_image") {
        this.name = name;
        this.type = "custom";  // Must be "custom" for addCustomWidget to route mouse events
        this.value = null;  // Buttons don't need a value

        // Undo state
        this.undoStack = null;  // Stores previous values: {width: {on, value}, height: {on, value}}
        this.showUndo = false;  // Show undo button after copy

        // Hover states
        this.isHoveringCopy = false;
        this.isHoveringUndo = false;
    }

    draw(ctx, node, width, y, height) {
        ctx.save();

        const x = 15;  // Standard widget left margin
        const margin = 3;  // Space between buttons
        const buttonHeight = 28;

        // Check if image is connected
        const imageInput = node.inputs ? node.inputs.find(i => i.name === "image") : null;
        const hasImage = imageInput && imageInput.link != null;

        // Layout: [Copy Button] [Undo Button] if showUndo
        const undoButtonWidth = this.showUndo ? 60 : 0;
        const copyButtonWidth = this.showUndo
            ? width - 30 - undoButtonWidth - margin  // Leave space for undo
            : width - 30;  // Full width

        // === Draw Copy Button ===

        // Copy button style
        if (hasImage) {
            ctx.fillStyle = this.isHoveringCopy ? "#4a7a9a" : "#3a5a7a";
        } else {
            ctx.fillStyle = "#2a2a2a";
        }

        // Copy button background
        ctx.beginPath();
        ctx.roundRect(x, y, copyButtonWidth, buttonHeight, 4);
        ctx.fill();

        // Copy button border
        ctx.strokeStyle = hasImage ? "#5a8aaa" : "#3a3a3a";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Copy button text
        ctx.fillStyle = hasImage ? "#ffffff" : "#666666";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const text = hasImage ? "📋 Copy from Image" : "📋 Copy from Image (No Image)";
        ctx.fillText(text, x + copyButtonWidth / 2, y + buttonHeight / 2);

        // Store copy button hit area
        this.hitAreaCopy = { x, y, width: copyButtonWidth, height: buttonHeight };

        // === Draw Undo Button (if available) ===

        if (this.showUndo) {
            const undoX = x + copyButtonWidth + margin;

            // Undo button style
            ctx.fillStyle = this.isHoveringUndo ? "#9a4a4a" : "#7a3a3a";

            // Undo button background
            ctx.beginPath();
            ctx.roundRect(undoX, y, undoButtonWidth, buttonHeight, 4);
            ctx.fill();

            // Undo button border
            ctx.strokeStyle = "#aa5a5a";
            ctx.lineWidth = 1;
            ctx.stroke();

            // Undo button text
            ctx.fillStyle = "#ffffff";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("↶ Undo", undoX + undoButtonWidth / 2, y + buttonHeight / 2);

            // Store undo button hit area
            this.hitAreaUndo = { x: undoX, y, width: undoButtonWidth, height: buttonHeight };
        } else {
            this.hitAreaUndo = null;
        }

        ctx.restore();
    }

    mouse(event, pos, node) {
        if (event.type === "pointermove") {
            // Check hover state for both buttons
            const wasHoveringCopy = this.isHoveringCopy;
            const wasHoveringUndo = this.isHoveringUndo;

            this.isHoveringCopy = this.isInBounds(pos, this.hitAreaCopy);
            this.isHoveringUndo = this.hitAreaUndo && this.isInBounds(pos, this.hitAreaUndo);

            if (this.isHoveringCopy !== wasHoveringCopy || this.isHoveringUndo !== wasHoveringUndo) {
                node.setDirtyCanvas(true);
            }
            return false;
        }

        if (event.type === "pointerdown") {

            // Check Copy button click
            const inCopyBounds = this.isInBounds(pos, this.hitAreaCopy);
            if (inCopyBounds) {
                logger.debug("Copy button clicked");
                // Check if image is connected
                const imageInput = node.inputs ? node.inputs.find(i => i.name === "image") : null;
                if (imageInput && imageInput.link != null) {
                    logger.debug("Image connected - calling copyFromImage");
                    // Get the connected node
                    const link = node.graph.links[imageInput.link];
                    if (link) {
                        const sourceNode = node.graph.getNodeById(link.origin_id);
                        if (sourceNode) {
                            // Try to get image from source node's last execution
                            this.copyFromImage(node, sourceNode);
                        }
                    }
                } else {
                    logger.debug("No image connected - button disabled");
                }
                node.setDirtyCanvas(true);
                return true;
            }

            // Check Undo button click
            const inUndoBounds = this.hitAreaUndo && this.isInBounds(pos, this.hitAreaUndo);
            if (inUndoBounds) {
                logger.debug("Undo button clicked");
                this.undoCopy(node);
                return true;
            }

        }

        if (event.type === "pointerup") {
            if (this.isHoveringCopy || this.isHoveringUndo) {
                this.isHoveringCopy = false;
                this.isHoveringUndo = false;
                node.setDirtyCanvas(true);
            }
        }

        return false;
    }

    /**
     * Hybrid B+C Copy Strategy
     * Tier 1: Server endpoint (immediate for Load Image nodes)
     * Tier 2: Parse info output (post-execution caching)
     * Tier 3: Instructions dialog (user guidance)
     */
    async copyFromImage(node, sourceNode) {
        logger.info("===== COPY FROM IMAGE CLICKED =====");
        logger.debug("Copy from Image clicked! Starting hybrid B+C strategy...");
        logger.debug(`Source node:`, sourceNode);
        logger.debug(`Source node type: ${sourceNode?.type}`);

        // Tier 1: Try server endpoint for Load Image nodes
        try {
            const filePath = this.getImageFilePath(sourceNode);
            if (filePath) {
                logger.debug(`Attempting server endpoint with path: ${filePath}`);
                const dims = await this.fetchDimensionsFromServer(filePath);
                if (dims && dims.success) {
                    logger.debug(`Server success: ${dims.width}×${dims.height}`);
                    this.populateWidgets(node, dims.width, dims.height);
                    this.showSuccessNotification(node, dims.width, dims.height, "File");
                    return;
                }
                logger.debug("Server endpoint failed or returned no data");
            }
        } catch (e) {
            logger.debug(`Server endpoint error: ${e.message}`);
        }

        // Tier 2: Try parsing cached info output
        try {
            const dims = this.parseDimensionsFromInfo(node);
            if (dims) {
                logger.debug(`Info parsing success: ${dims.width}×${dims.height}`);
                this.populateWidgets(node, dims.width, dims.height);
                this.showSuccessNotification(node, dims.width, dims.height, "Cached");
                return;
            }
            logger.debug("No cached info output found");
        } catch (e) {
            logger.debug(`Info parsing error: ${e.message}`);
        }

        // Tier 3: Fallback - show instructions
        logger.debug("All methods failed - showing instructions");
        this.showInstructionsDialog();
    }

    /**
     * Extract file path from LoadImage node (delegates to shared utils)
     */
    getImageFilePath(sourceNode) {
        return ImageDimensionUtils.getImageFilePath(sourceNode);
    }

    /**
     * Fetch dimensions from server endpoint (delegates to shared utils)
     */
    async fetchDimensionsFromServer(imagePath) {
        return await ImageDimensionUtils.fetchDimensionsFromServer(imagePath);
    }

    /**
     * Parse dimensions from cached info output (delegates to shared utils)
     */
    parseDimensionsFromInfo(node) {
        return ImageDimensionUtils.parseDimensionsFromInfo(node);
    }

    /**
     * Populate dimension widgets with extracted values
     * IMPORTANT: Only updates VALUES, preserves user's ON/OFF toggle states
     * User decides which calculation mode to use (MP, W+H, W+AR, etc.)
     */
    populateWidgets(node, width, height) {
        logger.debug(`Populating widgets: ${width}×${height}`);

        // Find the dimension widgets
        const widthWidget = node.widgets?.find(w => w.name === "dimension_width");
        const heightWidget = node.widgets?.find(w => w.name === "dimension_height");

        if (!widthWidget || !heightWidget) {
            logger.error("Could not find dimension widgets!");
            return;
        }

        // Save current values to undo stack BEFORE changing
        this.undoStack = {
            width: { ...widthWidget.value },
            height: { ...heightWidget.value }
        };
        this.showUndo = true;
        logger.debug('Saved undo state:', this.undoStack);

        // ONLY update values - preserve user's toggle states
        // User may want dimensions copied but still use MP+AR calculation
        widthWidget.value = { on: widthWidget.value.on, value: width };
        heightWidget.value = { on: heightWidget.value.on, value: height };

        logger.debug(`Updated WIDTH=${width} (toggle: ${widthWidget.value.on ? 'ON' : 'OFF'})`);
        logger.debug(`Updated HEIGHT=${height} (toggle: ${heightWidget.value.on ? 'ON' : 'OFF'})`);

        // Mark node as modified and refresh canvas
        node.setDirtyCanvas(true, true);
        logger.debug("Widgets populated successfully (preserved user's toggle states)");
    }

    /**
     * Undo the last copy operation
     * Restores previous WIDTH/HEIGHT values (including toggle states)
     */
    undoCopy(node) {
        if (!this.undoStack) {
            logger.debug('No undo state available');
            return;
        }

        logger.debug('Restoring undo state:', this.undoStack);

        // Find the dimension widgets
        const widthWidget = node.widgets?.find(w => w.name === "dimension_width");
        const heightWidget = node.widgets?.find(w => w.name === "dimension_height");

        if (!widthWidget || !heightWidget) {
            logger.error("Could not find dimension widgets for undo!");
            return;
        }

        // Restore previous values (including toggle states)
        widthWidget.value = { ...this.undoStack.width };
        heightWidget.value = { ...this.undoStack.height };

        logger.info(`↶ Undone: Restored WIDTH=${this.undoStack.width.value} (${this.undoStack.width.on ? 'ON' : 'OFF'}), HEIGHT=${this.undoStack.height.value} (${this.undoStack.height.on ? 'ON' : 'OFF'})`);

        // Clear undo state and hide button
        this.undoStack = null;
        this.showUndo = false;

        // Mark node as modified and refresh canvas
        node.setDirtyCanvas(true, true);
    }

    /**
     * Show success notification
     */
    showSuccessNotification(node, width, height, source) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        const aspectRatio = `${width/divisor}:${height/divisor}`;

        logger.info(`✓ Copied from ${source}: ${width}×${height} (${aspectRatio})`);

        // Optional: Could show a brief toast notification here
        // For now, the log message is sufficient
    }

    /**
     * Show instructions dialog (Tier 3 fallback)
     */
    showInstructionsDialog() {
        const canvas = app.canvas;
        canvas.prompt(
            "Copy Image Dimensions",
            "To copy dimensions:\n\n1. Run the workflow once (Queue Prompt)\n2. After execution, click this button again\n3. Cached dimensions will be extracted\n\nOr manually enter width and height from your source image.\n\n(Server endpoint requires Load Image node with file path)",
            null,
            event
        );
        logger.debug("Showing instructions dialog (all auto-methods failed)");
    }

    isInBounds(pos, bounds) {
        if (!bounds) return false;
        return pos[0] >= bounds.x &&
               pos[0] <= bounds.x + bounds.width &&
               pos[1] >= bounds.y &&
               pos[1] <= bounds.y + bounds.height;
    }

    computeSize(width) {
        return [width, 32];  // Button height
    }

    serializeValue(node, index) {
        // Buttons don't serialize - they're action triggers
        return undefined;
    }
}

/**
 * Register the Smart Resolution Calculator extension
 */
app.registerExtension({
    name: "SmartResolutionCalc.CompactWidgets",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "SmartResolutionCalc") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                logger.debug('onNodeCreated called for node:', this.id);

                // Enable widget serialization (required for custom widgets to pass data to Python)
                this.serialize_widgets = true;
                logger.debug('serialize_widgets set to:', this.serialize_widgets);

                // Add image mode widget (USE IMAGE? toggle + AR Only/Exact Dims selector)
                // Asymmetric toggle: Can't enable without image, can disable anytime
                // Conditional values: Mode only editable when toggle ON and image connected
                const imageModeWidget = new ImageModeWidget("image_mode", {
                    toggleBehavior: ToggleBehavior.ASYMMETRIC,
                    valueBehavior: ValueBehavior.CONDITIONAL
                });

                // Add copy from image button
                const copyButton = new CopyImageButton("copy_from_image");

                // Add compact dimension widgets
                // Symmetric toggle: Can enable/disable freely
                // Always values: Can edit values even when toggle OFF
                const mpWidget = new DimensionWidget("dimension_megapixel", 1.0, false, {
                    toggleBehavior: ToggleBehavior.SYMMETRIC,
                    valueBehavior: ValueBehavior.ALWAYS,
                    tooltipContent: TOOLTIP_CONTENT.megapixel  // Add tooltip for MEGAPIXEL
                });
                const widthWidget = new DimensionWidget("dimension_width", 1920, true, {
                    toggleBehavior: ToggleBehavior.SYMMETRIC,
                    valueBehavior: ValueBehavior.ALWAYS
                });
                const heightWidget = new DimensionWidget("dimension_height", 1080, true, {
                    toggleBehavior: ToggleBehavior.SYMMETRIC,
                    valueBehavior: ValueBehavior.ALWAYS
                });

                // Add custom scale widget
                const scaleWidget = new ScaleWidget("scale", 1.0);

                // Add widgets to node (image mode first, then copy button, then dimension controls, then scale)
                this.addCustomWidget(imageModeWidget);
                this.addCustomWidget(copyButton);
                this.addCustomWidget(mpWidget);
                this.addCustomWidget(widthWidget);
                this.addCustomWidget(heightWidget);
                this.addCustomWidget(scaleWidget);

                logger.debug('Added 6 custom widgets to node (image mode + copy button + dimensions + scale)');
                logger.debug('Widget names:', imageModeWidget.name, copyButton.name, mpWidget.name, widthWidget.name, heightWidget.name, scaleWidget.name);

                // Hide the default "scale" widget created by ComfyUI (we use custom widget instead)
                const defaultScaleWidget = this.widgets.find(w => w.name === "scale" && w.type !== "custom");
                if (defaultScaleWidget) {
                    defaultScaleWidget.type = "converted-widget";
                    defaultScaleWidget.computeSize = () => [0, -4];  // Hide it from layout
                    defaultScaleWidget.draw = () => {};  // Prevent it from rendering entirely
                    logger.debug('Hidden default scale widget (blocked draw method)');
                }

                // Set initial size (widgets will auto-adjust)
                this.setSize(this.computeSize());

                // Wrap native ComfyUI widgets with tooltip support
                // These are created by Python node definition, not custom widgets
                const divisibleWidget = this.widgets.find(w => w.name === "divisible_by");
                if (divisibleWidget) {
                    wrapWidgetWithTooltip(divisibleWidget, TOOLTIP_CONTENT.divisible_by, this);
                    logger.debug('Added tooltip to divisible_by widget, type:', divisibleWidget.type);
                } else {
                    logger.debug('divisible_by widget not found');
                }

                const customAspectRatioWidget = this.widgets.find(w => w.name === "custom_aspect_ratio");
                if (customAspectRatioWidget) {
                    wrapWidgetWithTooltip(customAspectRatioWidget, TOOLTIP_CONTENT.custom_aspect_ratio, this);
                    logger.debug('Added tooltip to custom_aspect_ratio widget, type:', customAspectRatioWidget.type);
                } else {
                    logger.debug('custom_aspect_ratio widget not found');
                }

                const aspectRatioWidget = this.widgets.find(w => w.name === "aspect_ratio");
                if (aspectRatioWidget) {
                    wrapWidgetWithTooltip(aspectRatioWidget, TOOLTIP_CONTENT.aspect_ratio, this);
                    logger.debug('Added tooltip to aspect_ratio widget, type:', aspectRatioWidget.type);
                } else {
                    logger.debug('aspect_ratio widget not found');
                }

                // Set up hit areas for native widgets after they're drawn
                // We need to intercept drawWidgets to get accurate Y positions
                const originalDrawWidgets = nodeType.prototype.drawWidgets;
                nodeType.prototype.drawWidgets = function(ctx, area) {
                    // Call original drawWidgets
                    if (originalDrawWidgets) {
                        originalDrawWidgets.call(this, ctx, area);
                    }

                    // After widgets are drawn, set hit areas for native widgets with tooltips
                    ctx.save();
                    ctx.font = "13px sans-serif";

                    for (const widget of this.widgets) {
                        if (widget.infoIcon && widget.type !== "custom" && widget.last_y !== undefined) {
                            // Native widget with tooltip - last_y is set by LiteGraph during rendering
                            const widgetHeight = LiteGraph.NODE_WIDGET_HEIGHT;
                            const labelText = widget.label || widget.name;
                            const labelWidth = ctx.measureText(labelText).width;

                            // Set hit area using LiteGraph's last_y position
                            widget.infoIcon.setHitArea(15, widget.last_y, labelWidth, widgetHeight);
                        }
                    }

                    ctx.restore();
                };

                // ===== NEW: Conditional visibility for image output parameters =====
                // Hide image output parameters until "image" output (position 5) is connected

                // Store references to image output widgets
                this.imageOutputWidgets = {
                    output_image_mode: this.widgets.find(w => w.name === "output_image_mode"),
                    fill_type: this.widgets.find(w => w.name === "fill_type"),
                    fill_color: this.widgets.find(w => w.name === "fill_color")
                };

                // Store original widget types, indices, and default values for restore
                this.imageOutputWidgetIndices = {};
                this.imageOutputWidgetValues = {
                    output_image_mode: "auto",
                    fill_type: "black",
                    fill_color: "#808080"
                };
                Object.keys(this.imageOutputWidgets).forEach(key => {
                    const widget = this.imageOutputWidgets[key];
                    if (widget) {
                        widget.origType = widget.type;
                        // Store original index in widgets array
                        this.imageOutputWidgetIndices[key] = this.widgets.indexOf(widget);
                        // Initialize widget value if not already set
                        if (widget.value === undefined || typeof widget.value === 'object') {
                            widget.value = this.imageOutputWidgetValues[key];
                        } else {
                            // Use actual widget value if already initialized
                            this.imageOutputWidgetValues[key] = widget.value;
                        }
                    }
                });

                // ===== Color picker button widget =====
                // Create a dedicated button widget for color picking, separate from text widget
                const fillColorWidget = this.imageOutputWidgets.fill_color;
                if (fillColorWidget) {
                    // Helper function to calculate contrasting text color
                    const getContrastColor = (hexColor) => {
                        // Remove # if present
                        const hex = hexColor.replace('#', '');
                        // Convert to RGB
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        // Calculate luminance
                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        // Return black for light colors, white for dark colors
                        return luminance > 0.5 ? '#000000' : '#FFFFFF';
                    };

                    // Create button widget for color picker
                    const colorPickerButton = this.addWidget("button", "🎨 Pick Color", null, function() {
                        const currentColor = fillColorWidget.value || "#808080";
                        const normalizedColor = currentColor.startsWith('#') ? currentColor : '#' + currentColor;

                        visibilityLogger.debug('Color picker button clicked, opening picker');

                        // Calculate button position on screen for better color picker placement
                        const nodePos = this.pos;
                        const buttonIndex = this.widgets.indexOf(colorPickerButton);

                        // Estimate button Y position (approximate)
                        let buttonY = nodePos[1] + 80; // Node header height
                        for (let i = 0; i < buttonIndex; i++) {
                            buttonY += 30; // Approximate widget height
                        }

                        // Create color input positioned near the button
                        const colorInput = document.createElement("input");
                        colorInput.type = "color";
                        colorInput.value = normalizedColor;
                        colorInput.style.position = "fixed"; // Use fixed positioning
                        colorInput.style.left = (nodePos[0] + 50) + "px"; // Position near node
                        colorInput.style.top = buttonY + "px";
                        colorInput.style.width = "50px";
                        colorInput.style.height = "50px";
                        colorInput.style.border = "none";
                        colorInput.style.opacity = "0"; // Still invisible, but positioned
                        colorInput.style.pointerEvents = "auto"; // Allow interaction
                        document.body.appendChild(colorInput);

                        // Handle color selection
                        colorInput.addEventListener("change", (e) => {
                            fillColorWidget.value = e.target.value;
                            this.setDirtyCanvas(true, true);
                            visibilityLogger.debug(`Color selected: ${e.target.value}`);
                            document.body.removeChild(colorInput);
                        });

                        // Handle cancellation
                        colorInput.addEventListener("blur", () => {
                            setTimeout(() => {
                                if (colorInput.parentNode) {
                                    document.body.removeChild(colorInput);
                                    visibilityLogger.debug('Color picker cancelled');
                                }
                            }, 100);
                        });

                        // Open color picker
                        colorInput.click();
                        colorInput.focus();
                    });

                    // Custom draw to show current color
                    colorPickerButton.draw = function(ctx, node, width, y, height) {
                        const currentColor = fillColorWidget.value || "#808080";
                        const normalizedColor = currentColor.startsWith('#') ? currentColor : '#' + currentColor;
                        const contrastColor = getContrastColor(normalizedColor);

                        // Draw color preview background
                        ctx.fillStyle = normalizedColor;
                        ctx.fillRect(0, y, width, height);

                        // Draw border
                        ctx.strokeStyle = "#666";
                        ctx.lineWidth = 1;
                        ctx.strokeRect(0, y, width, height);

                        // Draw text: emoji + hex value
                        ctx.fillStyle = contrastColor;
                        ctx.font = "12px monospace";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(`🎨 ${normalizedColor.toUpperCase()}`, width / 2, y + height / 2);
                    };

                    // Insert button right after fill_color widget (not at end)
                    const fillColorIndex = this.widgets.indexOf(fillColorWidget);
                    this.widgets.splice(fillColorIndex + 1, 0, colorPickerButton);

                    // Add button to image output widgets list
                    this.imageOutputWidgets.color_picker_button = colorPickerButton;

                    // Store original widget index for button
                    this.imageOutputWidgetIndices.color_picker_button = fillColorIndex + 1;
                }

                // Function to update widget visibility based on image output connection
                this.updateImageOutputVisibility = function() {
                    // Ensure outputs array exists and has enough elements
                    if (!this.outputs || this.outputs.length < 6) {
                        return; // Outputs not ready yet
                    }

                    // Check if image output (position 5) has connections
                    const imageOutput = this.outputs[5]; // Position 5 = "image" output

                    // Filter out null/undefined links - array might contain nulls after disconnect
                    const hasConnection = imageOutput && imageOutput.links &&
                                        imageOutput.links.filter(link => link != null).length > 0;

                    visibilityLogger.debug(`Image output connected: ${hasConnection}`);

                    // Show/hide widgets based on connection status
                    Object.keys(this.imageOutputWidgets).forEach(key => {
                        const widget = this.imageOutputWidgets[key];
                        if (widget) {
                            const currentIndex = this.widgets.indexOf(widget);
                            const isCurrentlyVisible = currentIndex !== -1;

                            if (hasConnection && !isCurrentlyVisible) {
                                // Show widget - add back to widgets array at original position
                                const targetIndex = this.imageOutputWidgetIndices[key];
                                // Restore value before adding (but only if it's a primitive, not object)
                                const savedValue = this.imageOutputWidgetValues[key];
                                if (savedValue !== undefined && typeof savedValue !== 'object') {
                                    widget.value = savedValue;
                                }
                                this.widgets.splice(targetIndex, 0, widget);
                                widget.type = widget.origType || "combo";
                                visibilityLogger.debug(`Widget ${key} shown, value: ${widget.value}`);
                            } else if (!hasConnection && isCurrentlyVisible) {
                                // Hide widget - save current value (but only if it's a primitive, not object)
                                if (typeof widget.value !== 'object') {
                                    this.imageOutputWidgetValues[key] = widget.value;
                                    visibilityLogger.debug(`Widget ${key} hidden, saved value: ${widget.value}`);
                                } else {
                                    visibilityLogger.warn(`Widget ${key} value is object, using default: ${this.imageOutputWidgetValues[key]}`);
                                }
                                this.widgets.splice(currentIndex, 1);
                            }
                        }
                    });

                    // Resize node to accommodate shown/hidden widgets
                    this.setSize(this.computeSize());
                };

                // Initially hide widgets - delay until outputs are ready
                setTimeout(() => {
                    this.updateImageOutputVisibility();
                }, 100);

                // Monitor connection changes - store bound function on instance
                const originalOnConnectionsChange = this.onConnectionsChange;
                this.onConnectionsChange = function(type, index, connected, link_info) {
                    // Call original handler
                    if (originalOnConnectionsChange) {
                        originalOnConnectionsChange.apply(this, arguments);
                    }

                    // If image output (position 5) connection changed, update visibility
                    if (type === LiteGraph.OUTPUT && index === 5) {
                        this.updateImageOutputVisibility();
                    }
                };

                // Also monitor onConnectionsRemove for disconnect events (fallback)
                const originalOnConnectionsRemove = this.onConnectionsRemove;
                this.onConnectionsRemove = function(type, index, link_info) {
                    // Call original handler
                    if (originalOnConnectionsRemove) {
                        originalOnConnectionsRemove.apply(this, arguments);
                    }

                    // If image output (position 5) was disconnected, update visibility
                    if (type === LiteGraph.OUTPUT && index === 5) {
                        this.updateImageOutputVisibility();
                    }
                };

                // Periodic check for connection status changes (fallback for when events don't fire)
                // NOTE: This is necessary because LiteGraph disconnect events don't fire reliably
                // The 500ms polling is acceptable UX-wise and handles the edge case
                this._lastImageConnectionState = false;
                this._connectionCheckInterval = setInterval(() => {
                    if (!this.outputs || this.outputs.length < 6) return;

                    const imageOutput = this.outputs[5];
                    const currentState = imageOutput && imageOutput.links &&
                                       imageOutput.links.filter(link => link != null).length > 0;

                    if (currentState !== this._lastImageConnectionState) {
                        visibilityLogger.debug(`Image connection state changed: ${this._lastImageConnectionState} → ${currentState}`);
                        this._lastImageConnectionState = currentState;
                        this.updateImageOutputVisibility();
                    }
                }, 500); // Check every 500ms

                return r;
            };

            // Intercept node-level mouse events to handle native widget tooltips
            // Native widgets don't get their mouse() method called by LiteGraph
            const originalOnMouseMove = nodeType.prototype.onMouseMove;
            nodeType.prototype.onMouseMove = function(event, localPos, graphCanvas) {
                // Check native widgets with tooltips first
                for (const widget of this.widgets) {
                    if (widget.infoIcon && widget.type !== "custom") {
                        const canvasBounds = { width: this.size[0], height: this.size[1] };
                        if (widget.infoIcon.mouse(event, localPos, canvasBounds, this.pos)) {
                            this.setDirtyCanvas(true, true);
                            return true; // Tooltip handled the event
                        }
                    }
                }

                // Call original handler
                if (originalOnMouseMove) {
                    return originalOnMouseMove.call(this, event, localPos, graphCanvas);
                }
                return false;
            };

            const originalOnMouseDown = nodeType.prototype.onMouseDown;
            nodeType.prototype.onMouseDown = function(event, localPos, graphCanvas) {
                // Check native widgets with tooltips first (for Shift+Click)
                for (const widget of this.widgets) {
                    if (widget.infoIcon && widget.type !== "custom") {
                        const canvasBounds = { width: this.size[0], height: this.size[1] };
                        if (widget.infoIcon.mouse(event, localPos, canvasBounds, this.pos)) {
                            this.setDirtyCanvas(true, true);
                            return true; // Tooltip handled the event
                        }
                    }
                }

                // Call original handler
                if (originalOnMouseDown) {
                    return originalOnMouseDown.call(this, event, localPos, graphCanvas);
                }
                return false;
            };

            // Store scale widget configuration in workflow (not sent to Python)
            const onSerialize = nodeType.prototype.serialize;
            nodeType.prototype.serialize = function() {
                const data = onSerialize ? onSerialize.apply(this) : {};

                // Store scale widget step configuration
                const scaleWidget = this.widgets ? this.widgets.find(w => w instanceof ScaleWidget) : null;
                if (scaleWidget) {
                    if (!data.widgets_config) data.widgets_config = {};
                    data.widgets_config.scale = {
                        leftStep: scaleWidget.leftStep,
                        rightStep: scaleWidget.rightStep
                    };
                    logger.debug('Serializing scale config:', data.widgets_config.scale);
                }

                return data;
            };

            // Handle widget serialization for workflow save/load
            const onConfigure = nodeType.prototype.configure;
            nodeType.prototype.configure = function(info) {
                logger.group('configure called');
                logger.debug('info:', info);
                logger.debug('widgets_values:', info.widgets_values);

                if (onConfigure) {
                    onConfigure.apply(this, arguments);
                }

                // Restore widget values from saved workflow
                if (info.widgets_values) {
                    // Restore ImageModeWidget (has {on, value} structure)
                    const imageModeWidgets = this.widgets.filter(w => w instanceof ImageModeWidget);
                    const imageModeValues = info.widgets_values.filter(v => v && typeof v === 'object' && 'on' in v && 'value' in v && typeof v.value === 'number' && v.value <= 1);

                    logger.debug('Found', imageModeWidgets.length, 'ImageModeWidgets and', imageModeValues.length, 'image mode values');

                    if (imageModeWidgets.length > 0 && imageModeValues.length > 0) {
                        logger.debug(`Restoring ${imageModeWidgets[0].name}:`, imageModeValues[0]);
                        imageModeWidgets[0].value = { ...imageModeValues[0] };
                    }

                    // Restore DimensionWidgets (have {on, value} structure)
                    const dimWidgets = this.widgets.filter(w => w instanceof DimensionWidget);
                    const dimValues = info.widgets_values.filter(v => v && typeof v === 'object' && 'on' in v && 'value' in v && typeof v.value === 'number' && v.value > 1);

                    logger.debug('Found', dimWidgets.length, 'DimensionWidgets and', dimValues.length, 'dimension values');

                    for (let i = 0; i < Math.min(dimWidgets.length, dimValues.length); i++) {
                        if (dimValues[i]) {
                            logger.debug(`Restoring ${dimWidgets[i].name}:`, dimValues[i]);
                            dimWidgets[i].value = { ...dimValues[i] };
                        }
                    }

                    // Restore ScaleWidget value (just the number)
                    const scaleWidgets = this.widgets.filter(w => w instanceof ScaleWidget);
                    const scaleValues = info.widgets_values.filter(v => typeof v === 'number');

                    logger.debug('Found', scaleWidgets.length, 'ScaleWidgets and', scaleValues.length, 'scale values');

                    for (let i = 0; i < Math.min(scaleWidgets.length, scaleValues.length); i++) {
                        if (typeof scaleValues[i] === 'number') {
                            logger.debug(`Restoring ${scaleWidgets[i].name} value:`, scaleValues[i]);
                            scaleWidgets[i].value = scaleValues[i];
                        }
                    }

                    // Restore ScaleWidget step configuration from widgets_config
                    if (info.widgets_config && info.widgets_config.scale) {
                        const scaleWidget = this.widgets.find(w => w instanceof ScaleWidget);
                        if (scaleWidget) {
                            scaleWidget.leftStep = info.widgets_config.scale.leftStep || 0.05;
                            scaleWidget.rightStep = info.widgets_config.scale.rightStep || 0.1;
                            logger.debug('Restored scale config:', info.widgets_config.scale);
                        }
                    }
                }

                logger.groupEnd();
            };

            // Add visual indicator when image input is connected
            // Also disable/enable USE_IMAGE widget based on connection state
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info) {
                if (onConnectionsChange) {
                    onConnectionsChange.apply(this, arguments);
                }

                // Check if this is the image input (find it dynamically)
                if (type === LiteGraph.INPUT && this.inputs && this.inputs[index]) {
                    const input = this.inputs[index];

                    if (input.name === "image") {
                        // Find the ImageModeWidget and ScaleWidget
                        const imageModeWidget = this.widgets?.find(w => w.name === "image_mode");
                        const scaleWidget = this.widgets?.find(w => w.name === "scale");

                        if (connected) {
                            // Mark image as connected (enable asymmetric toggle logic)
                            if (imageModeWidget) {
                                imageModeWidget.imageDisconnected = false;
                            }

                            // Trigger dimension cache refresh for scale tooltip
                            if (scaleWidget && scaleWidget.refreshImageDimensions) {
                                logger.info('[Connection] Image connected, triggering scale dimension refresh');
                                scaleWidget.refreshImageDimensions(this);
                            } else {
                                logger.debug('[Connection] No scale widget or refresh method found');
                            }

                            logger.debug('Image input connected - USE_IMAGE widget enabled');
                        } else {
                            // Mark image as disconnected (enable asymmetric toggle logic)
                            if (imageModeWidget) {
                                imageModeWidget.imageDisconnected = true;
                            }

                            // Clear dimension cache when image disconnected
                            if (scaleWidget) {
                                scaleWidget.imageDimensionsCache = null;
                                logger.info('[Connection] Image disconnected, cleared scale dimension cache');
                            }

                            logger.debug('Image input disconnected - USE_IMAGE asymmetric toggle active');
                        }

                        // Trigger canvas redraw to update disabled state visually
                        if (this.graph && this.graph.canvas) {
                            this.graph.canvas.setDirty(true);
                        }
                    }
                }
            };

            // No node-level rendering needed - tooltips draw at graph level for proper z-order

            // WORKAROUND: Manually route mouse events to custom widgets
            // ComfyUI's addCustomWidget doesn't seem to be routing pointermove events correctly
            const onMouseMove = nodeType.prototype.onMouseMove;
            nodeType.prototype.onMouseMove = function(e, localPos, graphCanvas) {
                // Call original handler first
                if (onMouseMove) {
                    onMouseMove.apply(this, arguments);
                }

                // Manually route to custom widgets that have mouse() methods
                if (this.widgets) {
                    for (const widget of this.widgets) {
                        if (widget.type === "custom" && typeof widget.mouse === "function") {
                            // Convert event to pointermove format
                            const event = { type: "pointermove" };
                            // Call widget's mouse handler with node-local coordinates
                            if (widget.mouse(event, localPos, this)) {
                                // Widget handled the event, mark canvas as dirty to trigger redraw
                                this.setDirtyCanvas(true);
                                return true;
                            }
                        }
                    }
                }

                return false;
            };

            // WORKAROUND: Manually route mouse down events to custom widgets
            const onMouseDown = nodeType.prototype.onMouseDown;
            nodeType.prototype.onMouseDown = function(e, localPos, graphCanvas) {
                // Call original handler first
                if (onMouseDown) {
                    const result = onMouseDown.apply(this, arguments);
                    if (result) return result;
                }

                // Manually route to custom widgets that have mouse() methods
                if (this.widgets) {
                    for (const widget of this.widgets) {
                        if (widget.type === "custom" && typeof widget.mouse === "function") {
                            // Convert event to pointerdown format
                            const event = { type: "pointerdown" };
                            // Call widget's mouse handler with node-local coordinates
                            if (widget.mouse(event, localPos, this)) {
                                // Widget handled the event, mark canvas as dirty to trigger redraw
                                this.setDirtyCanvas(true);
                                return true;
                            }
                        }
                    }
                }

                return false;
            };

        }
    },

    // Hook into global canvas rendering to draw tooltips on top of EVERYTHING
    async setup() {
        logger.verbose('setup() called - hooking app.canvas.onDrawForeground');

        const originalDrawForeground = app.canvas.onDrawForeground;

        app.canvas.onDrawForeground = function(ctx) {
            if (originalDrawForeground) {
                originalDrawForeground.call(this, ctx);
            }

            // Draw tooltips at graph level with SCREEN COORDINATES (proper z-order)
            // The context has graph-space transform applied, so we need to:
            // 1. Get current transform to convert icon bounds to screen space
            // 2. Reset transform to identity (screen space)
            // 3. Draw tooltip at screen coordinates
            // 4. Restore original transform

            if (!tooltipManager.activeTooltip) return;

            // Get current transform (graph to screen)
            const transform = ctx.getTransform();

            // Convert icon bounds from canvas-global to screen coordinates
            const bounds = tooltipManager.activeTooltip.bounds;
            const screenBounds = {
                x: bounds.x * transform.a + bounds.y * transform.c + transform.e,
                y: bounds.x * transform.b + bounds.y * transform.d + transform.f,
                width: bounds.width * transform.a,
                height: bounds.height * transform.d
            };


            // Get device pixel ratio for proper scaling
            const dpr = window.devicePixelRatio || 1;
            logger.verbose('Device pixel ratio:', dpr);

            // Save current state and reset to device-pixel-ratio transform
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Calculate canvas bounds in CSS pixels
            const canvasBounds = {
                width: this.canvas ? this.canvas.width / dpr : 2000,
                height: this.canvas ? this.canvas.height / dpr : 2000
            };

            // Convert screen bounds from device pixels to CSS pixels
            const cssBounds = {
                x: screenBounds.x / dpr,
                y: screenBounds.y / dpr,
                width: screenBounds.width / dpr,
                height: screenBounds.height / dpr
            };


            // Draw tooltip in CSS pixel space (with DPR transform applied)
            tooltipManager.drawAtScreenCoords(ctx, cssBounds, canvasBounds);

            // Restore transform
            ctx.restore();
        };

        logger.verbose('app.canvas.onDrawForeground hook installed');
    }
});

console.log("[SmartResCalc] Compact widgets loaded (rgthree-style) - Debug:", logger.enabled);

})().catch(error => {
    console.error("[SmartResCalc] Failed to load extension:", error);
    console.error("[SmartResCalc] This may be due to incorrect import paths. Check browser console for details.");
});
