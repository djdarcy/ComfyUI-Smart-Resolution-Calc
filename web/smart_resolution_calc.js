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
                    this.changeValue(-1);
                    node.setDirtyCanvas(true);
                    return true;
                }

                // Increment button
                if (this.isInBounds(pos, this.hitAreas.valueInc)) {
                    this.changeValue(1);
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
    changeValue(delta) {
        if (this.isInteger) {
            // Integer: increment by 8 (divisibility-friendly)
            this.value.value = Math.max(64, Math.round(this.value.value) + delta * 8);
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

                // Add compact dimension widgets
                const mpWidget = new DimensionWidget("dimension_megapixel", 1.0, false);
                const widthWidget = new DimensionWidget("dimension_width", 1920, true);
                const heightWidget = new DimensionWidget("dimension_height", 1080, true);

                // Add widgets to node
                this.addCustomWidget(mpWidget);
                this.addCustomWidget(widthWidget);
                this.addCustomWidget(heightWidget);

                logger.debug('Added 3 custom widgets to node');
                logger.debug('Widget names:', mpWidget.name, widthWidget.name, heightWidget.name);

                // Set initial size (widgets will auto-adjust)
                this.setSize(this.computeSize());

                return r;
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
                    const widgets = this.widgets.filter(w => w instanceof DimensionWidget);
                    const widgetValues = info.widgets_values.filter(v => v && typeof v === 'object' && 'on' in v);

                    logger.debug('Found', widgets.length, 'DimensionWidgets and', widgetValues.length, 'widget values');

                    for (let i = 0; i < Math.min(widgets.length, widgetValues.length); i++) {
                        if (widgetValues[i]) {
                            logger.debug(`Restoring ${widgets[i].name}:`, widgetValues[i]);
                            widgets[i].value = { ...widgetValues[i] };
                        }
                    }
                }

                logger.groupEnd();
            };
        }
    }
});

console.log("[SmartResCalc] Compact widgets loaded (rgthree-style) - Debug:", logger.enabled);
