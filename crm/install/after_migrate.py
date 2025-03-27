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

        for role in frappe.get_all("Role", {"name": ["not in", ["System Manager"]]}):
            update_permission_property("Kanban Board", role.name, 0, "create", 0)

        frappe.clear_cache(doctype="Kanban Board")

        print(
            "Successfully restricted Kanban Board creation to System Manager and CRM Manager roles"
        )

    except Exception as e:
        frappe.log_error(f"Failed to restrict Kanban Board permissions: {str(e)}")


def set_page_read_permissions():
    """Grant read permissions for Page doctype to specified CRM roles"""

    crm_roles = [
        "CRM Admin",
        "CRM Manager",
        "CRM Team Leader",
        "CRM Sales",
        "CRM Reception",
    ]

    try:
        for role in crm_roles:
            # Check if permission exists for this role and doctype
            role_permission_exists = frappe.db.exists(
                "DocPerm", {"parent": "Page", "role": role, "permlevel": 0}
            )

            if not role_permission_exists:
                # Add permission if it doesn't exist
                add_permission("Page", role, 0)
                print(f"Added new permission for {role} on Page doctype")
            else:
                # If permission exists, just make sure read is set to 1
                update_permission_property("Page", role, 0, "read", 1)
                print(f"Updated existing permission for {role} on Page doctype")

        frappe.clear_cache(doctype="Page")
        print(f"Successfully granted Page read permissions to CRM roles")

    except Exception as e:
        frappe.log_error(f"Failed to set Page permissions: {str(e)}")


def set_todo_permissions():
    """Grant create, read, write permissions for ToDo doctype to specified CRM roles"""

    crm_roles = [
        "CRM Admin",
        "CRM Manager",
        "CRM Team Leader",
        "CRM Sales",
        "CRM Reception",
    ]

    try:
        # First, check if we need to remove the default "All" permission
        if frappe.db.exists("DocPerm", {"parent": "ToDo", "role": "All"}):
            # Remove the default "All" permission
            frappe.db.sql(
                """
                DELETE FROM `tabDocPerm` 
                WHERE parent='ToDo' 
                AND role='All'
            """
            )
            print("Removed default 'All' permission from ToDo doctype")

        for role in crm_roles:
            # Check if permission exists for this role and doctype
            role_permission_exists = frappe.db.exists(
                "DocPerm", {"parent": "ToDo", "role": role, "permlevel": 0}
            )

            if not role_permission_exists:
                # Add permission if it doesn't exist
                add_permission("ToDo", role, 0)
                print(f"Added new permission for {role} on ToDo doctype")

            # Always update the permission properties to ensure they're correct
            update_permission_property("ToDo", role, 0, "create", 1)
            update_permission_property("ToDo", role, 0, "read", 1)
            update_permission_property("ToDo", role, 0, "write", 1)
            update_permission_property("ToDo", role, 0, "if_owner", 1)
            print(f"Updated permissions for {role} on ToDo doctype")

        frappe.clear_cache(doctype="ToDo")
        print(
            f"Successfully granted ToDo permissions to CRM roles and handled 'All' permission"
        )

    except Exception as e:
        frappe.log_error(f"Failed to set ToDo permissions: {str(e)}")


def set_user_permissions_for_crm_admin():
    """Grant permissions for CRM Admin to manage users"""

    try:
        # Check if User permission exists for CRM Admin
        role_permission_exists = frappe.db.exists(
            "DocPerm", {"parent": "User", "role": "CRM Admin", "permlevel": 0}
        )

        if not role_permission_exists:
            # Add permission if it doesn't exist
            add_permission("User", "CRM Admin", 0)
            print(f"Added new permission for CRM Admin on User doctype")

        # Set permissions for User doctype
        update_permission_property("User", "CRM Admin", 0, "create", 1)
        update_permission_property("User", "CRM Admin", 0, "read", 1)
        update_permission_property("User", "CRM Admin", 0, "write", 1)
        update_permission_property("User", "CRM Admin", 0, "delete", 0)  # No deletion
        update_permission_property("User", "CRM Admin", 0, "export", 0)  # No export
        update_permission_property("User", "CRM Admin", 0, "import", 0)  # No import
        update_permission_property("User", "CRM Admin", 0, "print", 1)
        update_permission_property("User", "CRM Admin", 0, "email", 1)

        # Also need to give access to User Role doctype for role assignments
        role_permission_exists = frappe.db.exists(
            "DocPerm", {"parent": "Has Role", "role": "CRM Admin", "permlevel": 0}
        )

        if not role_permission_exists:
            add_permission("Has Role", "CRM Admin", 0)
            print(f"Added new permission for CRM Admin on Has Role doctype")

        update_permission_property("Has Role", "CRM Admin", 0, "create", 1)
        update_permission_property("Has Role", "CRM Admin", 0, "read", 1)
        update_permission_property("Has Role", "CRM Admin", 0, "write", 1)
        update_permission_property("Has Role", "CRM Admin", 0, "delete", 1)

        # Give access to Role doctype (read-only)
        role_permission_exists = frappe.db.exists(
            "DocPerm", {"parent": "Role", "role": "CRM Admin", "permlevel": 0}
        )

        if not role_permission_exists:
            add_permission("Role", "CRM Admin", 0)
            print(f"Added new permission for CRM Admin on Role doctype")

        update_permission_property("Role", "CRM Admin", 0, "read", 1)
        update_permission_property("Role", "CRM Admin", 0, "create", 0)
        update_permission_property("Role", "CRM Admin", 0, "write", 0)

        frappe.clear_cache(doctype=["User", "Has Role", "Role"])
        print(f"Successfully granted User management permissions to CRM Admin role")

    except Exception as e:
        frappe.log_error(f"Failed to set User permissions for CRM Admin: {str(e)}")


def after_migrate():
    restrict_kanban_creation()
    set_page_read_permissions()
    set_todo_permissions()
    set_user_permissions_for_crm_admin()  # Add user management permissions for CRM Admin

    workspaces = frappe.get_all(
        "Workspace", filters={"module": ["!=", "CRM"]}, fields=["name"]
    )
    for workspace in workspaces:
        frappe.delete_doc("Workspace", workspace.name, force=True)

    genders = frappe.get_all(
        "Gender", filters={"gender": ["not in", ["Male", "Female"]]}, fields=["name"]
    )
    for gender in genders:
        frappe.delete_doc("Gender", gender.name, force=True)

    frappe.db.set_value(
        "System Settings", "System Settings", "first_day_of_the_week", "Monday"
    )
    frappe.db.set_value("System Settings", "System Settings", "default_app", "crm")
    frappe.db.set_value(
        "Website Settings",
        "Website Settings",
        "title_prefix",
        "Daraj Al Yasamin Real Estate",
    )
    frappe.db.set_value(
        "Website Settings",
        "Website Settings",
        "app_name",
        "DY Real Estate",
    )
    frappe.db.set_value(
        "Website Settings",
        "Website Settings",
        "copyright",
        "Daraj Al Yasamin Real Estate",
    )
