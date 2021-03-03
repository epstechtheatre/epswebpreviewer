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
     * @param {String} text 
     */
    parse(text) {
        if (text.startsWith("")) {
            
        }
    }
}

module.exports = CommandManager