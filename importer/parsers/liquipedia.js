/*
Copyright 2019 Eric Enold <mail@ericenold.de>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const querystring = require("querystring");
const sleep = require('sleep-promise');
const realFetch = require('node-fetch');

const urlPrefix = 'https://liquipedia.net';
const templateOpeningTag = '{{';
const templateClosingTag = '}}';
const liquipediaTierTemplateToText = {
    '{{TierText/1}}': 'Premier',
};

exports.supports = url => url.startsWith(urlPrefix);

exports.parseCategory = async categoryUrl => {
    // We need to get the pages in the category via the api, so first extract the wiki and category title from the url
    const wiki = categoryUrl.substring(urlPrefix.length + 1, categoryUrl.indexOf('/', urlPrefix.length + 1));
    const categoryTitle = categoryUrl.substr(categoryUrl.lastIndexOf('/') + 1);

    // Throw error if the wiki or the category title was not found
    if (wiki.startsWith(urlPrefix) || wiki.length === 0 || !categoryTitle.startsWith('Category:')) {
        throw new Error(`Can not extract category title from url "${categoryUrl}".`)
    }

    const categoryApiUrl = `${urlPrefix}/${wiki}/api.php?` + querystring.stringify({
        'action': 'query',
        'format': 'json',
        'list': 'categorymembers',
        'cmprop': 'title',
        'cmlimit': 500, // 500 is the maximum. If we every parse categories with more that 500 tournaments, we need to
                        // account for that
        'cmtitle': categoryTitle,
    });
    const {query: {categorymembers: categoryMembers}} = await (await fetch(categoryApiUrl)).json();

    const tournamentUrls = [];
    for (const categoryMember of categoryMembers) {
        const url = `${urlPrefix}/${wiki}/${categoryMember.title.replace(/\W+/g, '_')}`;
        tournamentUrls.push(fullUrl(url));
    }

    return tournamentUrls;
};

exports.parseTournament = async tournamentUrl => {
    const source = await (await fetch(tournamentUrl + '?action=raw')).text();

    // Parse name and meta
    const info = findAndParseTemplateIncludes(source, 'Infobox league')[0];
    const tournamentData = {
        name: info.name,
        meta: {
            startDate: info.sdate || info.date,
            endDate: info.edate || info.date,
            info: {
                'Organizer': info.organizer,
                'Sponsor': removeLineBreaks(info.sponsor, ', '),
                'Game Version': info.patch,
                'Type': info.type,
                'Location': (info.city || '') + (info.city && info.country ? ', ' : '') + (info.country || ''),
                'Format': removeLineBreaks(info.format),
                'Prize pool': info.prizepoolusd ? '$' + info.prizepoolusd + ' USD' : null,
                'Liquipedia Tier': liquipediaTierTemplateToText[info.liquipediatier],
            },
            sources: [tournamentUrl],
            links: {
                official: info.website,
                liquipedia: tournamentUrl,
            }
        }
    };

    return tournamentData;
};

// Wrapper for fetch to follow the Liquipedia API Terms of Use
// See https://liquipedia.net/api-terms-of-use
const minTimeBetweenRequests = 2500; // Liquipedia rate limit is 1 request per 2 seconds, but we add some puffer
let lastRequest;
async function fetch(url, acceptJsonHeader = false) {
    // Wait if needed so we don't hit the rate limit
    if (lastRequest) {
        const timeToWait = minTimeBetweenRequests - (Date.now() - lastRequest);
        if (timeToWait > 0) {
            await sleep(timeToWait);
        }
    }

    // Do the fetch
    const response = await realFetch(url, {
        headers: {
            // Use a custom user agent :)
            'User-Agent': 'dota2vods.tv Importer',
        },
    });

    // Update last request time. We don't support parallel fetch calls
    lastRequest = Date.now();

    // Return the fetch response
    return response;
}

function fullUrl(url) {
    if (!url.startsWith(urlPrefix)) {
        url = urlPrefix + url;
    }

    return url;
}

function findAndParseTemplateIncludes(source, templateName) {
    const parsedTemplates = [];
    let searchNextIndex = 0;
    let startIndex;
    // In case the template include is used multiple times, find all includes
    while ((startIndex = source.indexOf(templateOpeningTag + templateName, searchNextIndex)) >= 0) {
        let nextOpeningTagIndex = source.indexOf(templateOpeningTag, startIndex + templateOpeningTag.length);
        let nextClosingTagIndex = source.indexOf(templateClosingTag, startIndex + templateOpeningTag.length);
        while (nextOpeningTagIndex < nextClosingTagIndex) {
            // There is another template block being included before our main template block closes, skip it
            nextOpeningTagIndex = source.indexOf(templateOpeningTag, nextClosingTagIndex + templateClosingTag.length);
            nextClosingTagIndex = source.indexOf(templateClosingTag, nextClosingTagIndex + templateClosingTag.length);
        }

        const parameters = {};
        source.substring(
            startIndex + templateOpeningTag.length + templateName.length,
            nextClosingTagIndex
        ).split('|').map(parameterString => {
            let [key, value] = parameterString.trim().split('=');

            if (key && value) {
                // We only support `key=value` parameters, also skip empty lines (key === '' and value === undefined)
                parameters[key] = mediaWikiCodeToMarkdown(value);
            }
        });

        parsedTemplates.push(parameters);
        searchNextIndex = nextClosingTagIndex + templateClosingTag.length + 1;
    }

    return parsedTemplates;
}

function mediaWikiCodeToMarkdown(text) {
    // Links
    let matches;
    while ((matches = text.match(/\[((https?:\/)?\/[^\s\]]+)\s+([^\]]+)\]/)) !== null) {
        const [matchedString, url, , title] = matches;
        text = text.replace(matchedString, `[${title.trim()}](${url.trim()})`);
    }

    // At last, return the transformed text
    return text;
}

function removeLineBreaks(text, replaceWith = ' ') {
    return text && text.replace(/<br \/>/g, replaceWith);
}
