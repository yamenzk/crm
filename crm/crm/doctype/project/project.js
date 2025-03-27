// Copyright (c) 2025, Yamen Zakhour and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project", {
	refresh: function (frm) {
		// Load dependencies
		frappe.require(
			[
				"/assets/crm/js/common/context_menu.js",
				"/assets/crm/js/project/project_dashboard.js",
			],
			function () {
				// Initialize the project dashboard
				frm.dashboard_manager = new frappe.crm.ProjectDashboard(frm);
				frm.dashboard_manager.init();
			}
		);

		// Add developer contact management buttons
		setup_developer_contact_buttons(frm);
	},

	after_save: function (frm) {
		// Refresh the dashboard after saving the project
		if (frm.dashboard_manager) {
			frm.dashboard_manager.refresh();
		}
	},

	// Track changes to developer_contact field
	developer_contact: function (frm) {
		// If the field was changed and we have the old value
		if (frm.doc.developer_contact !== frm.doc.__oldvalues?.developer_contact) {
			// If there was a previous contact, remove the project link
			if (frm.doc.__oldvalues?.developer_contact) {
				remove_project_link_from_contact(frm, frm.doc.__oldvalues.developer_contact);
			}

			// If there's a new contact, add the project link
			if (frm.doc.developer_contact) {
				add_project_link_to_contact(frm, frm.doc.developer_contact);
			}
		}
	},
});

function setup_developer_contact_buttons(frm) {
	// Remove any existing buttons to avoid duplication
	frm.remove_custom_button(__("Assign Developer Contact"));
	frm.remove_custom_button(__("View Developer Contact"));

	if (!frm.doc.developer_contact) {
		// If no developer contact is assigned, show the assign button
		frm.add_custom_button(__("Assign Developer Contact"), function () {
			show_contact_assignment_dialog(frm);
		});
	} else {
		// If a developer contact is already assigned, show the view button
		frm.add_custom_button(__("View Developer Contact"), function () {
			show_contact_details_dialog(frm);
		});
	}
}

function show_contact_assignment_dialog(frm) {
	// First, we need to fetch available contacts with department = developer
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Contact",
			filters: [
				["department", "=", "developer"],
				["company_name", "=", frm.doc.developer],
			],
			fields: ["name", "first_name", "last_name", "salutation"],
		},
		callback: function (r) {
			if (r.message && r.message.length > 0) {
				const contacts = r.message;

				// Create options for the dialog
				const contact_options = contacts.map((contact) => {
					const full_name = [
						contact.salutation || "",
						contact.first_name || "",
						contact.last_name || "",
					]
						.filter(Boolean)
						.join(" ");

					return {
						value: contact.name,
						label: full_name || contact.name,
					};
				});

				// Create the assignment dialog
				const dialog = new frappe.ui.Dialog({
					title: __("Assign Developer Contact"),
					fields: [
						{
							fieldtype: "Select",
							fieldname: "contact",
							label: __("Select Contact"),
							options: contact_options,
							reqd: 1,
						},
					],
					primary_action_label: __("Assign"),
					primary_action: function (values) {
						assign_developer_contact(frm, values.contact);
						dialog.hide();
					},
				});

				dialog.show();
			} else {
				frappe.msgprint({
					title: __("No Contacts Found"),
					message: __(
						'No developer contacts found for this project.'
					),
					indicator: "orange",
				});
			}
		},
	});
}

function show_contact_details_dialog(frm) {
	if (!frm.doc.developer_contact) return;
	frappe.call({
		method: "crm.api.get_developer_contact_for_project",
		args: {
			project_name: frm.doc.name,
		},
		freeze: true,
		freeze_message: __("Loading contact details..."),
		callback: function (r) {

			if (r.message && r.message.status === "success") {
				const contact = r.message.contact;

				// Use Gravatar if available
				const contactImage = contact.full_name
					? frappe.get_gravatar(contact.full_name)
					: contact.image || "/assets/frappe/images/user.png";

				// Create the contact details dialog
				const dialog = new frappe.ui.Dialog({
					title: __("Developer Contact"),
					fields: [
						{
							fieldtype: "HTML",
							fieldname: "contact_details",
							options: `
                                <div class="contact-details-container">
                                    <div class="contact-header">
                                        <div class="contact-avatar">
                                            <img src="${contactImage}" alt="${contact.full_name}">
                                        </div>
                                        <div class="contact-info">
                                            <h4>${contact.full_name}</h4>
                                            <div class="contact-department">${
												contact.department || ""
											}</div>
                                        </div>
                                    </div>
                                    <div class="contact-body">
                                        ${
											contact.primary_email
												? `<div class="contact-field">
                                                <div class="field-label">${__("Email")}</div>
                                                <div class="field-value">
                                                    <a href="mailto:${contact.primary_email}">${
														contact.primary_email
												  }</a>
                                                </div>
                                            </div>`
												: ""
										}
                                        ${
											contact.primary_phone
												? `<div class="contact-field">
                                                <div class="field-label">${__("Phone")}</div>
                                                <div class="field-value">
                                                    <a href="tel:${contact.primary_phone}">${
														contact.primary_phone
												  }</a>
                                                </div>
                                            </div>`
												: ""
										}
                                        <div class="contact-actions">
                                            ${
												frappe.perm.has_perm("Contact", 0, "read")
													? `<button class="btn btn-sm btn-default view-full-contact">
                                                    ${__("View Full Contact")}
                                                </button>`
													: ""
											}
                                            <button class="btn btn-sm btn-primary replace-contact">
                                                ${__("Replace Contact")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <style>
                                    /* Styles remain the same */
                                    .contact-details-container {
                                        padding: 15px;
                                        font-family: var(--font-stack);
                                    }
                                    .contact-header {
                                        display: flex;
                                        align-items: center;
                                        margin-bottom: 20px;
                                    }
                                    .contact-avatar {
                                        width: 60px;
                                        height: 60px;
                                        border-radius: 50%;
                                        overflow: hidden;
                                        margin-right: 15px;
                                        box-shadow: 0 0 0 1px var(--border-color);
                                    }
                                    .contact-avatar img {
                                        width: 100%;
                                        height: 100%;
                                        object-fit: cover;
                                    }
                                    .contact-info h4 {
                                        margin: 0 0 5px 0;
                                        color: var(--text-color);
                                    }
                                    .contact-department {
                                        color: var(--text-muted);
                                        font-size: 13px;
                                    }
                                    .contact-body {
                                        border-top: 1px solid var(--border-color);
                                        padding-top: 15px;
                                    }
                                    .contact-field {
                                        margin-bottom: 12px;
                                    }
                                    .field-label {
                                        font-size: 12px;
                                        color: var(--text-muted);
                                        margin-bottom: 3px;
                                    }
                                    .field-value {
                                        font-size: 14px;
                                        color: var(--text-color);
                                    }
                                    .field-value a {
                                        color: var(--primary);
                                        text-decoration: none;
                                    }
                                    .field-value a:hover {
                                        text-decoration: underline;
                                    }
                                    .contact-actions {
                                        display: flex;
                                        justify-content: space-between;
                                        margin-top: 20px;
                                        padding-top: 15px;
                                        border-top: 1px solid var(--border-color);
                                    }
                                </style>
                            `,
						},
					],
				});

				dialog.show();

				// Attach event handlers
				if (frappe.perm.has_perm("Contact", 0, "read")) {
					dialog.$wrapper.find(".view-full-contact").on("click", function () {
						dialog.hide();
						frappe.set_route("Form", "Contact", contact.name);
					});
				}

				dialog.$wrapper.find(".replace-contact").on("click", function () {
					dialog.hide();
					show_contact_assignment_dialog(frm);
				});
			} else {
				frappe.msgprint({
					title: __("Contact Information"),
					message: r.message?.message || __("Could not load contact information"),
					indicator: "orange",
				});
			}
		},
	});
}

function assign_developer_contact(frm, contact_name) {
	// Save the current contact for later comparison
	const old_contact = frm.doc.developer_contact;

	// Set the new contact
	frm.set_value("developer_contact", contact_name);

	frm.save().then(() => {
		frappe.show_alert({
			message: __("Developer contact assigned successfully"),
			indicator: "green",
		});

		// Update buttons
		setup_developer_contact_buttons(frm);
	});
}


// Function to add a project link to a contact
function add_project_link_to_contact(frm, contact_name) {
    // First, get the current contact
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Contact",
            name: contact_name
        },
        callback: function(r) {
            if (r.message) {
                const contact = r.message;
                
                // Check if the project link already exists
                const existingLink = (contact.links || []).find(link => 
                    link.link_doctype === "Project" && link.link_name === frm.doc.name
                );
                
                if (!existingLink) {
                    // Create a new Dynamic Link doc
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Dynamic Link",
                                parenttype: "Contact",
                                parentfield: "links",
                                parent: contact_name,
                                link_doctype: "Project",
                                link_name: frm.doc.name,
                                link_title: frm.doc.project_name || frm.doc.name
                            }
                        },
                        callback: function(r) {
                            if (r.message) {
                                console.log("Project link added to contact successfully");
                            }
                        }
                    });
                }
            }
        }
    });
}

// Function to remove a project link from a contact
function remove_project_link_from_contact(frm, contact_name) {
    // First, get the current contact with links
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Contact",
            name: contact_name
        },
        callback: function(r) {
            if (r.message) {
                const contact = r.message;
                
                // Find project links to delete
                const projectLinks = (contact.links || []).filter(link => 
                    link.link_doctype === "Project" && link.link_name === frm.doc.name
                );
                
                // Delete each project link
                projectLinks.forEach(link => {
                    if (link.name) {
                        frappe.call({
                            method: "frappe.client.delete",
                            args: {
                                doctype: "Dynamic Link",
                                name: link.name
                            },
                            callback: function(r) {
                                console.log("Project link removed from contact successfully");
                            }
                        });
                    }
                });
            }
        }
    });
}