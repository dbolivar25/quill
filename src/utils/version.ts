import { getTags } from "../services/git"

export function formatVersion(version: string): string {
	if (version.startsWith("v")) {
		return version
	}
	return `v${version}`
}

export function stripVersionPrefix(version: string): string {
	if (version.startsWith("v")) {
		return version.slice(1)
	}
	return version
}

export async function detectTagPrefix(): Promise<"v" | ""> {
	const tags = await getTags()

	if (tags.length === 0) {
		return "v"
	}

	const withV = tags.filter((t) => t.name.startsWith("v")).length
	const withoutV = tags.filter((t) => !t.name.startsWith("v")).length

	return withV >= withoutV ? "v" : ""
}

export function isValidVersion(version: string): boolean {
	const stripped = stripVersionPrefix(version)
	const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/
	return semverPattern.test(stripped)
}
