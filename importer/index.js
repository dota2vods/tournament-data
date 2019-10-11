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

const program = new commander.Command();

program
    .name('yarn importer')
    .usage('[command] [argument]')
    .description('Importer to automatically import and update tournaments.')
;

// Import a single tournament
program
    .command('import <tournament_url>')
    .description('Import a new tournament or update an existing one. (Default behaviour if no command is specified)')
    .action(tournamentUrl => importTournament(tournamentUrl).catch(e => console.error(e)))
;

// Import from category
program
    .command('from-category <category_url>')
    .description('Import and update all tournaments of a category (mainly used for automation).')
    .action(categoryUrl => importFromCategory(categoryUrl).catch(e => console.error(e)))
;

// Update command
program
    .command('update [<tournament_folder>]')
    .description('Update all imported tournaments. If <tournament_folder> is specified, only this tournament will be updated')
    .action(tournamentFolder => (
        (tournamentFolder ? updateTournament(tournamentFolder) : updateAllTournaments()).catch(e => console.error(e))
    ))
;

// Unknown command, execute default command (import)
program.on('command:*', () => {
    // No fitting command found, insert 'import' command at index 2 (after /usr/bin/node and ./importer/index.js')
    process.argv.splice(2, 0, 'import');

    // Re-run program
    program.parse(process.argv);
});

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

async function importFromCategory(categoryUrl) {
    const parser = await selectParser(categoryUrl);

    console.log('Loading tournament urls from category ...');
    const tournamentUrls = await parser.parseCategory(categoryUrl);
    console.log(`Found ${tournamentUrls.length} tournaments.`);

    // Import every tournament in this category
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

        await fs.writeFile(path.join(this.basePath, this.file), content);
        console.log('Wrote ' + path.join(this.basePath, this.file))
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
