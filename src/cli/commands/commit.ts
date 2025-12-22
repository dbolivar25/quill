import {
	confirm,
	displayCommitMessage,
	info,
	intro,
	outro,
	select,
	success,
	text,
	warn,
	withSpinner,
} from "../../prompts/interactive"
import { generateCommitMessage } from "../../services/ai"
import {
	ensureGitRepo,
	getStagedDiff,
	getStatus,
	commit as gitCommit,
	stageAll,
} from "../../services/git"
import type { CommitOptions } from "../../types"

export async function commitCommand(
	message: string | undefined,
	options: CommitOptions,
): Promise<void> {
	intro()

	await ensureGitRepo()

	let status = await getStatus()

	if (options.all) {
		await stageAll()
		status = await getStatus()
	}

	if (status.staged.length === 0) {
		const hasUnstaged =
			status.unstaged.length > 0 || status.untracked.length > 0

		if (hasUnstaged) {
			const shouldStage = options.yes
				? true
				: await confirm("No staged changes. Stage all changes?")

			if (shouldStage) {
				await stageAll()
				status = await getStatus()
			} else {
				warn("Nothing to commit.")
				return
			}
		} else {
			info("Nothing to commit, working tree clean.")
			return
		}
	}

	info(`Staged files: ${status.staged.length}`)

	let commitMessage: string

	if (message) {
		commitMessage = message
	} else {
		const diff = await getStagedDiff()

		if (!diff.trim()) {
			warn("No diff content found for staged files.")
			return
		}

		commitMessage = await withSpinner(
			"Generating commit message...",
			() => generateCommitMessage(diff),
			"Generated commit message",
		)
	}

	displayCommitMessage(commitMessage)

	if (options.yes) {
		await gitCommit(commitMessage)
		success(`Committed: ${commitMessage.split("\n")[0]}`)
		outro("Done!")
		return
	}

	let finalMessage = commitMessage
	let done = false

	while (!done) {
		const action = await select("What would you like to do?", [
			{ value: "commit", label: "Commit with this message" },
			{ value: "edit", label: "Edit message" },
			{ value: "regenerate", label: "Regenerate message" },
			{ value: "cancel", label: "Cancel" },
		])

		switch (action) {
			case "commit":
				await gitCommit(finalMessage)
				success(`Committed: ${finalMessage.split("\n")[0]}`)
				done = true
				break

			case "edit":
				finalMessage = await text(
					"Edit commit message:",
					undefined,
					finalMessage,
				)
				displayCommitMessage(finalMessage)
				break

			case "regenerate": {
				const diff = await getStagedDiff()
				finalMessage = await withSpinner(
					"Regenerating commit message...",
					() => generateCommitMessage(diff),
					"Regenerated commit message",
				)
				displayCommitMessage(finalMessage)
				break
			}

			case "cancel":
				warn("Commit cancelled.")
				done = true
				break
		}
	}

	outro("Done!")
}
