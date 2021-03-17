// Require express and body-parser
const express = require("express")
const bodyParser = require("body-parser")

const InstanceManager = require("./managers/InstanceManager.js")
import PortManager from "./managers/PortManager.js"
import CommandManager from "./managers/CommandManager.js"

import {
    
} from "@octokit/webhooks-definitions/schema"

/**
 * Main runtime class for all operations, Helps to organize all the stuff
 */

interface configurationOptions {
    "LinkToDomain": string,
    "InternalIPOverride": string,
    "Starting_Port": number,
    "PR_IDLE_WAIT_MS": number,
    "webhookPort": number, 
    "minPort": number,
    "maxPort": number,
    "maxConsecutive"?: number,
    "PR_STALE_TIMEOUT_HOURS": number
}

export class Main {
    configData: configurationOptions;
    CM: CommandManager;
    PM: PortManager;

	/**
	 * Instantiate Main Class
	 */
	constructor(configData: configurationOptions) {
		//Ensure ./site_instances exists
		InstanceManager.prepSiteDirectory()

		//Instantiate all required managers
		this.PM = new PortManager(this, configData.minPort, configData.maxPort, configData.maxConsecutive ?? Infinity)
		this.CM = new CommandManager(this)

		this.configData = configData
	}

	createWebhookServer() {

		//Initialize Express
		const app = express()
		
		// Tell express to use body-parser's JSON parsing
		app.use(bodyParser.json())

		app.post("/hook", (req, res) => {
			//console.log(req.body) // Call your action on the request here
			res.status(200).end() // Responding is important

			parseWebhook(req.body)
		})


		// Start express on the defined port
		app.listen(this.configData.webhookPort, () => console.log(`🚀 Server running on port ${PORT}`))

		app.get("/", (req, res) => {
			res.status(200).end()
		})
	}

    
    /**Determine what type of webhook was received (comment or PR)*/
    parseWebhook(reqBody):void {
        if (reqBody.issue.pull_request && ["created"].includes(reqBody.action)) { //Is an valid issue comment that is on a PR
            CM.parse(reqBody)
        }

        if (reqBody.pull_request.number && ["opened", "reopened", "closed", "synchronize"].includes(reqBody.action)) { //Is a valid PR
            validatePR(reqBody)
        }
    }

    /**Validate incoming PRs to ensure the webhook needs action*/
    validatePR(reqBody):void {
        if (reqBody.number) {
            if (!["opened", "reopened", "synchronize", "closed"].includes(reqBody.action)) {
                return;
            }
            console.log(`Valid Hook Received!\nType: ${reqBody.action} | Issue: ${reqBody.number}`)

            //If we make it here, it is a valid pull request

            //Lets wait 15 seconds or so before process, just so that zips of the repo are up to date
            setTimeout(function() {
                processPRUpdate(reqBody)
            }, configData.PR_IDLE_WAIT_MS) //This should be set long enough (about 15 seconds or so) so that Github has time to generate a new zip
        }
    }

    /**Process PR updates*/
    processPRUpdate(reqBody):void {

        //Get the PR information
        let branchName = reqBody.pull_request.head.ref
        let repo = reqBody.pull_request.head.repo.full_name
        let PRid = reqBody.number
        let prRepo = reqBody.repository.name
        let prRepoAuthor = reqBody.repository.owner.login
        let prAuthor = reqBody.sender.login

        //Lets figure out what stage the PR is in
        switch (reqBody.action) {
            case "opened":
            case "reopened":
                //Build
                try {
                    InstanceManager.GetInstance(PRid).download()
                } catch (e) {
                    new InstanceManager(PM, {
                        "Branch": branchName,
                        "SourceRepoFullName": repo,
                        "PRID": PRid,
                        "PRRepoAccount": prRepoAuthor,
                        "PRRepoName": prRepo,
                        "PRAuthor": prAuthor

                    }).download()
                }

                break;

            case "synchronize": //Fancy term for "more commits added"
                //Kill, and rebuild
                try {
                    InstanceManager.GetInstance(PRid).edit()
                } catch (e) {
                    new InstanceManager(PM, {
                        "Branch": branchName,
                        "PRID": PRid,
                        "SourceRepoFullName": repo,
                        "PRRepoAccount": prRepoAuthor,
                        "PRRepoName": prRepo,
                        "PRAuthor": prAuthor
                    }).edit()
                }
                break

            case "closed":
                //Kill and close
                try {
                    InstanceManager.GetInstance(PRid).remove()
                } catch (e) {
                    new InstanceManager(PM, {
                        "Branch": branchName,
                        "PRID": PRid,
                        "SourceRepoFullName": repo,
                        "PRRepoAccount": prRepoAuthor,
                        "PRRepoName": prRepo,
                        "PRAuthor": prAuthor
                    }).remove()
                }
                break;

            default:
                console.log(`Unsupported PR Action type: ${reqBody.action}`)
                //Best to just leave it for now
                break;
        }
    }
}

new Main(require("./config.json"))