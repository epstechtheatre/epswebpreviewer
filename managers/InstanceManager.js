//Manages all open instances of servers
const download_repo_git = require("download-git-repo") 

const fs = require("fs")
const {spawn} = require("child_process")
const config = require("./config.json");
const Comments = require("./CommentManager.js")
const PortManager = require("./PortManager");

/**
 * Queue asynchronous tasks to run in a defined order, while retaining the benefits of asynchronous code.
 */
class ProcessQueue extends Array {
    /**
     * Construct a process queue for a Instance Manager
     * @param {PRInstance} Parent 
     */
    constructor(Parent) {
        super();
        this.parent = Parent
        this.running = false

        return this;
    }

    /**
     * Add a asynchronous promise to the process queue
     * @param {Promise} callback 
     */
    AddProcess(callback) {
        super.push(callback)

        if (!this.running) {
            this.runtime = this.#process()
        }
    }

    /**
     * Get the current runtime of the process queue. Returns a resolve promise if the runtime is not currently active.
     * @returns {Promise}
     */
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

    /**
     * @private
     * Start the process queue, it will run till the queue is empty
     * @param {Boolean} recur
     * @returns {Promise}
     */
    #process(recur = false) {
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
        if (!fs.existsSync("./site_instances")) {
            fs.mkdirSync("./site_instances")
        }
    }

    /** 
     * @typedef PRInstanceOptions
     * @property {Number} PRID ID of the Pull Request
     * @property {String} SourceRepoFullName Full Name of the Repo merging to the project 
     * @property {String} Branch Branch name of the repo being merged
     * @property {String} PRRepoAccount Repo account owner of the project
     * @property {String} PRRepoName Name of the repo the PR is coming from
     * @property {String} PRAuthor Name of the user merging the PR
     */

    /**
     * 
     * @param {PortManager} PortManager
     * @param {PRInstanceOptions} options 
     * @returns {PRInstance} Instance registered in memory and can be recalled with the PR ID
     */
    constructor(PortManager, options) {
        this.PortManager = PortManager
        this.options = options

        PRInstance.instances[this.options.PRID] = this

        this.processQueue = new ProcessQueue(this)

        return this
    }

    async download() {
        this.processQueue.AddProcess(callback)

        /**
         * 
         * @param {PRInstance} Me 
         */
        function callback(Me) {
            return new Promise(async function (resolve, reject) {
                //Check if already exists, if so, stop this and swap to edit
                if (Me.instanceDirExists()) {
                    await Me.edit()
                    resolve()
    
                } else {
                    try {
                        await Me.downloadDir()
                        if (Me.activateJekyll()) {
                            await Me.comment()
                        }
                    } catch {
                        //Right now, don't do anything, maybe in the future this will change

                    } finally {
                        //Want to make sure that regardless of what happens, the promise is fulfilled

                        resolve()
                    }
                }
            })
        }
    }

    async edit() {
        this.processQueue.AddProcess(callback)
        
        /**
         * 
         * @param {PRInstance} Me 
         */
        function callback(Me) {
            return new Promise(async function (resolve, reject) {
                //Start by killing any open instance of this PR
                Me.killJekyll()
    
                try {
                    await Me.deleteDir()
                    await Me.downloadDir()
                    if (Me.activateJekyll()) {
                        await Me.comment("edit")
                    }
                } catch {
                    //Right now, don't do anything, maybe in the future this will change

                } finally {
                    resolve()
                }
            })
        }
    }

    async remove(forceRelease = false) {
        this.processQueue.AddProcess(callback)

        /**
         * 
         * @param {PRInstance} Me 
         */
        function callback(Me) {
            return new Promise(async function (resolve, reject) {
                Me.killJekyll()
                
                try {
                    await Me.deleteDir()

                    //We should keep track of closed PRs and there is a change it will be reopened immediately (and so it needs to be in the process queue)
                    if (forceRelease) {
                        //Forcefully remove the cache of this Instance
                        delete PRInstance.instances[Me.options.PRID]
                    }
                } catch (e) {
                    //Right now, don't do anything, maybe in the future this will change
                } finally {
                    resolve()
                }
            })
        }
    }

    async downloadDir() {
        let Me = this
        return new Promise(function (resolve, reject) {
            download_repo_git(`direct:https://github.com/${Me.options.SourceRepoFullName}/archive/${Me.options.Branch}.zip`, `./site_instances/${Me.options.PRID.toString()}`, function(err) {
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
            if (!Me.instanceDirExists()) {
                resolve()
            } else {
                fs.rmdir(`./site_instances/${Me.options.PRID.toString()}`, {"recursive": true}, function() {
                    console.info(`Successfully Deleted Cache for PR ${Me.options.PRID}`)
                    resolve()
                })
            }
        })

    }

    instanceDirExists() {
        if (fs.existsSync(`./site_instances/${this.options.PRID.toString()}`)) {
            return true
        } else {
            return false
        }
    }

    activateJekyll() {
        if (!fs.existsSync(`./site_instances/${this.options.PRID.toString()}/docs`)) {
            console.error(`[activateJekyll] malformed instance for PR ${this.options.PRID}! Skipping...`)
            return false
        } else {
            let Me = this

            //Create a port assignment - Attempt to have the port ID be the same as the PR id, but we can't always have nice things
            try {
                if (this.PortManager.checkIfAvailable(this.options.PRID + config.minPort)) {
                    this.assignedPort = this.PortManager.bindManual(this.options.PRID, this)
                } else {
                    this.assignedPort = this.PortManager.bindAuto(this)
                }
            } catch {
                //Max port probably reached
                return false
            }

            console.log(`Activating Jekyll Instance for PR ${this.options.PRID}`)
            this.process = spawn(`bundle`, [`exec`, `jekyll`, `serve`, `-P`, `${(this.assignedPort).toString()}`,`-H`, `${getInternalIP()}`, `--no-watch`], {
                cwd: `site_instances/${this.options.PRID}/docs`
            })

            this.process.stdout.on("data", data => {
                console.log(`stdout from PR ${Me.options.PRID} jekyll child: ${data}`)
            })

            this.process.on("error", err => {
                console.error(`Error in Jekyll Instance for PR ${this.options.PRID}: ${err}`)
                return false
            })

            //Set a timeout, after this time, close the Jekyll process
            this.processTimeout = setTimeout(function() {
                Me.killJekyll()
            }, 1000 * 60 * 60 * config.PR_STALE_TIMEOUT_HOURS /*convert to milliseconds*/)
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
            let string = Comments.createCommentString(Me.options.PRAuthor, config.LinkToDomain, Me.assignedPort, type)
            
    
            gh.getIssues(Me.options.PRRepoAccount, Me.options.PRRepoName).createIssueComment(Me.options.PRID, string, (comment) => {
                debugger
                console.log(`Commented to PR ${Me.options.PRID}`)
                resolve()
            })
        })

    }

    killJekyll() {
        if (this.process) {
            this.process?.kill()
            delete this.process
            console.log(`Disabled Jekyll for PR ${this.options.PRID}!`)
        }

        //Incase the kill ran before initial assignment (which can happen if a PR was opened, the script was restarted (cleared from memory), and then closed)
        if (!this.PortManager.checkIfAvailable(this.assignedPort)) {
            this.PortManager.release(this.assignedPort)
            delete this.assignedPort
        }

        //Make sure to clear timeout as well!
        if (this.processTimeout) {
            clearInterval(this.processTimeout)
            delete this.processTimeout
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
            console.log(`IP detected: ${results[Object.keys(results)[0]][0]}`)
            return results[Object.keys(results)[0]][0]
        } else {
            if (results["eth0"]) {
                console.log(`IP detected: ${results["eth0"][0]}`)
                return results["eth0"][0]
            } else {
                throw Error("Cannot find internal IP")
            }
        }
    }
}