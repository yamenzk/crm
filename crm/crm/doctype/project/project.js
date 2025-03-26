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
	},

	after_save: function (frm) {
		// Refresh the dashboard after saving the project
		if (frm.dashboard_manager) {
			frm.dashboard_manager.refresh();
		}
	},
});
