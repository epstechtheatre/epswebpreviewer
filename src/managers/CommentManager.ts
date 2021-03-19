import { PRInstanceOptions } from "./InstanceManager";

//Manage comments sent out to PR threads
const Github = require("github-api");
export default class CommentManager {
    Parent: import("../index").Main
    gh: any //Unfortunately this package doesn't have typings

    constructor(Parent: import("../index").Main) {
        this.Parent = Parent

        this.gh = new Github({
            "token": this.Parent.authData.githubToken
        })
    }

    getBotLogin(): Promise<string> {
        let _this = this
        return new Promise(async function (resolve, reject) {
            let Me = _this.gh.getUser() //No params defaults to login user

            //TODO: Something

            resolve(Me)

        })
    }

    SendComment(options: PRInstanceOptions, commentString: string, useFancify: boolean): Promise<boolean> {
        let _this = this
        return new Promise(async function (resolve, reject) {
            _this.gh.getIssues(options.PRRepoAccount, options.PRRepoName).createIssueComment(options.PRID, commentString, (comment: any) => {
                debugger
                console.log(`Commented to PR ${options.PRID}`)
                resolve(true)
            })
        })
    }

    /**
     * Create a comment to send out
     * @param {String} PRAuthor The name of the author of the PR (used for personalized messages)
     * @param {"new"|"edit"} type What type of comment should be sent out
     */
    static createCommentString(PRAuthor: string, linkDomain: string, assignedPort: number, openTime: number, type: "newServerFull" | "edit" | "new") {
        let comment = "";
        switch (type) {
            case "new": {
                //Not having tabs is important as this is going to parsed verbatim into markdown
                comment = `Hey there, @${PRAuthor}!
                I've spun up a server so you can preview the wiki with your changes. It has all the same styling as the real wiki, so your changes here will look the exact same when merged.
                ## → [Click Here](http://${linkDomain}:${assignedPort} "Click to go to preview site") ← to go to the preview site.
                (Other contributors and reviewers may use this to make sure your changes are top-notch)
                <br>
                My resources are limited, so I can only keep the preview open for ${openTime} hour${openTime === 1 ? "": "s"}. However, every time I see more changes show up in this thread I'll restart the timer, even if ${openTime} hour${openTime === 1 ? " has" : "s have"} already gone by. I'll also plug your latest changes into the preview.
                ${PRAuthor !== "Quantum158" ? "Thanks for contributing!" : ""}`
                break                
            }
                
            case "edit": {
                comment = `I've plugged your latest changes into the preview, so I'll keep the site open for another 6 hours.
                [Click Here](http://${linkDomain}:${assignedPort} "Click to go to preview site") to go to the preview site`
                break;
            }

            case "newServerFull": {
                comment = `Hey there, @${PRAuthor}!
                There's a lot of traffic right now so I wasn't able to create a website preview.
                If you need a preview. Come back in a couple hours, mention me at the start of a comment and type 'create'`
            }

            default:
                comment = `Something happened that I was not prepared to deal with internally. I was supposed to comment a link to a preview but it broke. Thanks for contributing though.`
        }

        return comment
    }

    /**
     * I take in nice javascript text and turn it into mangled markdown text (no tabs at the start of lines)
     */
    static fancify(text: string) {
        return text.replace(/^\s*/gmi, "") //Remove all spaces at the start of a line
    }
}


