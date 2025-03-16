import frappe


def after_migrate():
    workspaces = frappe.get_all(
        "Workspace", filters={"module": ["!=", "CRM"]}, fields=["name"]
    )
    for workspace in workspaces:
        frappe.delete_doc("Workspace", workspace.name, force=True)
