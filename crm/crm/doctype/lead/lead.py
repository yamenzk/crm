# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class Lead(Document):
	def validate(self):
		if self.has_value_changed("first_name") or self.has_value_changed("last_name"):
			self.full_name = " ".join(filter(None, [self.first_name, self.last_name]))
