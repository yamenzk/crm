/**
 * Handles the Not Interested Leads dialog functionality
 */

/**
 * Shows a dialog with all leads marked as "Not Interested"
 */
function showNotInterestedLeadsDialog() {
	frappe.db
		.get_list("Lead", {
			filters: {
				not_interested: 1,
			},
			fields: ["name", "full_name", "mobile", "modified"],
			limit: 100,
			order_by: "modified desc",
		})
		.then((leads) => {
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
          <div class="ni-leads-container">
            <table class="ni-leads-table">
              <thead>
                <tr>
                  <th class="ni-leads-checkbox-col">
                    <input type="checkbox" class="ni-leads-select-all">
                  </th>
                  <th class="ni-leads-name-col">${__("Lead Name")}</th>
                  <th class="ni-leads-mobile-col">${__("Mobile")}</th>
                </tr>
              </thead>
              <tbody>
                ${leads
					.map(
						(lead) => `
                  <tr class="ni-leads-row" data-name="${lead.name}">
                    <td><input type="checkbox" class="ni-leads-check" data-name="${
						lead.name
					}"></td>
                    <td>${lead.full_name || ""}</td>
                    <td>${lead.mobile || ""}</td>
                  </tr>
                `
					)
					.join("")}
              </tbody>
            </table>
          </div>
          <style>
            .ni-leads-container {
              max-height: 400px;
              overflow-y: auto;
              border-radius: var(--border-radius-md);
              border: 1px solid var(--border-color);
            }
            .ni-leads-table {
              width: 100%;
              border-collapse: collapse;
              font-family: var(--font-stack);
            }
            .ni-leads-table th {
              background-color: var(--control-bg);
              color: var(--text-color);
              font-weight: var(--weight-bold);
              padding: var(--padding-sm);
              text-align: left;
              position: sticky;
              top: 0;
              z-index: 1;
            }
            .ni-leads-checkbox-col {
              width: 40px;
              text-align: center;
            }
            .ni-leads-name-col {
              width: 60%;
            }
            .ni-leads-mobile-col {
              width: 40%;
            }
            .ni-leads-row {
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .ni-leads-row:hover {
              background-color: var(--control-bg-on-hover);
            }
            .ni-leads-row td {
              padding: var(--padding-sm);
              border-bottom: 1px solid var(--border-color);
            }
            .ni-leads-row:last-child td {
              border-bottom: none;
            }
            .ni-leads-select-all, .ni-leads-check {
              cursor: pointer;
              width: 16px;
              height: 16px;
              accent-color: var(--primary);
            }
          </style>
        `,
				},
			];

			// Create dialog
			const dialog = new frappe.ui.Dialog({
				title: __("Not Interested Leads"),
				fields: dialogFields,
				size: "medium",
				primary_action_label: __("Restore Selected"),
				primary_action: function () {
					restoreSelectedLeads(dialog);
				},
			});

			dialog.onshow = function () {
				dialog.$wrapper.find(".ni-leads-select-all").on("change", function () {
					const checked = $(this).prop("checked");
					dialog.$wrapper.find(".ni-leads-check").prop("checked", checked);
				});

				dialog.$wrapper.find(".ni-leads-row").on("click", function (e) {
					if (!$(e.target).is('input[type="checkbox"]')) {
						const $checkbox = $(this).find(".ni-leads-check");
						$checkbox.prop("checked", !$checkbox.prop("checked"));
					}
				});
			};

			dialog.show();
		})
		.catch((err) => {
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

	dialog.$wrapper.find(".ni-leads-check:checked").each(function () {
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

	const promises = selectedLeads.map((leadName) => {
		return frappe.db.set_value("Lead", leadName, {
			not_interested: 0,
			status: "New",
		});
	});

	Promise.all(promises)
		.then(() => {
			frappe.show_alert({
				message: __(`Successfully restored ${selectedLeads.length} leads`),
				indicator: "green",
			});

			cur_list.refresh();
		})
		.catch((err) => {
			console.error("Error restoring leads:", err);
			frappe.msgprint({
				title: __("Error"),
				message: __("An error occurred while restoring leads. Please try again."),
				indicator: "red",
			});
		});
}
