import axios, { AxiosError } from 'axios'

// GitHub API response type for file content
interface GitHubFileResponse {
  content: string
  encoding: string
  sha: string
  size: number
}

const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
    }
})

/**
 * Fetches file content from GitHub repository
 * @param repository - Repository in format 'owner/repo'
 * @param filePath - Path to file within repository
 * @param branch - Branch name (defaults to 'main')
 * @returns Decoded file content
 * @throws Error if file cannot be fetched or decoded
 */
export async function getFileContent(repository: string, filePath: string, branch: string = 'main'): Promise<string> {
    try {
        const response = await client.get<GitHubFileResponse>(
            `/repos/${repository}/contents/${filePath}?ref=${branch}`
        )
        
        // GitHub API returns base64 encoded content
        const decoded = Buffer.from(response.data.content, 'base64').toString('utf-8')
        return decoded
    } catch (error) {
        if (error instanceof AxiosError) {
            throw new Error(`Failed to fetch file: ${error.response?.status} ${error.response?.statusText}`)
        }
        throw error
    }
}