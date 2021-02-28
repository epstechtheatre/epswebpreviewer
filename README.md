# EPS Web Preview
A nodejs script to track, download, and enable seamless contribution for pull requests.

This utility is maintained and hosted by Ben MacDonald (@Quantum158), on behalf of the E.P. Scarlett Technical Theatre Crew.


## Functions
The bot is hosted on an external provider and listens for pull request webhooks sent from the wiki repository. When a payload is received, the script attempts to download the pull request's branch and build the site using a jekyll instance. Multiple jekyll instances can be run simultaneously, one per pull request. 

The bot attempts to keep each instance open for 6 hours following the most recent commit to a PR. An instance is destroyed after these six hours, or earlier if the PR is closed for any reason.


## Usage
This project was designed exclusively for use by the E.P. Scarlett Technical Theatre Wiki Project. As per the project license, the software is provided "as is". Authors are released from any obligation to update or patch code should it not work for others.  

