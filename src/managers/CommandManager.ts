import { IssueCommentEvent } from "@octokit/webhooks-definitions/schema"
import { Main } from "../index"
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

                //@ts-expect-error   Typings don't exist for pull request path
                let isAuthor = ReqBody.sender.login !== ReqBody.issue.pull_request.author.login
                if (CommandManager.Commands[possibleKeyword].requireAuthor && !isAuthor) {
                    return
                }

                //otherwise we can run it
                CommandManager.Commands[possibleKeyword].Command.exec({
                    PRID: ReqBody.issue.number,
                    PRRepoOwner: ReqBody.repository.owner.login,
                    PRRepo: ReqBody.repository.name,
                    commentAuthor: ReqBody.sender.login,
                    commentBody: ReqBody.comment.body,
                    isAuthor: isAuthor,
                    Parent: this.Parent
                })

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
    callback: CommandCallback
    requireAuthor: boolean

    constructor(keyword: string, CommandCallback: CommandCallback, requireAuthor: boolean = true) {
        this.keyword = keyword
        this.callback = CommandCallback
        this.requireAuthor = requireAuthor

        CommandManager.registerCommand(this)
        return this
    }

    public exec(data: CommandFunctionData) {
        this.callback.function(data)
    }
}

interface CommandFunctionData {
    commentBody: string,
    commentAuthor: string
    PRID: number
    PRRepoOwner: string
    PRRepo: string
    isAuthor: boolean
    Parent: Main
}
interface CommandFunction {
    (data: CommandFunctionData): void
}

class CommandCallback {

    function: CommandFunction

    constructor(callback: CommandFunction) {
        this.function = callback
    }
}

//Because there are so few commands, I'm just going to write them all in this one file. If this expands, it should probably get a directory
new Command("list", new CommandCallback((data: CommandFunctionData) => {
    //List the four commands that can be run. If the commenter is not the PR author, prepend the message saying they can't run commands in this PR

    let commandResponse = ""

    if (data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
        commandResponse += `\n\`${data.Parent.GithubManager.getGithubUsername()}`
    }

    if (data.isAuthor) {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, "You can run the following commands in this comment thread:")
    }

}), false)
new Command("create", new CommandCallback((data: CommandFunctionData) => {
    //Check if the instance is running. If false, start a preview instance

}))
new Command("destroy", new CommandCallback((data: CommandFunctionData) => {
    //Check if the instance is running. If true, destroy the instance
}))
new Command("status", new CommandCallback((data: CommandFunctionData) => {
    //Check if the preview for the instance is running (this is simple, just need to check if the PRID instance process exists)
}))