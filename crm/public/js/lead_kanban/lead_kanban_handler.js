frappe.listview_settings["Amenity"] = {
	page_length: 50,
	refresh: function (listview) {
		// Add the "Install Common Amenities" button
		listview.page.add_inner_button("Install Common Amenities", function () {
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

		// Add toggle view button
		this.setupTagView(listview);
	},

	setupTagView: function (listview) {
		// Create toggle button with icon only
		const $toggleButton = $(`
			<button class="btn btn-default btn-sm toggle-view-button" title="Toggle Tag View">
				<svg class="icon icon-sm">
					<use href="#icon-tag"></use>
				</svg>
			</button>
		`);

		// Insert button before the standard actions buttons
		listview.page.custom_actions.prepend($toggleButton);

		// Create tag view container
		const $tagViewContainer = $(`
			<div class="amenity-tag-view" style="display: none; padding: 15px 0;">
				<div class="amenity-tags-container" style="display: flex; flex-wrap: wrap; gap: 10px;"></div>
			</div>
		`).insertBefore(listview.$result);

		// Add custom CSS for tag styling
		$(`<style>
			.amenity-tag {
				display: inline-flex;
				align-items: center;
				padding: 8px 15px;
				border-radius: 6px;
				background-color: var(--control-bg);
				border: 1px solid var(--border-color);
				cursor: pointer;
				transition: all 0.2s;
				box-shadow: 0 1px 3px rgba(0,0,0,0.05);
			}
			.amenity-tag:hover {
				box-shadow: 0 2px 5px rgba(0,0,0,0.1);
				transform: translateY(-2px);
				background-color: var(--fg-hover-color);
			}
			.amenity-tag-icon {
				margin-right: 8px;
			}
			.amenity-tag-label {
				font-weight: 500;
			}
		</style>`).appendTo("head");

		// Toggle between list view and tag view on button click
		let isTagView = true; // Start with tag view as default
		this.toggleView(listview, isTagView, $tagViewContainer);

		$toggleButton.on(
			"click",
			function () {
				isTagView = !isTagView;
				this.toggleView(listview, isTagView, $tagViewContainer);
			}.bind(this)
		);

		// Initial load of tags
		this.loadTags($tagViewContainer.find(".amenity-tags-container"));
	},

	toggleView: function (listview, showTagView, $tagViewContainer) {
		if (showTagView) {
			listview.$result.hide();
			$(".list-paging-area").hide();
			$tagViewContainer.show();
			// Load tags if container is empty
			if ($tagViewContainer.find(".amenity-tags-container").children().length === 0) {
				this.loadTags($tagViewContainer.find(".amenity-tags-container"));
			}
		} else {
			listview.$result.show();
			$(".list-paging-area").show();
			$tagViewContainer.hide();
		}
	},

	loadTags: function ($container) {
		$container.empty().append('<div class="text-muted">Loading amenities...</div>');

		// Fetch all amenities
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Amenity",
				fields: ["name", "amenity", "icon"],
				limit: 0,
			},
			callback: function (r) {
				$container.empty();

				if (r.message && r.message.length) {
					r.message.forEach(function (doc) {
						const $tag = $(`
							<div class="amenity-tag" data-name="${doc.name}">
								<div class="amenity-tag-icon">
									${doc.icon ? `<i data-feather="${doc.icon}"></i>` : ""}
								</div>
								<span class="amenity-tag-label">${doc.amenity || doc.name}</span>
							</div>
						`);

						$tag.on("click", function () {
							frappe.set_route("Form", "Amenity", doc.name);
						});

						$container.append($tag);
					});

					// Replace Feather icons
					if (window.feather) {
						feather.replace();
					}
				} else {
					$container.html('<div class="text-muted">No amenities found</div>');
				}
			},
		});
	},
};
