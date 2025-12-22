#!/usr/bin/env node
import { createProgram } from "./cli/program"
import { displayError } from "./prompts/interactive"
import { registerCleanup } from "./services/ai"
import { QuillError } from "./types"

registerCleanup()

const program = createProgram()

async function main() {
	try {
		await program.parseAsync(process.argv)
	} catch (err) {
		displayError(err)
		process.exit(1)
	}
}

main()
