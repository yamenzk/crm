class ProjectDashboard {
	constructor(frm) {
		this.frm = frm;
		this.project = frm.doc;
		this.buildings = [];
		this.units = [];
		this.map = null;
		this.projectLayer = null;
		this.buildingMarkers = {};
		this.buildingMap = null;
		this.locationMap = null;
		this.drawedItems = null;
		this.selectedBuilding = null; // Add this for building filtering
		this.filters = {
			status: "",
			bedrooms: "",
			areaMin: 0,
			areaMax: 10000,
		};
	}

	init() {
		// Load required libraries
		this.loadDependencies().then(() => {
			this.renderDashboard();
			this.fetchData().then(() => {
				this.renderMap();
				this.renderBuildingsList();
				this.renderUnitsList();
			});
		});
	}

	loadDependencies() {
		return new Promise((resolve) => {
			// Load Leaflet CSS
			if (!document.getElementById("leaflet-css")) {
				const leafletCss = document.createElement("link");
				leafletCss.id = "leaflet-css";
				leafletCss.rel = "stylesheet";
				leafletCss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
				document.head.appendChild(leafletCss);
			}

			// Load Leaflet Draw CSS
			if (!document.getElementById("leaflet-draw-css")) {
				const leafletDrawCss = document.createElement("link");
				leafletDrawCss.id = "leaflet-draw-css";
				leafletDrawCss.rel = "stylesheet";
				leafletDrawCss.href =
					"https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/0.4.2/leaflet.draw.css";
				document.head.appendChild(leafletDrawCss);
			}

			// Load Leaflet JS
			if (typeof L === "undefined") {
				const leafletScript = document.createElement("script");
				leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
				leafletScript.onload = () => {
					// Load Leaflet Draw JS after Leaflet is loaded
					const leafletDrawScript = document.createElement("script");
					leafletDrawScript.src =
						"https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/0.4.2/leaflet.draw.js";
					leafletDrawScript.onload = () => {
						if (window.feather) {
							feather.replace();
						}
						resolve();
					};
					document.head.appendChild(leafletDrawScript);
				};
				document.head.appendChild(leafletScript);
			} else {
				// Both libraries are already loaded
				if (window.feather) {
					feather.replace();
				}
				resolve();
			}

			// Load context menu if not already loaded
			frappe.require("/assets/crm/js/common/context_menu.js", () => {
				console.log("Context menu loaded");
			});
		});
	}

	renderDashboard() {
		const hasCoords = !!this.project.coords;
		const coverPhotoHtml = this.project.cover_photo
			? `<div class="crm-project-cover" style="background-image: url('${this.project.cover_photo}')"></div>`
			: '<div class="crm-project-cover-placeholder"><i data-feather="image" style="width: 32px; height: 32px; color: var(--gray-400);"></i></div>';

		// Format amenities
		let amenitiesHtml = "";
		if (this.project.project_amenities && this.project.project_amenities.length > 0) {
			const totalAmenities = this.project.amenities || this.project.project_amenities.length;
			const displayCount = Math.min(7, this.project.project_amenities.length);
			const moreCount = totalAmenities - displayCount;

			// Get the amenities to display
			const displayAmenities = this.project.project_amenities.slice(0, displayCount);
			const amenityNames = displayAmenities.map((a) => a.amenity);

			// Fetch all icons in one call
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Amenity",
					filters: [["name", "in", amenityNames]],
					fields: ["name", "icon"],
				},
				callback: (response) => {
					if (response.message) {
						console.log(response.message);
						// Create a map of name -> icon
						const iconMap = {};
						response.message.forEach((item) => {
							iconMap[item.name] = item.icon;
						});

						// Build HTML
						let amenitiesHtml = '<div class="crm-project-amenities">';

						displayAmenities.forEach((amenity) => {
							const amenity_icon = iconMap[amenity.amenity];
							if (amenity_icon) {
								amenitiesHtml += `<span class="crm-project-amenity-tag"><i data-feather="${amenity_icon}" class="crm-amenity-icon"></i> ${amenity.amenity}</span>`;
							} else {
								amenitiesHtml += `<span class="crm-project-amenity-tag">${amenity.amenity}</span>`;
							}
						});

						if (moreCount > 0) {
							amenitiesHtml += `<span class="crm-amenity-more">+${moreCount} more</span>`;
						}
						amenitiesHtml += "</div>";

						// Update the DOM with the amenities
						$(".crm-project-title").append(amenitiesHtml);

						// Replace feather icons specifically for new amenities
						if (window.feather) {
							feather.replace();
						}
					}
				},
			});
		}

		const html = `
            <div class="crm-project-dashboard">
                <div class="crm-project-hero">
                    <div class="crm-project-cover-container">
                        ${coverPhotoHtml}
                    </div>
                    <div class="crm-project-map-container">
                        <div id="crm-project-map"></div>
                    </div>
                </div>
                
                <div class="crm-project-header">
                    <div class="crm-project-title">
                        <h2>${this.project.project_name || "Unnamed Project"}</h2>
                        <div class="crm-project-meta">
                            <span class="crm-developer" data-field="developer" style="background-color:var(--control-bg); color: var(--text-color)">
                                <i data-feather="briefcase" style="width: 14px"></i> ${
									this.project.developer || "No Developer"
								}
                            </span>
                            <span class="crm-status crm-status-${
								this.project.status?.toLowerCase().replace(/[^a-z0-9]/g, "-") ||
								"none"
							}" data-field="status">
                                <i data-feather="tag" style="width: 14px"></i> ${
									this.project.status || "No Status"
								}
                            </span>
                        </div>
                        ${amenitiesHtml}
                    </div>
                    <div class="crm-project-actions">
                        ${
							!hasCoords
								? `<button class="btn btn-primary btn-sm crm-set-coords">
                                <i data-feather="map-pin"></i> Set Location
                            </button>`
								: ""
						}
                    </div>
                </div>
                
                <div class="crm-project-content">
                    <!-- Redesigned layout with buildings and units -->
                    <div class="crm-project-data-container">
                        <!-- Buildings section -->
                        <div class="crm-buildings-section">
                            <div class="crm-section-header">
                                <h3>Buildings</h3>
                                <div class="crm-building-actions">
                                    <span class="crm-count">0</span>
                                    ${
										hasCoords
											? `<button class="btn btn-icon btn-md btn-primary crm-add-building" style="width: 20px; height: 20px;" title="Add Building"><i data-feather="plus"></i></button>`
											: ""
									}
                                </div>
                            </div>
                            <div class="crm-buildings-list"></div>
                        </div>
                        
                        <!-- Units section with filter -->
                        <div class="crm-units-container">
                            <div class="crm-units-header">
                                <div class="crm-section-header">
                                <div class="flex" style="align-items: center; gap: 8px;">
                                    <h3>Units</h3>
                                    <div class="crm-active-filters">
                                    <span class="crm-building-filter-indicator"></span>
                                    <span class="crm-area-filter-indicator"></span>
                                </div>
                                </div>
                                    <div class="crm-units-stats">
                                        <span class="crm-count">0</span>
                                    </div>
                                </div>
                                
                                <!-- Active filters section -->
                                
                                
                                <!-- Compact filters -->
                                <div class="crm-project-filters">
                                    <div class="crm-filter-group">
                                        <select class="form-control form-control-sm crm-filter-status">
                                            <option value="">All Statuses</option>
                                            <option value="Available">Available</option>
                                            <option value="Sold-out">Sold-out</option>
                                            <option value="Secondhand Sale">Secondhand Sale</option>
                                            <option value="Secondhand Rent">Secondhand Rent</option>
                                        </select>
                                    </div>
                                    <div class="crm-filter-group">
                                        <select class="form-control form-control-sm crm-filter-bedrooms">
                                            <option value="">All Bedrooms</option>
                                            <!-- Will be populated dynamically -->
                                        </select>
                                    </div>
                                    <div class="crm-filter-group crm-area-filter">
                                        <button class="btn btn-sm btn-default crm-toggle-area-filter">
                                            <i data-feather="sliders" style="width: 12px"></i> Area
                                        </button>
                                        <div class="crm-area-filter-dropdown">
                                            <div class="crm-area-inputs">
                                                <div class="crm-area-input-group">
                                                    <label for="area-min">Min sqft</label>
                                                    <input type="number" id="area-min" class="form-control form-control-sm crm-filter-area-min" value="0" min="0">
                                                </div>
                                                <div class="crm-area-input-group">
                                                    <label for="area-max">Max sqft</label>
                                                    <input type="number" id="area-max" class="form-control form-control-sm crm-filter-area-max" value="10000" min="0">
                                                </div>
                                                <button class="btn btn-sm btn-primary crm-apply-area-filter">Apply</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="crm-units-list-container">
                                <div class="crm-units-list"></div>
                                <div class="crm-add-unit-container"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
            .crm-project-dashboard {
    font-family: var(--font-stack);
    color: var(--text-color);
    background-color: var(--card-bg);
    border-radius: var(--border-radius);
    overflow: hidden;
}

/* Hero section with cover photo and map */
.crm-project-hero {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 250px;
}

@media (max-width: 768px) {
    .crm-project-hero {
        grid-template-columns: 1fr;
        grid-template-rows: 180px 250px;
        height: auto;
    }
}

.crm-project-cover-container {
    position: relative;
    overflow: hidden;
}

.crm-project-cover {
    height: 100%;
    width: 100%;
    background-size: cover;
    background-position: center;
    position: relative;
}

.crm-project-cover-placeholder {
    height: 100%;
    width: 100%;
    background-color: var(--gray-200);
    display: flex;
    align-items: center;
    justify-content: center;
}

.crm-project-map-container {
    height: 100%;
    width: 100%;
}

#crm-project-map {
    height: 100%;
    width: 100%;
    z-index: 1;
}

.crm-project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--padding-sm) var(--padding-md);
    background-color: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
}

.crm-project-title h2 {
    margin: 0;
    font-weight: var(--weight-semibold);
    color: var(--heading-color);
    font-size: var(--text-lg);
}

.crm-project-meta {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    color: var(--text-muted);
    font-size: var(--text-sm);
}

.crm-project-meta span {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--border-radius-tiny);
    transition: background-color 0.2s ease;
}

.crm-project-meta span:hover {
    background-color: var(--fg-hover-color);
}

.crm-project-actions {
    display: flex;
    gap: 8px;
}

.crm-project-content {
    padding: 0;
}

/* Map popup styling */
.crm-map-popup {
    width: 250px;
    padding: 0;
    border-radius: var(--border-radius);
}

.crm-popup-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--card-bg);
    color: var(--text-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: var(--border-radius) var(--border-radius) 0 0;
}

.crm-popup-header h4 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--heading-color);
}

.crm-popup-content {
    background-color: var(--subtle-accent);
    color: var(--text-color);
    padding: 12px;
}

.crm-popup-units {
    display: flex;
    color: var(--text-color);
    flex-direction: column;
    gap: 8px;
}

.crm-popup-unit-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-color);
    padding: 4px 0;
}

.crm-bedroom-name {
    font-size: var(--text-sm);
    color: var(--text-color);
}

.crm-bedroom-count {
    font-size: var(--text-sm);
    color: var(--text-color);
}

.crm-count-available {
    font-weight: var(--weight-medium);
    color: var(--green-600);
}

.crm-popup-no-units {
    color: var(--text-muted);
    text-align: center;
    padding: 8px 0;
    font-size: var(--text-sm);
}

.crm-popup-actions {
    display: flex;
    justify-content: space-between;
    padding: 12px;
    border-top: 1px solid var(--border-color);
    background-color: var(--card-bg);
    border-radius: 0 0 var(--border-radius) var(--border-radius);
}

.crm-btn-icon {
    width: 14px;
    height: 14px;
    margin-right: 4px;
}

/* Fix popup positioning and appearance */
.leaflet-popup-content-wrapper {
    border-radius: var(--border-radius);
    background: var(--card-bg);
}

.leaflet-popup-content {
    margin: 0;
    width: auto !important;
}

.crm-unit-header {
    display: flex;
    flex-direction: column;
    margin-bottom: 6px;
}

.crm-unit-id {
    font-size: var(--text-xs);
    color: var(--text-muted);
}

.crm-project-data-container {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 0;
}

/* Responsive project data container */
@media (max-width: 768px) {
    .crm-project-data-container {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
    }
    
    .crm-buildings-section {
        border-right: none;
        border-bottom: 1px solid var(--border-color);
        max-height: 300px;
    }
}

.crm-buildings-section {
    background-color: var(--card-bg);
    border-right: 1px solid var(--border-color);
    height: 100%;
    max-height: 500px;
    display: flex;
    flex-direction: column;
    max-height: 700px;
    overflow-y: auto;
}

.crm-units-container {
    background-color: var(--card-bg);
    height: 100%;
    max-height: 500px;
    display: flex;
    flex-direction: column;
}

.crm-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
}

.crm-section-header h3 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    color: var(--heading-color);
}

.crm-units-header {
    border-bottom: 1px solid var(--border-color);
}

.crm-units-stats {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Building actions (count and add button) */
.crm-building-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-icon {
    padding: 2px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-tiny);
    background-color: var(--control-bg);
    color: var(--text-color);
    border: none;
}

.btn-icon:hover {
    background-color: var(--btn-default-hover-bg);
    color: var(--heading-color);
}

.crm-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--border-radius-full);
    background-color: var(--control-bg);
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
}

/* Active filters styling */
.crm-active-filters {
    display: flex;
    gap: 8px;
}

.crm-building-filter-indicator,
.crm-area-filter-indicator {
    font-size: var(--text-xs);
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.crm-building-filter-indicator.active,
.crm-area-filter-indicator.active {
    background-color: var(--control-bg);
    color: var(--text-color);
    padding: 2px 8px;
    border-radius: var(--border-radius-tiny);
}

/* Remove filter button */
.remove-filter,
.remove-area-filter {
    cursor: pointer;
    color: var(--heading-color);
}

.crm-project-filters {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    background-color: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
}

.crm-filter-group {
    min-width: 120px;
}

.crm-area-filter {
    position: relative;
    z-index: 50;
}

.crm-area-filter-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: 250px;
    background-color: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-tiny);
    box-shadow: var(--shadow-sm);
    padding: 12px;
    z-index: 100;
    display: none;
}

.crm-area-filter-dropdown.active {
    display: block !important;
}

.crm-area-inputs {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.crm-area-input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.crm-area-input-group label {
    font-size: var(--text-xs);
    color: var(--text-muted);
}

.crm-apply-area-filter {
    align-self: flex-end;
    margin-top: 8px;
}

/* Units list container with add button */
.crm-units-list-container {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    overflow: hidden;
}

.crm-units-list {
    overflow-y: auto;
    max-height: 700px;
    flex-grow: 1;
    padding: 0;
}

.crm-add-unit-container {
    padding: 8px 16px;
}

.crm-add-unit-btn {
    width: 100%;
    padding: 8px;
    text-align: center;
    background-color: var(--btn-primary);
    color: var(--bg-color);
    border-radius: var(--border-radius-tiny);
    cursor: pointer;
    transition: all 0.2s;
}

.crm-add-unit-btn:hover {
    background-color: var(--text-muted);
    color: var(--bg-color);
}

.crm-building-card {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    transition: all 0.2s ease;
    cursor: pointer;
}

.crm-building-card:hover {
    background-color: var(--fg-hover-color);
}

.crm-building-card.active {
    background-color: var(--subtle-fg);
    border-left: 3px solid var(--border-primary);
}

.crm-unit-card {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    transition: background-color 0.2s ease;
    display: flex;
    justify-content: space-between;
}

.crm-unit-card:hover {
    background-color: var(--fg-hover-color);
}

.crm-building-name {
    font-weight: var(--weight-medium);
    color: var(--heading-color);
    margin-bottom: 4px;
}

.crm-unit-name {
    font-weight: var(--weight-medium);
    color: var(--heading-color);
}

.crm-unit-id {
    color: var(--text-muted);
    font-size: var(--text-xs);
}

.crm-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    padding: 2px 8px;
    border-radius: var(--border-radius-tiny);
}

.crm-status-available {
    color: var(--text-on-green);
    background-color: var(--bg-green);
}

.crm-status-sold-out {
    color: var(--text-on-gray);
    background-color: var(--bg-gray);
}

.crm-status-secondhand-sale {
    color: var(--text-on-pink);
    background-color: var(--bg-pink);
}

.crm-status-secondhand-rent {
    color: var(--text-on-orange);
    background-color: var(--bg-orange);
}

.crm-building-meta,
.crm-unit-meta {
    display: flex;
    gap: 12px;
    margin-top: 4px;
    font-size: var(--text-xs);
    color: var(--text-muted);
    align-items: center;
}

.crm-building-meta span,
.crm-unit-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.crm-unit-details {
    display: flex;
    flex-direction: column;
}

.crm-unit-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
}

.crm-unit-meta .crm-bedrooms {
    color: var(--text-color);
}

.crm-unit-meta .crm-area {
    color: var(--text-color);
}

.crm-project-amenities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.crm-project-amenity-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--border-radius-tiny);
    background-color: var(--control-bg);
    color: var(--text-color);
    font-size: var(--text-xs);
}

.crm-amenity-icon {
    width: 12px;
    height: 12px;
}

.crm-amenity-more {
    background-color: var(--control-bg);
    color: var(--text-color);
    font-size: var(--text-xs);
    padding: 2px 8px;
    border-radius: var(--border-radius-tiny);
}

.crm-empty-state {
    padding: var(--padding-2xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    height: 100%;
}

.crm-empty-state-icon {
    margin-bottom: 12px;
    background-color: var(--control-bg);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Mobile responsive adjustments */
@media (max-width: 576px) {
    .crm-project-filters {
        flex-wrap: wrap;
    }
    
    .crm-filter-group {
        min-width: 100%;
        margin-bottom: 4px;
    }
    
    .crm-project-meta {
        flex-wrap: wrap;
    }
}

#awesomplete_list_5 {
    z-index: 999999 !important;
}
            </style>
        `;

		$(this.frm.fields_dict.project_html.wrapper).html(html);

		// Initialize event listeners
		this.initEventListeners();

		// Replace feather icons
		if (window.feather) {
			feather.replace();
		}
	}

	initEventListeners() {
		const me = this;

		// Set coordinates button
		$(this.frm.fields_dict.project_html.wrapper)
			.find(".crm-set-coords")
			.on("click", function () {
				me.openLocationDialog();
			});

		// Add building button
		$(this.frm.fields_dict.project_html.wrapper)
			.find(".crm-add-building")
			.on("click", function () {
				me.openAddBuildingDialog();
			});

		// Edit developer and status fields
		$(this.frm.fields_dict.project_html.wrapper)
			.find('[data-field="developer"]')
			.on("click", function () {
				me.openEditFieldDialog("developer", "Developer", "Link", { options: "Developer" });
			});

		$(this.frm.fields_dict.project_html.wrapper)
			.find('[data-field="status"]')
			.on("click", function () {
				me.openEditFieldDialog("status", "Status", "Select", {
					options: "\nAvailable\nSold-out\nSecondhand Sale\nSecondhand Rent",
				});
			});

		// Filter listeners
		$(this.frm.fields_dict.project_html.wrapper)
			.find(".crm-filter-status")
			.on("change", function () {
				me.filters.status = $(this).val();
				me.applyFilters();
			});

		$(this.frm.fields_dict.project_html.wrapper)
			.find(".crm-filter-bedrooms")
			.on("change", function () {
				me.filters.bedrooms = $(this).val();
				me.applyFilters();
			});

		$(this.frm.fields_dict.project_html.wrapper)
			.find(".crm-filter-area-min")
			.on("input", function () {
				me.filters.areaMin = parseInt($(this).val()) || 0;
			});

		$(this.frm.fields_dict.project_html.wrapper)
			.find(".crm-filter-area-max")
			.on("input", function () {
				me.filters.areaMax = parseInt($(this).val()) || 0;
			});

		$(this.frm.fields_dict.project_html.wrapper).on(
			"click",
			".crm-toggle-area-filter",
			function (e) {
				e.preventDefault();
				e.stopPropagation();

				const dropdown = $(me.frm.fields_dict.project_html.wrapper).find(
					".crm-area-filter-dropdown"
				);
				dropdown.toggleClass("active");

				// Force visibility for debugging
				if (dropdown.hasClass("active")) {
					dropdown.css("display", "block");
				} else {
					dropdown.css("display", "none");
				}
			}
		);

		$(this.frm.fields_dict.project_html.wrapper).on(
			"click",
			".crm-apply-area-filter",
			function () {
				me.applyFilters();

				$(me.frm.fields_dict.project_html.wrapper)
					.find(".crm-area-filter-dropdown")
					.removeClass("active")
					.css("display", "none");
			}
		);

		// Remove area filter
		$(this.frm.fields_dict.project_html.wrapper).on(
			"click",
			".remove-area-filter",
			function () {
				me.clearAreaFilter();
			}
		);

		// Add unit button in the units section
		$(this.frm.fields_dict.project_html.wrapper).on("click", ".crm-add-unit-btn", function () {
			const buildingName = $(this).data("building");
			me.openAddUnitDialog(buildingName);
		});

		// Close area filter dropdown when clicking outside
		$(document).on("click", function (e) {
			if (!$(e.target).closest(".crm-area-filter").length) {
				$(me.frm.fields_dict.project_html.wrapper)
					.find(".crm-area-filter-dropdown")
					.removeClass("active");
			}
		});

		// Remove building filter
		$(this.frm.fields_dict.project_html.wrapper).on("click", ".remove-filter", function () {
			me.clearBuildingFilter();
		});
	}

	openEditFieldDialog(fieldname, label, fieldtype, options = {}) {
		const me = this;
		const currentValue = me.project[fieldname] || "";

		const d = new frappe.ui.Dialog({
			title: `Edit ${label}`,
			fields: [
				{
					fieldname: fieldname,
					label: label,
					fieldtype: fieldtype,
					reqd: 1,
					default: currentValue,
					...options,
				},
			],
			primary_action_label: "Update",
			primary_action: function (values) {
				me.frm.set_value(fieldname, values[fieldname]);
				me.frm.save().then(() => {
					frappe.show_alert({
						message: __(`${label} updated successfully`),
						indicator: "green",
					});
					d.hide();
				});
			},
		});

		d.show();
	}

	fetchData() {
		const me = this;

		return new Promise((resolve) => {
			// Fetch buildings
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Building",
					filters: {
						project: me.project.name,
					},
					fields: [
						"name",
						"building_id",
						"developer",
						"status",
						"lat",
						"lng",
						"building_amenities",
					],
				},
				callback: function (r) {
					me.buildings = r.message || [];

					// Fetch units for each building
					const unitPromises = me.buildings.map((building) => {
						return new Promise((resolveUnits) => {
							frappe.call({
								method: "frappe.client.get_list",
								args: {
									doctype: "Unit",
									filters: {
										building: building.name,
									},
									fields: [
										"name",
										"building",
										"project",
										"developer",
										"status",
										"bedrooms",
										"area_sqft",
										"unit_id",
										"area_sqm",
										"unit_amenities",
									],
								},
								callback: function (r) {
									const units = r.message || [];
									me.units = [...me.units, ...units];
									resolveUnits();
								},
							});
						});
					});

					// Get all available bedroom types for filter dropdown
					Promise.all(unitPromises).then(() => {
						me.populateBedroomFilter();
						resolve();
					});
				},
			});
		});
	}

	populateBedroomFilter() {
		const uniqueBedrooms = [
			...new Set(this.units.map((unit) => unit.bedrooms).filter(Boolean)),
		];
		const $bedroomFilter = $(this.frm.fields_dict.project_html.wrapper).find(
			".crm-filter-bedrooms"
		);

		uniqueBedrooms.forEach((bedroom) => {
			$bedroomFilter.append(`<option value="${bedroom}">${bedroom}</option>`);
		});
	}

	renderMap() {
		const me = this;
		if (this.map) {
			this.map.remove();
			this.map = null;
			this.projectLayer = null;
			this.buildingMarkers = {};
		}
		if (!this.map) {
			// Initialize map
			this.map = L.map("crm-project-map").setView([25.276987, 55.296249], 12); // Default to Dubai coordinates

			// Function to determine if dark mode is active
			function isDarkMode() {
				return (
					document.documentElement.getAttribute("data-theme-mode") === "dark" ||
					document.documentElement.getAttribute("data-theme") === "dark"
				);
			}

			// Add appropriate map tiles based on current theme
			if (isDarkMode()) {
				// Dark theme map tiles (CartoDB Dark Matter)
				L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
					subdomains: "abcd",
					maxZoom: 19,
				}).addTo(this.map);
			} else {
				// Light theme map tiles (CartoDB Light)
				L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
					subdomains: "abcd",
					maxZoom: 19,
				}).addTo(this.map);
			}

			// Listen for theme changes
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (
						mutation.attributeName === "data-theme-mode" ||
						mutation.attributeName === "data-theme"
					) {
						// Remove existing tile layers
						this.map.eachLayer((layer) => {
							if (layer instanceof L.TileLayer) {
								this.map.removeLayer(layer);
							}
						});

						// Add appropriate map tiles based on updated theme
						if (isDarkMode()) {
							L.tileLayer(
								"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
								{
									attribution:
										'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
									subdomains: "abcd",
									maxZoom: 19,
								}
							).addTo(this.map);
						} else {
							L.tileLayer(
								"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
								{
									attribution:
										'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
									subdomains: "abcd",
									maxZoom: 19,
								}
							).addTo(this.map);
						}
					}
				});
			});

			// Start observing theme changes on the HTML element
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["data-theme-mode", "data-theme"],
			});

			// Initialize project layer
			this.projectLayer = new L.FeatureGroup().addTo(this.map);

			// Try to render project polygon if coords exist
			if (this.project.coords) {
				try {
					const coords = JSON.parse(this.project.coords);
					if (coords.type === "Polygon") {
						const polygon = L.polygon(
							coords.coordinates[0].map((coord) => [coord[1], coord[0]]),
							{
								color: "var(--heading-color)",
								fillColor: "var(--heading-color)",
								fillOpacity: 0.2,
							}
						).addTo(this.projectLayer);

						this.map.fitBounds(polygon.getBounds());
					} else if (coords.type === "Point") {
						const marker = L.marker([coords.coordinates[1], coords.coordinates[0]], {
							icon: L.divIcon({
								className: "crm-project-marker",
								html: `<div style="background-color: var(--gray-900); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>`,
								iconSize: [18, 18],
							}),
						}).addTo(this.projectLayer);

						marker.bindPopup(`<b>${this.project.project_name}</b>`);
						this.map.setView([coords.coordinates[1], coords.coordinates[0]], 15);
					}
				} catch (e) {
					console.error("Error parsing project coordinates", e);
				}
			}
		}

		// Clear existing building markers
		for (const key in this.buildingMarkers) {
			this.map.removeLayer(this.buildingMarkers[key]);
		}
		this.buildingMarkers = {};

		// Add building markers with status colors
		this.buildings.forEach((building) => {
			if (building.lat && building.lng) {
				// Determine marker color based on status
				let markerColor = "var(--green-500)"; // Default color

				if (building.status === "Available") {
					markerColor = "var(--green-500)";
				} else if (building.status === "Sold-out") {
					markerColor = "var(--gray-500)";
				} else if (building.status === "Secondhand Sale") {
					markerColor = "var(--pink-500)";
				} else if (building.status === "Secondhand Rent") {
					markerColor = "var(--orange-500)";
				}

				const marker = L.marker([building.lat, building.lng], {
					icon: L.divIcon({
						className: "crm-building-marker",
						html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
						iconSize: [16, 16],
					}),
				}).addTo(this.map);

				// Filter units for this building
				const buildingUnits = this.units.filter((unit) => unit.building === building.name);

				// Group units by bedroom
				const groupedUnits = {};
				buildingUnits.forEach((unit) => {
					if (!groupedUnits[unit.bedrooms]) {
						groupedUnits[unit.bedrooms] = [];
					}
					groupedUnits[unit.bedrooms].push(unit);
				});

				// Create popup content
				let popupContent = `
    <div class="crm-map-popup">
        <div class="crm-popup-header">
            <h4>${building.building_id}</h4>
            <div class="crm-status crm-status-${
				building.status?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "none"
			}">${building.status || "No Status"}</div>
        </div>
        
        <div class="crm-popup-content">`;

				if (Object.keys(groupedUnits).length > 0) {
					popupContent += `<div class="crm-popup-units">`;
					for (const bedroom in groupedUnits) {
						const availableCount = groupedUnits[bedroom].filter(
							(u) => u.status === "Available"
						).length;
						popupContent += `
            <div class="crm-popup-unit-row">
                <div class="crm-bedroom-name">${bedroom} Bedroom</div>
                <div class="crm-bedroom-count">
                    <span class="crm-count-available">${availableCount}</span>/<span class="crm-count-total">${groupedUnits[bedroom].length}</span>
                </div>
            </div>
        `;
					}
					popupContent += `</div>`;
				} else {
					popupContent += `<div class="crm-popup-no-units">No units added yet</div>`;
				}

				popupContent += `</div>
    <div class="crm-popup-actions">
        <button class="btn btn-sm btn-primary crm-view-building" data-building="${building.name}">
            <i data-feather="eye" class="crm-btn-icon"></i> View
        </button>
        <button class="btn btn-sm btn-secondary crm-add-unit-popup" data-building="${building.name}">
            <i data-feather="plus" class="crm-btn-icon"></i> Add Unit
        </button>
    </div>
</div>`;

				marker.bindPopup(popupContent);
				marker.on("popupopen", function () {
					$(".crm-view-building").on("click", function () {
						const buildingName = $(this).data("building");
						frappe.set_route("Form", "Building", buildingName);
					});

					$(".crm-add-unit-popup").on("click", function () {
						const buildingName = $(this).data("building");
						me.openAddUnitDialog(buildingName);
					});
				});

				this.buildingMarkers[building.name] = marker;

				// Set up context menu for markers
				marker.on("contextmenu", function (e) {
					L.DomEvent.preventDefault(e);

					const menuConfig = {
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY,
						sections: [
							{
								items: [
									{
										label: "Edit Building",
										icon: "edit",
										action: "edit",
										data: { building: building.name },
									},
									{
										label: "Navigate",
										icon: "navigation",
										action: "navigate",
										data: {
											building: building.name,
											lat: building.lat,
											lng: building.lng,
										},
									},
									{
										label: "Add Unit",
										icon: "plus-square",
										action: "add_unit",
										data: { building: building.name },
									},
								],
							},
							{
								items: [
									{
										label: "Delete Building",
										icon: "trash-2",
										action: "delete",
										cssClass: "text-danger",
										data: { building: building.name },
									},
								],
							},
						],
						onItemClick: function (action, button) {
							const buildingName = button.data("building");

							if (action === "edit") {
								frappe.set_route("Form", "Building", buildingName);
							} else if (action === "change_status") {
								me.openChangeStatusDialog(
									"Building",
									buildingName,
									button.data("current")
								);
							} else if (action === "navigate") {
								const lat = button.data("lat");
								const lng = button.data("lng");
								window.open(
									`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
									"_blank"
								);
							} else if (action === "add_unit") {
								me.openAddUnitDialog(buildingName);
							} else if (action === "delete") {
								me.deleteBuilding(buildingName);
							}
						},
					};

					CRMContextMenu.create(menuConfig);
				});
			}
		});
	}

	renderBuildingsList() {
		const $buildingsList = $(this.frm.fields_dict.project_html.wrapper).find(
			".crm-buildings-list"
		);
		const $buildingsCount = $(this.frm.fields_dict.project_html.wrapper).find(
			".crm-buildings-section .crm-count"
		);

		$buildingsList.empty();
		$buildingsCount.text(this.buildings.length);

		if (this.buildings.length === 0) {
			$buildingsList.html(`
           <div class="crm-empty-state">
               <div class="crm-empty-state-icon">
                   <i data-feather="home" style="width: 24px; height: 24px; color: var(--gray-400);"></i>
               </div>
               <p>No buildings added yet</p>
           </div>
       `);
			if (window.feather) feather.replace();
			return;
		}

		const me = this;

		this.buildings.forEach((building) => {
			// Count units for this building
			const buildingUnits = this.units.filter((unit) => unit.building === building.name);
			const availableUnits = buildingUnits.filter(
				(unit) => unit.status === "Available"
			).length;

			// Check if this building is selected
			const isActive = me.selectedBuilding === building.name;

			const $buildingCard = $(`
           <div class="crm-building-card ${isActive ? "active" : ""}" data-building="${
				building.name
			}">
               <div class="crm-building-name">${building.building_id}</div>
               <div class="crm-building-meta">
  <span class="crm-units-count">
    <i data-feather="layout" style="width: 14px; height: 14px;"></i>
    ${buildingUnits.length} units (${availableUnits} available)
  </span>
  <span class="crm-status crm-status-${
		building.status?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "none"
  }">
    ${building.status ? building.status.replace("Secondhand", "2nd") : "No Status"}
  </span>
</div>
           </div>
       `);

			$buildingsList.append($buildingCard);

			// Context menu for building card
			$buildingCard.on("click", function (e) {
				const buildingName = $(this).data("building");
				me.selectBuilding(buildingName);
			});

			$buildingCard.on("contextmenu", function (e) {
				e.preventDefault();

				const menuConfig = {
					x: e.pageX,
					y: e.pageY,
					sections: [
						{
							items: [
								{
									label: "Edit Building",
									icon: "edit",
									action: "edit",
									data: { building: building.name },
								},
								{
									label: "Change Status",
									icon: "tag",
									action: "change_status",
									data: { building: building.name, current: building.status },
								},
								{
									label: "Navigate",
									icon: "navigation",
									action: "navigate",
									data: {
										building: building.name,
										lat: building.lat,
										lng: building.lng,
									},
								},
								{
									label: "Add Unit",
									icon: "plus-square",
									action: "add_unit",
									data: { building: building.name },
								},
							],
						},
						{
							items: [
								{
									label: "Delete Building",
									icon: "trash-2",
									action: "delete",
									cssClass: "text-danger",
									data: { building: building.name },
								},
							],
						},
					],
					onItemClick: function (action, button) {
						const buildingName = button.data("building");

						if (action === "edit") {
							frappe.set_route("Form", "Building", buildingName);
						} else if (action === "change_status") {
							me.openChangeStatusDialog(
								"Building",
								buildingName,
								button.data("current")
							);
						} else if (action === "navigate") {
							const lat = button.data("lat");
							const lng = button.data("lng");
							window.open(
								`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
								"_blank"
							);
						} else if (action === "add_unit") {
							me.openAddUnitDialog(buildingName);
						} else if (action === "delete") {
							me.deleteBuilding(buildingName);
						}
					},
				};

				CRMContextMenu.create(menuConfig);
			});
		});

		if (window.feather) feather.replace();
	}

	renderUnitsList() {
		const me = this;
		const $unitsList = $(this.frm.fields_dict.project_html.wrapper).find(".crm-units-list");
		const $unitsCount = $(this.frm.fields_dict.project_html.wrapper).find(
			".crm-units-stats .crm-count"
		);
		const $buildingFilterIndicator = $(this.frm.fields_dict.project_html.wrapper).find(
			".crm-building-filter-indicator"
		);
		const $areaFilterIndicator = $(this.frm.fields_dict.project_html.wrapper).find(
			".crm-area-filter-indicator"
		);

		$unitsList.empty();

		// Update building filter indicator
		if (me.selectedBuilding) {
			const selectedBuildingData = me.buildings.find((b) => b.name === me.selectedBuilding);
			if (selectedBuildingData) {
				$buildingFilterIndicator
					.html(
						`
                <i data-feather="filter" style="width: 12px"></i> 
                Building: ${selectedBuildingData.building_id}
                <i data-feather="x" class="remove-filter" style="width: 12px; color: var(--gray-900)"></i>
            `
					)
					.addClass("active");

				// Show add unit button when building is selected
				$(me.frm.fields_dict.project_html.wrapper).find(".crm-add-unit-container").html(`
                    <button class="crm-add-unit-btn btn btn-lg" data-building="${me.selectedBuilding}">
                        <i data-feather="plus" style="width: 14px; height: 14px;"></i> Add Unit to ${selectedBuildingData.building_id}
                    </button>
                `);
				if (window.feather) feather.replace();
			}
		} else {
			$buildingFilterIndicator.html("").removeClass("active");
			$(me.frm.fields_dict.project_html.wrapper).find(".crm-add-unit-container").empty();
		}

		// Update area filter indicator
		if (me.filters.areaMin > 0 || me.filters.areaMax < 10000) {
			$areaFilterIndicator
				.html(
					`<i data-feather="sliders" style="width: 12px"></i> 
                    Area: ${me.filters.areaMin} - ${me.filters.areaMax} sqft
                    <i data-feather="x" class="remove-area-filter" style="width: 12px; color: var(--gray-900)"></i>
                `
				)
				.addClass("active");
			if (window.feather) feather.replace();
		} else {
			$areaFilterIndicator.html("").removeClass("active");
		}

		// Apply filters
		const filteredUnits = this.applyFiltersToUnits(this.units);

		$unitsCount.text(filteredUnits.length);

		if (filteredUnits.length === 0) {
			$unitsList.html(`
           <div class="crm-empty-state">
               <div class="crm-empty-state-icon">
                   <i data-feather="${
						me.selectedBuilding ? "filter" : "grid"
					}" style="width: 24px; height: 24px; color: var(--gray-400);"></i>
               </div>
               <p>${me.selectedBuilding ? "No units match your filters" : "No units added yet"}</p>
           </div>
       `);
			if (window.feather) feather.replace();
			return;
		}

		filteredUnits.forEach((unit) => {
			const buildingData = this.buildings.find((b) => b.name === unit.building) || {};

			const $unitCard = $(`
   <div class="crm-unit-card" data-unit="${unit.name}" data-building="${unit.building}">
       <div class="crm-unit-details">
           <div class="crm-unit-header">
               <div class="crm-unit-name">
                   ${unit.unit_id || "No ID"}
               </div>
               <div class="crm-unit-id"><i data-feather="trello" style="width: 12px"></i>${
					buildingData.building_id || "Unknown Building"
				}</div>
           </div>
           <div class="crm-unit-meta">
               ${
					unit.bedrooms
						? `<span class="crm-bedrooms"><i data-feather="layout" style="width: 14px; height: 14px;"></i> ${unit.bedrooms} BR</span>`
						: ""
				}
               ${
					unit.area_sqft
						? `<span class="crm-area"><i data-feather="square" style="width: 14px; height: 14px;"></i> ${
								unit.area_sqft
						  } sqft${
								unit.area_sqm
									? ` (${parseFloat(unit.area_sqm).toFixed(1)} sqm)`
									: ""
						  }</span>`
						: ""
				}
           </div>
       </div>
       <div class="crm-unit-status">
    <div class="crm-status crm-status-${
		unit.status?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "none"
	}">${unit.status ? unit.status.replace("Secondhand", "2nd") : "No Status"}</div>
</div>
   </div>
`);

			$unitsList.append($unitCard);

			// Context menu for unit card
			$unitCard.on("contextmenu", function (e) {
				e.preventDefault();

				const menuConfig = {
					x: e.pageX,
					y: e.pageY,
					sections: [
						{
							items: [
								{
									label: "Edit Unit",
									icon: "edit",
									action: "edit",
									data: { unit: unit.name },
								},
								{
									label: "Change Status",
									icon: "tag",
									action: "change_status",
									data: { unit: unit.name, current: unit.status },
								},
							],
						},
						{
							items: [
								{
									label: "Delete Unit",
									icon: "trash-2",
									action: "delete",
									cssClass: "text-danger",
									data: { unit: unit.name },
								},
							],
						},
					],
					onItemClick: function (action, button) {
						const unitName = button.data("unit");

						if (action === "edit") {
							frappe.set_route("Form", "Unit", unitName);
						} else if (action === "change_status") {
							me.openChangeStatusDialog("Unit", unitName, button.data("current"));
						} else if (action === "delete") {
							me.deleteUnit(unitName);
						}
					},
				};

				CRMContextMenu.create(menuConfig);
			});
		});

		if (window.feather) feather.replace();
	}

	applyFiltersToUnits(units) {
		return units.filter((unit) => {
			// Building filter
			if (this.selectedBuilding && unit.building !== this.selectedBuilding) {
				return false;
			}

			// Status filter
			if (this.filters.status && unit.status !== this.filters.status) {
				return false;
			}

			// Bedrooms filter
			if (this.filters.bedrooms && unit.bedrooms !== this.filters.bedrooms) {
				return false;
			}

			// Area filter
			if (unit.area_sqft) {
				const area = parseFloat(unit.area_sqft);
				if (area < this.filters.areaMin || area > this.filters.areaMax) {
					return false;
				}
			}

			return true;
		});
	}

	applyFilters() {
		this.renderUnitsList();
	}

	clearAreaFilter() {
		const me = this;

		me.filters.areaMin = 0;
		me.filters.areaMax = 10000;

		// Reset input fields
		$(me.frm.fields_dict.project_html.wrapper).find(".crm-filter-area-min").val(0);

		$(me.frm.fields_dict.project_html.wrapper).find(".crm-filter-area-max").val(10000);

		// Update unit list
		me.renderUnitsList();
	}

	selectBuilding(buildingName) {
		const me = this;

		// If clicking the already selected building, clear the filter
		if (me.selectedBuilding === buildingName) {
			me.clearBuildingFilter();
			return;
		}

		me.selectedBuilding = buildingName;

		// Update building cards
		$(me.frm.fields_dict.project_html.wrapper)
			.find(".crm-building-card")
			.removeClass("active");

		$(me.frm.fields_dict.project_html.wrapper)
			.find(`.crm-building-card[data-building="${buildingName}"]`)
			.addClass("active");

		// Update unit list
		me.renderUnitsList();

		// If we have a map marker for this building, highlight it
		if (me.buildingMarkers[buildingName]) {
			Object.values(me.buildingMarkers).forEach((marker) => {
				// Get current status color
				const building = me.buildings.find((b) => b.name === buildingName) || {};
				let markerColor = "var(--green-500)";

				if (building.status === "Available") {
					markerColor = "var(--green-500)";
				} else if (building.status === "Sold-out") {
					markerColor = "var(--gray-500)";
				} else if (building.status === "Secondhand Sale") {
					markerColor = "var(--pink-500)";
				} else if (building.status === "Secondhand Rent") {
					markerColor = "var(--orange-500)";
				}

				marker.setIcon(
					L.divIcon({
						className: "crm-building-marker",
						html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
						iconSize: [16, 16],
					})
				);
			});

			me.buildingMarkers[buildingName].setIcon(
				L.divIcon({
					className: "crm-building-marker-active",
					html: `<div style="background-color: var(--gray-900); width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>`,
					iconSize: [20, 20],
				})
			);

			// Zoom to this building
			me.map.setView(me.buildingMarkers[buildingName].getLatLng(), 16);
		}
	}

	clearBuildingFilter() {
		const me = this;

		me.selectedBuilding = null;

		// Reset building cards
		$(me.frm.fields_dict.project_html.wrapper)
			.find(".crm-building-card")
			.removeClass("active");

		// Reset building markers
		Object.values(me.buildingMarkers).forEach((marker) => {
			// Reset to status colors
			const buildingName = Object.keys(me.buildingMarkers).find(
				(key) => me.buildingMarkers[key] === marker
			);
			const building = me.buildings.find((b) => b.name === buildingName) || {};
			let markerColor = "var(--green-500)";

			if (building.status === "Available") {
				markerColor = "var(--green-500)";
			} else if (building.status === "Sold-out") {
				markerColor = "var(--gray-500)";
			} else if (building.status === "Secondhand Sale") {
				markerColor = "var(--pink-500)";
			} else if (building.status === "Secondhand Rent") {
				markerColor = "var(--orange-500)";
			}

			marker.setIcon(
				L.divIcon({
					className: "crm-building-marker",
					html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
					iconSize: [16, 16],
				})
			);
		});

		// Update unit list
		me.renderUnitsList();

		// If project has coordinates, zoom back to it
		if (this.projectLayer && this.map) {
			try {
				const bounds = this.projectLayer.getBounds();
				if (bounds) {
					this.map.fitBounds(bounds);
				}
			} catch (e) {
				console.log("Could not fit to project bounds", e);
			}
		}
	}

	openLocationDialog() {
		const me = this;
		const d = new frappe.ui.Dialog({
			title: "Set Project Location",
			fields: [
				{
					fieldname: "location_type_html",
					fieldtype: "HTML",
					options: `
                <div class="crm-location-type-selector">
                    <div class="btn-group" style="margin-bottom: 8px" role="group">
                        <button type="button" class="btn btn-default" data-type="point">Single Point</button>
                        <button type="button" class="btn btn-default" data-type="polygon">Polygon Area</button>
                    </div>
                </div>
            `,
				},
				{
					fieldname: "map_html",
					fieldtype: "HTML",
					options: `<div id="location-map" style="height: 400px;"></div>`,
				},
			],
			primary_action_label: "Save",
			primary_action: function () {
				if (me.drawedItems && me.drawedItems.toGeoJSON().features.length > 0) {
					const geoJson = me.drawedItems.toGeoJSON().features[0].geometry;
					me.frm.set_value("coords", JSON.stringify(geoJson));
					me.frm.save().then(() => {
						frappe.show_alert({
							message: __("Project location saved successfully"),
							indicator: "green",
						});
						d.hide();
						me.refresh();
					});
				} else {
					frappe.throw(__("Please set a location on the map."));
				}
			},
			onhide: function () {
				// Ensure map is properly destroyed when dialog is closed
				if (me.locationMap) {
					me.locationMap.remove();
					me.locationMap = null;
				}

				// Clean up the draw items
				if (me.drawedItems) {
					me.drawedItems.clearLayers();
					me.drawedItems = null;
				}

				// Also ensure the DOM element is fully cleaned
				const mapContainer = document.getElementById("location-map");
				if (mapContainer) {
					mapContainer.innerHTML = "";
					if (mapContainer._leaflet_id) {
						mapContainer._leaflet_id = null;
					}
				}
			},
		});

		d.show();

		// Initialize map - with more aggressive element cleanup
		setTimeout(() => {
			// First, try to clear any existing map instance
			const mapContainer = document.getElementById("location-map");
			if (mapContainer) {
				// Clear any content
				mapContainer.innerHTML = "";

				// Reset any leaflet ID that might be attached
				if (mapContainer._leaflet_id) {
					mapContainer._leaflet_id = null;
				}
			}

			// Now create a new map
			me.locationMap = L.map("location-map").setView([25.276987, 55.296249], 12);

			// Add CartoDB basemap
			// Function to determine if dark mode is active
			function isDarkMode() {
				return (
					document.documentElement.getAttribute("data-theme-mode") === "dark" ||
					document.documentElement.getAttribute("data-theme") === "dark"
				);
			}

			// Add appropriate map tiles based on current theme
			if (isDarkMode()) {
				// Dark theme map tiles (CartoDB Dark Matter)
				L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
					subdomains: "abcd",
					maxZoom: 19,
				}).addTo(me.locationMap);
			} else {
				// Light theme map tiles (CartoDB Light)
				L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
					subdomains: "abcd",
					maxZoom: 19,
				}).addTo(me.locationMap);
			}

			// Set up theme change observer
			const locationMapObserver = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (
						mutation.attributeName === "data-theme-mode" ||
						mutation.attributeName === "data-theme"
					) {
						// Remove existing tile layers
						me.locationMap.eachLayer((layer) => {
							if (layer instanceof L.TileLayer) {
								me.locationMap.removeLayer(layer);
							}
						});

						// Add appropriate map tiles based on updated theme
						if (isDarkMode()) {
							L.tileLayer(
								"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
								{
									attribution:
										'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
									subdomains: "abcd",
									maxZoom: 19,
								}
							).addTo(me.locationMap);
						} else {
							L.tileLayer(
								"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
								{
									attribution:
										'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
									subdomains: "abcd",
									maxZoom: 19,
								}
							).addTo(me.locationMap);
						}
					}
				});
			});

			// Start observing theme changes
			locationMapObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["data-theme-mode", "data-theme"],
			});

			// Initialize drawing layer
			me.drawedItems = new L.FeatureGroup().addTo(me.locationMap);

			// Initialize draw controls
			let drawControl;
			const initDrawControl = (type) => {
				// Remove existing draw control if any
				if (drawControl) {
					me.locationMap.removeControl(drawControl);
				}

				// Clear previously drawn items
				me.drawedItems.clearLayers();

				// Configure draw control based on type
				const drawOptions = {
					draw: {
						polyline: false,
						circle: false,
						circlemarker: false,
						rectangle: false,
						polygon: type === "polygon",
						marker: type === "point",
					},
					edit: {
						featureGroup: me.drawedItems,
						remove: true,
					},
				};

				drawControl = new L.Control.Draw(drawOptions);
				me.locationMap.addControl(drawControl);
			};

			// Initialize with point by default
			initDrawControl("point");

			// Handle drawing events
			me.locationMap.on(L.Draw.Event.CREATED, function (event) {
				me.drawedItems.clearLayers();
				me.drawedItems.addLayer(event.layer);
			});

			// Type selector buttons
			d.$wrapper.find(".btn-group .btn").on("click", function () {
				const type = $(this).data("type");
				d.$wrapper
					.find(".btn-group .btn")
					.removeClass("btn-primary")
					.addClass("btn-default");
				$(this).removeClass("btn-default").addClass("btn-primary");
				initDrawControl(type);
			});

			// Set the default button as active
			d.$wrapper
				.find('[data-type="point"]')
				.removeClass("btn-default")
				.addClass("btn-primary");

			// Try to load existing coordinates
			if (me.project.coords) {
				try {
					const coords = JSON.parse(me.project.coords);
					if (coords.type === "Polygon") {
						// Set polygon button as active
						d.$wrapper
							.find(".btn-group .btn")
							.removeClass("btn-primary")
							.addClass("btn-default");
						d.$wrapper
							.find('[data-type="polygon"]')
							.removeClass("btn-default")
							.addClass("btn-primary");
						initDrawControl("polygon");

						// Create polygon
						const polygon = L.polygon(
							coords.coordinates[0].map((coord) => [coord[1], coord[0]]),
							{
								color: "var(--heading-color)",
								fillColor: "var(--heading-color)",
								fillOpacity: 0.2,
							}
						);

						me.drawedItems.addLayer(polygon);
						me.locationMap.fitBounds(polygon.getBounds());
					} else if (coords.type === "Point") {
						// Set point button as active
						d.$wrapper
							.find(".btn-group .btn")
							.removeClass("btn-primary")
							.addClass("btn-default");
						d.$wrapper
							.find('[data-type="point"]')
							.removeClass("btn-default")
							.addClass("btn-primary");
						initDrawControl("point");

						// Create marker
						const marker = L.marker([coords.coordinates[1], coords.coordinates[0]]);
						me.drawedItems.addLayer(marker);
						me.locationMap.setView([coords.coordinates[1], coords.coordinates[0]], 15);
					}
				} catch (e) {
					console.error("Error parsing project coordinates", e);
				}
			}

			// Trigger a resize event to ensure the map is properly rendered
			setTimeout(() => {
				me.locationMap.invalidateSize();
			}, 100);
		}, 300);
	}

	openAddBuildingDialog() {
		const me = this;

		// Check if project has coordinates first
		if (!me.project.coords) {
			frappe.msgprint(__("Please set project location first before adding buildings."));
			return;
		}

		let projectCoords;
		try {
			projectCoords = JSON.parse(me.project.coords);
		} catch (e) {
			frappe.msgprint(__("Invalid project coordinates. Please reset project location."));
			return;
		}

		// Check if this is a point project and already has a building
		if (projectCoords.type === "Point" && me.buildings.length > 0) {
			frappe.msgprint(
				__(
					"This project is a single location and already has a building. You cannot add more buildings to a point project."
				)
			);
			return;
		}

		const d = new frappe.ui.Dialog({
			title: "Add New Building",
			fields: [
				{
					label: "Building ID",
					fieldname: "building_id",
					fieldtype: "Data",
					reqd: 1,
				},
				{
					label: "Status",
					fieldname: "status",
					fieldtype: "Select",
					options: "\nAvailable\nSold-out\nSecondhand Sale\nSecondhand Rent",
				},
				{
					fieldname: "section_break_amenities",
					fieldtype: "Section Break",
					label: "Building Amenities",
				},
				{
					fieldname: "building_amenities",
					fieldtype: "Table MultiSelect",
					label: "Amenities",
					options: "Amenities",
				},
				{
					fieldname: "section_break_location",
					fieldtype: "Section Break",
					label: "Building Location",
				},
				{
					fieldname: "map_html",
					fieldtype: "HTML",
					options: `<div id="building-location-map" style="height: 300px;"></div>`,
				},
				{
					fieldname: "lat",
					fieldtype: "Data",
					label: "Latitude",
					hidden: 1,
				},
				{
					fieldname: "lng",
					fieldtype: "Data",
					label: "Longitude",
					hidden: 1,
				},
			],
			primary_action_label: "Create",
			primary_action: function (values) {
				// For point projects, use the project coordinates
				if (projectCoords.type === "Point") {
					values.lat = projectCoords.coordinates[1];
					values.lng = projectCoords.coordinates[0];
				} else if (!values.lat || !values.lng) {
					frappe.throw(__("Please set the building location on the map."));
					return;
				}

				frappe.call({
					method: "frappe.client.insert",
					args: {
						doc: {
							doctype: "Building",
							building_id: values.building_id,
							project: me.project.name,
							developer: me.project.developer,
							status: values.status,
							lat: values.lat,
							lng: values.lng,
							building_amenities: values.building_amenities,
						},
					},
					callback: function (r) {
						if (r.message) {
							frappe.show_alert({
								message: __("Building {0} created", [values.building_id]),
								indicator: "green",
							});

							me.refresh();
							d.hide();
						}
					},
				});
			},
			onhide: function () {
				// Properly destroy map when dialog is closed
				if (me.buildingMap) {
					me.buildingMap.remove();
					me.buildingMap = null;
				}

				// Also ensure the DOM element is fully cleaned
				const mapContainer = document.getElementById("building-location-map");
				if (mapContainer) {
					mapContainer.innerHTML = "";
					if (mapContainer._leaflet_id) {
						mapContainer._leaflet_id = null;
					}
				}
			},
		});

		d.show();

		// Initialize map with timeout to ensure DOM is ready
		setTimeout(() => {
			// Thorough cleanup of any existing map
			const mapContainer = document.getElementById("building-location-map");
			if (mapContainer) {
				mapContainer.innerHTML = "";
				if (mapContainer._leaflet_id) {
					mapContainer._leaflet_id = null;
				}
			}

			// Create new map instance and store it on the class
			me.buildingMap = L.map("building-location-map");
			let marker;
			let projectArea;

			// Function to determine if dark mode is active
			function isDarkMode() {
				return (
					document.documentElement.getAttribute("data-theme-mode") === "dark" ||
					document.documentElement.getAttribute("data-theme") === "dark"
				);
			}

			// Add appropriate map tiles based on current theme
			if (isDarkMode()) {
				// Dark theme map tiles (CartoDB Dark Matter)
				L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
					subdomains: "abcd",
					maxZoom: 19,
				}).addTo(me.buildingMap);
			} else {
				// Light theme map tiles (CartoDB Light)
				L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
					subdomains: "abcd",
					maxZoom: 19,
				}).addTo(me.buildingMap);
			}

			// Set up theme change observer
			const buildingMapObserver = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (
						mutation.attributeName === "data-theme-mode" ||
						mutation.attributeName === "data-theme"
					) {
						// Remove existing tile layers
						me.buildingMap.eachLayer((layer) => {
							if (layer instanceof L.TileLayer) {
								me.buildingMap.removeLayer(layer);
							}
						});

						// Add appropriate map tiles based on updated theme
						if (isDarkMode()) {
							L.tileLayer(
								"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
								{
									attribution:
										'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
									subdomains: "abcd",
									maxZoom: 19,
								}
							).addTo(me.buildingMap);
						} else {
							L.tileLayer(
								"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
								{
									attribution:
										'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
									subdomains: "abcd",
									maxZoom: 19,
								}
							).addTo(me.buildingMap);
						}
					}
				});
			});

			// Start observing theme changes
			buildingMapObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["data-theme-mode", "data-theme"],
			});

			// Show project area differently based on project type
			if (projectCoords.type === "Polygon") {
				projectArea = L.polygon(
					projectCoords.coordinates[0].map((coord) => [coord[1], coord[0]]),
					{
						color: "var(--heading-color)",
						fillColor: "var(--heading-color)",
						fillOpacity: 0.2,
					}
				).addTo(me.buildingMap);

				me.buildingMap.fitBounds(projectArea.getBounds());

				// For polygon projects, allow clicking anywhere within the project area
				me.buildingMap.on("click", function (e) {
					// Check if click is within project area
					let isInside = me.isPointInPolygon(e.latlng, projectCoords);

					if (!isInside) {
						frappe.show_alert({
							message: __("Building must be placed within the project area"),
							indicator: "red",
						});
						return;
					}

					if (marker) {
						me.buildingMap.removeLayer(marker);
					}

					marker = L.marker(e.latlng).addTo(me.buildingMap);

					// Update lat/lng fields
					d.set_value("lat", e.latlng.lat);
					d.set_value("lng", e.latlng.lng);
				});
			} else if (projectCoords.type === "Point") {
				// For point projects, show the fixed marker at project position
				const projectPoint = [projectCoords.coordinates[1], projectCoords.coordinates[0]];

				// Add project marker
				const projectMarker = L.marker(projectPoint, {
					icon: L.divIcon({
						className: "crm-project-marker",
						html: `<div style="background-color: var(--heading-color); width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--card-bg);"></div>`,
						iconSize: [18, 18],
					}),
				}).addTo(me.buildingMap);

				// Set building marker at same location
				marker = L.marker(projectPoint, {
					icon: L.divIcon({
						className: "crm-building-marker",
						html: `<div style="background-color: var(--green-500); width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--card-bg);"></div>`,
						iconSize: [16, 16],
					}),
				}).addTo(me.buildingMap);

				// Set a circle around the point to visualize the area
				projectArea = L.circle(projectPoint, {
					radius: 50, // 50m radius
					color: "var(--heading-color)",
					fillColor: "var(--heading-color)",
					fillOpacity: 0.1,
				}).addTo(me.buildingMap);

				// Set the view to the project point
				me.buildingMap.setView(projectPoint, 16);

				// Set the lat/lng values
				d.set_value("lat", projectPoint[0]);
				d.set_value("lng", projectPoint[1]);

				// Add note to explain the fixed location
				const note = document.createElement("div");
				note.className = "single-point-note";
				note.innerHTML =
					"<div class='alert alert-info' style='position:absolute;bottom:10px;left:10px;right:10px;z-index:1000;opacity:0.9;text-align:center;'>This is a single point project. The building will be created at the project location.</div>";
				mapContainer.appendChild(note);
			}

			// Force a redraw after a short delay
			setTimeout(() => {
				me.buildingMap.invalidateSize();
			}, 100);
		}, 300);
	}

	isPointInPolygon(point, polygonGeoJSON) {
		// Convert GeoJSON polygon to an array of L.latLng points
		const polygonPoints = polygonGeoJSON.coordinates[0].map((coord) =>
			L.latLng(coord[1], coord[0])
		);

		// Create a temporary Leaflet polygon
		const tempPolygon = L.polygon(polygonPoints);

		// Use Leaflet's contains method to check if the point is inside
		return tempPolygon.getBounds().contains(point);
	}

	openAddUnitDialog(buildingName) {
		const me = this;
		const building = me.buildings.find((b) => b.name === buildingName);

		if (!building) {
			frappe.msgprint(__(`Building ${buildingName} not found. Try refreshing the page.`));
			return;
		}

		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Bedroom",
				fields: ["name"],
			},
			callback: function (r) {
				const bedroomOptions = r.message ? r.message.map((b) => b.name).join("\n") : "";

				const d = new frappe.ui.Dialog({
					title: "Add New Unit",
					fields: [
						{
							fieldname: "building_info",
							fieldtype: "HTML",
							options: `<div class="alert alert-info">Adding unit to building: <strong>${building.building_id}</strong></div>`,
						},
						{
							label: "Unit ID",
							fieldname: "unit_id",
							fieldtype: "Data",
							reqd: 1,
						},
						{
							label: "Status",
							fieldname: "status",
							fieldtype: "Select",
							options: "\nAvailable\nSold-out\nSecondhand Sale\nSecondhand Rent",
						},
						{
							label: "Bedrooms",
							fieldname: "bedrooms",
							fieldtype: "Link",
							options: "Bedroom",
							reqd: 1,
						},
						{
							label: "Area (sqft)",
							fieldname: "area_sqft",
							fieldtype: "Float",
							reqd: 1,
						},
						{
							fieldname: "section_break_amenities",
							fieldtype: "Section Break",
							label: "Unit Amenities",
						},
						{
							fieldname: "unit_amenities",
							fieldtype: "Table MultiSelect",
							label: "Amenities",
							options: "Amenities",
						},
					],
					primary_action_label: "Create",
					primary_action: function (values) {
						// Calculate area in sqm (1 sqft = 0.092903 sqm) with correct precision
						const area_sqm = (values.area_sqft * 0.092903).toFixed(1);

						frappe.call({
							method: "frappe.client.insert",
							args: {
								doc: {
									doctype: "Unit",
									building: buildingName,
									project: me.project.name,
									developer: me.project.developer,
									bedrooms: values.bedrooms,
									area_sqft: values.area_sqft,
									area_sqm: area_sqm,
									unit_id: values.unit_id,
									unit_amenities: values.unit_amenities,
								},
							},
							callback: function (r) {
								if (r.message) {
									frappe.show_alert({
										message: __("Unit created successfully"),
										indicator: "green",
									});

									me.refresh();
									d.hide();
								}
							},
						});
					},
				});

				d.show();
			},
		});
	}

	openChangeStatusDialog(doctype, name, currentStatus) {
		const me = this;

		const d = new frappe.ui.Dialog({
			title: `Change ${doctype} Status`,
			fields: [
				{
					label: "Status",
					fieldname: "status",
					fieldtype: "Select",
					options: "\nAvailable\nSold-out\nSecondhand Sale\nSecondhand Rent",
					default: currentStatus,
				},
			],
			primary_action_label: "Update",
			primary_action: function (values) {
				frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: doctype,
						name: name,
						fieldname: "status",
						value: values.status,
					},
					callback: function (r) {
						if (r.message) {
							frappe.show_alert({
								message: __("Status updated successfully"),
								indicator: "green",
							});

							me.refresh();
							d.hide();
						}
					},
				});
			},
		});

		d.show();
	}

	deleteBuilding(buildingName) {
		const me = this;

		frappe.confirm(
			__(
				"Are you sure you want to delete this building? This will also delete all units in this building."
			),
			() => {
				frappe.call({
					method: "frappe.client.delete",
					args: {
						doctype: "Building",
						name: buildingName,
					},
					callback: function (r) {
						frappe.show_alert({
							message: __("Building deleted successfully"),
							indicator: "green",
						});

						me.refresh();
					},
				});
			}
		);
	}

	deleteUnit(unitName) {
		const me = this;

		frappe.confirm(__("Are you sure you want to delete this unit?"), () => {
			frappe.call({
				method: "frappe.client.delete",
				args: {
					doctype: "Unit",
					name: unitName,
				},
				callback: function (r) {
					frappe.show_alert({
						message: __("Unit deleted successfully"),
						indicator: "green",
					});

					me.refresh();
				},
			});
		});
	}

	refresh() {
		this.buildings = [];
		this.units = [];
		this.renderDashboard();
		this.fetchData().then(() => {
			this.renderMap();
			this.renderBuildingsList();
			this.renderUnitsList();
		});
	}
}

// Export the class
frappe.crm = frappe.crm || {};
frappe.crm.ProjectDashboard = ProjectDashboard;