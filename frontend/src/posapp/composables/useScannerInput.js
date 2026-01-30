
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useToastStore } from "../stores/toastStore.js";
import {
    normalizeScaleBarcodeSettings,
    parseScaleBarcodeSettingsResponse,
    getScaleBarcodePrefix,
    scaleBarcodeMatches,
} from "../utils/scaleBarcode.js";
import {
    getScanTimestamp,
    sanitizeClipboardText,
    isScanCandidate,
    shouldResetScanOnInput,
    isLikelyKeyboardScan,
    isSearchFieldPrimedForScan,
} from "../utils/keyboardScan.js";
import { perfMarkStart, perfMarkEnd, scheduleFrame } from "../utils/perf.js";

/* global frappe, __, onScan */

export function useScannerInput(options = {}) {
    // Handlers (Ref-based for lazy binding)
    const onScanHandler = ref(options.onScan || null);
    const getSearchInputHandler = ref(options.getSearchInput || null);
    const setSearchInputHandler = ref(options.setSearchInput || null);
    const clearSearchHandler = ref(options.clearSearch || null);
    const focusSearchHandler = ref(options.focusSearch || null);

    const setScanHandler = (fn) => { onScanHandler.value = fn; };
    const setInputHandlers = ({ get, set, clear, focus }) => {
        if (get) getSearchInputHandler.value = get;
        if (set) setSearchInputHandler.value = set;
        if (clear) clearSearchHandler.value = clear;
        if (focus) focusSearchHandler.value = focus;
    };

    const toastStore = useToastStore();

    // State
    const scannerLocked = ref(false);
    const cameraScannerActive = ref(false); // To tracked if camera UI is open
    const scanErrorDialog = ref(false);
    const scanErrorMessage = ref("");
    const scanErrorCode = ref("");
    const scanErrorDetails = ref("");
    const pendingScanCode = ref("");
    const awaitingScanResult = ref(false);
    const scaleBarcodeSettings = ref(normalizeScaleBarcodeSettings());
    const scaleBarcodeSettingsLoaded = ref(false);

    const searchFromScanner = ref(false);
    const scanAudioContext = ref(null);
    const scanDebounceId = ref(null);
    const scanQueuedCode = ref("");

    // Keyboard Scan Detection State
    const keyboardScanBuffer = ref("");
    const keyboardScanTimer = ref(null);
    const keyboardScanLastTime = ref(0);
    const keyboardScanStartTime = ref(0);
    const keyboardScanPendingValue = ref("");

    // Config
    const keyboardScanMinLength = 12;
    const keyboardScanMaxInterval = 45;
    const keyboardScanMaxDuration = 250;
    const keyboardScanProcessingDelay = 100;

    // --- Audio ---
    const ensureScanAudioContext = () => {
        if (typeof window === "undefined") return null;
        if (!scanAudioContext.value) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return null;
            scanAudioContext.value = new AudioContext();
        }
        if (scanAudioContext.value?.state === "suspended") {
            scanAudioContext.value.resume().catch(() => { });
        }
        return scanAudioContext.value;
    };

    const playScanTone = (type = "success") => {
        if (typeof window === "undefined") return;
        try {
            const ctx = ensureScanAudioContext();
            if (!ctx) {
                if (frappe?.utils?.play_sound) {
                    frappe.utils.play_sound(type === "success" ? "submit" : "error");
                }
                return;
            }
            const now = ctx.currentTime;
            const duration = type === "success" ? 0.16 : 0.35;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = type === "success" ? 880 : 220;
            gainNode.gain.setValueAtTime(type === "success" ? 0.18 : 0.28, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.start(now);
            oscillator.stop(now + duration);
        } catch (error) {
            console.warn("Scan tone playback failed:", error);
            if (frappe?.utils?.play_sound) {
                frappe.utils.play_sound(type === "success" ? "submit" : "error");
            }
        }
    };

    // --- Error Handling ---
    const showScanError = ({ message, code = "", details = "" } = {}) => {
        scanErrorMessage.value = message || __("Unable to add scanned item.");
        scanErrorCode.value = code;
        scanErrorDetails.value = details;
        if (code) pendingScanCode.value = code;

        awaitingScanResult.value = false;
        searchFromScanner.value = false;
        scanErrorDialog.value = true;
        scannerLocked.value = true;

        playScanTone("error");

        if (frappe?.show_alert) {
            frappe.show_alert({ message: scanErrorMessage.value, indicator: "red" }, 5);
        }
    };

    const handleScanPipelineError = (error, code = "") => {
        const normalizedCode = code || pendingScanCode.value || "";
        console.error("Unexpected barcode processing error:", error);
        const details = error && typeof error.message === "string" && error.message.trim()
            ? error.message
            : __("Please try again or enter the item manually.");

        showScanError({
            message: __("Unable to add scanned item."),
            code: normalizedCode,
            details,
        });
    };

    const acknowledgeScanError = () => {
        scanErrorDialog.value = false;
        scannerLocked.value = false;
        scanErrorMessage.value = "";
        scanErrorCode.value = "";
        scanErrorDetails.value = "";
        pendingScanCode.value = "";
        awaitingScanResult.value = false;

        if (clearSearchHandler.value) clearSearchHandler.value();
        if (focusSearchHandler.value) focusSearchHandler.value();
    };

    // --- onScan Integration ---
    const initScanner = () => {
        try {
            if (document._scannerAttached) return;

            // Assuming onScan is globally loaded script
            if (typeof onScan !== "undefined") {
                onScan.attachTo(document, {
                    suffixKeyCodes: [],
                    keyCodeMapper: function (oEvent) {
                        oEvent.stopImmediatePropagation();
                        oEvent.preventDefault();
                        return onScan.decodeKeyEvent(oEvent);
                    },
                    onScan: function (sCode) {
                        if (scannerLocked.value) {
                            playScanTone("error");
                            return;
                        }
                        triggerOnScan(sCode);
                    },
                });
                document._scannerAttached = true;
            }
        } catch (error) {
            console.warn("Scanner initialization error:", error.message);
        }
    };

    const triggerOnScan = (sCode) => {
        if (scannerLocked.value) {
            playScanTone("error");
            return;
        }
        searchFromScanner.value = true;
        if (setSearchInputHandler.value) setSearchInputHandler.value(sCode);
        pendingScanCode.value = sCode;

        nextTick(() => {
            onBarcodeScanned(sCode);
        });
    };

    // --- Scale Barcode Settings ---
    const updateScaleBarcodeSettings = (settings) => {
        const normalized = normalizeScaleBarcodeSettings(settings);
        scaleBarcodeSettings.value = { ...scaleBarcodeSettings.value, ...normalized };
        scaleBarcodeSettingsLoaded.value = true;
        return scaleBarcodeSettings.value;
    };

    const ensureScaleBarcodeSettings = async (force = false) => {
        if (!force && scaleBarcodeSettingsLoaded.value) {
            return scaleBarcodeSettings.value;
        }

        try {
            const res = await frappe.call({
                method: "posawesome.posawesome.api.items.parse_scale_barcode",
                args: { barcode: "" },
            });
            const settings = parseScaleBarcodeSettingsResponse(res);
            if (settings) {
                updateScaleBarcodeSettings(settings);
            } else {
                scaleBarcodeSettings.value = normalizeScaleBarcodeSettings();
                scaleBarcodeSettingsLoaded.value = true;
            }
        } catch (error) {
            console.error("Failed to load scale barcode settings", error);
            scaleBarcodeSettings.value = normalizeScaleBarcodeSettings();
            scaleBarcodeSettingsLoaded.value = true;
        }
        return scaleBarcodeSettings.value;
    };

    // --- Main Scan Handler ---
    const onBarcodeScanned = (scannedCode) => {
        resetKeyboardScanDetection();

        if (scannerLocked.value) {
            playScanTone("error");
            if (frappe?.show_alert) {
                frappe.show_alert({ message: __("Acknowledge the error to resume scanning."), indicator: "red" }, 3);
            }
            return;
        }

        // if (setSearchInput) setSearchInput(""); // Clear immediately? Logic in original was mixed.

        const runScanPipeline = async (code) => {
            const mark = perfMarkStart("pos:scan-handler");
            try {
                console.log("Barcode scanned:", code);
                pendingScanCode.value = code;
                searchFromScanner.value = true;

                // Show feedback
                if (toastStore) {
                    toastStore.show({
                        title: __("Scanning for: {0}", [code]),
                        summary: __("Scanning items"),
                        detail: code,
                        color: "info",
                        timeout: 2000,
                        groupId: "scanner-progress",
                    });
                }

                if (onScanHandler.value) {
                    await onScanHandler.value(code);
                }
            } catch (error) {
                handleScanPipelineError(error, code);
            } finally {
                perfMarkEnd("pos:scan-handler", mark);
            }
        };

        if (scanDebounceId.value) clearTimeout(scanDebounceId.value);
        scanQueuedCode.value = scannedCode;

        scanDebounceId.value = setTimeout(() => {
            scanDebounceId.value = null;
            const code = scanQueuedCode.value || scannedCode;
            scanQueuedCode.value = "";

            scheduleFrame(() => {
                const maybePromise = runScanPipeline(code);
                if (maybePromise && typeof maybePromise.catch === "function") {
                    maybePromise.catch((e) => handleScanPipelineError(e, code));
                }
            });
        }, 12);
    };

    // --- Keyboard Scan Detection ---
    const resetKeyboardScanDetection = () => {
        if (keyboardScanTimer.value) {
            clearTimeout(keyboardScanTimer.value);
            keyboardScanTimer.value = null;
        }
        keyboardScanBuffer.value = "";
        keyboardScanLastTime.value = 0;
        keyboardScanStartTime.value = 0;
        keyboardScanPendingValue.value = "";
    };

    const evaluateKeyboardScan = (currentInput) => {
        if (keyboardScanTimer.value) {
            clearTimeout(keyboardScanTimer.value);
            keyboardScanTimer.value = null;
        }

        const code = (keyboardScanPendingValue.value || currentInput || "").trim();
        const now = getScanTimestamp();
        const duration = keyboardScanStartTime.value ? now - keyboardScanStartTime.value : 0;

        if (isLikelyKeyboardScan({
            code,
            duration,
            minLength: keyboardScanMinLength,
            maxDuration: keyboardScanMaxDuration,
            maxInterval: keyboardScanMaxInterval,
        })) {
            resetKeyboardScanDetection();
            if (code) {
                onBarcodeScanned(code);
            }
            return true; // Detected
        }
        resetKeyboardScanDetection();
        return false;
    };

    const handleSearchKeydown = (event) => {
        if (!event) return;
        const key = event.key || "";

        // Pass-through navigation keys
        if (key === "ArrowDown" || key === "ArrowUp") return false;
        if (key === "Enter" || key === "Escape") return false;

        // Reset on modifiers
        if (event.metaKey || event.ctrlKey || event.altKey) {
            resetKeyboardScanDetection();
            return false;
        }

        // Only digits usually start a barcode scan in this context, but we can be broader
        if (!/^\d$/.test(key)) {
            resetKeyboardScanDetection();
            return false;
        }

        const currentVal = getSearchInputHandler.value ? getSearchInputHandler.value() : "";
        if (!isSearchFieldPrimedForScan(currentVal)) {
            resetKeyboardScanDetection();
            return false;
        }

        const now = getScanTimestamp();
        if (keyboardScanLastTime.value && now - keyboardScanLastTime.value > keyboardScanMaxInterval) {
            // Gap too long, reset but start new buffer
            keyboardScanBuffer.value = "";
            keyboardScanStartTime.value = now;
        }

        if (!keyboardScanBuffer.value) {
            keyboardScanStartTime.value = now;
        }

        keyboardScanBuffer.value += key;
        keyboardScanLastTime.value = now;

        if (keyboardScanTimer.value) clearTimeout(keyboardScanTimer.value);

        // Schedule evaluation
        keyboardScanTimer.value = setTimeout(() => {
            evaluateKeyboardScan(getSearchInputHandler.value ? getSearchInputHandler.value() : "");
        }, keyboardScanProcessingDelay);

        return true;
    };

    const handleSearchPaste = (event) => {
        if (!event?.clipboardData) return;
        const pastedText = event.clipboardData.getData("text");
        if (!pastedText) return;

        const sanitized = sanitizeClipboardText(pastedText);
        if (!sanitized) {
            event.preventDefault();
            return;
        }

        if (isScanCandidate(sanitized, keyboardScanMinLength)) {
            event.preventDefault();
            if (setSearchInputHandler.value) setSearchInputHandler.value(sanitized);

            nextTick(() => {
                onBarcodeScanned(sanitized);
            });
        }
    };

    const handleSearchInput = (event) => {
        // Just track pending value for evaluation
        // Logic from original: 
        // const value = normalizeSearchInputValue(event);
        // this.keyboardScanPendingValue = value;
        // if (shouldResetScanOnInput(value, this.keyboardScanBuffer)) ...

        // We need the value here. 
        // It's tricky to implement this purely without the event object or value passed in.
        // Consumers should call this method with the input event.
    };

    // Lifecycle
    onMounted(() => {
        initScanner();
    });

    onUnmounted(() => {
        if (scanAudioContext.value) {
            scanAudioContext.value.close().catch(() => { });
        }
    });

    return {
        // State
        scannerLocked,
        scanErrorDialog,
        scanErrorMessage,
        scanErrorCode,
        scanErrorDetails,
        pendingScanCode,
        awaitingScanResult,
        searchFromScanner,
        cameraScannerActive,
        scaleBarcodeSettings,

        // Methods
        playScanTone,
        showScanError,
        acknowledgeScanError,
        onBarcodeScanned, // Call this when a code is detected
        triggerOnScan,
        ensureScaleBarcodeSettings,
        updateScaleBarcodeSettings,
        handleSearchKeydown,
        handleSearchPaste,
        handleScanPipelineError,

        // Utils exposed
        getScaleBarcodePrefix: () => getScaleBarcodePrefix(scaleBarcodeSettings.value),
        scaleBarcodeMatches: (val) => scaleBarcodeMatches(scaleBarcodeSettings.value, val),
        setScanHandler,
        setInputHandlers,
    };
}
