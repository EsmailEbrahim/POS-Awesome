export const normalizeBackgroundSyncInterval = (value, defaultValue = 30, minValue = 10) => {
	const parsed = parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return defaultValue;
	}
	return Math.max(minValue, parsed);
};

export const shouldRunBackgroundSync = ({
	posProfile,
	enableBackgroundSync,
	backgroundSyncInFlight,
	isOffline,
	usesLimitSearch,
}) => {
	if (!posProfile || !posProfile.name) {
		return false;
	}
	if (!enableBackgroundSync) {
		return false;
	}
	if (backgroundSyncInFlight) {
		return false;
	}
	if (isOffline) {
		return false;
	}
	if (usesLimitSearch) {
		return false;
	}
	return true;
};
