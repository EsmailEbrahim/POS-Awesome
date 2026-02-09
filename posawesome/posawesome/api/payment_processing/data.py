import frappe
from frappe import _
from frappe.utils import nowdate, getdate, flt
from erpnext.accounts.party import get_party_account

@frappe.whitelist()
def get_outstanding_invoices(customer=None, company=None, currency=None, pos_profile=None,
                             include_all_currencies=False):
    """
    Fetch outstanding invoices with optional multi-currency support.
    
    Args:
        include_all_currencies (bool): If True, returns invoices in ALL currencies instead of filtering
    """
    try:
        party_account = get_party_account("Customer", customer, company)
        customer_name = frappe.get_cached_value("Customer", customer, "customer_name")

        frappe.logger().debug(
            f"Fetching outstanding invoices for customer: {customer}, party_account: {party_account}"
        )

        # Build filters
        filters = {
            "company": company,
            "customer": customer,
            "outstanding_amount": (">", 0),
            "docstatus": 1,
            "is_return": 0,
        }

        # Only add currency filter if NOT including all currencies
        if not include_all_currencies and currency:
            filters["currency"] = currency

        if pos_profile:
            filters["pos_profile"] = pos_profile

        # Get all outstanding invoices directly from Sales Invoice
        outstanding_invoices = frappe.get_all(
            "Sales Invoice",
            filters=filters,
            fields=[
                "name as voucher_no",
                "outstanding_amount",
                "grand_total as invoice_amount",
                "due_date",
                "posting_date",
                "currency",  # Always fetch currency
                "party_account_currency",
                "pos_profile",
                "customer",
                "customer_name",
            ],
            order_by="posting_date desc",
        )

        # Ensure all amounts are properly formatted
        for invoice in outstanding_invoices:
            invoice.outstanding_amount = flt(invoice.outstanding_amount)
            invoice.invoice_amount = flt(invoice.invoice_amount)
            invoice.voucher_type = "Sales Invoice"

        # === JOURNAL ENTRY LOGIC (Keep your corrected version from previous fix) ===
        journal_entries = []
        if customer and company:
            conditions = []
            params = {"company": company, "customer": customer}

            if party_account:
                conditions.append("jea.account = %(party_account)s")
                params["party_account"] = party_account

            # Only filter by currency if NOT including all currencies
            if not include_all_currencies and currency:
                conditions.append("jea.account_currency = %(currency)s")
                params["currency"] = currency

            condition_sql = ""
            if conditions:
                condition_sql = " AND " + " AND ".join(conditions)

            # Get raw Journal Entry lines
            journal_lines = frappe.db.sql(
                f"""
                    SELECT
                        je.name AS voucher_no,
                        je.posting_date AS posting_date,
                        jea.debit_in_account_currency AS debit,
                        jea.credit_in_account_currency AS credit,
                        jea.account_currency AS currency,
                        jea.account AS account
                    FROM `tabJournal Entry Account` jea
                    INNER JOIN `tabJournal Entry` je ON je.name = jea.parent
                    WHERE je.docstatus = 1
                        AND je.company = %(company)s
                        AND jea.party_type = 'Customer'
                        AND jea.party = %(customer)s
                        AND (jea.reference_type IS NULL OR jea.reference_type = '')
                        AND (jea.reference_name IS NULL OR jea.reference_name = '')
                        {condition_sql}
                """,
                params,
                as_dict=True,
            )

            # Aggregate by voucher_no to get net outstanding
            je_totals = {}
            for line in journal_lines:
                voucher_no = line.voucher_no
                if voucher_no not in je_totals:
                    je_totals[voucher_no] = {
                        "debit": 0,
                        "credit": 0,
                        "posting_date": line.posting_date,
                        "currency": line.currency,
                        "account": line.account,
                    }
                je_totals[voucher_no]["debit"] += flt(line.debit)
                je_totals[voucher_no]["credit"] += flt(line.credit)

            # Check allocations and create entries (keep your existing logic)
            journal_entry_names = list(je_totals.keys())
            allocated_map = {}
            if journal_entry_names:
                allocated_rows = frappe.db.sql(
                    """
                        SELECT
                            per.reference_name AS voucher_no,
                            SUM(per.allocated_amount) AS allocated_amount
                        FROM `tabPayment Entry Reference` per
                        INNER JOIN `tabPayment Entry` pe ON pe.name = per.parent
                        WHERE pe.docstatus = 1
                            AND pe.party_type = 'Customer'
                            AND pe.party = %(customer)s
                            AND pe.company = %(company)s
                            AND per.reference_doctype = 'Journal Entry'
                            AND per.reference_name IN %(voucher_nos)s
                        GROUP BY per.reference_name
                    """,
                    {
                        "voucher_nos": tuple(journal_entry_names),
                        "customer": customer,
                        "company": company,
                    },
                    as_dict=True,
                )
                allocated_map = {
                    row.voucher_no: flt(row.allocated_amount) for row in allocated_rows or []
                }

            # Create consolidated Journal Entry records
            for voucher_no, totals in je_totals.items():
                net_outstanding = flt(totals["debit"]) - flt(totals["credit"])
                allocated_amount = flt(allocated_map.get(voucher_no, 0))
                net_outstanding = max(0, net_outstanding - allocated_amount)
                
                if net_outstanding > 0:
                    journal_entries.append(
                        frappe._dict(
                            {
                                "voucher_no": voucher_no,
                                "outstanding_amount": net_outstanding,
                                "invoice_amount": net_outstanding,
                                "due_date": totals["posting_date"],
                                "posting_date": totals["posting_date"],
                                "currency": totals["currency"],
                                "pos_profile": None,
                                "customer": customer,
                                "customer_name": customer_name,
                                "voucher_type": "Journal Entry",
                            }
                        )
                    )

        outstanding_invoices = outstanding_invoices + journal_entries
        outstanding_invoices = sorted(
            outstanding_invoices,
            key=lambda inv: (
                getdate(inv.get("posting_date")) if inv.get("posting_date") else getdate(nowdate())
            ),
            reverse=True,
        )

        return outstanding_invoices
    except Exception as e:
        frappe.logger().error(f"Error in get_outstanding_invoices: {str(e)}")
        return []


@frappe.whitelist()
def get_unallocated_payments(
    customer,
    company,
    currency=None,
    mode_of_payment=None,
    include_all_currencies=False,
):
    filters = {
        "party": customer,
        "company": company,
        "docstatus": 1,
        "party_type": "Customer",
        "payment_type": "Receive",
        "unallocated_amount": [">", 0],
    }
    if currency and not include_all_currencies:
        filters["paid_from_account_currency"] = currency
    if mode_of_payment:
        filters.update({"mode_of_payment": mode_of_payment})
    unallocated_payment = frappe.get_all(
        "Payment Entry",
        filters=filters,
        fields=[
            "name",
            "paid_amount",
            "party_name as customer_name",
            "received_amount",
            "posting_date",
            "unallocated_amount",
            "mode_of_payment",
            "paid_from_account_currency as currency",
        ],
        order_by="posting_date asc",
    )

    # Keep POSPay parity with ERPNext reconciliation tool: if strict currency
    # filter produced no rows, fallback to all currencies for visibility.
    if (
        not include_all_currencies
        and currency
        and not unallocated_payment
    ):
        fallback_filters = dict(filters)
        fallback_filters.pop("paid_from_account_currency", None)
        unallocated_payment = frappe.get_all(
            "Payment Entry",
            filters=fallback_filters,
            fields=[
                "name",
                "paid_amount",
                "party_name as customer_name",
                "received_amount",
                "posting_date",
                "unallocated_amount",
                "mode_of_payment",
                "paid_from_account_currency as currency",
            ],
            order_by="posting_date asc",
        )
    for payment in unallocated_payment:
        payment["voucher_type"] = "Payment Entry"
        payment["is_credit_note"] = 0

    credit_notes = frappe.get_all(
        "Sales Invoice",
        filters={
            "customer": customer,
            "company": company,
            "docstatus": 1,
            "is_return": 1,
            "outstanding_amount": ("<", 0),
        },
        fields=[
            "name",
            "posting_date",
            "customer_name",
            "return_against",
            "outstanding_amount",
            "currency",
            "conversion_rate",
            "remarks",
        ],
        order_by="posting_date asc",
    )

    for note in credit_notes:
        outstanding_credit = abs(flt(note.outstanding_amount or 0))
        if not outstanding_credit:
            continue

        unallocated_payment.append(
            {
                "name": note.name,
                "paid_amount": outstanding_credit,
                "received_amount": outstanding_credit,
                "customer_name": note.customer_name,
                "posting_date": note.posting_date,
                "unallocated_amount": outstanding_credit,
                "mode_of_payment": _("Credit Note"),
                "currency": note.currency or currency,
                "voucher_type": "Sales Invoice",
                "is_credit_note": 1,
                "return_against": note.return_against,
                "reference_invoice": note.return_against,
                "conversion_rate": note.conversion_rate,
                "remarks": note.remarks,
            }
        )

    unallocated_payment = sorted(
        unallocated_payment,
        key=lambda pay: (
            getdate(pay.get("posting_date")) if pay.get("posting_date") else getdate(nowdate()),
            pay.get("name"),
        ),
    )

    return unallocated_payment

@frappe.whitelist()
def get_available_pos_profiles(company, currency):
    pos_profiles_list = frappe.get_list(
        "POS Profile",
        filters={"disabled": 0, "company": company, "currency": currency},
        page_length=1000,
        pluck="name",
    )
    return pos_profiles_list
