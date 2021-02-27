//Manages all open instances of servers
const download_repo_git = require("download-git-repo") 

const fs = require("fs")
const {spawn} = require("child_process")
const Github = require("github-api");
const auth = require("./auth.json")
const config = require("./config.json")

var gh = new Github({
    "token": auth.token
})

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

        return this
    }

    async download() {
        //Check if already exists, if so, stop this and swap to edit
        if (this.#dirExists()) {
            await this.edit()

        } else {
            await this.#downloadDir()
            if (this.activateJekyll()) {
                await this.comment()
            }
        }
    }

    async edit() {
        this.killJekyll()

        await this.#deleteDir()
        await this.#downloadDir()
        if (this.activateJekyll()) {
            await this.comment("edit")
        }
    }

    async remove() {
        await this.#deleteDir()
        this.killJekyll()
        delete PRInstance.instances[this.options.PRID]
    }

    async #downloadDir() {
        let Me = this
        return new Promise(function (resolve, reject) {
            download_repo_git(`direct:https://github.com/${Me.options.SourceRepoFullName}/archive/${Me.options.Branch}.zip`, `site_instances/${Me.options.PRID}`, function(err) {
                if (!err) {
                    resolve()
                } else {
                    reject(err)
                }
            })
        })
    }

    #deleteDir() {
        let Me = this
        return new Promise(function (resolve, reject) {
            if (!Me.#dirExists()) {
                resolve()
            } else {
                fs.rm(`site_instances/${Me.options.PRID}`, {"recursive": true}, function() {
                    resolve()
                })
            }
        })

    }

    #dirExists() {
        if (fs.existsSync(`site_instances/${this.options.PRID}`)) {
            return true
        } else {
            return false
        }
    }

    activateJekyll() {
        if (!fs.existsSync(`site_instances/${this.options.PRID}/docs`)) {
            console.error("[activateJekyll] malformed instance! Skipping...")
            return false
        } else {
            let Me = this
            //Set a 6 hour timeout, after this time, close the Jekyll process
            this.assignedPort = this.#PRidToInt() + config.Starting_Port

            this.process = spawn(`bundle`, [`exec`, `jekyll`, `serve`, `-P`, `${(this.assignedPort).toString()}`,`-H`, `${config.InternalIP}`], {
                cwd: `site_instances/${this.options.PRID}/docs`,
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
        let comment = ""
        switch (type) {
            case "new":
                comment = `Your proposed changes have been downloaded successfully!
                [Click Here](http://${config.LinkToDomain}:${this.assignedPort} "Click to go to preview site") to preview the wiki with your changes. 
                The preview site will remain active for a six hour period following the most recent update. It will close after this time, or when your changes are merged. Whichever happens first.`
                break;

            case "edit":
                comment = `Your latest changes have been downloaded successfully! 
                [Click Here](http://${config.LinkToDomain}:${this.assignedPort} "Click to go to preview site") to preview the wiki with your changes.`
                break;
        }

        gh.getIssues(this.options.PRRepoAccount, this.options.PRRepoName).createIssueComment(this.#PRidToInt(), comment, function() {
            debugger
        })
    }

    killJekyll() {
        this.process?.kill()

        if (this.processTimeout) {
            clearInterval(this.processTimeout)
            delete this.processTimeout
        }
        //Make sure to clear timeout as well!
    }

    #PRidToInt() {
        let output = parseInt(this.options.PRID)

        if (isNaN(output)) {
            throw Error("[PRidToInt] PRID is not a number!")
        } else {
            return output
        }
    }
}

module.exports = PRInstance