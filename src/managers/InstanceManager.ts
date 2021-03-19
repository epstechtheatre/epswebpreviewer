//Manages the instances of the websites, including building, running and stopping them

import PortManager from "./PortManager";

//Manages all open instances of servers
const download_repo_git = require("download-git-repo") 

import fs from "fs"
import {spawn} from "child_process"
import Comments from "./CommentManager.js"
export interface PRInstanceOptions {
    PRID: number
    SourceRepoFullName: string
    Branch: string
    PRRepoAccount: string
    PRRepoName: string
    PRAuthor: string
}

interface processQueueTask { (Me: PRInstance): Promise<any> }

/**
 * Queue asynchronous tasks to run in a defined order, while retaining the benefits of asynchronous code.
 */
class ProcessQueue extends Array {
    parent: PRInstance
    running: boolean
    runtime: Promise<void> | undefined

    constructor(Parent: PRInstance) {
        super();
        this.parent = Parent
        this.running = false

        return this;
    }

    /**
     * Add a process to the operations queue
     */
    public addProcess(callback: Promise<any>) {
        super.push(callback)

        if (!this.running) {
            this.runtime = this.process()
        }
    }

    /**
     * Get the current runtime of the process queue. Returns a resolve promise if the runtime is not currently active.
     */
    public getRuntime():Promise<void> {
        if (this.runtime) {
            return this.runtime
        } else {
            return Promise.resolve();
        }
    }

    private snapshot(): Array<processQueueTask> {
        return [...this]
    }

    /**
     * Start the process queue, it will run till the queue is empty
     */
    private process(recur:boolean = false): Promise<void> | undefined {
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
                if (instance) {
                    await instance(Me.parent);
                }
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

export default class PRInstance {

    static instances: {[key: string]: PRInstance} = {}
    assignedPort: number = 0; //Initially assigned 0 but this will change before a server is opened
    process: any;
    processTimeout: NodeJS.Timeout | undefined;

    static getInstance(PRID: number): PRInstance {
        let output: PRInstance = this.instances[PRID.toString()]

        if (output === undefined) {
            throw Error(`[GetInstance] ${PRID} has no associated instance!`)
        } else {
            return output
        }
    }

    static checkForInstance(PRID: number): boolean {
        let output: PRInstance = this.instances[PRID.toString()]

        if (output !== undefined) {
            return true
        } else {
            return false
        }
    }

    static prepSiteDirectory() {
        if (!fs.existsSync("./site_instances")) {
            fs.mkdirSync("./site_instances")
        }
    }

    /**
     * Check if the folder for an instance exists (If an instance exists but is not cached, it implies it was opened before a script reload)
     */
    static instanceDirExists(PRID: number): boolean {
        if (fs.existsSync(`./site_instances/${PRID.toString()}`)) {
            return true
        } else {
            return false
        }
    }

    Parent: import("../index").Main;
    webhookData: PRInstanceOptions;
    processQueue: ProcessQueue

    /**
     * 
     * @param {PortManager} PortManager
     * @param {PRInstanceOptions} webhookData 
     * @returns {PRInstance} Instance registered in memory and can be recalled with the PR ID
     */
    constructor(Parent: import("../index").Main, webhookData: PRInstanceOptions) {
        this.Parent = Parent
        this.webhookData = webhookData

        PRInstance.instances[this.webhookData.PRID] = this

        this.processQueue = new ProcessQueue(this)

        return this
    }

    async download() {
        let _this = this
        this.processQueue.addProcess(
            new Promise(async function (resolve, reject) {
                //Check if already exists, if so, stop this and swap to edit
                if (_this.instanceDirExists()) {
                    await _this.edit()
                    resolve(true)

                } else {
                    try {
                        await _this.downloadDir()
                        if (_this.activateJekyll()) {
                            await _this.comment("newServerNoResources")
                        } else {

                        }
                    } catch {
                        //Right now, don't do anything, maybe in the future this will change

                    } finally {
                        //Want to make sure that regardless of what happens, the promise is fulfilled

                        resolve(true)
                    }
                }
            })
        )
    }

    async edit() {
        let _this = this
        this.processQueue.addProcess(
            new Promise(async function (resolve, reject) {
                //Start by killing any open instance of this PR
                _this.killJekyll()

                try {
                    await _this.deleteDir()
                    await _this.downloadDir()
                    if (_this.activateJekyll()) {
                        await _this.comment("edit")
                    } else {
                        await _this.comment("editFailed")
                    }
                } catch {
                    //Right now, don't do anything, maybe in the future this will change

                } finally {
                    resolve(true)
                }
            })
        )
    }

    async remove(forceRelease = false) {
        let _this = this
        this.processQueue.addProcess(
            new Promise(async function (resolve, reject) {
                _this.killJekyll()
                
                try {
                    await _this.deleteDir()

                    //We should keep track of closed PRs and there is a change it will be reopened immediately (and so it needs to be in the process queue)
                    if (forceRelease) {
                        //Forcefully remove the cache of this Instance
                        delete PRInstance.instances[_this.webhookData.PRID]
                    }
                } catch (e) {
                    //Right now, don't do anything, maybe in the future this will change
                } finally {
                    resolve(true)
                }
            })
        )

    }

    async downloadDir(): Promise<any> {
        let Me = this
        return new Promise(function (resolve, reject)  {
            download_repo_git(`direct:https://github.com/${Me.webhookData.SourceRepoFullName}/archive/${Me.webhookData.Branch}.zip`, `./site_instances/${Me.webhookData.PRID.toString()}`, function(err: string) {
                if (!err) {
                    console.info(`Successfully Downloaded for PR ${Me.webhookData.PRID}`)
                    resolve(true)
                } else {
                    console.error(`Error Downloading for PR ${Me.webhookData.PRID}: ${err}`)
                    reject(err)
                }
            })
        })
    }

    deleteDir(): Promise<true> {
        let Me = this
        return new Promise(function (resolve, reject) {
            if (!Me.instanceDirExists()) {
                resolve(true)
            } else {
                fs.rmdir(`./site_instances/${Me.webhookData.PRID.toString()}`, {"recursive": true}, function() {
                    console.info(`Successfully Deleted Cache for PR ${Me.webhookData.PRID}`)
                    resolve(true)
                })
            }
        })

    }

    instanceDirExists(): boolean {
        if (fs.existsSync(`./site_instances/${this.webhookData.PRID.toString()}`)) {
            return true
        } else {
            return false
        }
    }

    activateJekyll() {
        if (!fs.existsSync(`./site_instances/${this.webhookData.PRID.toString()}/docs`)) {
            console.error(`[activateJekyll] malformed instance for PR ${this.webhookData.PRID}! Skipping...`)
            return false
        } else {
                if (this.assignedPort === 0) { //This will not be equal to 0 if the activation is coming after an edit() call

                //Create a port assignment - Attempt to have the port ID be the same as the PR id, but we can't always have nice things
                try {
                    if (this.Parent.PortManager.checkIfAvailable(this.webhookData.PRID + this.Parent.configData.minPort)) {
                        this.assignedPort = this.Parent.PortManager.bindManual(this.webhookData.PRID, this)
                    } else {
                        this.assignedPort = this.Parent.PortManager.bindAuto(this)
                    }
                } catch {
                    //Max port probably reached
                    return false
                }
            }

            let _this = this

            console.log(`(Re)activating Jekyll Instance for PR ${this.webhookData.PRID}`)
            this.process = spawn(`bundle`, [`exec`, `jekyll`, `serve`, `-P`, `${(this.assignedPort).toString()}`,`-H`, `${getInternalIP(this.Parent.configData)}`, `--no-watch`], {
                cwd: `site_instances/${this.webhookData.PRID}/docs`
            })

            this.process.stdout.on("data", (data: string) => {
                console.log(`stdout from PR ${_this.webhookData.PRID} jekyll child: ${data}`)
            })

            this.process.on("error", (err: string) => {
                console.error(`Error in Jekyll Instance for PR ${this.webhookData.PRID}: ${err}`)
                return false
            })

            //Set a timeout, after this time, close the Jekyll process
            this.processTimeout = setTimeout(function() {
                _this.killJekyll()
            }, 1000 * 60 * 60 * this.Parent.configData.instanceOpenHours /*convert to milliseconds*/)
        }
        return true
    }

    comment(type: "new"|"edit"|"newServerNoResources" = "new"): Promise<any> {
        let _this = this
        return new Promise(function (resolve, reject) {
            if (_this.assignedPort) {
                let commentString = Comments.createTemplateCommentString(_this.webhookData.PRAuthor, _this.Parent.configData.linkToDomain, _this.assignedPort, _this.Parent.configData.instanceOpenHours, type)

                _this.Parent.CommentManager.SendComment(_this.webhookData, commentString, true).then(() => {
                    resolve(true)
                })
            }
        })

    }

    killJekyll() {
        if (this.process) {
            this.process?.kill()
            delete this.process
            console.log(`Disabled Jekyll for PR ${this.webhookData.PRID}!`)
        }

        //Incase the kill ran before initial assignment (which can happen if a PR was opened, the script was restarted (cleared from memory), and then closed)
        if (this.assignedPort) {
            if (!this.Parent.PortManager.checkIfAvailable(this.assignedPort)) {
                this.Parent.PortManager.release(this.assignedPort)
                delete this.assignedPort
            }
        }

        //Make sure to clear timeout as well!
        if (this.processTimeout) {
            clearInterval(this.processTimeout)
            delete this.processTimeout
        }
    }
}

function getInternalIP(config: import("../index").configurationOptions) {
    if (config.internalIPOverride) {
        return config.internalIPOverride
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