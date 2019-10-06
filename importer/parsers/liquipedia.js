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

const realFetch = require('node-fetch');
const cheerio = require('cheerio');

const urlPrefix = 'https://liquipedia.net';
const templateOpeningTag = '{{';
const templateClosingTag = '}}';
const liquipediaTierTemplateToText = {
    '{{TierText/1}}': 'Premier',
};

exports.supports = url => url.startsWith(urlPrefix);

exports.parseCategory = async categoryUrl => {
    const $ = await loadDocument(categoryUrl);
    const $tournaments = $('.mw-category-group > ul > li > a');

    const tournamentUrls = [];
    $tournaments.each((index, tournament) => {
        const url = $(tournament).attr('href');

        tournamentUrls.push(fullUrl(url));
    });

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
                'Sponsor': info.sponsor && info.sponsor.replace(/<br \/>/g, ', '),
                'Game Version': info.patch,
                'Type': info.type,
                'Location': (info.city || '') + (info.city && info.country ? ', ' : '') + (info.country || ''),
                'Format': info.format,
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

// Wrapper for fetch to set a custom user agent, because Liquipedia requires it
function fetch(url) {
    return realFetch(url, {
        headers: {
            'User-Agent': 'dota2vods.tv Importer',
        },
    });
}

function fullUrl(url) {
    if (!url.startsWith(urlPrefix)) {
        url = urlPrefix + url;
    }

    return url;
}

async function loadDocument(url) {
    const html = await (await fetch(url)).text();

    return cheerio.load(html);
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
