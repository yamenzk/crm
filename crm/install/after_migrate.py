import frappe
from frappe.permissions import add_permission, update_permission_property


def restrict_kanban_creation():
    """Restrict Kanban board creation to System Managers and CRM Managers only"""

    # Get the Kanban Board doctype
    try:
        # First, remove the default permissions
        frappe.db.sql(
            """
            DELETE FROM `tabDocPerm` 
            WHERE parent='Kanban Board' 
            AND permlevel=0
            AND `create`=1
        """
        )


        # Remove create permission for all other roles
        for role in frappe.get_all(
            "Role", {"name": ["not in", ["System Manager"]]}
        ):
            update_permission_property("Kanban Board", role.name, 0, "create", 0)

        frappe.clear_cache(doctype="Kanban Board")

        print(
            "Successfully restricted Kanban Board creation to System Manager and CRM Manager roles"
        )

    except Exception as e:
        frappe.log_error(f"Failed to restrict Kanban Board permissions: {str(e)}")


def after_migrate():
    restrict_kanban_creation()
    workspaces = frappe.get_all(
        "Workspace", filters={"module": ["!=", "CRM"]}, fields=["name"]
    )
    for workspace in workspaces:
        frappe.delete_doc("Workspace", workspace.name, force=True)
