bundle:
	rm -fr bundles/* && GITHUB_REPOSITORY=MaksOuw/extensions-generic-0.8 npm run bundle

update-bundle:
	rm -fr maksouw/* && cp -rp bundles/* maksouw/

log:
	npm run logcat

up:
	npm run watch
