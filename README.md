dota2vods/tournament-data
=========================

This repository contains the data for [dota2vods.tv](https://dota2vods.tv/), including tournament meta information and
the vod links.

It also contains the code that builds the final `[tournament-name].json` files.

Feel free to use this data for other projects.

License
-------

As we use Liquipedia as a source, the data (`tournaments/`) is under the same license as the Liquipedia content:
[CC-BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/us/)  
See also: [Using Liquipedia Content](https://liquipedia.net/dota2/Liquipedia:Copyrights#Using_Liquipedia_Content)

The javascript code is under MIT.

Editing
-------

The goal is to automatically import and create as much data as possible but it will never be perfect.  
If you see a mistake or want to add something, click yourself through the file tree, click on the file you want to
edit and then press the small edit pen on the right. Github will then automatically fork this repository for you
(aka clone it to your user namespace) and allow you to edit the file. Once your are done, describe your changes, click
"Commit" and create a pull request. If everything looks alright, we will merge the PR and your changes are live. :)

If you have a question or want to suggest something, feel free to open an issue.

Developing
----------

The repository comes with a build file (see [Building](#building)) and an importer ([Importing](#importing)).  
Feel free to study or use them in your own projects. They are under MIT. PRs are welcome.

*Note: Dependencies only needed for the importer should be added as dev dependencies (`yarn add -D`) so they don't
clutter up the CI build process.*

### Building

```shell script
yarn install
yarn build
# Done
```

### Importing

This repository comes with a ready to use importer to automatically import tournament data.
The importer is built to support multiple sources but only [Liquipedia](https://liquipedia.net/) is supported right now.

~~When updating an existing tournament, custom changes are not overwritten. This allows us to update a tournament while
keeping our extra data that the source may not provide. If there is an incorrect value in the source data, the source
should also be updated by the author, if possible. This way other people can benefit from it too.~~
*<- Not yet implemented, importer is WIP*

```shell script
# yarn importer --help
Usage: yarn importer [command] [argument]

Importer to automatically import and update tournaments.

Options:
  -h, --help                      output usage information

Commands:
  import <tournament_url>         Import a new tournament or update an existing one. (Default behaviour if no command is specified)
  from-collection <category_url>  Import and update all tournaments of a collection (mainly used for automation).
                                  For the liquipedia importer we use category urls.
  update [<tournament_folder>]    Update all imported tournaments. If <tournament_folder> is specified, only this tournament will be updated
```
