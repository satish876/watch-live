const fs = require("fs")
const path = require("path")
const { promisify } = require("util")
const { exec } = require('child_process');
const express = require("express")
const yargs = require("yargs")
const _ = require("lodash")
const { getMatchUrl } = require("./utils/sports")
const port = process.env.PORT || 3000

const app = express()
app.use(express.json());

app.use(express.static(path.resolve("./public")))

app.post("/stream-url", async (req, res) => {
    const { keyword } = req.body

    if (!keyword) {
        return res.status(400).send({
            error: "keyword is mandatory field"
        })
    }

    const { error, url } = await getMatchUrl({ keyword })

    if (error) {
        console.log(error);
        return res.status(500).json({
            error: error.toString() || "something went wrong, try again"
        })
    }

    const result = {
        url
    }
    res.json(result)
})

//command to run in terminal
// watch-live --keyword="..." 
yargs.command({
    command: "watch-live",
    describe: "watch a live event",
    builder: {
        keyword: {
            type: "string",
            demandOption: true,
            describe: "a breif description of the event"
        }
    },
    async handler(args) {
        const { error, url } = await getMatchUrl({ keyword: args.keyword })

        if (error) {
            server.close()
            return {
                error
            }
        }

        console.log("Hold tight!");
        console.log(url);

        exec(`vlc ${url}`, (err, stdout, stderr) => {
            if (err) {
                server.close()
                return console.error(err);
            }
        });
    }
})

yargs.parse()

const server = app.listen(port, () => {
    console.log("Server is up at", port);
})
}