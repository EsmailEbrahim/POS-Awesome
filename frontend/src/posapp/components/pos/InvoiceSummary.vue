<template>
	<v-card
		class="cards mb-0 mt-3 py-2 px-3 rounded-lg resizable pos-themed-card"
		style="resize: vertical; overflow: auto"
	>
		<v-row dense>
			<!-- Summary Info -->
			<v-col cols="12" md="7">
				<v-row dense>
					<!-- Total Qty -->
					<v-col cols="6">
						<v-text-field
							:model-value="formatFloat(total_qty, hide_qty_decimals ? 0 : undefined)"
							:label="frappe._('Total Qty')"
							prepend-inner-icon="mdi-format-list-numbered"
							variant="solo"
							density="compact"
							readonly
							color="accent"
						/>
					</v-col>
					<!-- Additional Discount (Amount or Percentage) -->
					<v-col cols="6" v-if="!pos_profile.posa_use_percentage_discount">
						<v-text-field
							ref="additionalDiscountField"
							v-model="additionalDiscountDisplay"
							@update:model-value="handleAdditionalDiscountUpdate"
							@focus="handleAdditionalDiscountFocus"
							@blur="handleAdditionalDiscountBlur"
							:label="frappe._('Additional Discount')"
							prepend-inner-icon="mdi-cash-minus"
							variant="solo"
							density="compact"
							color="warning"
							:prefix="currencySymbol(pos_profile.currency)"
							:disabled="
								!pos_profile.posa_allow_user_to_edit_additional_discount ||
								!!discount_percentage_offer_name
							"
							class="summary-field"
						/>
					</v-col>

					<v-col cols="6" v-else>
						<v-text-field
							ref="additionalDiscountField"
							v-model="additionalDiscountPercentageDisplay"
							@update:model-value="handleAdditionalDiscountPercentageUpdate"
							@change="$emit('update_discount_umount')"
							@focus="handleAdditionalDiscountPercentageFocus"
							@blur="handleAdditionalDiscountPercentageBlur"
							:rules="[isNumber]"
							:label="frappe._('Additional Discount %')"
							suffix="%"
							prepend-inner-icon="mdi-percent"
							variant="solo"
							density="compact"
							color="warning"
							:disabled="
								!pos_profile.posa_allow_user_to_edit_additional_discount ||
								!!discount_percentage_offer_name
							"
							class="summary-field"
						/>
					</v-col>

					<!-- Items Discount -->
					<v-col cols="6">
						<v-text-field
							:model-value="formatCurrency(total_items_discount_amount)"
							:prefix="currencySymbol(displayCurrency)"
							:label="frappe._('Items Discounts')"
							prepend-inner-icon="mdi-tag-minus"
							variant="solo"
							density="compact"
							color="warning"
							readonly
							class="summary-field"
						/>
					</v-col>

					<!-- Total (moved to maintain row alignment) -->
					<v-col cols="6">
						<v-text-field
							:model-value="formatCurrency(subtotal)"
							:prefix="currencySymbol(displayCurrency)"
							:label="frappe._('Total')"
							prepend-inner-icon="mdi-cash"
							variant="solo"
							density="compact"
							readonly
							color="success"
							class="summary-field"
						/>
					</v-col>
				</v-row>
			</v-col>

			<!-- Action Buttons -->
			<v-col cols="12" md="5">
				<InvoiceActionButtons
					:pos_profile="pos_profile"
					:saveLoading="saveLoading"
					:loadDraftsLoading="loadDraftsLoading"
					:selectOrderLoading="selectOrderLoading"
					:selectPurchaseOrderLoading="selectPurchaseOrderLoading"
					:cancelLoading="cancelLoading"
					:returnsLoading="returnsLoading"
					:printLoading="printLoading"
					:applyOffersLoading="applyOffersLoading"
					:paymentLoading="paymentLoading"
					@save-and-clear="handleSaveAndClear"
					@load-drafts="handleLoadDrafts"
					@select-order="handleSelectOrder"
					@select-purchase-order="handleSelectPurchaseOrder"
					@cancel-sale="handleCancelSale"
					@open-returns="handleOpenReturns"
					@print-draft="handlePrintDraft"
					@apply-offers="handleApplyOffers"
					@show-payment="handleShowPayment"
				/>
			</v-col>
		</v-row>
	</v-card>
</template>

<script>
import { loadItemSelectorSettings } from "../../utils/itemSelectorSettings.js";
import InvoiceActionButtons from "./InvoiceActionButtons.vue";

export default {
	components: {
		InvoiceActionButtons,
	},
	props: {
		pos_profile: Object,
		total_qty: [Number, String],
		additional_discount: Number,
		additional_discount_percentage: Number,
		total_items_discount_amount: Number,
		subtotal: Number,
		displayCurrency: String,
		formatFloat: Function,
		formatCurrency: Function,
		currencySymbol: Function,
		discount_percentage_offer_name: [String, Number],
		isNumber: Function,
	},
	data() {
		return {
			// Loading states for better UX
			saveLoading: false,
			loadDraftsLoading: false,
			selectOrderLoading: false,
			selectPurchaseOrderLoading: false,
			cancelLoading: false,
			returnsLoading: false,
			printLoading: false,
			applyOffersLoading: false,
			paymentLoading: false,
			additionalDiscountDisplay: null,
			additionalDiscountPercentageDisplay: null,
			isEditingAdditionalDiscount: false,
			isEditingAdditionalDiscountPercentage: false,
		};
	},
	emits: [
		"update:additional_discount",
		"update:additional_discount_percentage",
		"update_discount_umount",
		"save-and-clear",
		"load-drafts",
		"select-order",
		"select-purchase-order",
		"cancel-sale",
		"open-returns",
		"print-draft",
		"apply-offers",
		"show-payment",
	],
	computed: {
		hide_qty_decimals() {
			const opts = loadItemSelectorSettings();
			return !!opts?.hide_qty_decimals;
		},
	},
	watch: {
		additional_discount(value) {
			if (!this.isEditingAdditionalDiscount) {
				this.additionalDiscountDisplay = this.normalizeDiscountDisplay(value);
			}
		},
		additional_discount_percentage(value) {
			if (!this.isEditingAdditionalDiscountPercentage) {
				this.additionalDiscountPercentageDisplay = this.normalizeDiscountDisplay(value);
			}
		},
	},
	created() {
		this.additionalDiscountDisplay = this.normalizeDiscountDisplay(this.additional_discount);
		this.additionalDiscountPercentageDisplay = this.normalizeDiscountDisplay(
			this.additional_discount_percentage,
		);
	},
	methods: {
		normalizeDiscountDisplay(value) {
			if (value === 0 || value === "0") {
				return "";
			}
			return value;
		},
		// Debounced handlers for better performance
		handleAdditionalDiscountUpdate(value) {
			this.$emit("update:additional_discount", value);
		},

		handleAdditionalDiscountFocus() {
			this.isEditingAdditionalDiscount = true;
		},

		handleAdditionalDiscountBlur() {
			this.isEditingAdditionalDiscount = false;
		},

		focusAdditionalDiscountField() {
			const field = this.$refs.additionalDiscountField;
			const input = field?.$el?.querySelector?.("input");
			if (input?.disabled) {
				return;
			}
			input?.focus?.();
		},

		handleAdditionalDiscountPercentageUpdate(value) {
			this.$emit("update:additional_discount_percentage", value);
		},

		handleAdditionalDiscountPercentageFocus() {
			this.isEditingAdditionalDiscountPercentage = true;
		},

		handleAdditionalDiscountPercentageBlur() {
			this.isEditingAdditionalDiscountPercentage = false;
		},

		async handleSaveAndClear() {
			this.saveLoading = true;
			try {
				await this.$emit("save-and-clear");
			} finally {
				this.saveLoading = false;
			}
		},

		async handleLoadDrafts() {
			this.loadDraftsLoading = true;
			try {
				await this.$emit("load-drafts");
			} finally {
				this.loadDraftsLoading = false;
			}
		},

		async handleSelectOrder() {
			this.selectOrderLoading = true;
			try {
				await this.$emit("select-order");
			} finally {
				this.selectOrderLoading = false;
			}
		},

		async handleSelectPurchaseOrder() {
			this.selectPurchaseOrderLoading = true;
			try {
				await this.$emit("select-purchase-order");
			} finally {
				this.selectPurchaseOrderLoading = false;
			}
		},

		async handleCancelSale() {
			this.cancelLoading = true;
			try {
				await this.$emit("cancel-sale");
			} finally {
				this.cancelLoading = false;
			}
		},

		async handleOpenReturns() {
			this.returnsLoading = true;
			try {
				await this.$emit("open-returns");
			} finally {
				this.returnsLoading = false;
			}
		},

		async handlePrintDraft() {
			this.printLoading = true;
			try {
				await this.$emit("print-draft");
			} finally {
				this.printLoading = false;
			}
		},

		async handleApplyOffers() {
			this.applyOffersLoading = true;
			try {
				await this.$emit("apply-offers");
			} finally {
				this.applyOffersLoading = false;
			}
		},

		async handleShowPayment() {
			this.paymentLoading = true;
			try {
				await this.$emit("show-payment");
			} finally {
				this.paymentLoading = false;
			}
		},
	},
};
</script>

<style scoped>
.cards {
	background-color: var(--pos-card-bg) !important;
	transition: all 0.3s ease;
}



/* Enhanced field styling */
.summary-field {
	transition: all 0.2s ease;
}

.summary-field:hover {
	transform: translateY(-1px);
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
	.summary-field {
		font-size: 0.875rem;
	}
}


</style>
