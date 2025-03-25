frappe.ui.form.on("Lead", {
	refresh(frm) {},
	first_name: function (frm) {
		frm.set_value(
			"full_name",
			((frm.doc.first_name || "") + " " + (frm.doc.last_name || "")).trim()
		);
	},
	last_name: function (frm) {
		frm.set_value(
			"full_name",
			((frm.doc.first_name || "") + " " + (frm.doc.last_name || "")).trim()
		);
	},
});

