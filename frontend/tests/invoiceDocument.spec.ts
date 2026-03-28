import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/offline/index", () => ({
	getTaxTemplate: vi.fn(() => null),
	getTaxInclusiveSetting: vi.fn(() => false),
	isOffline: vi.fn(() => false),
}));

vi.mock("../src/posapp/components/pos/invoice_utils/currency", () => ({
	_getPlcConversionRate: vi.fn(() => 1),
}));

import { get_invoice_doc } from "../src/posapp/components/pos/invoice_utils/document";

describe("get_invoice_doc", () => {
	beforeEach(() => {
		(globalThis as any).flt = (value: unknown, precision = 2) => {
			const number = Number(value || 0);
			return Number(number.toFixed(precision));
		};
	});

	it("updates customer title when draft customer changes", () => {
		const context: any = {
			invoiceType: "Invoice",
			pos_profile: {
				company: "Test Company",
				name: "Main POS",
				currency: "PKR",
				payments: [{ mode_of_payment: "Cash", account: "Cash", type: "Cash", default: 1 }],
			},
			selected_currency: "PKR",
			conversion_rate: 1,
			company: { default_currency: "PKR" },
			price_list_currency: "PKR",
			get_price_list: () => "Standard Selling",
			customer_info: {
				customer: "CUST-NEW",
				customer_name: "New Customer",
			},
			customer: "CUST-NEW",
			isReturnInvoice: false,
			items: [],
			packed_items: [],
			Total: 0,
			subtotal: 0,
			additional_discount: 0,
			additional_discount_percentage: 0,
			roundAmount: (value: number) => value,
			pos_opening_shift: { name: "SHIFT-1" },
			posa_offers: [],
			posa_coupons: [],
			selected_delivery_charge: null,
			delivery_charges_rate: 0,
			posting_date_display: "2026-03-28",
			formatDateForBackend: (value: string) => value,
			invoice_doc: {
				name: "SINV-DRAFT",
				customer: "CUST-OLD",
				customer_name: "Old Customer",
				payments: [],
				taxes: [],
			},
		};

		const doc = get_invoice_doc(context);

		expect(doc.customer).toBe("CUST-NEW");
		expect(doc.customer_name).toBe("New Customer");
	});
});
