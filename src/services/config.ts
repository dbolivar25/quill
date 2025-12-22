import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
	CONFIG_DIR,
	CONFIG_FILES,
	type ChangelogHistory,
	type ChangelogHistoryEntry,
	DEFAULT_CONFIG,
	MAX_HISTORY_ENTRIES,
	type QuillConfig,
} from "../types"

const DEFAULT_COMMIT_PROMPT = `# Commit Message Guidelines

Generate commit messages following the Conventional Commits specification.

## Format
<type>: <description>
[optional body]

## Types
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools

## Rules
1. Use lowercase for the type
2. No scope (use "feat:" not "feat(api):")
3. Use imperative mood ("add" not "added")
4. Keep the first line under 72 characters
5. Do not end the description with a period
6. Only return the commit message, no explanations
`

const DEFAULT_CHANGELOG_PROMPT = `# Changelog Generation Guidelines

Use the "Keep a Changelog" format (https://keepachangelog.com/).

## Structure
## [Version] - YYYY-MM-DD

### Added, Changed, Deprecated, Removed, Fixed, Security

## Rules
1. Group commits by type (feat -> Added, fix -> Fixed, etc.)
2. Write in past tense
3. Include commit hash in parentheses
4. Skip empty sections
5. Only return changelog content, no explanations
`

function getConfigDir(): string {
	return join(process.cwd(), CONFIG_DIR)
}

function getConfigPath(file: keyof typeof CONFIG_FILES): string {
	return join(getConfigDir(), CONFIG_FILES[file])
}

export function ensureConfigDir(): void {
	const configDir = getConfigDir()
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true })
	}
}

export function configExists(): boolean {
	return existsSync(getConfigPath("config"))
}

export function getConfig(): QuillConfig {
	ensureConfigDir()
	const configPath = getConfigPath("config")

	if (!existsSync(configPath)) {
		saveConfig(DEFAULT_CONFIG)
		return DEFAULT_CONFIG
	}

	try {
		const content = readFileSync(configPath, "utf-8")
		const config = JSON.parse(content) as QuillConfig
		return { ...DEFAULT_CONFIG, ...config }
	} catch {
		return DEFAULT_CONFIG
	}
}

export function saveConfig(config: QuillConfig): void {
	ensureConfigDir()
	const configPath = getConfigPath("config")
	writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export function getCommitPrompt(): string {
	ensureConfigDir()
	const promptPath = getConfigPath("commitPrompt")

	if (!existsSync(promptPath)) {
		writeFileSync(promptPath, DEFAULT_COMMIT_PROMPT)
		return DEFAULT_COMMIT_PROMPT
	}

	return readFileSync(promptPath, "utf-8")
}

export function getChangelogPrompt(): string {
	ensureConfigDir()
	const promptPath = getConfigPath("changelogPrompt")

	if (!existsSync(promptPath)) {
		writeFileSync(promptPath, DEFAULT_CHANGELOG_PROMPT)
		return DEFAULT_CHANGELOG_PROMPT
	}

	return readFileSync(promptPath, "utf-8")
}

export function getHistory(): ChangelogHistory {
	ensureConfigDir()
	const historyPath = getConfigPath("history")

	if (!existsSync(historyPath)) {
		return { entries: [] }
	}

	try {
		const content = readFileSync(historyPath, "utf-8")
		return JSON.parse(content) as ChangelogHistory
	} catch {
		return { entries: [] }
	}
}

export function addHistoryEntry(entry: ChangelogHistoryEntry): void {
	ensureConfigDir()
	const history = getHistory()

	history.entries.unshift(entry)

	if (history.entries.length > MAX_HISTORY_ENTRIES) {
		history.entries = history.entries.slice(0, MAX_HISTORY_ENTRIES)
	}

	const historyPath = getConfigPath("history")
	writeFileSync(historyPath, JSON.stringify(history, null, 2))
}

export function getLastChangelogRef(): string | null {
	const history = getHistory()
	if (history.entries.length === 0) {
		return null
	}
	return history.entries[0].toCommitHash
}

export function getChangelogPath(): string {
	return join(process.cwd(), "CHANGELOG.md")
}

export function changelogExists(): boolean {
	return existsSync(getChangelogPath())
}

export function readChangelog(): string | null {
	const path = getChangelogPath()
	if (!existsSync(path)) {
		return null
	}
	return readFileSync(path, "utf-8")
}

export function writeChangelog(content: string): void {
	writeFileSync(getChangelogPath(), content)
}
