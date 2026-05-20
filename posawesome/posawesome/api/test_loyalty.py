import importlib.util
import pathlib
import sys
import types
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]


class AttrDict(dict):
    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc


class FakeMeta:
    def has_field(self, fieldname):
        return fieldname == "company"


def _install_stubs():
    frappe_module = types.ModuleType("frappe")
    frappe_utils = types.ModuleType("frappe.utils")
    loyalty_program_module = types.ModuleType(
        "erpnext.accounts.doctype.loyalty_program.loyalty_program"
    )
    treeview_module = types.ModuleType("frappe.desk.treeview")

    state = {
        "loyalty_programs": [],
        "loyalty_details_calls": [],
    }

    frappe_utils.cstr = lambda value="": "" if value is None else str(value)
    frappe_utils.today = lambda: "2026-05-20"
    frappe_module.get_meta = lambda doctype: FakeMeta()
    frappe_module.get_all = lambda doctype, fields=None, filters=None: state[
        "loyalty_programs"
    ]
    treeview_module._get_children = lambda doctype, name, ignore_permissions=False: []

    def get_loyalty_program_details_with_points(
        customer,
        loyalty_program=None,
        expiry_date=None,
        company=None,
        silent=False,
        include_expired_entry=False,
        current_transaction_amount=0,
    ):
        state["loyalty_details_calls"].append(
            {
                "customer": customer,
                "loyalty_program": loyalty_program,
                "company": company,
            }
        )
        return {"loyalty_points": 25, "conversion_factor": 2}

    loyalty_program_module.get_loyalty_program_details_with_points = (
        get_loyalty_program_details_with_points
    )

    sys.modules["frappe"] = frappe_module
    sys.modules["frappe.utils"] = frappe_utils
    sys.modules["frappe.desk.treeview"] = treeview_module
    sys.modules[
        "erpnext.accounts.doctype.loyalty_program.loyalty_program"
    ] = loyalty_program_module
    return state


def _load_module():
    state = _install_stubs()
    module_name = "posawesome.posawesome.api.loyalty"
    sys.modules.pop(module_name, None)
    module_path = REPO_ROOT / "posawesome" / "posawesome" / "api" / "loyalty.py"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module, state


class LoyaltyResolverTest(unittest.TestCase):
    def test_prefers_customer_loyalty_program(self):
        module, _state = _load_module()
        customer = types.SimpleNamespace(
            name="CUST-001",
            loyalty_program="Customer Loyalty",
            customer_group="Retail",
            territory="Pakistan",
            flags=types.SimpleNamespace(ignore_permissions=False),
        )

        self.assertEqual(
            module.resolve_customer_loyalty_program(customer, company="Demo Co"),
            "Customer Loyalty",
        )

    def test_uses_single_applicable_auto_opt_in_program(self):
        module, state = _load_module()
        state["loyalty_programs"] = [
            AttrDict(
                name="Retail Loyalty",
                customer_group=None,
                customer_territory=None,
                company="Demo Co",
            )
        ]
        customer = types.SimpleNamespace(
            name="CUST-001",
            loyalty_program=None,
            customer_group="Retail",
            territory="Pakistan",
            flags=types.SimpleNamespace(ignore_permissions=False),
        )

        details = module.get_customer_loyalty_details(customer, company="Demo Co")

        self.assertEqual(details["loyalty_program"], "Retail Loyalty")
        self.assertEqual(details["loyalty_points"], 25)
        self.assertEqual(details["conversion_factor"], 2)
        self.assertEqual(
            state["loyalty_details_calls"][0]["loyalty_program"],
            "Retail Loyalty",
        )

    def test_keeps_ambiguous_auto_opt_in_programs_hidden(self):
        module, state = _load_module()
        state["loyalty_programs"] = [
            AttrDict(
                name="Retail Loyalty",
                customer_group=None,
                customer_territory=None,
                company="Demo Co",
            ),
            AttrDict(
                name="Wholesale Loyalty",
                customer_group=None,
                customer_territory=None,
                company="Demo Co",
            ),
        ]
        customer = types.SimpleNamespace(
            name="CUST-001",
            loyalty_program=None,
            customer_group="Retail",
            territory="Pakistan",
            flags=types.SimpleNamespace(ignore_permissions=False),
        )

        self.assertIsNone(
            module.resolve_customer_loyalty_program(customer, company="Demo Co")
        )


if __name__ == "__main__":
    unittest.main()
