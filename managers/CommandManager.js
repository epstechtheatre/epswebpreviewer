//The file parses every comment detected to check if it contains a command.
const InstanceManager = require("./InstanceManager.js")
const PortManager = require("./PortManager.js")


class CommandManager {
    /**
     * Create a command manager
     * @param {PortManager} PortManager 
     */
    constructor(PortManager) {

    }

    /**
     * Parse a potential command. If the command is valid and the commenter is the author of the PR/a member of the review team, then run the command's callback
     * @param {{}} ReqBody 
     */
    parse(ReqBody) {
        if (/*The Req Body Information the will say this is a comment */ false) {
            if (CommandManager.Commands["commandText"]) {
                CommandManager.Commands["commandText"].callback(stuff)
            }
        }
    }


    /**
     * @type {Object.<string, Command>}
     */
    static Commands = {}

    /**
     * Called from the Command Class
     * @param {Command} Command 
     */
    static registerCommand(keyword, Command) {
        this.Commands[keyword] = Command
    }
}

/**
 * Very barebone command parser for github PR comments
 */
class Command {
    /**
     * @callback CommandFunction
     * @param {String} commenter
     * @param {Number} PRID
     */

    /**
     * 
     * @param {String} keyword 
     * @param {CommandFunction} callback
     */
    constructor(keyword, callback) {
        this.keyword = keyword
        this.callback = callback

        CommandManager.registerCommand()
        return this
    }

    /**
     * 
     * @param {String} entered 
     */
    checkMe(entered) {
        if (entered.toLowerCase() == this.keyword.toLowerCase()) {
            this.callback()
        }
    }
}

module.exports = {
    CommandManager: CommandManager,
    Command: Command
}

//Because there is so few commands, I'm just going to write them all in this one file. If this expands, it should probably get a directory

/** @type {CommandFunction} */
function callback_listCommands(commenter, PRID) {
    //List the four commands that can be run. If the commenter is not the PR author, prepend the message saying they can't run commands in this PR
}

/** @type {CommandFunction} */
function callback_requestPreview(commenter, PRID) {
    //Check if the instance is running. If false, start a preview instance

}

/** @type {CommandFunction} */
function callback_destroyPreview(commenter, PRID) {
    //Check if the instance is running. If true, destroy the instance
}

/** @type {CommandFunction} */
function callback_status(commenter, PRID) {
    //Check if the preview for the instance is running (this is simple, just need to check if the PRID instance process exists)
}

new Command("list", callback_listCommands)
new Command("create", callback_requestPreview)
new Command("destroy", callback_destroyPreview)
new Command("status", callback_status)


