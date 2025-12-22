import simpleGit, { type SimpleGit } from "simple-git"
import type { GitCommit, GitStatus, GitTag, VersionChange } from "../types"
import { QuillError } from "../types"

let gitInstance: SimpleGit | null = null

function getGit(): SimpleGit {
	if (!gitInstance) {
		gitInstance = simpleGit()
	}
	return gitInstance
}

export async function isGitRepo(): Promise<boolean> {
	try {
		const result = await getGit().checkIsRepo()
		return result
	} catch {
		return false
	}
}

export async function ensureGitRepo(): Promise<void> {
	const isRepo = await isGitRepo()
	if (!isRepo) {
		throw new QuillError(
			"Not a git repository.\nPlease run this command from within a git repository.",
		)
	}
}

export async function getStatus(): Promise<GitStatus> {
	const git = getGit()
	const status = await git.status()

	return {
		staged: status.staged,
		unstaged: status.modified.filter((f) => !status.staged.includes(f)),
		untracked: status.not_added,
		isClean: status.isClean(),
	}
}

export async function getStagedDiff(): Promise<string> {
	const git = getGit()
	const diff = await git.diff(["--cached"])
	return diff
}

export async function stageAll(): Promise<void> {
	const git = getGit()
	await git.add("-A")
}

export async function commit(message: string): Promise<void> {
	const git = getGit()
	await git.commit(message)
}

export async function getRecentCommits(count = 20): Promise<GitCommit[]> {
	const git = getGit()
	const log = await git.log(["-n", `${count}`])

	return log.all.map((entry) => ({
		hash: entry.hash,
		shortHash: entry.hash.slice(0, 7),
		message: entry.message,
		author: entry.author_name,
		date: entry.date,
	}))
}

export async function getCommitsBetween(
	from: string,
	to: string,
): Promise<GitCommit[]> {
	const git = getGit()
	const log = await git.log([`${from}..${to}`])

	return log.all.map((entry) => ({
		hash: entry.hash,
		shortHash: entry.hash.slice(0, 7),
		message: entry.message,
		author: entry.author_name,
		date: entry.date,
	}))
}

export async function getTags(): Promise<GitTag[]> {
	const git = getGit()
	const tags = await git.tags(["--sort=-creatordate"])

	const result: GitTag[] = []
	for (const name of tags.all) {
		try {
			const hash = await git.revparse([name])
			result.push({ name, hash: hash.trim() })
		} catch {
			result.push({ name, hash: "" })
		}
	}

	return result
}

export async function getLatestTag(): Promise<GitTag | null> {
	const tags = await getTags()
	return tags.length > 0 ? tags[0] : null
}

export async function resolveRef(ref: string): Promise<string> {
	const git = getGit()
	const hash = await git.revparse([ref])
	return hash.trim()
}

export async function getFileAtRef(
	ref: string,
	filePath: string,
): Promise<string | null> {
	const git = getGit()
	try {
		const content = await git.show([`${ref}:${filePath}`])
		return content
	} catch {
		return null
	}
}

export async function detectVersionChange(
	fromRef: string,
	toRef: string,
): Promise<VersionChange> {
	const oldContent = await getFileAtRef(fromRef, "package.json")
	const newContent = await getFileAtRef(toRef, "package.json")

	let oldVersion: string | null = null
	let newVersion: string | null = null

	if (oldContent) {
		try {
			const pkg = JSON.parse(oldContent)
			oldVersion = pkg.version || null
		} catch {
			oldVersion = null
		}
	}

	if (newContent) {
		try {
			const pkg = JSON.parse(newContent)
			newVersion = pkg.version || null
		} catch {
			newVersion = null
		}
	}

	return {
		oldVersion,
		newVersion,
		changed: oldVersion !== newVersion && newVersion !== null,
	}
}

export async function createTag(tagName: string): Promise<void> {
	const git = getGit()
	await git.addTag(tagName)
}

export async function push(includeTags = false): Promise<void> {
	const git = getGit()
	if (includeTags) {
		await git.push(["origin", "HEAD", "--tags"])
	} else {
		await git.push(["origin", "HEAD"])
	}
}

export async function getFirstCommit(): Promise<string | null> {
	const git = getGit()
	try {
		const result = await git.raw(["rev-list", "--max-parents=0", "HEAD"])
		const hash = result.trim().split("\n")[0]
		return hash || null
	} catch {
		return null
	}
}

export async function hasRemote(): Promise<boolean> {
	const git = getGit()
	try {
		const remotes = await git.getRemotes()
		return remotes.length > 0
	} catch {
		return false
	}
}
