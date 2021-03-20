//Manage comments sent out to PR threads
const Github = require("github-api");

export default class GithubManager {
    Parent: import("../index").Main
    githubUsername: string | undefined
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
            let Me = _this.gh.getUser() //No params defaults to login user

            //TODO: Something

            _this.githubUsername = Me

            resolve(Me)

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
}