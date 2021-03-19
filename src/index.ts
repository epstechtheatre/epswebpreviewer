// Require express and body-parser
import express from "express"
import bodyParser from "body-parser"

import InstanceManager from "./managers/InstanceManager.js"
import PortManager from "./managers/PortManager"
import CommandManager from "./managers/CommandManager"
import WebhookManager, { WebhookCallback } from "./managers/WebhookManager"

import {
    PullRequestEvent,
    IssueCommentEvent
} from "@octokit/webhooks-definitions/schema"
import CommentManager from "./managers/CommentManager.js"

export interface configurationOptions {
    "linkToDomain": string,
    "internalIPOverride": string,
    "webhookPort": number, 
    "minPort": number,
    "maxPort": number,
    "maxConsecutive"?: number,
    "instanceOpenHours": number
}

export interface authData {
    "githubToken": string,
    "webhookSecret": string
}

/**
 * Main runtime class for all operations, Helps to organize all the stuff
 */
export class Main {
    configData: configurationOptions;
    CommandManager: CommandManager;
    PortManager: PortManager;
    authData: authData;
    WebhookManager: WebhookManager
    CommentManager: CommentManager
    botLogin: string | undefined

	/**
	 * Instantiate Main Class
	 */
	constructor(configData: configurationOptions, authData: authData) {
		//Ensure ./site_instances exists
		InstanceManager.prepSiteDirectory()

		//Instantiate all required managers
		this.PortManager = new PortManager(this, configData.minPort, configData.maxPort, configData.maxConsecutive ?? Infinity)
		this.CommandManager = new CommandManager(this)

        this.WebhookManager = new WebhookManager(this)
        this.CommentManager = new CommentManager(this)

		this.configData = configData
        this.authData = authData
	}

    registerBodyTypeCallback(eventName: string, CB: WebhookCallback, delay: number = 0) {
        
        this.WebhookManager.addListener(eventName, CB, delay)

        return this
    }

    getGithubLogin(): Promise<Main> {
        let _this = this
        return new Promise(function (resolve, reject) {
            _this.CommentManager.getBotLogin().then((login) => {
                _this.botLogin = login
                resolve(_this)
            })
        })
    }

	createWebhookServer() {

		//Initialize Express
		const app = express()
		
		// Tell express to use body-parsers JSON parsing
		app.use(bodyParser.json())

		app.post("/hook", (req:express.Request, res:express.Response) => {
			//console.log(req.body)
            
			res.status(200).end() // Responding is important

			this.WebhookManager.checkIncoming(req)
		})


		// Start express on the defined port
		app.listen(this.configData.webhookPort, () => console.log(`🚀 Server running on port ${this.configData.webhookPort}`))

		app.get("/", (req:express.Request, res:express.Response) => {
			res.status(200).end()
		})
	}
}
class bodyTypeCallback {
    function: WebhookCallback

    constructor(callback: WebhookCallback) {
        this.function = callback
    }
}

const PR_CB = new bodyTypeCallback((Main: Main, reqBody: PullRequestEvent) => {
    if (reqBody.number) {
        if (!isValidAction(["opened", "reopened", "synchronize", "closed"], reqBody.action)) {
            return; //We are not listening to the incoming event
        }

        console.log(`Valid Hook Received!\nType: ${reqBody.action} | Issue: ${reqBody.number}`)

        //If we make it here, it is a valid pull request type

        //Get the PR information
        let branchName = reqBody.pull_request.head.ref
        let repo = reqBody.pull_request.head.repo.full_name
        let PRID = reqBody.number
        let prRepo = reqBody.repository.name
        let prRepoAuthor = reqBody.repository.owner.login
        let prAuthor = reqBody.sender.login

        //Lets figure out what stage the PR is in
        switch (reqBody.action) {
            case "opened":
            case "reopened":
                //Build
                
                //Try to use an existing instance, but if it doesn't exist, then create a new one
                if (InstanceManager.checkForInstance(PRID)) {
                    InstanceManager.getInstance(PRID).download()
                } else {
                    new InstanceManager(Main, {
                        "Branch": branchName,
                        "SourceRepoFullName": repo,
                        "PRID": PRID,
                        "PRRepoAccount": prRepoAuthor,
                        "PRRepoName": prRepo,
                        "PRAuthor": prAuthor
                    }).download()
                }
                break;

            case "synchronize": //Fancy term for "more commits added"
                //Kill, and rebuild

                if (InstanceManager.checkForInstance(PRID)) {
                    InstanceManager.getInstance(PRID).edit()
                } else {
                    new InstanceManager(Main, {
                        "Branch": branchName,
                        "PRID": PRID,
                        "SourceRepoFullName": repo,
                        "PRRepoAccount": prRepoAuthor,
                        "PRRepoName": prRepo,
                        "PRAuthor": prAuthor
                    }).edit()
                }
                break

            case "closed":
                //Kill and close

                if (InstanceManager.checkForInstance(PRID)) {
                    InstanceManager.getInstance(PRID).remove()
                } else {
                    new InstanceManager(Main, {
                        "Branch": branchName,
                        "PRID": PRID,
                        "SourceRepoFullName": repo,
                        "PRRepoAccount": prRepoAuthor,
                        "PRRepoName": prRepo,
                        "PRAuthor": prAuthor
                    }).remove()
                }
                break;
        }
    }
})

const IC_CB = new bodyTypeCallback((Main: Main, reqBody: IssueCommentEvent) => {
    if (!isValidAction(["created"], reqBody.action)) {
        return //We are not listening to the incoming event
    }
})

function isValidAction(allowedActions: Array<string>, incomingAction:string) {
    if (allowedActions.includes(incomingAction)) {
        return true
    } else {
        return false
    }
}

const PR_DELAY_MS = 15000 //This should be set long enough (about 15 seconds or so) so that Github has time to generate a new zip archive for the branch

new Main(require("./config.json"), require("./auth.json"))
.registerBodyTypeCallback("issue_comment", IC_CB.function)
.registerBodyTypeCallback("pull_request", PR_CB.function, PR_DELAY_MS)
.getGithubLogin().then((Main) => {
    Main.createWebhookServer()
})