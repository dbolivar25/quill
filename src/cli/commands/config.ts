import {
	error,
	info,
	intro,
	message,
	outro,
	success,
	warn,
	withSpinner,
} from "../../prompts/interactive"
import { listProviders } from "../../services/ai"
import { getConfig, saveConfig } from "../../services/config"
import type { ConfigOptions } from "../../types"

export async function configCommand(options: ConfigOptions): Promise<void> {
	intro()

	if (options.listModels) {
		await showAvailableModels()
		outro("Done!")
		return
	}

	if (options.commitModel || options.changelogModel) {
		await updateModels(options)
		outro("Done!")
		return
	}

	showCurrentConfig()
	outro("Done!")
}

function showCurrentConfig(): void {
	const config = getConfig()

	info("Current configuration:")
	console.log()
	console.log(
		`  Commit model:    ${config.models.commit.provider}/${config.models.commit.model}`,
	)
	console.log(
		`  Changelog model: ${config.models.changelog.provider}/${config.models.changelog.model}`,
	)
	console.log()
	message("Use --commit-model or --changelog-model to change settings.")
	message("Use --list-models to see available providers and models.")
}

async function showAvailableModels(): Promise<void> {
	const providers = await withSpinner(
		"Fetching available providers...",
		() => listProviders(),
		"Fetched providers",
	)

	if (providers.length === 0) {
		warn("No providers available. Make sure OpenCode is configured.")
		return
	}

	info("Available providers and models:")
	console.log()

	for (const provider of providers) {
		console.log(`  ${provider.name} (${provider.id}):`)
		if (provider.models.length === 0) {
			console.log("    No models available")
		} else {
			for (const model of provider.models.slice(0, 10)) {
				console.log(`    - ${provider.id}/${model}`)
			}
			if (provider.models.length > 10) {
				console.log(`    ... and ${provider.models.length - 10} more`)
			}
		}
		console.log()
	}
}

function parseModelString(
	modelString: string,
): { provider: string; model: string } | null {
	const parts = modelString.split("/")

	if (parts.length < 2) {
		return null
	}

	const provider = parts[0]
	const model = parts.slice(1).join("/")

	return { provider, model }
}

async function updateModels(options: ConfigOptions): Promise<void> {
	const config = getConfig()

	if (options.commitModel) {
		const parsed = parseModelString(options.commitModel)

		if (!parsed) {
			error(`Invalid model format: "${options.commitModel}"`)
			info(
				"Expected format: provider/model (e.g., anthropic/claude-sonnet-4-5)",
			)
			return
		}

		config.models.commit = parsed
		success(`Commit model set to: ${parsed.provider}/${parsed.model}`)
	}

	if (options.changelogModel) {
		const parsed = parseModelString(options.changelogModel)

		if (!parsed) {
			error(`Invalid model format: "${options.changelogModel}"`)
			info(
				"Expected format: provider/model (e.g., anthropic/claude-sonnet-4-5)",
			)
			return
		}

		config.models.changelog = parsed
		success(`Changelog model set to: ${parsed.provider}/${parsed.model}`)
	}

	saveConfig(config)
	info("Configuration saved to .quill/config.json")
}
