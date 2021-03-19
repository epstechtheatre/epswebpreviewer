import { IssueCommentEvent } from "@octokit/webhooks-definitions/schema"

//The file parses every comment detected to check if it contains a command.

export default class CommandManager {

    static Commands: { [key: string]: {Command: Command, requireAuthor: boolean}} = {}

    Parent: import("../index").Main
    
    /**
     * Create a command manager
     */
    constructor(Parent: import("../index").Main) {
        this.Parent = Parent
    }

    /**
     * Parse a potential command. If the command is valid and the commenter is the author of the PR, then run the command's callback
     */
    parse(ReqBody: IssueCommentEvent) {
        let commentBody = ReqBody.comment.body
        if (commentBody.startsWith("@EPSWebPreview")) {
            let possibleKeyword = commentBody.split(" ")[1].toLowerCase()
            if (CommandManager.Commands[possibleKeyword] !== undefined) {
                //Is a valid command keyword, lets check if the command wants the cmd sender to be the author

                //TODO: CHECK IF THESE ARE THE RIGHT PATHS

                //@ts-expect-error
                if (!CommandManager.Commands[possibleKeyword].requireAuthor || ReqBody.sender.login !== ReqBody.issue.pull_request.author.login) {
                    return
                }

                //otherwise we can run it

                CommandManager.Commands[possibleKeyword].Command.checkMe(commentBody)

            }
        }
    }

    static registerCommand(Command: Command) {
        this.Commands[Command.keyword.toLowerCase()] = { "Command": Command, "requireAuthor": Command.requireAuthor}
    }
}

/**
 * Very barebone command parser for github PR comments
 */
class Command {
    keyword: string
    callback: CommandFunction
    requireAuthor: boolean

    constructor(keyword: string, callback: CommandFunction, requireAuthor: boolean = true) {
        this.keyword = keyword
        this.callback = callback
        this.requireAuthor = requireAuthor

        CommandManager.registerCommand(this)
        return this
    }

    checkMe(enteredCommand: string) {
        
    }
}

interface CommandFunction {
    comment: string
    commenter: string
    PRID: number
}

//Because there is so few commands, I'm just going to write them all in this one file. If this expands, it should probably get a directory

var callback_listCommands: CommandFunction 
callback_listCommands = (comment: string, commenter: string, PRID: number) => {
    //List the four commands that can be run. If the commenter is not the PR author, prepend the message saying they can't run commands in this PR
}

var callback_requestPreview: CommandFunction
callback_requestPreview = (comment: string, commenter: string, PRID: number) => {
    //Check if the instance is running. If false, start a preview instance

}

var callback_destroyPreview: CommandFunction 
callback_destroyPreview = (comment: string, commenter: string, PRID: number) => {
    //Check if the instance is running. If true, destroy the instance
}

var callback_status: CommandFunction 
callback_status = (comment: string, commenter: string, PRID: number) => {
    //Check if the preview for the instance is running (this is simple, just need to check if the PRID instance process exists)
}

new Command("list", callback_listCommands)
new Command("create", callback_requestPreview)
new Command("destroy", callback_destroyPreview)
new Command("status", callback_status)


