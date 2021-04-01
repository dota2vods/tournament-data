#!/usr/bin/env node

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

const fs = require('fs').promises;
const path = require('path');
const commander = require('commander');
const yaml = require('js-yaml');
const mkdirp = require('mkdirp-promise');

const program = new commander.Command();

program
    .name('yarn importer')
    .usage('[command] [argument]')
    .description('Importer to automatically import and update tournaments.')
;

// Import a single tournament
program
    .command('import <tournament_url>', {isDefault: true})
    .description('Import a new tournament or update an existing one. (Default behaviour if no command is specified)')
    .action(tournamentUrl => importTournament(tournamentUrl).catch(e => console.error(e)))
;

// Import from collection
program
    .command('from-collection <collection_url>')
    .description(
        'Import and update all tournaments of a collection (mainly used for automation).\n' +
        'For the liquipedia importer we use category urls.'
    )
    .action(collectionUrl => importFromCollection(collectionUrl).catch(e => console.error(e)))
;

// Update command
program
    .command('update [<tournament_folder>]')
    .description('Update all imported tournaments. If <tournament_folder> is specified, only this tournament will be updated')
    .action(tournamentFolder => (
        (tournamentFolder ? updateTournament(tournamentFolder) : updateAllTournaments()).catch(e => console.error(e))
    ))
;

program.parse(process.argv);

async function importTournament(tournamentUrl, parser) {
    if (!parser) {
        parser = await selectParser(tournamentUrl);
    }

    console.log(`Importing tournament ${tournamentUrl}...`);
    const tournamentData = await parser.parseTournament(tournamentUrl);

    const id = tournamentData.name
        .toLowerCase()
        .replace(/[\W-]+/g,'-')
    ;
    const basePath = path.resolve(__dirname, '..', 'tournaments', id);

    // Aliases should be flow style
    if (tournamentData.aliases) {
        tournamentData.aliases = new FlowSequence(tournamentData.aliases);
    }

    // Split up tournament data into multiple files
    tournamentData.meta = new Include(basePath, 'meta.yaml', tournamentData.meta);

    // Dump data, starting with the index file
    (new Include(basePath, 'index.yaml', tournamentData)).dump();
}

async function importFromCollection(collectionUrl) {
    const parser = await selectParser(collectionUrl);

    console.log('Loading tournament urls from collection ...');
    const tournamentUrls = await parser.parseCollection(collectionUrl);
    console.log(`Found ${tournamentUrls.length} tournaments.`);

    // Import every tournament in this collection
    for (const tournamentUrl of tournamentUrls) {
        await importTournament(tournamentUrl, parser);
    }
}

function updateTournament(tournamentFolder) {
    console.log('Updating tournament folder', tournamentFolder);
    console.error('Not yet implemented.');
}

function updateAllTournaments() {
    console.log('Updating all tournaments.');
    console.error('Not yet implemented.');
}

async function selectParser(url) {
    // Load every parser till we find one that supports the url
    const files = await fs.readdir(path.join(__dirname, 'parsers'));
    for (const file of files) {
        if (!file.endsWith('.js')) {
            continue;
        }

        const parser = require('./parsers/' + file);
        if (parser.supports(url)) {
            return parser;
        }
    }

    throw new Error(`No supporting parser found for url "${url}"!`);
}

class Include {
    constructor(basePath, file, data) {
        this.basePath = basePath;
        this.file = file;
        this.data = data;
    }

    async dump() {
        const content = yaml.dump(this.data, {
            schema: CUSTOM_SCHEMA,
            indent: 2,
            lineWidth: 120,
            noRefs: true,
            noCompatMode: true,
        })
            .replace(/!<!include> /g, '!include ')
            .replace(/!<!flow-sequence> '([^']+)'/g, '$1')
        ;

        // Create file path
        const filePath = path.join(this.basePath, this.file);

        // Make sure the target directory exists
        await mkdirp(path.dirname(filePath));

        // Write content
        await fs.writeFile(filePath, content);

        // Notify the user about it
        console.log('Wrote ' + filePath)
    }
}

const IncludeType = new yaml.Type('!include', {
    kind: 'scalar', // string -> !include stages/group-stage.yml
    instanceOf: Include,
    represent: include => {
        include.dump();

        return include.file;
    },
});

class FlowSequence {
    constructor(sequence) {
        this.sequence = sequence;
    }
}

const FlowSequenceType = new yaml.Type('!flow-sequence', {
    kind: 'scalar',
    instanceOf: FlowSequence,
    represent: flowSequence => '[' + flowSequence.sequence.join(', ') + ']',
});

const CUSTOM_SCHEMA = yaml.Schema.create([
    IncludeType,
    FlowSequenceType,
]);
