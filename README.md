# Slack-to-GitHub Issues Hubot Script: Uses Slack `reaction_added` events to file GitHub issues

Source: https://github.com/mbland/hubot-slack-github-issues

When a [Slack](https://slack.com/) chat message receives a specific emoji
reaction, this [Hubot](https://hubot.github.com/) script creates a
[GitHub](https://github.com/) issue with a link to that message.

This package is a thin convenience wrapper around
[slack-github-issues](https://www.npmjs.com/package/slack-github-issues) for
Hubot installations. Please see [the mbland/slack-github-issues
repository](https://github.com/mbland/slack-github-issues) for detailed
documentation.

## Installation

1. Follow [the "Installation and usage" instructions from
   mbland/slack-github-issues](https://github.com/mbland/slack-github-issues#installation-and-usage)
   to set up Node.js, a configuration file for the script, and Slack and GitHub
   users. (You can skip the `npm install slack-github-users --save` step.)

1. Follow [the "Hubot integration" instructions from
   mbland/slack-github-issues](https://github.com/mbland/slack-github-issues#hubot-integration)
   to create your own Hubot, ensure the correct versions of the `hubot` and
   `hubot-slack` packages are installed, and set the necessary environment
   variables.

1. In your Hubot repository, add `mbland/hubot-slack-github-issues` as a
   `dependency`, then run `npm install`.

1. Include the script in `external-scripts.json` in your Hubot repository:
   ```json
   [
     "hubot-slack-github-issues"
   ]
   ```

1. Run `hubot --adapter slack` locally or otherwise deploy to your preferred
   environment.

## Contributing

If you'd like to contribute to this script, see the
[mbland/slack-github-issues repository](https://github.com/mbland/slack-github-issues)
instead.

## Open Source license

This software is made available as [Open Source
software](https://opensource.org/osd-annotated) under the [ISC
License](https://www.isc.org/downloads/software-support-policy/isc-license/).
For the text of the license, see the [LICENSE](LICENSE.md) file.
