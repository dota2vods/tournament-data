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

const { promisify } = require('util');
const { readFileSync, promises: fs } = require('fs');
const path = require('path');
const childProcess = require('child_process');
const rmdir = require('rmdir-recursive-async');
const mkdirp = require('mkdirp-promise');
const yaml = require('js-yaml');

const exec = promisify(childProcess.exec);

const buildFolder = path.resolve(__dirname, process.argv[2] || 'build');
const tournamentsSourceFolder = path.join(__dirname, 'tournaments');
const tournamentsBuildFolder = path.join(buildFolder, 'tournaments');
const tournamentListFile = 'tournament-list.json';
const tournamentsOverviewFile = 'tournaments-overview.json';

function createIncludeType(basePath) {
    return new yaml.Type('!include', {
        kind: 'scalar', // string -> !include stages/group-stage.yml
        resolve: data => typeof data === 'string' && data !== '',
        construct: function (fileToInclude) {
            return loadFile(path.join(basePath, fileToInclude));
        },
    });
}

function loadFile(filePath) {
    const IncludeType = createIncludeType(path.dirname(filePath));
    const INCLUDE_SCHEMA = yaml.Schema.create([ IncludeType ]);

    return yaml.load(readFileSync(filePath), {
        schema: INCLUDE_SCHEMA,
    });
}

async function getRecentlyUpdatedTournaments(diffFilter = '') {
    const {stdout} = await exec(`
        for folder in tournaments/*; do
            echo "$(git log -1 --format="%at" --diff-filter=${diffFilter} -- \${folder}) \${folder}"
        done
    `);

    return stdout.split('\n').filter(value => value.length !== 0).map(value => {
        const [time, file] = value.split(' ', 2);
        return {
            time: parseInt(time, 10),
            id: file.substr('tournaments/'.length),
        }
    }).sort((a, b) => b.time - a.time);
}

async function build() {
    // Clear build folder
    await rmdir(buildFolder, false);

    // Recreate it and make sure the parent folders also exist.
    await mkdirp(tournamentsBuildFolder);

    // Go through all tournament folders and create a json file for every tournament
    const tournamentList = [];
    const idToNameMap = {};
    const tournamentFolders = await fs.readdir(tournamentsSourceFolder);
    for (const tournamentFolder of tournamentFolders) {
        // Load tournament data, start with the index.yaml file
        const filePath = path.join(tournamentsSourceFolder, tournamentFolder, 'index.yaml');
        const tournamentData = loadFile(filePath);

        // Populate tournament list and idToNameMap
        tournamentList.push({
            id: tournamentFolder,
            name: tournamentData.name,
            aliases: tournamentData.aliases || [],
        });
        idToNameMap[tournamentFolder] = tournamentData.name;

        // Write tournament file
        const json = JSON.stringify(tournamentData);
        await fs.writeFile(
            path.join(tournamentsBuildFolder, tournamentFolder + '.json'),
            json
        );

        // Output status
        console.log(tournamentFolder + '.json (' + Math.round(json.length / 1024 * 100) / 100 + ' KB)');
    }

    // Write tournament list
    await fs.writeFile(
        path.join(buildFolder, tournamentListFile),
        JSON.stringify(tournamentList),
    );

    // Get the 5 most recently added tournaments
    const recentlyAdded = (await getRecentlyUpdatedTournaments('A')).slice(0, 5).map(tournament => ({
        ...tournament,
        name: idToNameMap[tournament.id],
    }));

    // Get 5 most recently updated tournaments
    const recentlyUpdated = (await getRecentlyUpdatedTournaments()).filter(({id: tournament}) => (
        // Filter out recently added tournaments
        recentlyAdded.findIndex(({id: addedTournament}) => addedTournament === tournament) < 0
    )).slice(0, 5).map(tournament => ({
        ...tournament,
        name: idToNameMap[tournament.id],
    }));

    // Generate overview
    await fs.writeFile(
        path.join(buildFolder, tournamentsOverviewFile),
        JSON.stringify({
            recentlyAdded,
            recentlyUpdated,
        }),
    );
}

build();
