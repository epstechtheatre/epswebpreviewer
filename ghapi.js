var Github = require("github-api");

var gh = new Github()

var repo = gh.getRepo("epstechtheatre", "epstechtheatre.github.io")

debugger

repo.getPullRequests().then((pr) => {
    debugger
})