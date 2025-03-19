


let activeSubscriptions = {};

/**
 * Set up realtime updates for a specific doctype
 * @param {string} doctype - The doctype to subscribe to
 * @param {function} refreshCallback - Function to call when updates are received
 */
window.setupRealtimeUpdates = function (doctype, refreshCallback) {
	
	const eventName = `${doctype.toLowerCase()}_update`;

	
	if (activeSubscriptions[doctype]) return;

	
	const callback = (data) => {
		
		const route = frappe.get_route();
		if (route[0] === "List" && route[1] === doctype) {
			refreshCallback(data);
		}
	};

	
	activeSubscriptions[doctype] = callback;

	
	frappe.realtime.on(eventName, callback);

};

/**
 * Unsubscribe from realtime updates for a specific doctype
 * @param {string} doctype - The doctype to unsubscribe from
 */
window.unsubscribeFromRealtimeUpdates = function (doctype) {
	
	if (!activeSubscriptions[doctype]) return;

	const eventName = `${doctype.toLowerCase()}_update`;

	
	frappe.realtime.off(eventName, activeSubscriptions[doctype]);

	
	delete activeSubscriptions[doctype];

};

/**
 * Unsubscribe from all active realtime updates
 */
window.unsubscribeFromAllRealtimeUpdates = function () {
	for (const doctype in activeSubscriptions) {
		unsubscribeFromRealtimeUpdates(doctype);
	}
};

/**
 * Default refresh function for list views
 */
window.defaultListRefresh = function () {
	if (cur_list && typeof cur_list.refresh === "function") {
		cur_list.refresh();
	}
};
