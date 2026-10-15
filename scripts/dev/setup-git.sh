#!/bin/sh
# Runs on npm install. Points git at the project's hooks and at the list of
# layout-only commits git blame skips. Outside a git checkout it does nothing.
git config core.hooksPath .githooks || exit 0
git config blame.ignoreRevsFile .git-blame-ignore-revs || exit 0
