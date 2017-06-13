#!/usr/bin/env node
const Promise = require("bluebird");
const debug = require("debug")("dota2vods/tournament-data");
const fs = require("fs");
const path = require("path");
const mkdirp = Promise.promisify(require("mkdirp"));
Promise.promisifyAll(fs, path);

const buildFolder = path.resolve(process.argv[2]);
const tournamentsFolder = "tournaments";
const tournamentsSourceFolder = path.join(__dirname, tournamentsFolder);
const tournamentsBuildFolder = path.join(buildFolder, tournamentsFolder);
const jsonExt = ".json";

function jsonFolderToObject(folder) {
    return fs.readdirAsync(folder).then(jsonFiles => new Promise((resolve, reject) => {
        let filesRead = 0;
        let obj= {};

        for (let jsonFile of jsonFiles) {
            jsonFile = path.join(folder, jsonFile);

            fs.statAsync(jsonFile).then(stat => {
                if (stat.isDirectory()) {
                    return jsonFolderToObject(jsonFile);
                }

                return fs.readFileAsync(jsonFile).then(JSON.parse);
            }).catch(err => {
                throw new Error("Error while parsing \"" + jsonFile + "\":\n" + err.stack);
            }).then(value => {
                if (typeof value === "object" && Object.keys(value).length > 0) {
                    obj[path.basename(jsonFile, jsonExt)] = value;
                }

                filesRead++;

                if (filesRead === jsonFiles.length) {
                    //If all directory entries have been checked, resolve promise
                    resolve(obj);
                }
            });
        }
    }));
}

mkdirp(tournamentsBuildFolder).then(() => fs.readdirAsync(tournamentsSourceFolder)).then(tournamentFolders => {
    for (let tournamentFolder of tournamentFolders) {
        const tournamentBuildFile = path.join(tournamentsBuildFolder, tournamentFolder + jsonExt);
        const tournamentSourceFolder = path.join(tournamentsSourceFolder, tournamentFolder);

        jsonFolderToObject(tournamentSourceFolder).then(JSON.stringify).then(json => {
            return fs.writeFileAsync(tournamentBuildFile, json).then(() => json.length);
        }).then(jsonSize => {
            if (jsonSize !== false) {
                debug("%s (%s bytes)", path.basename(tournamentFolder) + jsonExt, jsonSize);
            }
        });
    }
});
