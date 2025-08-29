import {
    ContentRating,
    SourceInfo,
    BadgeColor,
    SourceIntents
} from '@paperback/types'

import {
    getExportVersion,
    Madara
} from './Madara'
import { StarboundScansParser } from './StarboundScansParser'

const DOMAIN = 'https://starboundscans.com'

export const StarboundScansInfo: SourceInfo = {
    version: getExportVersion('2.0.0'),
    name: 'StarboundScans',
    description: `Extension that pulls webtoons from ${DOMAIN}`,
    author: 'MaksOuw',
    authorWebsite: 'http://github.com/MaksOuw',
    icon: 'icon.png',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED | SourceIntents.SETTINGS_UI,
    sourceTags: [
        {
            text: 'French',
            type: BadgeColor.GREY
        }
    ]
}

export class StarboundScans extends Madara {
    baseUrl: string = DOMAIN
    override language = '🇫🇷'
    override usePostIds: boolean = false
    override parser: StarboundScansParser = new StarboundScansParser()
    override chapterEndpoint: number = 3
    override chapterDetailsSelector = 'div.page-container > img'
}