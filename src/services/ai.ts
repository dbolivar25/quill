import {
	type OpencodeClient,
	createOpencode,
	createOpencodeClient,
} from "@opencode-ai/sdk"
import type { ModelConfig } from "../types"
import { QuillError } from "../types"
import { getChangelogPrompt, getCommitPrompt, getConfig } from "./config"

let client: OpencodeClient | null = null
let serverCleanup: (() => void) | null = null

async function getClient(): Promise<OpencodeClient> {
	if (client) {
		return client
	}

	try {
		const existingClient = createOpencodeClient({
			baseUrl: "http://localhost:4096",
		})
		await existingClient.config.get()
		client = existingClient
		return client
	} catch {
		try {
			const { client: newClient, server } = await createOpencode({
				timeout: 15000,
			})
			client = newClient
			serverCleanup = () => server.close()
			return client
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error"
			throw new QuillError(
				`Failed to connect to OpenCode server.\n\nMake sure OpenCode is installed and running:\n  1. Install: npm install -g opencode\n  2. Run: opencode serve\n\nError: ${message}`,
			)
		}
	}
}

export function registerCleanup(): void {
	const cleanup = () => {
		if (serverCleanup) {
			serverCleanup()
			serverCleanup = null
		}
	}

	process.on("exit", cleanup)
	process.on("SIGINT", () => {
		cleanup()
		process.exit(0)
	})
	process.on("SIGTERM", () => {
		cleanup()
		process.exit(0)
	})
}

function cleanupResponse(text: string): string {
	return text
		.replace(/^```[\w]*\n?/, "")
		.replace(/\n?```$/, "")
		.trim()
}

async function prompt(text: string, modelConfig: ModelConfig): Promise<string> {
	const sdk = await getClient()

	const sessionResult = await sdk.session.create()
	if (sessionResult.error) {
		throw new QuillError(`Failed to create session: ${sessionResult.error}`)
	}

	const sessionId = sessionResult.data.id

	try {
		const response = await sdk.session.prompt({
			path: { id: sessionId },
			body: {
				model: {
					providerID: modelConfig.provider,
					modelID: modelConfig.model,
				},
				parts: [{ type: "text", text }],
			},
		})

		if (response.error) {
			throw new QuillError(`Prompt failed: ${response.error}`)
		}

		const parts = response.data?.parts || []
		let result = ""
		for (const part of parts) {
			if ("type" in part && part.type === "text" && "text" in part) {
				result += (part as { text: string }).text
			}
		}

		return cleanupResponse(result)
	} finally {
		await sdk.session.delete({ path: { id: sessionId } }).catch(() => {})
	}
}

export async function generateCommitMessage(diff: string): Promise<string> {
	const config = getConfig()
	const promptTemplate = getCommitPrompt()

	const fullPrompt = `${promptTemplate}

---

Generate a commit message for the following diff:

\`\`\`diff
${diff}
\`\`\``

	try {
		return await prompt(fullPrompt, config.models.commit)
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		throw new QuillError(
			`AI generation failed: ${message}\n\nTry again or provide a manual commit message:\n  quill commit "your message here"`,
		)
	}
}

export async function generateChangelog(
	commits: Array<{ shortHash: string; message: string }>,
	version: string | null,
	fromRef: string,
	toRef: string,
): Promise<string> {
	const config = getConfig()
	const promptTemplate = getChangelogPrompt()

	const commitList = commits
		.map((c) => `- ${c.shortHash}: ${c.message}`)
		.join("\n")

	const versionInstruction = version
		? `Use version "${version}" for this changelog entry.`
		: `Use "[Unreleased]" as the version header.`

	const fullPrompt = `${promptTemplate}

---

Generate a changelog for the following commits (from ${fromRef} to ${toRef}):

IMPORTANT: ${versionInstruction}

${commitList}`

	try {
		return await prompt(fullPrompt, config.models.changelog)
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		throw new QuillError(`AI changelog generation failed: ${message}`)
	}
}

export async function mergeChangelog(
	existing: string,
	newEntry: string,
): Promise<string> {
	const config = getConfig()

	const fullPrompt = `Merge the following new changelog entry into the existing CHANGELOG.md.

Rules:
1. Preserve the existing structure and header
2. Add the new entry in the correct chronological position (newest at top, after header)
3. Avoid duplicate entries
4. If the new entry is "[Unreleased]", replace any existing "[Unreleased]" section
5. Return only the merged changelog content, no explanations

Existing CHANGELOG.md:
\`\`\`markdown
${existing}
\`\`\`

New entry to add:
\`\`\`markdown
${newEntry}
\`\`\``

	try {
		return await prompt(fullPrompt, config.models.changelog)
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		throw new QuillError(`AI changelog merge failed: ${message}`)
	}
}

export async function listProviders(): Promise<
	Array<{ id: string; name: string; models: string[] }>
> {
	const sdk = await getClient()
	const result = await sdk.config.providers()

	if (result.error || !result.data) {
		return []
	}

	return Object.entries(result.data).map(([id, provider]) => ({
		id,
		name: (provider as { name?: string }).name || id,
		models: Object.keys((provider as { models?: object }).models || {}),
	}))
}
