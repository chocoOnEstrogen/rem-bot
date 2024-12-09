import { BskyAgent } from '@atproto/api'
import Logger from '../classes/logger.js'

interface Post {
	text: string
	tags: string[]
	images?: {
		alt: string
		image: string
		aspectRatio: {
			width: number
			height: number
		}
	}[]
}

function convertDataURIToUint8Array(dataURI: string): Uint8Array {
	const base64 = dataURI.split(',')[1];
	const binary = atob(base64);
	const array = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		array[i] = binary.charCodeAt(i);
	}
	return array;
}

export class BlueskyService {
	static async createPost(postData: Post) {

        if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_PASSWORD) {
            throw new Error('BLUESKY_IDENTIFIER and BLUESKY_PASSWORD must be set')
        }

		if (postData.images && postData.images.length > 4) {
			throw new Error('Bluesky does not support more than 4 images per post')
		}

		try {
			const agent = new BskyAgent({
				service: 'https://bsky.social',
			})
	
			await agent.login({
				identifier: process.env.BLUESKY_IDENTIFIER!,
				password: process.env.BLUESKY_PASSWORD!,
			})

			const data: any = {
				text: postData.text,
				tags: postData.tags,
				createdAt: new Date().toISOString(),
			}

			if (postData.images && postData.images.length > 0) {
				const uploadedImages = await Promise.all(
					postData.images.map(async (img) => {
						const { data: uploadData } = await agent.uploadBlob(
							convertDataURIToUint8Array(img.image),
							{ encoding: 'image/png' }
						)
						return {
							alt: img.alt,
							image: uploadData.blob,
							aspectRatio: img.aspectRatio
						}
					})
				)

				data.embed = {
					$type: 'app.bsky.embed.images',
					images: uploadedImages
				}
			}
	
			await agent.post(data)

			await agent.logout()
		} catch (error: any) {
			Logger.log(
				'error',
				`Failed to create post on Bluesky: ${error.message}`,
				'BlueskyService',
			)
		}
	}
}
