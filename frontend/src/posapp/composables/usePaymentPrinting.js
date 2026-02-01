import { unref } from "vue";
import renderOfflineInvoiceHTML from "../../offline_print_template";
import {
	appendDebugPrintParam,
	isDebugPrintEnabled,
	silentPrint,
	watchPrintWindow,
} from "../plugins/print.js";
import { isOffline } from "../../offline/index.js";

export function usePaymentPrinting(options) {
	const {
		invoiceDoc,
		posProfile,
		invoiceType,
	} = options;

	const openOfflineInvoicePreview = async (invoice, { debugPrint = false, printFormat = "" } = {}) => {
		if (!invoice) return;
		const html = await renderOfflineInvoiceHTML(invoice);
		const win = window.open("", "_blank");
		if (!win) return;
		win.document.write(html);
		win.document.close();
		win.focus();
		if (debugPrint) {
			console.log("[POSAwesome][Print Debug]", {
				location: win.location?.href || null,
				online: navigator.onLine,
				trigger_print: "0",
				print_format: printFormat || null,
				template_path: "offline-fallback",
				should_print: false,
			});
		}
	};

	const printOfflineInvoice = async (invoice) => {
		if (!invoice) return;
		const html = await renderOfflineInvoiceHTML(invoice);
		const win = window.open("", "_blank");
		if (!win) return;
		win.document.write(html);
		win.document.close();
		win.focus();
		win.print();
	};

	const loadPrintPage = () => {
		const doc = unref(invoiceDoc);
		const profile = unref(posProfile);
		const type = unref(invoiceType);
		
		const print_format =
			profile.print_format_for_online ||
			profile.print_format;
		// Note: Payments.vue accessed `this.print_format` local data first. 
		// If we need that, we should pass it as a ref or just rely on profile.
		// Assuming profile is sufficient or we pass a ref if specific override needed.
		
		const letter_head = profile.letter_head || 0;
		let doctype;
		const debugPrint = isDebugPrintEnabled();

		if (type === "Quotation") {
			doctype = "Quotation";
		} else if (type === "Order" && profile.posa_create_only_sales_order) {
			doctype = "Sales Order";
		} else if (profile.create_pos_invoice_instead_of_sales_invoice) {
			doctype = "POS Invoice";
		} else {
			doctype = "Sales Invoice";
		}

		let url =
			frappe.urllib.get_base_url() +
			"/printview?doctype=" +
			encodeURIComponent(doctype) +
			"&name=" +
			doc.name +
			"&trigger_print=1" +
			"&format=" +
			print_format +
			"&no_letterhead=" +
			letter_head;
		
		url = appendDebugPrintParam(url, debugPrint);
		
		const printOptions = {
			invoiceDoc: doc,
			allowOfflineFallback: isOffline(),
			triggerPrint: "1",
			debugPrint,
			debugInfo: {
				printFormat: print_format,
				templatePath: "online-printview",
			},
		};

		if (profile.posa_open_print_in_new_tab) {
			if (isOffline()) {
				openOfflineInvoicePreview(doc, {
					debugPrint,
					printFormat: print_format,
				});
				return;
			}
			let newTabUrl =
				frappe.urllib.get_base_url() +
				"/printview?doctype=" +
				encodeURIComponent(doctype) +
				"&name=" +
				doc.name +
				"&trigger_print=0" +
				"&format=" +
				print_format;

			if (profile.letter_head) {
				newTabUrl += "&letterhead=" + encodeURIComponent(profile.letter_head);
				newTabUrl += "&no_letterhead=0";
			} else {
				newTabUrl += "&no_letterhead=0";
			}

			newTabUrl = appendDebugPrintParam(newTabUrl, debugPrint);
			// Android Share → Print is more reliable, so keep trigger_print=0 and skip auto-print.
			const printWindow = window.open(newTabUrl, "_blank");
			watchPrintWindow(printWindow, {
				...printOptions,
				triggerPrint: "0",
				shouldPrint: false,
			});
			return;
		}

		if (profile.posa_silent_print) {
			silentPrint(url, printOptions);
		} else {
			const printWindow = window.open(url, "Print");
			watchPrintWindow(printWindow, printOptions);
		}
	};

	return {
		loadPrintPage,
		printOfflineInvoice,
		openOfflineInvoicePreview,
	};
}
