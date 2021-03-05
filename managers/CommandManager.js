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
        let commentBody = ReqBody.comment.body
        if (commentBody.startsWith("@EPSWebPreview")) {
            let possibleKeyword = commentBody.split(" ")[1].toLowerCase()
            if (CommandManager.Commands[possibleKeyword] !== undefined) {
                //Is a valid command keyword, lets check if the command wants the cmd sender to be the author

                //TODO: CHECK IF THESE ARE THE RIGHT PATHS
                if (!CommandManager.Commands[possibleKeyword].requireAuthor || ReqBody.sender.login !== ReqBody.issue.pull_request.author.login) {
                    return
                }

                //otherwise we can run it

                CommandManager.Commands[possibleKeyword].checkMe()

            }
        }
    }


    /**
     * @type {Object.<string, {Command: Command, requireAuthor: Boolean}>}
     */
    static Commands = {}

    /**
     * Called from the Command Class
     * @param {String} keyword Will toLowerCase() when called
     * @param {Command} Command
     * @param {Boolean} requireAuthor 
     */
    static registerCommand(keyword, Command, requireAuthor) {
        this.Commands[keyword.toLowerCase()] = { "Command": Command, "requireAuthor": requireAuthor}
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
     * @param {Boolean} [requireAuthor=true]
     */
    constructor(keyword, callback, requireAuthor = true) {
        this.keyword = keyword
        this.callback = callback
        this.requireAuthor = requireAuthor

        CommandManager.registerCommand(this.requireAuthor)
        return this
    }

    /**
     * 
     * @param {String} entered 
     */
    checkMe(entered) {
        
    }
}

module.exports = {
    CommandManager: CommandManager,
    Command: Command
}

//Because there is so few commands, I'm just going to write them all in this one file. If this expands, it should probably get a directory

/** @type {CommandFunction} */
function callback_listCommands(comment, commenter, PRID) {
    //List the four commands that can be run. If the commenter is not the PR author, prepend the message saying they can't run commands in this PR
}

/** @type {CommandFunction} */
function callback_requestPreview(comment, commenter, PRID) {
    //Check if the instance is running. If false, start a preview instance

}

/** @type {CommandFunction} */
function callback_destroyPreview(comment, commenter, PRID) {
    //Check if the instance is running. If true, destroy the instance
}

/** @type {CommandFunction} */
function callback_status(comment, commenter, PRID) {
    //Check if the preview for the instance is running (this is simple, just need to check if the PRID instance process exists)
}

new Command("list", callback_listCommands)
new Command("create", callback_requestPreview)
new Command("destroy", callback_destroyPreview)
new Command("status", callback_status)


