[

![AI-powered second brain built with Karpathy's LLM Wiki pattern in Obsidian and Claude Code](https://substackcdn.com/image/fetch/$s_!_3zY!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F95cda988-253d-46c5-a19f-969f390efdbb_2752x1536.jpeg "AI-powered second brain built with Karpathy's LLM Wiki pattern in Obsidian and Claude Code")

I’ve saved hundreds of articles, podcasts, and YouTube videos across Notion, Pocket, and browser bookmarks over the years. And every time I wanted to revisit something I’d read, I had to dig through all of it just to find it. Even when I did, that article sat in complete isolation from everything else I’d saved on the same topic.

When I moved everything into Obsidian (I wrote about this in [my project management post](https://aimaker.substack.com/p/para-method-tiago-forte-claude-code-obsidian-ai-productivity-os)), it solved the tool fragmentation. One vault, all markdown, all accessible to [Claude Code](https://aimaker.substack.com/t/claude-code). But my notes still didn’t talk to each other. An article about automation had no connection to a podcast about [AI coding workflows](https://aimaker.substack.com/t/vibe-coding), which had no connection to an essay about why writing forces you to think clearly.

I was the one responsible for drawing those lines. Because it took so much effort, I didn’t actually do it as often as I expected. That’s the honest truth about note‑taking systems like Zettelkasten and “building a second brain.” The theory is beautiful; in practice, the maintenance kills it.

Then I saw what Andrej Karpathy shared. You know how much he inspires me—this is the second workflow [I’ve copied from him](https://aimaker.substack.com/p/how-i-built-skill-improves-all-skills-karpathy-autoresearch-loop).

For anyone who doesn’t know him, Karpathy is one of the most respected AI researchers in the world.

[

![X avatar for @karpathy](https://substackcdn.com/image/fetch/$s_!oMwR!,w_40,h_40,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fpbs.substack.com%2Fprofile_images%2F1296667294148382721%2F9Pr6XrPB.jpg)

Andrej Karpathy@karpathy

LLM Knowledge Bases Something I'm finding very useful recently: using LLMs to build personal knowledge bases for various topics of research interest. In this way, a large fraction of my recent token throughput is going less into manipulating code, and more into manipulating

10:42 PM · Apr 2, 2026 · 19.6M Views

2.71K Replies · 6.58K Reposts · 55.4K Likes

](https://x.com/karpathy/status/2039805659525644595?s=20)

He described a pattern he called an “LLM Wiki.” The idea is simple but the shift is significant: instead of you maintaining a knowledge base and occasionally [asking AI questions](https://aimaker.substack.com/p/ai-strategic-thinking-questions-over-answers) about it, the LLM builds and maintains the entire knowledge base for you.

You collect raw sources. Articles, papers, book notes, podcast takeaways, anything. You drop them into a folder. Then you tell the LLM to “compile” them into a wiki. It reads every source, writes summary pages, creates pages for key people and concepts, and cross-references everything. A single article might touch 10-15 pages across your wiki. The LLM handles all the bookkeeping you’d never do yourself.

Karpathy put it this way:

> “Obsidian is the IDE, the LLM is the programmer, the wiki is the codebase.”

You rarely ever write or edit the wiki manually. That’s the domain of the LLM.

[

![LLM Wiki three-layer architecture showing sources, Obsidian wiki pages, and Claude Code schema](https://substackcdn.com/image/fetch/$s_!rsI7!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F18ba119d-df97-428a-a5e0-6ec1099fdc61_2752x1536.jpeg "LLM Wiki three-layer architecture showing sources, Obsidian wiki pages, and Claude Code schema")

](https://substackcdn.com/image/fetch/$s_!rsI7!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F18ba119d-df97-428a-a5e0-6ec1099fdc61_2752x1536.jpeg)

And the part that hit me hardest: this compounds. Every new source the LLM ingests makes the whole wiki smarter. It becomes a network that grows denser over time. An article about [Tim Dettmers’ automation framework](https://timdettmers.com/2025/12/10/why-agi-will-not-happen/) gets connected to [Addy Osmani’s AI coding workflow](https://addyo.substack.com/p/my-llm-coding-workflow-going-into), which gets connected to [Dan Koe’s essay on why writing is thinking](https://letters.thedankoe.com/p/im-begging-you-to-write-more-essays). Three completely different topics, three different authors, one thread running through all of them that I never would have drawn on my own.

**Here’s the build:** Obsidian as the interface, Claude Code as the agent, and a set of [Obsidian Skills](https://github.com/kepano/obsidian-skills) that Steph Ango (the CEO of Obsidian) released to teach [Claude](https://aimaker.substack.com/t/claude-ai) how to write in Obsidian’s native language. Wikilinks. Callouts. Canvas. A [CLI (Command Line Interface)](https://aimaker.substack.com/p/google-workspace-cli-claude-code-daily-operating-system) for running the whole thing from the terminal. If you’re an Obsidian nerd, that last piece is what makes this actually work.

I’ve been running this system for my own interests. AI, human psychology, personal productivity, health and fitness, building a business. All of it flowing into one knowledge base where everything connects to everything else.

_**🚨 Heads up:** AI Maker Lab pricing goes up tonight, from $10/month to $15. If you enjoyed this post and want the full library of 25+ paid blueprints, plus everything coming next (video walkthroughs, expert conversations, monthly Q&A), today is the last day to lock in the current rate._

This post is the complete blueprint for building the system I just described. Not the theory. The exact folder structure, the commands, the schema, and a starter kit you can download and set up this afternoon.

[

![What's inside: LLM Wiki architecture, Claude Code commands, Obsidian Skills, examples, and starter kit](https://substackcdn.com/image/fetch/$s_!WOV_!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fea543fc3-a699-4b23-ba3c-f63daada9d31_2752x1536.jpeg "What's inside: LLM Wiki architecture, Claude Code commands, Obsidian Skills, examples, and starter kit")

](https://substackcdn.com/image/fetch/$s_!WOV_!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fea543fc3-a699-4b23-ba3c-f63daada9d31_2752x1536.jpeg)

Here’s what you’ll walk away with:

1.  **The Three-Layer Architecture**: How the knowledge base is organized: raw sources (your immutable reading material), the wiki (LLM-generated summary pages, cross-references, and concept maps), and the schema (the CLAUDE.md file that turns Claude from a generic chatbot into a disciplined wiki maintainer). I’ll show you how data flows between layers and why this structure makes the whole system work.
2.  **The Three Operations That Run the System**: The exact slash commands I use daily: `/ingest-url` (feed it a URL, Claude extracts the article and compiles it into the wiki, touching 5-15 pages in a single pass), `/process-inbox` (fleeting thoughts and quick notes get classified and integrated automatically), and `/lint-wiki` (a health check that finds broken links, orphan pages, contradictions, and content gaps the wiki suggests you research next).
3.  **Obsidian Skills (The Missing Piece)**: A set of agent skills that teach Claude how to work fluently with Obsidian’s native features. Wikilinks, callouts, frontmatter, the Obsidian CLI, database views with Bases, and visual canvases. These are what turn Obsidian from “a folder of markdown files” into a proper knowledge management platform that an LLM can operate natively.
4.  **Real Examples of the System in Action**: I made a video to walk you through this whole process so you can apply it on your own.
5.  **The Complete Starter Kit + Setup Guide**: A downloadable starter kit with the entire system pre-built: folder structure, three slash commands, all five Obsidian Skills, the schema, templates for books and podcasts, and a step-by-step guide to customize it for your own interests. One afternoon to set up. After that, the system runs on three commands.

By the end of this post, you’ll have a personal knowledge base where every article, book, podcast, and fleeting thought feeds into a living wiki that gets smarter the more you use it. Ask it a question six months from now and it gives you an answer synthesized from everything you’ve ever fed it.

To give you a clue, this is what it looks like when Claude ingests the ["Paul Graham’s “How to Think for Yourself](https://www.paulgraham.com/think.html)” and turns it into a wiki page:

The wiki page looks visually appealing, with proper wikilinks, frontmatter, tagging, and callouts, because it leverages Obsidian skills, so Claude knows which features to use in Obsidian. The most interesting part is the Notes section, where Claude creates a connection to [Dan Koe’s writing essay](http://letters.thedankoe.com/p/im-begging-you-to-write-more-essays). The bigger you build your wiki pages, the more connections you’ll find that you didn’t even notice, that’s how powerful this knowledge base is.

Before we go further: This system runs on Claude Code. If you’re not familiar with it, I’d recommend reading [my beginner’s guide first for the basics](https://aimaker.substack.com/p/how-i-turned-claude-code-into-personal-ai-agent-operating-system-for-writing-research-complete-guide), or [my ultimate guide for the full picture](https://aimaker.substack.com/p/claude-code-guide-starter-template), or [my project setup tutorial to get started](https://aimaker.substack.com/p/claude-code-project-setup-guide). You don’t need to be a developer, but you do need to be comfortable with a terminal. Alternatively, you can use the Claude Code extension inside VS Code or Cursor.

Let’s build it.

The system has three layers. That’s it. Once you understand how they relate to each other, everything else in this post will make sense.

The `sources/` folder is where your reading goes. Articles, book notes, podcast takeaways, PDFs, anything you want to remember. Organized by whatever categories make sense for your interests.

Mine looks like this:

```
sources/
  ai/
  health-and-fitness/
  human-psychology/
  personal-productivity/
  books/
  podcasts/
```

One rule: files in `sources/` are immutable. Once you save something here, you don’t edit it. This is your source of truth. The raw material that everything else gets built from.

There are two ways to get content in:

[

![Obsidian Web Clipper browser extension saving articles into an AI knowledge base vault](https://substackcdn.com/image/fetch/$s_!ecwR!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa1f781ef-acff-4469-ab67-c61025ae5d4c_800x500.png "Obsidian Web Clipper browser extension saving articles into an AI knowledge base vault")

](https://substackcdn.com/image/fetch/$s_!ecwR!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa1f781ef-acff-4469-ab67-c61025ae5d4c_800x500.png)

See an article you want to save? One click and it becomes a markdown file in your vault. You choose where it goes. This is the manual path, good when you’re browsing and want control over what gets captured.

And it doesn’t stop at articles. You can also send an entire YouTube podcast, along with its transcript, into Obsidian. Simply open the extension on the YouTube link you want to save to your Obsidian vault or click “Reader” view to see the full transcript details.
