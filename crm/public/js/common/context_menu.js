
/**
 * Generic context menu utility for CRM app
 */
window.CRMContextMenu = {
	/**
	 * Create and show a context menu at the specified position
	 *
	 * @param {Object} options - Configuration options for the context menu
	 * @param {number} options.x - X position for the menu
	 * @param {number} options.y - Y position for the menu
	 * @param {Array} options.sections - Array of menu sections, each containing menu items
	 * @param {string} options.menuClass - Additional CSS class for the menu (optional)
	 * @param {Function} options.onItemClick - Callback when a menu item is clicked (optional)
	 * @param {Function} options.afterRender - Callback after menu is rendered (optional)
	 * @returns {jQuery} The created menu element
	 */
	create: function (options) {
		// Remove any existing context menus
		$(".crm-context-menu").remove();

		// Build menu sections HTML
		let sectionsHtml = "";

		options.sections.forEach((section) => {
			sectionsHtml += '<ul class="crm-menu-list">';

			section.items.forEach((item) => {
				const iconHtml = item.icon ? `<i data-feather="${item.icon}"></i>` : "";
				const disabledClass = item.disabled ? "disabled" : "";
				const disabledAttr = item.disabled ? "disabled" : "";
				const dataAction = item.action || "";
				const dataExtra = item.data
					? Object.entries(item.data)
							.map(([key, value]) => `data-${key}="${value}"`)
							.join(" ")
					: "";

				sectionsHtml += `
                <li class="crm-menu-item">
                    <button class="crm-menu-button ${item.cssClass || ""} ${disabledClass}" 
                            data-action="${dataAction}" ${disabledAttr} ${dataExtra}>
                        ${iconHtml}
                        ${item.label}
                    </button>
                </li>`;
			});

			sectionsHtml += "</ul>";
		});

		// Create menu element
		const menuClass = options.menuClass ? ` ${options.menuClass}` : "";
		const contextMenu = $(`
            <div class="crm-context-menu${menuClass}">
                <div class="crm-menu" style="left: ${options.x}px; top: ${options.y}px;">
                    ${sectionsHtml}
                </div>
            </div>
        `);

		// Append to body
		$("body").append(contextMenu);

		// Initialize Feather icons if available
		if (window.feather) {
			feather.replace();
		}

		// Set up click handlers
		contextMenu.find(".crm-menu-button").on("click", function () {
			if ($(this).hasClass("disabled")) return;

			const action = $(this).data("action");

			if (typeof options.onItemClick === "function") {
				// Call the provided callback with the action and the button element
				options.onItemClick(action, $(this));
			}

			// Remove the menu after an action is clicked
			$(".crm-context-menu").remove();
		});

		// Setup document click to close menu
		$(document).on("click", function removeMenu(e) {
			// Don't close if clicking inside the menu
			if ($(e.target).closest(".crm-context-menu").length === 0) {
				$(".crm-context-menu").remove();
				$(document).off("click", removeMenu);
			}
		});

		// Call the afterRender callback if provided
		if (typeof options.afterRender === "function") {
			options.afterRender(contextMenu);
		}

		return contextMenu;
	},

	/**
	 * Attach a context menu to elements matching a selector
	 *
	 * @param {Object} options - Configuration options
	 * @param {string} options.selector - CSS selector for elements to attach menu to
	 * @param {Function} options.menuBuilder - Function that returns menu configuration
	 */
	attach: function (options) {
		$(document).on("contextmenu", options.selector, function (e) {
			e.preventDefault();

			// Call the menuBuilder function with the element and event
			const menuConfig = options.menuBuilder($(this), e);

			// Set position from event if not specified
			if (!menuConfig.x) menuConfig.x = e.pageX;
			if (!menuConfig.y) menuConfig.y = e.pageY;

			// Create and show the menu
			CRMContextMenu.create(menuConfig);
		});
	},
};
