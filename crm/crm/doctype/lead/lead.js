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

frappe.ui.form.on("Phonebook", {
	primary: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.primary) {
			let phonebook_rows = frm.doc.phonebook || [];
			for (let i = 0; i < phonebook_rows.length; i++) {
				let other_row = phonebook_rows[i];
				if (other_row.name === row.name) continue;
				if (other_row.method === row.method && other_row.primary) {
					frappe.model.set_value(cdt, other_row.name, "primary", 0);
				}
			}

			if (row.method === "Mobile") {
				frm.set_value("mobile", row.value);
			} else if (row.method === "Email") {
				frm.set_value("email", row.value);
			}
		}
	},

	value: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.primary) {
			if (row.method === "Mobile") {
				frm.set_value("mobile", row.value);
			} else if (row.method === "Email") {
				frm.set_value("email", row.value);
			}
		}
	},

	method: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.primary && row.value) {
			if (row.method === "Mobile") {
				frm.set_value("mobile", row.value);
			} else if (row.method === "Email") {
				frm.set_value("email", row.value);
			}
		}
	},
});
