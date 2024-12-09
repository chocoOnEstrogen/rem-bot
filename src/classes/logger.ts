import chalk from 'chalk'

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose'

export default class Logger {
	private static readonly colors: Record<LogLevel, (text: string) => string> = {
		info: chalk.blue,
		warn: chalk.yellow,
		error: chalk.red,
		debug: chalk.green,
		verbose: chalk.gray,
	}

	private static readonly isDebugMode = process.argv.includes('/debug')

	private static getCallerInfo(): string {
		const error = new Error()
		const stack = error.stack?.split('\n')[3]
		if (!stack) return 'unknown'

		const match = stack.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))/)
		if (!match) return 'unknown'

		const [, fnName, filePath] = match
		const fileName = filePath?.split(/[/\\]/).pop() || 'unknown'
		return fnName ?
				`${fileName.replace('.ts', '').replace('.js', '')}::${fnName}`
			:	fileName.replace('.ts', '').replace('.js', '')
	}

	public static log(level: LogLevel, message: string, context?: string): void {
		if (level === 'debug' && !this.isDebugMode) return

		const color = Logger.colors[level]
		const caller = context || this.getCallerInfo()
		console.log(`[${color(level.toUpperCase())}] [${caller}]: ${message}`)
	}
}
