# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Lead(Document):

    def on_update(self):
        frappe.publish_realtime(
            "lead_update", {"lead": self.as_dict()}, after_commit=True
        )

    def on_trash(self):
        frappe.publish_realtime(
            "lead_update", {"lead": self.as_dict()}, after_commit=True
        )

    def after_insert(self):
        frappe.publish_realtime(
            "lead_update", {"lead": self.as_dict()}, after_commit=True
        )
        if self.first_name:
            # Initialize the contact document dictionary
            contact_dict = dict(
                doctype="Contact",
                first_name=self.first_name,
                last_name=self.last_name,
                department="Lead",
                email_ids=[],
                phone_nos=[],
                links=[
                    {
                        "link_doctype": "Lead",
                        "link_name": self.name,
                        "link_title": self.full_name,
                    }
                ],
            )

            # Add email if provided
            if self.email:
                contact_dict["email_ids"].append({
                    "email_id": self.email, 
                    "is_primary": 1
                })

            # Add phone if provided
            if self.mobile:
                contact_dict["phone_nos"].append({
                    "phone": self.mobile, 
                    "is_primary_mobile_no": 1
                })

            # Create and insert the contact
            contact_doc = frappe.get_doc(contact_dict).insert(ignore_permissions=True)
            self.contact = contact_doc.name
            self.db_set('contact', self.contact, update_modified=False)

    def validate(self):
        if self.has_value_changed("first_name") or self.has_value_changed("last_name") and not self.is_new():
            self.full_name = " ".join(filter(None, [self.first_name, self.last_name]))

