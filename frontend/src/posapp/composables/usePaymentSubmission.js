import { unref } from "vue";

export function usePaymentSubmission(options) {
	const { invoiceDoc, posProfile, stockSettings, invoiceType, formatFloat } = options;

	const formatStockErrors = (errors) => {
		const doc = unref(invoiceDoc);
		const settings = unref(stockSettings) || {};
		const profile = unref(posProfile) || {};
		const type = unref(invoiceType);

		// Logic for blocking sale
		let blockSaleBeyondAvailableQty = false;
		if (!["Order", "Quotation"].includes(type)) {
			// parseBooleanSetting logic inline or passed? Assuming simple bool check for now
			// or we can import parseBooleanSetting utils if needed.
			// Ideally we pass blockSaleBeyondAvailableQty as a computed ref to this composable.
			const val = profile.posa_block_sale_beyond_available_qty;
			blockSaleBeyondAvailableQty =
				val === true ||
				val === "true" ||
				val === 1 ||
				val === "1" ||
				val === "Yes";
		}

		const msg = errors
			.map(
				(e) =>
					`${e.item_code} (${e.warehouse}) - ${formatFloat(e.available_qty)}`
			)
			.join("\n");

		const blocking = !settings.allow_negative_stock || blockSaleBeyondAvailableQty;

		// Use global __ if available or simple string
		const __ = window.__ || ((s) => s);

		return blocking
			? __("Insufficient stock:\n{0}", [msg])
			: __("Stock is lower than requested:\n{0}", [msg]);
	};

	const extractSubmissionErrorMessage = (exc) => {
		const __ = window.__ || ((s) => s);

		if (!exc) {
			return __("Unknown error");
		}
		if (exc?._server_messages) {
			try {
				const parsed = JSON.parse(exc._server_messages);
				if (Array.isArray(parsed) && parsed.length) {
					const first = parsed[0];
					// Check if message is a JSON string containing errors (stock validation)
					try {
						const msgObj = JSON.parse(first);
						if (msgObj.errors && Array.isArray(msgObj.errors)) {
							return formatStockErrors(msgObj.errors);
						}
					} catch {
						/* Not a JSON string */
					}

					if (typeof first === "string") {
						return window.frappe?.utils?.strip_html
							? window.frappe.utils.strip_html(first)
							: first;
					}
				}
			} catch {
				/* ignore parse issues */
			}
		}
		if (exc?.message) {
			try {
				const parsed = JSON.parse(exc.message);
				if (parsed.errors && Array.isArray(parsed.errors)) {
					return formatStockErrors(parsed.errors);
				}
			} catch {
				/* Not a JSON string */
			}
			return exc.message;
		}
		return exc.toString ? exc.toString() : __("Unknown error");
	};

	const validateDueDate = () => {
		const doc = unref(invoiceDoc);
		if (!doc || !doc.due_date) return;

		const today = window.frappe?.datetime?.now_date?.();
		if (!today) return;

		const new_date = Date.parse(doc.due_date);
		const parse_today = Date.parse(today);
		if (new_date < parse_today) {
			doc.due_date = today;
		}
	};

	return {
		extractSubmissionErrorMessage,
		formatStockErrors,
		validateDueDate,
	};
}
