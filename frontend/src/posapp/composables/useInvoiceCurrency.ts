
import { ref, computed } from "vue";
import { useInvoiceStore } from "../stores/invoiceStore";
import { useToastStore } from "../stores/toastStore";
// @ts-ignore
const __ = window.__ || ((s) => s);
// @ts-ignore
const frappe = window.frappe;

export function useInvoiceCurrency(props: any, context: any) {
    const invoiceStore = useInvoiceStore();
    const toastStore = useToastStore();

    const available_currencies = ref<any[]>([]);
    const selected_currency = ref("");
    const exchange_rate = ref(1);
    const conversion_rate = ref(1);
    const exchange_rate_date = ref(frappe.datetime.nowdate());
    const price_lists = ref<string[]>([]);
    const selected_price_list = ref("");
    const price_list_currency = ref("");

    const fetch_available_currencies = async (pos_profile: any) => {
        try {
            console.log("Fetching available currencies...");
            const r = await frappe.call({
                method: "posawesome.posawesome.api.invoices.get_available_currencies",
            });

            if (r.message) {
                console.log("Received currencies:", r.message);

                const baseCurrency = pos_profile.currency;

                available_currencies.value = r.message.map((currency: any) => ({
                    value: currency.name,
                    title: currency.name,
                }));

                available_currencies.value.sort((a, b) => {
                    if (a.value === baseCurrency) return -1;
                    if (b.value === baseCurrency) return 1;
                    return a.value.localeCompare(b.value);
                });

                if (!selected_currency.value) {
                    selected_currency.value = baseCurrency;
                }

                return available_currencies.value;
            }

            return [];
        } catch (error) {
            console.error("Error fetching currencies:", error);
            const defaultCurrency = pos_profile.currency;
            available_currencies.value = [
                {
                    value: defaultCurrency,
                    title: defaultCurrency,
                },
            ];
            selected_currency.value = defaultCurrency;
            return available_currencies.value;
        }
    };

    const formatDateForBackend = (dateStr: string) => {
        if (!dateStr) return "";
        // Implementation depends on how it was in Invoice.vue, often mixed in.
        // Assuming standard format or simple pass-through if already formatted.
        // If it's DD-MM-YYYY, convert to YYYY-MM-DD.
        // For now, let's assume it's available or use frappe.datetime
        return dateStr;
    };
    // Note: Invoice.vue used mixins: [format]. We might need to pass this helper or implementing it.
    // The original code used `this.formatDateForBackend`.

    const update_currency_and_rate = async (pos_profile: any, company: any) => {
        if (!selected_currency.value) return;

        const companyCurrency =
            (company && company.default_currency) || pos_profile.currency;
        const plCurrency = price_list_currency.value || companyCurrency;

        try {
            // Price list currency to selected currency rate
            if (selected_currency.value === plCurrency) {
                exchange_rate.value = 1;
            } else {
                const r = await frappe.call({
                    method: "posawesome.posawesome.api.invoices.fetch_exchange_rate_pair",
                    args: {
                        from_currency: plCurrency,
                        to_currency: selected_currency.value,
                    },
                });
                if (r && r.message) {
                    exchange_rate.value = r.message.exchange_rate;
                }
            }

            // Selected currency to company currency rate
            if (selected_currency.value === companyCurrency) {
                conversion_rate.value = 1;
                exchange_rate_date.value = frappe.datetime.get_today();
            } else {
                const r2 = await frappe.call({
                    method: "posawesome.posawesome.api.invoices.fetch_exchange_rate_pair",
                    args: {
                        from_currency: selected_currency.value,
                        to_currency: companyCurrency,
                    },
                });
                if (r2 && r2.message) {
                    conversion_rate.value = r2.message.exchange_rate;
                    exchange_rate_date.value = r2.message.date;
                }
            }
        } catch (error) {
            console.error("Error updating currency:", error);
            toastStore.show({
                title: "Error updating currency",
                color: "error",
            });
        }
    };

    const fetch_price_lists = async (pos_profile: any) => {
        if (pos_profile.posa_enable_price_list_dropdown) {
            try {
                const r = await frappe.call({
                    method: "posawesome.posawesome.api.utilities.get_selling_price_lists",
                });
                if (r && r.message) {
                    price_lists.value = r.message.map((pl: any) => pl.name);
                }
            } catch (error) {
                console.error("Failed fetching price lists", error);
                price_lists.value = [pos_profile.selling_price_list];
            }
        } else {
            // Fallback to the price list defined in the POS Profile
            price_lists.value = [pos_profile.selling_price_list];
        }

        if (!selected_price_list.value) {
            selected_price_list.value = pos_profile.selling_price_list;
        }

        // Fetch and store currency for the applied price list
        try {
            const r = await frappe.call({
                method: "posawesome.posawesome.api.invoices.get_price_list_currency",
                args: { price_list: selected_price_list.value },
            });
            if (r && r.message) {
                price_list_currency.value = r.message;
            }
        } catch (error) {
            console.error("Failed fetching price list currency", error);
        }

        return price_lists.value;
    };

    return {
        available_currencies,
        selected_currency,
        exchange_rate,
        conversion_rate,
        exchange_rate_date,
        price_lists,
        selected_price_list,
        price_list_currency,
        fetch_available_currencies,
        update_currency_and_rate,
        fetch_price_lists,
    };
}
