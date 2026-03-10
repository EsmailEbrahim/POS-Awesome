<template>
	<div
		class="pos-main-container dynamic-container"
		:class="rtlClasses"
		:style="[responsiveStyles, rtlStyles]"
	>
		<Drafts></Drafts>
		<InvoiceManagement></InvoiceManagement>
		<SalesOrders></SalesOrders>
		<Returns></Returns>
		<NewAddress></NewAddress>
		<MpesaPayments></MpesaPayments>
		<Variants></Variants>
		<OpeningDialog
			v-if="dialog"
			:dialog="dialog"
			@close="closeOpeningDialog"
			@register="handleRegisterPosData"
		></OpeningDialog>
		<v-dialog
			v-if="usePaymentDialog"
			v-model="paymentDialogOpen"
			:retain-focus="false"
			width="96vw"
			max-width="1480"
			scrim="rgba(15, 23, 42, 0.55)"
			class="payment-dialog"
			@update:model-value="handlePaymentDialogUpdate"
		>
			<Payments dialog-mode />
		</v-dialog>
		<div v-if="showMobileHeader" class="mobile-pos-header pos-themed-card">
			<div class="mobile-pos-header__copy">
				<span class="mobile-pos-header__eyebrow">{{ __("Active sale") }}</span>
				<strong class="mobile-pos-header__amount">{{ formattedCartTotal }}</strong>
				<span class="mobile-pos-header__meta">
					{{ cartMetaLabel }}
				</span>
			</div>
			<div class="mobile-pos-header__actions">
				<v-btn
					variant="tonal"
					color="primary"
					class="mobile-pos-header__btn"
					prepend-icon="mdi-receipt-text-outline"
					@click="showInvoicePanel"
				>
					{{ __("Cart") }}
				</v-btn>
				<v-btn
					variant="flat"
					color="success"
					class="mobile-pos-header__btn"
					prepend-icon="mdi-credit-card-outline"
					@click="showPaymentPanel"
				>
					{{ __("Pay") }}
				</v-btn>
			</div>
		</div>
		<div v-if="!dialog && showCompactHeaderSwitcher" class="compact-pos-switcher">
			<v-btn-toggle
				:model-value="compactPanel"
				mandatory
				divided
				class="compact-pos-switcher__toggle pos-themed-card"
			>
				<v-btn
					value="selector"
					class="compact-pos-switcher__btn"
					prepend-icon="mdi-view-grid-outline"
					@click="setCompactPanel('selector')"
				>
					{{ __("Item Selector") }}
				</v-btn>
				<v-btn
					value="invoice"
					class="compact-pos-switcher__btn"
					prepend-icon="mdi-receipt-text-outline"
					@click="setCompactPanel('invoice')"
				>
					{{ __("Invoice") }}
				</v-btn>
			</v-btn-toggle>
		</div>
		<v-row
			v-show="!dialog"
			dense
			class="ma-0 dynamic-main-row"
			:class="{ 'dynamic-main-row--phone': isPhone }"
		>
			<v-col
				v-show="(!useCompactPosSwitcher || compactPanel === 'selector') && activeView === 'items'"
				:xl="useCompactPosSwitcher ? 12 : 5"
				:lg="useCompactPosSwitcher ? 12 : 5"
				:md="useCompactPosSwitcher ? 12 : 5"
				:sm="useCompactPosSwitcher ? 12 : 5"
				cols="12"
				class="pos dynamic-col dynamic-col--selector"
			>
				<ItemsSelector context="pos" />
			</v-col>
			<v-col
				v-show="(!useCompactPosSwitcher || compactPanel === 'selector') && activeView === 'offers'"
				:xl="useCompactPosSwitcher ? 12 : 5"
				:lg="useCompactPosSwitcher ? 12 : 5"
				:md="useCompactPosSwitcher ? 12 : 5"
				:sm="useCompactPosSwitcher ? 12 : 5"
				cols="12"
				class="pos dynamic-col dynamic-col--selector"
			>
				<PosOffers></PosOffers>
			</v-col>
			<v-col
				v-show="(!useCompactPosSwitcher || compactPanel === 'selector') && activeView === 'coupons'"
				:xl="useCompactPosSwitcher ? 12 : 5"
				:lg="useCompactPosSwitcher ? 12 : 5"
				:md="useCompactPosSwitcher ? 12 : 5"
				:sm="useCompactPosSwitcher ? 12 : 5"
				cols="12"
				class="pos dynamic-col dynamic-col--selector"
			>
				<PosCoupons></PosCoupons>
			</v-col>
			<v-col
				v-show="(!useCompactPosSwitcher || compactPanel === 'selector') && activeView === 'payment' && !usePaymentDialog"
				:xl="useCompactPosSwitcher ? 12 : 5"
				:lg="useCompactPosSwitcher ? 12 : 5"
				:md="useCompactPosSwitcher ? 12 : 5"
				:sm="useCompactPosSwitcher ? 12 : 5"
				cols="12"
				class="pos dynamic-col dynamic-col--selector"
			>
				<Payments></Payments>
			</v-col>

			<v-col
				v-show="!useCompactPosSwitcher || compactPanel === 'invoice'"
				:xl="useCompactPosSwitcher ? 12 : 7"
				:lg="useCompactPosSwitcher ? 12 : 7"
				:md="useCompactPosSwitcher ? 12 : 7"
				:sm="useCompactPosSwitcher ? 12 : 7"
				cols="12"
				class="pos dynamic-col dynamic-col--invoice"
			>
				<Invoice></Invoice>
			</v-col>
		</v-row>
		<div v-if="showMobileDock" class="mobile-pos-dock">
			<button
				type="button"
				class="mobile-pos-dock__item"
				:class="{ 'mobile-pos-dock__item--active': isSelectorViewActive('items') }"
				@click="setSelectorView('items')"
			>
				<v-icon icon="mdi-magnify" size="20" />
				<span>{{ __("Browse") }}</span>
			</button>
			<button
				type="button"
				class="mobile-pos-dock__item"
				:class="{ 'mobile-pos-dock__item--active': activeView === 'offers' }"
				@click="setSelectorView('offers')"
			>
				<v-icon icon="mdi-tag-outline" size="20" />
				<span>{{ __("Offers") }}</span>
			</button>
			<button
				type="button"
				class="mobile-pos-dock__item mobile-pos-dock__item--cart"
				:class="{ 'mobile-pos-dock__item--active': compactPanel === 'invoice' }"
				@click="showInvoicePanel"
			>
				<span class="mobile-pos-dock__pill">{{ itemsCount }}</span>
				<v-icon icon="mdi-cart-outline" size="22" />
				<span>{{ __("Cart") }}</span>
			</button>
			<button
				type="button"
				class="mobile-pos-dock__item"
				:class="{ 'mobile-pos-dock__item--active': activeView === 'coupons' }"
				@click="setSelectorView('coupons')"
			>
				<v-icon icon="mdi-ticket-percent-outline" size="20" />
				<span>{{ __("Coupons") }}</span>
			</button>
			<button
				type="button"
				class="mobile-pos-dock__item mobile-pos-dock__item--pay"
				:class="{ 'mobile-pos-dock__item--active': activeView === 'payment' }"
				@click="showPaymentPanel"
			>
				<v-icon icon="mdi-credit-card-outline" size="20" />
				<span>{{ __("Pay") }}</span>
			</button>
		</div>
	</div>
</template>

<script>
import ItemsSelector from "../items/ItemsSelector.vue";
import Invoice from "../Invoice.vue";
import OpeningDialog from "../shift/OpeningDialog.vue";
import Payments from "../Payments.vue";
import PosOffers from "../offers/PosOffers.vue";
import PosCoupons from "../offers/PosCoupons.vue";
import Drafts from "../flows/Drafts.vue";
import InvoiceManagement from "../flows/InvoiceManagement.vue";
import SalesOrders from "../flows/SalesOrders.vue";
import NewAddress from "../customer/NewAddress.vue";
import Variants from "../items/Variants.vue";
import Returns from "../flows/Returns.vue";
import MpesaPayments from "../payments/Mpesa-Payments.vue";
import { inject, ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from "vue";
import { usePosShift } from "../../../composables/pos/shared/usePosShift";
import { useOffers } from "../../../composables/pos/shared/useOffers";
// Import the cache cleanup function
import { clearExpiredCustomerBalances } from "../../../../offline/index";
import { useResponsive } from "../../../composables/core/useResponsive";
import { useRtl } from "../../../composables/core/useRtl";
import { useCustomersStore } from "../../../stores/customersStore.js";
import { useUIStore } from "../../../stores/uiStore.js";
import { useInvoiceStore } from "../../../stores/invoiceStore.js";
import { useItemsStore } from "../../../stores/itemsStore.js";
import { storeToRefs } from "pinia";
import { useCustomerDisplayPublisher } from "../../../composables/pos/shared/useCustomerDisplayPublisher";

export default {
	setup() {
		const eventBus = inject("eventBus");
		const dialog = ref(false);
		const responsive = useResponsive();
		const rtl = useRtl();
		const shift = usePosShift(() => {
			dialog.value = true;
		});
		const offers = useOffers();
		const uiStore = useUIStore();
		const invoiceStore = useInvoiceStore();
		const itemsStore = useItemsStore();
		const __ = window.__;
		const { activeView, posProfile, paymentDialogOpen } = storeToRefs(uiStore);
		const { invoiceDoc, itemsCount, totalQty, grossTotal } = storeToRefs(invoiceStore);
		const usePaymentDialog = computed(() => responsive.windowWidth.value >= 992);
		const useCompactPosSwitcher = computed(() => responsive.windowWidth.value < 1280);
		const compactPanel = ref("selector");
		const isPhone = computed(() => responsive.isPhone.value);
		const showCompactHeaderSwitcher = computed(
			() => !dialog.value && useCompactPosSwitcher.value && !isPhone.value,
		);
		const showMobileDock = computed(() => !dialog.value && isPhone.value);
		const showMobileHeader = computed(
			() =>
				!dialog.value &&
				isPhone.value &&
				(activeView.value === "items" ||
					activeView.value === "offers" ||
					activeView.value === "coupons" ||
					compactPanel.value === "invoice"),
		);
		const invoiceTotal = computed(() => {
			const doc = invoiceDoc.value || {};
			const fallbackTotal = Number(grossTotal.value || 0);
			const rawValue = doc.rounded_total ?? doc.grand_total ?? doc.total ?? fallbackTotal;
			const numericValue = Number(rawValue);
			return Number.isFinite(numericValue) ? numericValue : fallbackTotal;
		});
		const activeCurrency = computed(
			() => invoiceDoc.value?.currency || posProfile.value?.currency || "",
		);
		const formatCompactNumber = (value) =>
			new Intl.NumberFormat(undefined, {
				maximumFractionDigits: value % 1 === 0 ? 0 : 2,
			}).format(Number(value || 0));
		const getCurrencySymbol = (currency) => {
			const resolver =
				window.get_currency_symbol || globalThis.get_currency_symbol;
			if (typeof resolver === "function") {
				return resolver(currency || activeCurrency.value || "") || "";
			}
			return currency ? `${currency} ` : "";
		};
		const formattedCartTotal = computed(() => {
			const symbol = getCurrencySymbol(activeCurrency.value);
			return `${symbol}${formatCompactNumber(invoiceTotal.value)}`.trim();
		});
		const cartMetaLabel = computed(() => {
			const qty = formatCompactNumber(totalQty.value || 0);
			const itemCount = formatCompactNumber(itemsCount.value || 0);
			return `${itemCount} ${__("lines")} • ${qty} ${__("qty")}`;
		});

		const handlePaymentDialogUpdate = (value) => {
			if (value || !usePaymentDialog.value) {
				return;
			}
			uiStore.closePaymentDialog();
			nextTick(() => {
				uiStore.triggerItemSearchFocus();
			});
		};

		const setCompactPanel = (panel) => {
			compactPanel.value = panel;
			if (panel === "selector" && activeView.value === "items") {
				nextTick(() => {
					uiStore.triggerItemSearchFocus();
				});
			}
		};
		const setSelectorView = (view) => {
			compactPanel.value = "selector";
			uiStore.setActiveView(view);
			if (view === "items") {
				nextTick(() => {
					uiStore.triggerItemSearchFocus();
				});
			}
		};
		const showInvoicePanel = () => {
			compactPanel.value = "invoice";
			if (activeView.value === "payment" && !usePaymentDialog.value) {
				uiStore.setActiveView("items");
			}
		};
		const showPaymentPanel = () => {
			compactPanel.value = "selector";
			if (usePaymentDialog.value) {
				uiStore.openPaymentDialog();
				uiStore.setActiveView("items");
				return;
			}
			uiStore.setActiveView("payment");
		};
		const isSelectorViewActive = (view) =>
			compactPanel.value === "selector" && activeView.value === view;

		useCustomerDisplayPublisher({
			posProfile,
			eventBus,
		});

		onMounted(() => {
			if (eventBus) {
				eventBus.on("submit_closing_pos", (data) => {
					shift.submit_closing_pos(data);
				});
			}
		});

		onBeforeUnmount(() => {
			if (eventBus) {
				eventBus.off("submit_closing_pos");
			}
		});

		watch(usePaymentDialog, (enabled) => {
			if (enabled && activeView.value === "payment") {
				uiStore.openPaymentDialog();
				uiStore.setActiveView("items");
				return;
			}

			if (!enabled && paymentDialogOpen.value) {
				uiStore.closePaymentDialog();
				uiStore.setActiveView("payment");
			}
		});

		watch(activeView, (view) => {
			if (!useCompactPosSwitcher.value) {
				return;
			}

			if (["items", "offers", "coupons", "payment"].includes(view)) {
				compactPanel.value = "selector";
			}
		});

		watch(useCompactPosSwitcher, (enabled) => {
			if (!enabled) {
				compactPanel.value = "selector";
				return;
			}

			if (["offers", "coupons", "payment"].includes(activeView.value)) {
				compactPanel.value = "selector";
			}
		});

		return {
			...responsive,
			...rtl,
			...shift,
			...offers,
			uiStore,
			invoiceStore,
			itemsStore,
			__,
			invoiceDoc,
			itemsCount,
			totalQty,
			formattedCartTotal,
			cartMetaLabel,
			activeView,
			paymentDialogOpen,
			isPhone,
			usePaymentDialog,
			useCompactPosSwitcher,
			showCompactHeaderSwitcher,
			showMobileDock,
			showMobileHeader,
			compactPanel,
			setCompactPanel,
			setSelectorView,
			showInvoicePanel,
			showPaymentPanel,
			isSelectorViewActive,
			handlePaymentDialogUpdate,
			eventBus,
			dialog,
		};
	},
	data: function () {
		return {
			// dialog moved to setup ref
			itemsLoaded: false,
			customersLoaded: false,
		};
	},

	components: {
		ItemsSelector,
		Invoice,
		OpeningDialog,
		Payments,
		Drafts,
		InvoiceManagement,

		Returns,
		PosOffers,
		PosCoupons,
		NewAddress,
		Variants,
		MpesaPayments,
		SalesOrders,
	},

	methods: {
		create_opening_voucher() {
			this.dialog = true;
		},
		get_pos_setting() {
			frappe.db.get_doc("POS Settings", undefined).then((_doc) => {
				// Update store directly instead of emitting event
				// If Payments.vue or others need this, they should watch uiStore.posSettings
				// For now, we assume uiStore.setStockSettings or similar is sufficient,
				// or we add a new generic settings store.
				// However, the original code used eventBus.emit("set_pos_settings", doc);
				// We'll attach it to uiStore if a suitable method exists, or just log for now as
				// clean separation implies components fetch what they need or use a centralized config store.
				// Assuming uiStore handles global config:
				// this.uiStore.setPosSettings(doc); // We might need to implement this if it doesn't exist
			});
		},
		checkLoadingComplete() {
			if (this.itemsLoaded && this.customersLoaded) {
				// Loading complete logic
			}
		},
		// handleAddItem removed as ItemsSelector handles pos addition internally
		handleRegisterPosData(data) {
			this.pos_profile = data.pos_profile;
			this.get_offers(this.pos_profile.name, this.pos_profile);
			this.pos_opening_shift = data.pos_opening_shift;

			// Update Store
			this.uiStore.setRegisterData(data);
		},
		closeOpeningDialog() {
			this.dialog = false;
		},
	},

	mounted: function () {
		this.$nextTick(function () {
			this.check_opening_entry();
			this.get_pos_setting();

			// Watch store for updates
			this.$watch(
				() => this.uiStore.posProfile,
				async (newProfile) => {
					if (newProfile && newProfile.name) {
						this.pos_profile = newProfile;
						this.get_offers(newProfile.name, newProfile);

						// Initialize Customers Store
						const customersStore = useCustomersStore();
						customersStore.setPosProfile(newProfile);
						await customersStore.get_customer_names();
					}
				},
				{ deep: true, immediate: true },
			);

			// Items loading state check
			const { itemsLoaded } = storeToRefs(this.itemsStore);
			this.$watch(
				() => itemsLoaded.value,
				(val) => {
					if (val) {
						this.itemsLoaded = true;
						this.checkLoadingComplete();
					}
				},
				{ immediate: true },
			);
		});
	},
	// In the created() or mounted() lifecycle hook
	created() {
		// Clean up expired customer balance cache on POS load
		clearExpiredCustomerBalances();
		const customersStore = useCustomersStore();
		const { customersLoaded } = storeToRefs(customersStore);
		this.$watch(
			() => customersLoaded.value,
			(value) => {
				if (value) {
					this.customersLoaded = true;
					this.checkLoadingComplete();
				}
			},
			{ immediate: true },
		);
	},
};
</script>

<style scoped>
.payment-dialog :deep(.v-overlay__content) {
	max-height: calc(100vh - 24px);
}

.compact-pos-switcher {
	padding: 0 var(--dynamic-sm);
	margin-top: var(--dynamic-sm);
}

.compact-pos-switcher__toggle {
	display: grid !important;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	width: 100%;
	padding: 4px;
	border-radius: 18px;
	background: var(--pos-card-bg) !important;
	border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
	box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}

.compact-pos-switcher__btn {
	min-height: 44px;
	text-transform: none !important;
	letter-spacing: 0 !important;
	font-weight: 600 !important;
}

.compact-pos-switcher__toggle :deep(.v-btn--active) {
	background: rgba(var(--v-theme-primary), 0.12) !important;
	color: rgb(var(--v-theme-primary)) !important;
}

.dynamic-container {
	transition: all 0.3s ease;
	padding-bottom: calc(var(--bottom-safe-space) + var(--dynamic-sm));
}

.dynamic-main-row {
	padding: 0;
	margin: 0;
}

.dynamic-main-row--phone {
	align-items: stretch;
}

.dynamic-col {
	padding: var(--dynamic-sm);
	transition: padding 0.3s ease;
	margin-top: var(--dynamic-sm);
}

.dynamic-col--selector,
.dynamic-col--invoice {
	display: flex;
	flex-direction: column;
}

.mobile-pos-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--pos-space-3);
	margin: var(--dynamic-sm) var(--dynamic-sm) 0;
	padding: 14px 16px;
	border-radius: 20px;
	background:
		linear-gradient(135deg, rgba(var(--v-theme-primary), 0.12), rgba(var(--v-theme-surface), 0.98)),
		var(--pos-card-bg);
	position: sticky;
	top: var(--dynamic-sm);
	z-index: 12;
}

.mobile-pos-header__copy {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.mobile-pos-header__eyebrow {
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--pos-text-secondary);
}

.mobile-pos-header__amount {
	font-size: 1.3rem;
	line-height: 1.15;
	color: var(--pos-text-primary);
}

.mobile-pos-header__meta {
	font-size: 0.82rem;
	color: var(--pos-text-secondary);
}

.mobile-pos-header__actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.mobile-pos-header__btn {
	min-height: 42px;
	text-transform: none !important;
	letter-spacing: 0 !important;
	font-weight: 700 !important;
}

.mobile-pos-dock {
	position: fixed;
	left: max(10px, env(safe-area-inset-left));
	right: max(10px, env(safe-area-inset-right));
	bottom: max(10px, env(safe-area-inset-bottom));
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 8px;
	padding: 10px;
	border-radius: 24px;
	background: rgba(255, 255, 255, 0.94);
	backdrop-filter: blur(18px);
	box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
	border: 1px solid rgba(15, 23, 42, 0.08);
	z-index: 20;
}

.mobile-pos-dock__item {
	position: relative;
	border: 0;
	border-radius: 18px;
	background: transparent;
	min-height: 58px;
	padding: 8px 4px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	font: inherit;
	font-size: 0.72rem;
	font-weight: 700;
	color: var(--pos-text-secondary);
	cursor: pointer;
	transition:
		background-color 0.18s ease,
		color 0.18s ease,
		transform 0.18s ease;
}

.mobile-pos-dock__item--active {
	background: rgba(var(--v-theme-primary), 0.12);
	color: rgb(var(--v-theme-primary));
}

.mobile-pos-dock__item--pay.mobile-pos-dock__item--active {
	background: rgba(var(--v-theme-success), 0.16);
	color: rgb(var(--v-theme-success));
}

.mobile-pos-dock__item:active {
	transform: scale(0.98);
}

.mobile-pos-dock__pill {
	position: absolute;
	top: 4px;
	right: 10px;
	min-width: 18px;
	height: 18px;
	padding: 0 5px;
	border-radius: 999px;
	background: rgb(var(--v-theme-primary));
	color: #fff;
	font-size: 0.68rem;
	line-height: 18px;
	text-align: center;
}

@media (max-width: 768px) {
	.dynamic-container {
		padding-top: var(--dynamic-xs);
		padding-bottom: calc(var(--bottom-safe-space) + var(--dynamic-xs));
	}

	.dynamic-col {
		padding: var(--dynamic-xs);
		margin-top: var(--dynamic-xs);
	}

	.mobile-pos-header {
		margin: var(--dynamic-xs) var(--dynamic-xs) 0;
		padding: 12px;
		gap: 10px;
	}

	.mobile-pos-header__actions {
		flex-direction: column;
		align-items: stretch;
	}

	.mobile-pos-header__btn {
		min-width: 96px;
	}
}

@media (max-width: 560px) {
	.mobile-pos-header {
		flex-direction: column;
		align-items: stretch;
	}

	.mobile-pos-header__actions {
		flex-direction: row;
	}

	.mobile-pos-dock {
		gap: 6px;
		padding: 8px;
	}

	.mobile-pos-dock__item {
		min-height: 54px;
		font-size: 0.68rem;
	}
}
</style>
