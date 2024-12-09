import { Probot } from 'probot'
import { CommitData, createCommit } from './events/push.js'
import { StatsService } from './services/stats.js'

export default (app: Probot) => {
	app.on('push', async (context) => {
		const { payload } = context
		const commits = payload.commits
		const repository = payload.repository

		const owner = repository.owner.login || repository.owner.name

		if (!owner) {
			console.log('No owner found in payload')
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

	// Weekly stats generation
	setInterval(async () => {
		await StatsService.generateWeeklyStats(app, process.env.GITHUB_USERNAME)
	}, 7 * 24 * 60 * 60 * 1000) // Weekly
}
