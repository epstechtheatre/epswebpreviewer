import { PRInstanceData } from "./InstanceManager";
interface CommentData extends PRInstanceData {
    BotLoginUsername: string
    LinkDomain: string
    AssignedPort: number
}

export interface SendCommentData {
    PRID: number
    PRRepoAccount: string
    PRRepoName: string
}
export default class CommentManager {
    Parent: import("../index").Main

    constructor(Parent: import("../index").Main) {
        this.Parent = Parent
    }

    SendComment(options: SendCommentData, commentString: string, useFancify: boolean = false): Promise<boolean> {
        let _this = this

        if (useFancify) {
            commentString = CommentManager.fancify(commentString)
        }
        return new Promise(async function (resolve, reject) {
            await _this.Parent.GithubManager.SendComment(options.PRRepoAccount, options.PRRepoName, options.PRID, commentString)

            resolve(true)
        })
    }

    static registeredPrebuiltResponses: { [key: string]: PrebuiltComment} = {}

    /**
     * Create a comment to send out
     */
    getTemplateCommentString(data: PRInstanceData, commentIdentifier: string) {
        //Convert data to CommentData object

        let commentData: CommentData = (data as CommentData)
        commentData.BotLoginUsername = this.Parent.GithubManager.getGithubUsername()
        commentData.LinkDomain = this.Parent.configData.linkToDomain
        
        //This is safe because this function is only called from instance manager (from inside an active instance)
        commentData.AssignedPort = this.Parent.InstanceManager.getInstance(data.PRID).assignedPort 
        
        let comment = CommentManager.registeredPrebuiltResponses[commentIdentifier]?.buildMessage(commentData)

        if (comment === undefined) {
            throw Error(`Requested Comment ${commentIdentifier} does not exist!`)
        }

        return comment;
    }

    /**
     * I take in nice javascript text and turn it into mangled markdown text (no tabs at the start of lines)
     */
    static fancify(text: string) {
        return text.replace(/^\s*/gmi, "") //Remove all spaces at the start of a line
    }

    static registerPrebuiltResponse(toRegister: PrebuiltComment) {
        if (this.registeredPrebuiltResponses[toRegister.identifier]) { //Comment with same identifier already exists
            throw Error("[registerPrebuiltResponse] identifier already claimed!")
        }

        this.registeredPrebuiltResponses[toRegister.identifier] = toRegister
    }
}

class PrebuiltComment {
    text: string
    identifier: string

    constructor(identifier: string, commentText: string) {
        this.text = commentText
        this.identifier = identifier

        CommentManager.registerPrebuiltResponse(this)
    }

    buildMessage (data: CommentData) {
        /*Comment building syntax:
        Imbedded variables don't work when they don't have scope so I have a bootleg method to do replacements

        Data is passed an object, to indicate a replacement, type ~~{keyName}
        */ 
        let textSnapshot = this.text

        while (textSnapshot.search(/(~{2}\{.*?\})/mi) > 0) {
            let matchIndex = textSnapshot.search(/(~{2}\{.*?\})/mi)

            //@ts-expect-error //It is lying, match can't return an error because we can only remain in the while loop if a pattern is found
            let keyName = textSnapshot.substring(matchIndex + 3, matchIndex + textSnapshot.match(/(~{2}\{.*?\})/mi)[0].length - 1)

            if (data.hasOwnProperty(keyName)) {
                //@ts-expect-error //This is also lying
                let replacement = data[keyName]
                textSnapshot = textSnapshot.replace(/(~{2}\{.*?\})/mi, replacement)

            } else {
                throw Error(`[Comment Build] Unknown variable ${keyName} requested!`)
            }
        }

        return textSnapshot
    }
}

new PrebuiltComment("newDefault", "Hey there, @~~{PRAuthor}!\nI've spun up a server so you can preview the wiki with your changes. It has all the same styling as the real wiki, so your changes here will look the exact same when merged.\n## → [Click Here](~~{LinkDomain}:~~{AssignedPort} \"Click to go to preview site\") ← to go to the preview site.\n(Other contributors and reviewers may use this to make sure your changes are top-notch)\n<br>\nMy resources are limited, so I can only keep the preview open for so long. However, every time I see more changes show up in this thread I'll keep the preview open longer, or reopen it if it timed out already.\nThanks for contributing!")

//For when I comment (hardcoded)
new PrebuiltComment("newModified", "Hey there, @~~{PRAuthor}!\nI've spun up a server so you can preview the wiki with your changes. It has all the same styling as the real wiki, so your changes here will look the exact same when merged.\n## → [Click Here](~~{LinkDomain}:~~{AssignedPort} \"Click to go to preview site\") ← to go to the preview site.\n(Other contributors and reviewers may use this to make sure your changes are top-notch)\n<br>\nMy resources are limited, so I can only keep the preview open for so long. However, every time I see more changes show up in this thread I'll keep the preview open longer, or reopen it if it timed out already.")

new PrebuiltComment("edit", "I've plugged your latest changes into the preview, so I'll keep it open longer. [Click Here](~~{LinkDomain}:~~{AssignedPort} \"Click to go to preview site\") to go to the preview site")

new PrebuiltComment("newNoResources", "Hey there, ~~${PRAuthor}!\nThere's a lot of traffic right now so I wasn't able to create a website preview.\n<br>\nIf you need a preview, you can ask me to try again in a few hours.\nPost a comment with this exact text: `@~~{BotLoginUsername} create`")