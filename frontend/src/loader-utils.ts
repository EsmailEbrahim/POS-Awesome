const DEFAULT_POSAPP_BASE_PATH = "/app/posapp";

export function resolvePosAppNormalizedPath(
	pathname: string,
	basePath = DEFAULT_POSAPP_BASE_PATH,
): string | null {
	if (!pathname || !basePath) {
		return null;
	}

	if (!pathname.toLowerCase().startsWith(`${basePath.toLowerCase()}/`)) {
		return null;
	}

	if (pathname === basePath) {
		return null;
	}

	return basePath;
}
