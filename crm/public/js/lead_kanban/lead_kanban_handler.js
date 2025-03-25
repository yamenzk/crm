/**
 * Setup Lead Kanban view with all required functionality
 */
window.setupLeadKanban = function () {
	$.getScript("/assets/crm/js/common/loading_overlay.js", function () {
		// showLoadingOverlay("Loading CRM Kanban");

		frappe.require(
			[
				"/assets/crm/js/common/realtime.js",
				"/assets/crm/js/common/context_menu.js",
				"/assets/crm/js/lead_kanban/context_menu.js",
				"/assets/crm/js/lead_kanban/not_interested_dialog.js",
			],
			function () {
				const featherPromise = new Promise((resolve) => {
					if (window.feather) {
						resolve();
					} else {
						$.ajax({
							url: "https://unpkg.com/feather-icons/dist/feather.min.js",
							dataType: "script",
							cache: true,
							success: resolve,
						});
					}
				});

				featherPromise.then(() => {
					setupKanbanView();

					setupKanbanRefreshObserver();

					setupRealtimeUpdates("Lead", defaultListRefresh);

					addCustomActionButtons();

					// hideLoadingOverlay();
				});
			}
		);
	});
};

/**
 * Apply customizations to the Kanban view
 */
function setupKanbanView() {
	applyKanbanCSS();

	$(".add-card").remove();
	$(".avatar-small .avatar-frame.avatar-action").closest(".avatar-small").remove();

	addContextMenuToKanbanCards();

	hideMenuForNonAdmins();
}

/**
 * Apply CSS to immediately hide unwanted elements
 */
function applyKanbanCSS() {
	$("#crm-kanban-style").remove();

	const isSystemManager = frappe.user.has_role("System Manager");
	const isCRMManager = frappe.user.has_role("CRM Manager");

	const menuCss = !isSystemManager
		? `
        .menu-btn-group {
            display: none !important;
        }
        `
		: "";

	const columnOptionsCss = !isCRMManager
		? `
        .kanban-column-header .column-options {
            display: none !important;
        }
        `
		: "";

	

	const styleElement = $(`
        <style id="crm-kanban-style">
            .kanban .add-card,
            .kanban .avatar-small .avatar-frame.avatar-action {
                display: none !important;
            }
            ${menuCss}
            ${columnOptionsCss}
        </style>
    `);

	$("head").append(styleElement);
}

/**
 * Hide the menu button for non-admin users
 */
function hideMenuForNonAdmins() {
	const isSystemManager = frappe.user.has_role("System Manager");
	const isCRMManager = frappe.user.has_role("CRM Manager");

	if (!isSystemManager) {
		$(".menu-btn-group").hide();
	}

	if (!isCRMManager) {
		$(".kanban-column-header .column-options").hide();
	}
}

/**
 * Sets up an observer to reapply customizations after Kanban refreshes
 */
function setupKanbanRefreshObserver() {
	if (window.kanbanRefreshObserver) {
		window.kanbanRefreshObserver.disconnect();
	}

	window.kanbanRefreshObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "childList" && mutation.addedNodes.length) {
				const addedNodes = Array.from(mutation.addedNodes);

				const cardAdded = addedNodes.some(
					(node) =>
						$(node).hasClass("kanban-card-wrapper") ||
						$(node).find(".kanban-card-wrapper").length
				);

				const buttonAdded = addedNodes.some(
					(node) =>
						$(node).hasClass("add-card") ||
						$(node).find(".add-card").length ||
						$(node).find(".avatar-small .avatar-frame.avatar-action").length
				);

				const menuAdded = addedNodes.some(
					(node) =>
						$(node).hasClass("standard-actions") ||
						$(node).find(".standard-actions").length ||
						$(node).find(".menu-btn-group").length
				);

				if (cardAdded || buttonAdded || menuAdded) {
					setupKanbanView();

					addCustomActionButtons();
				}
			}
		}
	});

	const kanbanContainer = $(".kanban");
	if (kanbanContainer.length) {
		window.kanbanRefreshObserver.observe(kanbanContainer[0], {
			childList: true,
			subtree: true,
		});
	}

	const pageActions = $(".page-actions");
	if (pageActions.length) {
		window.kanbanRefreshObserver.observe(pageActions[0], {
			childList: true,
			subtree: true,
		});
	}

	if (cur_list && typeof cur_list.refresh === "function" && !cur_list.refresh.__crm_patched) {
		const originalRefresh = cur_list.refresh;

		const patchedRefresh = function (...args) {
			applyKanbanCSS();

			const result = originalRefresh.apply(this, args);

			requestAnimationFrame(() => {
				setupKanbanView();
				addCustomActionButtons();
			});

			return result;
		};

		patchedRefresh.__crm_patched = true;
		patchedRefresh.__original = originalRefresh;

		cur_list.refresh = patchedRefresh;
	}
}

/**
 * Add custom action buttons to the page
 */
function addCustomActionButtons() {
	// Remove existing button to prevent duplicates
	$('.custom-action-btn[data-action="view-not-interested"]').remove();

	const $primaryActionBtn = $(".primary-action");

	const $notInterestedBtn = $(`
        <button class="btn btn-default btn-sm custom-action-btn" data-action="view-not-interested">
            <i data-feather="user-x" class="icon-sm"></i>
        </button>
    `);

	if ($primaryActionBtn.length) {
		$notInterestedBtn.insertBefore($primaryActionBtn);
	} else {
		$(".page-actions").append($notInterestedBtn);
	}

	if (window.feather) {
		feather.replace();
	}

	// Always reattach the event handler
	$("body").off("click", '.custom-action-btn[data-action="view-not-interested"]');
	$("body").on(
		"click",
		'.custom-action-btn[data-action="view-not-interested"]',
		showNotInterestedLeadsDialog
	);
}

/**
 * Clean up Lead Kanban resources
 */
window.cleanupLeadKanban = function () {
	if (window.unsubscribeFromAllRealtimeUpdates) {
		unsubscribeFromAllRealtimeUpdates();
	}

	if (window.kanbanRefreshObserver) {
		window.kanbanRefreshObserver.disconnect();
		window.kanbanRefreshObserver = null;
	}

	if (cur_list && cur_list.refresh && cur_list.refresh.__original) {
		cur_list.refresh = cur_list.refresh.__original;
	}

	$("#crm-kanban-style").remove();

	$(".custom-action-btn").remove();
};
