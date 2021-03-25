import { PullRequestEvent } from "@octokit/webhooks-definitions/schema";

//Manage comments sent out to PR threads
const Github = require("github-api");

export default class GithubManager {
    Parent: import("../index").Main
    private githubUsername: string | undefined
    gh: any

    constructor(Parent: import("../index").Main) {
        this.Parent = Parent

        this.gh = new Github({
            "token": this.Parent.authData.githubToken
        })
    }

    /**
     * Makes an asynchronous call to the Github api to fetch the login of the bot. For synchronous cache lookup, use getGithubUsername()
     */    
    registerBotGithubUsername(): Promise<string> {
        let _this = this
        return new Promise(async function (resolve, reject) {
            let Me = await _this.gh.getUser().getProfile() //No params defaults to login user

            _this.githubUsername = (Me.data.login as string)

            resolve(_this.githubUsername)
        })
    }

    SendComment(RepoAcc: string, RepoName: string, PRID: number, comment: string) {
        return this.gh.getIssues(RepoAcc, RepoName).createIssueComment(PRID, comment, (comment: any) => {
            console.log(`Commented to PR ${PRID}`)
        })
    }

    getGithubUsername() {
        return this.githubUsername ?? "Unregistered"
    }

    getPR(RepoAuthor: string, RepoName: string, PRID: number): Promise<PullRequestEvent> {
        let _this = this
        return new Promise(async function (resolve, reject) {
            let PRreq; 
            try {
                PRreq = await _this.gh.getRepo(RepoAuthor, RepoName).getPullRequest(PRID)
            } catch (e) {
                throw e
            }
            
            resolve(({"pull_request": PRreq.data} as PullRequestEvent))
        })
    }
}