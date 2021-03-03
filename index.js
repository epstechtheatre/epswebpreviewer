// Require express and body-parser
const express = require("express")
const bodyParser = require("body-parser")

const InstanceManager = require("./InstanceManager.js")
const PortManager = require("./PortManager.js")
const CommandManager = require("./managers/CommandManager.js")
const config = require("./config.json")

// Initialize express and define a port
const app = express()
const PORT = 9193

// Tell express to use body-parser's JSON parsing
app.use(bodyParser.json())

app.post("/hook", (req, res) => {
	//console.log(req.body) // Call your action on the request here
	res.status(200).end() // Responding is important

	validatePR(req.body)
})


// Start express on the defined port
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))

app.get("/", (req, res) => {
    res.status(200).end()
})

//Ensure ./site_instances exists
InstanceManager.prepSiteDirectory()

//Instantiate Port Manager
const PM = new PortManager(config.minPort, config.maxPort, config.maxConsecutive ?? Infinity)

//Instantiate Command Manager
const CM = new CommandManager(PM)

//Validate incoming PRs to ensure the webhook needs action
function validatePR(reqBody) {
	if (reqBody.number) {
		if (!["opened", "reopened", "synchronize", "closed"].includes(reqBody.action)) {
			return;
		}
		console.log(`Valid Hook Received!\nType: ${reqBody.action} | Issue: ${reqBody.number}`)

		//If we make it here, it is a valid pull request

		//Lets wait 15 seconds or so before process, just so that zips of the repo are up to date
		setTimeout(function() {
			processPRUpdate(reqBody)
		}, config.PR_IDLE_WAIT_MS) //This should be set long enough (about 15 seconds or so) so that Github has time to generate a new zip
	}
}

//Process PR updates
function processPRUpdate(reqBody) {

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