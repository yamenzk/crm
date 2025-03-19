
/**
 * Shows a loading overlay on the page
 * @param {string} message - Optional message to display in the loading overlay
 * @returns {jQuery} The loading overlay element
 */
window.showLoadingOverlay = function (message = "Loading") {
	const loadingOverlay = $(`
		<div id="crm-loading-overlay" class="crm-loading-overlay">
			<div class="crm-loading-box">
				<div class="text-muted">${message}</div>
				<div class="progress crm-loading-progress">
					<div class="progress-bar progress-bar-striped active crm-loading-bar" 
						role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
					</div>
				</div>
			</div>
		</div>
	`);

	$("body").append(loadingOverlay);
	return loadingOverlay;
};

/**
 * Hides and removes the loading overlay
 * @param {number} fadeOutDuration - Optional fade out duration in milliseconds
 */
window.hideLoadingOverlay = function (fadeOutDuration = 300) {
	$("#crm-loading-overlay").fadeOut(fadeOutDuration, function () {
		$(this).remove();
	});
};
