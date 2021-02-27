//Manages all open instances of servers
const download_repo_git = require("download-git-repo") 

const fs = require("fs")
const {spawn} = require("child_process")
const Github = require("github-api");
const auth = require("./auth.json")
const config = require("./config.json");

var gh = new Github({
    "token": auth.token
})

class ProcessQueue extends Array {
    constructor(Parent) {
        super();
        this.parent = Parent
        this.running = false

        return this;
    }

    AddProcess(callback) {
        super.push(callback)

        if (!this.running) {
            this.runtime = this.process()
        }
    }


    getRuntime() {
        if (this.runtime) {
            return this.runtime
        } else {
            return Promise.resolve();
        }
    }

    snapshot() {
        return [...this]
    }

    process(recur = false) {
        if (!recur && this.running) { //Second instance might be trying to run
            return
        }
    
        let Me = this;
        //Uploads changing to the external database, in the order they come in. This ensures that updates aren't dropped because of asynchronous tasks  
        return new Promise(async function (resolve, reject) {
            Me.running = true; //Global variable announce that the save task is running
    
            let snapshot = Me.snapshot() //Clone by value the current save queue 

            Me.splice(0, snapshot.length)//Splice the processing tasks out of the save queue
    
            while (snapshot.length > 0) { //For all the items in the snapshot, run them one by one
                let instance = snapshot.shift()
                await instance(Me.parent);
            }
            
            if (Me.length > 0) { //If new tasks have come in since the task started, recurse back into another pass
                await Me.process(true);
            }
    
            if (!recur) { //If the parent instance gets here, we're done
                Me.running = false; 
            }
            resolve();
        })
    }
}
class PRInstance {
    /**
     * @type {Object.<string, PRInstance}
     */
    static instances = {}

    static GetInstance(PRid) {
        let output = this.instances[PRid]

        if (output === undefined) {
            throw Error(`[GetInstance] ${PRid} has no associated instance!`)
        } else {
            return output
        }
    }

    static prepSiteDirectory() {
        if (!fs.existsSync("site_instances")) {
            fs.mkdirSync("site_instances")
        }
    }

    /** 
     * @typedef PRInstanceOptions
     * @property {Number} PRID ID of the Pull Request
     * @property {String} SourceRepoFullName Full Name of the Repo merging to the project 
     * @property {String} Branch Branch name of the repo being merged
     * @property {String} PRRepoAccount Repo account owner of the project
     * @property {String} PRRepoName Name of the project
     */

    /**
     * 
     * @param {PRInstanceOptions} options 
     * @param {"opened"|"edited"|"closed"} [overrideState="opened"] Default opened
     * @returns {PRInstance} Instance registered in memory and can be recalled with the PR ID
     */
    constructor(options) {
        this.options = options

        PRInstance.instances[this.options.PRID] = this

        this.processQueue = new ProcessQueue(this)

        return this
    }

    async download() {
        this.processQueue.AddProcess(callback)

        function callback(Me) {
            return new Promise(async function (resolve, reject) {
                //Check if already exists, if so, stop this and swap to edit
                console.log("Download")

                if (Me.dirExists()) {
                    console.log("I am transferring to edit")
                    await Me.edit()
                    resolve()
    
                } else {
                    console.log("I am continuing as planning")
                    await Me.downloadDir()
                    console.log("I am downloading")
                    if (Me.activateJekyll()) {
                        console.log("I have activated Jekyll")
                        await Me.comment()
                        resolve()
                    }
                }
            })
        }
    }

    async edit() {
        this.processQueue.AddProcess(callback)
        
        function callback(Me) {
            return new Promise(async function (resolve, reject) {
                Me.killJekyll()

                console.log("I am deleting the directory")
                await Me.deleteDir()
                console.log("I am downloading")
                await Me.downloadDir()
                if (Me.activateJekyll()) {
                    await Me.comment("edit")
                    resolve()
                }
            })
        }
    }

    async remove(forceRelease = false) {
        this.processQueue.AddProcess(callback)

        function callback(Me) {
            return new Promise(async function (resolve, reject) {
                Me.killJekyll()
                await Me.deleteDir()
                //We don't want to remove this because if the PR gets immediately reopened, we should keep track of the process queue. Next time the script restarts, it will be released
                if (forceRelease) {
                    delete PRInstance.instances[Me.options.PRID]
                }

                resolve()
            })
        }
    }

    async downloadDir() {
        let Me = this
        return new Promise(function (resolve, reject) {
            download_repo_git(`direct:https://github.com/${Me.options.SourceRepoFullName}/archive/${Me.options.Branch}.zip`, `site_instances/${Me.options.PRID}`, function(err) {
                if (!err) {
                    console.info(`Successfully Downloaded for PR ${Me.options.PRID}`)
                    resolve()
                } else {
                    console.error(`Error Downloading for PR ${Me.options.PRID}: ${err}`)
                    reject(err)
                }
            })
        })
    }

    deleteDir() {
        let Me = this
        return new Promise(function (resolve, reject) {
            if (!Me.dirExists()) {
                resolve()
            } else {
                fs.rmdir(`site_instances/${Me.options.PRID}`, {"recursive": true}, function() {
                    console.info(`Successfully Deleted Cache for PR ${Me.options.PRID}`)
                    resolve()
                })
            }
        })

    }

    dirExists() {
        
        if (fs.existsSync(`site_instances/${this.options.PRID}`)) {
            console.log("The Directory Exists")
            return true
        } else {
            return false
        }
    }

    activateJekyll() {
        if (!fs.existsSync(`site_instances/${this.options.PRID}/docs`)) {
            console.error(`[activateJekyll] malformed instance for PR ${this.options.PRID}! Skipping...`)
            return false
        } else {
            let Me = this
            //Set a 6 hour timeout, after this time, close the Jekyll process
            this.assignedPort = this.PRidToInt() + config.Starting_Port

            this.process = spawn(`bundle`, [`exec`, `jekyll`, `serve`, `-P`, `${(this.assignedPort).toString()}`,`-H`, `${getInternalIP()}`, `--no-watch`], {
                cwd: `site_instances/${this.options.PRID}/docs`,
            })
            this.process.stdout.on("data", data => {
                console.log(`stdout from PR ${Me.options.PRID} jekyll child: ${data}`)
            })

            this.process.on("error", err => {
                return false
            })

            this.processTimeout = setTimeout(function() {
                Me.killJekyll()
            }, 1000 * 60 * 60 * 6)
        }
        return true
    }

    /**
     * 
     * @param {"new"|"edit"} type 
     */
    comment(type = "new") {
        let Me = this
        return new Promise(function (resolve, reject) {
            let comment = ""
            switch (type) {
                case "new":
                    comment = `Your proposed changes have been downloaded successfully!
                    [Click Here](http://${config.LinkToDomain}:${Me.assignedPort} "Click to go to preview site") to preview the wiki with your changes. 
                    The preview site will remain active for a six hour period following the most recent update. It will close after this time, or when your changes are merged. Whichever happens first.`
                    break;
    
                case "edit":
                    comment = `Your latest changes have been downloaded successfully! 
                    [Click Here](http://${config.LinkToDomain}:${Me.assignedPort} "Click to go to preview site") to preview the wiki with your changes.`
                    break;
            }
    
            gh.getIssues(Me.options.PRRepoAccount, Me.options.PRRepoName).createIssueComment(Me.PRidToInt(), comment, () => {
                resolve()
            })
        })

    }

    killJekyll() {
        if (this.process) {
            this.process?.kill()
            console.log(`Disabled Jekyll for PR ${this.options.PRID}!`)
        }

        if (this.processTimeout) {
            //Make sure to clear timeout as well!
            clearInterval(this.processTimeout)
            delete this.processTimeout
        }
    }

    PRidToInt() {
        let output = parseInt(this.options.PRID)

        if (isNaN(output)) {
            throw Error("[PRidToInt] PRID is not a number!")
        } else {
            return output
        }
    }
}

module.exports = PRInstance

function getInternalIP() {
    if (config.InternalIPOverride) {
        return config.InternalIPOverride
    }


    const { networkInterfaces } = require('os');

    const nets = networkInterfaces();
    const results = Object.create(null); // Or just '{}', an empty object

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    console.dir(results)

    if (Object.keys(results).length === 1) {
        if (results[Object.keys(results)[0]].length === 1) {
            return results[Object.keys(results)[0]][0]
        } else {
            if (results["eth0"]) {
                return results["eth0"][0]
            } else {
                throw Error("Cannot find internal IP")
            }
        }
    }
}