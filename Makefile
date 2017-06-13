BUILD_FOLDER ?= build

.PHONY : build

default: install build

install:
	npm install
build:
	./build.js ${BUILD_FOLDER}
	#Copying the mockup files...
	cp tournament-list.json ${BUILD_FOLDER}/
	cp tournaments-overview.json ${BUILD_FOLDER}/
