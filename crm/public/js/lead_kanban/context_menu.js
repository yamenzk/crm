/**
 * Adds a context menu to kanban card elements
 */
function addContextMenuToKanbanCards() {
	// Use the common context menu component
	CRMContextMenu.attach({
		selector: ".kanban-card-wrapper",
		menuBuilder: function (element) {
			const leadName = element.data("name");
			const canDelete = frappe.user.has_role("CRM Manager");

			return {
				menuClass: "crm-kanban-context-menu",
				sections: [
					{
						items: [
							{
								icon: "edit",
								label: "Edit Lead",
								action: "edit",
							},
							{
								icon: "x-circle",
								label: "Mark as not interested",
								action: "not-interested",
							},
						],
					},
					{
						items: [
							{
								icon: "calendar",
								label: "Add ToDo",
								action: "todo",
							},
							{
								icon: "message-square",
								label: "Add comment",
								action: "comment",
							},
						],
					},
					{
						items: [
							{
								icon: "trash-2",
								label: "Delete Lead",
								action: "delete",
								cssClass: "crm-menu-button--delete",
								disabled: !canDelete,
								data: {
									name: leadName,
								},
							},
						],
					},
				],
				onItemClick: function (action, buttonElement) {
					handleLeadAction(action, leadName, buttonElement);
				},
			};
		},
	});
}

/**
 * Handle actions from the lead context menu
 *
 * @param {string} action - The selected action
 * @param {string} leadName - The name of the lead
 * @param {jQuery} buttonElement - The button element that was clicked
 */
function handleLeadAction(action, leadName, buttonElement) {
	switch (action) {
		case "edit":
			frappe.set_route("Form", "Lead", leadName);
			break;

		case "not-interested":
			frappe.confirm("Mark this lead as not interested?", function () {
				frappe.db.set_value("Lead", leadName, "not_interested", 1).then(() => {
					frappe.show_alert({
						message: __("Lead marked as not interested"),
						indicator: "green",
					});

					cur_list.refresh();
				});
			});
			break;

		case "todo":
			createTodoForLead(leadName);
			break;

		case "comment":
			addCommentToLead(leadName);
			break;

		case "delete":
			if (!frappe.user.has_role("CRM Manager")) return;
			confirmLeadDeletion(leadName);
			break;
	}

	if (["not-interested", "delete"].includes(action)) {
		setTimeout(refreshKanbanView, 1000);
	}
}

/**
 * Create a ToDo for a lead
 *
 * @param {string} leadName - The name of the lead
 */
function createTodoForLead(leadName) {
	frappe.db.get_doc("Lead", leadName).then((doc) => {
		const lead_title = doc.full_name;

		const todo_dialog = new frappe.ui.Dialog({
			title: __("Add ToDo for ") + lead_title,
			fields: [
				{
					fieldname: "section_details",
					fieldtype: "Section Break",
					label: __("Task Details"),
				},
				{
					fieldtype: "Column Break",
				},
				{
					fieldtype: "Date",
					fieldname: "date",
					label: __("Due Date"),
					default: frappe.datetime.add_days(frappe.datetime.nowdate(), 3),
				},
				{
					fieldtype: "Select",
					fieldname: "priority",
					label: __("Priority"),
					options: [
						{ value: "Low", label: __("Low") },
						{ value: "Medium", label: __("Medium") },
						{ value: "High", label: __("High") },
					],
					default: "Medium",
				},
				{
					fieldtype: "Column Break",
				},
				{
					fieldtype: "Link",
					fieldname: "assigned_to",
					label: __("Assign To"),
					options: "User",
					default: frappe.session.user,
				},
				{
					fieldtype: "Color",
					fieldname: "color",
					label: __("Color"),
				},
				{
					fieldtype: "Section Break",
					label: __("Description"),
				},
				{
					fieldtype: "Text Editor",
					fieldname: "description",
					label: __("Description"),
					reqd: 1,
					default: __("Follow up with ") + lead_title,
				},
				{
					fieldtype: "Section Break",
				},
				{
					fieldtype: "Check",
					fieldname: "send_email",
					label: __("Send Email Notification"),
					default: 1,
					depends_on: "eval:doc.assigned_to !== frappe.session.user",
				},
			],
			primary_action_label: __("Create ToDo"),
			primary_action: function () {
				const values = todo_dialog.get_values();

				frappe.db
					.insert({
						doctype: "ToDo",
						description: values.description,
						reference_type: "Lead",
						reference_name: leadName,
						allocated_to: values.assigned_to || frappe.session.user,
						priority: values.priority,
						date: values.date,
						color: values.color,
						status: "Open",
					})
					.then((doc) => {
						todo_dialog.hide();

						if (
							values.send_email &&
							values.assigned_to &&
							values.assigned_to !== frappe.session.user
						) {
							frappe.call({
								method: "frappe.desk.form.utils.add_assignment",
								args: {
									doctype: "Lead",
									name: leadName,
									assign_to: [values.assigned_to],
								},
								callback: function () {
									frappe.show_alert({
										message: __("ToDo created and email notification sent"),
										indicator: "green",
									});
								},
							});
						} else {
							frappe.show_alert({
								message: __("ToDo created"),
								indicator: "green",
							});
						}
					});
			},
		});

		todo_dialog.show();
	});
}

/**
 * Add a comment to a lead
 *
 * @param {string} leadName - The name of the lead
 */
function addCommentToLead(leadName) {
	const comment_dialog = new frappe.ui.Dialog({
		title: __("Add Comment"),
		fields: [
			{
				fieldtype: "Text Editor",
				fieldname: "comment",
				label: __("Comment"),
				reqd: 1,
			},
		],
		primary_action_label: __("Submit"),
		primary_action: function () {
			let comment = comment_dialog.get_values().comment;

			frappe.db
				.insert({
					doctype: "Comment",
					reference_doctype: "Lead",
					reference_name: leadName,
					content: comment,
					comment_type: "Comment",
				})
				.then(() => {
					comment_dialog.hide();
					frappe.show_alert({
						message: __("Comment added"),
						indicator: "green",
					});
				});
		},
	});

	comment_dialog.show();
}

/**
 * Confirm lead deletion with a dialog
 *
 * @param {string} leadName - The name of the lead
 */
function confirmLeadDeletion(leadName) {
	const delete_dialog = new frappe.ui.Dialog({
		title: __("Delete Lead"),
		fields: [
			{
				fieldtype: "HTML",
				fieldname: "warning",
				options: `
                  <div class="alert alert-danger">
                    <p><strong>Warning:</strong> This action cannot be undone.</p>
                    <p>Please type <strong>${leadName}</strong> to confirm deletion.</p>
                  </div>
                `,
			},
			{
				fieldtype: "Data",
				fieldname: "confirmation",
				label: __("Confirmation"),
				reqd: 1,
			},
		],
		primary_action_label: __("Delete"),
		primary_action: function () {
			const confirmation = delete_dialog.get_values().confirmation;

			if (confirmation === leadName) {
				frappe.db.delete_doc("Lead", leadName).then(() => {
					delete_dialog.hide();
					frappe.show_alert({
						message: __("Lead deleted"),
						indicator: "green",
					});

					cur_list.refresh();
				});
			} else {
				frappe.throw(__("Confirmation text does not match. Please try again."));
			}
		},
	});

	delete_dialog.get_primary_btn().prop("disabled", true);

	delete_dialog.fields_dict.confirmation.$input.on("input", function () {
		const value = $(this).val();
		delete_dialog.get_primary_btn().prop("disabled", value !== leadName);
	});

	delete_dialog.show();
}

/**
 * Helper function to refresh the kanban view
 */
function refreshKanbanView() {
	if (cur_list && typeof cur_list.refresh === "function") {
		cur_list.refresh();
	}
}
