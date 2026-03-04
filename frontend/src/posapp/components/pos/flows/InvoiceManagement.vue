<template>
	<v-row justify="center">
		<v-dialog
			v-model="invoiceManagementDialog"
			max-width="1380px"
			scrollable
			:theme="isDarkTheme ? 'dark' : 'light'"
			content-class="invoice-management-dialog-content"
		>
			<v-card class="pos-themed-card invoice-management-card" variant="flat">
				<v-card-title class="d-flex align-center justify-space-between flex-wrap ga-3">
					<div>
						<div class="text-h5 text-primary">{{ __("Invoice Management") }}</div>
						<div class="text-subtitle-2 text-medium-emphasis">
							{{ __("Browse unpaid invoices, history, drafts, and returns") }}
						</div>
					</div>
					<div class="d-flex align-center ga-2">
						<v-btn color="primary" variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="refreshActiveTab">
							{{ __("Refresh") }}
						</v-btn>
						<v-btn icon="mdi-close" variant="text" @click="uiStore.closeInvoiceManagement()" />
					</div>
				</v-card-title>

				<v-tabs v-model="activeTab" color="primary" grow class="px-2">
					<v-tab value="partial">{{ __("Unpaid") }} ({{ filteredUnpaidInvoices.length }})</v-tab>
					<v-tab value="history">{{ __("History") }} ({{ filteredHistoryInvoices.length }})</v-tab>
					<v-tab value="drafts">{{ __("Drafts") }} ({{ filteredDraftInvoices.length }})</v-tab>
					<v-tab value="returns">{{ __("Returns") }} ({{ filteredReturnInvoices.length }})</v-tab>
				</v-tabs>

				<v-divider />

				<v-card-text class="invoice-management-card__body">
					<v-window v-model="activeTab">
						<v-window-item value="partial">
							<div class="filter-grid mb-4">
								<v-text-field v-model="partialSearch" class="pos-themed-input" variant="outlined" density="compact" hide-details clearable prepend-inner-icon="mdi-magnify" :label="__('Search unpaid invoices or customers')" />
								<v-select v-model="partialStatus" class="pos-themed-input" variant="outlined" density="compact" hide-details :items="partialStatusItems" :label="__('Payment Status')" />
								<v-text-field v-model="partialDateFrom" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('From Date')" />
								<v-text-field v-model="partialDateTo" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('To Date')" />
							</div>
							<div class="summary-grid mb-4">
								<div class="summary-tile"><div class="summary-tile__label">{{ __("Invoices") }}</div><div class="summary-tile__value">{{ filteredUnpaidSummary.count }}</div></div>
								<div class="summary-tile"><div class="summary-tile__label">{{ __("Paid") }}</div><div class="summary-tile__value">{{ currencySymbol(posProfile?.currency) }} {{ formatCurrency(filteredUnpaidSummary.total_paid) }}</div></div>
								<div class="summary-tile"><div class="summary-tile__label">{{ __("Outstanding") }}</div><div class="summary-tile__value">{{ currencySymbol(posProfile?.currency) }} {{ formatCurrency(filteredUnpaidSummary.total_outstanding) }}</div></div>
							</div>
							<v-data-table :headers="partialHeaders" :items="filteredUnpaidInvoices" :loading="loading && activeTab === 'partial'" item-value="name" class="elevation-1" :items-per-page="10">
								<template #item.posting_date="{ item }">{{ formatDateTime(item.posting_date, item.posting_time) }}</template>
								<template #item.due_date="{ item }">{{ formatDateForDisplay(item.due_date) || "-" }}</template>
								<template #item.grand_total="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}</template>
								<template #item.paid_amount="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.paid_amount || 0) }}</template>
								<template #item.outstanding_amount="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.outstanding_amount || 0) }}</template>
								<template #item.status="{ item }"><v-chip size="small" :color="statusColor(item.status)" variant="tonal">{{ __(item.status || "Unpaid") }}</v-chip></template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn icon="mdi-cash-plus" variant="text" size="small" color="warning" :title="__('Add Payment')" @click="openAddPayment(item)" />
										<v-btn icon="mdi-eye-outline" variant="text" size="small" :title="__('View Details')" @click="viewInvoice(item)" />
										<v-btn icon="mdi-printer-outline" variant="text" size="small" :title="__('Print')" @click="printInvoice(item)" />
									</div>
								</template>
							</v-data-table>
						</v-window-item>

						<v-window-item value="history">
							<div class="filter-grid mb-4">
								<v-text-field v-model="historySearch" class="pos-themed-input" variant="outlined" density="compact" hide-details clearable prepend-inner-icon="mdi-magnify" :label="__('Search invoices or customers')" />
								<v-select v-model="historyStatus" class="pos-themed-input" variant="outlined" density="compact" hide-details :items="historyStatusItems" :label="__('Status')" />
								<v-text-field v-model="historyDateFrom" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('From Date')" />
								<v-text-field v-model="historyDateTo" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('To Date')" />
							</div>
							<div class="summary-grid mb-4">
								<div class="summary-tile"><div class="summary-tile__label">{{ __("Invoices") }}</div><div class="summary-tile__value">{{ filteredHistoryInvoices.length }}</div></div>
								<div class="summary-tile"><div class="summary-tile__label">{{ __("Gross") }}</div><div class="summary-tile__value">{{ currencySymbol(posProfile?.currency) }} {{ formatCurrency(historyTotals.gross) }}</div></div>
								<div class="summary-tile"><div class="summary-tile__label">{{ __("Outstanding") }}</div><div class="summary-tile__value">{{ currencySymbol(posProfile?.currency) }} {{ formatCurrency(historyTotals.outstanding) }}</div></div>
							</div>
							<v-data-table :headers="historyHeaders" :items="filteredHistoryInvoices" :loading="loading && activeTab === 'history'" item-value="name" class="elevation-1" :items-per-page="10">
								<template #item.posting_date="{ item }">{{ formatDateTime(item.posting_date, item.posting_time) }}</template>
								<template #item.grand_total="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}</template>
								<template #item.outstanding_amount="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.outstanding_amount || 0) }}</template>
								<template #item.status="{ item }"><v-chip size="small" :color="statusColor(item.status)" variant="tonal">{{ __(item.status || "Draft") }}</v-chip></template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn icon="mdi-eye-outline" variant="text" size="small" :title="__('View Details')" @click="viewInvoice(item)" />
										<v-btn icon="mdi-printer-outline" variant="text" size="small" :title="__('Print')" @click="printInvoice(item)" />
										<v-btn v-if="posProfile?.posa_allow_return == 1" icon="mdi-backup-restore" variant="text" size="small" color="warning" :title="__('Create Return')" @click="createReturn(item)" />
									</div>
								</template>
							</v-data-table>
						</v-window-item>

						<v-window-item value="drafts">
							<div class="filter-grid mb-4">
								<v-text-field v-model="draftSearch" class="pos-themed-input" variant="outlined" density="compact" hide-details clearable prepend-inner-icon="mdi-magnify" :label="__('Search drafts or customers')" />
								<v-text-field v-model="draftDateFrom" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('From Date')" />
								<v-text-field v-model="draftDateTo" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('To Date')" />
							</div>
							<v-data-table :headers="draftHeaders" :items="filteredDraftInvoices" :loading="loading && activeTab === 'drafts'" item-value="name" class="elevation-1" :items-per-page="10">
								<template #item.posting_date="{ item }">{{ formatDateTime(item.posting_date, item.posting_time) }}</template>
								<template #item.grand_total="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}</template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn icon="mdi-folder-open-outline" variant="text" size="small" color="primary" :title="__('Load Draft')" @click="loadDraft(item)" />
										<v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" :title="__('Delete Draft')" @click="deleteDraft(item)" />
									</div>
								</template>
							</v-data-table>
						</v-window-item>

						<v-window-item value="returns">
							<div class="filter-grid mb-4">
								<v-text-field v-model="returnSearch" class="pos-themed-input" variant="outlined" density="compact" hide-details clearable prepend-inner-icon="mdi-magnify" :label="__('Search return invoices or customers')" />
								<v-text-field v-model="returnDateFrom" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('From Date')" />
								<v-text-field v-model="returnDateTo" type="date" class="pos-themed-input" variant="outlined" density="compact" hide-details :label="__('To Date')" />
							</div>
							<v-data-table :headers="returnHeaders" :items="filteredReturnInvoices" :loading="loading && activeTab === 'returns'" item-value="name" class="elevation-1" :items-per-page="10">
								<template #item.posting_date="{ item }">{{ formatDateTime(item.posting_date, item.posting_time) }}</template>
								<template #item.grand_total="{ item }">{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}</template>
								<template #item.return_against="{ item }">{{ item.return_against || "-" }}</template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn icon="mdi-eye-outline" variant="text" size="small" :title="__('View Details')" @click="viewInvoice(item)" />
										<v-btn icon="mdi-printer-outline" variant="text" size="small" :title="__('Print')" @click="printInvoice(item)" />
									</div>
								</template>
							</v-data-table>
						</v-window-item>
					</v-window>
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-row>

	<v-dialog v-model="detailDialog" max-width="1040px" scrollable :theme="isDarkTheme ? 'dark' : 'light'">
		<v-card>
			<v-card-title class="d-flex align-center justify-space-between flex-wrap ga-3">
				<div>
					<div class="text-h6">{{ selectedInvoiceDetail?.name || __("Invoice Details") }}</div>
					<div class="text-subtitle-2 text-medium-emphasis">{{ selectedInvoiceDetail?.customer_name || selectedInvoiceDetail?.customer || "" }}</div>
				</div>
				<div class="d-flex align-center ga-2">
					<v-chip v-if="selectedInvoiceDetail?.status" size="small" :color="statusColor(selectedInvoiceDetail.status)" variant="tonal">{{ __(selectedInvoiceDetail.status) }}</v-chip>
					<v-btn icon="mdi-close" variant="text" @click="detailDialog = false" />
				</div>
			</v-card-title>
			<v-divider />
			<v-card-text v-if="selectedInvoiceDetail">
				<div class="summary-grid mb-4">
					<div class="summary-tile"><div class="summary-tile__label">{{ __("Posting") }}</div><div class="summary-tile__value">{{ formatDateTime(selectedInvoiceDetail.posting_date, selectedInvoiceDetail.posting_time) }}</div></div>
					<div class="summary-tile"><div class="summary-tile__label">{{ __("Grand Total") }}</div><div class="summary-tile__value">{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(selectedInvoiceDetail.grand_total) }}</div></div>
					<div class="summary-tile"><div class="summary-tile__label">{{ __("Outstanding") }}</div><div class="summary-tile__value">{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(selectedInvoiceDetail.outstanding_amount || 0) }}</div></div>
					<div class="summary-tile"><div class="summary-tile__label">{{ __("Items") }}</div><div class="summary-tile__value">{{ (selectedInvoiceDetail.items || []).length }}</div></div>
				</div>
				<div class="detail-section__title">{{ __("Items") }}</div>
				<v-data-table :headers="detailHeaders" :items="selectedInvoiceDetail.items || []" item-value="item_code" :items-per-page="10" class="elevation-1">
					<template #item.qty="{ item }">{{ formatFloat(item.qty || 0) }}</template>
					<template #item.rate="{ item }">{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(item.rate) }}</template>
					<template #item.amount="{ item }">{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(item.amount) }}</template>
				</v-data-table>
				<div class="detail-section__title mt-4">{{ __("Payment History") }}</div>
				<v-data-table :headers="paymentHeaders" :items="selectedInvoiceDetail.payments || []" item-value="mode_of_payment" :items-per-page="5" class="elevation-1">
					<template #item.amount="{ item }">{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(item.amount || 0) }}</template>
				</v-data-table>
				<div v-if="!Array.isArray(selectedInvoiceDetail.payments) || !selectedInvoiceDetail.payments.length" class="text-caption text-medium-emphasis mt-2">{{ __("No payment rows available on this invoice.") }}</div>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn v-if="selectedInvoiceDetail && Number(selectedInvoiceDetail.outstanding_amount || 0) > 0" color="warning" variant="text" prepend-icon="mdi-cash-plus" @click="openAddPayment(selectedInvoiceDetail)">{{ __("Add Payment") }}</v-btn>
				<v-btn v-if="selectedInvoiceDetail" color="primary" variant="text" prepend-icon="mdi-printer-outline" @click="printInvoice(selectedInvoiceDetail)">{{ __("Print") }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { inject } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import format from "../../../format";
import { useTheme } from "../../../composables/core/useTheme";
import { useToastStore } from "../../../stores/toastStore";
import { useUIStore } from "../../../stores/uiStore";
import { useInvoiceStore } from "../../../stores/invoiceStore";
import { useCustomersStore } from "../../../stores/customersStore";
import { appendDebugPrintParam, isDebugPrintEnabled, silentPrint, watchPrintWindow } from "../../../plugins/print";
import { printDocumentViaQz } from "../../../services/qzTray";
import { isOffline } from "../../../../offline/index";

export default {
	mixins: [format],
	setup() {
		const uiStore = useUIStore();
		const invoiceStore = useInvoiceStore();
		const customersStore = useCustomersStore();
		const toastStore = useToastStore();
		const router = useRouter();
		const theme = useTheme();
		const eventBus = inject("eventBus");
		const { invoiceManagementDialog, posProfile, posOpeningShift } = storeToRefs(uiStore);
		return { uiStore, invoiceStore, customersStore, toastStore, router, eventBus, invoiceManagementDialog, posProfile, posOpeningShift, isDarkTheme: theme.isDark };
	},
	data: () => ({
		activeTab: "partial",
		loading: false,
		partialSearch: "",
		partialStatus: "All",
		partialDateFrom: "",
		partialDateTo: "",
		historySearch: "",
		historyStatus: "All",
		historyDateFrom: "",
		historyDateTo: "",
		draftSearch: "",
		draftDateFrom: "",
		draftDateTo: "",
		returnSearch: "",
		returnDateFrom: "",
		returnDateTo: "",
		unpaidInvoices: [],
		historyInvoices: [],
		draftInvoices: [],
		detailDialog: false,
		selectedInvoiceDetail: null,
		partialStatusItems: ["All", "Partly Paid", "Unpaid", "Overdue"],
		historyStatusItems: ["All", "Paid", "Partly Paid", "Unpaid", "Overdue", "Credit Note Issued"],
		partialHeaders: [{ title: __("Invoice"), key: "name" }, { title: __("Customer"), key: "customer_name" }, { title: __("Posting"), key: "posting_date" }, { title: __("Due Date"), key: "due_date" }, { title: __("Status"), key: "status" }, { title: __("Total"), key: "grand_total", align: "end" }, { title: __("Paid"), key: "paid_amount", align: "end" }, { title: __("Outstanding"), key: "outstanding_amount", align: "end" }, { title: __("Actions"), key: "actions", align: "end", sortable: false }],
		historyHeaders: [{ title: __("Invoice"), key: "name" }, { title: __("Customer"), key: "customer_name" }, { title: __("Posting"), key: "posting_date" }, { title: __("Status"), key: "status" }, { title: __("Total"), key: "grand_total", align: "end" }, { title: __("Outstanding"), key: "outstanding_amount", align: "end" }, { title: __("Actions"), key: "actions", align: "end", sortable: false }],
		draftHeaders: [{ title: __("Invoice"), key: "name" }, { title: __("Customer"), key: "customer_name" }, { title: __("Posting"), key: "posting_date" }, { title: __("Total"), key: "grand_total", align: "end" }, { title: __("Actions"), key: "actions", align: "end", sortable: false }],
		returnHeaders: [{ title: __("Invoice"), key: "name" }, { title: __("Customer"), key: "customer_name" }, { title: __("Posting"), key: "posting_date" }, { title: __("Against"), key: "return_against" }, { title: __("Total"), key: "grand_total", align: "end" }, { title: __("Actions"), key: "actions", align: "end", sortable: false }],
		detailHeaders: [{ title: __("Item"), key: "item_name" }, { title: __("Code"), key: "item_code" }, { title: __("Qty"), key: "qty", align: "end" }, { title: __("Rate"), key: "rate", align: "end" }, { title: __("Amount"), key: "amount", align: "end" }],
		paymentHeaders: [{ title: __("Mode"), key: "mode_of_payment" }, { title: __("Amount"), key: "amount", align: "end" }, { title: __("Account"), key: "account" }],
	}),
	computed: {
		currentInvoiceDoctype() { return this.posProfile?.create_pos_invoice_instead_of_sales_invoice ? "POS Invoice" : "Sales Invoice"; },
		filteredUnpaidInvoices() { return this.filterCollection(this.unpaidInvoices, this.partialSearch, this.partialStatus, this.partialDateFrom, this.partialDateTo); },
		filteredHistoryInvoices() { return this.filterCollection(this.historyInvoices.filter((d) => !d.is_return), this.historySearch, this.historyStatus, this.historyDateFrom, this.historyDateTo); },
		filteredDraftInvoices() { return this.filterCollection(this.draftInvoices, this.draftSearch, "All", this.draftDateFrom, this.draftDateTo); },
		filteredReturnInvoices() { return this.filterCollection(this.historyInvoices.filter((d) => d.is_return), this.returnSearch, "All", this.returnDateFrom, this.returnDateTo); },
		filteredUnpaidSummary() { return this.filteredUnpaidInvoices.reduce((a, d) => ({ count: a.count + 1, total_paid: a.total_paid + Number(d.paid_amount || 0), total_outstanding: a.total_outstanding + Number(d.outstanding_amount || 0) }), { count: 0, total_paid: 0, total_outstanding: 0 }); },
		historyTotals() { return this.filteredHistoryInvoices.reduce((a, d) => ({ gross: a.gross + Number(d.grand_total || 0), outstanding: a.outstanding + Number(d.outstanding_amount || 0) }), { gross: 0, outstanding: 0 }); },
	},
	watch: {
		invoiceManagementDialog(val) { if (val) this.refreshAll(); },
		activeTab() { this.refreshActiveTab(); },
	},
	methods: {
		normalizeDate(v) { return v ? String(v).slice(0, 10) : ""; },
		inRange(date, fromDate, toDate) { const v = this.normalizeDate(date); if (fromDate && v < fromDate) return false; if (toDate && v > toDate) return false; return true; },
		filterCollection(items, search, status, fromDate, toDate) {
			const needle = String(search || "").trim().toLowerCase();
			return items.filter((item) => {
				if (needle) {
					const hay = [item.name, item.customer, item.customer_name, item.return_against, item.status].filter(Boolean).map((v) => String(v).toLowerCase());
					if (!hay.some((v) => v.includes(needle))) return false;
				}
				if (status && status !== "All" && String(item.status || "") !== status) return false;
				return this.inRange(item.posting_date, this.normalizeDate(fromDate), this.normalizeDate(toDate));
			});
		},
		formatDateForDisplay(date) { if (!date) return ""; const parts = String(date).split("-"); return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date; },
		formatDateTime(date, time) { const d = this.formatDateForDisplay(date); const t = time ? String(time).split(".")[0] : ""; return [d, t].filter(Boolean).join(" "); },
		statusColor(status) { const v = String(status || "").toLowerCase(); if (v === "paid") return "success"; if (v.includes("partly")) return "warning"; if (v.includes("overdue")) return "error"; if (v.includes("credit")) return "info"; return "primary"; },
		async refreshAll() { await Promise.all([this.loadUnpaidInvoices(), this.loadHistory(), this.loadDrafts()]); },
		async refreshActiveTab() { if (!this.invoiceManagementDialog) return; if (this.activeTab === "drafts") return this.loadDrafts(); if (this.activeTab === "partial") return this.loadUnpaidInvoices(); return this.loadHistory(); },
		async loadUnpaidInvoices() {
			if (!this.posProfile?.name) return void (this.unpaidInvoices = []);
			this.loading = true;
			try {
				const { message } = await frappe.call({ method: "frappe.client.get_list", args: { doctype: this.currentInvoiceDoctype, filters: { pos_profile: this.posProfile.name, docstatus: 1, is_return: 0, outstanding_amount: [">", 0] }, fields: ["name", "customer", "customer_name", "posting_date", "posting_time", "due_date", "grand_total", "paid_amount", "outstanding_amount", "status", "currency"], order_by: "modified desc", limit_page_length: 200 } });
				this.unpaidInvoices = Array.isArray(message) ? message.map((d) => ({ ...d, doctype: this.currentInvoiceDoctype })) : [];
			} catch (error) {
				console.error("Error loading unpaid invoices:", error);
				this.toastStore.show({ title: __("Unable to fetch unpaid invoices"), color: "error" });
			} finally { this.loading = false; }
		},
		async loadHistory() {
			if (!this.posProfile?.name) return void (this.historyInvoices = []);
			this.loading = true;
			try {
				const { message } = await frappe.call({ method: "frappe.client.get_list", args: { doctype: this.currentInvoiceDoctype, filters: { pos_profile: this.posProfile.name, docstatus: 1 }, fields: ["name", "customer", "customer_name", "posting_date", "posting_time", "grand_total", "outstanding_amount", "status", "is_return", "return_against", "currency"], order_by: "modified desc", limit_page_length: 300 } });
				this.historyInvoices = Array.isArray(message) ? message.map((d) => ({ ...d, doctype: this.currentInvoiceDoctype })) : [];
			} catch (error) {
				console.error("Error loading invoice history:", error);
				this.toastStore.show({ title: __("Unable to fetch invoice history"), color: "error" });
			} finally { this.loading = false; }
		},
		async loadDrafts() {
			if (!this.posOpeningShift?.name) return void (this.draftInvoices = []);
			this.loading = true;
			try {
				const { message } = await frappe.call({ method: "posawesome.posawesome.api.invoices.get_draft_invoices", args: { pos_opening_shift: this.posOpeningShift.name, doctype: this.currentInvoiceDoctype } });
				this.draftInvoices = Array.isArray(message) ? message.map((d) => ({ ...d, doctype: d.doctype || this.currentInvoiceDoctype })) : [];
			} catch (error) {
				console.error("Error loading draft invoices:", error);
				this.toastStore.show({ title: __("Unable to fetch draft invoices"), color: "error" });
			} finally { this.loading = false; }
		},
		async viewInvoice(invoice) {
			try {
				const { message } = await frappe.call({ method: "frappe.client.get", args: { doctype: invoice.doctype || this.currentInvoiceDoctype, name: invoice.name } });
				this.selectedInvoiceDetail = message || null;
				this.detailDialog = !!message;
			} catch (error) {
				console.error("Error loading invoice details:", error);
				this.toastStore.show({ title: __("Unable to load invoice details"), color: "error" });
			}
		},
		async loadDraft(invoice) {
			try {
				const { message } = await frappe.call({ method: "posawesome.posawesome.api.invoices.get_draft_invoice_doc", args: { invoice_name: invoice.name, doctype: invoice.doctype || this.currentInvoiceDoctype } });
				if (message) { this.invoiceStore.triggerLoadInvoice(message); this.uiStore.closeInvoiceManagement(); }
			} catch (error) {
				console.error("Error loading draft invoice:", error);
				this.toastStore.show({ title: __("Unable to load draft invoice"), color: "error" });
			}
		},
		async deleteDraft(invoice) {
			if (!window.confirm(__("Delete draft invoice {0}?", [invoice.name]))) return;
			try {
				await frappe.call({ method: "posawesome.posawesome.api.invoices.delete_invoice", args: { invoice: invoice.name } });
				this.toastStore.show({ title: __("Draft invoice deleted"), color: "success" });
				await this.loadDrafts();
			} catch (error) {
				console.error("Error deleting draft invoice:", error);
				this.toastStore.show({ title: __("Unable to delete draft invoice"), color: "error" });
			}
		},
		async createReturn(invoice) {
			try {
				const { message } = await frappe.call({ method: "posawesome.posawesome.api.invoices.get_invoice_for_return", args: { invoice_name: invoice.name, pos_profile: this.posProfile?.name, doctype: invoice.doctype || this.currentInvoiceDoctype } });
				const return_doc = message;
				if (!return_doc || !Array.isArray(return_doc.items) || !return_doc.items.length) { this.toastStore.show({ title: __("No returnable items found for this invoice"), color: "warning" }); return; }
				const invoice_doc = {
					items: return_doc.items.map((item) => {
						const row = { ...item };
						if (return_doc.doctype === "POS Invoice") row.pos_invoice_item = item.name;
						else row.sales_invoice_item = item.name;
						delete row.name;
						row.rate = item.rate; row.price_list_rate = item.price_list_rate; row.discount_percentage = item.discount_percentage; row.discount_amount = item.discount_amount; row.is_free_item = item.is_free_item; row.net_rate = item.net_rate; row.net_amount = item.net_amount > 0 ? item.net_amount * -1 : item.net_amount; row.locked_price = true; row.qty = item.qty > 0 ? item.qty * -1 : item.qty; row.stock_qty = item.stock_qty > 0 ? item.stock_qty * -1 : item.stock_qty; row.amount = item.amount > 0 ? item.amount * -1 : item.amount;
						return row;
					}),
					is_return: 1,
					return_against: return_doc.name,
					customer: return_doc.customer,
					discount_amount: return_doc.discount_amount,
					additional_discount_percentage: return_doc.additional_discount_percentage,
					payments: Array.isArray(return_doc.payments) ? return_doc.payments.map((p) => ({ mode_of_payment: p.mode_of_payment, amount: p.amount, base_amount: p.base_amount, default: p.default, account: p.account, type: p.type, currency: p.currency, conversion_rate: p.conversion_rate })) : [],
					grand_total: return_doc.grand_total > 0 ? return_doc.grand_total * -1 : return_doc.grand_total,
					update_stock: 1,
					pos_profile: this.posProfile?.name,
					company: this.posProfile?.company,
				};
				this.eventBus?.emit("load_return_invoice", { invoice_doc, return_doc });
				this.uiStore.closeInvoiceManagement();
			} catch (error) {
				console.error("Error creating return invoice:", error);
				this.toastStore.show({ title: __("Unable to prepare return invoice"), color: "error" });
			}
		},
		openAddPayment(invoice) {
			const customer = invoice.customer || this.selectedInvoiceDetail?.customer;
			if (!customer) { this.toastStore.show({ title: __("Customer is required to add payment"), color: "error" }); return; }
			this.customersStore.setSelectedCustomer(customer);
			this.uiStore.setPaymentRouteTarget({ invoiceName: invoice.name, customer, currency: invoice.currency || this.posProfile?.currency || null });
			this.detailDialog = false;
			this.uiStore.closeInvoiceManagement();
			this.router.push("/payments");
		},
		async printInvoice(invoice) {
			const profile = this.posProfile;
			if (!invoice?.name || !profile) return;
			const doctype = invoice.doctype || this.currentInvoiceDoctype;
			const printFormat = profile.print_format_for_online || profile.print_format || "Standard";
			const letterHead = profile.letter_head || 0;
			const debugPrint = isDebugPrintEnabled();
			const useSilentPrint = !!profile.posa_silent_print;
			let url = frappe.urllib.get_base_url() + "/printview?doctype=" + encodeURIComponent(doctype) + "&name=" + encodeURIComponent(invoice.name) + "&trigger_print=1&format=" + encodeURIComponent(printFormat) + "&no_letterhead=" + (letterHead ? "0" : "1");
			if (letterHead) url += "&letterhead=" + encodeURIComponent(letterHead);
			url = appendDebugPrintParam(url, debugPrint);
			const printOptions = { allowOfflineFallback: isOffline(), triggerPrint: "1", debugPrint };
			if (useSilentPrint && !isOffline()) {
				try { await printDocumentViaQz({ doctype, name: invoice.name, printFormat, letterhead: letterHead || null, noLetterhead: letterHead ? "0" : "1" }); return; }
				catch (error) { console.warn("QZ Tray print failed, falling back to browser print", error); }
			}
			if (useSilentPrint) { silentPrint(url, printOptions); return; }
			const printWindow = window.open(url, "Print");
			if (printWindow) watchPrintWindow(printWindow, printOptions);
		},
	},
};
</script>

<style scoped>
.invoice-management-dialog-content { background: transparent !important; }
.invoice-management-card { background: var(--pos-surface-raised) !important; color: var(--pos-text-primary) !important; }
.invoice-management-card__body { min-height: 580px; }
.filter-grid, .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.summary-tile { border-radius: 14px; padding: 14px 16px; border: 1px solid rgba(148, 163, 184, 0.22); background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(241,245,249,0.86)); }
.summary-tile__label { font-size: 0.76rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; }
.summary-tile__value { margin-top: 6px; font-size: 1.05rem; font-weight: 700; }
.detail-section__title { font-size: 0.95rem; font-weight: 700; margin-bottom: 8px; }
</style>
