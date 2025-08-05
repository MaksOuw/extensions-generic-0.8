import {
    BadgeColor,
    ChapterDetails,
    ContentRating,
    SearchRequest,
    SourceInfo,
    SourceIntents,
    SourceManga
} from '@paperback/types'
import * as cheerio from 'cheerio'
import {
    StarboundScansParser
} from './StarboundScansParser'
import {
    getExportVersion,
    MangaStream
} from '../MangaStream'
import { URLBuilder } from '../UrlBuilder'
import {
    getFilterTagsBySection
} from '../MangaStreamHelper'

const DOMAIN = 'https://starboundscans.com'

export const StarboundScansInfo: SourceInfo = {
    version: getExportVersion('1.0.1'),
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

export class StarboundScans extends MangaStream {
    baseUrl: string = DOMAIN
    override language = '🇫🇷'
    override usePostIds = false

    override manga_StatusTypes: StatusTypes = {
        ONGOING: 'ONGOING',
        COMPLETED: 'COMPLETED',
        DROPPED: 'DROPPED',
        PAUSED: 'PAUSED'
    }

    override directoryPath = 'series'

    override manga_tag_selector_box = 'div.flex.flex-wrap.gap-3.justify-start.items-start'

    override configureSections() {
        this.homescreen_sections['popular_today'].selectorFunc = ($: cheerio.CheerioAPI) => $('button', $('h2:contains(Populaire)')?.parent()?.next())
        this.homescreen_sections['popular_today'].getViewMoreItemsFunc = undefined
        this.homescreen_sections['latest_update'].selectorFunc = ($: cheerio.CheerioAPI) => $('div.group', $('h2:contains(Dernières Sorties)')?.parent()?.parent()?.next()?.next())
        this.homescreen_sections['latest_update'].getViewMoreItemsFunc = (page: string) => 'latest/'
        this.homescreen_sections['new_titles'].selectorFunc = ($: cheerio.CheerioAPI) => $('button', $('h2:contains(Récemment ajouté)')?.parent()?.next())
        this.homescreen_sections['new_titles'].titleSelectorFunc = this.homescreen_sections['popular_today'].titleSelectorFunc
        this.homescreen_sections['new_titles'].getViewMoreItemsFunc = (page: string) => `${this.directoryPath}/`
        this.homescreen_sections['top_alltime'].enabled = false
        this.homescreen_sections['top_monthly'].enabled = false
        this.homescreen_sections['top_weekly'].enabled = false
    }

    override parser: StarboundScansParser = new StarboundScansParser()

    override supportsTagExclusion = async (): Promise<boolean> => true

    override async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${this.directoryPath}/${mangaId}/`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        return this.parser.parseMangaDetails($, mangaId, this)
    }

    override async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // Request the manga page
        const request = App.createRequest({
            url: await this.getUsePostIds() ? `${this.baseUrl}/?p=${mangaId}/` : `${this.baseUrl}/chapter/${mangaId}-${chapterId}/`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)

        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page: number = metadata?.page ?? 1

        const request = await this.constructSearchRequest(page, query)
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = cheerio.load(response.data as string)
        const results = await this.parser.parseSearchResults($, this)

        const manga: PartialSourceManga[] = []
        for (const result of results) {
            let mangaId: string = result.mangaId

            manga.push(App.createPartialSourceManga({
                mangaId,
                image: result.image,
                title: result.title,
                subtitle: result.subtitle
            }))
        }

        metadata = !this.parser.isLastPage($, 'view_more') ? { page: page + 1 } : undefined
        return App.createPagedResults({
            results: manga,
            metadata
        })
    }

    override async constructSearchRequest(page: number, query: SearchRequest): Promise<any> {
        let urlBuilder: URLBuilder = new URLBuilder(this.baseUrl)
            .addPathComponent(this.directoryPath)

        urlBuilder = urlBuilder
            .addQueryParameter('q', query?.title ?? '')
            .addQueryParameter('genre', getFilterTagsBySection('genres', query?.includedTags, true))
            .addQueryParameter('genre', getFilterTagsBySection('genres', query?.excludedTags, false, await this.supportsTagExclusion()))

        return App.createRequest({
            url: urlBuilder.buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET'
        })
    }
}
