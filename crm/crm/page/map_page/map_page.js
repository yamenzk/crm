frappe.pages['map-page'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Map',
		single_column: true
	});
}