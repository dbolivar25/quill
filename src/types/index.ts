export interface ModelConfig {
	provider: string
	model: string
}

export interface QuillConfig {
	models: {
		commit: ModelConfig
		changelog: ModelConfig
	}
}

export interface GitStatus {
	staged: string[]
	unstaged: string[]
	untracked: string[]
	isClean: boolean
}

export interface GitCommit {
	hash: string
	shortHash: string
	message: string
	author: string
	date: string
}

export interface GitTag {
	name: string
	hash: string
}

export interface ChangelogHistoryEntry {
	timestamp: string
	fromRef: string
	toRef: string
	toCommitHash: string
	commitsIncluded: number
}

export interface ChangelogHistory {
	entries: ChangelogHistoryEntry[]
}

export interface VersionChange {
	oldVersion: string | null
	newVersion: string | null
	changed: boolean
}

export interface CommitOptions {
	all?: boolean
	yes?: boolean
}

export interface ChangelogOptions {
	from?: string
	to?: string
}

export interface ReleaseOptions {
	from?: string
	version?: string
	tag?: boolean
	push?: boolean
	yes?: boolean
}

export interface ConfigOptions {
	commitModel?: string
	changelogModel?: string
	listModels?: boolean
}

export class QuillError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "QuillError"
	}
}

export const DEFAULT_CONFIG: QuillConfig = {
	models: {
		commit: {
			provider: "openai",
			model: "gpt-5.1-codex-mini",
		},
		changelog: {
			provider: "openai",
			model: "gpt-5.1-codex-mini",
		},
	},
}

export const MAX_HISTORY_ENTRIES = 50

export const CONFIG_DIR = ".quill"

export const CONFIG_FILES = {
	config: "config.json",
	commitPrompt: "commit.md",
	changelogPrompt: "changelog.md",
	history: "changelog.history.json",
} as const
