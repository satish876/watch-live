const fs = require("fs")
const path = require("path")
const { promisify } = require("util")
const { exec } = require('child_process');
const express = require("express")
const yargs = require("yargs")
const _ = require("lodash")

const filesDirectoryPath = path.resolve(__dirname, "public/files")

const fileAppendAsync = promisify(fs.appendFile)

const { getMatchUrl } = require("./utils/sports")
const port = process.env.PORT || 3000

const app = express()
app.use(express.json());

app.use(express.static(__dirname + "/public"))

// adds a unique id for the request
app.use((req, res, next) => {
    req.uniqueId = (+new Date()) + _.uniqueId()
    next()
})

app.post("/stream-url", async (req, res) => {
    const { keyword } = req.body

    if (!keyword) {
        return res.status(400).send({
            error: "keyword is mandatory field"
        })
    }

    const { error, url } = await getMatchUrl({ keyword })

    if (error) {
        return res.status(500).send({
            error: error || "something went wrong, try again"
        })
    }

    const fileName = `${filesDirectoryPath}/${req.uniqueId}.m3u`
    const result = {
        url,
        fileId: req.uniqueId,
    }

    try {
        fs.open(fileName, "w", async (err, file) => {
            if (err) {
                console.log(err);
                delete result.fileUrl
                res.json(result)
            }

            await fileAppendAsync(file, "#EXTM3U\n")
            await fileAppendAsync(file, "#EXTINF: -1," + keyword + "\n")
            await fileAppendAsync(file, url)
            // #EXTM3U
            // #EXTINF: -1, Video title

            res.json(result)
        })
    } catch (error) {
        console.log(error);
    }
})

app.get("/stream-file/:fileId", (req, res, next) => {
    if(!req.params.fileId) {
        return res.status(400).send("fileId is missing")
    }

    const fileName = `${filesDirectoryPath}/${req.params.fileId}.m3u`
    console.log(fileName);
    res.sendFile(fileName, (err) => {
        if(err) {
            console.log(err);
            return res.status(400).send("No such file exists")
        }
    })

    setTimeout((fileName) => {
        fs.unlink(path.resolve(__dirname, "public", "live.m3u1"))
    }, 60*60*1000, fileName)
})

//removing all files on app start
fs.readdir(filesDirectoryPath, (err, files) => {
    const removeFile = promisify(fs.unlink)
    if (err) {
        return console.log(err);
    }

    const removedFiles = files.map(file => removeFile(path.resolve(filesDirectoryPath, file)))
    removedFiles.forEach(async file => {
        await file
    });
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
            console.log(stdout);
        });
    }
})

yargs.parse()

const server = app.listen(port, () => {
    console.log("Server is up at", port);
})