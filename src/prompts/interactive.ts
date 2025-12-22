import * as p from "@clack/prompts"
import pc from "picocolors"
import { QuillError } from "../types"

export function intro(): void {
	p.intro(pc.bgCyan(pc.black(" quill ")))
}

export function outro(message: string): void {
	p.outro(pc.green(message))
}

export function success(message: string): void {
	p.log.success(message)
}

export function warn(message: string): void {
	p.log.warn(message)
}

export function error(message: string): void {
	p.log.error(message)
}

export function info(message: string): void {
	p.log.info(message)
}

export function step(message: string): void {
	p.log.step(message)
}

export function message(text: string): void {
	p.log.message(text)
}

function handleCancel<T>(result: T | symbol): T {
	if (p.isCancel(result)) {
		p.cancel("Operation cancelled.")
		process.exit(0)
	}
	return result
}

export async function confirm(msg: string, initial = true): Promise<boolean> {
	const result = await p.confirm({
		message: msg,
		initialValue: initial,
	})
	return handleCancel(result)
}

export async function select<T extends string>(
	msg: string,
	options: Array<{ value: T; label: string; hint?: string }>,
): Promise<T> {
	const result = await p.select({
		message: msg,
		options: options as Parameters<typeof p.select>[0]["options"],
	})
	return handleCancel(result) as T
}

export async function text(
	msg: string,
	placeholder?: string,
	initialValue?: string,
): Promise<string> {
	const result = await p.text({
		message: msg,
		placeholder,
		initialValue,
	})
	return handleCancel(result)
}

export async function multiselect<T extends string>(
	msg: string,
	options: Array<{ value: T; label: string; hint?: string }>,
	required = false,
): Promise<T[]> {
	const result = await p.multiselect({
		message: msg,
		options: options as Parameters<typeof p.multiselect>[0]["options"],
		required,
	})
	return handleCancel(result) as T[]
}

export function createSpinner(): {
	start: (msg: string) => void
	stop: (msg?: string) => void
	message: (msg: string) => void
} {
	const spinner = p.spinner()
	return {
		start: (msg: string) => spinner.start(msg),
		stop: (msg?: string) => spinner.stop(msg),
		message: (msg: string) => spinner.message(msg),
	}
}

export async function withSpinner<T>(
	msg: string,
	fn: () => Promise<T>,
	successMsg?: string,
): Promise<T> {
	const spinner = p.spinner()
	spinner.start(msg)

	try {
		const result = await fn()
		spinner.stop(successMsg || msg)
		return result
	} catch (err) {
		spinner.stop(pc.red("Failed"))
		throw err
	}
}

export function displayError(err: unknown): void {
	if (err instanceof QuillError) {
		error(err.message)
	} else if (err instanceof Error) {
		error(err.message)
	} else {
		error(String(err))
	}
}

export function displayCommitMessage(msg: string): void {
	console.log()
	console.log(pc.dim("─".repeat(50)))
	console.log(pc.cyan(msg))
	console.log(pc.dim("─".repeat(50)))
	console.log()
}

export function displayChangelog(content: string): void {
	console.log()
	console.log(pc.dim("─".repeat(50)))
	console.log(content)
	console.log(pc.dim("─".repeat(50)))
	console.log()
}
