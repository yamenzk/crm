// Keep the page-change handler for additional feather loading cases
$(document).on("page-change", function () {
	const route = frappe.get_route();
	if (
		route[0] === "List" &&
		route[1] === "Lead" &&
		route[2] === "Kanban" &&
		route[3] === "Leads"
	) {
		frappe.require(["/assets/crm/js/lead_kanban/lead_kanban_handler.js"], function () {
			setupLeadKanban();
		});
	} else {
		if (window.cleanupLeadKanban) {
			cleanupLeadKanban();
		}
	}
});
if (!window.feather) {
	const script = document.createElement("script");
	script.src = "https://unpkg.com/feather-icons/dist/feather.min.js";
	script.onload = function () {
		feather.replace();
	};
	document.head.appendChild(script);
}