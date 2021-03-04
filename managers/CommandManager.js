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
     * Parse a potential command
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