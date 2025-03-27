// Copyright (c) 2025, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Developer", {
	refresh(frm) {
		// Add button to create contact
		if (!frm.is_new()) {
			frm.add_custom_button(
				__("Add Contact"),
				function () {
					createContact(frm);
				},
			);

			// Load contacts for this developer
			loadContacts(frm);
		}
	},
});

function loadContacts(frm) {
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Contact",
			filters: [
				["Dynamic Link", "link_doctype", "=", "Developer"],
				["Dynamic Link", "link_name", "=", frm.doc.name],
			],
			fields: [
				"name",
				"first_name",
				"last_name",
				"salutation",
				"gender",
				"department",
				"company_name",
				"image",
			],
		},
		callback: function (r) {
			if (r.message) {
				const contacts = r.message;

				// We'll fetch additional details for each contact
				let promises = contacts.map((contact) => {
					return new Promise((resolve) => {
						frappe.call({
							method: "frappe.client.get",
							args: {
								doctype: "Contact",
								name: contact.name,
							},
							callback: function (r) {
								if (r.message) {
									resolve(r.message);
								} else {
									resolve(contact);
								}
							},
						});
					});
				});

				Promise.all(promises).then((contactsWithDetails) => {
					renderContacts(frm, contactsWithDetails);
				});
			} else {
				renderEmptyContacts(frm);
			}
		},
	});
}

function renderContacts(frm, contacts) {
	if (!contacts || contacts.length === 0) {
		renderEmptyContacts(frm);
		return;
	}

	let html = `
		<div class="dev-contacts-container">
			<div class="dev-contacts-grid">
	`;

	contacts.forEach((contact) => {
		// Get primary email
		let primaryEmail = "";
		if (contact.email_ids && contact.email_ids.length) {
			const primary = contact.email_ids.find((email) => email.is_primary === 1);
			primaryEmail = primary ? primary.email_id : contact.email_ids[0].email_id;
		}

		// Get primary phone
		let primaryPhone = "";
		if (contact.phone_nos && contact.phone_nos.length) {
			const primary = contact.phone_nos.find((phone) => phone.is_primary_mobile_no === 1);
			primaryPhone = primary ? primary.phone : contact.phone_nos[0].phone;
		}

		const fullName = [
			contact.salutation || "",
			contact.first_name || "",
			contact.last_name || "",
		]
			.filter(Boolean)
			.join(" ");

		// Use Gravatar if email exists, otherwise use contact image or default
		let contactImage;
		if (fullName) {
			contactImage = frappe.get_gravatar(fullName);
		} else if (contact.image) {
			contactImage = contact.image;
		} else {
			contactImage = "/assets/frappe/images/user.png";
		}

		html += `
			<div class="dev-contact-card">
				<div class="dev-contact-card-header">
					<div class="dev-contact-avatar">
						<img src="${contactImage}" alt="${fullName}">
					</div>
					<div class="dev-contact-info">
						<h5 class="dev-contact-name">${fullName}</h5>
						<div class="dev-contact-position">${contact.department || ""}</div>
					</div>
					<div class="dev-contact-actions">
						<button class="btn btn-sm btn-default dev-view-contact" data-contact="${contact.name}">
							<i class="fa fa-eye"></i>
						</button>
					</div>
				</div>
				<div class="dev-contact-details">
					${
						primaryEmail
							? `<div class="dev-contact-detail">
							<i class="fa fa-envelope"></i>
							<a href="mailto:${primaryEmail}">${primaryEmail}</a>
						</div>`
							: ""
					}
					${
						primaryPhone
							? `<div class="dev-contact-detail">
							<i class="fa fa-phone"></i>
							<a href="tel:${primaryPhone}">${primaryPhone}</a>
						</div>`
							: ""
					}
				</div>
			</div>
		`;
	});

	html += `
			</div>
		</div>
		<style>
			.dev-contacts-container {
				font-family: var(--font-stack);
			}
			.dev-contacts-header {
				display: flex;
				align-items: center;
				margin-bottom: 15px;
				padding-bottom: 10px;
				border-bottom: 1px solid var(--border-color);
			}
			.dev-contacts-header h4 {
				margin: 0;
				font-weight: 600;
				color: var(--text-color);
			}
			.dev-contacts-count {
				margin-left: 10px;
				background: var(--control-bg);
				padding: 2px 8px;
				border-radius: 10px;
				font-size: 12px;
				color: var(--text-muted);
			}
			.dev-contacts-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
				grid-gap: 15px;
			}
			.dev-contact-card {
				background-color: var(--fg-color);
				border: 1px solid var(--border-color);
				border-radius: var(--border-radius-md);
				overflow: hidden;
				transition: all 0.2s;
				box-shadow: var(--shadow-sm);
			}
			.dev-contact-card:hover {
				box-shadow: var(--shadow-md);
				transform: translateY(-2px);
			}
			.dev-contact-card-header {
				display: flex;
				padding: 15px;
				align-items: center;
			}
			.dev-contact-avatar {
				width: 48px;
				height: 48px;
				border-radius: 50%;
				overflow: hidden;
				margin-right: 12px;
				background: var(--control-bg);
				box-shadow: 0 0 0 1px var(--border-color);
			}
			.dev-contact-avatar img {
				width: 100%;
				height: 100%;
				object-fit: cover;
			}
			.dev-contact-info {
				flex: 1;
			}
			.dev-contact-name {
				margin: 0 0 3px 0;
				font-size: 16px;
				font-weight: 500;
				color: var(--text-color);
			}
			.dev-contact-position {
				font-size: 12px;
				color: var(--text-muted);
			}
			.dev-contact-actions {
				margin-left: auto;
			}
			.dev-view-contact {
				padding: 3px 5px;
			}
			.dev-contact-details {
				padding: 0 15px 15px;
			}
			.dev-contact-detail {
				display: flex;
				align-items: center;
				margin-bottom: 8px;
				font-size: 13px;
			}
			.dev-contact-detail i {
				color: var(--text-muted);
				width: 18px;
				margin-right: 8px;
			}
			.dev-contact-detail a {
				color: var(--text-color);
				text-decoration: none;
			}
			.dev-contact-detail a:hover {
				color: var(--primary);
				text-decoration: underline;
			}
		</style>
	`;

	// Set the HTML
	$(frm.fields_dict.developer_html.wrapper).html(html);

	// Attach event handlers
	$(frm.fields_dict.developer_html.wrapper)
		.find(".dev-view-contact")
		.on("click", function () {
			const contactName = $(this).data("contact");
			frappe.set_route("Form", "Contact", contactName);
		});
}

function renderEmptyContacts(frm) {
	const html = `
		<div class="dev-contacts-empty">
			<div class="dev-contacts-empty-icon">
				<i class="fa fa-user-plus"></i>
			</div>
			<div class="dev-contacts-empty-text">${__("No contacts found for this developer")}</div>
			<button class="btn btn-sm btn-primary dev-add-contact-btn">${__("Add Contact")}</button>
		</div>
		<style>
			.dev-contacts-empty {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: 40px 20px;
				border: 1px dashed var(--border-color);
				border-radius: var(--border-radius-md);
				margin-top: 15px;
			}
			.dev-contacts-empty-icon {
				font-size: 36px;
				color: var(--text-muted);
				margin-bottom: 10px;
			}
			.dev-contacts-empty-text {
				color: var(--text-muted);
				margin-bottom: 15px;
			}
		</style>
	`;

	$(frm.fields_dict.developer_html.wrapper).html(html);

	// Attach event handler for the add contact button
	$(frm.fields_dict.developer_html.wrapper)
		.find(".dev-add-contact-btn")
		.on("click", function () {
			createContact(frm);
		});
}

function createContact(frm) {
	// Create a new dialog to collect contact information
	const dialog = new frappe.ui.Dialog({
		title: __("Add Contact for Developer"),
		fields: [
			{
				fieldtype: "Section Break",
				label: __("Personal Information"),
			},
			{
				fieldtype: "Link",
				label: __("Salutation"),
				fieldname: "salutation",
				options: "Salutation",
			},
			{
				fieldtype: "Data",
				label: __("First Name"),
				fieldname: "first_name",
				reqd: 1,
			},
			{
				fieldtype: "Data",
				label: __("Last Name"),
				fieldname: "last_name",
				reqd: 1,
			},
			{
				fieldtype: "Link",
				label: __("Gender"),
				fieldname: "gender",
				options: "Gender",
			},
			{
				fieldtype: "Section Break",
				label: __("Contact Details"),
			},
			{
				fieldtype: "Data",
				label: __("Email"),
				fieldname: "email_id",
				options: "Email",
			},
			{
				fieldtype: "Data",
				label: __("Mobile Number"),
				fieldname: "mobile_no",
				options: "Phone",
				reqd: 1,
			},
		],
		primary_action_label: __("Create Contact"),
		primary_action: function (values) {
			createContactDoc(frm, values);
			dialog.hide();
		},
	});

	dialog.show();
}

function createContactDoc(frm, values) {
	// Create a new contact
	frappe.call({
		method: "frappe.client.insert",
		args: {
			doc: {
				doctype: "Contact",
				first_name: values.first_name,
				last_name: values.last_name,
				salutation: values.salutation,
				gender: values.gender,
				department: "developer",
				company_name: frm.doc.name,
				email_ids: values.email_id
					? [
							{
								email_id: values.email_id,
								is_primary: 1,
							},
					  ]
					: [],
				phone_nos: [
					{
						phone: values.mobile_no,
						is_primary_mobile_no: 1,
					},
				],
				links: [
					{
						link_doctype: "Developer",
						link_name: frm.doc.name,
						link_title: frm.doc.name,
					},
				],
			},
		},
		callback: function (r) {
			if (r.message) {
				frappe.msgprint({
					title: __("Success"),
					indicator: "green",
					message: __("Contact created successfully"),
				});

				// Refresh the contacts display
				loadContacts(frm);
			}
		},
	});

}
