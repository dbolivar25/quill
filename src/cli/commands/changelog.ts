import {
	confirm,
	displayChangelog,
	info,
	intro,
	outro,
	select,
	success,
	warn,
	withSpinner,
} from "../../prompts/interactive"
import { generateChangelog, mergeChangelog } from "../../services/ai"
import {
	addHistoryEntry,
	changelogExists,
	getLastChangelogRef,
	readChangelog,
	writeChangelog,
} from "../../services/config"
import {
	detectVersionChange,
	ensureGitRepo,
	getCommitsBetween,
	getFirstCommit,
	getLatestTag,
	getRecentCommits,
	getTags,
	resolveRef,
} from "../../services/git"
import type { ChangelogOptions } from "../../types"
import { copyToClipboard } from "../../utils/clipboard"

export async function changelogCommand(
	options: ChangelogOptions,
): Promise<void> {
	intro()

	await ensureGitRepo()

	let fromRef = options.from
	const toRef = options.to || "HEAD"

	if (!fromRef) {
		fromRef = await selectFromRef()
		if (!fromRef) {
			warn("No starting reference selected.")
			return
		}
	}

	info(`Generating changelog from ${fromRef} to ${toRef}`)

	const commits = await getCommitsBetween(fromRef, toRef)

	if (commits.length === 0) {
		warn("No commits found in the specified range.")
		return
	}

	info(`Found ${commits.length} commits`)

	const versionChange = await detectVersionChange(fromRef, toRef)
	const version = versionChange.changed ? versionChange.newVersion : null

	const changelog = await withSpinner(
		"Generating changelog...",
		() =>
			generateChangelog(
				commits.map((c) => ({
					shortHash: c.shortHash,
					message: c.message,
				})),
				version,
				fromRef!,
				toRef,
			),
		"Generated changelog",
	)

	displayChangelog(changelog)

	let done = false

	while (!done) {
		const action = await select("What would you like to do?", [
			{ value: "save", label: "Save to CHANGELOG.md" },
			{ value: "copy", label: "Copy to clipboard" },
			{ value: "done", label: "Done" },
		])

		switch (action) {
			case "save":
				await saveChangelog(changelog)
				await recordHistory(fromRef!, toRef, commits.length)
				done = true
				break

			case "copy": {
				const copied = await copyToClipboard(changelog)
				if (copied) {
					success("Copied to clipboard!")
				} else {
					warn("Failed to copy to clipboard.")
				}
				break
			}

			case "done":
				done = true
				break
		}
	}

	outro("Done!")
}

async function selectFromRef(): Promise<string | undefined> {
	const lastRef = getLastChangelogRef()
	const tags = await getTags()
	const recentCommits = await getRecentCommits(20)

	const options: Array<{
		value: string
		label: string
		hint?: string
	}> = []

	if (lastRef) {
		options.push({
			value: `commit:${lastRef}`,
			label: "Since last changelog",
			hint: lastRef.slice(0, 7),
		})
	}

	for (const tag of tags.slice(0, 10)) {
		options.push({
			value: `tag:${tag.name}`,
			label: `Tag: ${tag.name}`,
		})
	}

	for (const commit of recentCommits.slice(0, 10)) {
		options.push({
			value: `commit:${commit.hash}`,
			label: `${commit.shortHash}: ${commit.message.slice(0, 50)}`,
		})
	}

	if (options.length === 0) {
		const first = await getFirstCommit()
		if (first) {
			return first
		}
		return undefined
	}

	const selected = await select("Select starting reference:", options)

	const [type, ref] = selected.split(":")
	if (type === "tag") {
		return ref
	}
	return ref
}

async function saveChangelog(newContent: string): Promise<void> {
	const existing = readChangelog()

	if (existing) {
		const shouldMerge = await confirm("CHANGELOG.md exists. Merge new content?")

		if (shouldMerge) {
			const merged = await withSpinner(
				"Merging changelog...",
				() => mergeChangelog(existing, newContent),
				"Merged changelog",
			)
			writeChangelog(merged)
			success("Saved to CHANGELOG.md (merged)")
		} else {
			const overwrite = await confirm("Overwrite existing file?", false)
			if (overwrite) {
				writeChangelog(newContent)
				success("Saved to CHANGELOG.md (overwritten)")
			} else {
				warn("Changelog not saved.")
			}
		}
	} else {
		writeChangelog(newContent)
		success("Saved to CHANGELOG.md")
	}
}

async function recordHistory(
	fromRef: string,
	toRef: string,
	count: number,
): Promise<void> {
	const toHash = await resolveRef(toRef)

	addHistoryEntry({
		timestamp: new Date().toISOString(),
		fromRef,
		toRef,
		toCommitHash: toHash,
		commitsIncluded: count,
	})
}

export async function generateAndSaveChangelog(
	fromRef: string,
	toRef: string,
	version: string | null,
): Promise<string> {
	const commits = await getCommitsBetween(fromRef, toRef)

	if (commits.length === 0) {
		return ""
	}

	const changelog = await generateChangelog(
		commits.map((c) => ({ shortHash: c.shortHash, message: c.message })),
		version,
		fromRef,
		toRef,
	)

	const existing = readChangelog()

	if (existing) {
		const merged = await mergeChangelog(existing, changelog)
		writeChangelog(merged)
	} else {
		writeChangelog(changelog)
	}

	const toHash = await resolveRef(toRef)
	addHistoryEntry({
		timestamp: new Date().toISOString(),
		fromRef,
		toRef,
		toCommitHash: toHash,
		commitsIncluded: commits.length,
	})

	return changelog
}
