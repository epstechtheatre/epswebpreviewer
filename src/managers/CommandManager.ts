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
    public parse(ReqBody: IssueCommentEvent) {
        let commentBody = ReqBody.comment.body
        if (commentBody.startsWith("@EPSWebPreview")) {
            let possibleKeyword = commentBody.split(" ")[1].toLowerCase()
            if (CommandManager.Commands[possibleKeyword] !== undefined) {
                //Is a valid command keyword, lets check if the command wants the cmd sender to be the author

                let isAuthor = ReqBody.sender.login === ReqBody.issue.user.login
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

    public static registerCommand(Command: Command) {
        this.Commands[Command.keyword.toLowerCase()] = { "Command": Command, "requireAuthor": Command.requireAuthor}
    }

    public sendNonPRResponse(ReqBody: IssueCommentEvent) {
        this.Parent.CommentManager.SendComment({
            PRID: ReqBody.issue.number,
            PRRepoAccount: ReqBody.repository.owner.login,
            PRRepoName: ReqBody.repository.name
        }, "Commands can only be used in pull requests (which this thread is not)")
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
new Command("help", new CommandCallback((data: CommandFunctionData) => {
    //List the four commands that can be run. If the commenter is not the PR author, prepend the message saying they can't run commands in this PR

    let commandResponse = ""

    if (data.isAuthor) {
        commandResponse += "As you are the author of these changes, you can currently run the following commands in this thread:"

        if (data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
            commandResponse += `\n\n\`@${data.Parent.GithubManager.getGithubUsername()} destroy\` <-- close your preview site`
        } else {
            commandResponse += `\n\n\`@${data.Parent.GithubManager.getGithubUsername()} create\` <-- create a preview site for you changes`
        }
    }

    commandResponse += `\n\n\`@${data.Parent.GithubManager.getGithubUsername()} status\` <-- check for and link to an active preview if one exists for these changes`

    commandResponse += `\n\n<br>\`@${data.Parent.GithubManager.getGithubUsername()} help\` <-- send this comment`

    data.Parent.CommentManager.SendComment({
        PRID: data.PRID,
        PRRepoAccount: data.PRRepoOwner,
        PRRepoName: data.PRRepo
    }, commandResponse)

}), false)
new Command("create", new CommandCallback(async (data: CommandFunctionData) => {
    //Check if the instance is running. If false, start a preview instance
    if (data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You already have an active preview!\n\nHere is a link to it: http://${data.Parent.configData.linkToDomain}:${data.Parent.InstanceManager.getInstance(data.PRID).assignedPort}`)    
    } else {
        if (data.Parent.InstanceManager.checkForInstance(data.PRID)) {
            data.Parent.InstanceManager.getInstance(data.PRID).download()
        } else {

            let PRData = await data.Parent.GithubManager.getPR(data.PRRepoOwner, data.PRRepo, data.PRID)

            data.Parent.InstanceManager.spawn({
                Branch: PRData.pull_request.head.ref,
                SourceRepoFullName: PRData.pull_request.head.repo.full_name,
                PRAuthor: PRData.pull_request.user.login,
                PRID: data.PRID,
                PRRepoAccount: data.PRRepoOwner,
                PRRepoName: data.PRRepo
            }).download()
        }
    }

}))
new Command("destroy", new CommandCallback(async (data: CommandFunctionData) => {
    //Check if the instance is running. If true, destroy the instance
    if (!data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You do not have an active preview`)    
    } else {
        await data.Parent.InstanceManager.getInstance(data.PRID).remove()
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `All done. Thanks for helping me to save resources!`)    
    }
}))

new Command("status", new CommandCallback((data: CommandFunctionData) => {
    //Check if the preview for the instance is running (this is simple, just need to check if the PRID instance process exists)
    if (data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You have an active preview!\n\nHere is a link to it: http://${data.Parent.configData.linkToDomain}:${data.Parent.InstanceManager.getInstance(data.PRID).assignedPort}`)    
    } else {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You do not have an active preview, but can create one using the \`@${data.Parent.GithubManager.getGithubUsername()} create\` command.`)    
    }
}), false)