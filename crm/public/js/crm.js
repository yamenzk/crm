// Keep the page-change handler for additional feather loading cases
$(document).on("page-change", function () {
	const route = frappe.get_route();
	if (
		route[0] === "List" &&
		route[1] === "Lead" &&
		route[2] === "Kanban" &&
		route[3] === "Leads"
	) {
		// Load the Lead Kanban handler
		frappe.require(["/assets/crm/js/lead_kanban/lead_kanban_handler.js"], function () {
			setupLeadKanban();
		});
	} else {
		// Clean up if we're navigating away from the Lead Kanban
		if (window.cleanupLeadKanban) {
			cleanupLeadKanban();
		}
	}
});
if (!window.feather) {
	const script = document.createElement("script");
	script.src = "https://unpkg.com/feather-icons/dist/feather.min.js";
	script.onload = function () {
		// Initialize feather icons once loaded
		feather.replace();
	};
	document.head.appendChild(script);
}