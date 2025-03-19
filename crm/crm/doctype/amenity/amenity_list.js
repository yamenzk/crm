frappe.listview_settings["Amenity"] = {
	isTagViewActive: true, // Track the current view mode
	$tagViewContainer: null, // Store reference to tag container

	refresh: function (listview) {
		// Setup tag view only once to avoid duplication
		if (!this.$tagViewContainer) {
			this.setupTagView(listview);
		} else {
			// Apply the current view state
			this.toggleView(listview, this.isTagViewActive);

			// Refresh tags if in tag view
			if (this.isTagViewActive) {
				this.loadTags(listview);
			}
		}
	},

	setupTagView: function (listview) {
		const $toggleButton = $(`
        <button class="btn btn-secondary btn-sm crm-tag-view-toggle active" title="Toggle Tag View">
            <svg class="icon icon-sm">
                <use href="#icon-tag"></use>
            </svg>
        </button>
    `);
		const $installButton = $(`
        <button class="btn btn-default btn-sm install-amenities-btn" title="Install Common Amenities">
            <svg class="icon icon-sm">
                <use href="#icon-list-alt"></use>
            </svg>
        </button>
    `);

		listview.page.standard_actions.find(".primary-action").before($installButton);
        listview.page.standard_actions.find(".page-icon-group").before($toggleButton);
		
        
        // Create tag view container
		this.$tagViewContainer = $(`
            <div class="crm-amenity-tag-view">
                <div class="crm-amenity-tags-container"></div>
            </div>
        `).insertBefore(listview.$result);

		// Toggle between list view and tag view on button click
		$toggleButton.on("click", () => {
			this.isTagViewActive = !this.isTagViewActive;
			this.toggleView(listview, this.isTagViewActive);
			$toggleButton.toggleClass("active", this.isTagViewActive);
		});

		// Install common amenities on button click
		$installButton.on("click", () => {
			frappe.msgprint({
				title: __("Import Amenities"),
				message: __(
					"Are you sure you want to import common amenities? This will create amenity records from the default list."
				),
				primary_action: {
					label: __("Proceed"),
					server_action: "crm.crm.doctype.amenity.amenity.import_common_amenities",
					args: {},
				},
			});
		});

		// Initial load of tags
		this.loadTags(listview);

		// Apply initial view state
		this.toggleView(listview, this.isTagViewActive);
		$toggleButton.toggleClass("active", this.isTagViewActive);

		// Make tag view respond to existing filters
		if (listview.filter_area && listview.filter_area.$filter_list) {
			listview.filter_area.$filter_list.on("change", () => {
				if (this.isTagViewActive) {
					this.loadTags(listview);
				}
			});
		}

		// Listen for sort changes
		if (listview.sort_selector && listview.sort_selector.$dropdown) {
			listview.sort_selector.$dropdown.on("click", "li", () => {
				if (this.isTagViewActive) {
					setTimeout(() => this.loadTags(listview), 100);
				}
			});
		}

		// Listen for search input
		$(listview.page.page_form)
			.find('input[data-fieldname="name"]')
			.on("input", () => {
				if (this.isTagViewActive) {
					// Wait a bit for the list filtering to apply
					clearTimeout(this.searchTimeout);
					this.searchTimeout = setTimeout(() => this.loadTags(listview), 300);
				}
			});
	},

	toggleView: function (listview, showTagView) {
		if (showTagView) {
			listview.$result.hide();
			$(".list-paging-area").hide();
			this.$tagViewContainer.show();
		} else {
			listview.$result.show();
			$(".list-paging-area").show();
			this.$tagViewContainer.hide();
		}
	},

	loadTags: function (listview) {
		const $container = this.$tagViewContainer.find(".crm-amenity-tags-container");
		$container.html(`
            <div class="crm-amenity-loading">
                <span class="crm-amenity-loading-spinner">
                    <svg class="icon icon-sm"><use href="#icon-refresh"></use></svg>
                </span>
                Loading amenities...
            </div>
        `);

		// Build filters based on listview's current filters
		let filters = [];
		if (listview.filter_area) {
			filters = listview.filter_area.get();
		}

		// Get current sort
		let order_by = "";
		if (listview.sort_selector) {
			order_by = listview.sort_selector.get_sql_string();
		}

		// Add search filter if present
		const searchValue = $(listview.page.page_form).find('input[data-fieldname="name"]').val();
		if (searchValue) {
			filters.push(["name", "like", "%" + searchValue + "%"]);
		}

		frappe.call({
			method: "frappe.desk.reportview.get",
			args: {
				doctype: "Amenity",
				fields: ["name", "amenity", "icon", "modified"],
				filters: filters,
				order_by: order_by,
				limit_page_length: 999,
			},
			callback: (r) => {
				$container.empty();

				if (r.message && r.message.values && r.message.values.length) {
					const data = r.message.values.map((row, i) => {
						let obj = {};
						r.message.keys.forEach((key, j) => {
							obj[key] = row[j];
						});
						return obj;
					});

					data.forEach((doc) => {
						const $tag = $(`
                            <div class="crm-amenity-tag" data-name="${doc.name}">
                                <div class="crm-amenity-tag-icon">
                                    ${doc.icon ? `<i data-feather="${doc.icon}"></i>` : ""}
                                </div>
                                <span class="crm-amenity-tag-label">${
									doc.amenity || doc.name
								}</span>
                            </div>
                        `);

						$tag.on("click", () => {
							frappe.set_route("Form", "Amenity", doc.name);
						});

						$container.append($tag);
					});

					if (window.feather) {
						feather.replace();
					}
				} else {
					$container.html('<div class="crm-amenity-empty">No amenities found</div>');
				}
			},
		});
	},
};
