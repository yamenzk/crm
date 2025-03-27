frappe.pages["crm-user-manager"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "User Manager",
		single_column: true,
	});

	// Add page components and initialize
	page.userManager = new UserManager(page);
	let $btn = page.set_primary_action("New", () => page.userManager.showAddUserDialog(), "plus"); // Call on the instance
};

frappe.pages["crm-user-manager"].on_page_show = function (wrapper) {
	// Refresh the user list when page is shown
	if (wrapper.page.userManager) {
		wrapper.page.userManager.refresh();
	}
};

class UserManager {
	constructor(page) {
		this.page = page;
		this.wrapper = page.main;
		this.filters = {};

		this.make();
		this.refresh();
	}

	make() {
		// Check if user has required roles
		if (!this.hasRequiredRole()) {
			this.wrapper.html(`
                <div class="crm-user-manager-no-access">
                    <div class="icon-container">
                        <i class="fa fa-lock"></i>
                    </div>
                    <h3>${__("Access Denied")}</h3>
                    <p>${__(
						"You need to have CRM Admin or CRM Manager role to access this page."
					)}</p>
                </div>
            `);
			return;
		}

		// Create page layout
		$(this.wrapper).html(`
            <div class="crm-user-manager-container">
                <div class="crm-user-list-container">
                    <div class="crm-user-list"></div>
                    <div class="crm-user-list-loading text-center">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">${__("Loading users...")}</div>
                    </div>
                    <div class="crm-user-list-empty hide">
                        <div class="icon-container">
                            <i class="fa fa-users"></i>
                        </div>
                        <h3>${__("No Users Found")}</h3>
                        <p>${__("Try adjusting your filters or add a new user")}</p>
                    </div>
                </div>
            </div>
        `);
	}

	hasRequiredRole() {
		return frappe.user.has_role("CRM Admin") || frappe.user.has_role("CRM Manager");
	}

	refresh() {
		this.refreshUserList();
	}

	refreshUserList() {
		const me = this;
		const userList = $(".crm-user-list", this.wrapper);
		const loadingEl = $(".crm-user-list-loading", this.wrapper);
		const emptyEl = $(".crm-user-list-empty", this.wrapper);

		// Show loading
		userList.empty();
		loadingEl.removeClass("hide");
		emptyEl.addClass("hide");

		// Fetch users based on filters
		this.getUsers().then((users) => {
			loadingEl.addClass("hide");

			if (users.length === 0) {
				emptyEl.removeClass("hide");
				return;
			}

			// Render user cards
			users.forEach((user) => {
				const card = $(
					`<div class="crm-user-card ${user.enabled ? "" : "disabled"}" data-name="${
						user.name
					}">
                    <div class="crm-user-card-header">
                        <div class="user-avatar">
                            ${
								user.user_image
									? `<img src="${user.user_image}" alt="${
											user.full_name || user.name
									  }">`
									: `<div class="avatar-frame standard-image">
                                    ${
										user.full_name
											? user.full_name.charAt(0).toUpperCase()
											: user.name.charAt(0).toUpperCase()
									}
                                </div>`
							}
                            <div class="user-status ${user.enabled ? "active" : "inactive"}"></div>
                        </div>
                        <div>
                            <h3 class="user-name">${user.full_name || user.name}</h3>
                            <div class="user-email">${user.name}</div>
                        </div>
                    </div>
                    <div class="user-activity">
                        ${
							user.last_active
								? `<div class="last-active">${__(
										"Last active"
								  )}: ${frappe.datetime.prettyDate(user.last_active)}</div>`
								: `<div class="last-active">${__("Never logged in")}</div>`
						}
                        <div class="user-actions">
                            <button class="btn btn-sm btn-default view-user-btn" title="${__(
								"View Details"
							)}">
                                <i class="fa fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>`
				);

				userList.append(card);

				// Add click handler to the card
				card.on("click", function (e) {
					// Don't trigger if clicking on a button
					if (!$(e.target).closest("button").length) {
						me.showUserDetailsDialog(user.name);
					}
				});

				// Add button click handler
				card.find(".view-user-btn").on("click", function (e) {
					e.stopPropagation();
					me.showUserDetailsDialog(user.name);
				});
			});
		});
	}

	// Update the getUserCard function
	getUserCard(user) {
		// Get a colored avatar based on the user's name
		const userImage = user.user_image
			? `<img src="${user.user_image}" alt="${user.full_name || user.name}">`
			: `<div class="avatar-frame standard-image" style="background-color: var(--avatar-frame-bg);">
            ${
				user.full_name
					? user.full_name.charAt(0).toUpperCase()
					: user.name.charAt(0).toUpperCase()
			}
        </div>`;

		// Format last active time
		let lastActive = "";
		if (user.last_active) {
			lastActive = frappe.datetime.prettyDate(user.last_active);
		}

		// Get user roles as a comma-separated string
		let userRoles = "";
		if (user.role_profile_name) {
			userRoles = user.role_profile_name;
		} else if (user.roles && user.roles.length) {
			userRoles = user.roles.map((r) => r.role).join(", ");
		}

		return `
        <div class="crm-user-card ${user.enabled ? "" : "disabled"}" data-name="${user.name}">
            <div class="user-avatar">
                ${userImage}
                <div class="user-status ${user.enabled ? "active" : "inactive"}"></div>
            </div>
            <div class="user-info">
                <h3 class="user-name">${user.full_name || user.name}</h3>
                <div class="user-email">${user.name}</div>
                <div class="user-role">${userRoles || ""}</div>
            </div>
            <div class="user-activity">
                ${lastActive ? `<div class="last-active">Last active: ${lastActive}</div>` : ""}
                <div class="user-actions">
                    <button class="btn btn-sm btn-default view-user-btn" title="${__(
						"View Details"
					)}">
                        <i class="fa fa-eye"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
	}

	showAddUserDialog() {
		const me = this;

		// Get role profiles for the dropdown
		this.getRoleProfiles().then((profiles) => {
			const roleOptions = profiles.map((p) => ({
				label: p.role_profile,
				value: p.name,
			}));

			// Create the dialog
			const dialog = new frappe.ui.Dialog({
				title: __("Add New User"),
				fields: [
					{
						fieldtype: "Section Break",
						label: __("User Information"),
					},
					{
						fieldtype: "Data",
						fieldname: "email",
						label: __("Email"),
						reqd: 1,
						options: "Email",
					},
					{
						fieldtype: "Column Break",
					},
					{
						fieldtype: "Data",
						fieldname: "new_password",
						label: __("Password"),
						reqd: 1,
						toggle_password: true,
					},
					{
						fieldtype: "Section Break",
						label: __("User Details"),
					},
					{
						fieldtype: "Data",
						fieldname: "first_name",
						label: __("First Name"),
						reqd: 1,
					},
					{
						fieldtype: "Data",
						fieldname: "last_name",
						label: __("Last Name"),
						reqd: 1,
					},
					{
						fieldtype: "Column Break",
					},
					{
						fieldtype: "Select",
						fieldname: "role_profile",
						label: __("Role Profile"),
						options: roleOptions,
						reqd: 1,
					},
					{
						fieldtype: "Section Break",
						label: __("Profile Image"),
					},
					{
						fieldtype: "Attach Image",
						fieldname: "user_image",
						label: __("User Image"),
						description: __("Max file size: 2MB"),
					},
				],
				primary_action_label: __("Create User"),
				primary_action: (values) => {
					dialog.hide();
					me.createUser(values);
				},
			});

			dialog.show();
		});
	}

	showUserDetailsDialog(userName) {
		const me = this;

		// Fetch user details
		frappe.call({
			method: "frappe.client.get",
			args: {
				doctype: "User",
				name: userName,
			},
			callback: function (r) {
				if (r.message) {
					const user = r.message;

					// Prepare user roles display
					let rolesHTML = "";
					if (user.role_profile_name) {
						rolesHTML += `<div class="user-role-profile">${user.role_profile_name}</div>`;
					}

					if (user.roles && user.roles.length) {
						rolesHTML += '<div class="user-roles-list">';
						user.roles.forEach((role) => {
							rolesHTML += `<span class="user-role-badge">${role.role}</span>`;
						});
						rolesHTML += "</div>";
					}

					// Create the dialog
					const dialog = new frappe.ui.Dialog({
						title: __("User Details"),
						fields: [
							{
								fieldtype: "HTML",
								fieldname: "user_details",
								options: `
                                    <div class="user-details-container">
                                        <div class="user-header">
                                            <div class="user-avatar-large">
												${
													user.user_image
														? `<img src="${user.user_image}" alt="${
																user.full_name || user.name
														  }">`
														: `<div class="avatar-frame standard-image" style="background-color: var(--avatar-frame-bg); font-size: 24px;">
														${user.full_name ? user.full_name.charAt(0).toUpperCase() : user.name.charAt(0).toUpperCase()}
													</div>`
												}
											</div>
                                            <div class="user-info-large">
                                                <h3>${user.full_name || user.name}</h3>
                                                <div class="user-email-large">${user.name}</div>
                                                <div class="user-status-indicator ${
													user.enabled ? "active" : "inactive"
												}">
                                                    ${user.enabled ? __("Active") : __("Disabled")}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="user-details-section">
                                            <h4>${__("User Details")}</h4>
                                            <div class="user-detail-row">
                                                <div class="detail-label">${__("First Name")}</div>
                                                <div class="detail-value">${
													user.first_name || "-"
												}</div>
                                            </div>
                                            <div class="user-detail-row">
                                                <div class="detail-label">${__("Last Name")}</div>
                                                <div class="detail-value">${
													user.last_name || "-"
												}</div>
                                            </div>
                                            <div class="user-detail-row">
                                                <div class="detail-label">${__("Mobile No")}</div>
                                                <div class="detail-value">${
													user.mobile_no || "-"
												}</div>
                                            </div>
                                            <div class="user-detail-row">
                                                <div class="detail-label">${__("Created On")}</div>
                                                <div class="detail-value">${
													frappe.datetime.str_to_user(user.creation) ||
													"-"
												}</div>
                                            </div>
                                            <div class="user-detail-row">
                                                <div class="detail-label">${__("Last Login")}</div>
                                                <div class="detail-value">${
													user.last_login
														? frappe.datetime.str_to_user(
																user.last_login
														  )
														: "-"
												}</div>
                                            </div>
                                        </div>
                                        
                                        <div class="user-details-section">
                                            <h4>${__("Roles")}</h4>
                                            <div class="user-roles-container">
                                                ${rolesHTML || __("No roles assigned")}
                                            </div>
                                        </div>
                                    </div>
                                `,
							},
						],
						primary_action_label: __("Edit User"),
						primary_action: () => {
							dialog.hide();
							me.showEditUserDialog(user);
						},
						secondary_action_label: user.enabled
							? __("Disable User")
							: __("Enable User"),
						secondary_action: () => {
							me.toggleUserStatus(user);
							dialog.hide();
						},
					});

					dialog.show();
				}
			},
		});
	}

	showEditUserDialog(user) {
		const me = this;

		// Get role profiles for the dropdown
		this.getRoleProfiles().then((profiles) => {
			const roleOptions = profiles.map((p) => ({
				label: p.role_profile,
				value: p.name,
			}));

			// Create the dialog
			const dialog = new frappe.ui.Dialog({
				title: __("Edit User"),
				fields: [
					{
						fieldtype: "Section Break",
						label: __("User Information"),
					},
					{
						fieldtype: "Data",
						fieldname: "email",
						label: __("Email"),
						read_only: 1,
						default: user.name,
					},
					{
						fieldtype: "Data",
						fieldname: "new_password",
						label: __("New Password"),
						toggle_password: true,
					},
					{
						fieldtype: "Section Break",
						label: __("User Details"),
					},
					{
						fieldtype: "Data",
						fieldname: "first_name",
						label: __("First Name"),
						reqd: 1,
						default: user.first_name,
					},
					{
						fieldtype: "Data",
						fieldname: "last_name",
						label: __("Last Name"),
						reqd: 1,
						default: user.last_name,
					},
					{
						fieldtype: "Column Break",
					},
					{
						fieldtype: "Data",
						fieldname: "mobile_no",
						label: __("Mobile No"),
						default: user.mobile_no,
					},
					{
						fieldtype: "Select",
						fieldname: "role_profile",
						label: __("Role Profile"),
						options: roleOptions,
						default: user.role_profile_name,
					},
					{
						fieldtype: "Section Break",
						label: __("Profile Image"),
					},
					{
						fieldtype: "Attach Image",
						fieldname: "user_image",
						label: __("User Image"),
						description: __("Max file size: 2MB"),
						default: user.user_image || "",
					},
				],
				primary_action_label: __("Update User"),
				primary_action: (values) => {
					dialog.hide();
					me.updateUser(user.name, values);
				},
			});

			dialog.show();
		});
	}

	createUser(values) {
		const me = this;

		frappe.call({
			method: "frappe.client.insert",
			args: {
				doc: {
					doctype: "User",
					email: values.email,
					first_name: values.first_name,
					last_name: values.last_name,
					enabled: 1,
					role_profile_name: values.role_profile,
					module_profile: "CRM",
					send_welcome_email: 0,
					timezone: "Asia/Dubai",
					new_password: values.new_password,
					default_app: "crm",
					user_image: values.user_image || null,
				},
			},
			callback: function (r) {
				if (r.message) {
					frappe.show_alert({
						message: __("User created successfully"),
						indicator: "green",
					});
					me.refreshUserList();
				}
			},
		});
	}

	updateUser(userName, values) {
		const me = this;
		const updateData = {
			first_name: values.first_name,
			last_name: values.last_name,
			mobile_no: values.mobile_no,
			role_profile_name: values.role_profile,
			user_image: values.user_image || null,
		};

		// Only include password if it was provided
		if (values.new_password) {
			updateData.new_password = values.new_password;
		}

		frappe.call({
			method: "frappe.client.set_value",
			args: {
				doctype: "User",
				name: userName,
				fieldname: updateData,
			},
			callback: function (r) {
				if (r.message) {
					frappe.show_alert({
						message: __("User updated successfully"),
						indicator: "green",
					});
					me.refreshUserList();
				}
			},
		});
	}

	toggleUserStatus(user) {
		const me = this;
		const newStatus = !user.enabled;

		frappe.call({
			method: "frappe.client.set_value",
			args: {
				doctype: "User",
				name: user.name,
				fieldname: "enabled",
				value: newStatus ? 1 : 0,
			},
			callback: function (r) {
				if (r.message) {
					frappe.show_alert({
						message: newStatus
							? __("User enabled successfully")
							: __("User disabled successfully"),
						indicator: "green",
					});
					me.refreshUserList();
				}
			},
		});
	}

	getUsers() {
		const filters = [
			["name", "!=", "Administrator"],
			["module_profile", "=", "CRM"],
		];

		// Apply search filter
		if (this.filters.search) {
			filters.push([
				"or",
				[["name", "like", `%${this.filters.search}%`]],
				[["full_name", "like", `%${this.filters.search}%`]],
			]);
		}

		// Apply role filter
		if (this.filters.role_profile) {
			filters.push(["role_profile_name", "=", this.filters.role_profile]);
		}

		// Apply status filter
		if (this.filters.enabled !== undefined && this.filters.enabled !== "") {
			filters.push(["enabled", "=", parseInt(this.filters.enabled)]);
		}

		return new Promise((resolve) => {
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "User",
					filters: filters,
					fields: [
						"name",
						"enabled",
						"first_name",
						"last_name",
						"full_name",
						"user_image",
						"role_profile_name",
						"last_active",
						"last_login",
						"roles",
					],
					limit: 100,
					order_by: "creation desc",
				},
				callback: function (r) {
					resolve(r.message || []);
				},
			});
		});
	}

	getRoleProfiles() {
		return new Promise((resolve) => {
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Role Profile",
					filters: [
						["name", "in", ["Team Leader", "Sales", "Reception", "Manager", "Admin"]],
					],
					fields: ["name", "role_profile", "roles"],
					limit: 50,
				},
				callback: function (r) {
					resolve(r.message || []);
				},
			});
		});
	}
}

// Add styles
frappe.pages["crm-user-manager"].on_page_show = function () {
	// Add CSS if it doesn't exist
	if (!document.getElementById("crm-user-manager-styles")) {
		const style = document.createElement("style");
		style.id = "crm-user-manager-styles";
		style.innerHTML = `
            /* User Manager Styles */
            .crm-user-manager-container {
                padding: 15px 0;
            }
            
            .crm-user-manager-filters {
                padding: 10px;
                margin-bottom: 20px;
                background-color: var(--fg-color);
                border-bottom: 1px solid var(--border-color);
				display: flex;
				justify-content: space-between;
				align-items: center;
            }
            
            .crm-user-list-container {
                position: relative;
                min-height: 200px;
            }
            
            .crm-user-list-loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
            }
            
            .loading-spinner {
                display: inline-block;
                width: 40px;
                height: 40px;
                border: 3px solid var(--gray-200);
                border-radius: 50%;
                border-top-color: var(--primary);
                animation: spin 1s linear infinite;
                margin-bottom: 10px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .crm-user-list-empty {
                text-align: center;
                padding: 50px 20px;
                color: var(--text-muted);
            }
            
            .crm-user-list-empty .icon-container,
            .crm-user-manager-no-access .icon-container {
                font-size: 48px;
                margin-bottom: 15px;
                color: var(--gray-400);
            }
            
            .crm-user-manager-no-access {
                text-align: center;
                padding: 100px 20px;
                color: var(--text-muted);
            }

			.crm-user-list {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
				gap: 15px;
				padding: var(--padding-lg);
			}
						
            .crm-user-card {
				display: flex;
				flex-direction: column;
				padding: 0;
				margin-bottom: 0;
				background-color: var(--fg-color);
				border-radius: var(--border-radius-md);
				box-shadow: var(--shadow-sm);
				transition: all 0.2s;
				cursor: pointer;
				border: 1px solid var(--border-color);
				height: 100%;
				overflow: hidden;
			}

			.crm-user-card:hover {
				box-shadow: var(--shadow-md);
				transform: translateY(-2px);
			}

			.crm-user-card.disabled {
				opacity: 0.7;
				background-color: var(--control-bg);
			}
            
            .crm-user-card-header {
				display: flex;
				align-items: center;
				padding: 15px;
				border-bottom: 1px solid var(--border-color);
			}

			.user-avatar {
				width: 50px;
				height: 50px;
				border-radius: 50%;
				margin-right: 15px;
				position: relative;
				overflow: hidden;
				background-color: var(--avatar-frame-bg);
				flex-shrink: 0;
			}

			.user-avatar img,
			.user-avatar .avatar-frame {
				width: 100%;
				height: 100%;
				object-fit: cover;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: bold;
				color: var(--gray-900);
			}

			.user-status {
				position: absolute;
				bottom: 0;
				right: 0;
				width: 12px;
				height: 12px;
				border-radius: 50%;
				border: 2px solid var(--fg-color);
			}

			.user-status.active {
				background-color: var(--green-500);
			}

			.user-status.inactive {
				background-color: var(--red-500);
			}

			/* Card content */
			.user-info {
				flex: 1;
				padding: 15px;
			}

			.user-name {
				font-size: 16px;
				font-weight: 500;
				margin: 0 0 8px 0;
				color: var(--text-color);
			}

			.user-email {
				font-size: 13px;
				color: var(--text-muted);
				margin-bottom: 8px;
			}

			.user-role {
				font-size: 12px;
				display: inline-block;
				padding: 3px 8px;
				background-color: var(--control-bg);
				border-radius: 10px;
				color: var(--text-color);
			}
            
            .user-activity {
				padding: 10px 15px 15px;
				background-color: var(--subtle-fg);
				border-top: 1px solid var(--border-color);
				display: flex;
				justify-content: space-between;
				align-items: center;
			}

			.last-active {
				font-size: 12px;
				color: var(--text-muted);
			}

			.user-actions {
				display: flex;
				gap: 5px;
			}
            
            .hide {
                display: none !important;
            }
            
            /* User Details Dialog */
            .user-details-container {
                padding: 15px 0;
            }
            
            .user-header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .user-avatar-large {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                margin-right: 20px;
                overflow: hidden;
                box-shadow: 0 0 0 1px var(--border-color);
            }
            
            .user-avatar-large img,
            .user-avatar-large .avatar-frame {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .user-info-large h3 {
                margin: 0 0 5px 0;
                font-size: 20px;
                font-weight: 500;
                color: var(--text-color);
            }
            
            .user-email-large {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 8px;
            }
            
            .user-status-indicator {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .user-status-indicator.active {
                background-color: var(--green-100);
                color: var(--green-700);
            }
            
            .user-status-indicator.inactive {
                background-color: var(--red-100);
                color: var(--red-700);
            }
            
            .user-details-section {
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid var(--border-color);
            }
            
            .user-details-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            
            .user-details-section h4 {
                font-size: 16px;
                font-weight: 500;
                margin: 0 0 15px 0;
                color: var(--heading-color);
            }
            
            .user-detail-row {
                display: flex;
                margin-bottom: 8px;
            }
            
            .detail-label {
                width: 120px;
                color: var(--text-muted);
                font-size: 13px;
            }
            
            .detail-value {
                flex: 1;
                color: var(--text-color);
                font-size: 13px;
            }
            
            .user-roles-container {
                margin-top: 10px;
            }
            
            .user-role-profile {
                margin-bottom: 8px;
                font-weight: 500;
            }
            
            .user-role-badge {
                display: inline-block;
                padding: 3px 8px;
                margin: 0 5px 5px 0;
                border-radius: 10px;
                font-size: 11px;
                background-color: var(--control-bg);
                color: var(--text-color);
            }
        `;
		document.head.appendChild(style);
	}
};
