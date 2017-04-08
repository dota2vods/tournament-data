#!/usr/bin/env node
const Promise = require("bluebird");
const debug = require("debug")("dota2vods/tournament-data");
const fs = require("fs");
const path = require("path");
Promise.promisifyAll(fs, path);

const tournamentsFolder = path.join(__dirname, "tournaments");
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

fs.readdirAsync(tournamentsFolder).then(tournamentFolders => {
    for (let tournamentFolder of tournamentFolders) {
        tournamentFolder = path.join(tournamentsFolder, tournamentFolder);
        fs.statAsync(tournamentFolder).then(stat => {
            if (stat.isDirectory()) {
                return jsonFolderToObject(tournamentFolder);
            }

            return false;
        }).then(obj => {
            if (obj === false) {
                return false;
            }

            const json = JSON.stringify(obj);
            return fs.writeFileAsync(tournamentFolder + jsonExt, json).then(() => json.length);
        }).then(jsonSize => {
            if (jsonSize !== false) {
                debug("%s (%s bytes)", path.basename(tournamentFolder) + jsonExt, jsonSize);
            }
        });
    }
});
