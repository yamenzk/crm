// Copyright (c) 2025, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Unit", {
	refresh(frm) {

	},
    area_sqft: function(frm) {
        frm.set_value("area_sqm", frm.doc.area_sqft * 0.092903);
    }
});
