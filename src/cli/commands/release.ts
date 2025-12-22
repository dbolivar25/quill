import {
	confirm,
	displayCommitMessage,
	error,
	info,
	intro,
	outro,
	step,
	success,
	text,
	warn,
	withSpinner,
} from "../../prompts/interactive"
import { generateCommitMessage } from "../../services/ai"
import {
	createTag,
	detectVersionChange,
	ensureGitRepo,
	getFirstCommit,
	getLatestTag,
	getStagedDiff,
	getStatus,
	commit as gitCommit,
	hasRemote,
	push,
	stageAll,
} from "../../services/git"
import type { ReleaseOptions } from "../../types"
import {
	detectTagPrefix,
	formatVersion,
	isValidVersion,
} from "../../utils/version"
import { generateAndSaveChangelog } from "./changelog"

export async function releaseCommand(options: ReleaseOptions): Promise<void> {
	intro()

	await ensureGitRepo()

	step("Step 1: Commit pending changes")
	await handleCommit(options)

	step("Step 2: Generate changelog")
	const { fromRef, version } = await handleChangelog(options)

	step("Step 3: Create release tag")
	await handleTag(version, options)

	step("Step 4: Push to remote")
	await handlePush(options)

	outro(`Released ${version}!`)
}

async function handleCommit(options: ReleaseOptions): Promise<void> {
	let status = await getStatus()

	if (status.isClean) {
		info("Working tree clean, skipping commit step.")
		return
	}

	const hasUnstaged = status.unstaged.length > 0 || status.untracked.length > 0
	const hasStaged = status.staged.length > 0

	if (hasUnstaged && !hasStaged) {
		const shouldStage = options.yes ? true : await confirm("Stage all changes?")

		if (shouldStage) {
			await stageAll()
			status = await getStatus()
		} else {
			warn("Skipping commit (no staged changes).")
			return
		}
	} else if (hasUnstaged && hasStaged) {
		const stageRest = options.yes
			? true
			: await confirm("Stage remaining unstaged changes?")

		if (stageRest) {
			await stageAll()
			status = await getStatus()
		}
	}

	if (status.staged.length === 0) {
		info("Nothing to commit.")
		return
	}

	const diff = await getStagedDiff()

	const commitMessage = await withSpinner(
		"Generating commit message...",
		() => generateCommitMessage(diff),
		"Generated commit message",
	)

	displayCommitMessage(commitMessage)

	const shouldCommit = options.yes
		? true
		: await confirm("Commit with this message?")

	if (shouldCommit) {
		await gitCommit(commitMessage)
		success("Changes committed.")
	} else {
		warn("Commit skipped.")
	}
}

async function handleChangelog(
	options: ReleaseOptions,
): Promise<{ fromRef: string; version: string }> {
	let fromRef = options.from

	if (!fromRef) {
		const latestTag = await getLatestTag()
		if (latestTag) {
			fromRef = latestTag.name
			info(`Using latest tag as starting point: ${fromRef}`)
		} else {
			const first = await getFirstCommit()
			if (first) {
				fromRef = first
				info("No tags found, using first commit.")
			} else {
				throw new Error("Could not determine starting reference.")
			}
		}
	}

	const toRef = "HEAD"

	let version = options.version

	if (!version) {
		const versionChange = await detectVersionChange(fromRef, toRef)

		if (versionChange.changed && versionChange.newVersion) {
			version = versionChange.newVersion
			info(`Detected version from package.json: ${version}`)
		} else {
			version = await text("Enter version for this release:", "1.0.0")

			if (!isValidVersion(version)) {
				warn(`"${version}" doesn't look like a valid semver version.`)
				const proceed = await confirm("Continue anyway?", false)
				if (!proceed) {
					throw new Error("Release cancelled.")
				}
			}
		}
	}

	info(`Generating changelog for version ${version}`)

	const changelog = await withSpinner(
		"Generating and saving changelog...",
		() => generateAndSaveChangelog(fromRef!, toRef, version!),
		"Changelog saved to CHANGELOG.md",
	)

	if (changelog) {
		await stageAll()

		const releaseMessage = `chore(release): v${version.replace(/^v/, "")}`
		await gitCommit(releaseMessage)
		success(`Committed changelog: ${releaseMessage}`)
	}

	return { fromRef: fromRef!, version: version! }
}

async function handleTag(
	version: string,
	options: ReleaseOptions,
): Promise<void> {
	const prefix = await detectTagPrefix()
	const tagName = prefix + version.replace(/^v/, "")

	const shouldTag =
		options.tag || options.yes
			? true
			: await confirm(`Create tag "${tagName}"?`)

	if (shouldTag) {
		await createTag(tagName)
		success(`Created tag: ${tagName}`)
	} else {
		warn("Tag creation skipped.")
	}
}

async function handlePush(options: ReleaseOptions): Promise<void> {
	const hasOrigin = await hasRemote()

	if (!hasOrigin) {
		warn("No remote configured. Skipping push.")
		return
	}

	const shouldPush =
		options.push || options.yes
			? true
			: await confirm("Push to remote (with tags)?")

	if (shouldPush) {
		await withSpinner(
			"Pushing to remote...",
			() => push(true),
			"Pushed to remote",
		)
		success("Pushed commits and tags to remote.")
	} else {
		warn("Push skipped.")
	}
}
