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
    public parse(ReqBody: IssueCommentEvent): void {
        let commentBody = ReqBody.comment.body

        let isAuthor = ReqBody.sender.login === ReqBody.issue.user.login
                
        let passData = {
            PRID: ReqBody.issue.number,
            PRRepoOwner: ReqBody.repository.owner.login,
            PRRepo: ReqBody.repository.name,
            commentAuthor: ReqBody.sender.login,
            commentBody: ReqBody.comment.body,
            isAuthor: isAuthor,
            Parent: this.Parent
        }

        if (commentBody.startsWith(`@${this.Parent.GithubManager.getGithubUsername()}`)) {
            //Check comment is in PR thread
            if (ReqBody.issue.pull_request === undefined) {
                this.sendNonPRResponse(ReqBody);
                return;
            }

            if (commentBody.trim() === `@${this.Parent.GithubManager.getGithubUsername()}`) {
                //Comment only mentioned the bot and nothing else
                CommandManager.Commands["_onlyMention"]?.Command.exec(passData)
            }

            let possibleKeyword = commentBody.split(" ")[1].toLowerCase()

            if (CommandManager.Commands[possibleKeyword] !== undefined) {
                //Is a valid command keyword, lets check if the command wants the cmd sender to be the author

                if (CommandManager.Commands[possibleKeyword].requireAuthor && !isAuthor) {
                    //User does not have permission, send that response, if it was registered
                    CommandManager.Commands["_noPermission"]?.Command.exec(passData)
                    return;
                }

                //otherwise we can run it
                CommandManager.Commands[possibleKeyword].Command.exec(passData)

            } else {
                CommandManager.Commands["_invalidCommand"]?.Command.exec(passData)
            }
        }
    }

    public static registerCommand(Command: Command) {
        this.Commands[Command.keyword] = { "Command": Command, "requireAuthor": Command.requireAuthor}
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

    /**
     * @param keyword Keywords _onlyMention, _invalidCommand, _noPermission
     */
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
            commandResponse += `\n\n\`@${data.Parent.GithubManager.getGithubUsername()} delete\` <-- close your preview site`
        } else {
            commandResponse += `\n\n\`@${data.Parent.GithubManager.getGithubUsername()} create\` <-- create a preview site for you changes`
        }
    }

    commandResponse += `\n\n\`@${data.Parent.GithubManager.getGithubUsername()} status\` <-- check for and link to an active preview (if one exists for this thread)`

    commandResponse += `\n\n<br>\`@${data.Parent.GithubManager.getGithubUsername()} help\` <-- resend this comment`

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
        }, `You already have an active preview!\n\nHere's a link to it: ${data.Parent.configData.linkToDomain}:${data.Parent.InstanceManager.getInstance(data.PRID).assignedPort}`)    
    } else {
        if (data.Parent.InstanceManager.checkForInstance(data.PRID)) {
            await data.Parent.InstanceManager.getInstance(data.PRID).download(true, (result) => {
                if (result !== "newNoResources" && result !== false) {
                    data.Parent.CommentManager.SendComment({
                        PRID: data.PRID,
                        PRRepoAccount: data.PRRepoOwner,
                        PRRepoName: data.PRRepo
                    }, `Preview created!\n\nHere's a link to it: ${data.Parent.configData.linkToDomain}:${data.Parent.InstanceManager.getInstance(data.PRID).assignedPort}`)                              
                }
            })
        } else {
            let PRData = await data.Parent.GithubManager.getPR(data.PRRepoOwner, data.PRRepo, data.PRID)

            await data.Parent.InstanceManager.spawn({
                Branch: PRData.pull_request.head.ref,
                SourceRepoFullName: PRData.pull_request.head.repo.full_name,
                PRAuthor: PRData.pull_request.user.login,
                PRID: data.PRID,
                PRRepoAccount: data.PRRepoOwner,
                PRRepoName: data.PRRepo
            }).download(true, () => {
                data.Parent.CommentManager.SendComment({
                    PRID: data.PRID,
                    PRRepoAccount: data.PRRepoOwner,
                    PRRepoName: data.PRRepo
                }, `Preview created!\n\nHere's a link to it: ${data.Parent.configData.linkToDomain}:${data.Parent.InstanceManager.getInstance(data.PRID).assignedPort}`)                
            })
       }
    }

}))
new Command("delete", new CommandCallback(async (data: CommandFunctionData) => {
    //Check if the instance is running. If true, destroy the instance
    if (!data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You do not currently have an active preview.`)    
    } else {
        await data.Parent.InstanceManager.getInstance(data.PRID).remove(false, () => {
            data.Parent.CommentManager.SendComment({
                PRID: data.PRID,
                PRRepoAccount: data.PRRepoOwner,
                PRRepoName: data.PRRepo
            }, `Deleted. Thanks for helping me to save resources!`)    
        })
    }
}))

new Command("status", new CommandCallback((data: CommandFunctionData) => {
    //Check if the preview for the instance is running (this is simple, just need to check if the PRID instance process exists)
    if (data.Parent.InstanceManager.checkIfInstanceIsActive(data.PRID)) {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You have an active preview!\n\nHere's a link to it: ${data.Parent.configData.linkToDomain}:${data.Parent.InstanceManager.getInstance(data.PRID).assignedPort}`)    
    } else {
        data.Parent.CommentManager.SendComment({
            PRID: data.PRID,
            PRRepoAccount: data.PRRepoOwner,
            PRRepoName: data.PRRepo
        }, `You do not have an active preview, but can create one by typing \`@${data.Parent.GithubManager.getGithubUsername()} create\``)    
    }
}), false)

new Command("_onlyMention", new CommandCallback((data: CommandFunctionData) => {
   data.Parent.CommentManager.SendComment({
       PRID: data.PRID,
       PRRepoAccount: data.PRRepoOwner,
       PRRepoName: data.PRRepo
   }, `I am a bot that helps simplify the contribution process by creating and managing preview websites of unfinished and pending contributions.\n\nPlease type \`@${data.Parent.GithubManager.getGithubUsername()} help\` for more information on what you can tell me to do.`) 
}))

new Command("_invalidCommand", new CommandCallback((data: CommandFunctionData) => {
    data.Parent.CommentManager.SendComment({
        PRID: data.PRID,
        PRRepoAccount: data.PRRepoOwner,
        PRRepoName: data.PRRepo
    }, `I couldn't understand what you were trying to tell me to do.\n\nPlease type \`@${data.Parent.GithubManager.getGithubUsername()} help\` for a list of commands I respond to.`)  
}))

new Command("_noPermission", new CommandCallback((data: CommandFunctionData) => {
    data.Parent.CommentManager.SendComment({
        PRID: data.PRID,
        PRRepoAccount: data.PRRepoOwner,
        PRRepoName: data.PRRepo
    }, `Sorry. Only the author of these contributions can run that command. To see what commands you can run, type \`@${data.Parent.GithubManager.getGithubUsername()} help\``)  
}))