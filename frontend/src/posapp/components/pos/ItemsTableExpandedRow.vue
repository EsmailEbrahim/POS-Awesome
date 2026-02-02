<template>
	<td :colspan="colspan" class="ma-0 pa-0 expanded-row-cell">
		<div
			v-if="isExpanded"
			class="expanded-content responsive-expanded-content"
			:class="expandedContentClasses"
		>
			<!-- Item Details Form -->
			<div class="item-details-form">
				<!-- Basic Information Section -->
				<div class="form-section">
					<div class="section-header">
						<v-icon size="small" class="section-icon">mdi-information-outline</v-icon>
						<span class="section-title">{{ __("Basic Information") }}</span>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Item Code')"
								class="pos-themed-input"
								hide-details
								v-model="item.item_code"
								disabled
								prepend-inner-icon="mdi-barcode"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('QTY')"
								class="pos-themed-input"
								hide-details
								:model-value="
									formatFloat(
										item.qty,
										hide_qty_decimals ? 0 : undefined,
									)
								"
								@change="onQtyChange(item, $event)"
								:rules="[isNumber]"
								:disabled="!!item.posa_is_replace"
								prepend-inner-icon="mdi-numeric"
							></v-text-field>
							<div v-if="item.max_qty !== undefined" class="text-caption mt-1">
								{{
									__("In stock: {0}", [
										formatFloat(
											item._base_actual_qty,
											hide_qty_decimals ? 0 : undefined,
										),
									])
								}}
							</div>
						</div>
						<div class="form-field">
							<v-select
								density="compact"
								class="pos-themed-input"
								:label="frappe._('UOM')"
								v-model="item.uom"
								:items="item.item_uoms"
								variant="outlined"
								item-title="uom"
								item-value="uom"
								hide-details
								@update:model-value="calcUom(item, $event)"
								:disabled="
									!!item.posa_is_replace ||
									(isReturnInvoice && invoice_doc.return_against)
								"
								prepend-inner-icon="mdi-weight"
							></v-select>
						</div>
					</div>
				</div>

				<!-- Pricing Section -->
				<div class="form-section">
					<div class="section-header">
						<v-icon size="small" class="section-icon">mdi-currency-usd</v-icon>
						<span class="section-title">{{ __("Pricing & Discounts") }}</span>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								id="rate"
								:label="frappe._('Rate')"
								class="pos-themed-input"
								hide-details
								:model-value="formatCurrency(item.rate)"
								@change="[
									setFormatedCurrency(item, 'rate', null, false, $event),
									calcPrices(item, $event.target.value, $event),
								]"
								:disabled="
									!pos_profile.posa_allow_user_to_edit_rate ||
									!!item.posa_is_replace ||
									!!item.posa_offer_applied
								"
								prepend-inner-icon="mdi-currency-usd"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								id="discount_percentage"
								:label="frappe._('Discount %')"
								class="pos-themed-input"
								hide-details
								:model-value="
									formatFloat(Math.abs(item.discount_percentage || 0))
								"
								@change="[
									setFormatedCurrency(
										item,
										'discount_percentage',
										null,
										false,
										$event,
									),
									calcPrices(item, $event.target.value, $event),
								]"
								:disabled="
									!pos_profile.posa_allow_user_to_edit_item_discount ||
									!!item.posa_is_replace ||
									!!item.posa_offer_applied
								"
								prepend-inner-icon="mdi-percent"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								id="discount_amount"
								:label="frappe._('Discount Amount')"
								class="pos-themed-input"
								hide-details
								:model-value="
									formatCurrency(Math.abs(item.discount_amount || 0))
								"
								@change="[
									setFormatedCurrency(
										item,
										'discount_amount',
										null,
										false,
										$event,
									),
									calcPrices(item, $event.target.value, $event),
								]"
								:disabled="
									!pos_profile.posa_allow_user_to_edit_item_discount ||
									!!item.posa_is_replace ||
									!!item.posa_offer_applied
								"
								prepend-inner-icon="mdi-tag-minus"
							></v-text-field>
						</div>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Price List Rate')"
								class="pos-themed-input"
								hide-details
								:model-value="formatCurrency(item.price_list_rate ?? 0)"
								:disabled="!pos_profile.posa_allow_price_list_rate_change"
								prepend-inner-icon="mdi-format-list-numbered"
								:prefix="currencySymbol(pos_profile.currency)"
								@change="changePriceListRate(item)"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Total Amount')"
								class="pos-themed-input"
								hide-details
								:model-value="formatCurrency(item.qty * item.rate)"
								disabled
								prepend-inner-icon="mdi-calculator"
							></v-text-field>
						</div>
						<div
							class="form-field"
							v-if="pos_profile.posa_allow_price_list_rate_change"
						>
							<v-btn
								size="small"
								color="primary"
								variant="outlined"
								class="change-price-btn"
								@click.stop="changePriceListRate(item)"
							>
								<v-icon size="small" class="mr-1">mdi-pencil</v-icon>
								{{ __("Change Price") }}
							</v-btn>
						</div>
					</div>
				</div>

				<!-- Stock Information Section -->
				<div class="form-section">
					<div class="section-header">
						<v-icon size="small" class="section-icon">mdi-warehouse</v-icon>
						<span class="section-title">{{ __("Stock Information") }}</span>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Available QTY')"
								class="pos-themed-input"
								hide-details
								:model-value="formatFloat(item._base_actual_qty)"
								disabled
								prepend-inner-icon="mdi-package-variant"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Stock QTY')"
								class="pos-themed-input"
								hide-details
								:model-value="formatFloat(item.stock_qty)"
								disabled
								prepend-inner-icon="mdi-scale-balance"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Stock UOM')"
								class="pos-themed-input"
								hide-details
								v-model="item.stock_uom"
								disabled
								prepend-inner-icon="mdi-weight-pound"
							></v-text-field>
						</div>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Warehouse')"
								class="pos-themed-input"
								hide-details
								v-model="item.warehouse"
								disabled
								prepend-inner-icon="mdi-warehouse"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Group')"
								class="pos-themed-input"
								hide-details
								v-model="item.item_group"
								disabled
								prepend-inner-icon="mdi-folder-outline"
							></v-text-field>
						</div>
						<div class="form-field" v-if="item.posa_offer_applied">
							<v-checkbox
								density="compact"
								:label="frappe._('Offer Applied')"
								v-model="item.posa_offer_applied"
								readonly
								hide-details
								class="mt-1"
								color="success"
							></v-checkbox>
						</div>
					</div>
				</div>

				<!-- Serial Number Section -->
				<div class="form-section" v-if="item.has_serial_no || item.serial_no">
					<div class="section-header">
						<v-icon size="small" class="section-icon">mdi-barcode-scan</v-icon>
						<span class="section-title">{{ __("Serial Numbers") }}</span>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Serial No QTY')"
								class="pos-themed-input"
								hide-details
								v-model="item.serial_no_selected_count"
								type="number"
								disabled
								prepend-inner-icon="mdi-counter"
							></v-text-field>
						</div>
					</div>
					<div class="form-row">
						<div class="form-field full-width">
							<v-autocomplete
								v-model="item.serial_no_selected"
								:items="getSerialOptions(item)"
								item-title="serial_no"
								item-value="serial_no"
								variant="outlined"
								density="compact"
								chips
								color="primary"
								class="pos-themed-input"
								:label="frappe._('Serial No')"
								multiple
								@update:model-value="setSerialNo(item)"
								prepend-inner-icon="mdi-barcode"
							></v-autocomplete>
						</div>
					</div>
				</div>

				<!-- Batch Number Section -->
				<div class="form-section" v-if="item.has_batch_no || item.batch_no">
					<div class="section-header">
						<v-icon size="small" class="section-icon"
							>mdi-package-variant-closed</v-icon
						>
						<span class="section-title">{{ __("Batch Information") }}</span>
					</div>
					<div class="form-row">
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Batch No. Available QTY')"
								class="pos-themed-input"
								hide-details
								:model-value="formatFloat(item.actual_batch_qty)"
								disabled
								prepend-inner-icon="mdi-package-variant"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-text-field
								density="compact"
								variant="outlined"
								color="primary"
								:label="frappe._('Batch No Expiry Date')"
								class="pos-themed-input"
								hide-details
								v-model="item.batch_no_expiry_date"
								disabled
								prepend-inner-icon="mdi-calendar-clock"
							></v-text-field>
						</div>
						<div class="form-field">
							<v-autocomplete
								v-model="item.batch_no"
								:items="item.batch_no_data"
								item-title="batch_no"
								variant="outlined"
								density="compact"
								color="primary"
								class="pos-themed-input"
								:label="frappe._('Batch No')"
								@update:model-value="setBatchQty(item, $event)"
								hide-details
								prepend-inner-icon="mdi-package-variant-closed"
							>
								<template v-slot:item="{ props, item }">
									<v-list-item v-bind="props">
										<v-list-item-title
											v-html="getRaw(item).batch_no"
										></v-list-item-title>
										<v-list-item-subtitle class="d-flex align-center">
											<span
												v-html="
													`Available QTY  '${
														getRaw(item).available_qty ??
														getRaw(item).batch_qty
													}' - Expiry Date ${getRaw(item).expiry_date}`
												"
											></span>
											<v-chip
												v-if="getRaw(item).is_expired"
												color="error"
												size="x-small"
												variant="flat"
												class="ml-2"
											>
												{{ __("Expired") }}
											</v-chip>
										</v-list-item-subtitle>
									</v-list-item>
								</template>
							</v-autocomplete>
						</div>
					</div>
				</div>

				<!-- Delivery Date Section -->
				<div
					class="form-section"
					v-if="
						pos_profile.posa_allow_sales_order &&
						['Order', 'Quotation'].includes(invoiceType || '')
					"
				>
					<div class="section-header">
						<v-icon size="small" class="section-icon">mdi-calendar-check</v-icon>
						<span class="section-title">{{ __("Delivery Information") }}</span>
					</div>
					<div class="form-row">
						<div class="form-field">
							<VueDatePicker
								v-model="item.posa_delivery_date"
								model-type="format"
								format="dd-MM-yyyy"
								:min-date="new Date()"
								auto-apply
								@update:model-value="validateDueDate(item)"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
		<!-- Lazy placeholder -->
		<div v-else class="expanded-placeholder">
			<div class="text-center pa-4">
				<v-progress-circular indeterminate size="small"></v-progress-circular>
				<div class="text-caption mt-2">{{ __("Loading details...") }}</div>
			</div>
		</div>
	</td>
</template>

<script setup lang="ts">
/* global frappe, __ */
import { computed } from 'vue';
import type { CartItem, POSProfile, InvoiceDoc } from '../../types/models';

interface Props {
	item: CartItem | any;
	isExpanded: boolean;
	colspan: number;
	pos_profile: POSProfile | any;
	invoiceType?: string;
	isReturnInvoice?: boolean;
	invoice_doc?: InvoiceDoc | any;
	hide_qty_decimals: boolean;
	expandedContentClasses: any;
	
	// Formatters
	formatFloat: (val: any, precision?: number) => string;
	formatCurrency: (val: any, precision?: number) => string;
	currencySymbol: (currency?: string) => string;
	isNumber: (val: any) => boolean | string;
	
	// Actions
	setFormatedCurrency: (item: any, field: string, value: any, force?: boolean, event?: any) => void;
	calcPrices: (item: any, value: any, event?: any) => void;
	calcUom: (item: any, uom: string) => void;
	changePriceListRate: (item: any) => void;
	getSerialOptions: (item: any) => any[];
	setSerialNo: (item: any) => void;
	setBatchQty: (item: any, event: any) => void;
	validateDueDate: (item: any) => void;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: 'qty-change', item: CartItem, event: any): void;
}>();

const __ = (str: string, args?: any[]) => window.__ ? window.__(str, args) : str;
// @ts-ignore
const frappe = window.frappe || { _: (s: string) => s };


const onQtyChange = (item: CartItem, event: any) => {
	emit('qty-change', item, event);
};

const getRaw = (item: any) => item?.raw || {};
</script>

<style scoped>
/* Copied styles relevant to the expanded content */

/* Main expanded content container */
.expanded-content {
	padding: 24px;
	width: 100% !important;
	max-width: 100% !important;
	box-sizing: border-box;
	background: var(--pos-card-bg);
	border-radius: 0 0 8px 8px;
	border: 1px solid var(--pos-border);
	border-top: none;
	animation: expandIn 0.3s ease forwards;

	/* Enable container queries */
	container-type: inline-size;
	container-name: expanded-content;

	/* Ensure full width utilization */
	margin: 0;
	position: relative;
	overflow: visible;
}

@keyframes expandIn {
	from {
		opacity: 0;
		transform: translateY(-20px) scale(0.95);
	}

	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

/* Base expanded row styling */
.expanded-row-cell {
	padding: 0 !important;
	width: 100% !important;
	max-width: 100% !important;
	overflow: visible;
	box-sizing: border-box;
	position: relative;
}

/* Form sections */
.form-section {
	width: 100%;
	padding: 24px;
	box-sizing: border-box;
	background: var(--pos-card-bg);
	border-radius: 12px;
	border: 1px solid var(--pos-border);
	box-shadow: 0 2px 8px var(--pos-shadow);
	transition: all 0.3s ease;
}

.form-section:hover {
	box-shadow: 0 4px 16px var(--pos-shadow-dark);
	transform: translateY(-2px);
}

.item-details-form {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 20px;
}

/* Section headers */
.section-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 20px;
	padding-bottom: 16px;
	border-bottom: 2px solid var(--pos-primary);
	position: relative;
}

.section-header::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 60px;
	height: 2px;
	background: linear-gradient(90deg, var(--pos-primary), var(--pos-primary-container));
	border-radius: 1px;
}

.section-icon {
	color: var(--pos-primary);
	background: var(--pos-primary-container);
	padding: 8px;
	border-radius: 10px;
}

.section-title {
	font-weight: 600;
	font-size: 0.9rem;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--pos-text-primary);
}

/* Form rows */
.form-row {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	margin-bottom: 16px;
	width: 100%;
}

.form-field {
	flex: 1;
	min-width: 250px;
	max-width: 100%;
	box-sizing: border-box;
}

.form-field.full-width {
	flex-basis: 100%;
	min-width: 100%;
}

/* Change price button */
.change-price-btn {
	margin-top: 8px;
	border-radius: 8px !important;
	text-transform: none !important;
	font-weight: 500 !important;
	transition: all 0.3s ease !important;
}

.change-price-btn:hover {
	transform: translateY(-1px);
	box-shadow: 0 4px 8px var(--pos-shadow) !important;
}

/* Field overrides */
.form-field :deep(.v-field) {
	border-radius: 8px !important;
	background: var(--pos-input-bg) !important;
}

/* Container aware styles */
@container expanded-content (max-width: 600px) {
	.expanded-content {
		padding: 16px;
	}
	.form-row {
		flex-direction: column;
	}
	.form-field {
		min-width: 100%;
	}
}
</style>
