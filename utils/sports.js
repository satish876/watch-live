const { promisify } = require("util")
const _ = require("lodash")
const request = promisify(require("request"))
const puppeteer = require("puppeteer")

const baseUrl = "https://www.jokerlivestream.com/"
const searchUrl = "https://www.jokerlivestream.com/search.php?option=com_search&tmpl=raw&type=json&ordering=&searchphrase=all&Itemid=207&areas[]=event&sef=1&limitstart=0&"
const block_ressources = ['script', 'image', 'stylesheet', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'];

const getMatchUrl = async ({ keyword }) => {
    try {
        keyword = keyword.trim().toLowerCase()
        keyword = keyword.length > 20 ? keyword.substr(0, 20) : keyword

        const { matchPageUrl, error } = await getMatchPageUrl(keyword)
        if (error) throw new Error(error)

        if (matchPageUrl) {
            const { url, error } = await launchBrowser(baseUrl + matchPageUrl)
            return { url, error }
        }
    } catch (error) {
        return {
            error
        }
    }
}

//this will search for keyword and return the url of page where links to match are present 
async function getMatchPageUrl(keyword) {
    try {
        let { error, body } = await request(`${searchUrl}&searchword=${keyword}`)

        if (error) throw new Error()

        body = JSON.parse(body)
        if (body.results.length === 0) throw new Error()

        return {
            matchPageUrl: body.results[0].url
        }
    } catch (error) {
        return {
            error: "no match available"
        }
    }
}


//  this will launch headless browser and do few things
//      1. look for an english broadcast of the event, if not found, then it will return any other broadcast(if present)
//      2. go to the broadcast link, and finds the stream url
async function launchBrowser(url) {
    console.log("url", url);
    let browser, page;
    try {
        const setPageConfig = async (page) => {
            //these are added to access the target host in headless mode
            await page.setExtraHTTPHeaders({
                'Accept-Language': "en-US,en;q=0.9,hi;q=0.8"
            });
            await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36")

            await page.setRequestInterception(true);

            //this is to block navigation and irrelevant contents 
            page.on('request', request => {
                if ((request.isNavigationRequest() && request.redirectChain().length) ||
                    block_ressources.indexOf(request.resourceType()) > -1) {
                    request.abort();
                }
                else {
                    request.continue();
                }
            });

            await page.setDefaultTimeout(0)
        }

        browser = await puppeteer.launch({
            headless: true,
            ignoreHTTPSErrors: true,
            timeout: 0,
            args: [
                //these are importand flags
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        })

        page = await browser.newPage()
        await setPageConfig(page)

        await page.goto(url)
        console.log("url opened");
        await page.waitFor(".content")
    } catch (error) {
        console.log("error with puppeteer", error);
    }


    //getting the link of page where the sports is streaming
    const { error, link } = await page.evaluate(() => {
        try {
            let targetElement;
            const englishBroadcast = [...document.querySelectorAll("div table").entries()].find(i => {
                const data = i[1].parentNode.innerHTML.toLowerCase()
                return data.includes("(english)") && i[1].innerHTML.includes("live.harleyquinn")
            })

            targetElement = ((!englishBroadcast || Object.keys(englishBroadcast).length === 0) ?
                document : englishBroadcast[1])
                .querySelectorAll('a[href^="http://live.harleyquinn"]')[0]

            return {
                link: targetElement.href.replace("http:", "https:")
            }
        } catch (error) {
            return { error: "something went wrong" }
        }
    })

    console.log("link", link);

    await page.close()

    if (error) {
        console.log("error finding link", error);
        await browser.close()
        return {
            error: "Please try while match is live, no links available yet"
        }
    }


    page = await browser.newPage()
    await setPageConfig(page)

    let eventName, eventIframeUrl;
    const parseHtml = (string, text) => {
        let firstOccurance = string.indexOf(text) + 5
        return string.substr(firstOccurance, string.substr(firstOccurance).indexOf("\""))
    }

    {

        let { body } = await request(link)
        const scriptTag = body.split("banner-3")[1].substr(0, 200)
        eventName = parseHtml(scriptTag, "fid=\"")
        eventIframeUrl = parseHtml(scriptTag, "src=\"")
    }

    console.log(eventName, eventIframeUrl)
    let { body } = await request(eventIframeUrl)
    const iframeSrc = parseHtml(body, "src=\"").split("?")[0]

    console.log("iframeSrc", iframeSrc);

    await page.goto(link)

    console.log("link opened", `${iframeSrc}?u=${eventName}`.replace("http:", "https:"));
    await page.evaluate((src, name) => {
        const elem = document.createElement("iframe")
        elem.setAttribute("id", "mytarget")

        elem.onload = function () {
            target = this.contentWindow.document.body

            console.log(this.contentWindow.document.body);
            target.querySelectorAll("script").forEach((i, key) => {
                if (i.innerText.indexOf("Clappr") > -1) {
                    document.body.link = i.innerText
                }
            })

            if (!document.body.link) {
                target.querySelectorAll("iframe").forEach(i => {
                    elem.onload.call(i)
                })
            }
        };

        elem.async = false
        elem.setAttribute("src", `${src}?u=${name}`.replace("http:", "https:"))
        document.body.append(elem)
    }, iframeSrc, eventName)

    await page.waitForSelector('body[link]', { timeout: 0 })

    const clappr = await page.evaluate(() => document.body.link)
    await page.close()
    await browser.close()

    try {
        return {
            url: clappr.replace(/\s/g, "").split("source:")[1].split(",")[0].replace(/'/g, "").trim()
        }
    } catch (error) {
        return {
            error: "something went wrong"
        }
    }
}

module.exports = { getMatchUrl }