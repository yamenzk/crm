# In your_app/setup.py

import frappe
from frappe.permissions import add_permission, update_permission_property

def after_install():
    """Runs after app installation"""
    restrict_kanban_creation()

def restrict_kanban_creation():
    """Restrict Kanban board creation to System Managers and CRM Managers only"""
    
    # Get the Kanban Board doctype
    try:
        # First, remove the default permissions
        frappe.db.sql("""
            DELETE FROM `tabDocPerm` 
            WHERE parent='Kanban Board' 
            AND role NOT IN ('System Manager', 'CRM Manager')
            AND permlevel=0
            AND `create`=1
        """)
        
        # Now set up the correct permissions
        # For System Manager
        update_permission_property("Kanban Board", "System Manager", 0, "create", 1)
        
        # For CRM Manager - first check if the role exists and create if needed
        if not frappe.db.exists("Role", "CRM Manager"):
            crm_role = frappe.new_doc("Role")
            crm_role.role_name = "CRM Manager"
            crm_role.desk_access = 1
            crm_role.insert(ignore_permissions=True)
        
        # Then add or update permissions for CRM Manager
        if not frappe.db.exists("DocPerm", {"parent": "Kanban Board", "role": "CRM Manager"}):
            add_permission("Kanban Board", "CRM Manager", 0)
            
        update_permission_property("Kanban Board", "CRM Manager", 0, "create", 1)
        update_permission_property("Kanban Board", "CRM Manager", 0, "read", 1)
        update_permission_property("Kanban Board", "CRM Manager", 0, "write", 1)
        
        # Remove create permission for all other roles
        for role in frappe.get_all("Role", {"name": ["not in", ["System Manager", "CRM Manager"]]}):
            update_permission_property("Kanban Board", role.name, 0, "create", 0)
            
        frappe.clear_cache(doctype="Kanban Board")
        
        print("Successfully restricted Kanban Board creation to System Manager and CRM Manager roles")
        
    except Exception as e:
        frappe.log_error(f"Failed to restrict Kanban Board permissions: {str(e)}")