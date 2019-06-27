const { promisify } = require("util")
const _ = require("lodash")
const request = promisify(require("request"))
const puppeteer = require("puppeteer")

const baseUrl = "https://www.jokerlivestream.com/"
const searchUrl = "https://www.jokerlivestream.com/search.php?option=com_search&tmpl=raw&type=json&ordering=&searchphrase=all&Itemid=207&areas[]=event&sef=1&limitstart=0&"

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

        if (error) throw new Error(error)

        body = JSON.parse(body)
        if (body.results.length === 0) throw new Error("no results")

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
        browser = await puppeteer.launch({
            headless: !true,
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
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.isNavigationRequest() && request.redirectChain().length)
                request.abort();
            else
                request.continue();
        });
        page.setDefaultTimeout(0)
    
        await page.goto(url)
        console.log("url opened");
        await page.waitFor(".content")
        console.log("url content found");
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
    console.log("error finding link", error);
    console.log("link", link);

    await page.close()

    if (error) {
        await browser.close()
        return {
            error: "Please try while match is live, no links available yet"
        }
    }


    page = await browser.newPage()
    page.setDefaultTimeout(0)
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.isNavigationRequest() && request.redirectChain().length)
            request.abort();
        else
            request.continue();
    });

    await page.goto(link)
    await page.waitForSelector(".banner-3 iframe")
    // await page.waitFor(30000)
    console.log("link opened");
    await page.evaluate(() => {
        let iframeSrc = document.querySelector(".banner-3 iframe").src
        const elem = document.createElement("iframe")
        elem.setAttribute("id", "mytarget")

        elem.onload = function () {
            target = this.contentWindow.document.body
            target.querySelectorAll("script").forEach((i, key) => {
                if (i.innerText.indexOf("Clappr") > -1) {
                    document.body.link = i.innerText
                }
            })
        };

        elem.async = false
        elem.setAttribute("src", iframeSrc.replace("http:", "https:"))
        document.body.append(elem)
    })

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