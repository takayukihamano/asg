#!/bin/sh

DIR=$(pwd)
cd $(dirname $(readlink $0))
node . $@ --DIR=$DIR
# cd -
exit;

