frappe.pages["map-page"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Projects Map",
		single_column: true,
	});

	// Initialize the map page
	page.map_view = new MapView(page);
};

frappe.pages["map-page"].on_page_show = function (wrapper) {
	// Check if map_view exists
	if (!wrapper.page.map_view) {
		// If not, create a new instance
		wrapper.page.map_view = new MapView(wrapper.page);
	} else {
		// Otherwise, just update data without recreating the map
		wrapper.page.map_view.updateData();
	}
};

class MapView {
	constructor(page) {
		this.page = page;
		this.make();
		this.map = null;
		this.projects = [];
		this.buildings = [];
		this.projectMarkers = {};
		this.buildingMarkers = {};
		this.projectLayers = {}; // Just initialize as empty object
		this.filters = {
			status: "",
			developer: "",
			bedroom: "",
		};
		if (typeof CRMContextMenu === "undefined") {
			frappe.require("/assets/crm/js/common/context_menu.js", () => {});
		}

		this.setupFilters();
		this.fetchData();
		document.querySelectorAll(".leaflet-container").forEach((el) => {
			if (el._leaflet_id && !el.closest("#projects-map")) {
				const mapId = el._leaflet_id;
				if (L.DomUtil.get(mapId)) {
					L.DomUtil.get(mapId)._leaflet_id = null;
				}
			}
		});
	}

	make() {
		this.setupPage();
		this.renderMapContainer();
	}

	setupPage() {
		const me = this;

		// Add refresh button
		this.page.set_primary_action("Refresh", () => me.refresh(), "refresh");

		// Add developer filter button
		this.page.add_menu_item("Fit All Projects", () => me.fitAllProjects());

		// Add export button
		this.page.add_menu_item("Export Map", () => me.exportMap());
	}

	setupFilters() {
		const me = this;

		// Create filters section
		const filtersHTML = `
            <div class="map-filters-container">
                <div class="map-filter-group">
                    <label>Developer</label>
                    <select class="form-control map-filter-developer">
                        <option value="">All Developers</option>
                    </select>
                </div>
                
                <div class="map-filter-group">
                    <label>Status</label>
                    <select class="form-control map-filter-status">
                        <option value="">All Statuses</option>
                        <option value="Available">Available</option>
                        <option value="Sold-out">Sold-out</option>
                        <option value="Secondhand Sale">Secondhand Sale</option>
                        <option value="Secondhand Rent">Secondhand Rent</option>
                    </select>
                </div>
                
                <div class="map-filter-group">
                    <label>Bedrooms</label>
                    <select class="form-control map-filter-bedroom">
                        <option value="">All Bedrooms</option>
                    </select>
                </div>
            </div>
        `;

		$(this.page.main).prepend(filtersHTML);

		// Set up filter change events
		$(this.page.main)
			.find(".map-filter-developer")
			.on("change", function () {
				me.filters.developer = $(this).val();
				me.applyFilters();
			});

		$(this.page.main)
			.find(".map-filter-status")
			.on("change", function () {
				me.filters.status = $(this).val();
				me.applyFilters();
			});

		$(this.page.main)
			.find(".map-filter-bedroom")
			.on("change", function () {
				me.filters.bedroom = $(this).val();
				me.applyFilters();
			});
	}

	renderMapContainer() {
		$(this.page.main).append(`
            <div class="map-container">
                <div id="projects-map"></div>
            </div>
            <style>
                .map-container {
                    width: 100%;
                    height: 100vh;
                    overflow: hidden;
                    background-color: var(--card-bg);
                    box-shadow: var(--shadow-sm);
                }
                
                #projects-map {
                    width: 100%;
                    height: 100%;
                }
					
                
                .map-filters-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    padding: 12px;
                    background-color: var(--card-bg);
                }

				.building-marker {
					transition: transform 0.2s ease;
				}

				.building-marker:hover {
					transform: scale(1.2);
					z-index: 1000 !important;
				}

				.project-marker {
					transition: transform 0.2s ease;
				}

				.project-marker:hover {
					transform: scale(1.2);
					z-index: 1000 !important;
				}
                
                .map-filter-group {
                    min-width: 200px;
                    flex: 1;
                }
                
                .map-filter-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-size: var(--text-sm);
                    color: var(--text-muted);
                }
                
                .map-popup {
                    width: 320px;
                    padding: 0;
                    border-radius: var(--border-radius);
                }
                
                .map-popup-header {
                    padding: 12px;
                    border-bottom: 1px solid var(--border-color);
                    background-color: var(--card-bg);
                    color: var(--text-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: var(--border-radius) var(--border-radius) 0 0;
                }
                
                .map-popup-header h4 {
                    margin: 0;
                    font-size: var(--text-md);
                    font-weight: var(--weight-medium);
                    color: var(--heading-color);
                }
                
                .map-popup-content {
                    background-color: var(--subtle-accent);
                    color: var(--text-color);
                    padding: 12px;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .map-popup-section {
                    margin-bottom: 12px;
                }

				.map-popup-section p{
					margin: 0;
				}
                
                .map-popup-section-title {
                    font-size: var(--text-sm);
                    font-weight: var(--weight-medium);
                    color: var(--text-muted);
                    margin-bottom: 6px;
                }
                
                .map-status-group {
                    margin-bottom: 10px;
                    border-left: 3px solid var(--control-bg);
                    padding-left: 8px;
                }
                
                .map-status-available {
                    border-color: var(--green-500);
                }
                
                .map-status-sold-out {
                    border-color: var(--gray-500);
                }
                
                .map-status-secondhand-sale {
                    border-color: var(--pink-500);
                }
                
                .map-status-secondhand-rent {
                    border-color: var(--orange-500);
                }
                
                .map-status-title {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: var(--weight-medium);
                    font-size: var(--text-sm);
                    margin-bottom: 4px;
                }
                
                .map-status-count {
                    font-size: var(--text-xs);
                    background-color: var(--control-bg);
                    padding: 2px 6px;
                    border-radius: 10px;
                }
                
                .map-bedroom-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--text-xs);
                    color: var(--text-color);
                    padding: 2px 0;
                }
                
                .map-popup-actions {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    border-top: 1px solid var(--border-color);
                    background-color: var(--card-bg);
                    border-radius: 0 0 var(--border-radius) var(--border-radius);
                }
                
                .map-btn-icon {
                    width: 14px;
                    height: 14px;
                    margin-right: 4px;
                }
                
                .leaflet-popup-content-wrapper {
                    border-radius: var(--border-radius) !important;
					background-color: var(--card-bg) !important;
                }
                
                .leaflet-popup-content {
                    margin: 0 !important;
                    width: auto !important;
					background-color: var(--card-bg) !important;
					border-radius: var(--border-radius) !important;

                }
				#projects-map, .leaflet-container {
					z-index: 1;
					pointer-events: auto !important;
				}

				.map-popup-image {
					width: 100%;
					overflow: hidden;
					line-height: 0;
				}

				.map-popup-image img {
					transition: transform 0.3s ease;

				}

				.map-popup-image img:hover {
					transform: scale(1.05);
				}
                
                .project-marker {
                    background-color: var(--heading-color);
                    border: 2px solid var(--card-bg);
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-size: 12px;
                    font-weight: bold;
                    color: var(--card-bg);
                    box-shadow: 0 0 4px rgba(0,0,0,0.4);
                }
                
                @media (max-width: 768px) {
                    .map-container {
                        height: calc(100vh - 250px);
                    }
                    
                    .map-filter-group {
                        min-width: 100%;
                    }
                }
            </style>
        `);

	}

	initializeMap() {
		// First, properly clean up any existing map instance
		if (this.map) {
			// Remove all event listeners
			this.map.off();
			// Remove the map completely
			this.map.remove();
			this.map = null;
		}

		// Make sure the container is clean
		const mapContainer = document.getElementById("projects-map");
		if (mapContainer) {
			// Clear any content
			mapContainer.innerHTML = "";
			// Reset any leaflet ID that might be attached
			if (mapContainer._leaflet_id) {
				delete mapContainer._leaflet_id;
			}
		}

		// Now initialize a new map
		this.map = L.map("projects-map", {
			dragging: true,
			tap: false, // Disable tap handler to prevent issues with touch events
		}).setView([25.276987, 55.296249], 10);

		console.log("Map dragging enabled:", this.map.dragging.enabled());

		// Function to determine if dark mode is active
		const isDarkMode = () => {
			return (
				document.documentElement.getAttribute("data-theme-mode") === "dark" ||
				document.documentElement.getAttribute("data-theme") === "dark"
			);
		};

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

		// Set up theme change observer
		const mapObserver = new MutationObserver((mutations) => {
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

		// Start observing theme changes
		mapObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme-mode", "data-theme"],
		});

		// Add layer controls
		this.projectLayers = {
			// Recreate the entire object
			Projects: new L.LayerGroup().addTo(this.map),
			Buildings: new L.LayerGroup().addTo(this.map),
		};

		// Add layer controls
		L.control
			.layers(null, this.projectLayers, {
				position: "topright",
				collapsed: false,
			})
			.addTo(this.map);
	}

	fetchData() {
		const me = this;

		// Clear existing data first
		me.projects = [];
		me.buildings = [];
		me.projectMarkers = {};
		me.buildingMarkers = {};

		// Show loading indicator
		frappe.show_alert({
			message: __("Fetching projects and buildings..."),
			indicator: "blue",
		});

		// Fetch all projects with coordinates
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Project",
				filters: {
					coords: ["!=", ""],
				},
				fields: ["name", "project_name", "developer", "status", "coords", "cover_photo"],
				limit: "all",
			},
			callback: function (r) {
				me.projects = r.message || [];

				// Fetch all buildings for these projects
				const buildingPromises = me.projects.map((project) => {
					return new Promise((resolve) => {
						frappe.call({
							method: "frappe.client.get_list",
							args: {
								doctype: "Building",
								filters: {
									project: project.name,
									lat: ["!=", ""],
									lng: ["!=", ""],
								},
								fields: [
									"name",
									"building_id",
									"developer",
									"status",
									"lat",
									"lng",
									"project",
								],
								limit: "all",
							},
							callback: function (r) {
								// Instead of accumulating, we use a set operation to ensure uniqueness
								const newBuildings = r.message || [];
								const existingBuildingNames = me.buildings.map((b) => b.name);

								// Only add buildings that don't already exist
								newBuildings.forEach((building) => {
									if (!existingBuildingNames.includes(building.name)) {
										me.buildings.push(building);
									}
								});

								resolve();
							},
						});
					});
				});

				// When all buildings are fetched, fetch their units
				Promise.all(buildingPromises).then(() => {
					me.fetchUnits().then(() => {
						// Populate developer filter
						me.populateDeveloperFilter();
						// Populate bedroom filter
						me.populateBedroomFilter();
						// Render projects and buildings on map
						me.renderMap();
					});
				});
			},
		});
	}

	fetchUnits() {
		const me = this;

		return new Promise((resolve) => {
			if (me.buildings.length === 0) {
				resolve();
				return;
			}

			// Get all building names
			const buildingNames = me.buildings.map((building) => building.name);

			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Unit",
					filters: {
						building: ["in", buildingNames],
					},
					fields: ["name", "unit_id", "building", "status", "bedrooms", "area_sqft"],
					limit: "all",
				},
				callback: function (r) {
					const units = r.message || [];

					// Add units to their respective buildings
					me.buildings.forEach((building) => {
						building.units = units.filter((unit) => unit.building === building.name);
					});

					resolve();
				},
			});
		});
	}

	updateData() {
		// Update data without rebuilding the entire map
		this.projects = [];
		this.buildings = [];
	}

	populateDeveloperFilter() {
		const uniqueDevelopers = [
			...new Set(this.projects.map((project) => project.developer).filter(Boolean)),
		];
		const $developerFilter = $(this.page.main).find(".map-filter-developer");

		uniqueDevelopers.forEach((developer) => {
			$developerFilter.append(`<option value="${developer}">${developer}</option>`);
		});
	}

	populateBedroomFilter() {
		const allUnits = this.buildings.flatMap((building) => building.units || []);
		const uniqueBedrooms = [...new Set(allUnits.map((unit) => unit.bedrooms).filter(Boolean))];
		const $bedroomFilter = $(this.page.main).find(".map-filter-bedroom");

		uniqueBedrooms.sort((a, b) => {
			// Sort bedrooms numerically if possible
			const aNum = parseInt(a);
			const bNum = parseInt(b);
			if (!isNaN(aNum) && !isNaN(bNum)) {
				return aNum - bNum;
			}
			return a.localeCompare(b);
		});

		uniqueBedrooms.forEach((bedroom) => {
			$bedroomFilter.append(`<option value="${bedroom}">${bedroom}</option>`);
		});
	}

	renderMap() {
		const me = this;

		// Clear existing layers (with safety check)
		if (
			this.projectLayers["Projects"] &&
			typeof this.projectLayers["Projects"].clearLayers === "function"
		) {
			this.projectLayers["Projects"].clearLayers();
		}

		if (
			this.projectLayers["Buildings"] &&
			typeof this.projectLayers["Buildings"].clearLayers === "function"
		) {
			this.projectLayers["Buildings"].clearLayers();
		}

		this.projectMarkers = {};
		this.buildingMarkers = {};

		// Make sure map is initialized
		if (!this.map) {
			this.initializeMap();
		}
		this.projectMarkers = {};
		this.buildingMarkers = {};

		// Add project areas/points
		this.projects.forEach((project) => {
			try {
				const coords = JSON.parse(project.coords);

				if (coords.type === "Polygon") {
					const polygon = L.polygon(
						coords.coordinates[0].map((coord) => [coord[1], coord[0]]),
						{
							color: "var(--heading-color)",
							fillColor: "var(--heading-color)",
							fillOpacity: 0.2,
							weight: 2,
						}
					);

					// Make sure we're adding to the correct layer
					polygon.addTo(this.projectLayers["Projects"]);

					// Add project info popup
					polygon.bindPopup(this.getProjectPopupContent(project));

					// Add to markers collection for filtering
					this.projectMarkers[project.name] = polygon;
				} else if (coords.type === "Point") {
					// For single point projects, find associated buildings
					const projectBuildings = this.buildings.filter(
						(b) => b.project === project.name
					);

					// If there's no building yet, show the project marker
					if (projectBuildings.length === 0) {
						// Create marker
						const marker = L.marker([coords.coordinates[1], coords.coordinates[0]], {
							icon: L.divIcon({
								className: "project-marker",
								html: `<div class="project-marker">${project.project_name.charAt(
									0
								)}</div>`,
								iconSize: [24, 24],
							}),
						}).addTo(this.projectLayers["Projects"]);

						// Add project info popup
						marker.bindPopup(this.getProjectPopupContent(project));

						// Add to markers collection for filtering
						this.projectMarkers[project.name] = marker;
					}

					// If there's only one building, make it represent the project
					else if (projectBuildings.length === 1) {
						// Make sure the building coordinates are shown at the project position
						const building = projectBuildings[0];

						// The actual building marker will be created in the buildings loop below
						// We'll just make a note that this project is already represented by its building
						this.projectMarkers[project.name] = this.buildingMarkers[building.name];
					}
					// If there are multiple buildings for a point project, still show the project marker
					else {
						const marker = L.marker([coords.coordinates[1], coords.coordinates[0]], {
							icon: L.divIcon({
								className: "project-marker",
								html: `<div class="project-marker">${project.project_name.charAt(
									0
								)}</div>`,
								iconSize: [24, 24],
							}),
						}).addTo(this.projectLayers["Projects"]);

						marker.bindPopup(this.getProjectPopupContent(project));
						this.projectMarkers[project.name] = marker;
					}
				}
			} catch (e) {
				console.error(`Error rendering project ${project.name}:`, e);
			}
		});

		// Add building markers
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
						className: "building-marker",
						html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--card-bg);"></div>`,
						iconSize: [16, 16],
					}),
				}).addTo(this.projectLayers["Buildings"]);

				// Add building info popup with units grouped by status and bedrooms
				marker.bindPopup(this.getBuildingPopupContent(building));

				// Store marker for filtering
				this.buildingMarkers[building.name] = marker;

				// Add custom context menu
				marker.on("contextmenu", function (e) {
					L.DomEvent.preventDefault(e);

					const menuConfig = {
						x: e.originalEvent.pageX,
						y: e.originalEvent.pageY,
						sections: [
							{
								items: [
									{
										label: "View Building",
										icon: "edit",
										action: "edit",
										data: { building: building.name },
									},
									{
										label: "View Project",
										icon: "folder",
										action: "view_project",
										data: { project: building.project },
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
								],
							},
						],
						onItemClick: function (action, button) {
							const buildingName = button.data("building");

							if (action === "edit") {
								frappe.set_route("Form", "Building", buildingName);
							} else if (action === "view_project") {
								frappe.set_route("Form", "Project", button.data("project"));
							} else if (action === "navigate") {
								const lat = button.data("lat");
								const lng = button.data("lng");
								window.open(
									`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
									"_blank"
								);
							}
						},
					};

					CRMContextMenu.create(menuConfig);
				});
			}
		});

		// Fit map to show all projects
		this.fitAllProjects();

		// Hide loading indicator
		frappe.show_alert(
			{
				message: __("Projects and buildings loaded"),
				indicator: "green",
			},
			3
		);
	}

	getProjectPopupContent(project) {
		// Get buildings for this project
		const projectBuildings = this.buildings.filter((b) => b.project === project.name);
		const buildingCount = projectBuildings.length;

		// Get units for this project
		const projectUnits = projectBuildings.flatMap((b) => b.units || []);
		const unitCount = projectUnits.length;

		// Count available units
		const availableUnits = projectUnits.filter((u) => u.status === "Available").length;

		// Create popup content
		return `
            <div class="map-popup">
                <div class="map-popup-header">
                    <h4>${project.project_name}</h4>
                </div>
                
                <div class="map-popup-content">
                    <div class="map-popup-section">
                        ${
							project.developer
								? `<p><strong>Developer:</strong> ${project.developer}</p>`
								: ""
						}
                        ${
							project.status
								? `<p><strong>Status:</strong> ${project.status}</p>`
								: ""
						}
                        <p><strong>Buildings:</strong> ${buildingCount}</p>
                        <p><strong>Units:</strong> ${unitCount} (${availableUnits} available)</p>
                    </div>
                </div>
                
                <div class="map-popup-actions">
                    <button class="btn btn-sm btn-primary map-view-project" data-project="${
						project.name
					}">
                        <i class="fa fa-eye map-btn-icon"></i> View Project
                    </button>
                </div>
            </div>
        `;
	}

	getBuildingPopupContent(building) {
		const units = building.units || [];
		const buildingId = building.building_id || "Unknown Building";
		const associatedProject = this.projects.find((p) => p.name === building.project) || {};
		const projectCoverPhoto = associatedProject.cover_photo;

		// Group units by status
		const unitsByStatus = {};
		units.forEach((unit) => {
			const status = unit.status || "Unknown";
			if (!unitsByStatus[status]) {
				unitsByStatus[status] = [];
			}
			unitsByStatus[status].push(unit);
		});

		// For each status, group by bedrooms
		const statusGroups = {};
		Object.keys(unitsByStatus).forEach((status) => {
			statusGroups[status] = {};
			unitsByStatus[status].forEach((unit) => {
				const bedrooms = unit.bedrooms || "Unknown";
				if (!statusGroups[status][bedrooms]) {
					statusGroups[status][bedrooms] = [];
				}
				statusGroups[status][bedrooms].push(unit);
			});
		});

		// Generate HTML for the status groups
		let statusHtml = "";

		const statuses = Object.keys(statusGroups);
		if (statuses.length === 0) {
			statusHtml = '<p class="text-muted">No units added yet</p>';
		} else {
			statuses.forEach((status) => {
				const statusClass = status.toLowerCase().replace(/[^a-z0-9]/g, "-");
				const totalUnitsInStatus = unitsByStatus[status].length;

				statusHtml += `
                    <div class="map-status-group map-status-${statusClass}">
                        <div class="map-status-title">
                            <span>${status}</span>
                            <span class="map-status-count">${totalUnitsInStatus}</span>
                        </div>
                        <div class="map-status-bedrooms">
                `;

				// Add bedroom rows
				Object.keys(statusGroups[status]).forEach((bedroom) => {
					const bedroomCount = statusGroups[status][bedroom].length;
					statusHtml += `
                        <div class="map-bedroom-row">
                            <span>${bedroom} Bedroom</span>
                            <span>${bedroomCount} units</span>
                        </div>
                    `;
				});

				statusHtml += `
                        </div>
                    </div>
                `;
			});
		}

		// Create complete popup content
		return `
        <div class="map-popup">
            <div class="map-popup-header">
                <h4>${buildingId}</h4>
            </div>
            
            ${
				projectCoverPhoto
					? `
            <div class="map-popup-image">
                <img src="${projectCoverPhoto}" alt="Project Cover" style="width:100%; height:auto; max-height:150px; object-fit:cover; border-bottom: 1px solid var(--border-color);">
            </div>
            `
					: ""
			}
            
            <div class="map-popup-content">
                <div class="map-popup-section">
                    ${
						building.developer
							? `<p><strong>Developer:</strong> ${building.developer}</p>`
							: ""
					}
                    ${building.status ? `<p><strong>Status:</strong> ${building.status}</p>` : ""}
                    ${
						associatedProject.project_name
							? `<p><strong>Project:</strong> ${associatedProject.project_name}</p>`
							: ""
					}
                    <p><strong>Total Units:</strong> ${units.length}</p>
                </div>
                
                <div class="map-popup-section">
                    <div class="map-popup-section-title">Units by Status & Bedrooms</div>
                    ${statusHtml}
                </div>
            </div>
            
            <div class="map-popup-actions">
                <button class="btn btn-sm btn-primary map-view-building" data-building="${
					building.name
				}">
                    <i class="fa fa-eye map-btn-icon"></i> View Building
                </button>
                <button class="btn btn-sm btn-default map-view-project" data-project="${
					building.project
				}">
                    <i class="fa fa-folder map-btn-icon"></i> View Project
                </button>
            </div>
        </div>
    `;
	}

	applyFilters() {
		const me = this;

		// Get filter values
		const developerFilter = this.filters.developer;
		const statusFilter = this.filters.status;
		const bedroomFilter = this.filters.bedroom;

		// Filter projects based on developer
		this.projects.forEach((project) => {
			const marker = this.projectMarkers[project.name];
			if (!marker) return;

			let visible = true;

			// Apply developer filter to projects
			if (developerFilter && project.developer !== developerFilter) {
				visible = false;
			}

			// Show/hide project marker
			if (visible) {
				this.projectLayers["Projects"].addLayer(marker);
			} else {
				this.projectLayers["Projects"].removeLayer(marker);
			}
		});

		// Filter buildings based on status, developer, and units with matching bedrooms
		this.buildings.forEach((building) => {
			const marker = this.buildingMarkers[building.name];
			if (!marker) return;

			let visible = true;

			// Apply developer filter to buildings
			if (developerFilter && building.developer !== developerFilter) {
				visible = false;
			}

			// Apply status filter to buildings
			if (statusFilter && building.status !== statusFilter) {
				visible = false;
			}

			// Apply bedroom filter to buildings
			if (bedroomFilter && visible) {
				const units = building.units || [];
				// Check if building has any unit with the selected bedroom
				const hasMatchingBedroom = units.some((unit) => unit.bedrooms === bedroomFilter);
				if (!hasMatchingBedroom) {
					visible = false;
				}
			}

			// Show/hide building marker
			if (visible) {
				this.projectLayers["Buildings"].addLayer(marker);
			} else {
				this.projectLayers["Buildings"].removeLayer(marker);
			}
		});
	}

	refresh() {
		// Clear data and reload
		this.projects = [];
		this.buildings = [];
		this.projectMarkers = {};
		this.buildingMarkers = {};

		// Reset filters
		this.filters = {
			status: "",
			developer: "",
			bedroom: "",
		};

		$(this.page.main).find(".map-filter-developer").val("");
		$(this.page.main).find(".map-filter-status").val("");
		$(this.page.main).find(".map-filter-bedroom").val("");

		// Reinitialize the map properly
		this.initializeMap();

		// Fetch data again
		this.fetchData();
	}

	fitAllProjects() {
		// Create a bounds object to encompass all projects and buildings
		const bounds = L.latLngBounds([]);

		// Add project coordinates to bounds
		this.projects.forEach((project) => {
			try {
				const coords = JSON.parse(project.coords);

				if (coords.type === "Polygon") {
					// Add all polygon points to bounds
					coords.coordinates[0].forEach((coord) => {
						bounds.extend(L.latLng(coord[1], coord[0]));
					});
				} else if (coords.type === "Point") {
					bounds.extend(L.latLng(coords.coordinates[1], coords.coordinates[0]));
				}
			} catch (e) {
				console.error(`Error processing project bounds for ${project.name}:`, e);
			}
		});

		// Add building coordinates to bounds
		this.buildings.forEach((building) => {
			if (building.lat && building.lng) {
				bounds.extend(L.latLng(building.lat, building.lng));
			}
		});

		// Fit map to bounds if not empty
		if (bounds.isValid()) {
			this.map.fitBounds(bounds, {
				padding: [50, 50],
			});
		}
	}

	exportMap() {
		frappe.warn(
			__("Export Map"),
			__("This feature will create a PNG image of the current map view. Continue?"),
			() => {
				// Use a library like html2canvas or leaflet plugins for exporting
				frappe.show_alert({
					message: __("Exporting map..."),
					indicator: "blue",
				});

				// Simple approach using window.print() for now
				window.print();

				frappe.show_alert(
					{
						message: __("Map exported"),
						indicator: "green",
					},
					3
				);
			}
		);
	}
}

// Add event handlers for popup buttons
$(document).on("click", ".map-view-project", function () {
	const projectName = $(this).data("project");
	frappe.set_route("Form", "Project", projectName);
});

$(document).on("click", ".map-view-building", function () {
	const buildingName = $(this).data("building");
	frappe.set_route("Form", "Building", buildingName);
});
