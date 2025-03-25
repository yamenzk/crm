# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Unit(Document):
	def on_update(self):
		if self.has_value_changed('area_sqft') and self.area_sqft:
			self.area_sqm = self.area_sqft * 0.092903
		if self.has_value_changed('building') and self.building:
			building_doc = frappe.get_doc('Building', self.building, fields=['project', 'developer'])
			self.project = building_doc.project
			self.developer = building_doc.developer
