# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
import os
import csv
from frappe.model.document import Document
from frappe.utils import cint


class Amenity(Document):
    pass


@frappe.whitelist()
def import_common_amenities():
    """Import common amenities from the CSV file"""
    app_path = frappe.get_app_path("crm")
    csv_file = os.path.join(app_path, "data", "amenities.csv")

    if not os.path.exists(csv_file):
        frappe.throw("Amenities CSV file not found!")

    with open(csv_file, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        total = len(rows)

    if not rows:
        frappe.throw("No amenities found in CSV file!")

    existing_amenities = {a.name for a in frappe.get_all("Amenity")}
    imported_count = 0

    for i, row in enumerate(rows):
        # Update progress every 5 records
        if i % 5 == 0 or i == total - 1:
            progress = (i + 1) / total * 100
            frappe.publish_progress(
                percent=progress,
                title="Importing Amenities",
                description=f"Processed {i+1} of {total} amenities",
            )

        amenity_name = row.get("amenity")
        if amenity_name and amenity_name not in existing_amenities:
            try:
                doc = frappe.new_doc("Amenity")
                doc.amenity = amenity_name
                doc.icon = row.get("icon", "")
                doc.is_project = cint(row.get("is_project", 0))
                doc.insert(ignore_permissions=True)
                imported_count += 1
                frappe.db.commit()
            except Exception as e:
                frappe.log_error(f"Failed to import amenity {amenity_name}: {str(e)}")

    # Close any open dialogs and display a completion message
    frappe.msgprint(
        msg=f"Successfully imported {imported_count} amenities",
        title="Import Complete",
        indicator="green",
    )

    # Return result to close the progress dialog
    return {
        "message": f"Successfully imported {imported_count} amenities",
        "status": "success",
    }
