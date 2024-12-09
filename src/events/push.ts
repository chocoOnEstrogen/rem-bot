import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { format } from 'date-fns'
import { BlueskyService } from '../services/bluesky.js'
import * as fs from 'node:fs'

// Add interfaces for type safety
interface CommitAuthor {
	name: string
	email: string | null
	username?: string
	avatar_url?: string | null | undefined
}

interface CommitData {
	id: string
	message: string
	timestamp: string
	owner: string
	repository?: string
	author: CommitAuthor
	files: {
		filename: string
		status: string
		additions: number
		deletions: number
		patch?: string
	}[]
}

// Register system fonts
const systemFonts = GlobalFonts.families

// Helper function to find best available font
function getBestFont() {
	const preferredFonts = [
		'Noto Sans',
		'Source Code Pro', // For code blocks
		'FreeSans',
		'FreeMono',
	]

	for (const font of preferredFonts) {
		if (systemFonts.some((f) => f.family === font)) {
			return font
		}
	}
	return 'FreeSans' // Fallback
}

// Helper function for monospace font
function getMonospaceFont() {
	const monoFonts = ['Source Code Pro', 'FreeMono']

	for (const font of monoFonts) {
		if (systemFonts.some((f) => f.family === font)) {
			return font
		}
	}
	return 'FreeMono' // Fallback
}

// Helper function to truncate text with ellipsis
function truncateText(ctx: any, text: string, maxWidth: number) {
	let truncated = text
	while (ctx.measureText(truncated).width > maxWidth && truncated.length > 0) {
		truncated = truncated.slice(0, -1)
	}
	return truncated.length < text.length ? truncated + '...' : truncated
}

// Helper function to draw rounded rectangle with optional border
function drawRoundedRect(
	ctx: any,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
	fill: string,
	stroke?: string,
) {
	ctx.beginPath()
	ctx.roundRect(x, y, width, height, radius)
	ctx.fillStyle = fill
	ctx.fill()
	if (stroke) {
		ctx.strokeStyle = stroke
		ctx.lineWidth = 1
		ctx.stroke()
	}
}

// Helper function to create commit image
async function createCommit(commit: CommitData, files: any[]) {
	const canvas = createCanvas(1200, Math.max(800, 300 + files.length * 300))
	const ctx = canvas.getContext('2d')
	const mainFont = getBestFont()
	const codeFont = getMonospaceFont()

	// Load author avatar
	let avatarImage
	try {
		const avatarUrl =
			commit.author.avatar_url ||
			(commit.author.username ?
				`https://github.com/${commit.author.username}.png`
			:	null) ||
			'https://github.com/identicons/default.png'
		avatarImage = await loadImage(avatarUrl)
	} catch (error) {
		console.error('Error loading avatar:', error)
	}

	// Background
	ctx.fillStyle = '#0d1117'
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	// Header section
	drawRoundedRect(ctx, 20, 20, canvas.width - 40, 80, 10, '#161b22', '#30363d')

	ctx.fillStyle = '#8b949e'
	ctx.font = `bold 16px "${mainFont}"`
	const shortHash = commit.id.substring(0, 7)
	ctx.fillText(shortHash, 40, 55)

	const timestamp = format(new Date(commit.timestamp), 'MMM d, yyyy HH:mm:ss')
	ctx.fillStyle = '#8b949e'
	ctx.font = `14px "${mainFont}"`
	ctx.fillText(timestamp, canvas.width - 200, 55)

	let yOffset = 120

	// Message section
	drawRoundedRect(
		ctx,
		20,
		yOffset,
		canvas.width - 40,
		100,
		10,
		'#161b22',
		'#30363d',
	)

	ctx.fillStyle = '#7ee787'
	ctx.font = `bold 24px "${mainFont}"`
	ctx.fillText('MESSAGE', 40, yOffset + 35)

	ctx.fillStyle = '#e6edf3'
	ctx.font = `20px "${mainFont}"`
	const message = truncateText(
		ctx,
		commit.message.split('\n')[0],
		canvas.width - 100,
	)
	ctx.fillText(message, 40, yOffset + 70)

	yOffset += 120

	// Author section with avatar
	drawRoundedRect(
		ctx,
		20,
		yOffset,
		canvas.width - 40,
		80,
		10,
		'#161b22',
		'#30363d',
	)

	// Draw avatar if loaded
	if (avatarImage) {
		// Save context for clipping
		ctx.save()

		// Create circular clipping path
		ctx.beginPath()
		ctx.arc(60, yOffset + 40, 25, 0, Math.PI * 2)
		ctx.clip()

		// Draw avatar
		ctx.drawImage(avatarImage, 35, yOffset + 15, 50, 50)

		// Restore context
		ctx.restore()
	}

	ctx.fillStyle = '#58a6ff'
	ctx.font = `bold 20px "${mainFont}"`
	ctx.fillText('AUTHOR', 100, yOffset + 35)

	ctx.fillStyle = '#e6edf3'
	ctx.font = `18px "${mainFont}"`
	ctx.fillText(
		`${commit.author.name} (${commit.author.username || ''})`,
		100,
		yOffset + 60,
	)

	yOffset += 100

	// Files section
	for (const file of files) {
		const parsedPatch = parsePatch(file.patch || '')

		// File card with enhanced styling
		drawRoundedRect(
			ctx,
			20,
			yOffset,
			canvas.width - 40,
			260,
			10,
			'#161b22',
			'#30363d',
		)

		// File name (without icon)
		ctx.fillStyle = '#58a6ff'
		ctx.font = `bold 20px "${mainFont}"`
		ctx.fillText(file.filename, 40, yOffset + 30)

		// File stats
		const statsY = yOffset + 70

		// Stats badges with improved styling
		if (file.additions > 0) {
			drawRoundedRect(ctx, 40, statsY - 15, 80, 25, 12, '#238636')
			ctx.fillStyle = '#ffffff'
			ctx.font = `bold 16px "${mainFont}"`
			ctx.fillText(`+${file.additions}`, 55, statsY + 5)
		}

		if (file.deletions > 0) {
			drawRoundedRect(ctx, 130, statsY - 15, 80, 25, 12, '#da3633')
			ctx.fillStyle = '#ffffff'
			ctx.fillText(`-${file.deletions}`, 145, statsY + 5)
		}

		// Status badge
		const statusColor = getStatusColor(file.status)
		drawRoundedRect(ctx, 220, statsY - 15, 100, 25, 12, statusColor)
		ctx.fillStyle = '#ffffff'
		ctx.fillText(file.status, 235, statsY + 5)

		// Draw diff with enhanced styling
		if (parsedPatch.changes) {
			// Hunk header
			if (parsedPatch.hunk) {
				ctx.fillStyle = '#8b949e'
				ctx.font = `14px "${codeFont}"`
				ctx.fillText(parsedPatch.hunk, 40, statsY + 35)
			}

			// Changes with line numbers
			parsedPatch.changes.forEach((change, index) => {
				const lineY = statsY + 60 + index * 25

				// Line background
				const bgColor = getChangeBackgroundColor(change.type)
				drawRoundedRect(ctx, 40, lineY - 15, canvas.width - 80, 25, 5, bgColor)

				// Line number
				ctx.fillStyle = '#484f58'
				ctx.font = `14px "${codeFont}"`
				ctx.fillText(String(index + 1).padStart(3, ' '), 50, lineY + 5)

				// Line content
				ctx.fillStyle = getChangeTextColor(change.type)
				ctx.font = `16px "${codeFont}"`
				const prefix = getChangePrefix(change.type)
				const content = truncateText(ctx, change.content, canvas.width - 150)
				ctx.fillText(`${prefix} ${content}`, 90, lineY + 5)
			})
		}

		yOffset += 280
	}

    const imageBuffer = canvas.toBuffer('image/png')

    const imagePath = `./images/${commit.id}.png`

    fs.writeFileSync(imagePath, imageBuffer)
    
    // Create descriptive alt text
    const altText = `Commit ${commit.id.substring(0, 7)} by ${commit.author.name}: ${commit.message}`

    // Create the commit URL
    const commitUrl = commit.repository ? 
        `https://github.com/${commit.owner}/${commit.repository}/commit/${commit.id}` :
        null;

    const imageData = fs.readFileSync(`./images/${commit.id}.png`)

    // Create post with image
    await BlueskyService.createPost({
        text: `New commit by ${commit.author.name}\n\nMessage: ${commit.message}\nRepository: ${commit.repository}\nHash: ${commit.id.substring(0, 7)}${commitUrl ? `\n\nURL: ${commitUrl}` : ''}`,
        tags: ['github', 'commit', 'bluesky', 'github-commit'],
        images: [{
            image: `data:image/png;base64,${imageData.toString('base64')}`,
            alt: altText,
            aspectRatio: {
                width: canvas.width,
                height: canvas.height
            }
        }]
    })

    // Return the canvas for compatibility with existing code
    return canvas
}

// Helper function to parse patch
function parsePatch(patch: string) {
	const lines = patch.split('\n')
	const header = lines[0]
	const match = header.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)

	if (!match) {
		return {
			hunk: null,
			oldRange: { start: 0, lines: 0 },
			newRange: { start: 0, lines: 0 },
			changes: lines.slice(1).map((line) => ({
				type: 'context',
				content: line,
			})),
		}
	}

	const [oldStart, oldLines, newStart, newLines] = match.slice(1).map(Number)

	const changes = lines.slice(1).map((line) => {
		if (line.startsWith('+')) {
			return {
				type: 'addition',
				content: line.slice(1),
			}
		} else if (line.startsWith('-')) {
			return {
				type: 'deletion',
				content: line.slice(1),
			}
		} else {
			return {
				type: 'context',
				content: line.slice(1),
			}
		}
	})

	return {
		hunk: header,
		oldRange: {
			start: oldStart,
			lines: oldLines,
		},
		newRange: {
			start: newStart,
			lines: newLines,
		},
		changes,
	}
}

function getStatusColor(status: string): string {
	const colors: { [key: string]: string } = {
		added: '#238636',
		modified: '#9e6a03',
		removed: '#da3633',
		renamed: '#58a6ff',
	}
	return colors[status] || '#8b949e'
}

function getChangeBackgroundColor(type: string): string {
	return (
		{
			addition: '#1f3428',
			deletion: '#3c1f1f',
			context: '#1c2026',
		}[type] || '#1c2026'
	)
}

function getChangeTextColor(type: string): string {
	return (
		{
			addition: '#7ee787',
			deletion: '#ff7b72',
			context: '#8b949e',
		}[type] || '#8b949e'
	)
}

function getChangePrefix(type: string): string {
	return (
		{
			addition: '+',
			deletion: '-',
			context: ' ',
		}[type] || ' '
	)
}

export { createCommit, CommitData, CommitAuthor }
