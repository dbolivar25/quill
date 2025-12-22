import { Command } from "commander"
import { changelogCommand } from "./commands/changelog"
import { commitCommand } from "./commands/commit"
import { configCommand } from "./commands/config"
import { releaseCommand } from "./commands/release"

export function createProgram(): Command {
	const program = new Command()

	program
		.name("quill")
		.description("AI-powered git commit messages, changelogs, and releases")
		.version("0.1.0")

	program
		.argument("[message]", "Commit message (skips AI generation)")
		.option("-a, --all", "Stage all changes before committing")
		.option("-y, --yes", "Skip confirmation prompts")
		.action(async (message: string | undefined, options) => {
			await commitCommand(message, options)
		})

	program
		.command("commit")
		.description("Generate AI commit message and commit changes")
		.argument("[message]", "Commit message (skips AI generation)")
		.option("-a, --all", "Stage all changes before committing")
		.option("-y, --yes", "Skip confirmation prompts")
		.action(async (message: string | undefined, options) => {
			await commitCommand(message, options)
		})

	program
		.command("changelog")
		.alias("cl")
		.description("Generate changelog from commit history")
		.option("-f, --from <ref>", "Starting commit or tag reference")
		.option("-t, --to <ref>", "Ending reference (default: HEAD)")
		.action(async (options) => {
			await changelogCommand(options)
		})

	program
		.command("release")
		.description("Full release workflow: commit, changelog, tag, push")
		.option("-f, --from <ref>", "Starting reference for changelog")
		.option("-v, --version <version>", "Explicit version number")
		.option("-t, --tag", "Auto-create tag without prompting")
		.option("-p, --push", "Auto-push without prompting")
		.option("-y, --yes", "Skip all confirmation prompts")
		.action(async (options) => {
			await releaseCommand(options)
		})

	program
		.command("config")
		.description("View or modify Quill configuration")
		.option(
			"--commit-model <model>",
			"Set commit model (e.g., anthropic/claude-sonnet-4-5)",
		)
		.option("--changelog-model <model>", "Set changelog model")
		.option("--list-models", "List available providers and models")
		.action(async (options) => {
			await configCommand(options)
		})

	return program
}
