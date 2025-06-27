import {
    BadgeColor,
    ContentRating,
    SourceInfo,
    SourceIntents
} from '@paperback/types'
import { CheerioAPI } from 'cheerio'

import {
    getExportVersion,
    MangaStream
} from '../MangaStream'

const DOMAIN = 'https://starboundscans.com'

export const LelMangaInfo: SourceInfo = {
    version: getExportVersion('0.0.0'),
    name: 'StarboundScans',
    description: `Extension that pulls manga from ${DOMAIN}`,
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

export class StarboundScans extends MangaStream {

    baseUrl: string = DOMAIN
    override language = '🇫🇷'
    
    override directoryPath = 'series'

    override configureSections() {
        this.homescreen_sections['popular_today'].selectorFunc = ($: CheerioAPI) => $('h2:contains(Populaire)')?.parent()?.next()
        this.homescreen_sections['latest_update'].selectorFunc = ($: CheerioAPI) => $('h2:contains(Dernières Sorties)')?.parent()?.next()
        this.homescreen_sections['new_titles'].selectorFunc = ($: CheerioAPI) => $('h2:contains(Récemment ajouté)')?.parent()?.next()
    }

    override supportsTagExclusion = async (): Promise<boolean> => true
}