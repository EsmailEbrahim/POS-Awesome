<template>
	<v-row justify="center">
		<v-dialog
			v-model="invoiceManagementDialog"
			max-width="1320px"
			scrollable
			:theme="isDarkTheme ? 'dark' : 'light'"
			content-class="invoice-management-dialog-content"
		>
			<v-card
				variant="flat"
				:theme="isDarkTheme ? 'dark' : 'light'"
				:class="[
					'pos-themed-card invoice-management-card',
					isDarkTheme
						? 'invoice-management-card--dark'
						: 'invoice-management-card--light',
				]"
			>
				<v-card-title class="d-flex align-center justify-space-between flex-wrap ga-3">
					<div>
						<div class="text-h5 text-primary">{{ __("Invoice Management") }}</div>
						<div class="text-subtitle-2 text-medium-emphasis">
							{{ __("Browse invoice history, drafts, and returns") }}
						</div>
					</div>
					<div class="d-flex align-center ga-2">
						<v-btn
							variant="text"
							color="primary"
							prepend-icon="mdi-refresh"
							:loading="loading"
							@click="refreshActiveTab"
						>
							{{ __("Refresh") }}
						</v-btn>
						<v-btn icon="mdi-close" variant="text" @click="uiStore.closeInvoiceManagement()" />
					</div>
				</v-card-title>

				<v-tabs v-model="activeTab" color="primary" grow class="px-2">
					<v-tab value="history">
						{{ __("History") }} ({{ filteredHistoryInvoices.length }})
					</v-tab>
					<v-tab value="drafts">
						{{ __("Drafts") }} ({{ draftInvoices.length }})
					</v-tab>
					<v-tab value="returns">
						{{ __("Returns") }} ({{ filteredReturnInvoices.length }})
					</v-tab>
				</v-tabs>

				<v-divider />

				<v-card-text class="invoice-management-card__body">
					<v-window v-model="activeTab">
						<v-window-item value="history">
							<div class="d-flex flex-wrap ga-3 mb-4">
								<v-text-field
									v-model="historySearch"
									class="pos-themed-input flex-grow-1"
									variant="outlined"
									density="compact"
									hide-details
									clearable
									prepend-inner-icon="mdi-magnify"
									:label="__('Search invoices or customers')"
								/>
							</div>
							<v-data-table
								:headers="historyHeaders"
								:items="filteredHistoryInvoices"
								:loading="loading && activeTab === 'history'"
								item-value="name"
								class="elevation-1"
								:items-per-page="10"
							>
								<template #item.posting_date="{ item }">
									{{ formatDateTime(item.posting_date, item.posting_time) }}
								</template>
								<template #item.grand_total="{ item }">
									{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}
								</template>
								<template #item.outstanding_amount="{ item }">
									{{ currencySymbol(item.currency) }}
									{{ formatCurrency(item.outstanding_amount || 0) }}
								</template>
								<template #item.status="{ item }">
									<v-chip size="small" :color="statusColor(item.status)" variant="tonal">
										{{ __(item.status || "Draft") }}
									</v-chip>
								</template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn
											icon="mdi-eye-outline"
											variant="text"
											size="small"
											:title="__('View Details')"
											@click="viewInvoice(item)"
										/>
										<v-btn
											icon="mdi-printer-outline"
											variant="text"
											size="small"
											:title="__('Print')"
											@click="printInvoice(item)"
										/>
										<v-btn
											v-if="posProfile?.posa_allow_return == 1"
											icon="mdi-backup-restore"
											variant="text"
											size="small"
											color="warning"
											:title="__('Create Return')"
											@click="createReturn(item)"
										/>
									</div>
								</template>
							</v-data-table>
						</v-window-item>

						<v-window-item value="drafts">
							<div class="d-flex flex-wrap ga-3 mb-4">
								<v-text-field
									v-model="draftSearch"
									class="pos-themed-input flex-grow-1"
									variant="outlined"
									density="compact"
									hide-details
									clearable
									prepend-inner-icon="mdi-magnify"
									:label="__('Search drafts or customers')"
								/>
							</div>
							<v-data-table
								:headers="draftHeaders"
								:items="filteredDraftInvoices"
								:loading="loading && activeTab === 'drafts'"
								item-value="name"
								class="elevation-1"
								:items-per-page="10"
							>
								<template #item.posting_date="{ item }">
									{{ formatDateTime(item.posting_date, item.posting_time) }}
								</template>
								<template #item.grand_total="{ item }">
									{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}
								</template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn
											icon="mdi-folder-open-outline"
											variant="text"
											size="small"
											color="primary"
											:title="__('Load Draft')"
											@click="loadDraft(item)"
										/>
										<v-btn
											icon="mdi-delete-outline"
											variant="text"
											size="small"
											color="error"
											:title="__('Delete Draft')"
											@click="deleteDraft(item)"
										/>
									</div>
								</template>
							</v-data-table>
						</v-window-item>

						<v-window-item value="returns">
							<div class="d-flex flex-wrap ga-3 mb-4">
								<v-text-field
									v-model="returnSearch"
									class="pos-themed-input flex-grow-1"
									variant="outlined"
									density="compact"
									hide-details
									clearable
									prepend-inner-icon="mdi-magnify"
									:label="__('Search return invoices or customers')"
								/>
							</div>
							<v-data-table
								:headers="returnHeaders"
								:items="filteredReturnInvoices"
								:loading="loading && activeTab === 'returns'"
								item-value="name"
								class="elevation-1"
								:items-per-page="10"
							>
								<template #item.posting_date="{ item }">
									{{ formatDateTime(item.posting_date, item.posting_time) }}
								</template>
								<template #item.grand_total="{ item }">
									{{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}
								</template>
								<template #item.return_against="{ item }">
									{{ item.return_against || "-" }}
								</template>
								<template #item.actions="{ item }">
									<div class="d-flex justify-end ga-1">
										<v-btn
											icon="mdi-eye-outline"
											variant="text"
											size="small"
											:title="__('View Details')"
											@click="viewInvoice(item)"
										/>
										<v-btn
											icon="mdi-printer-outline"
											variant="text"
											size="small"
											:title="__('Print')"
											@click="printInvoice(item)"
										/>
									</div>
								</template>
							</v-data-table>
						</v-window-item>
					</v-window>
				</v-card-text>

				<v-card-actions>
					<v-spacer />
					<v-btn color="primary" variant="text" @click="uiStore.closeInvoiceManagement()">
						{{ __("Close") }}
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-row>

	<v-dialog
		v-model="detailDialog"
		max-width="980px"
		scrollable
		:theme="isDarkTheme ? 'dark' : 'light'"
	>
		<v-card>
			<v-card-title class="d-flex align-center justify-space-between">
				<div>
					<div class="text-h6">{{ selectedInvoiceDetail?.name || __("Invoice Details") }}</div>
					<div class="text-subtitle-2 text-medium-emphasis">
						{{ selectedInvoiceDetail?.customer_name || selectedInvoiceDetail?.customer || "" }}
					</div>
				</div>
				<v-btn icon="mdi-close" variant="text" @click="detailDialog = false" />
			</v-card-title>
			<v-divider />
			<v-card-text v-if="selectedInvoiceDetail">
				<div class="detail-grid mb-4">
					<div>
						<strong>{{ __("Posting") }}:</strong>
						{{ formatDateTime(selectedInvoiceDetail.posting_date, selectedInvoiceDetail.posting_time) }}
					</div>
					<div>
						<strong>{{ __("Status") }}:</strong> {{ __(selectedInvoiceDetail.status || "") }}
					</div>
					<div>
						<strong>{{ __("Grand Total") }}:</strong>
						{{ currencySymbol(selectedInvoiceDetail.currency) }}
						{{ formatCurrency(selectedInvoiceDetail.grand_total) }}
					</div>
					<div>
						<strong>{{ __("Outstanding") }}:</strong>
						{{ currencySymbol(selectedInvoiceDetail.currency) }}
						{{ formatCurrency(selectedInvoiceDetail.outstanding_amount || 0) }}
					</div>
				</div>

				<v-data-table
					:headers="detailHeaders"
					:items="selectedInvoiceDetail.items || []"
					item-value="item_code"
					:items-per-page="10"
					class="elevation-1"
				>
					<template #item.rate="{ item }">
						{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(item.rate) }}
					</template>
					<template #item.amount="{ item }">
						{{ currencySymbol(selectedInvoiceDetail.currency) }} {{ formatCurrency(item.amount) }}
					</template>
				</v-data-table>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn
					v-if="selectedInvoiceDetail"
					color="primary"
					variant="text"
					prepend-icon="mdi-printer-outline"
					@click="printInvoice(selectedInvoiceDetail)"
				>
					{{ __("Print") }}
				</v-btn>
				<v-btn color="primary" variant="text" @click="detailDialog = false">
					{{ __("Close") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
import { inject } from "vue";
import { storeToRefs } from "pinia";
import format from "../../../format";
import { useTheme } from "../../../composables/core/useTheme";
import { useToastStore } from "../../../stores/toastStore";
import { useUIStore } from "../../../stores/uiStore";
import { useInvoiceStore } from "../../../stores/invoiceStore";
import {
	appendDebugPrintParam,
	isDebugPrintEnabled,
	silentPrint,
	watchPrintWindow,
} from "../../../plugins/print";
import { printDocumentViaQz } from "../../../services/qzTray";
import { isOffline } from "../../../../offline/index";

export default {
	mixins: [format],
	setup() {
		const toastStore = useToastStore();
		const uiStore = useUIStore();
		const invoiceStore = useInvoiceStore();
		const theme = useTheme();
		const eventBus = inject("eventBus");
		const { invoiceManagementDialog, posProfile, posOpeningShift } = storeToRefs(uiStore);

		return {
			toastStore,
			uiStore,
			invoiceStore,
			eventBus,
			invoiceManagementDialog,
			posProfile,
			posOpeningShift,
			isDarkTheme: theme.isDark,
		};
	},
	data: () => ({
		activeTab: "history",
		loading: false,
		historySearch: "",
		draftSearch: "",
		returnSearch: "",
		historyInvoices: [],
		draftInvoices: [],
		detailDialog: false,
		selectedInvoiceDetail: null,
		historyHeaders: [
			{ title: __("Invoice"), key: "name", align: "start", sortable: true },
			{ title: __("Customer"), key: "customer_name", align: "start", sortable: true },
			{ title: __("Posting"), key: "posting_date", align: "start", sortable: true },
			{ title: __("Status"), key: "status", align: "start", sortable: true },
			{ title: __("Total"), key: "grand_total", align: "end", sortable: true },
			{ title: __("Outstanding"), key: "outstanding_amount", align: "end", sortable: true },
			{ title: __("Actions"), key: "actions", align: "end", sortable: false },
		],
		draftHeaders: [
			{ title: __("Invoice"), key: "name", align: "start", sortable: true },
			{ title: __("Customer"), key: "customer_name", align: "start", sortable: true },
			{ title: __("Posting"), key: "posting_date", align: "start", sortable: true },
			{ title: __("Total"), key: "grand_total", align: "end", sortable: true },
			{ title: __("Actions"), key: "actions", align: "end", sortable: false },
		],
		returnHeaders: [
			{ title: __("Invoice"), key: "name", align: "start", sortable: true },
			{ title: __("Customer"), key: "customer_name", align: "start", sortable: true },
			{ title: __("Posting"), key: "posting_date", align: "start", sortable: true },
			{ title: __("Against"), key: "return_against", align: "start", sortable: true },
			{ title: __("Total"), key: "grand_total", align: "end", sortable: true },
			{ title: __("Actions"), key: "actions", align: "end", sortable: false },
		],
		detailHeaders: [
			{ title: __("Item"), key: "item_name", align: "start", sortable: true },
			{ title: __("Code"), key: "item_code", align: "start", sortable: true },
			{ title: __("Qty"), key: "qty", align: "end", sortable: true },
			{ title: __("Rate"), key: "rate", align: "end", sortable: true },
			{ title: __("Amount"), key: "amount", align: "end", sortable: true },
		],
	}),
	computed: {
		currentInvoiceDoctype() {
			return this.posProfile?.create_pos_invoice_instead_of_sales_invoice
				? "POS Invoice"
				: "Sales Invoice";
		},
		filteredHistoryInvoices() {
			return this.filterInvoices(
				this.historyInvoices.filter((invoice) => !invoice.is_return),
				this.historySearch,
			);
		},
		filteredReturnInvoices() {
			return this.filterInvoices(
				this.historyInvoices.filter((invoice) => invoice.is_return),
				this.returnSearch,
			);
		},
		filteredDraftInvoices() {
			return this.filterInvoices(this.draftInvoices, this.draftSearch);
		},
	},
	watch: {
		invoiceManagementDialog(val) {
			if (val) {
				this.refreshAll();
			}
		},
		activeTab() {
			this.refreshActiveTab();
		},
	},
	methods: {
		filterInvoices(items, query) {
			const text = String(query || "")
				.trim()
				.toLowerCase();
			if (!text) {
				return items;
			}

			return items.filter((item) =>
				[
					item.name,
					item.customer,
					item.customer_name,
					item.return_against,
				]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(text)),
			);
		},
		formatDateTime(date, time) {
			const displayDate = this.formatDateForDisplay(date);
			const displayTime = time ? String(time).split(".")[0] : "";
			return [displayDate, displayTime].filter(Boolean).join(" ");
		},
		formatDateForDisplay(date) {
			if (!date) return "";
			const parts = String(date).split("-");
			if (parts.length === 3) {
				return `${parts[2]}-${parts[1]}-${parts[0]}`;
			}
			return date;
		},
		statusColor(status) {
			const normalized = String(status || "").toLowerCase();
			if (normalized.includes("paid")) return "success";
			if (normalized.includes("overdue")) return "error";
			if (normalized.includes("return")) return "warning";
			if (normalized.includes("draft")) return "secondary";
			return "primary";
		},
		async refreshAll() {
			await Promise.all([this.loadHistory(), this.loadDrafts()]);
		},
		async refreshActiveTab() {
			if (!this.invoiceManagementDialog) {
				return;
			}

			if (this.activeTab === "drafts") {
				await this.loadDrafts();
				return;
			}

			await this.loadHistory();
		},
		async loadHistory() {
			if (!this.posProfile?.name) {
				this.historyInvoices = [];
				return;
			}

			this.loading = true;
			try {
				const { message } = await frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: this.currentInvoiceDoctype,
						filters: {
							pos_profile: this.posProfile.name,
							docstatus: 1,
						},
						fields: [
							"name",
							"customer",
							"customer_name",
							"posting_date",
							"posting_time",
							"grand_total",
							"outstanding_amount",
							"status",
							"is_return",
							"return_against",
							"currency",
						],
						order_by: "modified desc",
						limit_page_length: 200,
					},
				});

				this.historyInvoices = Array.isArray(message)
					? message.map((invoice) => ({
							...invoice,
							doctype: this.currentInvoiceDoctype,
						}))
					: [];
			} catch (error) {
				console.error("Error loading invoice history:", error);
				this.toastStore.show({
					title: __("Unable to fetch invoice history"),
					color: "error",
				});
			} finally {
				this.loading = false;
			}
		},
		async loadDrafts() {
			if (!this.posOpeningShift?.name) {
				this.draftInvoices = [];
				return;
			}

			this.loading = true;
			try {
				const { message } = await frappe.call({
					method: "posawesome.posawesome.api.invoices.get_draft_invoices",
					args: {
						pos_opening_shift: this.posOpeningShift.name,
						doctype: this.currentInvoiceDoctype,
					},
				});

				this.draftInvoices = Array.isArray(message)
					? message.map((invoice) => ({
							...invoice,
							doctype: invoice.doctype || this.currentInvoiceDoctype,
						}))
					: [];
			} catch (error) {
				console.error("Error loading draft invoices:", error);
				this.toastStore.show({
					title: __("Unable to fetch draft invoices"),
					color: "error",
				});
			} finally {
				this.loading = false;
			}
		},
		async viewInvoice(invoice) {
			try {
				const { message } = await frappe.call({
					method: "frappe.client.get",
					args: {
						doctype: invoice.doctype || this.currentInvoiceDoctype,
						name: invoice.name,
					},
				});
				this.selectedInvoiceDetail = message || null;
				this.detailDialog = !!message;
			} catch (error) {
				console.error("Error loading invoice details:", error);
				this.toastStore.show({
					title: __("Unable to load invoice details"),
					color: "error",
				});
			}
		},
		async loadDraft(invoice) {
			try {
				const { message } = await frappe.call({
					method: "posawesome.posawesome.api.invoices.get_draft_invoice_doc",
					args: {
						invoice_name: invoice.name,
						doctype: invoice.doctype || this.currentInvoiceDoctype,
					},
				});
				if (message) {
					this.invoiceStore.triggerLoadInvoice(message);
					this.uiStore.closeInvoiceManagement();
				}
			} catch (error) {
				console.error("Error loading draft invoice:", error);
				this.toastStore.show({
					title: __("Unable to load draft invoice"),
					color: "error",
				});
			}
		},
		async deleteDraft(invoice) {
			if (!window.confirm(__("Delete draft invoice {0}?", [invoice.name]))) {
				return;
			}

			try {
				await frappe.call({
					method: "posawesome.posawesome.api.invoices.delete_invoice",
					args: {
						invoice: invoice.name,
					},
				});
				this.toastStore.show({
					title: __("Draft invoice deleted"),
					color: "success",
				});
				await this.loadDrafts();
			} catch (error) {
				console.error("Error deleting draft invoice:", error);
				this.toastStore.show({
					title: __("Unable to delete draft invoice"),
					color: "error",
				});
			}
		},
		async createReturn(invoice) {
			try {
				const { message } = await frappe.call({
					method: "posawesome.posawesome.api.invoices.get_invoice_for_return",
					args: {
						invoice_name: invoice.name,
						pos_profile: this.posProfile?.name,
						doctype: invoice.doctype || this.currentInvoiceDoctype,
					},
				});

				const return_doc = message;
				if (!return_doc || !Array.isArray(return_doc.items) || !return_doc.items.length) {
					this.toastStore.show({
						title: __("No returnable items found for this invoice"),
						color: "warning",
					});
					return;
				}

				const invoice_doc = {
					items: return_doc.items.map((item) => {
						const new_item = { ...item };
						if (return_doc.doctype === "POS Invoice") {
							new_item.pos_invoice_item = item.name;
						} else {
							new_item.sales_invoice_item = item.name;
						}
						delete new_item.name;
						new_item.rate = item.rate;
						new_item.price_list_rate = item.price_list_rate;
						new_item.discount_percentage = item.discount_percentage;
						new_item.discount_amount = item.discount_amount;
						new_item.is_free_item = item.is_free_item;
						new_item.net_rate = item.net_rate;
						new_item.net_amount =
							item.net_amount > 0 ? item.net_amount * -1 : item.net_amount;
						new_item.locked_price = true;
						new_item.qty = item.qty > 0 ? item.qty * -1 : item.qty;
						new_item.stock_qty =
							item.stock_qty > 0 ? item.stock_qty * -1 : item.stock_qty;
						new_item.amount = item.amount > 0 ? item.amount * -1 : item.amount;
						return new_item;
					}),
					is_return: 1,
					return_against: return_doc.name,
					customer: return_doc.customer,
					discount_amount: return_doc.discount_amount,
					additional_discount_percentage:
						return_doc.additional_discount_percentage,
					payments: Array.isArray(return_doc.payments)
						? return_doc.payments.map((payment) => ({
								mode_of_payment: payment.mode_of_payment,
								amount: payment.amount,
								base_amount: payment.base_amount,
								default: payment.default,
								account: payment.account,
								type: payment.type,
								currency: payment.currency,
								conversion_rate: payment.conversion_rate,
							}))
						: [],
					grand_total:
						return_doc.grand_total > 0
							? return_doc.grand_total * -1
							: return_doc.grand_total,
					update_stock: 1,
					pos_profile: this.posProfile?.name,
					company: this.posProfile?.company,
				};

				this.eventBus?.emit("load_return_invoice", { invoice_doc, return_doc });
				this.uiStore.closeInvoiceManagement();
			} catch (error) {
				console.error("Error creating return invoice:", error);
				this.toastStore.show({
					title: __("Unable to prepare return invoice"),
					color: "error",
				});
			}
		},
		async printInvoice(invoice) {
			const profile = this.posProfile;
			if (!invoice?.name || !profile) {
				return;
			}

			const doctype = invoice.doctype || this.currentInvoiceDoctype;
			const printFormat =
				profile.print_format_for_online || profile.print_format || "Standard";
			const letterHead = profile.letter_head || 0;
			const debugPrint = isDebugPrintEnabled();
			const useSilentPrint = !!profile.posa_silent_print;
			let url =
				frappe.urllib.get_base_url() +
				"/printview?doctype=" +
				encodeURIComponent(doctype) +
				"&name=" +
				encodeURIComponent(invoice.name) +
				"&trigger_print=1&format=" +
				encodeURIComponent(printFormat) +
				"&no_letterhead=" +
				(letterHead ? "0" : "1");

			if (letterHead) {
				url += "&letterhead=" + encodeURIComponent(letterHead);
			}

			url = appendDebugPrintParam(url, debugPrint);
			const printOptions = {
				allowOfflineFallback: isOffline(),
				triggerPrint: "1",
				debugPrint,
			};

			if (useSilentPrint && !isOffline()) {
				try {
					await printDocumentViaQz({
						doctype,
						name: invoice.name,
						printFormat,
						letterhead: letterHead || null,
						noLetterhead: letterHead ? "0" : "1",
					});
					return;
				} catch (error) {
					console.warn(
						"QZ Tray print failed, falling back to browser print",
						error,
					);
				}
			}

			if (useSilentPrint) {
				silentPrint(url, printOptions);
				return;
			}

			const printWindow = window.open(url, "Print");
			if (printWindow) {
				watchPrintWindow(printWindow, printOptions);
			}
		},
	},
};
</script>

<style scoped>
.invoice-management-dialog-content {
	background: transparent !important;
}

.invoice-management-card {
	background: var(--pos-surface-raised) !important;
	color: var(--pos-text-primary) !important;
}

.invoice-management-card--light {
	background: #ffffff !important;
	color: #212121 !important;
	border: 1px solid rgba(0, 0, 0, 0.08) !important;
}

.invoice-management-card--dark {
	background: #242b33 !important;
	color: #ffffff !important;
}

.invoice-management-card__body {
	min-height: 520px;
}

.detail-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 12px;
}
</style>
