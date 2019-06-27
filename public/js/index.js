let controller = new AbortController();
let signal = controller.signal;
let streamConfig = ""
window.addEventListener('DOMContentLoaded', (event) => {

    const errormsg = document.getElementById("errormsg")
    const searchtips = document.getElementById("searchtips")
    const downloadInstructions = document.getElementById("downloadInstructions")
    const input = document.getElementById("keyword")
    const streamUrl = document.getElementById("stream-url")
    const spinner = document.getElementById("spinner")
    // const downloadButton = document.getElementById("download-button")

    document.getElementById("form").addEventListener("submit", () => {
        var blob = new Blob([streamConfig], { type: "application/octet-stream" });
        saveAs(blob, "play-with-vlc-player.m3u");
    })

    downloadInstructions.style.display = "none"
    let requestInProgress = false;

    document.addEventListener("keyup", async (event) => {
        if (event.keyCode === 13 && event.target === input) {
            streamConfig = ""

            let keyword = event.target.value.trim().toLowerCase()
            if (keyword.length < 3) return alert("keyword must be of atleast 3 letters")

            if (requestInProgress) {
                controller.abort();
                controller = new AbortController();
                signal = controller.signal;
            }

            setTimeout(() => {
                requestInProgress = true;
                errormsg.style.display = "none"
                spinner.style.display = "inline-block";
            }, 0)

            fetch("/stream-url", {
                method: "POST",
                body: JSON.stringify({
                    keyword
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
                signal
            })
                .then(async (res) => {
                    requestInProgress = false
                    if (res.ok) return res.json()

                    throw await res.json()
                })
                .then(result => {
                    console.log("result", result);
                    spinner.style.display = "none";
                    errormsg.style.display = "none"
                    searchtips.style.display = "none"
                    downloadInstructions.style.display = "flex"
                    streamUrl.value = result.url
                    streamConfig = `#EXTM3U\n#EXTINF:-1,${keyword}\n${result.url}`
                })
                .catch(error => {
                    console.log("error", error);
                    requestInProgress = false
                    spinner.style.display = "none";
                    errormsg.style.display = "block"
                    searchtips.style.display = "flex"
                    downloadInstructions.style.display = "none"
                    streamConfig = ""
                })
        }
    })
});