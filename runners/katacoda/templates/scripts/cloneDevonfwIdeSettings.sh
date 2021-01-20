#!/bin/sh

mkdir <%= cloneDir; %>
cd <%= cloneDir; %>

git clone https://github.com/devonfw/ide-settings.git settings

TOOLS="DEVON_IDE_TOOLS=(<%= tools; %>)"
echo $TOOLS > settings/devon.properties

NPM_CONFIG="unsafe-perm=true"
echo $NPM_CONFIG >> settings/devon/conf/npm/.npmrc

mv <%= cloneDir; %>settings/ <%= cloneDir; %>settings.git

cd <%= cloneDir; %>settings.git
git add -A
git config user.email "devonfw"
git config user.name "devonfw"
git commit -m "devonfw"
