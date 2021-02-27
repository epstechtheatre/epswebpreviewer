// Require express and body-parser
const express = require("express")
const bodyParser = require("body-parser")

const InstanceManager = require("./InstanceManager.js")

//const PR_IDLE_WAIT = 15000 //15 seconds, ensures that latest zip is ready before downloading
const PR_IDLE_WAIT = require("./config.json").PR_IDLE_WAIT //15 seconds, ensures that latest zip is ready before downloading

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

InstanceManager.prepSiteDirectory()

function validatePR(reqBody) {
	if (reqBody.number) {
		if (!["opened", "reopened", "synchronize", "closed"].includes(reqBody.action)) {
			return;
		}
		console.log(`Valid Hook Received!\nType: ${reqBody.action} | Issue: ${reqBody.number}`)

		//Is now a valid pull request

		//Lets wait 15 seconds or so before process, just so that zips of the repo are up to date
		setTimeout(function() {
			processPRUpdate(reqBody)
		}, PR_IDLE_WAIT)
	}
}

function processPRUpdate(reqBody) {
	//Lets figure out what stage the PR is in
	let branchName = reqBody.pull_request.head.ref
	let repo = reqBody.pull_request.head.repo.full_name
	let PRid = reqBody.number
	let prRepo = reqBody.repository.name
	let prRepoAuthor = reqBody.repository.owner.login

	switch (reqBody.action) {
		case "opened":
		case "reopened":
			//Build
			new InstanceManager({
				"Branch": branchName,
				"SourceRepoFullName": repo,
				"PRID": PRid,
				"PRRepoAccount": prRepoAuthor,
				"PRRepoName": prRepo
			}).download()
			break;

		case "synchronize":
			try {
				InstanceManager.GetInstance(PRid).edit()
			} catch (e) {
				new InstanceManager({
					Branch: branchName,
					PRID: PRid,
					SourceRepoFullName: repo
				}).edit()
			}
			//Kill, and rebuild
			break

		case "closed":
			//Kill and close
			try {
				InstanceManager.GetInstance(PRid).remove()
			} catch (e) {
				new InstanceManager({
					Branch: branchName,
					PRID: PRid,
					SourceRepoFullName: repo
				}).remove()
			}
			break;

		default:
			console.log(reqBody.action)
			//Best to just leave it for now
			break;
	}
}