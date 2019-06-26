let controller = new AbortController();
let signal = controller.signal;
window.addEventListener('DOMContentLoaded', (event) => {

    const errormsg = document.getElementById("errormsg")
    const searchtips = document.getElementById("searchtips")
    const downloadInstructions = document.getElementById("downloadInstructions")
    const input = document.getElementById("keyword")
    const streamUrl = document.getElementById("stream-url")
    const spinner = document.getElementById("spinner")
    const downloadButton = document.getElementById("download-button")

    downloadInstructions.style.display = "none"
    let requestInProgress = false;

    document.addEventListener("keyup", async (event) => {
        if (event.keyCode === 13 && event.target === input) {
            let keyword = event.target.value.trim().toLowerCase()
            if(keyword.length < 3) return alert("keyword must be of atleast 3 letters")

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
                    spinner.style.display = "none";
                    errormsg.style.display = "none"
                    searchtips.style.display = "none"
                    downloadInstructions.style.display = "flex"
                    streamUrl.value = result.url
                    downloadButton.href = "stream-file/" + result.fileId
                })
                .catch(error => {
                    requestInProgress = false
                    spinner.style.display = "none";
                    errormsg.style.display = "block"
                    searchtips.style.display = "flex"
                    downloadInstructions.style.display = "none"
                })
        }
    })
});