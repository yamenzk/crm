frappe.pages["crm-news"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "News",
		single_column: true,
	});

	// Add filters section
	let filters_section = $(`<div class="crm-news-filters"></div>`).appendTo(page.main);

	// Add content area
	let content = $(`<div class="crm-news-content-container"></div>`).appendTo(page.main);

	// Initialize the page
	initPage(page, filters_section, content);
};

function initPage(page, filters_section, content) {
	// Create state to store filter values
	const state = {
		filters: {
			source: "",
			period: "today",
			searchTerm: "",
		},
	};

	// Add custom button to refresh news
	page.set_primary_action("Refresh", () => loadNews(content, state.filters), "refresh");

	// Add search bar
	addSearchFilter(filters_section, content, state);

	// Load all sources for the filter dropdown
	frappe.call({
		method: "crm.api.get_news_data",
		callback: function (r) {
			if (r.message && r.message.success) {
				// Add source and date filters with the sources data
				addSourceFilter(filters_section, content, state, r.message.all_sources);
				addDateFilter(filters_section, content, state);

				// Load news initially
				loadNews(content, state.filters);
			} else {
				frappe.msgprint(__("Failed to load news sources. Please try again."));
			}
		},
	});
}

function addSearchFilter(filters_section, content, state) {
	let search_container = $(`
        <div class="crm-news-search-container">
            <div class="frappe-control input-max-width">
                <div class="crm-news-search-input-wrapper">
                    <i class="crm-news-search-icon" data-feather="search" style="width: 16px; height: 16px;"></i>
                    <input type="text" class="form-control crm-news-search" placeholder="Search news...">
                </div>
            </div>
        </div>
    `).appendTo(filters_section);

	// Add debounced search functionality
	let timeout = null;
	search_container.find(".crm-news-search").on("input", function () {
		clearTimeout(timeout);
		state.filters.searchTerm = $(this).val();

		timeout = setTimeout(() => {
			loadNews(content, state.filters);
		}, 300);
	});
}

function addSourceFilter(filters_section, content, state, sources) {
	let source_container = $(`
        <div class="crm-news-filter-container">
            <div class="crm-news-filter-label">Source:</div>
            <div class="frappe-control" style="width: 200px;">
                <select class="form-control crm-news-source-filter">
                    <option value="">All Sources</option>
                </select>
            </div>
        </div>
    `).appendTo(filters_section);

	// Populate dropdown with sources
	let select = source_container.find(".crm-news-source-filter");

	sources.forEach((source) => {
		select.append(`<option value="${source.name}">${source.source_name}</option>`);
	});

	// Add change event
	select.on("change", function () {
		state.filters.source = $(this).val();
		loadNews(content, state.filters);
	});
}

function addDateFilter(filters_section, content, state) {
	let date_container = $(`
        <div class="crm-news-filter-container">
            <div class="crm-news-filter-label">Period:</div>
            <div class="frappe-control" style="width: 150px;">
                <select class="form-control crm-news-date-filter">
                    <option value="all">All Time</option>
                    <option value="today" selected>Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                </select>
            </div>
			<div class="crm-news-count-display"></div>
        </div>
    `).appendTo(filters_section);

	// Add change event
	date_container.find(".crm-news-date-filter").on("change", function () {
		state.filters.period = $(this).val();
		loadNews(content, state.filters);
	});
}

function loadNews(content, filters) {
	// Show loading state
	content.html(`
        <div class="crm-news-loading">
            <div class="crm-news-loading-animation"></div>
            <div class="crm-news-loading-text">Loading news...</div>
        </div>
    `);

	// Call the API endpoint with filters
	frappe.call({
		method: "crm.api.get_news_data",
		args: {
			source: filters.source,
			period: filters.period,
			search_term: filters.searchTerm,
		},
		callback: function (r) {
			if (r.message && r.message.success) {
				const { news, sources } = r.message;

				// Update the count display
				updateArticleCount(news.length);

				if (news.length === 0) {
					content.html(`
                        <div class="crm-news-no-news">
                            <div class="crm-news-no-news-icon">
                                <i data-feather="file-text" style="width: 48px; height: 48px;"></i>
                            </div>
                            <div class="crm-news-no-news-text">No news found</div>
                            <div class="crm-news-no-news-subtext">Try adjusting your filters</div>
                        </div>
                    `);
					if (typeof feather !== "undefined") {
						feather.replace();
					}
					return;
				}

				let news_grid = $('<div class="crm-news-grid"></div>');

				// Render each news item using the preloaded source data
				news.forEach((item, index) => {
					const sourceData = sources[item.source] || {};
					renderNewsItem(news_grid, item, sourceData.favicon, index);
				});

				// Replace content
				content.empty().append(news_grid);
			} else {
				updateArticleCount(0);
				content.html(`
                    <div class="crm-news-error-message">
                        <div class="crm-news-error-icon">
                            <i data-feather="alert-circle" style="width: 36px; height: 36px;"></i>
                        </div>
                        <div class="crm-news-error-text">Unable to load news</div>
                        <div class="crm-news-error-subtext">Please try again later</div>
                    </div>
                `);
				if (typeof feather !== "undefined") {
					feather.replace();
				}
			}
		},
	});
}

// Add a function to update the article count
function updateArticleCount(count) {
	let countDisplay = $(".crm-news-count-display");

	if (countDisplay.length === 0) {
		// Create the count display if it doesn't exist
		countDisplay = $(`<div class="crm-news-count-display"></div>`);
		$(".crm-news-filters").after(countDisplay);
	}

	// Update the count text with appropriate wording
	if (count === 0) {
		countDisplay.html(`<span>No articles found</span>`);
	} else if (count === 1) {
		countDisplay.html(`<span>Showing 1 article</span>`);
	} else {
		countDisplay.html(`<span>Showing ${count} articles</span>`);
	}
}

function renderNewsItem(container, newsItem, sourceFavicon, index) {
	let favicon_html = sourceFavicon
		? `<img src="${sourceFavicon}" class="crm-news-source-favicon" alt="${newsItem.source}">`
		: `<div class="crm-news-source-favicon-placeholder">${newsItem.source.charAt(0)}</div>`;

	let card = $(`
        <div class="crm-news-card" data-name="${newsItem.name}" style="--index: ${index}">
            <div class="crm-news-image">
                ${
					newsItem.image
						? `<img src="${newsItem.image}" alt="${newsItem.news_title}">`
						: `<div class="crm-news-placeholder-image">${newsItem.news_title.charAt(
								0
						  )}</div>`
				}
            </div>
            <div class="crm-news-content">
                <h3 class="crm-news-title">
                    <a href="${newsItem.link || "#"}" target="_blank" rel="noopener noreferrer">
                        ${newsItem.news_title}
                    </a>
                </h3>
                <div class="crm-news-meta">
                    <div class="crm-news-source">
                        ${favicon_html}
                        <span>${newsItem.source}</span>
                    </div>
                    <div class="crm-news-date">${newsItem.published_date_str}</div>
                </div>
            </div>
        </div>
    `).appendTo(container);

	// Make entire card clickable to open the link in a new tab
	card.on("click", function (e) {
		// Only open if not clicking on other interactive elements
		if (!$(e.target).closest("a, button").length) {
			window.open(newsItem.link, "_blank");
		}
	});

	// Initialize feather icons in this card
	if (typeof feather !== "undefined") {
		feather.replace();
	}
}

// Add styles to the page
frappe.pages["crm-news"].on_page_show = function () {
	// Add CSS only once
	if (!document.getElementById("crm-news-styles")) {
		const style = document.createElement("style");
		style.id = "crm-news-styles";
		style.textContent = `
            /* Overall page layout */
            .crm-news .page-head {
                border-bottom: none !important;
            }
            
            .crm-news .page-content {
                background-color: var(--bg-color);
            }
            
            /* News filters */
            .crm-news-filters {
                display: flex;
                flex-wrap: wrap;
                gap: var(--margin-md);
                margin-bottom: var(--margin-lg);
                padding: var(--padding-md);
                background-color: var(--bg-color);
                box-shadow: var(--shadow-sm);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            
            .crm-news-filter-container, .crm-news-search-container {
                display: flex;
                align-items: center;
                gap: var(--margin-sm);
            }
            
            .crm-news-filter-label {
                font-size: var(--text-sm);
                color: var(--text-muted);
                white-space: nowrap;
                font-weight: var(--weight-medium);
            }
            
            /* Search styling */
            .crm-news-search-input-wrapper {
                position: relative;
                display: flex;
                align-items: center;
            }
            
            .crm-news-search-icon {
                position: absolute;
                left: 10px;
                color: var(--text-muted);
                pointer-events: none;
                z-index: 1;
            }
            
            .crm-news-search {
                padding-left: 32px !important;
                background-color: var(--control-bg) !important;
                border-color: transparent !important;
                transition: all 0.2s ease;
                width: 240px;
                border-radius: var(--border-radius-md) !important;
            }
            
            .crm-news-search:focus {
                background-color: var(--fg-color) !important;
                border-color: var(--primary) !important;
                box-shadow: var(--shadow-sm) !important;
            }
            
            /* Dropdown styling */
            .crm-news-source-filter, .crm-news-date-filter {
                background-color: var(--control-bg) !important;
                border-color: transparent !important;
                border-radius: var(--border-radius-md) !important;
                transition: all 0.2s ease;
                height: 32px !important;
                appearance: auto;
                padding: 0 10px !important;
            }
            
            .crm-news-source-filter:focus, .crm-news-date-filter:focus {
                background-color: var(--fg-color) !important;
                border-color: var(--primary) !important;
                box-shadow: var(--shadow-sm) !important;
            }
            
            /* News grid */
            .crm-news-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: var(--margin-lg);
				padding: 0 var(--padding-md);
                padding-bottom: var(--padding-xl);
            }
            
            /* News card */
            .crm-news-card {
                display: flex;
                flex-direction: column;
                background-color: var(--subtle-accent);
                border-radius: var(--border-radius-lg);
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
                box-shadow: var(--shadow-sm);
                height: 100%;
                position: relative;
                cursor: pointer;
                border: 1px solid var(--border-color);
            }
            
            .crm-news-card:hover {
                transform: translateY(-4px);
                box-shadow: var(--shadow-lg);
            }
            
            .crm-news-card:active {
                transform: translateY(-2px);
                transition: all 0.1s ease;
            }
            
            .crm-news-image {
                height: 200px;
                background-color: var(--gray-100);
                position: relative;
                overflow: hidden;
            }
            
            .crm-news-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .crm-news-card:hover .crm-news-image img {
                transform: scale(1.05);
            }
            
            .crm-news-placeholder-image {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--gray-200), var(--gray-300));
                color: var(--gray-600);
                font-size: var(--text-6xl);
                font-weight: var(--weight-bold);
                text-transform: uppercase;
            }
            
            /* Dark mode adjustments */
            [data-theme="dark"] .crm-news-placeholder-image {
                background: linear-gradient(135deg, var(--gray-700), var(--gray-800));
                color: var(--gray-400);
            }
            
            .crm-news-content {
                padding: var(--padding-lg);
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                z-index: 1;
            }
            
            .crm-news-title {
                margin-top: 0;
                margin-bottom: var(--margin-md);
                font-size: var(--text-lg);
                line-height: 1.4;
                color: var(--text-color);
                font-weight: var(--weight-medium);
            }
            
            .crm-news-title a {
                color: var(--text-color);
                text-decoration: none;
                transition: color 0.2s ease;
                display: inline-block;
            }
            
            .crm-news-title a:hover {
                color: var(--text-muted);
            }
            
            .crm-news-external-link-icon {
                display: inline-block;
                margin-left: 4px;
                vertical-align: middle;
                opacity: 0.7;
            }
            
            .crm-news-meta {
                margin-top: auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: var(--text-sm);
                color: var(--text-muted);
                padding-top: var(--padding-sm);
                border-top: 1px solid var(--border-color);
            }
            
            .crm-news-source {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .crm-news-source-favicon {
                width: 16px;
                height: 16px;
                object-fit: contain;
                border-radius: 4px;
            }
            
            .crm-news-source-favicon-placeholder {
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: var(--gray-600);
                color: white;
                border-radius: 4px;
                font-size: 10px;
                font-weight: var(--weight-bold);
                text-transform: uppercase;
            }
            
            .crm-news-date {
                color: var(--text-light);
                font-size: var(--text-xs);
            }
            
            /* Loading and empty states */
            .crm-news-loading, .crm-news-no-news, .crm-news-error-message {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--padding-2xl);
                color: var(--text-muted);
                min-height: 300px;
            }
            
            .crm-news-loading-animation {
                position: relative;
                width: 40px;
                height: 40px;
            }
            
            .crm-news-loading-animation:before {
                content: '';
                box-sizing: border-box;
                position: absolute;
                top: 0;
                left: 0;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 3px solid var(--gray-200);
                border-top-color: var(--primary);
                animation: crm-news-spin 1s linear infinite;
            }
            
            @keyframes crm-news-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .crm-news-loading-text, .crm-news-no-news-text, .crm-news-error-text {
                font-size: var(--text-base);
                margin-top: var(--margin-md);
                font-weight: var(--weight-medium);
                color: var(--text-color);
            }
            
            .crm-news-no-news-subtext, .crm-news-error-subtext {
                font-size: var(--text-sm);
                margin-top: var(--margin-xs);
                color: var(--text-muted);
            }
            
            .crm-news-no-news-icon, .crm-news-error-icon {
                color: var(--gray-400);
                margin-bottom: var(--margin-md);
            }
            
            .crm-news-error-icon {
                color: var(--red-500);
            }
            
            .crm-news-error-text {
                color: var(--red-600);
            }
            
            /* Responsive adjustments */
            @media (max-width: 991px) {
                .crm-news-grid {
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                }
            }
            
            @media (max-width: 767px) {
                .crm-news-grid {
                    grid-template-columns: 1fr;
                    gap: var(--margin-md);
                }
                
                .crm-news-filters {
                    flex-direction: column;
                    align-items: stretch;
                    gap: var(--margin-sm);
                }
                
                .crm-news-filter-container, .crm-news-search-container {
                    width: 100%;
                }
                
                .crm-news-search {
                    width: 100%;
                }
                
                .crm-news-image {
                    height: 180px;
                }
            }
            
            /* Custom animation effects */
            @keyframes crm-news-fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .crm-news-card {
                animation: crm-news-fadeIn 0.3s ease forwards;
                animation-delay: calc(var(--index, 0) * 0.05s);
            }
			
			.crm-news-count-display {
				padding: var(--padding-sm) var(--padding-md);
				color: var(--text-muted);
				font-size: var(--text-sm);
				display: flex;
				align-items: center;
			}
        `;
		document.head.appendChild(style);
	}

	// Add the crm-news class to the page wrapper for styling
	$(".page-wrapper").addClass("crm-news");

	// Initialize feather icons
	if (typeof feather !== "undefined") {
		feather.replace();
	}
};
