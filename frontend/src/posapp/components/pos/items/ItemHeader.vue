<template>
	<div class="sticky-header">
		<div class="sticky-header__intro">
			<div class="sticky-header__copy">
				<span class="sticky-header__eyebrow">{{ __("Fast lookup") }}</span>
				<strong class="sticky-header__title">{{ __("Search, scan, or browse items") }}</strong>
			</div>
			<div class="sticky-header__badges">
				<span class="sticky-header__badge">{{ __("Barcode") }}</span>
				<span class="sticky-header__badge">{{ __("Code") }}</span>
				<span class="sticky-header__badge">{{ __("Name") }}</span>
			</div>
		</div>
		<v-row class="items">
			<v-col
				class="pb-0"
				cols="12"
				:md="posProfile.posa_input_qty ? 9 : 12"
			>
				<v-text-field
					density="compact"
					clearable
					autofocus
					variant="solo"
					color="primary"
					:label="frappe._('Search Items')"
					:placeholder="frappe._('Barcode, item code, name, brand, or SKU')"
					hide-details
					:model-value="searchInput"
					@update:model-value="
						(val) => {
							$emit('update:searchInput', val);
							$emit('search-input', val);
						}
					"
					@keydown.esc="$emit('esc')"
					@keydown.enter="$emit('enter')"
					@keydown="$emit('search-keydown', $event)"
					@click:clear="$emit('clear-search')"
					@click:prepend-inner="$emit('focus')"
					@paste="$emit('search-paste', $event)"
					prepend-inner-icon="mdi-magnify"
					@focus="$emit('focus')"
					ref="debounce_search"
				>
					<template v-slot:append-inner>
						<v-btn
							v-if="posProfile.posa_enable_camera_scanning"
							icon="mdi-camera"
							size="small"
							color="primary"
							variant="text"
							:disabled="scannerLocked"
							@click="$emit('start-camera')"
							:title="
								scannerLocked
									? __('Acknowledge the error to resume scanning')
									: __('Scan with Camera')
							"
						>
						</v-btn>
					</template>
				</v-text-field>
			</v-col>
			<v-col cols="12" md="3" class="pb-0" v-if="posProfile.posa_input_qty">
				<v-text-field
					density="compact"
					variant="solo"
					color="primary"
					:label="frappe._('QTY')"
					hide-details
					:model-value="qtyInput"
					@update:model-value="$emit('update:qtyInput', $event)"
					type="text"
					inputmode="decimal"
					@keydown.enter="$emit('enter')"
					@keydown.esc="$emit('esc')"
					@focus="$emit('clear-qty')"
					@click="$emit('clear-qty')"
					@blur="$emit('blur-qty')"
				></v-text-field>
			</v-col>
			<v-col cols="12" class="dynamic-margin-xs">
				<div class="settings-container">
					<v-btn
						v-if="context === 'purchase'"
						density="compact"
						variant="text"
						color="primary"
						prepend-icon="mdi-plus"
						@click="$emit('open-new-item')"
						class="settings-btn"
					>
						{{ __("New Item") }}
					</v-btn>
					<v-btn
						density="compact"
						variant="text"
						color="primary"
						prepend-icon="mdi-cog-outline"
						@click="$emit('toggle-settings')"
						class="settings-btn"
					>
						{{ __("Settings") }}
					</v-btn>
					<v-spacer></v-spacer>
					<span
						v-if="syncStatus"
						class="text-caption text-info font-weight-bold sync-status-label mx-2"
					>
						{{ syncStatus }}
					</span>
					<span
						v-if="enableBackgroundSync && !syncStatus"
						class="text-caption text-medium-emphasis last-sync-label"
					>
						{{ __("Last sync:") }} {{ lastSyncTime }}
					</span>
					<v-spacer></v-spacer>
					<v-btn
						density="compact"
						variant="text"
						color="primary"
						prepend-icon="mdi-refresh"
						@click="$emit('reload-items')"
						class="settings-btn"
					>
						{{ __("Reload Items") }}
					</v-btn>
				</div>
			</v-col>
		</v-row>
	</div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
	searchInput: { type: String, default: "" },
	qtyInput: { type: [String, Number], default: 1 },
	posProfile: { type: Object, required: true },
	scannerLocked: { type: Boolean, default: false },
	enableBackgroundSync: { type: Boolean, default: false },
	lastSyncTime: { type: String, default: "" },
	syncStatus: { type: String, default: "" },
	context: { type: String, default: "pos" },
});

defineEmits([
	"update:searchInput",
	"update:qtyInput",
	"esc",
	"enter",
	"search-keydown",
	"clear-search",
	"search-input",
	"search-paste",
	"focus",
	"clear-qty",
	"blur-qty",
	"start-camera",
	"open-new-item",
	"toggle-settings",
	"reload-items",
]);

const debounce_search = ref(null);

defineExpose({
	debounce_search,
});
</script>

<style scoped>
.sticky-header {
	position: sticky;
	top: 0;
	z-index: 5;
	background: rgb(var(--v-theme-surface));
	padding: 12px 12px 0 12px;
	border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
	margin-bottom: 0;
}

.sticky-header__intro {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding-bottom: 10px;
}

.sticky-header__copy {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.sticky-header__eyebrow {
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--pos-text-secondary);
}

.sticky-header__title {
	font-size: 0.96rem;
	line-height: 1.3;
	color: var(--pos-text-primary);
}

.sticky-header__badges {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 6px;
}

.sticky-header__badge {
	display: inline-flex;
	align-items: center;
	min-height: 28px;
	padding: 4px 10px;
	border-radius: 999px;
	background: rgba(var(--v-theme-primary), 0.08);
	color: rgb(var(--v-theme-primary));
	font-size: 0.75rem;
	font-weight: 700;
}

.items {
	margin: 0;
}

.settings-container {
	display: flex;
	align-items: center;
	padding: 4px 0;
}

.settings-btn {
	text-transform: none !important;
	letter-spacing: normal !important;
	font-weight: 500 !important;
	background-color: transparent !important;
	min-height: 40px !important;
}

.last-sync-label {
	white-space: nowrap;
	font-size: 0.75rem;
}

.dynamic-margin-xs {
	margin-top: 4px;
}

:deep(.sticky-header .v-field) {
	border-radius: 16px;
}

@media (max-width: 768px) {
	.sticky-header {
		padding: 12px 12px 2px;
	}

	.sticky-header__intro {
		flex-direction: column;
		align-items: stretch;
	}

	.sticky-header__badges {
		justify-content: flex-start;
	}

	.settings-container {
		flex-wrap: wrap;
		gap: 6px;
	}
}
</style>
