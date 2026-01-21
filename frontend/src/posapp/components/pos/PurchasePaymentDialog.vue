<template>
	<v-dialog v-model="dialog" max-width="600px" persistent>
		<v-card class="pos-themed-card">
			<v-card-title class="bg-primary text-white d-flex align-center">
				<span class="text-h6">{{ __("Make Payment") }}</span>
				<v-spacer></v-spacer>
				<span class="text-subtitle-1 font-weight-bold">
					{{ formatCurrency(totalAmount, currency) }}
				</span>
			</v-card-title>

			<v-card-text class="pa-4">
				<v-row dense class="mb-2">
					<v-col cols="12">
						<div class="d-flex justify-space-between mb-2">
							<span>{{ __("To Pay:") }}</span>
							<span class="font-weight-bold">{{ formatCurrency(amountToPay, currency) }}</span>
						</div>
						<div class="d-flex justify-space-between mb-4">
							<span :class="remainingAmount > 0 ? 'text-error' : 'text-success'">
								{{ remainingAmount > 0 ? __("Remaining:") : __("Change:") }}
							</span>
							<span
								class="font-weight-bold"
								:class="remainingAmount > 0 ? 'text-error' : 'text-success'"
							>
								{{ formatCurrency(Math.abs(remainingAmount), currency) }}
							</span>
						</div>
						<v-divider class="mb-4"></v-divider>
					</v-col>
				</v-row>

				<v-row dense v-for="(payment, index) in paymentLines" :key="index" class="align-center">
					<v-col cols="5">
						<v-text-field
							v-model="payment.mode_of_payment"
							readonly
							variant="solo"
							density="compact"
							hide-details
							class="pos-themed-input"
						></v-text-field>
					</v-col>
					<v-col cols="5">
						<v-text-field
							v-model.number="payment.amount"
							type="number"
							variant="outlined"
							density="compact"
							hide-details
							:prefix="currencySymbol(currency)"
							class="pos-themed-input"
							@focus="onFocusAmount(payment)"
						></v-text-field>
					</v-col>
					<v-col cols="2">
						<v-btn
							icon="mdi-check"
							size="small"
							variant="text"
							color="success"
							@click="fillRemaining(payment)"
							:title="__('Pay Remaining')"
						></v-btn>
					</v-col>
				</v-row>
			</v-card-text>

			<v-card-actions class="pa-4 border-t">
				<v-btn color="error" variant="text" @click="close">
					{{ __("Cancel") }}
				</v-btn>
				<v-spacer></v-spacer>
				<v-btn color="success" variant="elevated" @click="submit" :disabled="remainingAmount > 0.01">
					{{ __("Submit Payment") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script>
/* global __ */
import format, { formatUtils } from "../../format";

export default {
	name: "PurchasePaymentDialog",
	mixins: [format],
	props: {
		modelValue: Boolean,
		totalAmount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			default: "",
		},
		posProfile: {
			type: Object,
			required: true,
		},
	},
	emits: ["update:modelValue", "submit"],
	data() {
		return {
			paymentLines: [],
		};
	},
	computed: {
		dialog: {
			get() {
				return this.modelValue;
			},
			set(val) {
				this.$emit("update:modelValue", val);
			},
		},
		paidAmount() {
			return this.paymentLines.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
		},
		amountToPay() {
			return this.totalAmount;
		},
		remainingAmount() {
			return this.amountToPay - this.paidAmount;
		},
	},
	watch: {
		dialog(val) {
			if (val) {
				this.initializePayments();
			}
		},
	},
	methods: {
		initializePayments() {
			const modes = this.posProfile.payments || [];
			this.paymentLines = modes.map((m) => ({
				mode_of_payment: m.mode_of_payment,
				amount: 0,
				default: m.default,
			}));

			// Auto-fill default payment method if exists
			const defaultMode = this.paymentLines.find((p) => p.default) || this.paymentLines[0];
			if (defaultMode) {
				defaultMode.amount = this.totalAmount;
			}
		},
		fillRemaining(payment) {
			const currentOther = this.paymentLines
				.filter((p) => p !== payment)
				.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
			payment.amount = Math.max(0, this.totalAmount - currentOther);
		},
		onFocusAmount(payment) {
			if (payment.amount === 0) {
				this.fillRemaining(payment);
			}
		},
		currencySymbol(currency) {
			// Basic fallback if format mixin doesn't cover it or isn't loaded yet
			return currency || "";
		},
		close() {
			this.dialog = false;
		},
		submit() {
			const payments = this.paymentLines
				.filter((p) => p.amount > 0)
				.map((p) => ({
					mode_of_payment: p.mode_of_payment,
					amount: p.amount,
				}));
			this.$emit("submit", payments);
			this.dialog = false;
		},
	},
};
</script>

<style scoped>
.pos-themed-card {
	border-radius: 12px;
}
</style>
