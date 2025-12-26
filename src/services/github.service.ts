import { config } from '../config';

interface GitHubTokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
}

interface GitHubUser {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
}

interface GitHubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
}

/**
 * GitHub OAuth Service
 * Handles GitHub OAuth flow: authorization URL, token exchange, and user profile fetching
 */
export class GitHubService {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;

    constructor() {
        this.clientId = config.githubClientId;
        this.clientSecret = config.githubClientSecret;
        this.redirectUri = `${config.frontendUrl}/auth/github/callback`;
    }

    /**
     * Generate GitHub OAuth authorization URL
     */
    getAuthorizationUrl(): string {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: 'read:user user:email',
            state: this.generateState(),
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<string> {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code,
                redirect_uri: this.redirectUri,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to exchange code for token');
        }

        const data = (await response.json()) as GitHubTokenResponse;

        if (!data.access_token) {
            throw new Error('No access token received from GitHub');
        }

        return data.access_token;
    }

    /**
     * Fetch GitHub user profile
     */
    async getGitHubUser(accessToken: string): Promise<{ githubId: string; email: string; name: string | null }> {
        // Fetch user profile
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch GitHub user profile');
        }

        const user = (await userResponse.json()) as GitHubUser;

        // If email is not public, fetch from emails endpoint
        let email = user.email;
        if (!email) {
            email = await this.getPrimaryEmail(accessToken);
        }

        if (!email) {
            throw new Error('Could not retrieve email from GitHub account');
        }

        return {
            githubId: user.id.toString(),
            email,
            name: user.name || user.login,
        };
    }

    /**
     * Fetch primary email from GitHub emails endpoint
     */
    private async getPrimaryEmail(accessToken: string): Promise<string | null> {
        const response = await fetch('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            return null;
        }

        const emails = (await response.json()) as GitHubEmail[];
        const primaryEmail = emails.find(e => e.primary && e.verified);

        return primaryEmail?.email || emails.find(e => e.verified)?.email || null;
    }

    /**
     * Generate a random state for CSRF protection
     */
    private generateState(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}

// Export singleton instance
export const githubService = new GitHubService();
