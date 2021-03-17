//Manage comments sent out to PR threads
const Github = require("github-api");

class CommentManager {
    constructor(authToken) {
        this.login = authToken

        this.gh = new Github({
            "token": this.login
        })
    }

    SendComment(text, PRID, useFancify) {
        this.gh
    }

    /**
     * Create a comment to send out
     * @param {String} PRAuthor The name of the author of the PR (used for personalized messages)
     * @param {"new"|"edit"} type What type of comment should be sent out
     */
    static createCommentString(PRAuthor, linkDomain, assignedPort, type) {
        let comment = "";
        switch (type) {
            case "new": {
                //Not having tabs is important as this is going to parsed verbatim into markdown
                comment = `Hey there, @${PRAuthor}!
                I've spun up a server so you can preview the wiki with your changes. It has all the same styling as the real wiki, so your changes here will look the exact same when merged.
                ## → [Click Here](http://${linkDomain}:${assignedPort} "Click to go to preview site") ← to go to the preview site.
                (Other contributors and reviewers may use this to make sure your changes are top-notch)
                <br>
                My resources are limited, so I can only keep the preview open for 6 hours. Don't worry, every time I see more changes show up in this thread I'll make sure to restart the timer, even if 6 hours have already gone by. I'll also plug your latest changes into the preview.
                ${PRAuthor !== "Quantum158" ? "Thanks for contributing!" : ""}` //This last line feels weird when I personally comment so it doesn't exist for me anymore
                break                
            }
                
            case "edit": {
                comment = `I've plugged your latest changes into the preview, so I'll keep the site open for another 6 hours.
                [Click Here](http://${linkDomain}:${assignedPort} "Click to go to preview site") to go to the preview site`
                break;
            }

            default:
                comment = `Something happened that I was not prepared to deal with internally. I was supposed to comment a link to a preview but it broke. Thanks for contributing though.`
        }
    }

    /**
     * I take in nice javascript text and turn it into mangled markdown text (no tabs at the start of lines)
     * @param {String} text
     */
    static fancify(text) {
        return text.replace(/^\s*/gmi, "") //Remove all spaces at the start of a line
    }
}


