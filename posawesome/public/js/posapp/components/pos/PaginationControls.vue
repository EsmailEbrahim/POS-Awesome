<template>
    <div class="pagination-controls" v-if="totalPages > 1">
        <v-row align="center" justify="center" class="py-2">
            <v-col cols="auto">
                <v-btn icon size="small" :disabled="currentPage === 1" @click="goToPage(1)" title="First Page">
                    <v-icon>mdi-page-first</v-icon>
                </v-btn>
            </v-col>

            <v-col cols="auto">
                <v-btn icon size="small" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)"
                    title="Previous Page">
                    <v-icon>mdi-chevron-left</v-icon>
                </v-btn>
            </v-col>

            <v-col cols="auto">
                <div class="pagination-info text-caption">
                    <span class="text-primary font-weight-medium">
                        {{ __("Page") }} {{ currentPage }} {{ __("of") }} {{ totalPages }}
                    </span>
                    <br>
                    <span class="text-grey">
                        {{ __("Showing") }} {{ startItem }}-{{ endItem }} {{ __("of") }} {{ totalItems }}
                    </span>
                </div>
            </v-col>

            <v-col cols="auto">
                <v-btn icon size="small" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)"
                    title="Next Page">
                    <v-icon>mdi-chevron-right</v-icon>
                </v-btn>
            </v-col>

            <v-col cols="auto">
                <v-btn icon size="small" :disabled="currentPage === totalPages" @click="goToPage(totalPages)"
                    title="Last Page">
                    <v-icon>mdi-page-last</v-icon>
                </v-btn>
            </v-col>

            <v-col cols="auto" v-if="showPageSizeSelector">
                <v-select :items="pageSizeOptions" v-model="selectedPageSize" density="compact" variant="outlined"
                    hide-details :label="__('Per Page')" style="min-width: 100px;"
                    @update:modelValue="changePageSize"></v-select>
            </v-col>
            
            <!-- Page number buttons for smaller page counts -->
            <v-col v-if="totalPages <= 10" cols="auto" v-for="page in totalPages" :key="page">
                <v-btn size="small" :variant="currentPage === page ? 'elevated' : 'text'"
                    :color="currentPage === page ? 'primary' : 'default'" @click="goToPage(page)" min-width="32">
                    {{ page }}
                </v-btn>
            </v-col>
    
            <!-- Page range selector for larger page counts -->
            <v-col v-else cols="auto">
                <v-text-field v-model.number="pageInput" density="compact" variant="outlined" hide-details
                    :label="__('Go to page')" type="number" :min="1" :max="totalPages" style="max-width: 120px;"
                    @keydown.enter="goToInputPage" @blur="goToInputPage"></v-text-field>
            </v-col>
        </v-row>
    </div>
</template>

<script>
export default {
    name: 'PaginationControls',

    props: {
        currentPage: {
            type: Number,
            required: true,
            default: 1
        },
        totalPages: {
            type: Number,
            required: true,
            default: 1
        },
        totalItems: {
            type: Number,
            required: true,
            default: 0
        },
        itemsPerPage: {
            type: Number,
            required: true,
            default: 50
        },
        showPageSizeSelector: {
            type: Boolean,
            default: true
        },
        pageSizeOptions: {
            type: Array,
            default: () => [10, 25, 50, 100, 200]
        }
    },

    data() {
        return {
            pageInput: this.currentPage,
            selectedPageSize: this.itemsPerPage
        };
    },

    computed: {
        startItem() {
            if (this.totalItems === 0) return 0;
            return (this.currentPage - 1) * this.itemsPerPage + 1;
        },

        endItem() {
            const end = this.currentPage * this.itemsPerPage;
            return Math.min(end, this.totalItems);
        }
    },

    watch: {
        currentPage(newVal) {
            this.pageInput = newVal;
        },

        itemsPerPage(newVal) {
            this.selectedPageSize = newVal;
        }
    },

    methods: {
        goToPage(page) {
            if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
                this.$emit('page-changed', page);
            }
        },

        goToInputPage() {
            const page = parseInt(this.pageInput);
            if (!isNaN(page) && page >= 1 && page <= this.totalPages) {
                this.goToPage(page);
            } else {
                // Reset to current page if invalid input
                this.pageInput = this.currentPage;
            }
        },

        changePageSize(newSize) {
            if (newSize !== this.itemsPerPage) {
                this.$emit('page-size-changed', newSize);
            }
        }
    }
};
</script>

<style scoped>
.pagination-controls {
    border-top: 1px solid #e0e0e0;
    background-color: #fafafa;
}

.pagination-info {
    text-align: center;
    min-width: 120px;
}

.v-btn {
    margin: 0 2px;
}

@media (max-width: 600px) {
    .pagination-controls .v-row {
        flex-wrap: wrap;
    }

    .pagination-info {
        min-width: 100px;
        font-size: 0.75rem;
    }
}
</style>
