#!/usr/bin/env bash

bundle install
asciidoctor-pdf -r asciidoctor-diagram theia.adoc
