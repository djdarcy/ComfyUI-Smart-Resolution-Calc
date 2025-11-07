/**
 * Debug Logger - Multi-level logging system
 *
 * WARNING: Do NOT use logger calls in hot paths (draw cycles, high-frequency operations)!
 * Even with logging disabled, function call overhead can cause performance issues.
 * Use direct console.log() in hot paths, or implement zero-cost logging pattern.
 *
 * Levels (from most to least verbose):
 * - VERBOSE: Detailed internal state (mouse events, hit areas, every step)
 * - DEBUG: Standard debugging (user actions, state changes)
 * - INFO: Important events (always shown when debug enabled)
 * - ERROR: Always shown (errors and warnings)
 *
 * Usage:
 * ```javascript
 * import { DebugLogger } from './utils/debug_logger.js';
 * const logger = new DebugLogger('MyModule');
 * logger.debug('Something happened', data);
 * ```
 *
 * Enable debug: localStorage.setItem('DEBUG_SMART_RES_CALC', 'true')
 * Enable verbose: localStorage.setItem('VERBOSE_SMART_RES_CALC', 'true')
 * Disable: localStorage.removeItem('DEBUG_SMART_RES_CALC')
 *
 * URL Parameters:
 * - ?debug=smart-res - Enable debug mode
 * - ?verbose=smart-res - Enable verbose mode
 */
export class DebugLogger {
    constructor(name) {
        this.name = name;

        // Check localStorage OR URL parameter for debug/verbose mode
        // Cached at construction time for performance
        this.debugEnabled = localStorage.getItem('DEBUG_SMART_RES_CALC') === 'true' ||
                           window.location.search.includes('debug=smart-res');
        this.verboseEnabled = localStorage.getItem('VERBOSE_SMART_RES_CALC') === 'true' ||
                             window.location.search.includes('verbose=smart-res');

        // Announce logger initialization
        if (this.verboseEnabled) {
            console.log(`[${this.name}] Verbose mode enabled (includes all debug messages)`);
        } else if (this.debugEnabled) {
            console.log(`[${this.name}] Debug mode enabled`);
        }
    }

    /**
     * VERBOSE: Detailed internal state (mouse coords, hit areas, serialization)
     * Only shown when verbose mode explicitly enabled
     */
    verbose(...args) {
        if (this.verboseEnabled) {
            console.log(`[${this.name}] VERBOSE:`, ...args);
        }
    }

    /**
     * DEBUG: Standard debugging (user actions, state changes)
     * Shown in both debug and verbose modes
     */
    debug(...args) {
        if (this.debugEnabled || this.verboseEnabled) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    /**
     * INFO: Important events (always shown when debug enabled)
     * Shown in both debug and verbose modes
     */
    info(...args) {
        if (this.debugEnabled || this.verboseEnabled) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    /**
     * ERROR: Always shown (errors and warnings)
     * Shown regardless of debug mode
     */
    error(...args) {
        console.error(`[${this.name}] ERROR:`, ...args);
    }

    /**
     * Start a collapsible console group
     */
    group(label) {
        if (this.debugEnabled || this.verboseEnabled) {
            console.group(`[${this.name}] ${label}`);
        }
    }

    /**
     * End the current console group
     */
    groupEnd() {
        if (this.debugEnabled || this.verboseEnabled) {
            console.groupEnd();
        }
    }
}

/**
 * Create logger instances for different subsystems
 * These are the standard loggers used throughout the extension
 */
export const logger = new DebugLogger('SmartResCalc');
export const visibilityLogger = new DebugLogger('SmartResCalc:Visibility');
export const dimensionLogger = new DebugLogger('SmartResCalc:Dimensions');

// Expose loggers globally for browser console debugging
window.smartResCalcLogger = logger;
window.smartResCalcVisibilityLogger = visibilityLogger;
window.smartResCalcDimensionLogger = dimensionLogger;
