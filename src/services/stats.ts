import { Probot } from 'probot'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { BlueskyService } from './bluesky.js'
import Logger from '../classes/logger.js'
import { format } from 'date-fns'
import { createConfig } from '../utils/configParser.js'

export class StatsService {
    static async generateWeeklyStats(app: Probot, username: string) {
        try {
            // Get the installation ID for the user
            const installations = (await app.auth()).apps.listInstallations()
            const installation = (await installations).data.find(inst => 
                inst.account?.login?.toLowerCase() === username.toLowerCase()
            )

            if (!installation) {
                throw new Error(`No installation found for user ${username}`)
            }

            // Get authenticated client for this installation
            const github = await app.auth(installation.id)
            
            // Get all repositories for the user
            const { data: repos } = await github.repos.listForUser({
                username,
                sort: 'updated',
                per_page: 100
            })

            // Initialize counters
            let totalCommits = 0
            let totalIssues = 0
            let totalPRs = 0
            const dailyCommits = [0, 0, 0, 0, 0, 0, 0] // Last 7 days
            let activeRepos = 0

            // Get stats for each repo
            await Promise.all(repos.map(async (repo) => {
                try {
                    // Check if stats are enabled for this repository
                    const config = await createConfig(`${repo.owner.login}/${repo.name}`)
                    // Check if the repository is private
                    if (repo.private) {
                        return // Skip this repository if it is private
                    }
                    // Check if the repository is disabled in the config
                    if (!config.stats.enable) {
                        return // Skip this repository if stats are disabled
                    }

                    activeRepos++ // Increment active repos counter
                    
                    const oneWeekAgo = new Date()
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
                    
                    const [commits, issues, prs] = await Promise.all([
                        github.repos.listCommits({
                            owner: repo.owner.login,
                            repo: repo.name,
                            since: oneWeekAgo.toISOString(),
                            per_page: 100
                        }),
                        github.issues.listForRepo({
                            owner: repo.owner.login,
                            repo: repo.name,
                            state: 'all',
                            since: oneWeekAgo.toISOString()
                        }),
                        github.pulls.list({
                            owner: repo.owner.login,
                            repo: repo.name,
                            state: 'all'
                        })
                    ])

                    // Process commits by day
                    commits.data.forEach(commit => {
                        const date = new Date(commit.commit.author?.date || commit.commit.committer?.date || '')
                        const dayIndex = 6 - Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
                        if (dayIndex >= 0 && dayIndex < 7) {
                            dailyCommits[dayIndex]++
                            totalCommits++
                        }
                    })

                    totalIssues += issues.data.length
                    totalPRs += prs.data.length
                } catch (error) {
                    Logger.log('error', `Failed to get stats for ${repo.name}: ${error}`, 'StatsService')
                }
            }))

            // Get best available font
            const systemFonts = GlobalFonts.families
            const preferredFonts = ['Noto Sans', 'FreeSans', 'Arial']
            const mainFont = preferredFonts.find(font => 
                systemFonts.some(f => f.family === font)
            ) || 'FreeSans'

            // Create canvas
            const canvas = createCanvas(1200, 800)
            const ctx = canvas.getContext('2d')

            // Background
            ctx.fillStyle = '#0d1117'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Header
            ctx.fillStyle = '#7ee787'
            ctx.font = `bold 48px "${mainFont}"`
            ctx.fillText(`Weekly Activity for @${username}`, 40, 80)

            // Timestamp
            ctx.fillStyle = '#8b949e'
            ctx.font = `24px "${mainFont}"`
            ctx.fillText(format(new Date(), 'MMM d, yyyy HH:mm:ss'), 40, 120)

            // Repository count
            ctx.fillStyle = '#58a6ff'
            ctx.font = `20px "${mainFont}"`
            ctx.fillText(`Active repositories: ${activeRepos}/${repos.length}`, 40, 160)

            // Stats Cards
            const cards = [
                { 
                    title: 'Total Commits', 
                    value: totalCommits,
                    color: '#238636'
                },
                { 
                    title: 'Active Issues', 
                    value: totalIssues,
                    color: '#da3633'
                },
                { 
                    title: 'Pull Requests', 
                    value: totalPRs,
                    color: '#58a6ff'
                }
            ]

            // Draw cards
            cards.forEach((card, index) => {
                const x = 40 + (index * 400)
                const y = 200
                const width = 360
                const height = 200
                const radius = 10

                // Card background
                ctx.beginPath()
                ctx.roundRect(x, y, width, height, radius)
                ctx.fillStyle = '#161b22'
                ctx.fill()
                ctx.strokeStyle = '#30363d'
                ctx.lineWidth = 2
                ctx.stroke()

                // Card content
                ctx.fillStyle = card.color
                ctx.font = `bold 32px "${mainFont}"`
                ctx.fillText(`${card.title}`, x + 20, y + 50)

                ctx.fillStyle = '#e6edf3'
                ctx.font = `bold 64px "${mainFont}"`
                ctx.fillText(card.value.toString(), x + 20, y + 140)
            })

            // Activity Graph
            const graphY = 440
            const graphHeight = 300
            const graphWidth = canvas.width - 80

            // Graph background
            ctx.beginPath()
            ctx.roundRect(40, graphY, graphWidth, graphHeight, 10)
            ctx.fillStyle = '#161b22'
            ctx.fill()
            ctx.strokeStyle = '#30363d'
            ctx.lineWidth = 2
            ctx.stroke()

            // Graph title
            ctx.fillStyle = '#7ee787'
            ctx.font = `bold 24px "${mainFont}"`
            ctx.fillText('Global Commit Activity (Last Week)', 60, graphY + 40)

            // Draw commit activity graph
            const maxCommits = Math.max(...dailyCommits, 1) // Ensure we don't divide by zero
            const barWidth = 100
            const barSpacing = (graphWidth - 160 - (barWidth * 7)) / 6 // Distribute space evenly

            // Draw grid lines
            const gridLines = 5
            ctx.strokeStyle = '#30363d'
            ctx.lineWidth = 1
            for (let i = 0; i <= gridLines; i++) {
                const y = graphY + 60 + ((graphHeight - 100) * i / gridLines)
                ctx.beginPath()
                ctx.moveTo(60, y)
                ctx.lineTo(graphWidth - 20, y)
                ctx.stroke()

                // Add scale labels
                ctx.fillStyle = '#8b949e'
                ctx.font = `14px "${mainFont}"`
                ctx.textAlign = 'right'
                const value = Math.round((maxCommits * (gridLines - i) / gridLines))
                ctx.fillText(value.toString(), 50, y + 5)
            }
            ctx.textAlign = 'left'

            // Draw bars
            dailyCommits.forEach((commits, index) => {
                const x = 60 + (index * (barWidth + barSpacing))
                const barHeight = commits === 0 ? 
                    0 : 
                    ((commits / maxCommits) * (graphHeight - 120))
                
                const y = graphY + graphHeight - 60 - barHeight

                // Bar gradient
                const gradient = ctx.createLinearGradient(x, y, x, y + barHeight)
                gradient.addColorStop(0, '#238636')
                gradient.addColorStop(1, '#2ea043')

                // Bar shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
                ctx.shadowBlur = 8
                ctx.shadowOffsetX = 0
                ctx.shadowOffsetY = 4

                // Bar
                ctx.beginPath()
                ctx.roundRect(x, y, barWidth, barHeight, 5)
                ctx.fillStyle = gradient
                ctx.fill()

                // Reset shadow
                ctx.shadowColor = 'transparent'
                ctx.shadowBlur = 0
                ctx.shadowOffsetX = 0
                ctx.shadowOffsetY = 0

                // Day label
                ctx.fillStyle = '#8b949e'
                ctx.font = `16px "${mainFont}"`
                const day = format(
                    new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000),
                    'EEE'
                )
                ctx.textAlign = 'center'
                ctx.fillText(day, x + barWidth/2, graphY + graphHeight - 20)

                // Commit count
                if (commits > 0) {
                    ctx.fillStyle = '#e6edf3'
                    ctx.font = `bold 16px "${mainFont}"`
                    ctx.fillText(
                        commits.toString(),
                        x + barWidth/2,
                        y - 10
                    )
                }
            })
            ctx.textAlign = 'left' // Reset text alignment

            // Post to Bluesky
            const imageBuffer = canvas.toBuffer('image/png')
            await BlueskyService.createPost({
                text: `📊 Weekly Activity for https://github.com/${username}\n\nTracking ${activeRepos} active repositories out of ${repos.length} total.\nWant to see your own? https://github.com/chocoOnEstrogen/rem-bot`,
                tags: ['github', 'stats', 'developer'],
                images: [{
                    image: `data:image/png;base64,${imageBuffer.toString('base64')}`,
                    alt: `Weekly GitHub activity statistics for ${username}`,
                    aspectRatio: { width: canvas.width, height: canvas.height }
                }]
            })

        } catch (error) {
            Logger.log('error', `Failed to generate weekly stats: ${error}`, 'StatsService')
        }
    }
} 