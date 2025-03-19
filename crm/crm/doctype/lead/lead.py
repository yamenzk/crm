# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Lead(Document):
	def on_update(self):
		frappe.publish_realtime("lead_update", {"lead": self.as_dict()}, after_commit=True)
	def on_trash(self):
		frappe.publish_realtime("lead_update", {"lead": self.as_dict()}, after_commit=True)
	def after_insert(self):
		frappe.publish_realtime("lead_update", {"lead": self.as_dict()}, after_commit=True)
	def validate(self):
		if self.has_value_changed("first_name") or self.has_value_changed("last_name"):
			self.full_name = " ".join(filter(None, [self.first_name, self.last_name]))
