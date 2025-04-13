#!/bin/sh

go install github.com/gzuidhof/tygo@latest

export PATH=$(go env GOPATH)/bin:$PATH

git_root=$(git rev-parse --show-toplevel)

cd $git_root/api

(cd $git_root/api/export && tygo generate --config tygo.yml)
