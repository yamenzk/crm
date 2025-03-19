/**
 * Handles the Not Interested Leads dialog functionality
 */

/**
 * Shows a dialog with all leads marked as "Not Interested"
 */
function showNotInterestedLeadsDialog() {
	// showLoadingOverlay("Loading Not Interested Leads");
	frappe.db
		.get_list("Lead", {
			filters: {
				not_interested: 1,
			},
			fields: ["name", "full_name", "company", "email", "mobile", "status", "modified"],
			limit: 100,
			order_by: "modified desc",
		})
		.then((leads) => {
			hideLoadingOverlay();

			if (leads.length === 0) {
				frappe.msgprint({
					title: __("No Not Interested Leads"),
					message: __("There are no leads currently marked as not interested."),
					indicator: "blue",
				});
				return;
			}

			const dialogFields = [
				{
					fieldtype: "HTML",
					fieldname: "leads_html",
					options: `
					<div class="not-interested-leads-container" style="max-height: 400px; overflow-y: auto;">
						<table class="table table-bordered" style="cursor: pointer;">
							<thead>
								<tr>
									<th style="width: 30px;">
										<input type="checkbox" class="select-all-leads">
									</th>
									<th>${__("Lead Name")}</th>
									<th>${__("Company")}</th>
									<th>${__("Email")}</th>
									<th>${__("Mobile")}</th>
									<th>${__("Last Updated")}</th>
								</tr>
							</thead>
							<tbody>
								${leads
									.map(
										(lead) => `
									<tr data-name="${lead.name}">
										<td><input type="checkbox" class="lead-check" data-name="${lead.name}"></td>
										<td>${lead.full_name || ""}</td>
										<td>${lead.company || ""}</td>
										<td>${lead.email || ""}</td>
										<td>${lead.mobile || ""}</td>
										<td>${frappe.datetime.prettyDate(lead.modified)}</td>
									</tr>
								`
									)
									.join("")}
							</tbody>
						</table>
					</div>
				`,
				},
			];

			// Create dialog
			const dialog = new frappe.ui.Dialog({
				title: __("Not Interested Leads"),
				fields: dialogFields,
				size: "large", 
				primary_action_label: __("Restore Selected Leads"),
				primary_action: function () {
					restoreSelectedLeads(dialog);
				},
			});

			dialog.onshow = function () {
				dialog.$wrapper.find(".select-all-leads").on("change", function () {
					const checked = $(this).prop("checked");
					dialog.$wrapper.find(".lead-check").prop("checked", checked);
				});

				dialog.$wrapper.find("tbody tr").on("click", function (e) {
					if (!$(e.target).is('input[type="checkbox"]')) {
						const $checkbox = $(this).find(".lead-check");
						$checkbox.prop("checked", !$checkbox.prop("checked"));
					}
				});
			};

			dialog.show();
		})
		.catch((err) => {
			// hideLoadingOverlay();
			console.error("Error fetching not interested leads:", err);
			frappe.msgprint({
				title: __("Error"),
				message: __("Could not fetch not interested leads. Please try again later."),
				indicator: "red",
			});
		});
}

/**
 * Restores selected leads by setting not_interested=0 and status="New"
 *
 * @param {Dialog} dialog - The Frappe dialog containing selected leads
 */
function restoreSelectedLeads(dialog) {
	const selectedLeads = [];

	dialog.$wrapper.find(".lead-check:checked").each(function () {
		selectedLeads.push($(this).data("name"));
	});

	if (selectedLeads.length === 0) {
		frappe.msgprint({
			title: __("No Leads Selected"),
			message: __("Please select at least one lead to restore."),
			indicator: "blue",
		});
		return;
	}

	dialog.hide();
	// showLoadingOverlay(`Restoring ${selectedLeads.length} leads...`);

	const promises = selectedLeads.map((leadName) => {
		return frappe.db.set_value("Lead", leadName, {
			not_interested: 0,
			status: "New",
		});
	});

	Promise.all(promises)
		.then(() => {
			// hideLoadingOverlay();

			frappe.show_alert({
				message: __(`Successfully restored ${selectedLeads.length} leads`),
				indicator: "green",
			});

			cur_list.refresh();
		})
		.catch((err) => {
			hideLoadingOverlay();

			console.error("Error restoring leads:", err);
			frappe.msgprint({
				title: __("Error"),
				message: __("An error occurred while restoring leads. Please try again."),
				indicator: "red",
			});
		});
}
