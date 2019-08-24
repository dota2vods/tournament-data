#!/usr/bin/env node
const fs = require("fs").promises;
const path = require("path");
const rmdir = require("rmdir-recursive-async");
const mkdirp = require("mkdirp-promise");

const buildFolder = path.resolve(__dirname, process.argv[2] || "build");
const tournamentsSourceFolder = path.join(__dirname, "tournaments");
const tournamentsBuildFolder = path.join(buildFolder, "tournaments");
const indexFile = "index.json";
const jsonExt = ".json";

async function folderToObject(folder) {
    const files = await fs.readdir(folder, {withFileTypes: true});

    let data = {};

    //Make sure the index file gets loaded first
    files.sort((a, b) => {
        const aScore = a.name === indexFile ? -1 : 0;
        const bScore = b.name === indexFile ? -1 : 0;
        return aScore - bScore;
    });

    for (const file of files) {
        let fileData;

        const filePath = path.join(folder, file.name);
        if (file.isDirectory()) {
            fileData = folderToObject(filePath);
        } else {
            fileData = JSON.parse(await fs.readFile(filePath));
        }

        if (file.name === indexFile) {
            //The index file gets applied to the object directly
            data = fileData;
        } else {
            //All other files are used as a new key
            data[path.basename(file.name, jsonExt)] = fileData;
        }
    }

    return data;
}

async function build() {
    // Clear build folder
    await rmdir(buildFolder, false);

    // Recreate it and make sure the parent folders also exist.
    await mkdirp(tournamentsBuildFolder);

    // Go through all tournament folders and create a json file for every tournament
    const tournamentFolders = await fs.readdir(tournamentsSourceFolder);
    for (const tournamentFolder of tournamentFolders) {
        // Read all json file in the folder and turn them into a single json file
        const tournamentData = await folderToObject(path.join(tournamentsSourceFolder, tournamentFolder));

        // Write
        const json = JSON.stringify(tournamentData);
        await fs.writeFile(
            path.join(tournamentsBuildFolder, tournamentFolder + jsonExt),
            json
        );

        // Output status
        console.log(tournamentFolder + jsonExt + " (" + json.length + " bytes)");
    }

    // Copy mockup files
    await [
        'tournament-list.json',
        'tournaments-overview.json',
    ].map(async file => await fs.copyFile(path.join(__dirname, file), path.join(buildFolder, file)))
}

build();
