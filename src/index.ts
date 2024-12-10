import { Probot } from 'probot'
import { CommitData, createCommit } from './events/push.js'
import { StatsService } from './services/stats.js'
import { createConfig } from './utils/configParser.js'
import fs from 'fs'
import path from 'path'

export default (app: Probot) => {

	// Create the images directory if it doesn't exist
	if (!fs.existsSync(path.join(process.cwd(), 'images'))) {
		fs.mkdirSync(path.join(process.cwd(), 'images'), { recursive: true })
	}

	app.on('push', async (context) => {
		const { payload } = context
		const commits = payload.commits
		const repository = payload.repository

		// Check if it is a private repository
		if (repository.private) {
			console.log('Skipping private repository')
			return
		}

		const owner = repository.owner.login || repository.owner.name

		if (!owner) {
			console.log('No owner found in payload')
			return
		}

		const config = await createConfig(`${owner}/${repository.name}`)

		if (!config.github.commits.postToBluesky) {
			console.log(`Skipping commit push for ${repository.name} because commits are not enabled in the config`)
			return
		}

		for (const commit of commits) {
			try {
				// Get commit data
				const { data: commitData } = await context.octokit.repos.getCommit({
					owner: owner,
					repo: repository.name,
					ref: commit.id,
				})

				// Create enriched commit data with proper typing
				const enrichedCommit: CommitData = {
					id: commit.id,
					message: commit.message,
					timestamp: commit.timestamp,
					repository: repository.name,
					owner: owner,
					author: {
						...commit.author,
						avatar_url: undefined, // Will be set below if available
					},
					files: [], // Initialize with empty array, will be populated with commitData.files later
				}

				// Get author data if username is available
				if (commit.author.username) {
					try {
						const { data: userData } =
							await context.octokit.users.getByUsername({
								username: commit.author.username,
							})
						enrichedCommit.author.avatar_url = userData.avatar_url
					} catch (error) {
						console.error('Error fetching user data:', error)
					}
				}

				// Create and save image
				await createCommit(
					enrichedCommit,
					commitData.files || [],
				)
			} catch (error: any) {
				console.error('Error processing commit:', error)
				if (error.response) {
					console.error('Error response:', {
						status: error.response.status,
						data: error.response.data,
					})
				}
			}
		}
	})
	

	setInterval(async () => {
		await StatsService.generateWeeklyStats(app, process.env.GITHUB_USERNAME || '')
	}, 7 * 24 * 60 * 60 * 1000) // Weekly
}
