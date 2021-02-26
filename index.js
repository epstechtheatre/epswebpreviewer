var Github = require("github-api");

var gh = new Github({
    "token": '4ce17ef1a2653e17d1646de9724741ef8dd7424e'
})

var repo = gh.getRepo("epstechtheatre", "epstechtheatre.github.io")

debugger

repo.getPullRequests().then((pr) => {
    debugger
})