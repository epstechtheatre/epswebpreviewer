# EPS Web Preview
A nodejs script to track, download, and enable seamless contribution for pull requests.

This utility is maintained and hosted by [Ben MacDonald](https://github.com/Quantum158), on behalf of the E.P. Scarlett Technical Theatre Crew.


## Functions
The script is hosted on an external provider and listens for pull request webhooks sent from the wiki repository. When a payload is received, the script attempts to download the pull request's branch and build the site using a jekyll instance. Multiple jekyll instances can be run simultaneously, one per pull request. 

The script attempts to keep each instance open for a certain, definable number of hours following the most recent commit to a PR. An instance is destroyed after this time, or earlier if the PR is closed for any reason.

The script also accepts basic commands in PR threads. This allows a user to request a preview site without needing to commit new code.

## Usage
This project was designed exclusively for use by the E.P. Scarlett Technical Theatre Wiki Project. As per the project license, the software is provided "as is". Authors are released from any obligation to update or patch code should it not work for others.  

When interacting with the live script, the usable commands are as follows. All commands are triggered by mentioning the script (for us @EPSWebPreview) and then writing a keyword

The current commands are as follows:


`@EPSWebPreview help` Sends a help comment showing all of the commands

`@EPSWebPreview status` Comments the current status of the preview site (whether it's active or not). The script will comment a link to the active preview site, if it exists.

`@EPSWebPreview create` Request a preview site. The script will comment a link to a create site if it can.

`@EPSWebPreview delete` Request to stop a preview site (how courteous of you)