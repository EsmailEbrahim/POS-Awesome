import { unref } from "vue";
import invoiceService from "../services/invoiceService.js";
import {
	saveOfflineInvoice,
	isOffline,
	updateLocalStock,
} from "../../offline/index.js";
import stockCoordinator from "../utils/stockCoordinator.js";

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

	const ensureReturnPaymentsAreNegative = () => {
		const doc = unref(invoiceDoc);
		if (!doc || !doc.is_return || !unref(options.isCashback)) {
			return;
		}
		// Check if any payment amount is set
		let hasPaymentSet = false;
		if (doc.payments) {
			doc.payments.forEach((payment) => {
				if (Math.abs(payment.amount) > 0) {
					hasPaymentSet = true;
				}
			});
		}

		// If no payment set, set the default one
		if (!hasPaymentSet && doc.payments) {
			const default_payment = doc.payments.find((payment) => payment.default === 1);
			if (default_payment) {
				const amount = doc.rounded_total || doc.grand_total;
				default_payment.amount = -Math.abs(amount);
				if (default_payment.base_amount !== undefined) {
					default_payment.base_amount = -Math.abs(amount);
				}
			}
		}
		// Ensure all set payments are negative
		if (doc.payments) {
			doc.payments.forEach((payment) => {
				if (payment.amount > 0) {
					payment.amount = -Math.abs(payment.amount);
				}
				if (payment.base_amount !== undefined && payment.base_amount > 0) {
					payment.base_amount = -Math.abs(payment.base_amount);
				}
			});
		}
	};

	const submitInvoice = async (print, callbacks = {}) => {
		const doc = unref(invoiceDoc);
		const profile = unref(posProfile);
		const type = unref(invoiceType);
		const prec = unref(options.currencyPrecision) || 2;
		const {
			isCashback,
			paidChange, // ref
			creditChange, // ref
			redeemedCustomerCredit, // ref
			customerCreditDict, // ref
			diffPayment, // ref
			stores, // { toastStore, syncStore, customersStore, uiStore }
		} = options;

		const {
			onSuccess,
			onPrint,
			onFinishNavigation,
			onScheduleBackgroundCheck,
		} = callbacks;

		if (doc.is_return) {
			ensureReturnPaymentsAreNegative();
		}

		let totalPayedAmount = 0;
		if (doc.payments) {
			doc.payments.forEach((payment) => {
				payment.amount = formatFloat(payment.amount, prec);
				totalPayedAmount += payment.amount;
			});
		}

		if (doc.is_return && totalPayedAmount === 0) {
			doc.is_pos = 0;
		}

		if (unref(customerCreditDict)?.length) {
			unref(customerCreditDict).forEach((row) => {
				row.credit_to_redeem = formatFloat(row.credit_to_redeem, prec);
			});
		}

		const diff = unref(diffPayment) || 0;
		const changeLimit = !doc.is_return ? Math.max(-diff, 0) : 0;
		const pChange = !doc.is_return
			? formatFloat(Math.min(unref(paidChange), changeLimit), prec)
			: 0;
		const cChange = !doc.is_return
			? formatFloat(Math.max(changeLimit - pChange, 0), prec)
			: 0;

		if (doc) {
			doc.paid_change = pChange;
			doc.credit_change = cChange;
		}

		if (!doc.is_return) {
			if (creditChange) creditChange.value = cChange ? -cChange : 0;
			if (paidChange) paidChange.value = pChange;
		}

		const data = {
			total_change: changeLimit,
			paid_change: pChange,
			credit_change: cChange,
			redeemed_customer_credit: unref(redeemedCustomerCredit),
			customer_credit_dict: unref(customerCreditDict),
			is_cashback: unref(isCashback),
		};

		const __ = window.__ || ((s) => s);

		if (isOffline()) {
			try {
				saveOfflineInvoice({ data, invoice: doc });
				stores?.syncStore?.updatePendingCount();
				stores?.toastStore?.show({
					title: __("Invoice saved offline"),
					color: "warning",
				});

				if (print && onPrint) {
					onPrint(doc);
				}

				if (stores?.customersStore?.setSelectedCustomer) {
					stores.customersStore.setSelectedCustomer(profile?.customer || null);
				}

				if (onFinishNavigation) onFinishNavigation(true);
				
				// Optional: emit focus event if handled by caller via callback or eventBus
				// eventBus.emit("focus_item_search"); 
				return { offline: true };
			} catch (error) {
				const errorMsg = error.message || __("Unknown error");
				stores?.toastStore?.show({
					title: __("Cannot Save Offline Invoice: ") + errorMsg,
					color: "error",
				});
				throw error;
			}
		}

		// Online Submission
		try {
			const message = await invoiceService.submitInvoice(
				data,
				doc,
				type,
				profile
			);

			const r = { message };

			if (!r.message) {
				const reason = __("No response from server");
				const failedInfo = {
					invoice: doc?.name,
					reason,
				};
				// Emit failure if supported
				// eventBus.emit("invoice_submission_failed", failedInfo);
				
				stores?.toastStore?.show({
					title: __("Error submitting invoice: No response from server"),
					color: "error",
				});
				// We throw to let caller handle if needed, or just return failure
				const err = new Error(reason);
				err.failedInfo = failedInfo;
				throw err;
			}

			const docstatus = r.message?.docstatus;
			const status = r.message?.status;
			const responseInvoiceName = r.message?.name || doc?.name;
			const backgroundReason =
				r.message?.error || r.message?.exc || r.message?.exception || r.message?.message;

			const wasSubmitted =
				docstatus === 1 ||
				status === 1 ||
				(docstatus === undefined && status === undefined);

			if (!wasSubmitted && backgroundReason) {
				const failedInfo = {
					invoice: responseInvoiceName,
					reason: backgroundReason,
				};
				
				stores?.toastStore?.show({
					title: __("Error submitting invoice: {0}", [responseInvoiceName || ""]),
					color: "error",
					detail: backgroundReason,
				});

				// Background job specific logic
				if (profile?.posa_allow_submissions_in_background_job) {
					if (onFinishNavigation) onFinishNavigation(true);
					if (onScheduleBackgroundCheck) {
						onScheduleBackgroundCheck(responseInvoiceName, r.message?.doctype);
					}
					// Return special status indicating background failure handled
					return { backgroundFailure: true, reason: backgroundReason };
				}
				
				const err = new Error(backgroundReason);
				err.failedInfo = failedInfo;
				throw err;
			}

			// Success
			if (print && onPrint) {
				onPrint(doc); // Or reload doc from server? default behavior uses current doc
			}

			// Reset local state vars
			if (customerCreditDict) customerCreditDict.value = [];
			// callback for resetting component-specific state? 
			// Caller should handle resetting is_credit_return, sales_person, etc via onSuccess or internal refs if passed.
			// But wait, customerCreditDict is ref passed in, so we can reset it.
			// We can also return success status so component resets others.

			if (stores?.invoiceStore?.invoiceDoc) {
				stores.invoiceStore.invoiceDoc.docstatus = 1;
			}
			
			if (stores?.uiStore) {
				stores.uiStore.setLastInvoice(doc.name);
			}

			stores?.toastStore?.show({
				title: type === "Order" && profile?.posa_create_only_sales_order
					? __("Sales Order {0} is Submitted", [r.message.name])
					: type === "Quotation"
						? __("Quotation {0} is Submitted", [r.message.name])
						: __("Invoice {0} is Submitted", [r.message.name]),
				color: "success",
			});

			if (window.frappe?.utils?.play_sound) {
				window.frappe.utils.play_sound("submit");
			}

			const submittedItems = Array.isArray(doc.items) ? doc.items : [];
			updateLocalStock(submittedItems);
			stockCoordinator.applyInvoiceConsumption(submittedItems, {
				source: "invoice",
			});
			const submittedCodes = submittedItems
				.map((item) => (item ? item.item_code : null))
				.filter((code) => code !== undefined && code !== null);
			
			if (stores?.uiStore) {
				stores.uiStore.setLastStockAdjustment({
					items: submittedItems,
					item_codes: submittedCodes,
					timestamp: Date.now(),
				});
			}

			if (onFinishNavigation) onFinishNavigation(true);

			if (stores?.customersStore?.setSelectedCustomer) {
				stores.customersStore.setSelectedCustomer(profile?.customer || null);
			}

			if (onScheduleBackgroundCheck) {
				onScheduleBackgroundCheck(responseInvoiceName, r.message?.doctype);
			}

			// Execute user success callback (for showing change dialog, etc)
			if (onSuccess) {
				onSuccess(r.message);
			}

			return { success: true, message: r.message };

		} catch (exc) {
			console.error("Error submitting invoice:", exc);
			const errorMsg = extractSubmissionErrorMessage(exc);
			
			// Handle "Amount must be negative" retry logic? 
			// If we want to support retry in composable, we need to recurse or return special status.
			// Complex logic: 
			/*
			if (errorMsg.includes("Amount must be negative")) { ... retry ... }
			*/
			// For now, let's rethrow or return error so component can decide?
			// Or check existing logic: it modifies payments and retries `submit_invoice`.
			// Maybe better to include that retry here.

			if (errorMsg.includes("Amount must be negative")) {
				stores?.toastStore?.show({
					title: __("Fixing payment amounts for return invoice..."),
					color: "warning",
				});
				
				// Fix locally
				if (doc.payments) {
					doc.payments.forEach((payment) => {
						if (payment.amount > 0) payment.amount = -Math.abs(payment.amount);
						if (payment.base_amount > 0) payment.base_amount = -Math.abs(payment.base_amount);
					});
				}
				// Retry
				console.log("Retrying submission with fixed payment amounts");
				// Need to wait?
				return new Promise(resolve => setTimeout(() => resolve(submitInvoice(print, callbacks)), 500));
			}

			// Broadcast failure
			if (profile?.posa_allow_submissions_in_background_job) {
				// emit event? 
				// We don't have eventBus passed in explictly yet, but could add to options.
			}

			stores?.toastStore?.show({
				title: __("Error submitting invoice: ") + errorMsg,
				color: "error",
			});

			if (profile?.posa_allow_submissions_in_background_job) {
				if (onFinishNavigation) onFinishNavigation(true);
				if (onScheduleBackgroundCheck) {
					onScheduleBackgroundCheck(doc?.name, doc?.doctype);
				}
			}

			throw exc; // Rethrow for caller to handle loading state
		}
	};

	return {
		extractSubmissionErrorMessage,
		formatStockErrors,
		validateDueDate,
		ensureReturnPaymentsAreNegative,
		submitInvoice,
	};
}
