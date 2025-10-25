import { app } from "../../scripts/app.js";

/**
 * Smart Resolution Calculator - Compact Custom Widgets
 *
 * rgthree-style compact widgets with toggle on LEFT, value on RIGHT
 * Reduced spacing and height for professional, space-efficient layout
 */

/**
 * Debug Logger - toggleable via localStorage
 * Enable with: localStorage.setItem('DEBUG_SMART_RES_CALC', 'true')
 * Disable with: localStorage.removeItem('DEBUG_SMART_RES_CALC')
 */
class DebugLogger {
    constructor(name) {
        this.name = name;
        // Check localStorage OR URL parameter for debug mode
        this.enabled = localStorage.getItem('DEBUG_SMART_RES_CALC') === 'true' ||
                      window.location.search.includes('debug=smart-res');

        if (this.enabled) {
            console.log(`[${this.name}] Debug mode enabled`);
        }
    }

    debug(...args) {
        if (this.enabled) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    group(label) {
        if (this.enabled) console.group(`[${this.name}] ${label}`);
    }

    groupEnd() {
        if (this.enabled) console.groupEnd();
    }
}

const logger = new DebugLogger('SmartResCalc');

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

        // Calculate base dimensions with proper aspect ratio handling
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
        ctx.fillText("SCALE", posX, midY);

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
    constructor(name, defaultValue, isInteger = true) {
        this.name = name;
        this.type = "custom";
        this.isInteger = isInteger;
        this.value = {
            on: false,
            value: defaultValue
        };

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
        ctx.fillText(labelText, posX, midY);

        // Draw number controls (RIGHT side)
        const numberWidth = 110;  // Reduced from 120 for compact layout
        const numberX = width - margin - numberWidth - innerMargin;

        if (this.value.on) {
            this.drawNumberWidget(ctx, numberX, y, numberWidth, height, this.value.on);
        } else {
            // Draw grayed out value
            ctx.fillStyle = "#555555";
            ctx.textAlign = "center";
            ctx.font = "12px monospace";
            const displayValue = this.isInteger ? String(Math.round(this.value.value)) : this.value.value.toFixed(1);
            ctx.fillText(displayValue, numberX + numberWidth / 2, midY);
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

            // Only handle number controls if toggle is on
            if (this.value.on) {
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
    constructor(name = "image_mode") {
        this.name = name;
        this.type = "custom";
        this.value = {
            on: true,   // Default: enabled
            value: 0    // 0 = AR Only, 1 = Exact Dims
        };

        // Mode labels
        this.modes = ["AR Only", "Exact Dims"];

        // Mouse state
        this.mouseDowned = null;
        this.isMouseDownedAndOver = false;

        // Hit areas
        this.hitAreas = {
            toggle: { x: 0, y: 0, width: 0, height: 0 },
            modeSelector: { x: 0, y: 0, width: 0, height: 0 }
        };
    }

    /**
     * Draw compact widget matching DimensionWidget style
     * Layout: [Toggle] USE IMAGE? [AR Only/Exact Dims]
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

        // Draw toggle switch (LEFT) - matching DimensionWidget style
        const toggleWidth = height * 1.5;
        this.drawToggle(ctx, posX, y, height, this.value.on);
        this.hitAreas.toggle = { x: posX, y, width: toggleWidth, height };
        posX += toggleWidth + innerMargin * 2;

        // Draw label (MIDDLE) - "USE IMAGE?"
        ctx.fillStyle = this.value.on ? "#ffffff" : "#888888";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "13px sans-serif";
        ctx.fillText("USE IMAGE?", posX, midY);

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

        this.hitAreas.modeSelector = { x: modeX, y, width: modeWidth, height };

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

        // Toggle circle (green when ON, gray when OFF - matching DimensionWidget)
        const circleX = state ? x + height : x + height * 0.5;
        ctx.beginPath();
        ctx.arc(circleX, y + height * 0.5, radius, 0, Math.PI * 2);
        ctx.fillStyle = state ? "#4CAF50" : "#888888";  // Green when ON, gray when OFF
        ctx.fill();

        ctx.restore();
    }

    /**
     * Handle mouse events
     */
    mouse(event, pos, node) {
        if (event.type === "pointerdown") {
            this.mouseDowned = [...pos];
            this.isMouseDownedAndOver = true;

            // Toggle click
            if (this.isInBounds(pos, this.hitAreas.toggle)) {
                const oldState = this.value.on;
                this.value.on = !this.value.on;
                logger.debug(`Image mode toggle: ${oldState} → ${this.value.on}`);
                node.setDirtyCanvas(true);
                return true;
            }

            // Mode selector click (only if enabled)
            if (this.value.on && this.isInBounds(pos, this.hitAreas.modeSelector)) {
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
        this.type = "button";
        this.value = null;  // Buttons don't need a value
    }

    draw(ctx, node, width, y, height) {
        ctx.save();

        const x = 15;  // Standard widget left margin
        const buttonWidth = width - 30;  // Leave margins on both sides
        const buttonHeight = 28;

        // Check if image is connected
        const imageInput = node.inputs ? node.inputs.find(i => i.name === "image") : null;
        const hasImage = imageInput && imageInput.link != null;

        // Button style
        if (hasImage) {
            // Active state - image connected
            ctx.fillStyle = this.isHovering ? "#4a7a9a" : "#3a5a7a";
        } else {
            // Disabled state - no image
            ctx.fillStyle = "#2a2a2a";
        }

        // Draw button background
        ctx.beginPath();
        ctx.roundRect(x, y, buttonWidth, buttonHeight, 4);
        ctx.fill();

        // Button border
        ctx.strokeStyle = hasImage ? "#5a8aaa" : "#3a3a3a";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Button text
        ctx.fillStyle = hasImage ? "#ffffff" : "#666666";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const text = hasImage ? "📋 Copy from Image" : "📋 Copy from Image (No Image)";
        ctx.fillText(text, x + buttonWidth / 2, y + buttonHeight / 2);

        // Store hit area
        this.hitArea = { x, y, width: buttonWidth, height: buttonHeight };

        ctx.restore();
    }

    mouse(event, pos, node) {
        if (event.type === "pointermove") {
            // Check hover state
            this.isHovering = this.isInBounds(pos, this.hitArea);
            if (this.isHovering) {
                node.setDirtyCanvas(true);
            }
            return false;
        }

        if (event.type === "pointerdown") {
            if (this.isInBounds(pos, this.hitArea)) {
                // Check if image is connected
                const imageInput = node.inputs ? node.inputs.find(i => i.name === "image") : null;
                if (imageInput && imageInput.link != null) {
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
        }

        if (event.type === "pointerup") {
            if (this.isHovering) {
                this.isHovering = false;
                node.setDirtyCanvas(true);
            }
        }

        return false;
    }

    copyFromImage(node, sourceNode) {
        logger.debug("Copy from Image clicked!");

        // Get image dimensions from last execution if available
        // In ComfyUI, we need to wait for actual execution to get image data
        // So instead, we'll use a different approach: trigger a lightweight execution

        // For now, show a helpful message
        const canvas = app.canvas;
        canvas.prompt(
            "Copy Image Dimensions",
            "To copy dimensions:\n1. Run the workflow once (Queue Prompt)\n2. Image dimensions will auto-populate\n\nOr manually enter width and height from your source image.",
            null,
            event
        );

        logger.debug("Copy from image - prompting user for manual entry alternative");

        // TODO: In future version, could add actual dimension extraction by:
        // 1. Accessing node's output cache if available
        // 2. Or adding a Python endpoint to extract dims without full execution
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
                const imageModeWidget = new ImageModeWidget("image_mode");

                // Add copy from image button
                const copyButton = new CopyImageButton("copy_from_image");

                // Add compact dimension widgets
                const mpWidget = new DimensionWidget("dimension_megapixel", 1.0, false);
                const widthWidget = new DimensionWidget("dimension_width", 1920, true);
                const heightWidget = new DimensionWidget("dimension_height", 1080, true);

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
                    defaultScaleWidget.computeSize = () => [0, -4];  // Hide it
                    logger.debug('Hidden default scale widget');
                }

                // Set initial size (widgets will auto-adjust)
                this.setSize(this.computeSize());

                return r;
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
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info) {
                if (onConnectionsChange) {
                    onConnectionsChange.apply(this, arguments);
                }

                // Check if this is the image input (find it dynamically)
                if (type === LiteGraph.INPUT && this.inputs && this.inputs[index]) {
                    const input = this.inputs[index];

                    if (input.name === "image") {
                        if (connected) {
                            // Image connected - add subtle visual indicator
                            this.bgcolor = "#1a2a3a";  // Slightly different background
                            this.color = "#4a7a9a";    // Blueish tint
                            logger.debug('Image input connected - visual indicator enabled');
                        } else {
                            // Image disconnected - restore default colors
                            this.bgcolor = null;
                            this.color = null;
                            logger.debug('Image input disconnected - visual indicator removed');
                        }

                        // Trigger canvas redraw
                        if (this.graph && this.graph.canvas) {
                            this.graph.canvas.setDirty(true);
                        }
                    }
                }
            };
        }
    }
});

console.log("[SmartResCalc] Compact widgets loaded (rgthree-style) - Debug:", logger.enabled);
