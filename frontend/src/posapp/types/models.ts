export interface Item {
  item_code: string;
  item_name: string;
  description?: string;
  stock_qty?: number;
  standard_rate?: number;
  image?: string;
  currency?: string;
  uom?: string;
  disabled?: number;
}

export interface CartItem extends Item {
  qty: number;
  rate: number;
  amount: number;
  posa_row_id?: string;
  discount_percentage?: number;
  discount_amount?: number;
  actual_qty?: number;
}

export interface POSProfile {
  name: string;
  company: string;
  currency: string;
  taxes_and_charges?: string;
  hide_expected_amount?: number;
  posa_cash_mode_of_payment?: string;
  [key: string]: any;
}

export interface InvoiceDoc {
  name?: string;
  doctype: string;
  owner?: string;
  docstatus?: number;
  customer?: string;
  posting_date?: string;
  posting_time?: string;
  items: CartItem[];
  payments: any[];
  taxes: any[];
  grand_total: number;
  base_grand_total?: number;
  outstanding_amount: number;
  pos_profile?: string;
  company?: string;
  [key: string]: any;
}
