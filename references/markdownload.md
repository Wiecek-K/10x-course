Preview of MarkDownload - Markdown Web Clipper
MarkDownload - Markdown Web Clipper
This extension works like a web clipper, but it downloads articles in a markdown format. Turndown and Readability.js are used as core libraries. It is not guaranteed to work with all websites.

About this extension
This is an extension to clip websites and download them into a readable markdown file. Please keep in mind that it is not guaranteed to work on all websites.

To use this add-on, simply click the add-on icon while you are browsing the page you want to save offline. A popup will show the rendered markdown so you can make minor edits or copy the text, or you can click the download button to download an .md file.
Selecting text will allow you to download just the selected text

Context Menus
You can also right-click on pages, images, links and selections to copy or download snippets of Markdown.
You can also download all tabs in a window as Markdown files

Obsidian Integration
For integration with obsidian, you need to install and enable community plugins named "Advanced Obsidian URI". This plugin help us to bypass character limitation in URL. Because it's using clipboard as the source for creating new file.
More information: https://vinzent03.github.io/obsidian-advanced-uri/

External Libraries
It uses the following libraries:

- Readability.js by Mozilla in version from commit by Mozilla version 0.5.0. This library is also used for the Firefox Reader View and it simplifies the page so that only the important parts are clipped. (Licensed under Apache License Version 2.0)
- Turndown by Dom Christie in version 7.1.3 is used to convert the simplified HTML (from Readability.js) into markdown. (Licensed under MIT License)
- Moment.js version 2.29.4 used to format dates in template variables

Permissions

- Data on all sites: used to enable "Download All Tabs" functionality - no other data is captured or sent online
- Access tabs: used to access the website content when the icon in the browser bar is clicked.
- Manage Downloads: necessary to be able to download the markdown file.
- Storage: used to save extension options
- Clipboard: used to copy Markdown to clipboard
