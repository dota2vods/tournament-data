dota2vods/tournament-data
=========================

This repository contains the data for [dota2vods.tv](https://dota2vods.tv/), including tournament meta information and
the vod links.

It also contains the code that builds the final `[tournament-name].json` files.

Feel free to use this data for other projects.

License
-------

As we use Liquipedia as a source, the data (`tournament-data/`) is under the same license as the Liquipedia content:
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

Building
--------

```shell script
yarn install
yarn build
# Done
```
