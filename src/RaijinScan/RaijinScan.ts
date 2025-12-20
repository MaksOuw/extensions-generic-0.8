import {
    BadgeColor,
    ContentRating,
    SourceInfo,
    SourceIntents
} from '@paperback/types'

import {
    getExportVersion,
    Madara
} from './Madara'
import { Parser } from './MadaraParser'
import { RaijinScanParser } from './RaijinScanParser'

const DOMAIN = 'https://raijin-scans.fr'

export const RaijinScanInfo: SourceInfo = {
    version: getExportVersion('1.0.4'),
    name: 'RaijinScan',
    description: `Extension that pulls manga from ${DOMAIN}`,
    author: 'MaksOuw',
    authorWebsite: 'http://github.com/MaksOuw',
    icon: 'icon.png',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
            {
                text: 'French',
                type: BadgeColor.GREY
            }
        ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED | SourceIntents.SETTINGS_UI
}

export class RaijinScan extends Madara {
    baseUrl: string = DOMAIN
    override language = '🇫🇷'
    override chapterEndpoint = 1
    override usePostIds: boolean = false
    override parser: Parser = new RaijinScanParser()
    override chapterDetailsSelector = 'img.preload-image'
    override hasProtectedChapters = true
    override protectedChapterDataSelector: string = 'div.protected-image-data'
    override bypassPage = `${DOMAIN}/manga/solo-leveling-scan-vf/`
}
