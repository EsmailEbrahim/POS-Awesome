# -*- coding: utf-8 -*-

import frappe
from frappe.utils import cstr, today
from erpnext.accounts.doctype.loyalty_program.loyalty_program import (
    get_loyalty_program_details_with_points,
)


def _get_nested_links(link_doctype, link_name, ignore_permissions=False):
    if not link_name:
        return []

    from frappe.desk.treeview import _get_children

    links = [link_name]
    for row in _get_children(link_doctype, link_name, ignore_permissions):
        links.append(row.value)
    return links


def _loyalty_program_applies_to_customer(loyalty_program, customer_doc):
    customer_group = loyalty_program.get("customer_group")
    if customer_group:
        customer_groups = _get_nested_links(
            "Customer Group",
            customer_group,
            getattr(customer_doc.flags, "ignore_permissions", False),
        )
        if customer_doc.customer_group not in customer_groups:
            return False

    territory = loyalty_program.get("customer_territory")
    if territory:
        territories = _get_nested_links(
            "Territory",
            territory,
            getattr(customer_doc.flags, "ignore_permissions", False),
        )
        if customer_doc.territory not in territories:
            return False

    return True


def resolve_customer_loyalty_program(customer_doc, company=None):
    if not customer_doc:
        return None

    if customer_doc.loyalty_program:
        return customer_doc.loyalty_program

    filters = {
        "auto_opt_in": 1,
        "from_date": ["<=", today()],
        "ifnull(to_date, '2500-01-01')": [">=", today()],
    }

    fields = ["name", "customer_group", "customer_territory"]
    if frappe.get_meta("Loyalty Program").has_field("company"):
        fields.append("company")

    loyalty_programs = frappe.get_all(
        "Loyalty Program",
        fields=fields,
        filters=filters,
    )

    company = cstr(company or "").strip()
    applicable = []
    for loyalty_program in loyalty_programs:
        if (
            company
            and loyalty_program.get("company")
            and loyalty_program.get("company") != company
        ):
            continue
        if _loyalty_program_applies_to_customer(loyalty_program, customer_doc):
            applicable.append(loyalty_program.name)

    if len(applicable) == 1:
        return applicable[0]

    return None


def get_customer_loyalty_details(customer_doc, company=None):
    loyalty_program = resolve_customer_loyalty_program(customer_doc, company=company)
    if not loyalty_program:
        return {
            "loyalty_program": None,
            "loyalty_points": None,
            "conversion_factor": None,
        }

    lp_details = get_loyalty_program_details_with_points(
        customer_doc.name,
        loyalty_program,
        company=company or None,
        silent=True,
        include_expired_entry=False,
    )

    return {
        "loyalty_program": loyalty_program,
        "loyalty_points": lp_details.get("loyalty_points"),
        "conversion_factor": lp_details.get("conversion_factor"),
    }
